import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Search, Filter, CheckSquare, Plus, Eye, Edit, Trash2, User, Building, CreditCard, FileText, UserCheck, ChevronRight, ChevronLeft, Settings, X, Square, Users, CheckCircle, AlertTriangle, XCircle, Edit2, ListTodo, Calendar, Copy, Clock, DollarSign } from 'lucide-react';
import { checkForDirectLeadView, handleDirectLeadViewOnMount } from '../utils/leadDirectViewFallback';
import { setupPermissionRefreshListeners } from '../utils/immediatePermissionRefresh.js';
import { leadEvents } from '../utils/auth';

// ⚡ PERFORMANCE: Debounce hook for optimizing search/filter inputs
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    
    return debouncedValue;
}

// Query Parameter Handler for Direct Lead View
// This code runs immediately when the component is loaded
(() => {
  try {
    // Get the current URL and parse query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const leadId = urlParams.get('lead_id');
    
    if (leadId) {
      
      // Store the lead ID in both sessionStorage and localStorage for redundancy
      sessionStorage.setItem('directViewLeadId', leadId);
      localStorage.setItem('lastViewedLeadId', leadId);
      
      // Set a flag to indicate we're handling a direct view
      window.isDirectLeadView = true;
      
      // Remove the query parameter to prevent infinite loops on reload
      // but keep the history clean
      if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
    
    // Also check for any redirected URL from different domain with lead_id
    const referrer = document.referrer;
    if (referrer) {
      
      try {
        // Check if referrer contains lead_id parameter
        if (referrer.includes('lead_id=')) {
          const referrerUrl = new URL(referrer);
          const referrerParams = new URLSearchParams(referrerUrl.search);
          const referrerLeadId = referrerParams.get('lead_id');
          
          if (referrerLeadId && !leadId) {
            sessionStorage.setItem('directViewLeadId', referrerLeadId);
            localStorage.setItem('lastViewedLeadId', referrerLeadId);
            window.isDirectLeadView = true;
          }
        }
      } catch (refError) {
        console.error('Error parsing referrer URL:', refError);
      }
    }
  } catch (error) {
    console.error('Error handling lead_id query parameter:', error);
  }
})();
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

// Custom CSS for sticky table header
const stickyHeaderStyles = `
  .sticky-table-container {
    position: relative;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    overflow-x: auto;
  }
  
  .sticky-table-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-bottom: 2px solid #e5e7eb;
  }
  
  .sticky-table-header th {
    position: sticky;
    top: 0;
    background: white;
    z-index: 51;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .sticky-table-header th:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: white;
    z-index: -1;
  }
`;

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
    // FILE COMPLETED status card commented out as requested
    // {
    //     key: "FILE COMPLETED",
    //     label: "FILE COMPLETED",
    //     icon: CheckCircle,
    //     gradient: "from-emerald-500 to-teal-400",
    //     shadowColor: "shadow-emerald-500/25",
    // },
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
    
    // Utility function to extract TL names from various TL fields
    const extractTLNames = (tlData, lead = null) => {
        // Accept tlData directly or get from lead if not provided
        if (!tlData && lead) {
            // Try multiple field names
            tlData = lead.AssignReprtsTo || lead.assignReportTo || lead.assigned_tl || lead.team_leader || lead.tl;
        }
        
        // ⚡ PERFORMANCE: Only log in development for debugging
        const isDev = process.env.NODE_ENV === 'development';
        
        if (isDev && lead && tlData !== undefined) {
            console.log('🔧 [EXTRACT] Lead', lead.custom_lead_id || lead.id, 'TL Data:', tlData, 'type:', typeof tlData);
        }
        
        if (!tlData) {
            if (isDev) console.log('🔧 [EXTRACT] No TL data found');
            return [];
        }
        
        // Handle array of objects or strings
        if (Array.isArray(tlData)) {
            if (isDev) console.log('🔧 [EXTRACT] Processing array of length:', tlData.length);
            const result = tlData.map((item, index) => {
                if (isDev) console.log(`🔧 [EXTRACT] Array item ${index}:`, item, 'type:', typeof item);
                
                if (typeof item === 'object' && item !== null) {
                    // Try multiple possible field names for TL name
                    const possibleNames = [
                        'name', 'tl_name', 'team_leader_name', 'full_name', 
                        'display_name', 'first_name', 'username', 'employee_name',
                        'user_name', 'team_leader', 'assigned_tl', 'assignedTL',
                        'assigned_team_leader', 'leader_name', 'tl', 'teamLeader',
                        'AssignReprtsTo'
                    ];
                    
                    for (const field of possibleNames) {
                        if (item[field]) {
                            if (isDev) console.log(`🔧 [EXTRACT] Found TL name "${item[field]}" in field "${field}"`);
                            return item[field];
                        }
                    }
                    
                    // If no standard field found, log the structure
                    if (isDev) console.log('🔧 [EXTRACT] No TL name found in object keys:', Object.keys(item));
                    return null;
                } else if (typeof item === 'string' && item.trim()) {
                    if (isDev) console.log(`🔧 [EXTRACT] Found string TL name:`, item.trim());
                    return item.trim();
                }
                return null;
            }).filter(Boolean);
            
            if (isDev) console.log('🔧 [EXTRACT] Final array result:', result);
            return result;
        }
        
        // Handle JSON string
        if (typeof tlData === 'string') {
            if (isDev) console.log('🔧 [EXTRACT] Processing string:', tlData);
            try {
                const parsed = JSON.parse(tlData);
                if (isDev) console.log('🔧 [EXTRACT] Parsed JSON:', parsed);
                return extractTLNames(parsed, lead);
            } catch (e) {
                if (isDev) console.log('🔧 [EXTRACT] Not JSON, treating as plain string');
                if (tlData.includes(',')) {
                    const result = tlData.split(',').map(name => name.trim()).filter(Boolean);
                    if (isDev) console.log('🔧 [EXTRACT] Comma-separated result:', result);
                    return result;
                } else {
                    const result = tlData.trim() ? [tlData.trim()] : [];
                    if (isDev) console.log('🔧 [EXTRACT] Single string result:', result);
                    return result;
                }
            }
        }
        
        // Handle single object
        if (typeof tlData === 'object' && tlData !== null) {
            if (isDev) console.log('🔧 [EXTRACT] Processing single object:', tlData);
            if (isDev) console.log('🔧 [EXTRACT] Object keys:', Object.keys(tlData));
            
            // Try multiple possible field names
            const possibleNames = [
                'name', 'tl_name', 'team_leader_name', 'full_name', 
                'display_name', 'first_name', 'username', 'employee_name',
                'user_name', 'team_leader', 'assigned_tl', 'assignedTL',
                'assigned_team_leader', 'leader_name', 'tl', 'teamLeader',
                'AssignReprtsTo'
            ];
            
            for (const field of possibleNames) {
                if (tlData[field]) {
                    if (isDev) console.log(`🔧 [EXTRACT] Found TL name "${tlData[field]}" in field "${field}"`);
                    return [tlData[field]];
                }
            }
            
            if (isDev) console.log('🔧 [EXTRACT] No TL name found in single object');
        }
        
        if (isDev) console.log('🔧 [EXTRACT] No TL names extracted, returning empty array');
        return [];
    };

    // 🚀 PERFORMANCE: Generate cache keys based on loan type to prevent data mixing
    const getCurrentLoanType = () => {
        return initialLoanType || localStorage.getItem('leadCrmLoanTypeId') || 'all';
    };
    
    const getCacheKeys = (loanType) => {
        const loanTypeKey = loanType || getCurrentLoanType();
        return {
            LEADS: `leads_cache_v2_${loanTypeKey}`,  // v2 with loan type specific
            LOAN_TYPES: 'loan_types_cache_v1',
            TIMESTAMP: `leads_cache_timestamp_${loanTypeKey}`  // Separate timestamp per loan type
        };
    };
    
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache validity for better performance

    // 🚀 OPTIMIZATION: Load cached data immediately for instant display
    // Cache is now loan-type specific to prevent PL/OD data mixing
    const getCachedLeadsData = (loanType = null) => {
        try {
            const CACHE_KEYS = getCacheKeys(loanType);
            const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
            const now = Date.now();
            
            // Check if cache is still valid (5 minutes)
            if (timestamp && (now - parseInt(timestamp)) < CACHE_DURATION) {
                const cachedLeads = localStorage.getItem(CACHE_KEYS.LEADS);
                const cachedLoanTypes = localStorage.getItem(CACHE_KEYS.LOAN_TYPES);
                
                if (cachedLeads) {
                    return {
                        leads: JSON.parse(cachedLeads),
                        loanTypes: cachedLoanTypes ? JSON.parse(cachedLoanTypes) : []
                    };
                }
            }
        } catch (error) {
            // Silent fail - will load from API
        }
        return null;
    };

    // 🚀 Get cached data before initializing states (loan-type specific)
    const cachedLeadsData = getCachedLeadsData();

    const [loanTypes, setLoanTypes] = useState(cachedLeadsData?.loanTypes || []);
    // Get the selected loan type from localStorage (set by Sidebar) or from props
    const [selectedLoanType, setSelectedLoanType] = useState(() => {
        // ONLY use the Lead CRM specific loan type ID, never the shared one
        return initialLoanType || localStorage.getItem('leadCrmLoanTypeId') || 'all';
    });
    const [leads, setLeads] = useState(cachedLeadsData?.leads || []);
    const [filteredLeads, setFilteredLeads] = useState(cachedLeadsData?.leads || []);
    
    // No pagination - load all data at once for better performance
    const [hasMoreLeads, setHasMoreLeads] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [totalLeadsCount, setTotalLeadsCount] = useState(0);

    // Pagination for display (initial 50, then load 100 more)
    const [displayedCount, setDisplayedCount] = useState(50);
    const INITIAL_LOAD = 50;
    const LOAD_MORE_COUNT = 100;

    
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedSubStatus, setSelectedSubStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    // ⚡ PERFORMANCE: Debounced search term to prevent excessive filtering
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
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

    // 🚀 PERFORMANCE: Request deduplication - prevent multiple simultaneous API calls
    const fetchInProgressRef = useRef(false);
    const lastFetchParamsRef = useRef('');
    const initialLoadCompleteRef = useRef(false);

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
    const canDeleteLeads = () => {
        // 🔒 PERMISSION-BASED CHECK: Only show SELECT button if user has delete permission
        // This respects Settings → Roles and Permissions configuration
        
        console.log('🔍 canDeleteLeads CALLED');
        
        // Check delete permission from role configuration
        const hasDeletePerm = hasLeadsPermission('delete');
        
        // Enhanced logging for debugging
        console.log('📋 Delete Permission Check:', {
            hasDeletePerm,
            username: localStorage.getItem('username'),
            designation: localStorage.getItem('designation'),
            roleName: localStorage.getItem('roleName'),
            isSuperAdmin: isSuperAdmin(),
            permissions: permissions,
            leadsPermissions: permissions?.['Leads'] || permissions?.['leads']
        });
        
        // Return permission result
        // If admin grants delete permission in Settings → this will be true
        // If admin removes delete permission in Settings → this will be false
        return hasDeletePerm;
    };

    const canUpdateStatus = () => {
        // 🔒 PERMISSION-BASED CHECK: Only allow status updates if user has status_update permission
        // This respects Settings → Roles and Permissions configuration
        
        console.log('🔍 canUpdateStatus CALLED');
        
        try {
            // Get user data from localStorage
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                
                // Check if super admin
                if (user.role?.name && user.role.name.toLowerCase().includes('super admin')) {
                    console.log('✅ User is Super Admin - can update status');
                    return true;
                }
                
                // Check nested format: leads.pl_&_odd_leads or leads.pl_odd_leads
                if (user.role?.permissions && Array.isArray(user.role.permissions)) {
                    const plOddPermission = user.role.permissions.find(p => 
                        p.page === 'leads.pl_&_odd_leads' || 
                        p.page === 'leads.pl_odd_leads' ||
                        p.page === 'leads_pl_&_odd_leads' ||
                        p.page === 'leads_pl_odd_leads'
                    );
                    
                    if (plOddPermission && plOddPermission.actions) {
                        const actions = Array.isArray(plOddPermission.actions) ? 
                            plOddPermission.actions : [plOddPermission.actions];
                        
                        const hasStatusUpdate = actions.includes('status_update') || actions.includes('status');
                        
                        console.log('🔍 PL & ODD LEADS status permission check:', {
                            page: plOddPermission.page,
                            actions: actions,
                            hasStatusUpdate: hasStatusUpdate
                        });
                        
                        if (hasStatusUpdate) {
                            console.log('✅ User has STATUS UPDATE permission');
                            return true;
                        }
                    }
                    
                    // Check for general leads permission (backward compatibility)
                    const leadsPermission = user.role.permissions.find(p => p.page === 'leads' || p.page === 'Leads');
                    if (leadsPermission && leadsPermission.actions) {
                        const actions = Array.isArray(leadsPermission.actions) ? 
                            leadsPermission.actions : [leadsPermission.actions];
                        
                        const hasStatusUpdate = actions.includes('status_update') || actions.includes('status');
                        
                        if (hasStatusUpdate) {
                            console.log('✅ User has STATUS UPDATE permission (unified format)');
                            return true;
                        }
                    }
                }
            }
            
            console.log('❌ User does NOT have STATUS UPDATE permission');
            return false;
        } catch (error) {
            console.error('❌ Error checking status update permission:', error);
            return false;
        }
    };

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

    // Helper function to trigger filter recalculation
    const triggerFilterUpdate = () => {
        setFilterRevision(prev => prev + 1);
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

    // Listen for permission updates from RoleSettings
    useEffect(() => {
        const handlePermissionUpdate = (event) => {
            console.log('LeadCRM: Permission update detected', event.detail);
            // Reload permissions from localStorage
            loadPermissions().then(() => {
                console.log('LeadCRM: Permissions reloaded after update');
            });
        };

        window.addEventListener('permissionsUpdated', handlePermissionUpdate);
        
        return () => {
            window.removeEventListener('permissionsUpdated', handlePermissionUpdate);
        };
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

    // ⚡ IMMEDIATE PERMISSION REFRESH LISTENER
    useEffect(() => {
        console.log('👂 Setting up immediate permission refresh listener in LeadCRM...');
        
        const cleanup = setupPermissionRefreshListeners((freshPermissions) => {
            console.log('🔄 LeadCRM received immediate permission update:', freshPermissions);
            
            // Trigger data reload immediately
            loadLeads();
            
            console.log('✅ LeadCRM data refreshed with new permissions');
        });

        return cleanup;
    }, []);

    // ⚡ ULTRA-FAST LOADING: Critical path initialization for INSTANT load
    useEffect(() => {
        const startTime = performance.now();

        // IMMEDIATE: Start loading ONLY critical data first
        const initializeEssentials = async () => {
            try {
                // ⚡ PRIORITY 1: Load leads ONLY - show UI immediately
                await loadLeads();

                const loadTime = performance.now() - startTime;
                console.log(`⚡ Initial leads loaded in ${loadTime.toFixed(0)}ms`);

                // ⚡ DEFERRED: Load non-critical data in background after a short delay
                // This ensures the UI renders first
                setTimeout(() => {
                    Promise.all([
                        loadLoanTypes(), // Priority 2: Load loan types
                        loadStatusesAndSubStatuses(), // Priority 3: Load statuses with sub-statuses
                        fetchEmployees() // Priority 4: Load team leader employees
                    ]).then(() => {
                        const totalTime = performance.now() - startTime;
                        console.log(`⚡ All data loaded in ${totalTime.toFixed(0)}ms`);
                    });
                }, 100); // 100ms delay to ensure UI renders first

            } catch (error) {
                console.error('Failed to initialize essentials:', error);
            }
        };

        // Start immediately without waiting for permissions
        initializeEssentials();
    }, []); // Empty dependency array - run once on mount
    
    // Dedicated effect for URL parameter handling, runs after initialization
    useEffect(() => {
        // Special handling for direct lead viewing from URL parameters
        const checkForDirectLeadViewInternal = async () => {
            try {
                // Check for direct view parameter in different storage locations
                const directViewLeadId = sessionStorage.getItem('directViewLeadId') || 
                                         localStorage.getItem('lastViewedLeadId') ||
                                         (window.isDirectLeadView ? new URLSearchParams(window.location.search).get('lead_id') : null);
                
                // If we have a lead ID and authentication token, try to load the lead directly
                if (directViewLeadId && localStorage.getItem('token')) {
                    
                    // Clear storage to prevent repeated processing
                    sessionStorage.removeItem('directViewLeadId');
                    localStorage.removeItem('lastViewedLeadId');
                    
                    try {
                        // Try to directly view the lead
                        const leadData = await handleViewLead(directViewLeadId);
                        
                        if (leadData) {
                            // Ensure lead details are shown instead of table
                            setSelectedLead(leadData);
                            setOpenSections([0]); // Open first section
                            setActiveTab(0);      // Set to Lead Details tab
                        }
                    } catch (error) {
                        console.error('LeadCRM: Secondary attempt to view lead failed:', error);
                        message.error(`Could not load the requested lead: ${error.message}`);
                    }
                }
            } catch (error) {
                console.error('Error in direct lead view check:', error);
            }
        };
        
        // Run after a short delay to ensure component is fully initialized
        const timer = setTimeout(checkForDirectLeadViewInternal, 500);
        return () => clearTimeout(timer);
    }, []);
    
    // Use the fallback utility as a final safeguard
    useEffect(() => {
        // Check if we need to handle direct lead viewing
        const leadId = checkForDirectLeadView();
        if (leadId) {
        }
        
        // Try to handle direct lead viewing on component mount
        const timer = setTimeout(() => {
            handleDirectLeadViewOnMount(handleViewLead);
        }, 1000); // Longer delay to ensure other initialization is complete
        
        return () => clearTimeout(timer);
    }, []);

    // ⚡ PERFORMANCE: Memoized loan type change handler with cache invalidation
    const handleLeadCrmLoanTypeChange = useCallback((event) => {
        const { loanTypeId, loanTypeName } = event.detail;
        
        // 🚀 CRITICAL: Invalidate old cache when switching loan types
        // This prevents PL data showing briefly when switching to OD
        const oldLoanType = selectedLoanType;
        if (oldLoanType !== loanTypeId) {
            console.log(`🔄 Switching from ${oldLoanType} to ${loanTypeId} - invalidating cache`);
            
            // Clear the states immediately to prevent flash of old data
            setLeads([]);
            setFilteredLeads([]);
            
            // Note: We keep loanTypes as they're shared across all loan types
        }
        
        setSelectedLoanType(loanTypeId);

        // Store in Lead CRM specific localStorage key
        localStorage.setItem('leadCrmLoanTypeId', loanTypeId);
        if (loanTypeName) {
            localStorage.setItem('leadCrmLoanTypeName', loanTypeName);
        }
    }, [selectedLoanType]);

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

    // 🚀 CRITICAL: Reload leads when loan type changes to fetch loan-type specific cache
    useEffect(() => {
        if (selectedLoanType && initialLoadCompleteRef.current) {
            console.log(`🔄 Loan type changed to ${selectedLoanType} - loading fresh data with correct cache`);
            
            // Try to load from the loan-type specific cache first
            const newCachedData = getCachedLeadsData(selectedLoanType);
            if (newCachedData && newCachedData.leads && newCachedData.leads.length > 0) {
                console.log(`⚡ Loaded ${newCachedData.leads.length} ${selectedLoanType} leads from cache instantly`);
                setLeads(newCachedData.leads);
                setFilteredLeads(newCachedData.leads);
            } else {
                // No cache for this loan type - reload from API
                console.log(`📡 No cache for ${selectedLoanType} - loading from API`);
                loadLeads();
            }
        }
    }, [selectedLoanType]);

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

    // Filter popup states with animation
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [filterPopupAnimating, setFilterPopupAnimating] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState('leadDate');
    // Get current month date range
    const getCurrentMonthRange = () => {
        // Get current date in IST
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
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
        selectedStatuses: [], // Empty array means show all statuses
        fileSentToLogin: false, // Filter for file_sent_to_login: true
        checkDuplicateLeads: false, // Filter for duplicate leads
        fileSentToLoginDateFrom: '', // File sent to login date from
        fileSentToLoginDateTo: '',    // File sent to login date to
        totalIncomeSort: '', // Total income sorting: 'highest' or 'lowest'
        totalIncomeFrom: '', // Minimum income range
        totalIncomeTo: ''    // Maximum income range
    });

    // Sidebar state for dynamic card width
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Bulk selection states
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [showCheckboxes, setShowCheckboxes] = useState(false);

    // Additional states for no activity filter
    const [loadingNoActivityFilter, setLoadingNoActivityFilter] = useState(false);
    const [showCopyLeadModal, setShowCopyLeadModal] = useState(false);
    const [showFileSentToLoginModal, setShowFileSentToLoginModal] = useState(false);
    
    // Filter revision state to force re-computation when filters are applied
    const [filterRevision, setFilterRevision] = useState(0);

    // Search states for filter options
    const [createdBySearch, setCreatedBySearch] = useState('');
    const [statusSearch, setStatusSearch] = useState('');
    const [teamNameSearch, setTeamNameSearch] = useState('');
    const [assignedTLSearch, setAssignedTLSearch] = useState('');

    // ⚡ PERFORMANCE: Debounced search values for smoother filtering
    const debouncedCreatedBySearch = useDebounce(createdBySearch, 200); // 200ms delay
    const debouncedStatusSearch = useDebounce(statusSearch, 200);
    const debouncedTeamNameSearch = useDebounce(teamNameSearch, 200);
    const debouncedAssignedTLSearch = useDebounce(assignedTLSearch, 200);

    // 🚀 PERFORMANCE: Loading states - NEVER show loading on initial mount if cache exists
    // Start with false to show cached data immediately, even if it's being refreshed
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [loadingStatuses, setLoadingStatuses] = useState(false);
    const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    // Refs to prevent multiple loading
    const statusesLoadedRef = useRef(false);
    
    // Table scroll functionality
    const tableScrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    
    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showCloseButton, setShowCloseButton] = useState(false);

    // API-based status and sub-status data
    const [allStatuses, setAllStatuses] = useState([]);
    const [allSubStatuses, setAllSubStatuses] = useState([]);
    const [statusHierarchy, setStatusHierarchy] = useState({}); // Maps main status to its sub-statuses
    const [subStatusToMainStatus, setSubStatusToMainStatus] = useState({}); // Maps sub-status to main status

    // Data for dropdowns
    const [teams, setTeams] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [employees, setEmployees] = useState([]);
    // ⚡ Start with zero counts for instant render, calculate in background
    const [statusCounts, setStatusCounts] = useState({
        "Not a lead": 0,
        "Active Leads": 0,
        "File sent to login": 0,
        "FILE COMPLETED": 0,
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

    // Update select all checkbox based on selected rows (using leads length since filteredLeadsData not yet defined)
    useEffect(() => {
        if (selectedRows.length === leads.length && leads.length > 0) {
            setSelectAll(true);
        } else {
            setSelectAll(false);
        }
    }, [selectedRows, leads]);

    // Listen for new lead creation events for instant UI updates
    useEffect(() => {
        console.log('🎯 LeadCRM: Setting up leadCreated event listener...');
        console.log('🎯 Event system available:', typeof leadEvents);
        console.log('🎯 Current timestamp:', Date.now());
        
        const handleLeadCreated = (data) => {
            console.log('🚨🚨🚨 EVENT RECEIVED AT:', new Date().toLocaleTimeString());
            console.log('🎉 NEW LEAD CREATED EVENT RECEIVED IN LEADCRM!');
            console.log('📦 Event data:', data);
            
            const newLead = data.lead;
            
            if (!newLead || !newLead._id) {
                console.error('❌ Invalid lead data - missing _id:', newLead);
                return;
            }
            
            // Process the new lead with complete field mapping to match existing leads format
            const processedLead = {
                ...newLead,
                // Ensure critical fields are properly formatted
                _id: newLead._id || newLead.id,
                name: newLead.name || newLead.customer_name || `${newLead.first_name || ''} ${newLead.last_name || ''}`.trim() || 'Unknown',
                customer_name: newLead.customer_name || newLead.name || 'Unknown',
                mobile_number: newLead.mobile_number || newLead.phone || '',
                phone: newLead.phone || newLead.mobile_number || '',
                
                // Status fields - keep object format if available, convert to string otherwise
                status: typeof newLead.status === 'object' ? newLead.status?.name : (newLead.status || 'Unknown'),
                sub_status: typeof newLead.sub_status === 'object' ? newLead.sub_status?.name : (newLead.sub_status || ''),
                
                // CRITICAL: Loan type fields - ensure all variants are set for filtering
                loan_type: newLead.loan_type || newLead.loan_type_name,
                loan_type_name: newLead.loan_type_name || newLead.loan_type || 'Unknown',
                loan_type_id: newLead.loan_type_id || newLead.loan_type,
                
                // Date fields
                created_at: newLead.created_at || new Date().toISOString(),
                updated_at: newLead.updated_at || new Date().toISOString(),
                
                // Other common fields
                email: newLead.email || '',
                campaign_name: newLead.campaign_name || '',
                created_by_name: newLead.created_by_name || newLead.created_by || '',
                department_name: newLead.department_name || '',
                custom_lead_id: newLead.custom_lead_id || newLead._id || '',
                
                // Financial fields
                loan_amount: newLead.loan_amount || 0,
                
                // File sent to login status
                file_sent_to_login: newLead.file_sent_to_login || false,
                file_sent_to_login_date: newLead.file_sent_to_login_date || null,
                
                // Dynamic fields
                dynamic_fields: newLead.dynamic_fields || {}
            };
            
            console.log('🔍 Processed lead - Loan type info:', {
                loan_type: processedLead.loan_type,
                loan_type_name: processedLead.loan_type_name,
                loan_type_id: processedLead.loan_type_id,
                selectedLoanType: selectedLoanType,
                willPassLoanTypeFilter: !selectedLoanType || selectedLoanType === 'all' || 
                    processedLead.loan_type_id === selectedLoanType ||
                    processedLead.loan_type === selectedLoanType ||
                    processedLead.loan_type_name === selectedLoanType
            });
            
            console.log('📋 Processed new lead:', processedLead);
            
            // Check if the lead will be visible with current filters
            const willBeVisible = (!selectedLoanType || selectedLoanType === 'all' || 
                processedLead.loan_type_id === selectedLoanType ||
                processedLead.loan_type === selectedLoanType ||
                processedLead.loan_type_name === selectedLoanType);
                
            if (!willBeVisible) {
                console.warn('⚠️ NEW LEAD WILL NOT BE VISIBLE - Loan type filter mismatch!');
                console.warn('   Lead loan type:', processedLead.loan_type_name);
                console.warn('   Current filter:', selectedLoanType);
                console.warn('   Switch to "All Leads" or matching loan type to see this lead');
            } else {
                console.log('✅ NEW LEAD WILL BE VISIBLE with current filters');
            }
            
            // ⚡ OPTIMIZED: Add to the beginning of leads array
            // useMemo will automatically recalculate without expensive filterRevision trigger
            setLeads(prevLeads => {
                // Prevent duplicate entries
                if (prevLeads.some(l => l._id === processedLead._id)) {
                    console.log('⚠️ Lead already exists, skipping duplicate');
                    return prevLeads;
                }
                console.log('⚡ INSTANT UPDATE: Adding new lead. Count:', prevLeads.length, '->', prevLeads.length + 1);
                return [processedLead, ...prevLeads];
            });
            
            // Update total count
            setTotalLeadsCount(prev => prev + 1);
            
            // ⚡ Update localStorage cache to include the new lead
            try {
                const CACHE_KEYS = getCacheKeys(selectedLoanType);
                const cachedLeadsStr = localStorage.getItem(CACHE_KEYS.LEADS);
                if (cachedLeadsStr) {
                    const cachedLeads = JSON.parse(cachedLeadsStr);
                    // Prevent cache duplicates
                    if (!cachedLeads.some(l => l._id === processedLead._id)) {
                        const updatedCache = [processedLead, ...cachedLeads];
                        localStorage.setItem(CACHE_KEYS.LEADS, JSON.stringify(updatedCache));
                        localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
                        console.log('💾 Cache updated');
                    }
                }
            } catch (cacheError) {
                console.error('❌ Cache update failed:', cacheError);
            }
            
            console.log('✅✅ INSTANT UPDATE COMPLETE - NEW LEAD VISIBLE NOW! ✅✅');
        };
        
        // Subscribe to lead creation events
        leadEvents.on('leadCreated', handleLeadCreated);
        console.log('✅ Event listener registered for instant lead updates');
        console.log('✅ LeadCRM is ACTIVE and listening for events');
        
        // FALLBACK: Also listen to localStorage for cross-page communication
        // This handles cases where CreateLead is on a different page/route
        const handleStorageChange = (e) => {
            if (e.key === 'newLeadCreated' && e.newValue) {
                console.log('📡 Received lead update via localStorage (cross-page)');
                try {
                    const data = JSON.parse(e.newValue);
                    handleLeadCreated(data);
                    // Clear the flag
                    localStorage.removeItem('newLeadCreated');
                } catch (err) {
                    console.error('Failed to parse localStorage lead data:', err);
                }
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Also check localStorage on mount in case lead was created before this page loaded
        const checkForNewLead = () => {
            const newLeadData = localStorage.getItem('newLeadCreated');
            if (newLeadData) {
                console.log('📡 Found pending lead in localStorage');
                try {
                    const data = JSON.parse(newLeadData);
                    // Only process if less than 5 seconds old
                    if (Date.now() - data.timestamp < 5000) {
                        handleLeadCreated(data);
                    }
                    localStorage.removeItem('newLeadCreated');
                } catch (err) {
                    console.error('Failed to process localStorage lead:', err);
                }
            }
        };
        checkForNewLead();
        
        // Test: Log every 5 seconds to show component is alive
        const heartbeat = setInterval(() => {
            console.log('💓 LeadCRM heartbeat - Still listening for lead events...');
        }, 5000);
        
        // Cleanup on unmount
        return () => {
            console.log('❌ LeadCRM unmounting - removing listener');
            clearInterval(heartbeat);
            window.removeEventListener('storage', handleStorageChange);
            leadEvents.off('leadCreated', handleLeadCreated);
        };
    }, [selectedLoanType, getCacheKeys]);

    // Helper function to get parent status for status cards
    const getParentStatusForStatusCard = (status, subStatus = null) => {
        // Handle null, undefined, or empty status values
        if (!status && !subStatus) {
            return "Active Leads"; // Default for completely empty status
        }
        
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
            "FILE COMPLETED": "FILE COMPLETED",
            "File Completed": "FILE COMPLETED", 
            "FILE COMPLETE": "FILE COMPLETED",
            "File Complete": "FILE COMPLETED",
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
            "Proposal Rejected": "Lost login",
            
            // Handle edge cases
            "Unknown": "Active Leads",
            "": "Active Leads",
            "null": "Active Leads",
            "undefined": "Active Leads"
        };
        
        // Check sub-status first if provided
        if (subStatus && subStatus !== null && subStatus !== undefined && subStatus !== '') {
            const subStatusStr = String(subStatus);
            if (statusToParentMap[subStatusStr]) {
                return statusToParentMap[subStatusStr];
            }
        }
        
        // Then check main status
        if (status && status !== null && status !== undefined && status !== '') {
            const statusStr = String(status);
            if (statusToParentMap[statusStr]) {
                return statusToParentMap[statusStr];
            }
        }
        
        // Default fallback based on common patterns
        const statusLower = String(status || '').toLowerCase();
        const subStatusLower = String(subStatus || '').toLowerCase();
        
        // Check both status and subStatus for patterns
        const combinedStatus = `${statusLower} ${subStatusLower}`.trim();
        
        if (combinedStatus.includes('not') && combinedStatus.includes('lead')) {
            return "Not a lead";
        } else if (combinedStatus.includes('lost') && combinedStatus.includes('mistake')) {
            return "Lost By mistake";
        } else if (combinedStatus.includes('lost') || combinedStatus.includes('rejected') || combinedStatus.includes('not interested')) {
            return "Lost login";
        } else if (combinedStatus.includes('login') || combinedStatus.includes('disbursed') || combinedStatus.includes('approved')) {
            return "File sent to login";
        } else if (combinedStatus.includes('completed') && combinedStatus.includes('file')) {
            return "FILE COMPLETED";
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
                } else if (field === 'pinCode' || field === 'pincode') {
                    // Support both camelCase and lowercase
                    updated.pincode = value;
                    if (!updated.dynamic_fields) updated.dynamic_fields = {};
                    if (!updated.dynamic_fields.address) updated.dynamic_fields.address = {};
                    updated.dynamic_fields.address.pincode = value;
                } else if (field === 'city') {
                    updated.city = value;
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
                        ...((field === 'pinCode' || field === 'pincode') && {
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
                            city: value,
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
                        ...((field === 'pinCode' || field === 'pincode') && {
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
                            city: value,
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
        
        // Also update filteredLeads to refresh table display
        setFilteredLeads(filteredLeads =>
            filteredLeads.map(l =>
                l._id === selectedLead._id ?
                    {
                        ...l,
                        [field]: value,
                        // Apply the same field mappings to filtered leads array
                        ...(field === 'customerName' && {
                            first_name: value.split(' ')[0] || '',
                            last_name: value.split(' ').slice(1).join(' ') || '',
                            name: value
                        }),
                        ...(field === 'mobileNumber' && {
                            mobile_number: value,
                            phone: value
                        }),
                        ...((field === 'pinCode' || field === 'pincode') && {
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
                            city: value,
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
            const apiUrl = `/api/leads/${selectedLead._id}?user_id=${userId}&_t=${Date.now()}`;
            
            console.log('🌐 API CALL DEBUG:');
            console.log('  - Field:', field);
            console.log('  - Value:', value);
            console.log('  - API URL (with cache buster):', apiUrl);

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
                } else if (field === 'pinCode' || field === 'pincode' || field === 'city') {
                    // For address fields, just send the top-level pincode/city
                    // The backend will automatically handle putting them in dynamic_fields.address
                    // DO NOT send dynamic_fields from frontend - it causes merge issues!
                    const pincodeField = field === 'pinCode' || field === 'pincode' ? 'pincode' : 'city';
                    updateData = { [pincodeField]: value };
                    console.log('  - Sending pincode/city as top-level field only (backend will handle dynamic_fields)');
                }
            }

            console.log('  - Update Data being sent:', JSON.stringify(updateData, null, 2));

            console.log('🚀 About to make fetch call...');
            console.log('📋 Request details:', {
                url: apiUrl,
                method: 'PUT',
                body: JSON.stringify(updateData),
                bodyLength: JSON.stringify(updateData).length
            });
            
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify(updateData),
                cache: 'no-store'
            });

            console.log('📨 Fetch completed, response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Response not OK:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            console.log('📦 Parsing response JSON...');
            const responseData = await response.json();
            console.log('✅ Response data received:', responseData);

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

            // CRITICAL FIX: Update selectedLead with the RESPONSE data from backend
            // This ensures we have the latest data including any backend transformations
            console.log('🔄 Updating selectedLead with response data...');
            console.log('🔄 responseData.dynamic_fields:', responseData.dynamic_fields);
            setSelectedLead(prev => ({
                ...prev,
                ...responseData,
                // Ensure dynamic_fields is properly merged
                dynamic_fields: {
                    ...prev?.dynamic_fields,
                    ...responseData.dynamic_fields
                }
            }));
            console.log('✅ selectedLead updated with fresh backend data');

            // Only show success message if not skipped (to avoid double messages from sections)
            if (!skipSuccessMessage) {
                message.success(`${displayName}: ${fieldValue}`);
            }

            // No need to fetch latest data - local state is already updated
            // This prevents unnecessary re-renders of the entire page

        } catch (error) {
            console.error('❌ ERROR in handleSelectedLeadFieldChange:', {
                error: error,
                message: error.message,
                stack: error.stack,
                field: field,
                value: value
            });
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
        console.log('🔍 createAboutSectionHandler called');
        console.log('  - updatedLeadObject:', updatedLeadObject);
        console.log('  - lead (current):', {
            pincode: lead.pincode,
            city: lead.city,
            dynamic_fields: lead.dynamic_fields
        });

        // Find what fields have changed by comparing with current lead
        const changes = {};
        Object.keys(updatedLeadObject).forEach(key => {
            if (updatedLeadObject[key] !== lead[key]) {
                console.log(`  - Change detected for ${key}:`, {
                    old: lead[key],
                    new: updatedLeadObject[key]
                });
                changes[key] = updatedLeadObject[key];
            }
        });

        console.log('  - Final changes to apply:', changes);

        // Apply each change through the proper handler (skip success messages since AboutSection shows its own)
        for (const [field, value] of Object.entries(changes)) {
            console.log(`  - Calling handleSelectedLeadFieldChange for ${field}:`, value);
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
                            {console.log('🔍 [LeadCRM] Preparing to render LoginFormSection')}
                            {console.log('🔍 lead.dynamic_fields:', lead.dynamic_fields)}
                            {console.log('🔍 lead.dynamic_fields?.applicant_form:', lead.dynamic_fields?.applicant_form)}
                            {console.log('🔍 lead.loginForm:', lead.loginForm)}
                            {console.log('🔍 Final data being passed:', lead.dynamic_fields?.applicant_form || lead.loginForm || {})}
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
                        <div>
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
                                                    
                                                    // IMPORTANT: Update filteredLeads as well so table shows updated data
                                                    setFilteredLeads(currentFilteredLeads => 
                                                        currentFilteredLeads.map(lead => 
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
                        <div>
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
                                        leadId={String(lead._id || lead.id)}
                                        userId={String(lead.assigned_to || localStorage.getItem('userId') || localStorage.getItem('user_id'))}
                                        leadData={lead}
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

    // ⚡ PERFORMANCE: Memoized status counts calculation based on filtered data
    const memoizedStatusCounts = useMemo(() => {
        const counts = {
            "Not a lead": 0,
            "Active Leads": 0,
            "File sent to login": 0,
            "FILE COMPLETED": 0,
            "Lost By mistake": 0,
            "Lost login": 0,
        };

        // Use the same filtering logic as filteredLeadsData to ensure consistency
        let filtered = Array.isArray(leads) ? [...leads] : [];

        // Apply search filter - USE DEBOUNCED SEARCH TERM for performance
        if (debouncedSearchTerm) {
            const searchLower = debouncedSearchTerm.toLowerCase();
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

        // Apply filter options - Combined status filtering
        // Handle both fileSentToLogin checkbox and selectedStatuses array together
        const hasFileSentToLoginFilter = filterOptions.fileSentToLogin;
        const hasStatusFilters = filterOptions.selectedStatuses && filterOptions.selectedStatuses.length > 0;
        
        if (hasFileSentToLoginFilter || hasStatusFilters) {
            filtered = filtered.filter(lead => {
                let matches = false;
                
                // Check if lead matches the FILE SENT TO LOGIN checkbox filter
                if (hasFileSentToLoginFilter && lead.file_sent_to_login === true) {
                    matches = true;
                }
                
                // Check if lead matches any of the selected status filters
                if (hasStatusFilters) {
                    const statusValue = typeof lead.status === 'object' ? (lead.status.name || 'Unknown') : (lead.status || 'Unknown');
                    const subStatusValue = typeof lead.sub_status === 'object' ? (lead.sub_status.name || '') : (lead.sub_status || '');
                    
                    const statusMatches = filterOptions.selectedStatuses.some(selectedStatus => {
                        if (selectedStatus === 'File sent to login') {
                            return lead.file_sent_to_login === true;
                        } else {
                            return selectedStatus === statusValue || selectedStatus === subStatusValue;
                        }
                    });
                    
                    if (statusMatches) {
                        matches = true;
                    }
                }
                
                return matches;
            });
        }
        
        // Legacy status filters for backward compatibility
        if (filterOptions.leadAllStatus && filterOptions.leadAllStatus.length > 0) {
            filtered = filtered.filter(lead => {
                const statusValue = typeof lead.status === 'object' ? (lead.status.name || 'Unknown') : (lead.status || 'Unknown');
                const subStatusValue = typeof lead.sub_status === 'object' ? (lead.sub_status.name || '') : (lead.sub_status || '');
                
                // Check if either main status or sub-status matches the selected statuses
                return filterOptions.leadAllStatus.includes(statusValue) || 
                       (subStatusValue && filterOptions.leadAllStatus.includes(subStatusValue));
            });
        }

        if (filterOptions.teamName && filterOptions.teamName.length > 0) {
            filtered = filtered.filter(lead => {
                // Use the same logic as uniqueTeams to ensure consistency
                const teamName = lead.department_name || lead.team_name;
                const teamNameValue = typeof teamName === 'object' ? teamName?.name : teamName;
                return filterOptions.teamName.includes(teamNameValue);
            });
        }

        // STRICT STATUS COUNTS TL FILTER: Use assign_report_to field (matching AboutSection)
        if (filterOptions.assignedTL && filterOptions.assignedTL.length > 0) {
            // ⚡ PERFORMANCE: Only log in development
            const isDev = process.env.NODE_ENV === 'development';
            if (isDev) {
                console.log('🎯 ==================== STRICT ASSIGNREPRTS STATUS COUNTS FILTER ====================');
                console.log('🎯 Selected TL filters:', filterOptions.assignedTL);
                console.log('🎯 Filter options object:', filterOptions);
                console.log('🎯 Total leads before TL filter:', filtered.length);
            }
            
            // Debug: Check if leads actually have assign_report_to data
            if (isDev) {
                let leadsWithTLData = 0;
                let leadsWithoutTLData = 0;
                filtered.slice(0, 10).forEach((lead, i) => {
                    const hasTLData = !!(lead.assign_report_to || lead.assignReportTo);
                    if (hasTLData) leadsWithTLData++;
                    else leadsWithoutTLData++;
                    
                    if (i < 5) {
                        console.log(`🎯 SAMPLE Lead ${i+1} (${lead.custom_lead_id}):`, {
                            assign_report_to: lead.assign_report_to,
                            assignReportTo: lead.assignReportTo,
                            created_by_name: lead.created_by_name,
                            hasAnyTLField: hasTLData
                        });
                    }
                });
                console.log(`🎯 Sample leads: ${leadsWithTLData} with TL data, ${leadsWithoutTLData} without TL data`);
            }
            
            const originalCount = filtered.length;
            
            filtered = filtered.filter(lead => {
                // Use same field as AboutSection: assign_report_to (with fallback to assignReportTo)
                const rawAssignReportTo = lead.assign_report_to || lead.assignReportTo;
                
                // Extract TL names using the same logic as AboutSection
                let assignReportToTLNames = [];
                if (rawAssignReportTo !== undefined && rawAssignReportTo !== null && rawAssignReportTo !== '') {
                    // Parse the assign_report_to data same as AboutSection
                    if (typeof rawAssignReportTo === 'string') {
                        try {
                            // Try to parse as JSON first
                            const parsed = JSON.parse(rawAssignReportTo);
                            if (Array.isArray(parsed)) {
                                assignReportToTLNames = parsed.map(item => {
                                    if (typeof item === 'object' && item.name) {
                                        return item.name;
                                    } else if (typeof item === 'string') {
                                        return item.trim();
                                    }
                                    return null;
                                }).filter(Boolean);
                            }
                        } catch {
                            // If not JSON, treat as comma-separated string
                            assignReportToTLNames = rawAssignReportTo.split(',').map(name => name.trim()).filter(Boolean);
                        }
                    } else if (Array.isArray(rawAssignReportTo)) {
                        assignReportToTLNames = rawAssignReportTo.map(item => {
                            if (typeof item === 'object' && item.name) {
                                return item.name;
                            } else if (typeof item === 'string') {
                                return item.trim();
                            }
                            return null;
                        }).filter(Boolean);
                    } else {
                        // Fallback to extractTLNames for other formats
                        assignReportToTLNames = extractTLNames(rawAssignReportTo, lead);
                    }
                }
                
                // ⚡ PERFORMANCE: Only log details in development
                if (isDev && originalCount <= 20) {
                    console.log(`🎯 ABOUTSECTION MATCH - Lead ${lead.custom_lead_id}:`);
                    console.log(`🎯   Raw assign_report_to:`, rawAssignReportTo, '(type:', typeof rawAssignReportTo, ')');
                    console.log(`🎯   Extracted TL names:`, assignReportToTLNames);
                    console.log(`🎯   Selected TL filters:`, filterOptions.assignedTL);
                    console.log(`🎯   About section would show these TL names:`, assignReportToTLNames);
                }
                
                // Handle filtering logic properly
                let shouldIncludeLead = false;
                
                // Case 1: Lead has no TL data (empty assignReportToTLNames)
                if (assignReportToTLNames.length === 0) {
                    // Only include if "Not Assigned" is specifically selected
                    if (filterOptions.assignedTL.includes('Not Assigned')) {
                        shouldIncludeLead = true;
                        if (isDev && originalCount <= 20) console.log(`🎯   ✅ MATCH: "Not Assigned" selected and lead has no TL data`);
                    } else {
                        shouldIncludeLead = false;
                        if (isDev && originalCount <= 20) console.log(`🎯   ❌ EXCLUDE: Lead has no TL data but "Not Assigned" not selected`);
                    }
                } else {
                    // Case 2: Lead has TL data - check if any TL name matches selected filters
                    shouldIncludeLead = assignReportToTLNames.some(tlName => {
                        const matches = filterOptions.assignedTL.includes(tlName);
                        if (isDev && originalCount <= 20) console.log(`🎯   About section TL "${tlName}" matches filter: ${matches ? '✅ YES' : '❌ NO'}`);
                        return matches;
                    });
                }
                
                if (isDev && originalCount <= 20) {
                    console.log(`🎯   FINAL ABOUTSECTION FILTER: ${shouldIncludeLead ? '✅ INCLUDE' : '❌ EXCLUDE'} - About section TLs will match filter selection`);
                }
                
                return shouldIncludeLead;
            });
            
            if (isDev) {
                console.log('🎯 ==================== ABOUTSECTION MATCHING TL FILTER END ====================');
                console.log('🎯 Filtered results (About section TL matches filter):', filtered.length, 'out of', originalCount);
                console.log('🎯 FILTER EFFECTIVENESS:', filtered.length < originalCount ? '✅ FILTER WORKING' : '❌ NO FILTERING OCCURRED');
            }
            
            if (filtered.length === originalCount) {
                console.log('🚨 PROBLEM: Filter did not reduce lead count! Possible issues:');
                console.log('🚨 1. All leads match the selected TL filter');
                console.log('🚨 2. Most leads have empty/null TL data');
                console.log('🚨 3. TL field names don\'t match expected format');
                console.log('🚨 4. Selected TL name doesn\'t match data format');
            } else {
                console.log('🎯 Now when you click on any lead, the Assigned TL in About section will match your filter selection');
            }
            console.log('🎯 ====================================================================');
        }

        if (filterOptions.createdBy && filterOptions.createdBy.length > 0) {
            filtered = filtered.filter(lead => {
                // Use the same logic as uniqueCreators to ensure consistency0000000
                const createdByName = lead.created_by_name || (typeof lead.created_by === 'object' ? lead.created_by?.name : lead.created_by);
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

        // Handle lead date filters (leadDateFrom and leadDateTo)
        if (filterOptions.leadDateFrom || filterOptions.leadDateTo) {
            filtered = filtered.filter(lead => {
                // Try different date fields in order of preference
                const leadDate = new Date(lead.created_at || lead.date_created || lead.created || lead.date);
                
                // If leadDate is invalid, exclude the lead
                if (isNaN(leadDate.getTime())) {
                    return false;
                }

                let passesFilter = true;
                
                // Check start date filter (from date)
                if (filterOptions.leadDateFrom && passesFilter) {
                    const startDate = new Date(filterOptions.leadDateFrom);
                    if (!isNaN(startDate.getTime())) {
                        // Set time to start of day (00:00:00) for accurate comparison
                        startDate.setHours(0, 0, 0, 0);
                        const leadDateOnly = new Date(leadDate);
                        leadDateOnly.setHours(0, 0, 0, 0);
                        
                        if (leadDateOnly < startDate) {
                            passesFilter = false;
                        }
                    }
                }
                
                // Check end date filter (to date)
                if (filterOptions.leadDateTo && passesFilter) {
                    const endDate = new Date(filterOptions.leadDateTo);
                    if (!isNaN(endDate.getTime())) {
                        // Set time to end of day (23:59:59.999) for accurate comparison
                        endDate.setHours(23, 59, 59, 999);
                        const leadDateWithTime = new Date(leadDate);
                        
                        if (leadDateWithTime > endDate) {
                            passesFilter = false;
                        }
                    }
                }
                
                return passesFilter;
            });
        }

        // Apply loan type filter if specified (for status cards) - UNLESS user has "all" leads permission
        const userHasAllPermission = hasLeadsPermission('all');
        
        if (selectedLoanType && selectedLoanType !== 'all' && !userHasAllPermission) {
            console.log('DEBUG: Applying loan type filtering for selectedLoanType:', selectedLoanType);
            filtered = filtered.filter(lead => {
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
        } else if (userHasAllPermission && selectedLoanType && selectedLoanType !== 'all') {
            console.log('DEBUG: User has "all" permission - BYPASSING loan type filtering for selectedLoanType:', selectedLoanType);
        }

        // Check duplicate leads filter (same logic as in filteredLeadsData)
        if (filterOptions.checkDuplicateLeads) {
            console.log('=== DUPLICATE FILTER DEBUG (LeadCRM - memoizedStatusCounts) ===');
            console.log('Total leads before duplicate filter:', filtered.length);
            
            // Helper function to normalize phone numbers to 10 digits
            const normalizePhone = (phone) => {
                if (!phone) return null;
                // Remove all non-digit characters
                const cleaned = phone.toString().replace(/\D/g, '');
                // Return null for numbers shorter than 10 digits
                if (cleaned.length < 10) return null;
                // Take last 10 digits (handles +91 prefix etc.)
                return cleaned.slice(-10);
            };

            // First pass: collect unique phone numbers from each lead
            const phoneToLeadsMap = new Map();
            
            filtered.forEach((lead, leadIndex) => {
                // Get all phone numbers from this lead and remove duplicates within the same lead
                const allPhones = [
                    normalizePhone(lead.mobile_number),
                    normalizePhone(lead.phone),
                    normalizePhone(lead.alt_phone_number)
                ].filter(p => p !== null);
                
                // Remove duplicates within the same lead using Set
                const uniquePhonesFromThisLead = [...new Set(allPhones)];
                
                console.log(`Lead ${leadIndex} (${lead.first_name} ${lead.last_name}):`, {
                    mobile: lead.mobile_number,
                    phone: lead.phone,
                    alt: lead.alt_phone_number,
                    uniquePhones: uniquePhonesFromThisLead
                });
                
                // Add each unique phone from this lead to the map
                uniquePhonesFromThisLead.forEach(phone => {
                    if (!phoneToLeadsMap.has(phone)) {
                        phoneToLeadsMap.set(phone, []);
                    }
                    phoneToLeadsMap.get(phone).push(lead);
                });
            });

            // Find phone numbers that appear in multiple DIFFERENT leads
            const duplicatePhones = new Set();
            console.log('Phone to leads mapping:');
            phoneToLeadsMap.forEach((leadsWithPhone, phone) => {
                console.log(`Phone ${phone}: ${leadsWithPhone.length} leads`);
                if (leadsWithPhone.length > 1) {
                    duplicatePhones.add(phone);
                    console.log(`  -> DUPLICATE: ${phone} appears in ${leadsWithPhone.length} different leads`);
                    leadsWithPhone.forEach((lead, idx) => {
                        console.log(`    Lead ${idx + 1}: ${lead.first_name} ${lead.last_name}`);
                    });
                }
            });

            console.log('Total duplicate phone numbers found:', duplicatePhones.size);

            if (duplicatePhones.size === 0) {
                console.log('No duplicate phone numbers found between different leads, returning empty array');
                // If no duplicates found, return empty array
                filtered = [];
            } else {
                console.log('Found', duplicatePhones.size, 'duplicate phone numbers, filtering leads...');
                // Second pass: filter leads that have duplicate phone numbers
                const beforeFilterCount = filtered.length;
                filtered = filtered.filter(lead => {
                    const uniquePhones = [...new Set([
                        normalizePhone(lead.mobile_number),
                        normalizePhone(lead.phone),
                        normalizePhone(lead.alt_phone_number)
                    ].filter(p => p !== null))];
                    
                    const hasDuplicate = uniquePhones.some(phone => duplicatePhones.has(phone));
                    if (hasDuplicate) {
                        console.log(`Keeping lead: ${lead.first_name} ${lead.last_name} (has duplicate phone)`);
                    }
                    return hasDuplicate;
                });
                console.log('Leads after duplicate filter:', filtered.length, '(was', beforeFilterCount, ')');
            }
            
        }

        // Apply income range filter (same logic as in filteredLeadsData)
        if (filterOptions.totalIncomeFrom || filterOptions.totalIncomeTo) {
            const minIncome = filterOptions.totalIncomeFrom ? parseFloat(filterOptions.totalIncomeFrom) : null;
            const maxIncome = filterOptions.totalIncomeTo ? parseFloat(filterOptions.totalIncomeTo) : null;
            
            console.log(`💰 ==================== STATUS COUNTS INCOME FILTER START ====================`);
            console.log(`💰 Filtering leads for status counts with income range:`, {
                totalIncomeFrom: filterOptions.totalIncomeFrom,
                totalIncomeTo: filterOptions.totalIncomeTo,
                minIncome,
                maxIncome,
                totalLeadsBeforeIncomeFilter: filtered.length
            });
            
            const originalCount = filtered.length;
            
            filtered = filtered.filter(lead => {
                // Extract total income using the same logic as column display
                const totalIncome = extractTotalIncome(lead);
                let passesFilter = true;
                
                // Check minimum income filter
                if (minIncome !== null && !isNaN(minIncome) && passesFilter) {
                    if (totalIncome === null || isNaN(totalIncome) || totalIncome < minIncome) {
                        passesFilter = false;
                    }
                }
                
                // Check maximum income filter
                if (maxIncome !== null && !isNaN(maxIncome) && passesFilter) {
                    if (totalIncome === null || isNaN(totalIncome) || totalIncome > maxIncome) {
                        passesFilter = false;
                    }
                }
                
                return passesFilter;
            });
            
            console.log(`💰 Status counts income filter results:`, {
                leadsAfterIncomeFilter: filtered.length,
                leadsFiltered: originalCount - filtered.length,
                filterEffective: originalCount !== filtered.length
            });
            console.log(`💰 ==================== STATUS COUNTS INCOME FILTER END ====================`);
        }

        // Now count the statuses from the filtered data
        let totalCounted = 0;
        filtered.forEach(lead => {
            totalCounted++;
            
            // First check if parent_status is set and use it for counting
            let parentStatusForCounting = lead.parent_status;
            
            // If no parent_status is set, determine it using the mapping logic
            if (!parentStatusForCounting) {
                const statusValue = typeof lead.status === 'object' ? (lead.status?.name || 'Unknown') : (lead.status || 'Unknown');
                const subStatusValue = typeof lead.sub_status === 'object' ? (lead.sub_status?.name || null) : (lead.sub_status || null);
                
                // Use the same logic as getParentStatusForStatusCard
                parentStatusForCounting = getParentStatusForStatusCard(statusValue, subStatusValue);
            }
            
            // Handle special case for file_sent_to_login condition
            if (lead.file_sent_to_login === true && parentStatusForCounting !== "File sent to login") {
                parentStatusForCounting = "File sent to login";
            }
            
            // Ensure parentStatusForCounting is never null or undefined
            if (!parentStatusForCounting || parentStatusForCounting === 'Unknown') {
                parentStatusForCounting = "Active Leads"; // Default fallback
            }
            
            // Count based on the determined parent status
            if (counts.hasOwnProperty(parentStatusForCounting)) {
                counts[parentStatusForCounting]++;
            } else {
                // For unknown statuses, increment Active Leads as default
                counts["Active Leads"]++;
                // Debug: Log unknown statuses
                console.warn('Unknown parent status encountered:', parentStatusForCounting, 'for lead:', lead._id || lead.id);
            }
        });
        
        // Debug: Log total counts to help identify discrepancies
        const totalCountsSum = Object.values(counts).reduce((sum, count) => sum + count, 0);
        if (totalCounted !== totalCountsSum) {
            console.warn('Status count mismatch:', {
                totalLeadsFiltered: totalCounted,
                totalCountsSum: totalCountsSum,
                difference: totalCounted - totalCountsSum,
                counts: counts
            });
        }

        return counts;
    }, [leads, selectedLoanType, debouncedSearchTerm, filterOptions, filterRevision]); // ⚡ USE DEBOUNCED

    // ⚡ PERFORMANCE: Memoized filtered leads computation
    const filteredLeadsData = useMemo(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('🚀 Starting Lead Filter Chain:', { 
                totalLeads: Array.isArray(leads) ? leads.length : 0,
                activeFilters: {
                    searchTerm: !!debouncedSearchTerm,
                    fileSentToLogin: filterOptions.fileSentToLogin,
                    selectedStatuses: filterOptions.selectedStatuses?.length || 0,
                    assignedTL: filterOptions.assignedTL?.length || 0,
                    assignedTLValues: filterOptions.assignedTL,
                    fileSentToLoginDateFrom: filterOptions.fileSentToLoginDateFrom,
                    fileSentToLoginDateTo: filterOptions.fileSentToLoginDateTo,
                    leadDateFrom: filterOptions.leadDateFrom,
                    leadDateTo: filterOptions.leadDateTo,
                    checkDuplicateLeads: filterOptions.checkDuplicateLeads,
                    totalIncomeFrom: filterOptions.totalIncomeFrom,
                    totalIncomeTo: filterOptions.totalIncomeTo
                }
            });
        }
        
        // Ensure leads is always an array before spreading
        let filtered = Array.isArray(leads) ? [...leads] : [];

        // Apply search filter - USE DEBOUNCED SEARCH TERM for smooth typing
        if (debouncedSearchTerm) {
            const searchLower = debouncedSearchTerm.toLowerCase();
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

        // Apply filter options - Combined status filtering
        // Handle both fileSentToLogin checkbox and selectedStatuses array together
        const hasFileSentToLoginFilter = filterOptions.fileSentToLogin;
        const hasStatusFilters = filterOptions.selectedStatuses && filterOptions.selectedStatuses.length > 0;
        
        if (hasFileSentToLoginFilter || hasStatusFilters) {
            filtered = filtered.filter(lead => {
                let matches = false;
                
                // Check if lead matches the FILE SENT TO LOGIN checkbox filter
                if (hasFileSentToLoginFilter && lead.file_sent_to_login === true) {
                    matches = true;
                }
                
                // Check if lead matches any of the selected status filters
                if (hasStatusFilters) {
                    const statusValue = typeof lead.status === 'object' ? (lead.status.name || 'Unknown') : (lead.status || 'Unknown');
                    const subStatusValue = typeof lead.sub_status === 'object' ? (lead.sub_status.name || '') : (lead.sub_status || '');
                    
                    const statusMatches = filterOptions.selectedStatuses.some(selectedStatus => {
                        if (selectedStatus === 'File sent to login') {
                            return lead.file_sent_to_login === true;
                        } else {
                            return selectedStatus === statusValue || selectedStatus === subStatusValue;
                        }
                    });
                    
                    if (statusMatches) {
                        matches = true;
                    }
                }
                
                return matches;
            });
        }
        
        // File sent to login date range filter
        if (filterOptions.fileSentToLoginDateFrom || filterOptions.fileSentToLoginDateTo) {
            filtered = filtered.filter(lead => {
                // Check ALL possible ways a lead might be "File Sent to Login"
                const isFileSentToLogin = lead.file_sent_to_login === true ||
                                        lead.file_sent_to_login === 'true' ||
                                        lead.file_sent_to_login === 1 ||
                                        (typeof lead.status === 'object' && lead.status?.name === 'File sent to login') ||
                                        (typeof lead.status === 'string' && lead.status === 'File sent to login') ||
                                        (typeof lead.sub_status === 'object' && lead.sub_status?.name === 'File sent to login') ||
                                        (typeof lead.sub_status === 'string' && lead.sub_status === 'File sent to login');
                
                if (!isFileSentToLogin) {
                    return false;
                }
                
                // Try multiple possible field names for file sent to login date
                const fileSentDate = lead.file_sent_to_login_date || 
                                   lead.file_sent_date || 
                                   lead.fileSentToLoginDate ||
                                   lead.file_sent_to_login_at ||
                                   lead.sent_to_login_date ||
                                   lead.login_file_sent_date ||
                                   lead.file_sent_to_login_time ||
                                   lead.login_sent_date ||
                                   lead.updated_at ||
                                   lead.created_at;
                
                if (!fileSentDate) {
                    return true; // Include all file sent to login leads even without dates
                }
                
                const leadDate = new Date(fileSentDate);
                if (isNaN(leadDate.getTime())) {
                    return true;
                }
                
                let passesFilter = true;
                
                if (filterOptions.fileSentToLoginDateFrom) {
                    const startDate = new Date(filterOptions.fileSentToLoginDateFrom);
                    if (!isNaN(startDate.getTime())) {
                        startDate.setHours(0, 0, 0, 0);
                        const leadDateOnly = new Date(leadDate);
                        leadDateOnly.setHours(0, 0, 0, 0);
                        
                        if (leadDateOnly < startDate) {
                            passesFilter = false;
                        }
                    }
                }
                
                if (filterOptions.fileSentToLoginDateTo && passesFilter) {
                    const endDate = new Date(filterOptions.fileSentToLoginDateTo);
                    if (!isNaN(endDate.getTime())) {
                        endDate.setHours(23, 59, 59, 999);
                        
                        if (leadDate > endDate) {
                            passesFilter = false;
                        }
                    }
                }
                
                return passesFilter;
            });
        }
        
        // Check duplicate leads filter
        if (filterOptions.checkDuplicateLeads) {
            if (process.env.NODE_ENV === 'development') {
                console.log('=== DUPLICATE FILTER DEBUG (LeadCRM - filteredLeadsData) ===');
                console.log('Total leads before duplicate filter:', filtered.length);
            }
            
            // Helper function to normalize phone numbers to 10 digits
            const normalizePhone = (phone) => {
                if (!phone) return null;
                // Remove all non-digit characters
                const cleaned = phone.toString().replace(/\D/g, '');
                // Return null for numbers shorter than 10 digits
                if (cleaned.length < 10) return null;
                // Take last 10 digits (handles +91 prefix etc.)
                return cleaned.slice(-10);
            };
            
            // First pass: collect unique phone numbers from each lead
            const phoneToLeadsMap = new Map();
            
            filtered.forEach((lead, leadIndex) => {
                // Get all phone numbers from this lead and remove duplicates within the same lead
                const allPhones = [
                    normalizePhone(lead.mobile_number),
                    normalizePhone(lead.phone),
                    normalizePhone(lead.alt_phone_number)
                ].filter(p => p !== null);
                
                // Remove duplicates within the same lead using Set
                const uniquePhonesFromThisLead = [...new Set(allPhones)];
                
                // Add each unique phone from this lead to the map
                uniquePhonesFromThisLead.forEach(phone => {
                    if (!phoneToLeadsMap.has(phone)) {
                        phoneToLeadsMap.set(phone, []);
                    }
                    phoneToLeadsMap.get(phone).push(lead);
                });
            });
            
            // Find phone numbers that appear in multiple leads
            const duplicatePhones = new Set();
            console.log('Phone to leads mapping:');
            phoneToLeadsMap.forEach((leadsWithPhone, phone) => {
                if (leadsWithPhone.length > 1) {
                    duplicatePhones.add(phone);
                    console.log(`DUPLICATE: Phone ${phone} appears in ${leadsWithPhone.length} different leads`);
                }
            });
            
            console.log('Total duplicate phone numbers found:', duplicatePhones.size);
            
            if (duplicatePhones.size === 0) {
                console.log('No duplicate phone numbers found, returning empty array');
                // If no duplicates found, return empty array
                filtered = [];
            } else {
                console.log('Found', duplicatePhones.size, 'duplicate phone numbers, filtering leads...');
                // Second pass: filter leads that have duplicate phone numbers
                const beforeFilterCount = filtered.length;
                filtered = filtered.filter(lead => {
                    const phones = [
                        normalizePhone(lead.mobile_number),
                        normalizePhone(lead.phone),
                        normalizePhone(lead.alt_phone_number)
                    ].filter(p => p !== null);
                    
                    const hasDuplicate = phones.some(phone => duplicatePhones.has(phone));
                    return hasDuplicate;
                });
                console.log('Leads after duplicate filter:', filtered.length, '(was', beforeFilterCount, ')');
            }
            
        }
        
        // Legacy status filters for backward compatibility
        if (filterOptions.leadAllStatus && filterOptions.leadAllStatus.length > 0) {
            filtered = filtered.filter(lead => {
                const statusValue = typeof lead.status === 'object' ? (lead.status.name || 'Unknown') : (lead.status || 'Unknown');
                const subStatusValue = typeof lead.sub_status === 'object' ? (lead.sub_status.name || '') : (lead.sub_status || '');
                
                // Check if either main status or sub-status matches the selected statuses
                return filterOptions.leadAllStatus.includes(statusValue) || 
                       (subStatusValue && filterOptions.leadAllStatus.includes(subStatusValue));
            });
        }

        if (filterOptions.teamName && filterOptions.teamName.length > 0) {
            filtered = filtered.filter(lead => {
                // Use the same logic as uniqueTeams to ensure consistency
                const teamName = lead.department_name || lead.team_name;
                const teamNameValue = typeof teamName === 'object' ? teamName?.name : teamName;
                return filterOptions.teamName.includes(teamNameValue);
            });
        }


        if (filterOptions.createdBy && filterOptions.createdBy.length > 0) {
            filtered = filtered.filter(lead => {
                // Use the same logic as uniqueCreators to ensure consistency
                const createdByName = lead.created_by_name || (typeof lead.created_by === 'object' ? lead.created_by?.name : lead.created_by);
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

        // Handle lead date filters (leadDateFrom and leadDateTo)
        if (filterOptions.leadDateFrom || filterOptions.leadDateTo) {
            filtered = filtered.filter(lead => {
                // Try different date fields in order of preference
                const leadDate = new Date(lead.created_at || lead.date_created || lead.created || lead.date);
                
                // If leadDate is invalid, exclude the lead
                if (isNaN(leadDate.getTime())) {
                    // Debug: uncomment for troubleshooting
                    // console.log('Invalid date for lead:', lead.id || lead._id, { 
                    //     created_at: lead.created_at, 
                    //     date_created: lead.date_created,
                    //     created: lead.created,
                    //     date: lead.date
                    // });
                    return false;
                }

                let passesFilter = true;
                
                // Check start date filter (from date)
                if (filterOptions.leadDateFrom && passesFilter) {
                    const startDate = new Date(filterOptions.leadDateFrom);
                    if (!isNaN(startDate.getTime())) {
                        // Set time to start of day (00:00:00) for accurate comparison
                        startDate.setHours(0, 0, 0, 0);
                        const leadDateOnly = new Date(leadDate);
                        leadDateOnly.setHours(0, 0, 0, 0);
                        
                        if (leadDateOnly < startDate) {
                            passesFilter = false;
                        }
                    }
                }
                
                // Check end date filter (to date)
                if (filterOptions.leadDateTo && passesFilter) {
                    const endDate = new Date(filterOptions.leadDateTo);
                    if (!isNaN(endDate.getTime())) {
                        // Set time to end of day (23:59:59.999) for accurate comparison
                        endDate.setHours(23, 59, 59, 999);
                        const leadDateWithTime = new Date(leadDate);
                        
                        if (leadDateWithTime > endDate) {
                            passesFilter = false;
                        }
                    }
                }
                
                // Debug: uncomment for troubleshooting
                // if (filterOptions.leadDateFrom || filterOptions.leadDateTo) {
                //     console.log('Date filter check:', {
                //         leadId: lead.id || lead._id,
                //         leadDate: leadDate.toISOString(),
                //         leadDateFrom: filterOptions.leadDateFrom,
                //         leadDateTo: filterOptions.leadDateTo,
                //         passesFilter
                //     });
                // }


                
                return passesFilter;
            });
        }

        // Apply lead age filter (missing implementation)
        if (filterOptions.leadAgeFrom || filterOptions.leadAgeTo) {
            filtered = filtered.filter(lead => {
                const leadDate = new Date(lead.created_at || lead.date_created || lead.created || lead.date);
                
                // If leadDate is invalid, exclude the lead
                if (isNaN(leadDate.getTime())) {
                    return false;
                }
                
                // Calculate age in days
                const currentDate = new Date();
                const ageInDays = Math.floor((currentDate - leadDate) / (1000 * 60 * 60 * 24));
                
                let passesFilter = true;
                
                // Check minimum age
                if (filterOptions.leadAgeFrom && passesFilter) {
                    const minAge = parseInt(filterOptions.leadAgeFrom);
                    if (!isNaN(minAge) && ageInDays < minAge) {
                        passesFilter = false;
                    }
                }
                
                // Check maximum age
                if (filterOptions.leadAgeTo && passesFilter) {
                    const maxAge = parseInt(filterOptions.leadAgeTo);
                    if (!isNaN(maxAge) && ageInDays > maxAge) {
                        passesFilter = false;
                    }
                }
                
                return passesFilter;
            });
        }

        // NOTE: Assigned TL filtering is now handled earlier in the function with AboutSection matching logic

        // Apply independent total income range filter
        if (filterOptions.totalIncomeFrom || filterOptions.totalIncomeTo) {
            // Convert filter values to ensure we have proper comparisons
            const minIncome = filterOptions.totalIncomeFrom ? parseFloat(filterOptions.totalIncomeFrom) : null;
            const maxIncome = filterOptions.totalIncomeTo ? parseFloat(filterOptions.totalIncomeTo) : null;
            
            console.log(`💰 ==================== INDEPENDENT INCOME RANGE FILTER START ====================`);
            console.log(`💰 [RANGE FILTER] Applied range: ${minIncome} - ${maxIncome}`);
            console.log(`💰 [RANGE FILTER] Filter options:`, {
                totalIncomeFrom: filterOptions.totalIncomeFrom,
                totalIncomeTo: filterOptions.totalIncomeTo,
                parsedMin: minIncome,
                parsedMax: maxIncome
            });
            console.log(`💰 [RANGE FILTER] Starting to filter ${filtered.length} leads...`);
            
            const originalCount = filtered.length;
            let checkedCount = 0;
            let includedCount = 0;
            let excludedCount = 0;
            let zeroIncomeCount = 0;
            let hasIncomeCount = 0;
            
            filtered = filtered.filter(lead => {
                checkedCount++;
                
                // Function to extract total income from lead - MUST MATCH column display logic
                const extractTotalIncome = (lead) => {
                    let totalIncome = 0;
                    let foundField = null;
                    
                    // Use the SAME extraction logic as the column display
                    const incomeSources = [
                        { value: lead.totalIncome, field: 'totalIncome' },
                        { value: lead.eligibility_details?.totalIncome, field: 'eligibility_details.totalIncome' },
                        { value: lead.eligibility?.totalIncome, field: 'eligibility.totalIncome' },
                        { value: lead.dynamic_fields?.eligibility_details?.totalIncome, field: 'dynamic_fields.eligibility_details.totalIncome' },
                        { value: lead.dynamic_fields?.obligation_data?.eligibility?.totalIncome, field: 'dynamic_fields.obligation_data.eligibility.totalIncome' },
                        { value: lead.obligation_data?.eligibility?.totalIncome, field: 'obligation_data.eligibility.totalIncome' },
                        { value: lead.dynamic_fields?.financial_details?.monthly_income, field: 'dynamic_fields.financial_details.monthly_income' },
                        { value: lead.financial_details?.monthly_income, field: 'financial_details.monthly_income' },
                        { value: lead.salary, field: 'salary' },
                        { value: lead.monthly_income, field: 'monthly_income' },
                        // Legacy fields as fallbacks
                        { value: lead.dynamic_fields?.total_income, field: 'dynamic_fields.total_income' },
                        { value: lead.dynamic_fields?.totalIncome, field: 'dynamic_fields.totalIncome' },
                        { value: lead.dynamic_fields?.income, field: 'dynamic_fields.income' },
                        { value: lead.dynamic_fields?.monthly_income, field: 'dynamic_fields.monthly_income' },
                        { value: lead.total_income, field: 'total_income' },
                        { value: lead.income, field: 'income' }
                    ];
                    
                    // Find the first valid income source (same logic as column display)
                    const validSource = incomeSources.find(source => 
                        source.value !== undefined && source.value !== null && source.value !== ''
                    );
                    
                    if (validSource) {
                        totalIncome = validSource.value;
                        foundField = validSource.field;
                        
                        // Handle object income values (same as column display)
                        if (totalIncome && typeof totalIncome === 'object') {
                            if (totalIncome.totalIncome !== undefined) {
                                totalIncome = totalIncome.totalIncome;
                                foundField = `${foundField}.totalIncome`;
                            } else if (totalIncome.amount !== undefined) {
                                totalIncome = totalIncome.amount;
                                foundField = `${foundField}.amount`;
                            } else {
                                totalIncome = 0; // Unable to extract valid income
                                foundField = null;
                            }
                        }
                    }
                    
                    // Convert to number and handle string values
                    const numericIncome = typeof totalIncome === 'string' ? 
                        parseFloat(totalIncome.replace(/[^\d.-]/g, '')) : 
                        parseFloat(totalIncome);
                    
                    const finalIncome = isNaN(numericIncome) ? 0 : numericIncome;
                    
                    // Track statistics
                    if (finalIncome === 0) {
                        zeroIncomeCount++;
                    } else {
                        hasIncomeCount++;
                    }
                    
                    if (checkedCount <= 10) { // Only log first 10 for brevity
                        console.log(`💰 [RANGE FILTER] Lead ${checkedCount}: ${lead.custom_lead_id} - income: ${finalIncome} (from: ${foundField || 'none'}, raw: ${totalIncome})`);
                    }
                    
                    return finalIncome;
                };

                const leadIncome = extractTotalIncome(lead);
                let passesFilter = true;

                // Check minimum income
                if (minIncome !== null && !isNaN(minIncome)) {
                    if (leadIncome < minIncome) {
                        passesFilter = false;
                        if (checkedCount <= 10) {
                            console.log(`💰 [RANGE FILTER] ❌ Lead ${lead.custom_lead_id} EXCLUDED: income ${leadIncome} < min ${minIncome}`);
                        }
                    }
                }

                // Check maximum income
                if (maxIncome !== null && !isNaN(maxIncome) && passesFilter) {
                    if (leadIncome > maxIncome) {
                        passesFilter = false;
                        if (checkedCount <= 10) {
                            console.log(`💰 [RANGE FILTER] ❌ Lead ${lead.custom_lead_id} EXCLUDED: income ${leadIncome} > max ${maxIncome}`);
                        }
                    }
                }
                
                // Track results
                if (passesFilter) {
                    includedCount++;
                    if (checkedCount <= 10) {
                        console.log(`💰 [RANGE FILTER] ✅ Lead ${lead.custom_lead_id} INCLUDED`);
                    }
                } else {
                    excludedCount++;
                }
                
                return passesFilter;
            });
            
            console.log(`💰 ==================== INCOME RANGE FILTER SUMMARY ====================`);
            console.log(`💰 Filter range: ${minIncome} - ${maxIncome}`);
            console.log(`💰 Total leads checked: ${checkedCount}`);
            console.log(`💰 Leads with zero income: ${zeroIncomeCount}`);
            console.log(`💰 Leads with income data: ${hasIncomeCount}`);
            console.log(`💰 Leads included: ${includedCount}`);
            console.log(`💰 Leads excluded: ${excludedCount}`);
            console.log(`💰 Final result count: ${filtered.length} (was ${originalCount})`);
            console.log(`💰 =================================================================`);
            
            // Additional debugging: Show the final filtered results
            if (filtered.length === 0 && originalCount > 0) {
                console.warn(`⚠️  WARNING: Income filter resulted in 0 leads from ${originalCount} leads!`);
                console.log(`⚠️  Check if income data exists and filter range is appropriate`);
            }
        }

        // Apply total income sorting if selected
        if (filterOptions.totalIncomeSort) {
            console.log('💰 ==================== INCOME SORTING START ====================');
            console.log('💰 Sort type:', filterOptions.totalIncomeSort);
            console.log('💰 Total leads to sort:', filtered.length);
            
            filtered.sort((a, b) => {
                // Function to extract total income from lead - MUST MATCH column display logic
                const extractTotalIncome = (lead) => {
                    let totalIncome = 0;
                    let foundField = null;
                    
                    // Use the SAME extraction logic as the column display
                    const incomeSources = [
                        { value: lead.totalIncome, field: 'totalIncome' },
                        { value: lead.eligibility_details?.totalIncome, field: 'eligibility_details.totalIncome' },
                        { value: lead.eligibility?.totalIncome, field: 'eligibility.totalIncome' },
                        { value: lead.dynamic_fields?.eligibility_details?.totalIncome, field: 'dynamic_fields.eligibility_details.totalIncome' },
                        { value: lead.dynamic_fields?.obligation_data?.eligibility?.totalIncome, field: 'dynamic_fields.obligation_data.eligibility.totalIncome' },
                        { value: lead.obligation_data?.eligibility?.totalIncome, field: 'obligation_data.eligibility.totalIncome' },
                        { value: lead.dynamic_fields?.financial_details?.monthly_income, field: 'dynamic_fields.financial_details.monthly_income' },
                        { value: lead.financial_details?.monthly_income, field: 'financial_details.monthly_income' },
                        { value: lead.salary, field: 'salary' },
                        { value: lead.monthly_income, field: 'monthly_income' },
                        // Legacy fields as fallbacks
                        { value: lead.dynamic_fields?.total_income, field: 'dynamic_fields.total_income' },
                        { value: lead.dynamic_fields?.totalIncome, field: 'dynamic_fields.totalIncome' },
                        { value: lead.dynamic_fields?.income, field: 'dynamic_fields.income' },
                        { value: lead.dynamic_fields?.monthly_income, field: 'dynamic_fields.monthly_income' },
                        { value: lead.total_income, field: 'total_income' },
                        { value: lead.income, field: 'income' }
                    ];
                    
                    // Find the first valid income source (same logic as column display)
                    const validSource = incomeSources.find(source => 
                        source.value !== undefined && source.value !== null && source.value !== ''
                    );
                    
                    if (validSource) {
                        totalIncome = validSource.value;
                        foundField = validSource.field;
                        
                        // Handle object income values (same as column display)
                        if (totalIncome && typeof totalIncome === 'object') {
                            if (totalIncome.totalIncome !== undefined) {
                                totalIncome = totalIncome.totalIncome;
                                foundField = `${foundField}.totalIncome`;
                            } else if (totalIncome.amount !== undefined) {
                                totalIncome = totalIncome.amount;
                                foundField = `${foundField}.amount`;
                            } else {
                                totalIncome = 0; // Unable to extract valid income
                                foundField = null;
                            }
                        }
                    }
                    
                    // Convert to number and handle string values
                    const numericIncome = typeof totalIncome === 'string' ? 
                        parseFloat(totalIncome.replace(/[^\d.-]/g, '')) : 
                        parseFloat(totalIncome);
                    
                    const finalIncome = isNaN(numericIncome) ? 0 : numericIncome;
                    
                    console.log(`💰 Lead ${lead.custom_lead_id} income: ${finalIncome} (from field: ${foundField || 'none'}, raw: ${totalIncome})`);
                    
                    return finalIncome;
                };
                
                const aIncome = extractTotalIncome(a);
                const bIncome = extractTotalIncome(b);
                
                let sortResult = 0;
                if (filterOptions.totalIncomeSort === 'highest') {
                    sortResult = bIncome - aIncome; // Highest to lowest
                } else if (filterOptions.totalIncomeSort === 'lowest') {
                    sortResult = aIncome - bIncome; // Lowest to highest
                }
                
                console.log(`💰 Comparing ${a.custom_lead_id} (${aIncome}) vs ${b.custom_lead_id} (${bIncome}) = ${sortResult}`);
                return sortResult;
            });
            
            console.log('💰 ==================== INCOME SORTING END ====================');
            console.log('💰 First 5 leads after sorting:');
            filtered.slice(0, 5).forEach((lead, index) => {
                // Re-extract income for display using the same logic
                const extractTotalIncomeForDisplay = (lead) => {
                    const incomeSources = [
                        lead.totalIncome,
                        lead.eligibility_details?.totalIncome,
                        lead.eligibility?.totalIncome,
                        lead.dynamic_fields?.eligibility_details?.totalIncome,
                        lead.dynamic_fields?.obligation_data?.eligibility?.totalIncome,
                        lead.obligation_data?.eligibility?.totalIncome,
                        lead.dynamic_fields?.financial_details?.monthly_income,
                        lead.financial_details?.monthly_income,
                        lead.salary,
                        lead.monthly_income,
                        // Legacy fields as fallbacks
                        lead.dynamic_fields?.total_income,
                        lead.dynamic_fields?.totalIncome,
                        lead.dynamic_fields?.income,
                        lead.total_income,
                        lead.income
                    ];
                    
                    let totalIncome = incomeSources.find(income => 
                        income !== undefined && income !== null && income !== ''
                    );
                    
                    // Handle object income values
                    if (totalIncome && typeof totalIncome === 'object') {
                        if (totalIncome.totalIncome !== undefined) {
                            totalIncome = totalIncome.totalIncome;
                        } else if (totalIncome.amount !== undefined) {
                            totalIncome = totalIncome.amount;
                        } else {
                            totalIncome = 0;
                        }
                    }
                    
                    const numericIncome = typeof totalIncome === 'string' ? 
                        parseFloat(totalIncome.replace(/[^\d.-]/g, '')) : 
                        parseFloat(totalIncome);
                    return isNaN(numericIncome) ? 0 : numericIncome;
                };
                console.log(`💰 ${index + 1}. ${lead.custom_lead_id}: ${extractTotalIncomeForDisplay(lead)}`);
            });
            console.log('💰 =============================================================');
        } else {
            // Default sort by date (most recent first) for better UX
            filtered.sort((a, b) => {
                const aDate = new Date(a.created_at || a.date_created || 0);
                const bDate = new Date(b.created_at || b.date_created || 0);
                return bDate - aDate;
            });
        }

        // Debug: Log sample lead data structure when income filters are used
        if ((filterOptions.totalIncomeFrom || filterOptions.totalIncomeTo) && filtered.length > 0) {
            console.log('🔍 Sample lead data structure (first lead):');
            const sampleLead = filtered[0];
            console.log('Lead object:', {
                custom_lead_id: sampleLead.custom_lead_id,
                dynamic_fields: sampleLead.dynamic_fields,
                topLevelIncomeFields: {
                    total_income: sampleLead.total_income,
                    totalIncome: sampleLead.totalIncome,
                    income: sampleLead.income,
                    monthly_income: sampleLead.monthly_income,
                    monthlyIncome: sampleLead.monthlyIncome,
                    salary: sampleLead.salary,
                    eligibility_details: sampleLead.eligibility_details,
                    eligibility: sampleLead.eligibility,
                    obligation_data: sampleLead.obligation_data,
                    financial_details: sampleLead.financial_details
                }
            });
            
            // Test income extraction on the sample lead
            const testIncome = (() => {
                const incomeSources = [
                    { value: sampleLead.totalIncome, field: 'totalIncome' },
                    { value: sampleLead.eligibility_details?.totalIncome, field: 'eligibility_details.totalIncome' },
                    { value: sampleLead.eligibility?.totalIncome, field: 'eligibility.totalIncome' },
                    { value: sampleLead.dynamic_fields?.eligibility_details?.totalIncome, field: 'dynamic_fields.eligibility_details.totalIncome' },
                    { value: sampleLead.dynamic_fields?.obligation_data?.eligibility?.totalIncome, field: 'dynamic_fields.obligation_data.eligibility.totalIncome' },
                    { value: sampleLead.obligation_data?.eligibility?.totalIncome, field: 'obligation_data.eligibility.totalIncome' },
                    { value: sampleLead.dynamic_fields?.financial_details?.monthly_income, field: 'dynamic_fields.financial_details.monthly_income' },
                    { value: sampleLead.financial_details?.monthly_income, field: 'financial_details.monthly_income' },
                    { value: sampleLead.salary, field: 'salary' },
                    { value: sampleLead.monthly_income, field: 'monthly_income' }
                ];
                
                const validSource = incomeSources.find(source => 
                    source.value !== undefined && source.value !== null && source.value !== ''
                );
                
                return validSource ? { value: validSource.value, field: validSource.field } : { value: null, field: 'none' };
            })();
            
            console.log('🔍 Extracted income from sample lead:', testIncome);
        }

        // Apply No Activity Date filter
        // Show only leads that have NO activity (no status updates, no comments, no changes) since the selected date
        if (filterOptions.noActivityDate && filterOptions.noActivityDate.trim() !== '') {
            console.log('🔍 Applying NO ACTIVITY DATE filter:', filterOptions.noActivityDate);
            const noActivityDateObj = new Date(filterOptions.noActivityDate);
            noActivityDateObj.setHours(0, 0, 0, 0); // Start of selected date
            
            filtered = filtered.filter(lead => {
                // Check last_activity_date or updated_at fields
                const lastActivityDate = lead.last_activity_date || lead.updated_at || lead.created_at;
                
                if (!lastActivityDate) {
                    // If no activity date exists, consider it as having no activity
                    return true;
                }
                
                const activityDateObj = new Date(lastActivityDate);
                activityDateObj.setHours(0, 0, 0, 0);
                
                // Lead should be shown if its last activity was BEFORE the selected date
                // (meaning no activity since that date)
                const hasNoActivitySince = activityDateObj < noActivityDateObj;
                
                if (process.env.NODE_ENV === 'development' && filtered.length < 5) {
                    console.log(`Lead ${lead.custom_lead_id}: Last activity ${activityDateObj.toDateString()}, Filter date ${noActivityDateObj.toDateString()}, Show: ${hasNoActivitySince}`);
                }
                
                return hasNoActivitySince;
            });
            
            console.log(`✅ After No Activity filter: ${filtered.length} leads (showing leads with no activity since ${filterOptions.noActivityDate})`);
        }

        return filtered;
    }, [leads, debouncedSearchTerm, filterOptions, selectedLoanType, filterRevision]); // ⚡ USE DEBOUNCED for performance

    // Update filtered leads and status counts
    useEffect(() => {
        console.log('🔄 Updating displayed leads:', {
            filteredCount: filteredLeadsData?.length || 0,
            activeFilters: {
                totalIncomeFrom: filterOptions.totalIncomeFrom,
                totalIncomeTo: filterOptions.totalIncomeTo,
                totalIncomeSort: filterOptions.totalIncomeSort,
                assignedTL: filterOptions.assignedTL
            }
        });
        
        // 🎯 ABOUTSECTION VERIFICATION: Add debug info for Assigned TL matching
        if (filterOptions.assignedTL && filterOptions.assignedTL.length > 0) {
            console.log('🎯 ==================== ABOUTSECTION FILTER VERIFICATION ====================');
            console.log('🎯 Selected TL filters:', filterOptions.assignedTL);
            console.log('🎯 Filtered leads that will be shown in table:', filteredLeadsData?.length || 0);
            
            // Check first few filtered leads to verify About section will show correct TL
            if (filteredLeadsData && filteredLeadsData.length > 0) {
                console.log('🎯 Verifying About section TL match for first 3 leads:');
                filteredLeadsData.slice(0, 3).forEach((lead, i) => {
                    const aboutSectionTL = lead.assign_report_to || lead.assignReportTo;
                    let aboutTLNames = [];
                    
                    // Parse same as AboutSection component
                    if (aboutSectionTL) {
                        if (typeof aboutSectionTL === 'string') {
                            try {
                                const parsed = JSON.parse(aboutSectionTL);
                                if (Array.isArray(parsed)) {
                                    aboutTLNames = parsed.map(item => 
                                        typeof item === 'object' && item.name ? item.name : 
                                        typeof item === 'string' ? item.trim() : null
                                    ).filter(Boolean);
                                }
                            } catch {
                                aboutTLNames = aboutSectionTL.split(',').map(name => name.trim()).filter(Boolean);
                            }
                        } else if (Array.isArray(aboutSectionTL)) {
                            aboutTLNames = aboutSectionTL.map(item => 
                                typeof item === 'object' && item.name ? item.name : 
                                typeof item === 'string' ? item.trim() : null
                            ).filter(Boolean);
                        }
                    }
                    
                    const matchesFilter = aboutTLNames.some(name => filterOptions.assignedTL.includes(name));
                    console.log(`🎯 Lead ${i+1} (${lead.custom_lead_id}):`, {
                        aboutSectionWillShow: aboutTLNames,
                        matchesSelectedFilter: matchesFilter ? '✅ YES' : '❌ NO',
                        filterSelection: filterOptions.assignedTL
                    });
                });
            }
            if (process.env.NODE_ENV === 'development') {
                console.log('🎯 ==================== ABOUTSECTION FILTER VERIFICATION END ====================');
            }
        }
        
        // DON'T update any state here - causes re-render loops!
        // Table uses filteredLeadsData directly via useMemo
        
        // ⚡ DEFERRED: Update status counts after a short delay to avoid blocking initial render
        // This ensures the UI shows immediately with cached data
        if (leads.length > 0) {
            const timer = setTimeout(() => {
                setStatusCounts(memoizedStatusCounts);
            }, 50); // 50ms delay - imperceptible to users but allows initial render
            return () => clearTimeout(timer);
        }
        
    }, [memoizedStatusCounts, leads.length]); // Only depend on statusCounts, not filteredLeadsData!

    // Pagination: Slice filteredLeadsData to show limited leads with "Show More" functionality
    const displayedLeads = useMemo(() => {
        if (!filteredLeadsData || filteredLeadsData.length === 0) {
            return [];
        }
        // Return only the number of leads we want to display
        return filteredLeadsData.slice(0, displayedCount);
    }, [filteredLeadsData, displayedCount]);

    // Calculate if there are more leads to show
    const hasMoreToShow = useMemo(() => {
        return filteredLeadsData && filteredLeadsData.length > displayedCount;
    }, [filteredLeadsData, displayedCount]);

    // Use ref to store filteredLeadsData to avoid re-render cycles
    const filteredLeadsDataRef = useRef(filteredLeadsData);
    
    // Update ref when filteredLeadsData changes (doesn't trigger re-renders)
    useEffect(() => {
        filteredLeadsDataRef.current = filteredLeadsData;
    }, [filteredLeadsData]);

    // Helper functions that use filteredLeadsData ref (stable - no re-renders)
    const getFilteredLeadByIndex = useCallback((rowIdx) => {
        return filteredLeadsDataRef.current[rowIdx];
    }, []); // No dependencies - stable function

    const getFilteredLeadById = useCallback((leadId) => {
        return filteredLeadsDataRef.current.find(l => l._id === leadId) || leads.find(l => l._id === leadId);
    }, [leads]); // Only depends on leads, not filteredLeadsData

    const getFilteredLeadsCount = useCallback(() => {
        return filteredLeadsDataRef.current.length;
    }, []); // No dependencies - stable function

    // Monitor filteredLeads state changes
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 filteredLeads state changed:', {
                count: filteredLeads?.length || 0,
                hasIncomeFilters: !!(filterOptions.totalIncomeFrom || filterOptions.totalIncomeTo)
            });
        }
    }, [filteredLeads, filterOptions.totalIncomeFrom, filterOptions.totalIncomeTo]);

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

    const uniqueCampaigns = useMemo(() => {
        return Array.isArray(leads) ? [...new Set(leads.map(lead => lead.campaign_name).filter(Boolean))].sort() : [];
    }, [leads]);

    // ⚡ PERFORMANCE: Memoized filtered data for search functionality with debouncing
    const filteredCreators = useMemo(() => {
        return uniqueCreators.filter(creator => 
            creator.toLowerCase().includes(debouncedCreatedBySearch.toLowerCase())
        );
    }, [uniqueCreators, debouncedCreatedBySearch]);

    const filteredTeams = useMemo(() => {
        return uniqueTeams.filter(team => 
            team.toLowerCase().includes(debouncedTeamNameSearch.toLowerCase())
        );
    }, [uniqueTeams, debouncedTeamNameSearch]);

    const getFilteredAssignedTL = () => {
        // Hybrid approach: Use employees data AND extract from lead data
        const allTLNames = new Set();
        
        console.log('🔧 [TL DROPDOWN] Building TL options from hybrid source...');
        console.log('🔧 [TL DROPDOWN] Data availability:', {
            employees: Array.isArray(employees) ? employees.length : 'Not available',
            leads: Array.isArray(leads) ? leads.length : 'Not available'
        });
        
        // Primary: Extract ONLY from assignReportTo field to ensure exact matching
        console.log('🔧 [TL DROPDOWN] Extracting TL names ONLY from assignReportTo fields...');
        
        // Secondary: Extract actual TL names from lead data
        if (Array.isArray(leads)) {
            console.log('🔧 [TL DROPDOWN] ==================== ANALYZING ASSIGNREPORTTO FIELD ====================');
            
            leads.forEach((lead, index) => {
                // Debug AssignReprtsTo field for first 10 leads to understand data format
                if (index < 10) {
                    console.log(`🔧 [TL DROPDOWN] Lead ${index + 1} (${lead.custom_lead_id}):`);
                    console.log(`🔧   Raw assignReportTo:`, lead.assignReportTo, 'Type:', typeof lead.assignReportTo);
                    
                    if (lead.assignReportTo) {
                        if (typeof lead.assignReportTo === 'object') {
                            console.log(`🔧   assignReportTo object keys:`, Object.keys(lead.assignReportTo));
                            console.log(`🔧   assignReportTo object:`, JSON.stringify(lead.assignReportTo, null, 2));
                        }
                    }
                    
                    // Show created_by_name for comparison
                    console.log(`🔧   created_by_name (comparison):`, lead.created_by_name);
                    console.log(`🔧   ---`);
                }
                
                // Try assignReportTo first
                const tlNames = extractTLNames(lead.assignReportTo, lead);
                
                tlNames.forEach(name => {
                    if (name && name.trim()) {
                        allTLNames.add(name.trim());
                        
                        // Debug first few entries
                        if (index < 5) {
                            console.log(`🔧 [TL DROPDOWN] Lead ${lead.custom_lead_id}: extracted TL name "${name}" from assignReportTo`);
                        }
                    }
                });
                
                // Also try other TL fields as fallback
                if (tlNames.length === 0) {
                    const fallbackNames = extractTLNames(lead.assignReportTo || lead.assigned_tl || lead.team_leader || lead.tl, lead);
                    fallbackNames.forEach(name => {
                        if (name && name.trim()) {
                            allTLNames.add(name.trim());
                            
                            if (index < 3) {
                                console.log(`🔧 [TL DROPDOWN] Lead ${lead.custom_lead_id}: found TL "${name}" from fallback fields`);
                            }
                        }
                    });
                }
            });
        }
        
        let tls = Array.from(allTLNames).sort();
        
        // If no TL names found in AssignReprtsTo, fallback to employee names
        if (tls.length === 0) {
            console.log('🔧 [TL DROPDOWN] ⚠️ No TL names found in assignReportTo fields, using employee names as fallback');
            if (Array.isArray(employees) && employees.length > 0) {
                employees.forEach(emp => {
                    const empName = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
                    if (empName) {
                        allTLNames.add(empName);
                        console.log(`🔧 [TL DROPDOWN] Added fallback employee: "${empName}"`);
                    }
                });
                tls = Array.from(allTLNames).sort();
            }
        }
        
        // Final result
        let finalResult;
        if (tls.length > 0) {
            finalResult = ['Not Assigned', ...tls];
        } else {
            console.log('🔧 [TL DROPDOWN] ⚠️ No TL names found anywhere - using test options');
            // Provide basic fallback options for testing
            finalResult = ['Not Assigned', 'No TLs Available'];
        }
        
            console.log('INSPECT [TL DROPDOWN] Final TL options:', finalResult);
            console.log('INSPECT [TL DROPDOWN] Total unique TLs found:', allTLNames.size);
            console.log('INSPECT [TL DROPDOWN] All found TL names:', Array.from(allTLNames));        
        // ⚡ PERFORMANCE: Use debounced search for smooth filtering
        return finalResult.filter(tl => 
            tl.toLowerCase().includes(debouncedAssignedTLSearch.toLowerCase())
        );
    };

    const getFilteredStatuses = () => {
        // ⚡ PERFORMANCE: Use debounced search for smooth filtering
        if (!debouncedStatusSearch.trim()) return statusHierarchy;
        
        const filtered = {};
        Object.entries(statusHierarchy).forEach(([parentStatus, subStatuses]) => {
            const parentMatches = parentStatus.toLowerCase().includes(debouncedStatusSearch.toLowerCase());
            const matchingSubStatuses = subStatuses ? subStatuses.filter(subStatus => {
                const statusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                // ⚡ PERFORMANCE: Use debounced search for smooth filtering
                return statusName && statusName.toLowerCase().includes(debouncedStatusSearch.toLowerCase());
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
        
        // Count file sent to login date filters
        if (filterOptions.fileSentToLoginDateFrom || filterOptions.fileSentToLoginDateTo) count++;
        
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
        
        // Handle boolean filter options
        if (filterOptions.fileSentToLogin) count++;
        if (filterOptions.checkDuplicateLeads) count++;
        
        // Also check date filters if using the old format
        if (filterOptions.dateFrom || filterOptions.dateTo) count++;
        
        // Count no activity date filter
        if (filterOptions.noActivityDate && filterOptions.noActivityDate.trim() !== '') count++;
        
        // Count income filters
        if (filterOptions.totalIncomeFrom || filterOptions.totalIncomeTo) count++;
        if (filterOptions.totalIncomeSort && filterOptions.totalIncomeSort !== '') count++;
        
        return count;
    };

    // Get filter count for specific category
    // ⚡ PERFORMANCE: Memoize filter category count calculation
    // This function is called 9+ times per render, causing slowdowns
    const getFilterCategoryCount = useMemo(() => {
        return (category) => {
            switch (category) {
                case 'leadDate':
                    // Count if either from or to date is provided (including file sent to login dates)
                    let leadDateCount = 0;
                    if (filterOptions.leadDateFrom || filterOptions.leadDateTo) leadDateCount++;
                    if (filterOptions.fileSentToLoginDateFrom || filterOptions.fileSentToLoginDateTo) leadDateCount++;
                    if (filterOptions.noActivityDate && filterOptions.noActivityDate.trim() !== '') leadDateCount++;
                    return leadDateCount;
                case 'leadAge':
                    // Count if either min or max age is provided
                    return (filterOptions.leadAgeFrom || filterOptions.leadAgeTo) ? 1 : 0;
                case 'createdBy':
                    // Only count if array exists and has actual selected values
                    return filterOptions.createdBy && Array.isArray(filterOptions.createdBy) && filterOptions.createdBy.length > 0 ? 
                        filterOptions.createdBy.length : 0;
                case 'status':
                    // Count selected statuses in the unified status filter + file sent to login checkbox
                    let statusCount = 0;
                    if (filterOptions.selectedStatuses && Array.isArray(filterOptions.selectedStatuses) && 
                        filterOptions.selectedStatuses.length > 0) {
                        statusCount += filterOptions.selectedStatuses.length;
                    }
                    if (filterOptions.fileSentToLogin) statusCount++;
                    return statusCount;
                case 'teamName':
                    // Only count if array exists and has actual selected values
                    return filterOptions.teamName && Array.isArray(filterOptions.teamName) && 
                        filterOptions.teamName.length > 0 ? filterOptions.teamName.length : 0;
                case 'assignedTL':
                    // Only count if array exists and has actual selected values
                    return filterOptions.assignedTL && Array.isArray(filterOptions.assignedTL) && 
                        filterOptions.assignedTL.length > 0 ? filterOptions.assignedTL.length : 0;
                case 'leadActivity':
                    // Count if duplicate leads checkbox is checked
                    let count = 0;
                    if (filterOptions.checkDuplicateLeads) count++;
                    return count;
                case 'totalIncome':
                    // Count if total income sorting is selected or income range is set
                    let incomeCount = 0;
                    if (filterOptions.totalIncomeSort && filterOptions.totalIncomeSort !== '') incomeCount++;
                    if (filterOptions.totalIncomeFrom || filterOptions.totalIncomeTo) incomeCount++;
                    return incomeCount;
                default:
                    return 0;
            }
        };
    }, [filterOptions]); // ⚡ Only recalculate when filterOptions changes

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

    // Update scroll buttons when table content changes
    useEffect(() => {
        updateScrollButtons();
    }, [filteredLeads]);

    // Fullscreen functions
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        setShowCloseButton(false);
    };

    const exitFullscreen = () => {
        setIsFullscreen(false);
        setShowCloseButton(false);
    };

    // Handle escape key to exit fullscreen
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isFullscreen) {
                exitFullscreen();
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleEscapeKey);
            return () => document.removeEventListener('keydown', handleEscapeKey);
        }
    }, [isFullscreen]);

    // Function to handle viewing a lead by ID - used by direct navigation from query parameters
    const handleViewLead = async (leadId) => {
        if (!leadId) {
            return;
        }
        
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            
            if (!userId || !token) {
                message.error('Authentication required to view lead details');
                
                // Store lead ID to try again after authentication
                sessionStorage.setItem('directViewLeadId', leadId);
                localStorage.setItem('lastViewedLeadId', leadId);
                return null;
            }
            
            
            // Fetch the specific lead by ID with full details
            const response = await fetch(`${apiBaseUrl}/leads/${leadId}?user_id=${userId}&include_all=true`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch lead with ID ${leadId}`);
            }
            
            const leadData = await response.json();
            
            // Process the lead data to ensure it has all necessary fields
            const processedLead = {
                ...leadData,
                // Add any missing essential fields
                name: `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || leadData.name || 'Unknown',
                customerName: `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || leadData.name || leadData.customerName || 'Unknown',
                mobile_number: leadData.mobile_number || leadData.phone || leadData.mobileNumber,
                status: typeof leadData.status === 'object' ? leadData.status?.name : leadData.status,
                sub_status: typeof leadData.sub_status === 'object' ? leadData.sub_status?.name : leadData.sub_status,
                loan_type_name: leadData.loan_type_name || leadData.loan_type || leadData.productName || 'Unknown'
            };
            
            // Set the selected lead to show details view
            setSelectedLead(processedLead);
            
            // Open the About section by default
            setOpenSections([0]);
            
            // Set to Lead Details tab
            setActiveTab(0);
            
            // Make sure the lead data is also added to the filtered leads array
            // to ensure it's available in the component's state
            setFilteredLeads(prev => {
                // Check if the lead is already in the filtered leads
                const leadExists = prev.some(lead => lead._id === leadId);
                
                if (!leadExists) {
                    return [processedLead, ...prev];
                }
                
                return prev.map(lead => 
                    lead._id === leadId ? processedLead : lead
                );
            });
            
            // Also update leads array for consistency
            setLeads(prev => {
                const leadExists = prev.some(lead => lead._id === leadId);
                
                if (!leadExists) {
                    return [processedLead, ...prev];
                }
                
                return prev.map(lead => 
                    lead._id === leadId ? processedLead : lead
                );
            });
            
            // Force the visibility of the lead details view with a slight delay
            // to ensure React has time to process other state changes
            setTimeout(() => {
                setSelectedLead(processedLead);
                setOpenSections([0]); // Auto-open the About section
                setActiveTab(0);      // Set to Lead Details tab
                setIsLoading(false);  // Prevent loading indicator
            }, 100);
            
            return processedLead;
        } catch (error) {
            message.error(`Could not load lead details: ${error.message}`);
            throw error;
        }
    };

    // Load leads function - OPTIMIZED for speed with PAGINATION
    // ⚡ PERFORMANCE: Memoized loadLeads function with infinite scroll support
    const loadLeads = useCallback(async (isLoadMore = false) => {
        const startTime = performance.now();
        
        // Check for direct view request from query parameter (only on initial load)
        if (!isLoadMore) {
            const directViewLeadId = sessionStorage.getItem('directViewLeadId') || localStorage.getItem('lastViewedLeadId');
            
            if (directViewLeadId) {
                
                // Clean up storage to prevent repeated processing
                sessionStorage.removeItem('directViewLeadId');
                localStorage.removeItem('lastViewedLeadId');
                
                // Wait for authentication before trying to fetch lead
                if (localStorage.getItem('token')) {
                    try {
                        // Open the lead details directly
                        const leadData = await handleViewLead(directViewLeadId);
                        
                        if (leadData) {
                            
                            // Ensure the lead details view is shown instead of the table
                            setTimeout(() => {
                                // Double-check we have the lead loaded
                                if (leadData && leadData._id) {
                                    // Force selection of the lead
                                    setSelectedLead(leadData);
                                    // Open the first section by default
                                    setOpenSections([0]);
                                    // Set active tab to LEAD DETAILS
                                    setActiveTab(0);
                                    // Reset obligation changes state
                                    setHasUnsavedObligationChanges(false);
                                }
                            }, 100);
                        }
                    } catch (error) {
                        message.error(`Could not load lead details: ${error.message}`);
                    }
                } else {
                    // Store ID again to try later when authenticated
                    sessionStorage.setItem('directViewLeadId', directViewLeadId);
                }
            }
        }
        
        // ⚡ IMMEDIATE CHECKS: Minimal validation for speed
        if (!userId) {
            setError('User authentication required');
            return;
        }

        // 🚀 PERFORMANCE: Prevent duplicate simultaneous requests
        const paramsKey = JSON.stringify({ userId, filterOptions, initialLoadCompleteRef: initialLoadCompleteRef.current });
        if (fetchInProgressRef.current && paramsKey === lastFetchParamsRef.current) {
            console.log('🚫 Skipping duplicate API call for leads');
            return;
        }

        fetchInProgressRef.current = true;
        lastFetchParamsRef.current = paramsKey;

        if (isLoadMore) {
            // Silent background loading - no UI blocking
            setIsLoadingMore(true);
        } else {
            // ⚡ NEVER show loading spinner on initial mount - show cached data instantly
            // Only show loading on manual refresh after initial load
            if (initialLoadCompleteRef.current && !cachedLeadsData) {
                setLoadingLeads(true);
            }
            setHasMoreLeads(false); // No pagination
        }
        
        // Don't set isLoading to keep interface responsive
        setError('');

        try {
            // 🚀 LOAD DATA WITH LIMIT - Faster initial load
            let apiUrl = `${apiBaseUrl}/leads?user_id=${userId}`;
            
            // 🚀 PERFORMANCE: Limit initial load to 30 most recent leads for INSTANT display
            if (!initialLoadCompleteRef.current) {
                apiUrl += '&limit=30&sort_by=created_at&sort_order=-1';
                console.log('⚡ Loading first 30 leads for INSTANT display');
            }
            
            // Add no_activity_date parameter if filter is active
            if (filterOptions.noActivityDate && filterOptions.noActivityDate.trim() !== '') {
                apiUrl += `&no_activity_date=${encodeURIComponent(filterOptions.noActivityDate)}`;
                console.log('🔍 NO ACTIVITY DATE FILTER ACTIVE:', filterOptions.noActivityDate);
                console.log('📡 API URL with filter:', apiUrl);
            }
            
            if (process.env.NODE_ENV === 'development') {
                console.log(`📊 Loading ALL leads at once for ${userId}`);
            }
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate'  // ⚡ Request compressed response
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const leadsArray = data.items || data || [];
            
            // Get total count if provided by backend
            if (data.total !== undefined) {
                setTotalLeadsCount(data.total);
            }

            // ⚡ ULTRA-FAST PROCESSING: Minimal transformations for speed
            const processedLeads = leadsArray.map(lead => {
                // Only process if not deleted (skip heavy filtering for speed)
                if (lead.is_deleted === true) return null;
                
                return {
                    ...lead,
                    // 🔥 ESSENTIAL ONLY: Pre-compute basic display fields
                    name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
                    mobile_number: lead.mobile_number || lead.phone,
                    status: typeof lead.status === 'object' ? lead.status?.name : lead.status,
                    sub_status: typeof lead.sub_status === 'object' ? lead.sub_status?.name : lead.sub_status,
                    loan_type_name: lead.loan_type_name || 'Unknown'
                };
            }).filter(Boolean); // Remove null entries
            
            // ✅ TEAM LEADER FILTERING: Filter leads for team leaders
            // A team leader should only see:
            // 1. Leads created by them (created_by matches userId)
            // 2. Leads where they are assigned as TL (assigned_tl, AssignReprtsTo, etc.)
            let finalLeads = processedLeads;
            
            // Check if user has "all" permission - if they do, skip team leader filtering
            const hasAllPermission = hasLeadsPermission('all');
            
            // Check if user is a team leader (you can also check from permissions/role)
            const userDesignation = localStorage.getItem('userDesignation')?.toLowerCase() || '';
            const isTeamLeader = userDesignation.includes('team leader') || userDesignation.includes('tl');
            
            // DEBUG: Add console logging to track permission status
            console.log('DEBUG LeadCRM: Permission check results:', {
                hasAllPermission,
                isTeamLeader,
                userDesignation,
                userId,
                totalLeads: processedLeads.length,
                permissionsObj: permissions
            });
            
            // Only apply team leader filtering if user doesn't have "all" permission
            if (isTeamLeader && !hasAllPermission) {
                console.log('DEBUG LeadCRM: Applying team leader filtering (no all permission)');
            } else if (isTeamLeader && hasAllPermission) {
                console.log('DEBUG LeadCRM: Skipping team leader filtering - user has ALL permission');
            } else {
                console.log('DEBUG LeadCRM: No team leader filtering needed - not a team leader');
            }
            
            if (isTeamLeader && !hasAllPermission) {
                // Get both userId and employee_id for matching
                const employeeId = localStorage.getItem('employee_id') || localStorage.getItem('employeeId');
                
                let creatorCount = 0;
                let assignedCount = 0;
                
                finalLeads = processedLeads.filter(lead => {
                    // Check if user created this lead
                    const isCreator = lead.created_by === userId || lead.creator_id === userId || lead.user_id === userId;
                    
                    if (isCreator) {
                        creatorCount++;
                    }
                    
                    // Check if user is assigned as TL to this lead
                    // Check multiple field names used throughout the app
                    const tlData = lead.assign_report_to || lead.AssignReprtsTo || lead.assignReportTo || lead.assigned_tl || lead.team_leader || lead.tl;
                    let isAssignedTL = false;
                    
                    if (tlData) {
                        if (Array.isArray(tlData)) {
                            // Check if userId or employeeId is in the array
                            isAssignedTL = tlData.some(tl => {
                                if (typeof tl === 'string') {
                                    return tl === userId || tl === employeeId;
                                } else if (typeof tl === 'object' && tl !== null) {
                                    return tl.user_id === userId || 
                                           tl._id === userId || 
                                           tl.id === userId ||
                                           tl.employee_id === employeeId ||
                                           tl.employeeId === employeeId;
                                }
                                return false;
                            });
                        } else if (typeof tlData === 'string') {
                            console.log(`  - String data: "${tlData}"`);
                            // Handle JSON string or direct ID
                            try {
                                const parsed = JSON.parse(tlData);
                                console.log(`  - Parsed JSON:`, parsed);
                                if (Array.isArray(parsed)) {
                                    isAssignedTL = parsed.some(tl => 
                                        (typeof tl === 'object' && (
                                            tl.user_id === userId || 
                                            tl._id === userId || 
                                            tl.id === userId ||
                                            tl.employee_id === employeeId ||
                                            tl.employeeId === employeeId
                                        )) ||
                                        tl === userId ||
                                        tl === employeeId
                                    );
                                } else if (typeof parsed === 'object') {
                                    isAssignedTL = parsed.user_id === userId || 
                                                  parsed._id === userId || 
                                                  parsed.id === userId ||
                                                  parsed.employee_id === employeeId ||
                                                  parsed.employeeId === employeeId;
                                }
                            } catch (e) {
                                // Not JSON, treat as direct ID
                                isAssignedTL = tlData === userId || tlData === employeeId;
                            }
                        } else if (typeof tlData === 'object' && tlData !== null) {
                            isAssignedTL = tlData.user_id === userId || 
                                          tlData._id === userId || 
                                          tlData.id === userId ||
                                          tlData.employee_id === employeeId ||
                                          tlData.employeeId === employeeId;
                        }
                        
                        if (isAssignedTL) {
                            assignedCount++;
                        }
                    }
                    
                    return isCreator || isAssignedTL;
                });
            }
            
            // No pagination - set all leads at once
            setHasMoreLeads(false);
            setLeads(finalLeads);
            setFilteredLeads(finalLeads);
            
            // 🚀 PERFORMANCE: Cache the data with loan-type specific key
            try {
                const CACHE_KEYS = getCacheKeys(selectedLoanType);
                localStorage.setItem(CACHE_KEYS.LEADS, JSON.stringify(finalLeads));
                localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
                console.log(`💾 Cached ${selectedLoanType || 'all'} leads data for future loads`);
            } catch (cacheError) {
                console.warn('Cache write error:', cacheError);
            }

            // Mark initial load as complete
            if (!initialLoadCompleteRef.current) {
                initialLoadCompleteRef.current = true;
            }

            // 🎯 IMMEDIATE UI UPDATE: Show leads instantly
            setIsLoadingMore(false);
            setLoadingLeads(false);
            setIsLoading(false);

            const loadTime = performance.now() - startTime;
            console.log(`⚡ Lead loading completed in ${loadTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('❌ Error loading leads:', error);
            setError(error.message);
            setIsLoading(false);
            setLoadingLeads(false);
            setIsLoadingMore(false);
        } finally {
            fetchInProgressRef.current = false; // Release the lock
        }
    }, [userId, setError, setLoadingLeads, setIsLoading, setLeads, setFilteredLeads, filterOptions.noActivityDate]); // Removed pagination dependencies

    // Load more leads function - NO LONGER USED (all data loaded at once)
    const loadMoreLeads = useCallback(async () => {
        // No-op function - keeping for compatibility but does nothing
        return;
    }, []);

    // NO INFINITE SCROLL - All data loaded at once for stable UI
    // Removed scroll listener for better performance

    // Effect to refetch leads when no activity filter changes
    useEffect(() => {
        // Only trigger when component is fully mounted and filter value changes meaningfully
        if (leads.length > 0 || filterOptions.noActivityDate) {
            loadLeads();
        }
    }, [filterOptions.noActivityDate, loadLeads]);

    // Reset pagination when filters or search term changes
    useEffect(() => {
        setDisplayedCount(INITIAL_LOAD);
    }, [
        debouncedSearchTerm,
        selectedLoanType,
        selectedStatus,
        selectedSubStatus,
        filterOptions.totalIncomeFrom,
        filterOptions.totalIncomeTo,
        filterOptions.totalIncomeSort,
        filterOptions.assignedTL,
        filterOptions.noActivityDate,
        filterOptions.showDuplicateLeads,
        filterOptions.leadType
    ]);

    // Load loan types with caching
    const loadLoanTypes = async () => {
        setLoadingLoanTypes(true);
        try {
            // 🚀 Check loan types cache (shared across all loan types)
            const CACHE_KEYS = getCacheKeys('all'); // Loan types are global, not loan-type specific
            const cachedLoanTypesStr = localStorage.getItem(CACHE_KEYS.LOAN_TYPES);
            
            if (cachedLoanTypesStr) {
                const cachedLoanTypes = JSON.parse(cachedLoanTypesStr);
                if (cachedLoanTypes && cachedLoanTypes.length > 0) {
                    console.log('⚡ Using cached loan types');
                    setLoanTypes(cachedLoanTypes);
                    setLoadingLoanTypes(false);
                    return;
                }
            }
            
            const response = await fetch(`${apiBaseUrl}/loan-types?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate'  // ⚡ Request compressed response
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
                
                // 🚀 Cache loan types (shared across all loan type filters)
                try {
                    const CACHE_KEYS = getCacheKeys('all');
                    localStorage.setItem(CACHE_KEYS.LOAN_TYPES, JSON.stringify(processedLoanTypes));
                    console.log('💾 Cached loan types data');
                } catch (cacheError) {
                    console.warn('Loan types cache write error:', cacheError);
                }

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
            setCheckedRows(Array.from({ length: getFilteredLeadsCount() }, (_, idx) => idx));
        }
    };

    // Update select all checkbox based on selected rows (using leads for early initialization)
    useEffect(() => {
        if (selectedRows.length === leads.length && leads.length > 0) {
            setSelectAll(true);
        } else {
            setSelectAll(false);
        }
    }, [selectedRows, leads]);

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
            rowsToDelete.map(idx => getFilteredLeadByIndex(idx)._id) :
            rowsToDelete;

        if (leadsToDelete.length === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${leadsToDelete.length} selected lead(s)?`)) {
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const leadId of leadsToDelete) {
            try {
                console.log('Bulk delete request for lead:', leadId, 'by user:', userId);
                console.log('🔍 User details from localStorage:', {
                    userId: localStorage.getItem('userId'),
                    username: localStorage.getItem('username'),
                    userRole: localStorage.getItem('userRole'),
                    emp_id: localStorage.getItem('emp_id')
                });
                
                // Critical check: Verify if rm030 user has correct mapping
                if (localStorage.getItem('username') === 'rm030' || localStorage.getItem('emp_id') === 'rm030') {
                    console.log('🎯 Confirmed: This is user rm030 attempting delete');
                    console.log('🔑 User ID being used for delete:', userId);
                    console.log('🔑 Expected: User rm030 should have ObjectId user_id, not username');
                }
                
                // Use the same handleDeleteLead function for consistency
                const result = await handleDeleteLead(leadId);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    errors.push(`Lead ${leadId}: ${result.error}`);
                }
            } catch (error) {
                errorCount++;
                errors.push(`Lead ${leadId}: ${error.message || 'Network error'}`);
                console.error('Error deleting lead:', leadId, error);
            }
        }

        // Show result message
        if (successCount > 0 && errorCount === 0) {
            message.success(`Successfully deleted ${successCount} lead(s)`);
        } else if (successCount > 0 && errorCount > 0) {
            message.warning(`Deleted ${successCount} lead(s), but ${errorCount} failed. Errors: ${errors.join(', ')}`);
        } else if (errorCount > 0) {
            message.error(`Failed to delete leads. Errors: ${errors.join(', ')}`);
        }

        handleCancelSelection();
        loadLeads();
    };

    // Handle individual lead deletion
    // Enhanced delete lead function with comprehensive debugging and error handling
    const handleDeleteLead = async (leadId) => {
        try {
            // Validate required parameters
            if (!userId) {
                throw new Error('User ID is missing. Please log in again.');
            }
            if (!localStorage.getItem('token')) {
                throw new Error('Authentication token is missing. Please log in again.');
            }
            
            // Enhanced logging for permission debugging
            console.log('🔍 DELETE LEAD PERMISSION DEBUG:', {
                leadId: leadId,
                userId: userId,
                userPermissions: permissions,
                frontendCanDelete: canDeleteLeads(),
                isSuperAdmin: isSuperAdmin(),
                userRoleId: userRoleId,
                storedUserData: JSON.parse(localStorage.getItem('userData') || '{}'),
                apiUrl: `${apiBaseUrl}/leads/${leadId}?user_id=${userId}`
            });
            
            // Get user data to check if user is lead creator
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const leadToDelete = leads.find(lead => lead._id === leadId);
            const isLeadCreator = leadToDelete?.created_by === userId || leadToDelete?.created_by_id === userId;
            
            console.log('🔍 LEAD CREATOR CHECK:', {
                leadCreatedBy: leadToDelete?.created_by,
                leadCreatedById: leadToDelete?.created_by_id,
                currentUserId: userId,
                isLeadCreator: isLeadCreator
            });
            
            // Show confirmation dialog with lead info
            const leadName = leadToDelete?.name || leadToDelete?.customer_name || leadToDelete?.first_name + ' ' + leadToDelete?.last_name || 'Unknown Lead';
            if (!window.confirm(`Are you sure you want to delete the lead for "${leadName}"?\n\nLead ID: ${leadId}\nThis action cannot be undone.`)) {
                return { success: false, cancelled: true };
            }

            // First, verify backend permissions by checking user permissions endpoint
            console.log('🔍 Verifying backend permissions for delete operation...');
            try {
                const permCheckResponse = await fetch(`${apiBaseUrl}/users/permissions/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (permCheckResponse.ok) {
                    const backendPermissions = await permCheckResponse.json();
                    console.log('🔍 Backend permissions response:', backendPermissions);
                    
                    // Check for delete permissions specifically in multiple formats
                    const leadsPermissions = backendPermissions.find(p => 
                        p.page === 'Leads' || p.page === 'leads' || 
                        p.page === 'Lead' || p.page === 'lead'
                    );
                    console.log('🔍 Leads permissions from backend:', leadsPermissions);
                    
                    if (leadsPermissions) {
                        const hasDeletePermission = 
                            leadsPermissions.actions === '*' || 
                            (Array.isArray(leadsPermissions.actions) && 
                             (leadsPermissions.actions.includes('delete') || leadsPermissions.actions.includes('*'))) ||
                            leadsPermissions.actions === 'delete';
                            
                        console.log('🔍 Backend permission analysis:', {
                            actions: leadsPermissions.actions,
                            actionsType: typeof leadsPermissions.actions,
                            hasDeletePermission: hasDeletePermission,
                            isCreator: isLeadCreator
                        });
                        
                        if (!hasDeletePermission && !isLeadCreator) {
                            console.error('❌ PERMISSION DENIED: Backend does not grant delete permission and user is not lead creator');
                            message.error('Permission denied: You do not have permission to delete leads. Please contact your administrator.');
                            return { success: false, error: 'Permission denied' };
                        } else {
                            console.log('✅ Permission check passed:', hasDeletePermission ? 'Has delete permission' : 'Is lead creator');
                        }
                    }
                }
            } catch (permError) {
                console.log('⚠️ Could not verify backend permissions:', permError);
                // Continue with the delete attempt
            }

            // Make the DELETE request with enhanced error handling
            const token = localStorage.getItem('token');
            console.log('🔄 Making DELETE request...');
            
            const response = await fetch(`${apiBaseUrl}/leads/${leadId}?user_id=${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-User-ID': userId, // Additional header for backend processing
                }
            });

            console.log(`🔍 DELETE Response: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                console.log('🎉 Lead deletion successful!');
                message.success(`Lead "${leadName}" has been deleted successfully.`);
                
                // Remove lead from local state immediately for better UX
                setLeads(prevLeads => prevLeads.filter(lead => lead._id !== leadId));
                setFilteredLeads(prevLeads => prevLeads.filter(lead => lead._id !== leadId));
                
                // Refresh leads from server to ensure consistency
                setTimeout(() => {
                    loadLeads();
                }, 500);
                
                return { success: true };
            } else {
                // Handle different error scenarios
                let errorMessage = `Failed to delete lead: ${response.status} ${response.statusText}`;
                let errorDetail = '';
                
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorData.message || '';
                    console.error('🔍 DELETE Error Response:', errorData);
                } catch (e) {
                    try {
                        const errorText = await response.text();
                        errorDetail = errorText;
                        console.error('🔍 DELETE Error Text:', errorText);
                    } catch (e2) {
                        console.error('🔍 Could not parse error response');
                    }
                }
                
                // Provide user-friendly error messages
                if (response.status === 403) {
                    if (errorDetail.includes("don't have permission")) {
                        errorMessage = 'Permission denied: You do not have permission to delete this lead. Only the lead creator, leads admin, or login admin can delete leads.';
                    } else {
                        errorMessage = 'Permission denied: You do not have permission to delete this lead.';
                    }
                } else if (response.status === 404) {
                    errorMessage = 'Lead not found or already deleted.';
                } else if (response.status === 401) {
                    errorMessage = 'Authentication failed. Please log in again.';
                } else if (errorDetail) {
                    errorMessage += ` - ${errorDetail}`;
                }
                
                console.error('❌ DELETE Failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorDetail: errorDetail,
                    url: response.url,
                    userId: userId,
                    leadId: leadId
                });
                
                message.error(errorMessage, 5); // Show error for 5 seconds
                return { success: false, error: errorMessage };
            }
        } catch (error) {
            console.error('❌ Exception during lead deletion:', error);
            message.error(`Error deleting lead: ${error.message}`, 5);
            return { success: false, error: error.message };
        }
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
                    copy_obligations: true,
                    preserve_original_metadata: true,  // Copy exact created_by, assigned_to, etc.
                    preserve_assigned_to: true,        // Keep original assigned_to values
                    preserve_created_by: true,         // Keep original created_by values
                    preserve_all_fields: true,         // Copy ALL fields exactly as they are
                    preserve_status: true,             // Copy original status too
                    add_copy_activity: true            // Add "Lead copied by" activity
                },
                // Don't override any values - keep everything as original
                override_values: {}
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
        const lead = filteredLeadsData[rowIdx];

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
            
            // Special handling for statuses that should work as both main and sub-status
            // If no main status mapping exists, check if this should be applied to both status and sub_status
            const singleStatusList = [
                'FILE COMPLETED', 'File Completed', 'FILE COMPLETE', 'File Complete',
                'DISBURSED', 'Disbursed', 'CONVERTED', 'Converted', 'APPROVED', 'Approved',
                'SANCTIONED', 'Sanctioned', 'LOGIN APPROVED', 'Login Approved',
                'LOGIN DONE', 'Login Done', 'LOGIN COMPLETED', 'Login Completed'
            ];
            
            if (!mainStatus) {
                // Check if this is a single status that should apply to both main and sub
                const isSingleStatus = singleStatusList.some(status => 
                    status.toLowerCase() === selectedValue.toLowerCase()
                );
                
                if (isSingleStatus) {
                    // For single statuses, apply the same value to both status and sub_status
                    await updateDirectLeadStatus(lead._id, selectedValue, selectedValue);
                    return;
                } else {
                    // If no main status mapping exists, treat this as a direct status selection
                    await updateDirectLeadStatus(lead._id, selectedValue, null);
                    return;
                }
            } else {
                // Extract main status name if it's an object
                const mainStatusName = typeof mainStatus === 'object' ? mainStatus.name : mainStatus;
                
                try {
                    // Check if current lead status is "NOT A LEAD"
                    const currentLeadIsNotALead = isNotALeadStatus(lead.status, lead.sub_status);
                    const newStatusIsNotALead = isNotALeadStatus(mainStatusName, selectedValue);
                    
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
                    
                    // If changing from "NOT A LEAD" to another status, update created date
                    if (currentLeadIsNotALead && !newStatusIsNotALead) {
                        // Use IST for created_at timestamp
                        const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                        updatePayload.created_at = istDate.toISOString();
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
                        const shouldUpdateCreatedAt = currentLeadIsNotALead && !newStatusIsNotALead;
                        const updatedLeadData = { 
                            ...updatedLeads[rowIdx], 
                            status: mainStatusName,
                            sub_status: selectedValue,
                            parent_status: parentStatus,
                            ...(shouldSetFileSentToLogin && { file_sent_to_login: true }),
                            ...(shouldUpdateCreatedAt && updatePayload.created_at && { 
                                created_at: updatePayload.created_at 
                            })
                        };
                        updatedLeads[rowIdx] = updatedLeadData;
                        
                        setFilteredLeads(updatedLeads);

                        // Also update main leads state
                        const allLeadsUpdated = leads.map(l =>
                            l._id === lead._id ? { 
                                ...l, 
                                status: mainStatusName, 
                                sub_status: selectedValue,
                                parent_status: parentStatus,
                                ...(shouldSetFileSentToLogin && { file_sent_to_login: true }),
                                ...(shouldUpdateCreatedAt && updatePayload.created_at && { 
                                    created_at: updatePayload.created_at 
                                })
                            } : l
                        );
                        setLeads(allLeadsUpdated);
                        
                        // Update editedLeads for consistency
                        setEditedLeads(allLeadsUpdated);
                        
                        // Update filteredLeads to refresh the table display
                        setFilteredLeads(allLeadsUpdated);
                        
                        // Immediately update status counts to reflect the change
                        // Status counts will update automatically via memoized statusCounts
                        
                        const successMessage = shouldUpdateCreatedAt 
                            ? `Status updated to ${selectedValue} (Main: ${mainStatusName}) - Lead creation date updated`
                            : `Status updated to ${selectedValue} (Main: ${mainStatusName})`;
                        
                        message.success(successMessage);
                        
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
            // Find the lead to check its current status
            const lead = getFilteredLeadById(leadId);
            const currentLeadIsNotALead = lead ? isNotALeadStatus(lead.status, lead.sub_status) : false;
            const newStatusIsNotALead = isNotALeadStatus(statusValue, subStatusValue);
            
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
            
            // If changing from "NOT A LEAD" to another status, update created date
            if (currentLeadIsNotALead && !newStatusIsNotALead) {
                updateData.created_at = new Date().toISOString();
            }
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
                        ...(shouldSetFileSentToLogin && { file_sent_to_login: true }),
                        ...(currentLeadIsNotALead && !isNotALeadStatus(statusValue, subStatusValue) && { 
                            created_at: updateData.created_at 
                        })
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
                        ...(shouldSetFileSentToLogin && { file_sent_to_login: true }),
                        ...(currentLeadIsNotALead && !isNotALeadStatus(statusValue, subStatusValue) && { 
                            created_at: updateData.created_at 
                        })
                    } : l
                );
                setLeads(allLeadsUpdated);
                
                // Update editedLeads for consistency
                setEditedLeads(allLeadsUpdated);
                
                // Update filteredLeads to refresh the table display
                setFilteredLeads(allLeadsUpdated);

                // Immediately update status counts to reflect the change
                // Status counts will update automatically via memoized statusCounts

                // Close dropdown after selection
                handleCloseStatusDropdown();
                
                const successMessage = currentLeadIsNotALead && !isNotALeadStatus(statusValue, subStatusValue) 
                    ? 'Status updated successfully - Lead creation date updated'
                    : 'Status updated successfully';
                
                message.success(successMessage);
                
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

    // Helper function to check if a status is "NOT A LEAD"
    const isNotALeadStatus = (status, subStatus = null) => {
        const statusValue = typeof status === 'object' ? (status?.name || status) : status;
        const subStatusValue = typeof subStatus === 'object' ? (subStatus?.name || subStatus) : subStatus;
        
        const statusLower = (statusValue || '').toLowerCase();
        const subStatusLower = (subStatusValue || '').toLowerCase();
        
        // Check main status
        const mainStatusIsNotALead = (
            statusLower.includes('not a lead') ||
            statusLower === 'not a lead' ||
            statusLower === 'duplicate' ||
            statusLower === 'wrong number' ||
            statusLower === 'spam' ||
            statusLower === 'invalid lead'
        );
        
        // Check sub-status
        const subStatusIsNotALead = subStatusValue && (
            subStatusLower.includes('not a lead') ||
            subStatusLower === 'not a lead' ||
            subStatusLower === 'duplicate' ||
            subStatusLower === 'wrong number' ||
            subStatusLower === 'spam' ||
            subStatusLower === 'invalid lead'
        );
        
        // Check parent status mapping
        let parentStatus = null;
        if (statusValue) {
            parentStatus = getParentStatusForStatusCard(statusValue, subStatusValue);
        }
        const parentStatusIsNotALead = parentStatus && parentStatus.toLowerCase().includes('not a lead');
        
        return mainStatusIsNotALead || subStatusIsNotALead || parentStatusIsNotALead;
    };

    // Get filtered status options for dropdown - enhanced for hierarchical navigation and direct search
    const getFilteredStatusOptions = () => {
        
        // Helper function to filter out "NOT A LEAD" statuses
        const filterOutNotALeadStatuses = (statuses) => {
            return statuses.filter(status => {
                const statusName = typeof status === 'object' ? status.name : status;
                const statusLower = statusName.toLowerCase();
                
                // Filter out all variations of "NOT A LEAD" status
                return !(
                    statusLower.includes('not a lead') ||
                    statusLower.includes('not') && statusLower.includes('lead') ||
                    statusLower === 'duplicate' ||
                    statusLower === 'wrong number' ||
                    statusLower === 'spam' ||
                    statusLower === 'invalid lead'
                );
            });
        };
        
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
                
                // Combine exact matches first, then partial matches and filter out "NOT A LEAD" statuses
                const directSubStatusMatches = filterOutNotALeadStatuses([...exactMatches, ...partialMatches]);
                
                
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
                    // Filter out "NOT A LEAD" main statuses
                    return filterOutNotALeadStatuses(mainStatusOptions);
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
                
                // Filter out "NOT A LEAD" statuses from search results
                return filterOutNotALeadStatuses(filtered);
            } 
            // If showing sub-statuses for selected main status (without search)
            else if (selectedMainStatus && !showMainStatuses) {
                const subStatusOptions = statusHierarchy[selectedMainStatus] || [];
                // Filter out "NOT A LEAD" sub-statuses
                return filterOutNotALeadStatuses(subStatusOptions);
            }
        }
        
        // Fallback to main statuses or default list for other departments
        const statusOptions = allStatuses.length > 0 
            ? allStatuses 
            : ["Active Login", "Approve", "Disbursed", "Rejected", "Customer Not Responding", "Customer Cancelled", "Lost by Mistake", "Lost Login"];
        
        
        if (!statusSearchTerm) {
            // Filter out "NOT A LEAD" statuses from all status options
            return filterOutNotALeadStatuses(statusOptions);
        }
        
        const filtered = statusOptions.filter(status => {
            const statusName = typeof status === 'object' ? status.name : status;
            const isMatch = statusName.toLowerCase().includes(statusSearchTerm.toLowerCase());
            return isMatch;
        });
        
        // Filter out "NOT A LEAD" statuses from search results
        return filterOutNotALeadStatuses(filtered);
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

    // Memoize allRowsChecked to prevent unnecessary recalculations
    const allRowsChecked = useMemo(() => {
        const count = getFilteredLeadsCount();
        return checkedRows.length === count && count > 0;
    }, [checkedRows.length, getFilteredLeadsCount]);

    const handleRowClick = async (rowIdx) => {
        // Reset obligation changes state when selecting a new lead
        setHasUnsavedObligationChanges(false);
        const selectedLeadData = getFilteredLeadByIndex(rowIdx);
        console.log('🔍 handleRowClick - Lead clicked, ID:', selectedLeadData?._id);
        
        // Set initial data from cache immediately for responsive UI
        setSelectedLead(selectedLeadData);
        setActiveTab(0);
        setOpenSections([0]); // Auto-open the About section (index 0) when opening a lead
        
        // Then fetch complete lead data including applicant_form from API
        if (selectedLeadData?._id) {
            try {
                console.log('� Fetching full lead data from API...');
                const apiUrl = `/api/leads/${selectedLeadData._id}?user_id=${userId}`;
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const fullLeadData = await response.json();
                    console.log('✅ Full lead data fetched');
                    console.log('🔍 fullLeadData.dynamic_fields:', fullLeadData?.dynamic_fields);
                    console.log('🔍 fullLeadData.dynamic_fields.applicant_form:', fullLeadData?.dynamic_fields?.applicant_form);
                    
                    // Update selectedLead with complete data including applicant_form
                    setSelectedLead(fullLeadData);
                } else {
                    console.error('❌ Failed to fetch full lead data:', response.status);
                }
            } catch (error) {
                console.error('❌ Error fetching full lead data:', error);
            }
        }
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
        { key: "totalIncome", label: "TOTAL INCOME", className: "text-left whitespace-nowrap" },
        { key: "eligibility_details.foir", label: "FOIR ELIGIBILITY", className: "text-left whitespace-nowrap" },
        { key: "financial_details.total_bt_pos", label: "TOTAL BT POS", className: "text-left whitespace-nowrap" },
        { key: "financial_details.cibil_score", label: "CIBIL SCORE", className: "text-left whitespace-nowrap" },
        { key: "company_name", label: "COMPANY NAME", className: "text-left whitespace-nowrap" },
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

    // Format date in DD Month YYYY format (IST timezone)
    const formatDate = (date) => {
        if (!date) return '-';
        const dateObj = new Date(date);
        // Convert to IST timezone
        const istDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const day = istDate.getDate().toString().padStart(2, '0');
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const month = monthNames[istDate.getMonth()];
        const year = istDate.getFullYear();
        return `${day} ${month} ${year}`;
    };

    // Calculate days old from current date (IST timezone)
    const calculateDaysOld = (date) => {
        if (!date) return 0;
        // Get current date in IST
        const currentDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        // Convert input date to IST
        const leadDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
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

    // Fetch employees with designation 'team leader' from backend
    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            // Try different possible endpoints
            const endpoints = [
                `${apiBaseUrl}/users?user_id=${userId}&designation=team leader`,
                `${apiBaseUrl}/users?user_id=${userId}`,
                `${apiBaseUrl}/hrms/employees?user_id=${userId}&designation=team leader`,
                `${apiBaseUrl}/employees?user_id=${userId}&designation=team leader`
            ];
            
            let data = null;
            let successEndpoint = null;
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        data = await response.json();
                        successEndpoint = endpoint;
                        break;
                    }
                } catch (endpointError) {
                }
            }
            
            if (data) {
                
                // Handle different response structures
                let employees = [];
                if (Array.isArray(data)) {
                    employees = data;
                } else if (data.items && Array.isArray(data.items)) {
                    employees = data.items;
                } else if (data.users && Array.isArray(data.users)) {
                    employees = data.users;
                } else if (data.employees && Array.isArray(data.employees)) {
                    employees = data.employees;
                }
                
                // Filter for team leaders - try different designation field names
                const teamLeaders = employees.filter(emp => {
                    const designation = emp.designation || emp.role || emp.position || emp.job_title;
                    return designation && designation.toLowerCase().includes('team leader');
                });
                
                setEmployees(teamLeaders);
                
            } else {
                setEmployees([]);
            }
        } catch (error) {
            setEmployees([]);
        } finally {
            setLoadingEmployees(false);
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
                        {/* Debug: Show current state */}
                        {console.log('🔍 Button Render Check:', {
                            lead_id: selectedLead?._id,
                            status: selectedLead?.status,
                            sub_status: selectedLead?.sub_status,
                            important_questions_validated: selectedLead?.important_questions_validated,
                            file_sent_to_login: selectedLead?.file_sent_to_login
                        })}
                        
                        {/* Show Copy Button regardless of department */}
                        {!selectedLead?.file_sent_to_login && (() => {
                            // Get status and sub_status values
                            const status = (typeof selectedLead?.status === 'string' ? selectedLead.status : selectedLead?.status?.name) || '';
                            const subStatus = (typeof selectedLead?.sub_status === 'string' ? selectedLead.sub_status : selectedLead?.sub_status?.name) || '';
                            
                            // Check if status or sub_status contains "file complete" (case-insensitive)
                            const statusLower = status.toLowerCase();
                            const subStatusLower = subStatus.toLowerCase();
                            const isFileComplete = statusLower.includes('file complete') || subStatusLower.includes('file complete');
                            
                            console.log('📋 Copy Button Decision:', {
                                status,
                                subStatus,
                                statusLower,
                                subStatusLower,
                                isFileComplete,
                                validated: selectedLead?.important_questions_validated,
                                shouldShow: isFileComplete && selectedLead?.important_questions_validated
                            });
                            
                            // Show button if file is complete AND important questions are validated
                            return isFileComplete && selectedLead?.important_questions_validated ? (
                                <button
                                    onClick={() => setShowCopyLeadModal(true)}
                                    className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
                                >
                                    <Copy className="mr-2 h-4 w-4" /> COPY THIS LEAD
                                </button>
                            ) : null;
                        })()}
                        {!selectedLead?.file_sent_to_login ? (
                            (() => {
                                // Get status and sub_status values
                                const status = (typeof selectedLead?.status === 'string' ? selectedLead.status : selectedLead?.status?.name) || '';
                                const subStatus = (typeof selectedLead?.sub_status === 'string' ? selectedLead.sub_status : selectedLead?.sub_status?.name) || '';
                                
                                // Check if status or sub_status contains "file complete" (case-insensitive)
                                const statusLower = status.toLowerCase();
                                const subStatusLower = subStatus.toLowerCase();
                                const isFileComplete = statusLower.includes('file complete') || subStatusLower.includes('file complete');
                                
                                console.log('✅ Send to Login Button Decision:', {
                                    status,
                                    subStatus,
                                    statusLower,
                                    subStatusLower,
                                    isFileComplete,
                                    validated: selectedLead?.important_questions_validated,
                                    shouldShow: isFileComplete && selectedLead?.important_questions_validated
                                });
                                
                                // Show button if file is complete AND important questions are validated
                                return isFileComplete && selectedLead?.important_questions_validated ? (
                                    <button
                                        onClick={() => setShowFileSentToLoginModal(true)}
                                        className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base"
                                    >
                                        <span className="hidden sm:inline">FILE SENT TO LOGIN</span>
                                        <span className="sm:hidden">SEND TO LOGIN</span>
                                    </button>
                                ) : null;
                            })()
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
                                    new Date(selectedLead.login_department_sent_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) :
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
                            
                            // Also update filteredLeads to refresh the table display
                            setFilteredLeads(filteredLeads =>
                                filteredLeads.map(lead =>
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
                    <div className="w-full">
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
                                        <div className="w-full mt-2">
                                            {section.content}
                                        </div>
                                    )
                                ) : (
                                    // Always show content for all tabs with full width styling and no background
                                    <div className="w-full">
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
        <div className="min-h-screen bg-black text-white font-sans">
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
                <div className="overflow-auto rounded-xl sticky-table-container">
                    {/* Unified Controls Row - Select, Filter, Search and Results Indicator */}
                    <div className="flex items-center justify-between gap-4 mb-4 mt-5">
                        <div className="flex items-center gap-3">
                            {/* Select Button - Show for users with delete permission or Super Admin */}
                            {(canDeleteLeads() || isSuperAdmin()) && !checkboxVisible ? (
                                <button
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                    onClick={handleShowCheckboxes}
                                >
                                    {checkedRows.length > 0
                                        ? `Select (${checkedRows.length})`
                                        : "Select"}
                                </button>
                            ) : (canDeleteLeads() || isSuperAdmin()) && checkboxVisible ? (
                                <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                                    <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                                        <input
                                            type="checkbox"
                                            className="accent-blue-500 mr-2 cursor-pointer"
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
                                    {filteredLeadsData.length} of {leads.length} leads
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
                            
                            {/* Filter Button - Optimized with smooth transitions */}
                            <button
                                className={`px-5 py-3 rounded-lg font-bold shadow-lg transition-all duration-200 ease-in-out relative flex items-center gap-3 text-base transform hover:scale-105 active:scale-95 ${getActiveFilterCount() > 0
                                    ? 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-orange-500/50'
                                    : 'bg-gray-600 text-white hover:bg-gray-700 hover:shadow-gray-600/50'
                                    }`}
                                onClick={() => setShowFilterPopup(true)}
                                style={{ willChange: 'transform, background-color, box-shadow' }}
                            >
                                <svg
                                    className="w-5 h-5 transition-transform duration-200"
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
                                    <span 
                                        className="absolute -top-2 -right-2 bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center transition-all duration-200 animate-pulse"
                                        style={{ willChange: 'transform' }}
                                    >
                                        {getActiveFilterCount()}
                                    </span>
                                )}
                            </button>

                            {/* Search Box - Optimized with smooth transitions */}
                            <div className="relative w-[320px]">
                                <input
                                    type="text"
                                    placeholder="Search leads..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full py-3 pl-10 pr-10 bg-[#1b2230] text-gray-300 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-base placeholder-gray-500 transition-all duration-200 ease-in-out"
                                    style={{ willChange: 'border-color, box-shadow' }}
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg
                                        className="w-5 h-5 text-gray-500 transition-colors duration-200"
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
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-200 transition-all duration-150 hover:scale-110"
                                        style={{ willChange: 'transform' }}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

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
                                {/* Table with sticky header - improved sticky positioning */}
                                <table className="min-w-[1600px] w-full bg-black relative">
                                <thead 
                                    className="bg-white sticky top-0 z-50 shadow-lg border-b-2 border-gray-200 cursor-pointer select-none" 
                                    onDoubleClick={toggleFullscreen}
                                    title="Double-click to toggle fullscreen"
                                >
                                        <tr>
                                            {(canDeleteLeads() || isSuperAdmin()) && checkboxVisible && (
                                                <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-blue-500 cursor-pointer"
                                                        checked={allRowsChecked}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                            )}
                                            {columns.map((col, idx) => (
                                                <th
                                                    key={idx}
                                                    className={`bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 ${idx === 0 && !((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? "" : ""
                                                        } ${idx === columns.length - 1 && !((canDeleteLeads() || isSuperAdmin()) && checkboxVisible)
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
                                                colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                className="py-20 text-center text-gray-400 text-lg bg-black"
                                            >
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                                    <span className="text-xl font-semibold">Loading Leads...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : displayedLeads.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                className="py-20 text-center text-gray-400 text-lg bg-black"
                                            >
                                                {searchTerm || getActiveFilterCount() > 0
                                                    ? "No leads match your search or filter criteria."
                                                    : "No leads available."}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedLeads.map((lead, rowIdx) => {
                                            // Check if this is the first "sent to login" lead to add visual separator
                                            const isFirstSentToLogin = rowIdx > 0 &&
                                                lead.file_sent_to_login &&
                                                !displayedLeads[rowIdx - 1].file_sent_to_login;

                                            return (
                                                <React.Fragment key={lead._id || `lead-${rowIdx}`}>

                                                    <tr
                                                        ref={el => (rowRefs.current[rowIdx] = el)}
                                                        className={`
                                                        border-b border-gray-800 hover:bg-gray-900/50 transition
                                                        ${lead.file_sent_to_login ? 'bg-gray-900/30' : 'bg-black'}
                                                        ${checkedRows.includes(rowIdx) ? "bg-blue-900/20" : ""}
                                                    `}
                                                        onClick={() => !((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) && handleRowClick(rowIdx)}
                                                        style={{ cursor: ((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? "default" : "pointer" }}
                                                    >
                                                        {(canDeleteLeads() || isSuperAdmin()) && checkboxVisible && (
                                                            <td className="py-2 px-4 whitespace-nowrap">
                                                                <input
                                                                    type="checkbox"
                                                                    className="accent-blue-500 cursor-pointer"
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
                                                            {(() => {
                                                                // Check if file is sent to login OR if status indicates login
                                                                const statusValue = typeof lead.status === 'object' ? (lead.status?.name || '') : (lead.status || '');
                                                                const subStatusValue = typeof lead.sub_status === 'object' ? (lead.sub_status?.name || '') : (lead.sub_status || '');
                                                                
                                                                // List of login-related statuses
                                                                const loginStatuses = [
                                                                    'file sent to login', 'file sent', 'sent to login', 
                                                                    'login submitted', 'active login', 'new login',
                                                                    'disbursed', 'converted', 'approved', 'loan approved',
                                                                    'login file sent'
                                                                ];
                                                                
                                                                const isLoginStatus = lead.file_sent_to_login || 
                                                                    loginStatuses.some(ls => 
                                                                        statusValue.toLowerCase().includes(ls) || 
                                                                        subStatusValue.toLowerCase().includes(ls)
                                                                    );
                                                                
                                                                if (isLoginStatus) {
                                                                    return (
                                                                        <div className="flex items-center justify-center">
                                                                            <span className="bg-green-500 text-white text-sm px-3 py-2 rounded-full font-bold flex items-center">
                                                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                                                </svg>
                                                                                Login
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    // Check if user has permission to update status
                                                                    if (canUpdateStatus()) {
                                                                        // Editable status dropdown
                                                                        return (
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
                                                                        );
                                                                    } else {
                                                                        // Read-only status display (no permission to update)
                                                                        return (
                                                                            <div className="bg-gray-800 text-gray-400 py-2 px-3 rounded-md border border-gray-600 w-full min-w-[150px] opacity-75 cursor-not-allowed">
                                                                                <div className="font-medium text-sm text-left">
                                                                                    {(() => {
                                                                                        if (lead.sub_status) {
                                                                                            return (
                                                                                                <div>
                                                                                                    <div className="text-gray-300">{typeof lead.sub_status === 'object' ? (lead.sub_status.name || 'Unknown Sub-Status') : (lead.sub_status || 'Unknown Sub-Status')}</div>
                                                                                                    <div className="text-xs text-gray-500">
                                                                                                        {typeof lead.status === 'object' ? (lead.status.name || 'Unknown Status') : (lead.status || 'Unknown Status')}
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        } else {
                                                                                            return (typeof lead.status === 'object' ? (lead.status.name || 'Select Status') : (lead.status || 'Select Status'));
                                                                                        }
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                }
                                                            })()}
                                                            
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
                                                                        <div className="p-3 border-b border-gray-200 bg-white z-10 rounded-t-lg">
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
                                                            // Helper function to extract total income from multiple sources
                                                            const extractTotalIncome = (lead) => {
                                                                const incomeSources = [
                                                                    lead.totalIncome,
                                                                    lead.eligibility_details?.totalIncome,
                                                                    lead.eligibility?.totalIncome,
                                                                    lead.dynamic_fields?.eligibility_details?.totalIncome,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.totalIncome,
                                                                    lead.obligation_data?.eligibility?.totalIncome,
                                                                    lead.dynamic_fields?.financial_details?.monthly_income,
                                                                    lead.financial_details?.monthly_income,
                                                                    lead.salary,
                                                                    lead.monthly_income
                                                                ];
                                                                
                                                                return incomeSources.find(income => income !== undefined && income !== null && income !== '');
                                                            };
                                                            
                                                            let income = extractTotalIncome(lead);
                                                            
                                                            // Handle object income values
                                                            if (income && typeof income === 'object') {
                                                                if (income.totalIncome !== undefined) {
                                                                    income = income.totalIncome;
                                                                } else if (income.amount !== undefined) {
                                                                    income = income.amount;
                                                                } else {
                                                                    income = null; // Unable to extract valid income
                                                                }
                                                            }
                                                            
                                                            // Format and return the income
                                                            if (income !== null && income !== undefined && income !== '') {
                                                                // If already formatted string with currency, return as is
                                                                if (typeof income === 'string' && (income.includes('₹') || income.includes(','))) {
                                                                    return income;
                                                                }
                                                                return formatCurrency(income);
                                                            }
                                                            return "-";
                                                        })()}
                                                    </td>
                                                    <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                        {(() => {
                                                            // Extract FOIR eligibility from multiple possible paths
                                                            const extractFoirEligibility = (lead) => {
                                                                
                                                                const foirSources = [
                                                                    // Primary path - FOIR eligibility (final calculated result) from ObligationSection
                                                                    lead.dynamic_fields?.eligibility_details?.finalEligibility,
                                                                    lead.eligibility_details?.finalEligibility,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.finalEligibility,
                                                                    
                                                                    // Alternative FOIR eligibility paths
                                                                    lead.dynamic_fields?.eligibility_details?.foir_eligibility,
                                                                    lead.eligibility_details?.foir_eligibility,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.foir_eligibility,
                                                                    
                                                                    // Check in check_eligibility section for calculated eligibility
                                                                    lead.dynamic_fields?.check_eligibility?.foir_eligibility,
                                                                    lead.dynamic_fields?.check_eligibility?.final_eligibility,
                                                                    lead.dynamic_fields?.check_eligibility?.loan_eligibility,
                                                                    
                                                                    // Alternative naming for final eligibility
                                                                    lead.dynamic_fields?.eligibility_details?.final_eligibility,
                                                                    lead.eligibility_details?.final_eligibility,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.final_eligibility,
                                                                    
                                                                    // Loan eligibility amount (calculated result)
                                                                    lead.dynamic_fields?.eligibility_details?.loanEligibility,
                                                                    lead.eligibility_details?.loanEligibility,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.loanEligibility,
                                                                    
                                                                    // Alternative loan eligibility naming
                                                                    lead.dynamic_fields?.eligibility_details?.loan_eligibility,
                                                                    lead.eligibility_details?.loan_eligibility,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.loan_eligibility,
                                                                    
                                                                    // Calculated eligibility alternatives
                                                                    lead.dynamic_fields?.obligation_data?.calculatedEligibility,
                                                                    lead.dynamic_fields?.eligibility_details?.calculatedEligibility,
                                                                    lead.calculated_eligibility,
                                                                    
                                                                    // Alternative paths for eligibility object
                                                                    lead.eligibility?.finalEligibility,
                                                                    lead.dynamic_fields?.eligibility?.finalEligibility,
                                                                    lead.eligibility?.foir_eligibility,
                                                                    lead.dynamic_fields?.eligibility?.foir_eligibility,
                                                                ];
                                                                
                                                                // First, look for ELIGIBILITY calculations (including 0 which means "Not Eligible")
                                                                const eligibilityResult = foirSources.find(eligibility => 
                                                                    eligibility !== undefined && 
                                                                    eligibility !== null && 
                                                                    eligibility !== ''
                                                                );
                                                                
                                                                // If we found an eligibility calculation (even if it's 0), return it
                                                                if (eligibilityResult !== undefined) {
                                                                    return eligibilityResult;
                                                                }
                                                                
                                                                // Only if no eligibility calculation exists, fall back to FOIR amount sources
                                                                const foirAmountSources = [
                                                                    lead.dynamic_fields?.eligibility_details?.foirAmount,
                                                                    lead.eligibility_details?.foirAmount,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.foirAmount,
                                                                    
                                                                    // Direct FOIR field paths (legacy)
                                                                    lead.eligibility_details?.foir,
                                                                    lead.dynamic_fields?.eligibility_details?.foir,
                                                                    lead.dynamic_fields?.obligation_data?.eligibility_details?.foir,
                                                                    lead.obligation_data?.eligibility_details?.foir,
                                                                    
                                                                    // Alternative FOIR paths (legacy)
                                                                    lead.dynamic_fields?.obligation_data?.foir,
                                                                    lead.obligation_data?.foir,
                                                                    lead.dynamic_fields?.foir,
                                                                    lead.foir,
                                                                    
                                                                    // Check in financial details
                                                                    lead.financial_details?.foir,
                                                                    lead.dynamic_fields?.financial_details?.foir,
                                                                    lead.obligation_data?.financial_details?.foir,
                                                                    
                                                                    // Check within eligibility objects for FOIR
                                                                    lead.eligibility?.foir,
                                                                    lead.dynamic_fields?.eligibility?.foir,
                                                                    lead.obligation_data?.eligibility?.foir,
                                                                    
                                                                    // Alternative naming conventions
                                                                    lead.eligibility_details?.foir_eligibility,
                                                                    lead.dynamic_fields?.eligibility_details?.foir_eligibility,
                                                                    lead.obligation_data?.eligibility_details?.foir_eligibility,
                                                                    
                                                                    // Alternative eligibility amount naming in obligation data
                                                                    lead.dynamic_fields?.obligation_data?.eligibility?.foir_eligibility,
                                                                    lead.obligation_data?.eligibility?.foir_eligibility
                                                                ];
                                                                
                                                                // For FOIR amounts, exclude 0 values (no meaningful FOIR amount)
                                                                return foirAmountSources.find(amount => 
                                                                    amount !== undefined && 
                                                                    amount !== null && 
                                                                    amount !== '' && 
                                                                    amount !== '0' && 
                                                                    amount !== 0
                                                                );
                                                            };
                                                            
                                                            let foirEligibilityValue = extractFoirEligibility(lead);
                                                            
                                                            // Handle object FOIR eligibility values
                                                            if (foirEligibilityValue && typeof foirEligibilityValue === 'object') {
                                                                if (foirEligibilityValue.finalEligibility !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.finalEligibility;
                                                                } else if (foirEligibilityValue.foir_eligibility !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.foir_eligibility;
                                                                } else if (foirEligibilityValue.loan_eligibility !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.loan_eligibility;
                                                                } else if (foirEligibilityValue.foirAmount !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.foirAmount;
                                                                } else if (foirEligibilityValue.foir !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.foir;
                                                                } else if (foirEligibilityValue.amount !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.amount;
                                                                } else if (foirEligibilityValue.value !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.value;
                                                                } else if (foirEligibilityValue.eligibility !== undefined) {
                                                                    foirEligibilityValue = foirEligibilityValue.eligibility;
                                                                } else {
                                                                    foirEligibilityValue = null; // Unable to extract valid FOIR eligibility
                                                                }
                                                            }
                                                            
                                                            // Format and return the FOIR eligibility
                                                            // Note: We include 0 as a valid eligibility (means "Not Eligible")
                                                            if (foirEligibilityValue !== null && foirEligibilityValue !== undefined && foirEligibilityValue !== '') {
                                                                // Handle 0 eligibility (Not Eligible case)
                                                                if (foirEligibilityValue === 0 || foirEligibilityValue === '0') {
                                                                    return '₹ 0 (Not Eligible)';
                                                                }
                                                                // If already formatted string with currency, return as is
                                                                if (typeof foirEligibilityValue === 'string' && (foirEligibilityValue.includes('₹') || foirEligibilityValue.includes(',') || foirEligibilityValue.includes('Rs'))) {
                                                                    return foirEligibilityValue;
                                                                }
                                                                // If it's a number or numeric string, format it
                                                                if (!isNaN(foirEligibilityValue) && foirEligibilityValue !== '') {
                                                                    return formatCurrency(foirEligibilityValue);
                                                                }
                                                                // If it's already a formatted string, return as is
                                                                return foirEligibilityValue;
                                                            }
                                                            return "-";
                                                        })()}
                                                    </td>
                                                    <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                        {(() => {
                                                            // Helper function to extract total BT position from multiple sources
                                                            const extractTotalBtPos = (lead) => {
                                                                const btPosSources = [
                                                                    lead.total_bt_pos,
                                                                    lead.totalBtPos,
                                                                    lead.financial_details?.total_bt_pos,
                                                                    lead.financial_details?.totalBtPos,
                                                                    lead.dynamic_fields?.financial_details?.total_bt_pos,
                                                                    lead.dynamic_fields?.financial_details?.totalBtPos,
                                                                    lead.obligation_data?.total_bt_pos,
                                                                    lead.obligation_data?.totalBtPos,
                                                                    lead.obligation_data?.financial_details?.total_bt_pos,
                                                                    lead.obligation_data?.financial_details?.totalBtPos,
                                                                    lead.dynamic_fields?.obligation_data?.total_bt_pos,
                                                                    lead.dynamic_fields?.obligation_data?.totalBtPos,
                                                                    lead.eligibility_details?.total_bt_pos,
                                                                    lead.eligibility_details?.totalBtPos,
                                                                    lead.dynamic_fields?.eligibility_details?.total_bt_pos,
                                                                    lead.dynamic_fields?.eligibility_details?.totalBtPos,
                                                                    lead.bt_position,
                                                                    lead.btPosition,
                                                                    lead.total_balance_transfer,
                                                                    lead.totalBalanceTransfer
                                                                ];
                                                                
                                                                return btPosSources.find(btPos => btPos !== undefined && btPos !== null && btPos !== '');
                                                            };
                                                            
                                                            let btPos = extractTotalBtPos(lead);
                                                            
                                                            // Handle object BT position values
                                                            if (btPos && typeof btPos === 'object') {
                                                                if (btPos.total_bt_pos !== undefined) {
                                                                    btPos = btPos.total_bt_pos;
                                                                } else if (btPos.totalBtPos !== undefined) {
                                                                    btPos = btPos.totalBtPos;
                                                                } else if (btPos.amount !== undefined) {
                                                                    btPos = btPos.amount;
                                                                } else if (btPos.value !== undefined) {
                                                                    btPos = btPos.value;
                                                                } else if (btPos.balance !== undefined) {
                                                                    btPos = btPos.balance;
                                                                } else {
                                                                    btPos = null; // Unable to extract valid BT position
                                                                }
                                                            }
                                                            
                                                            // Format and return the BT position
                                                            if (btPos !== null && btPos !== undefined && btPos !== '') {
                                                                // If already formatted string with currency, return as is
                                                                if (typeof btPos === 'string' && (btPos.includes('₹') || btPos.includes(','))) {
                                                                    return btPos;
                                                                }
                                                                return formatCurrency(btPos);
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
                                                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                            <div className="flex items-center gap-2">
                                                                <span>
                                                                    {(() => {
                                                                        // Access company_name from dynamic_fields.personal_details.company_name
                                                                        const companyName = lead.dynamic_fields?.personal_details?.company_name;
                                                                        if (companyName && typeof companyName === 'object') {
                                                                            return companyName.name || companyName.value || "-";
                                                                        }
                                                                        return companyName || "-";
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>   
                                            );
                                        })
                                    )}
                                    
                                    {/* Show More Button - appears after displayed leads if there are more */}
                                    {hasMoreToShow && displayedLeads.length > 0 && (
                                        <tr>
                                            <td 
                                                colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                className="py-6 text-center bg-black"
                                            >
                                                <button
                                                    onClick={() => setDisplayedCount(prev => prev + LOAD_MORE_COUNT)}
                                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                                                >
                                                    Show More ({Math.min(LOAD_MORE_COUNT, filteredLeadsData.length - displayedCount)} more leads)
                                                </button>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    Showing {displayedLeads.length} of {filteredLeadsData.length} leads
                                                </p>
                                            </td>
                                        </tr>
                                    )}
                                    
                                    {/* End of results indicator - only show when all leads are displayed */}
                                    {!hasMoreToShow && displayedLeads.length > 0 && (
                                        <tr>
                                            <td 
                                                colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                className="py-6 text-center bg-black text-gray-400"
                                            >
                                                <p className="text-sm">— End of leads ({filteredLeadsData.length} total) —</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </div>
                </div>

            {/* Fullscreen Table Overlay */}
            {isFullscreen && (
                <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
                    {/* Top hover area for close button - improved visibility and smoothness */}
                    <div 
                        className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-20 z-[10000] flex items-center justify-center"
                        onMouseEnter={() => setShowCloseButton(true)}
                        onMouseLeave={() => setShowCloseButton(false)}
                    >
                        <button
                            onClick={exitFullscreen}
                            className={`bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 ease-in-out transform hover:scale-110 ${
                                showCloseButton ? 'opacity-100 translate-y-2' : 'opacity-0 -translate-y-2'
                            } z-[10001] border-2 border-white/20`}
                            aria-label="Exit fullscreen"
                            style={{ 
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4)'
                            }}
                        >
                            <X className="w-7 h-7" />
                        </button>
                    </div>

                    {/* Fullscreen table container */}
                    <div className="flex-1 p-4 overflow-hidden">
                        <div className="relative h-full">
                            {/* Horizontal scroll buttons for fullscreen */}
                            {canScrollLeft && (
                                <button
                                    onClick={() => scrollTable('left')}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
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
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
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
                                className="bg-black rounded-lg overflow-x-auto h-full overflow-y-auto"
                                onScroll={updateScrollButtons}
                            >
                                {/* Fullscreen Table */}
                                <table className="min-w-[1600px] w-full bg-black relative table-fixed">
                                    <thead 
                                        className="bg-white sticky top-0 z-50 shadow-lg border-b-2 border-gray-200 cursor-pointer select-none" 
                                        onDoubleClick={toggleFullscreen}
                                        title="Double-click to exit fullscreen"
                                    >
                                        <tr>
                                            {isSuperAdmin() && checkboxVisible && (
                                                <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-blue-500 cursor-pointer"
                                                        checked={allRowsChecked}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                            )}
                                            {/* Fixed column headers to match data structure */}
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-16">
                                                #
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-40">
                                                LEAD DATE & AGE
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-36">
                                                CREATED BY
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-32">
                                                TEAM NAME
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-40">
                                                CUSTOMER NAME
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-44">
                                                STATUS
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-36">
                                                TOTAL INCOME
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-36">
                                                FOIR ELIGIBILITY
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-36">
                                                TOTAL BT POS
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-32">
                                                CIBIL SCORE
                                            </th>
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold sticky top-0 z-50 shadow-sm border-b border-gray-200 whitespace-nowrap w-52">
                                                COMPANY NAME
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedLeads.length === 0 ? (
                                            <tr>
                                                <td colSpan={columns.length + ((canDeleteLeads() || isSuperAdmin()) && checkboxVisible ? 1 : 0)} className="py-8 text-center text-gray-400">
                                                    No leads found
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedLeads.map((lead, rowIdx) => {
                                                return (
                                                    <React.Fragment key={lead._id || rowIdx}>
                                                        <tr 
                                                            className={`border-b border-gray-800 hover:bg-gray-900/50 transition ${selectedRows.includes(lead._id) ? 'ring-2 ring-blue-500' : ''} ${lead.file_sent_to_login ? 'bg-gray-900/30' : 'bg-black'}`}
                                                        >
                                                            {isSuperAdmin() && checkboxVisible && (
                                                                <td className="py-2 px-4 whitespace-nowrap">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="accent-blue-500 cursor-pointer"
                                                                        checked={selectedRows.includes(lead._id)}
                                                                        onChange={(e) => handleRowSelect(lead._id, e.target.checked)}
                                                                    />
                                                                </td>
                                                            )}
                                                            
                                                            {/* Index column */}
                                                            <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">{rowIdx + 1}</td>
                                                            
                                                            {/* Lead Date & Age column */}
                                                            <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                {formatDateWithAge(lead.created_at)}
                                                            </td>
                                                            
                                                            {/* Created By column */}
                                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                <div className="flex items-center gap-3">
                                                                    <span className='text-sm text-wrap'>{typeof lead.created_by_name === 'object' ? lead.created_by_name?.name || "-" : lead.created_by_name || "-"}</span>
                                                                </div>
                                                            </td>
                                                            
                                                            {/* Team Name column */}
                                                            <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                {typeof lead.department_name === 'object' ? lead.department_name?.name || "-" : lead.department_name || "-"}
                                                            </td>
                                                            
                                                            {/* Customer Name column */}
                                                            <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                <div className="flex items-center gap-3">
                                                                    <span className='text-wrap'>{lead.name || "-"}</span>
                                                                </div>
                                                            </td>
                                                            
                                                            {/* Status column - exact copy from normal table */}
                                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white relative">
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
                                                                                return typeof lead.status === 'object' ? (lead.status.name || 'Unknown Status') : (lead.status || 'Unknown Status');
                                                                            }
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            
                                                            {/* Total Income column - exact copy from normal table */}
                                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                {(() => {
                                                                    // Extract total income from multiple possible paths - exact copy from normal table
                                                                    const extractTotalIncome = (lead) => {
                                                                        const incomeSources = [
                                                                            lead.dynamic_fields?.eligibility_details?.totalIncome,
                                                                            lead.eligibility_details?.totalIncome,
                                                                            lead.dynamic_fields?.obligation_data?.eligibility?.totalIncome,
                                                                            lead.obligation_data?.eligibility?.totalIncome,
                                                                            lead.dynamic_fields?.financial_details?.monthly_income,
                                                                            lead.financial_details?.monthly_income,
                                                                            lead.salary,
                                                                            lead.monthly_income
                                                                        ];
                                                                        
                                                                        return incomeSources.find(income => income !== undefined && income !== null && income !== '');
                                                                    };
                                                                    
                                                                    let income = extractTotalIncome(lead);
                                                                    
                                                                    // Handle object income values
                                                                    if (income && typeof income === 'object') {
                                                                        if (income.totalIncome !== undefined) {
                                                                            income = income.totalIncome;
                                                                        } else if (income.amount !== undefined) {
                                                                            income = income.amount;
                                                                        } else {
                                                                            income = null; // Unable to extract valid income
                                                                        }
                                                                    }
                                                                    
                                                                    // Format and return the income
                                                                    if (income !== null && income !== undefined && income !== '') {
                                                                        // If already formatted string with currency, return as is
                                                                        if (typeof income === 'string' && (income.includes('₹') || income.includes(','))) {
                                                                            return income;
                                                                        }
                                                                        return formatCurrency(income);
                                                                    }
                                                                    return "-";
                                                                })()}
                                                            </td>
                                                            
                                                            {/* FOIR Eligibility column - exact copy from normal table */}
                                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                {(() => {
                                                                    // Extract FOIR eligibility from multiple possible paths - exact copy
                                                                    const extractFoirEligibility = (lead) => {
                                                                        const foirSources = [
                                                                            // Primary path - FOIR eligibility (final calculated result) from ObligationSection
                                                                            lead.dynamic_fields?.eligibility_details?.finalEligibility,
                                                                            lead.eligibility_details?.finalEligibility,
                                                                            lead.dynamic_fields?.obligation_data?.eligibility?.finalEligibility,
                                                                            
                                                                            // Alternative FOIR eligibility paths
                                                                            lead.dynamic_fields?.eligibility_details?.foir_eligibility,
                                                                            lead.eligibility_details?.foir_eligibility,
                                                                            lead.dynamic_fields?.obligation_data?.eligibility?.foir_eligibility,
                                                                            
                                                                            // Check in check_eligibility section for calculated eligibility
                                                                            lead.dynamic_fields?.check_eligibility?.foir_eligibility,
                                                                            lead.dynamic_fields?.check_eligibility?.final_eligibility,
                                                                            lead.dynamic_fields?.check_eligibility?.loan_eligibility,
                                                                            
                                                                            // Alternative naming for final eligibility
                                                                            lead.dynamic_fields?.eligibility_details?.final_eligibility,
                                                                            lead.eligibility_details?.final_eligibility,
                                                                            lead.dynamic_fields?.obligation_data?.eligibility?.final_eligibility,
                                                                            
                                                                            // Loan eligibility amount (calculated result)
                                                                            lead.dynamic_fields?.eligibility_details?.loanEligibility,
                                                                            lead.eligibility_details?.loanEligibility,
                                                                            lead.dynamic_fields?.obligation_data?.eligibility?.loanEligibility,
                                                                            
                                                                            // Alternative loan eligibility naming
                                                                            lead.dynamic_fields?.eligibility_details?.loan_eligibility,
                                                                            lead.eligibility_details?.loan_eligibility,
                                                                            lead.dynamic_fields?.obligation_data?.eligibility?.loan_eligibility,
                                                                            
                                                                            // Calculated eligibility alternatives
                                                                            lead.dynamic_fields?.obligation_data?.calculatedEligibility,
                                                                            lead.dynamic_fields?.eligibility_details?.calculatedEligibility,
                                                                            lead.calculated_eligibility,
                                                                            
                                                                            // Alternative paths for eligibility object
                                                                            lead.eligibility?.finalEligibility,
                                                                            lead.dynamic_fields?.eligibility?.finalEligibility,
                                                                            lead.eligibility?.foir_eligibility,
                                                                            lead.dynamic_fields?.eligibility?.foir_eligibility,
                                                                        ];
                                                                        
                                                                        return foirSources.find(eligibility => eligibility !== undefined && eligibility !== null && eligibility !== '');
                                                                    };
                                                                    
                                                                    let foirEligibilityValue = extractFoirEligibility(lead);
                                                                    
                                                                    // Handle object eligibility values
                                                                    if (foirEligibilityValue && typeof foirEligibilityValue === 'object') {
                                                                        if (foirEligibilityValue.finalEligibility !== undefined) {
                                                                            foirEligibilityValue = foirEligibilityValue.finalEligibility;
                                                                        } else if (foirEligibilityValue.amount !== undefined) {
                                                                            foirEligibilityValue = foirEligibilityValue.amount;
                                                                        } else if (foirEligibilityValue.eligibility !== undefined) {
                                                                            foirEligibilityValue = foirEligibilityValue.eligibility;
                                                                        } else {
                                                                            foirEligibilityValue = null; // Unable to extract valid eligibility
                                                                        }
                                                                    }
                                                                    
                                                                    // Format and return the eligibility
                                                                    if (foirEligibilityValue !== null && foirEligibilityValue !== undefined && foirEligibilityValue !== '') {
                                                                        // If already formatted string with currency, return as is
                                                                        if (typeof foirEligibilityValue === 'string' && (foirEligibilityValue.includes('₹') || foirEligibilityValue.includes(','))) {
                                                                            return foirEligibilityValue;
                                                                        }
                                                                        return formatCurrency(foirEligibilityValue);
                                                                    }
                                                                    return "-";
                                                                })()}
                                                            </td>
                                                            
                                                            {/* Total BT POS column - EXACT copy from normal table */}
                                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                {(() => {
                                                                    // Helper function to extract total BT position from multiple sources - EXACT copy
                                                                    const extractTotalBtPos = (lead) => {
                                                                        const btPosSources = [
                                                                            lead.total_bt_pos,
                                                                            lead.totalBtPos,
                                                                            lead.financial_details?.total_bt_pos,
                                                                            lead.financial_details?.totalBtPos,
                                                                            lead.dynamic_fields?.financial_details?.total_bt_pos,
                                                                            lead.dynamic_fields?.financial_details?.totalBtPos,
                                                                            lead.obligation_data?.total_bt_pos,
                                                                            lead.obligation_data?.totalBtPos,
                                                                            lead.obligation_data?.financial_details?.total_bt_pos,
                                                                            lead.obligation_data?.financial_details?.totalBtPos,
                                                                            lead.dynamic_fields?.obligation_data?.total_bt_pos,
                                                                            lead.dynamic_fields?.obligation_data?.totalBtPos,
                                                                            lead.eligibility_details?.total_bt_pos,
                                                                            lead.eligibility_details?.totalBtPos,
                                                                            lead.dynamic_fields?.eligibility_details?.total_bt_pos,
                                                                            lead.dynamic_fields?.eligibility_details?.totalBtPos,
                                                                            lead.bt_position,
                                                                            lead.btPosition,
                                                                            lead.total_balance_transfer,
                                                                            lead.totalBalanceTransfer
                                                                        ];
                                                                        
                                                                        return btPosSources.find(btPos => btPos !== undefined && btPos !== null && btPos !== '');
                                                                    };
                                                                    
                                                                    let btPos = extractTotalBtPos(lead);
                                                                    
                                                                    // Handle object BT position values - EXACT copy
                                                                    if (btPos && typeof btPos === 'object') {
                                                                        if (btPos.total_bt_pos !== undefined) {
                                                                            btPos = btPos.total_bt_pos;
                                                                        } else if (btPos.totalBtPos !== undefined) {
                                                                            btPos = btPos.totalBtPos;
                                                                        } else if (btPos.amount !== undefined) {
                                                                            btPos = btPos.amount;
                                                                        } else if (btPos.value !== undefined) {
                                                                            btPos = btPos.value;
                                                                        } else if (btPos.balance !== undefined) {
                                                                            btPos = btPos.balance;
                                                                        } else {
                                                                            btPos = null; // Unable to extract valid BT position
                                                                        }
                                                                    }
                                                                    
                                                                    // Format and return the BT position - EXACT copy
                                                                    if (btPos !== null && btPos !== undefined && btPos !== '') {
                                                                        // If already formatted string with currency, return as is
                                                                        if (typeof btPos === 'string' && (btPos.includes('₹') || btPos.includes(','))) {
                                                                            return btPos;
                                                                        }
                                                                        return formatCurrency(btPos);
                                                                    }
                                                                    return "-";
                                                                })()}
                                                            </td>
                                                            
                                                            {/* CIBIL Score column - comprehensive data sources */}
                                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                                {(() => {
                                                                    // Try all possible CIBIL score sources including nested objects
                                                                    let cibilScore = lead.financial_details?.cibil_score || 
                                                                                   lead.dynamic_fields?.financial_details?.cibil_score ||
                                                                                   lead.obligation_data?.cibil_score ||
                                                                                   lead.obligation_data?.financial_details?.cibil_score ||
                                                                                   lead.dynamic_fields?.obligation_data?.cibil_score ||
                                                                                   lead.dynamic_fields?.obligation_data?.financial_details?.cibil_score ||
                                                                                   lead.cibil_score ||
                                                                                   lead.credit_score ||
                                                                                   lead.dynamic_fields?.financial_details?.credit_score ||
                                                                                   lead.financial_details?.credit_score ||
                                                                                   lead.dynamic_fields?.personal_details?.cibil_score ||
                                                                                   lead.personal_details?.cibil_score ||
                                                                                   lead.obligation_data?.cibil ||
                                                                                   lead.dynamic_fields?.obligation_data?.cibil ||
                                                                                   // Additional nested paths
                                                                                   lead.dynamic_fields?.credit_details?.cibil_score ||
                                                                                   lead.credit_details?.cibil_score ||
                                                                                   lead.dynamic_fields?.bank_details?.cibil_score ||
                                                                                   lead.bank_details?.cibil_score ||
                                                                                   lead.dynamic_fields?.loan_details?.cibil_score ||
                                                                                   lead.loan_details?.cibil_score;
                                                                    
                                                                    // If still null, try to find any field containing 'cibil' or 'credit'
                                                                    if (!cibilScore && lead.financial_details) {
                                                                        Object.keys(lead.financial_details).forEach(key => {
                                                                            if (key.toLowerCase().includes('cibil') || key.toLowerCase().includes('credit')) {
                                                                                cibilScore = cibilScore || lead.financial_details[key];
                                                                            }
                                                                        });
                                                                    }
                                                                    
                                                                    if (!cibilScore && lead.dynamic_fields?.financial_details) {
                                                                        Object.keys(lead.dynamic_fields.financial_details).forEach(key => {
                                                                            if (key.toLowerCase().includes('cibil') || key.toLowerCase().includes('credit')) {
                                                                                cibilScore = cibilScore || lead.dynamic_fields.financial_details[key];
                                                                            }
                                                                        });
                                                                    }
                                                                    
                                                                    // Handle object CIBIL score values
                                                                    if (cibilScore && typeof cibilScore === 'object') {
                                                                        const extractedScore = cibilScore.cibil_score || 
                                                                                              cibilScore.score || 
                                                                                              cibilScore.credit_score ||
                                                                                              cibilScore.value ||
                                                                                              cibilScore.cibil ||
                                                                                              cibilScore.rating ||
                                                                                              cibilScore.credit_rating;
                                                                        if (extractedScore) {
                                                                            return extractedScore;
                                                                        }
                                                                    }
                                                                    
                                                                    // Handle direct values
                                                                    if (cibilScore !== null && cibilScore !== undefined && cibilScore !== '' && cibilScore !== 0) {
                                                                        return cibilScore;
                                                                    }
                                                                    return "-";
                                                                })()}
                                                            </td>
                                                            
                                                            {/* Company Name column - exact copy from normal table with improved width */}
                                                            <td className="text-md font-semibold py-2 px-4 text-white w-52 max-w-52">
                                                                <div className="truncate" title={(() => {
                                                                    // Access company_name from dynamic_fields.personal_details.company_name - exact copy
                                                                    const companyName = lead.dynamic_fields?.personal_details?.company_name;
                                                                    if (companyName && typeof companyName === 'object') {
                                                                        return companyName.name || companyName.value || "-";
                                                                    }
                                                                    return companyName || "-";
                                                                })()}>
                                                                    {(() => {
                                                                        // Access company_name from dynamic_fields.personal_details.company_name - exact copy
                                                                        const companyName = lead.dynamic_fields?.personal_details?.company_name;
                                                                        if (companyName && typeof companyName === 'object') {
                                                                            return companyName.name || companyName.value || "-";
                                                                        }
                                                                        return companyName || "-";
                                                                    })()}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                        
                                        {/* Infinite Scroll Loading Indicator - Fullscreen */}
                                        {isLoadingMore && (
                                            <tr>
                                                <td 
                                                    colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                    className="py-8 text-center bg-black"
                                                >
                                                    <div className="flex items-center justify-center gap-3 text-[#03B0F5]">
                                                        <div className="animate-spin h-6 w-6 border-3 border-[#03B0F5] rounded-full border-t-transparent"></div>
                                                        <p className="font-medium text-lg">Loading more leads...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        
                                        {/* Show More Button - Fullscreen mode */}
                                        {hasMoreToShow && displayedLeads.length > 0 && (
                                            <tr>
                                                <td 
                                                    colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                    className="py-6 text-center bg-black"
                                                >
                                                    <button
                                                        onClick={() => setDisplayedCount(prev => prev + LOAD_MORE_COUNT)}
                                                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                                                    >
                                                        Show More ({Math.min(LOAD_MORE_COUNT, filteredLeadsData.length - displayedCount)} more leads)
                                                    </button>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        Showing {displayedLeads.length} of {filteredLeadsData.length} leads
                                                    </p>
                                                </td>
                                            </tr>
                                        )}

                                        {/* End of results indicator - Fullscreen - only show when all leads are displayed */}
                                        {!hasMoreToShow && displayedLeads.length > 0 && (
                                            <tr>
                                                <td 
                                                    colSpan={((canDeleteLeads() || isSuperAdmin()) && checkboxVisible) ? columns.length + 1 : columns.length}
                                                    className="py-6 text-center bg-black text-gray-400"
                                                >
                                                    <p className="text-sm">— End of leads ({filteredLeadsData.length} total) —</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Popup with Smooth Animation */}
            {showFilterPopup && (
                <div 
                    className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-[9999] transition-opacity duration-200 ease-out"
                    style={{ 
                        animation: 'fadeIn 0.2s ease-out',
                        willChange: 'opacity'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowFilterPopup(false);
                            clearFilterSearchTerms();
                        }
                    }}
                >
                    <style>
                        {`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                            @keyframes slideUp {
                                from { 
                                    opacity: 0;
                                    transform: translate3d(-50%, -45%, 0) scale(0.95);
                                }
                                to { 
                                    opacity: 1;
                                    transform: translate3d(-50%, -50%, 0) scale(1);
                                }
                            }
                        `}
                    </style>
                    <div 
                        className="bg-[#1b2230] border border-gray-600 rounded-lg p-4 w-[700px] max-w-[80vw] h-[600px] flex flex-col relative z-[9999]" 
                        style={{ 
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            animation: 'slideUp 0.2s ease-out',
                            willChange: 'transform, opacity'
                        }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold text-white">Filter Lead</h2>
                            <button
                                onClick={() => {
                                    setShowFilterPopup(false);
                                    clearFilterSearchTerms();
                                }}
                                className="text-gray-400 hover:text-white text-2xl transition-colors duration-150"
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
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${selectedFilterCategory === 'leadDate'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                        style={{ willChange: 'transform, background-color' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Calendar className="w-5 h-5 transition-transform duration-200" />
                                                <span className="text-base">Date Filters</span>
                                            </div>
                                            {getFilterCategoryCount('leadDate') > 0 && (
                                                <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
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
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${selectedFilterCategory === 'leadAge'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                        style={{ willChange: 'transform, background-color' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 transition-transform duration-200" />
                                                Lead Age
                                            </div>
                                            {getFilterCategoryCount('leadAge') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
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
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${selectedFilterCategory === 'createdBy'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                        style={{ willChange: 'transform, background-color' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 transition-transform duration-200" />
                                                Created By
                                            </div>
                                            {getFilterCategoryCount('createdBy') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
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
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${selectedFilterCategory === 'status'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                        style={{ willChange: 'transform, background-color' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 transition-transform duration-200" />
                                                Status
                                            </div>
                                            {getFilterCategoryCount('status') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
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
                                            // Fetch employees when TL filter is opened if not already loaded
                                            if (employees.length === 0 && !loadingEmployees) {
                                                fetchEmployees();
                                            }
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
                                                Quick Filters
                                            </div>
                                            {getFilterCategoryCount('leadActivity') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('leadActivity')}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('totalIncome');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'totalIncome'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4" />
                                                Total Income
                                            </div>
                                            {getFilterCategoryCount('totalIncome') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('totalIncome')}
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
                                                <div 
                                                    className="cursor-pointer"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.querySelector('input[type="date"]');
                                                        if (input) {
                                                            if (input.showPicker) {
                                                                input.showPicker();
                                                            } else {
                                                                input.focus();
                                                                input.click();
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <label className="block text-gray-400 text-xs mb-1 cursor-pointer">From Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.leadDateFrom}
                                                        onChange={(e) => {
                                                            setFilterOptions({ ...filterOptions, leadDateFrom: e.target.value });
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (e.target.showPicker) {
                                                                e.target.showPicker();
                                                            }
                                                        }}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                                    />
                                                </div>
                                                <div 
                                                    className="cursor-pointer"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.querySelector('input[type="date"]');
                                                        if (input) {
                                                            if (input.showPicker) {
                                                                input.showPicker();
                                                            } else {
                                                                input.focus();
                                                                input.click();
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <label className="block text-gray-400 text-xs mb-1 cursor-pointer">To Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.leadDateTo}
                                                        onChange={(e) => {
                                                            setFilterOptions({ ...filterOptions, leadDateTo: e.target.value });
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (e.target.showPicker) {
                                                                e.target.showPicker();
                                                            }
                                                        }}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* File Sent to Login Date Filter */}
                                            <div className="mt-6">
                                                <h4 className="text-sm font-medium text-gray-300 mb-2">File Sent to Login Date Range</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div 
                                                        className="cursor-pointer"
                                                        onClick={(e) => {
                                                            const input = e.currentTarget.querySelector('input[type="date"]');
                                                            if (input) {
                                                                if (input.showPicker) {
                                                                    input.showPicker();
                                                                } else {
                                                                    input.focus();
                                                                    input.click();
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <label className="block text-gray-400 text-xs mb-1 cursor-pointer">From Date</label>
                                                        <input
                                                            type="date"
                                                            value={filterOptions.fileSentToLoginDateFrom}
                                                            onChange={(e) => {
                                                                setFilterOptions({ ...filterOptions, fileSentToLoginDateFrom: e.target.value });
                                                                setTimeout(() => triggerFilterUpdate(), 0);
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (e.target.showPicker) {
                                                                    e.target.showPicker();
                                                                }
                                                            }}
                                                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div 
                                                        className="cursor-pointer"
                                                        onClick={(e) => {
                                                            const input = e.currentTarget.querySelector('input[type="date"]');
                                                            if (input) {
                                                                if (input.showPicker) {
                                                                    input.showPicker();
                                                                } else {
                                                                    input.focus();
                                                                    input.click();
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <label className="block text-gray-400 text-xs mb-1 cursor-pointer">To Date</label>
                                                        <input
                                                            type="date"
                                                            value={filterOptions.fileSentToLoginDateTo}
                                                            onChange={(e) => {
                                                                setFilterOptions({ ...filterOptions, fileSentToLoginDateTo: e.target.value });
                                                                setTimeout(() => triggerFilterUpdate(), 0);
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (e.target.showPicker) {
                                                                    e.target.showPicker();
                                                                }
                                                            }}
                                                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Filter leads by when file was sent to login team
                                                </p>
                                            </div>
                                            
                                            {/* No Activity Date Filter */}
                                            <div className="mt-6">
                                                <h4 className="text-sm font-medium text-gray-300 mb-2">No Activity Since</h4>
                                                <div 
                                                    className="cursor-pointer"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.querySelector('input[type="date"]');
                                                        if (input) {
                                                            if (input.showPicker) {
                                                                input.showPicker();
                                                            } else {
                                                                input.focus();
                                                                input.click();
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <label className="block text-gray-400 text-xs mb-1 cursor-pointer">No Activity Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.noActivityDate}
                                                        onChange={(e) => {
                                                            setFilterOptions({ ...filterOptions, noActivityDate: e.target.value });
                                                            // Trigger backend API call for no activity filtering
                                                            setTimeout(() => {
                                                                loadLeads();
                                                                triggerFilterUpdate();
                                                            }, 0);
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (e.target.showPicker) {
                                                                e.target.showPicker();
                                                            }
                                                        }}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Show leads with no activity since this date
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <button
                                                onClick={() => {
                                                    setFilterOptions({ ...filterOptions, leadDateFrom: '', leadDateTo: '', noActivityDate: '', fileSentToLoginDateFrom: '', fileSentToLoginDateTo: '' });
                                                    setTimeout(() => triggerFilterUpdate(), 0);
                                                }}
                                                className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Clear Date Filters
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
                                                        onChange={(e) => {
                                                            setFilterOptions({ ...filterOptions, leadAgeFrom: e.target.value });
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">To Age (Days)</label>
                                                    <input
                                                        type="number"
                                                        value={filterOptions.leadAgeTo}
                                                        onChange={(e) => {
                                                            setFilterOptions({ ...filterOptions, leadAgeTo: e.target.value });
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="365"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setFilterOptions({ ...filterOptions, leadAgeFrom: '', leadAgeTo: '' });
                                                    setTimeout(() => triggerFilterUpdate(), 0);
                                                }}
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
                                                    <input
                                                        type="text"
                                                        placeholder="Search creators..."
                                                        value={createdBySearch}
                                                        onChange={(e) => setCreatedBySearch(e.target.value)}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    {createdBySearch && (
                                                        <button
                                                            onClick={() => setCreatedBySearch('')}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
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
                                                                
                                                                // Apply filter immediately for better UX
                                                                setTimeout(() => {
                                                                    triggerFilterUpdate();
                                                                }, 0);
                                                            }}
                                                            className="accent-blue-500 mr-2 cursor-pointer"
                                                        />
                                                        <span className="text-gray-300">{creator}</span>
                                                    </label>
                                                ))}
                                                {filteredCreators.length === 0 && createdBySearch && (
                                                    <div className="text-gray-500 text-sm py-2">No creators found matching "{createdBySearch}"</div>
                                                )}
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
                                                    <input
                                                        type="text"
                                                        placeholder="Search statuses..."
                                                        value={statusSearch}
                                                        onChange={(e) => setStatusSearch(e.target.value)}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    {statusSearch && (
                                                        <button
                                                            onClick={() => setStatusSearch('')}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
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
                                                            triggerFilterUpdate();
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
                                                            triggerFilterUpdate();
                                                        }, 0);
                                                    }}
                                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                                >
                                                    Select All Visible
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                                {/* Status info message */}
                                                {(!filterOptions.selectedStatuses || filterOptions.selectedStatuses.length === 0) && !filterOptions.fileSentToLogin && (
                                                    <div className="mb-3 p-2 bg-green-900/20 border border-green-700/30 rounded text-green-300 text-sm">
                                                        ✓ Showing all statuses (no filter applied)
                                                    </div>
                                                )}
                                                {((filterOptions.selectedStatuses && filterOptions.selectedStatuses.length > 0) || filterOptions.fileSentToLogin) && (
                                                    <div className="mb-3 p-2 bg-blue-900/20 border border-blue-700/30 rounded text-blue-300 text-sm">
                                                        📋 Filtering by {(filterOptions.selectedStatuses?.length || 0) + (filterOptions.fileSentToLogin ? 1 : 0)} selected status(es)
                                                    </div>
                                                )}
                                                
                                                {/* FILE SENT TO LOGIN Checkbox */}
                                                <div className="mb-4 p-3 border border-green-700/30 bg-green-900/10 rounded-lg">
                                                    <label className="flex items-center cursor-pointer font-medium">
                                                        <input
                                                            type="checkbox"
                                                            className="accent-green-500 mr-2 h-4 w-4 cursor-pointer"
                                                            checked={filterOptions.fileSentToLogin}
                                                            onChange={(e) => {
                                                                setFilterOptions({
                                                                    ...filterOptions,
                                                                    fileSentToLogin: e.target.checked
                                                                });
                                                                
                                                                // Apply filter immediately
                                                                setTimeout(() => {
                                                                    triggerFilterUpdate();
                                                                }, 0);
                                                            }}
                                                        />
                                                        <div>
                                                            <span className="text-green-400">FILE SENT TO LOGIN</span>
                                                        </div>
                                                    </label>
                                                </div>
                                                
                                                {Object.keys(getFilteredStatuses()).length > 0 ? (
                                                    Object.keys(getFilteredStatuses()).map(parentStatus => (
                                                        <div key={parentStatus} className="mb-4">
                                                            {/* Parent Status */}
                                                            <label className="flex items-center cursor-pointer font-medium text-blue-300 mb-2">
                                                                <input
                                                                    type="checkbox"
                                                                    className="accent-blue-500 mr-2 cursor-pointer"
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
                                                                            triggerFilterUpdate();
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
                                                                                    className="accent-blue-500 mr-2 cursor-pointer"
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
                                                                                            triggerFilterUpdate();
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
                                                    <input
                                                        type="text"
                                                        placeholder="Search teams..."
                                                        value={teamNameSearch}
                                                        onChange={(e) => setTeamNameSearch(e.target.value)}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    {teamNameSearch && (
                                                        <button
                                                            onClick={() => setTeamNameSearch('')}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
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
                                                                
                                                                // Apply filter immediately for better UX
                                                                setTimeout(() => {
                                                                    triggerFilterUpdate();
                                                                }, 0);
                                                            }}
                                                            className="accent-blue-500 mr-2 cursor-pointer"
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
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Assigned</h3>
                                            
                                            {/* Search bar */}
                                            <div className="mb-4">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search TLs..."
                                                        value={assignedTLSearch}
                                                        onChange={(e) => setAssignedTLSearch(e.target.value)}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    {assignedTLSearch && (
                                                        <button
                                                            onClick={() => setAssignedTLSearch('')}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                {loadingEmployees ? (
                                                    <div className="text-gray-500 text-sm py-2 flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                        Loading team leaders...
                                                    </div>
                                                ) : (
                                                    getFilteredAssignedTL().map((tl) => (
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
                                                                    console.log('🎯 TL Filter UI Changed:', {
                                                                        checked: e.target.checked,
                                                                        value: e.target.value,
                                                                        newValues: newValues,
                                                                        oldValues: currentValues
                                                                    });
                                                                    setFilterOptions({ ...filterOptions, assignedTL: newValues });
                                                                    
                                                                    // Apply filter immediately for better UX
                                                                    setTimeout(() => {
                                                                        console.log('🎯 Triggering TL filter update...');
                                                                        triggerFilterUpdate();
                                                                    }, 0);
                                                                }}
                                                                className="accent-blue-500 mr-2 cursor-pointer"
                                                            />
                                                            <span className="text-gray-300">{tl}</span>
                                                        </label>
                                                    ))
                                                )}
                                                {!loadingEmployees && getFilteredAssignedTL().length === 0 && assignedTLSearch && (
                                                    <div className="text-gray-500 text-sm py-2">No team leaders found matching "{assignedTLSearch}"</div>
                                                )}
                                                {!loadingEmployees && getFilteredAssignedTL().length === 0 && !assignedTLSearch && (
                                                    <div className="text-gray-500 text-sm py-2">No team leaders available</div>
                                                )}
                                            </div>
                                        </div>
                                    )}



                                    {/* Lead Activity Filter */}
                                    {selectedFilterCategory === 'leadActivity' && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Filters</h3>
                                            <div className="space-y-4">
                                                {/* Check Duplicate Leads */}
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={filterOptions.checkDuplicateLeads || false}
                                                        onChange={(e) => {
                                                            console.log('Duplicate filter checkbox clicked:', e.target.checked);
                                                            const newOptions = { 
                                                                ...filterOptions, 
                                                                checkDuplicateLeads: e.target.checked
                                                            };
                                                            console.log('New filter options:', newOptions);
                                                            setFilterOptions(newOptions);
                                                            setTimeout(() => {
                                                                triggerFilterUpdate();
                                                            }, 0);
                                                        }}
                                                        className="accent-blue-500 mr-2 cursor-pointer"
                                                    />
                                                    <span className="text-gray-300">Check Duplicate Leads</span>
                                                </label>
                                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                                    Show leads with same phone number or alternative phone number
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Total Income Filter */}
                                    {selectedFilterCategory === 'totalIncome' && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Total Income Filter</h3>
                                            
                                            {/* Income Range Section */}
                                            <div className="mb-6">
                                                <h4 className="text-sm font-medium text-gray-300 mb-2">Income Range</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-gray-400 text-xs mb-1">Minimum Income</label>
                                                        <input
                                                            type="number"
                                                            placeholder="e.g. 25000"
                                                            value={filterOptions.totalIncomeFrom}
                                                            onChange={(e) => {
                                                                const newValue = e.target.value;
                                                                console.log('💰 Income Filter FROM changed:', newValue);
                                                                
                                                                // Update filter options immediately for UI responsiveness
                                                                const newFilterOptions = { 
                                                                    ...filterOptions, 
                                                                    totalIncomeFrom: newValue 
                                                                };
                                                                setFilterOptions(newFilterOptions);
                                                                
                                                                // Trigger filter update with a small delay to prevent excessive updates
                                                                setTimeout(() => {
                                                                    console.log('💰 Triggering filter update for income FROM filter');
                                                                    triggerFilterUpdate();
                                                                }, 100);
                                                            }}
                                                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-xs mb-1">Maximum Income</label>
                                                        <input
                                                            type="number"
                                                            placeholder="e.g. 100000"
                                                            value={filterOptions.totalIncomeTo}
                                                            onChange={(e) => {
                                                                const newValue = e.target.value;
                                                                console.log('💰 Income Filter TO changed:', newValue);
                                                                
                                                                // Update filter options immediately for UI responsiveness
                                                                const newFilterOptions = { 
                                                                    ...filterOptions, 
                                                                    totalIncomeTo: newValue 
                                                                };
                                                                setFilterOptions(newFilterOptions);
                                                                
                                                                // Trigger filter update with a small delay to prevent excessive updates
                                                                setTimeout(() => {
                                                                    console.log('💰 Triggering filter update for income TO filter');
                                                                    triggerFilterUpdate();
                                                                }, 100);
                                                            }}
                                                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Filter leads within the specified income range
                                                </p>
                                            </div>

                                            {/* Sorting Section */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-300 mb-2">Income Sorting</h4>
                                                <div className="space-y-3">
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="totalIncomeSort"
                                                            checked={filterOptions.totalIncomeSort === 'highest'}
                                                            onChange={() => {
                                                                const newOptions = { 
                                                                    ...filterOptions, 
                                                                    totalIncomeSort: 'highest'
                                                                };
                                                                setFilterOptions(newOptions);
                                                                setTimeout(() => {
                                                                    triggerFilterUpdate();
                                                                }, 0);
                                                            }}
                                                            className="accent-blue-500 mr-2"
                                                        />
                                                        <span className="text-gray-300">Highest to Lowest</span>
                                                    </label>
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="totalIncomeSort"
                                                            checked={filterOptions.totalIncomeSort === 'lowest'}
                                                            onChange={() => {
                                                                const newOptions = { 
                                                                    ...filterOptions, 
                                                                    totalIncomeSort: 'lowest'
                                                                };
                                                                setFilterOptions(newOptions);
                                                                setTimeout(() => {
                                                                    triggerFilterUpdate();
                                                                }, 0);
                                                            }}
                                                            className="accent-blue-500 mr-2"
                                                        />
                                                        <span className="text-gray-300">Lowest to Highest</span>
                                                    </label>
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="totalIncomeSort"
                                                            checked={filterOptions.totalIncomeSort === ''}
                                                            onChange={() => {
                                                                const newOptions = { 
                                                                    ...filterOptions, 
                                                                    totalIncomeSort: ''
                                                                };
                                                                setFilterOptions(newOptions);
                                                                setTimeout(() => {
                                                                    triggerFilterUpdate();
                                                                }, 0);
                                                            }}
                                                            className="accent-blue-500 mr-2"
                                                        />
                                                        <span className="text-gray-300">No Sorting</span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        Sort filtered leads by their total income amount
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Filter Actions */}
                        
                        <div className="flex justify-between gap-[250px] items-center mt-6 pt-4 border-t border-gray-600">
                            <button
                                onClick={() => {
                                    // Clear all filters - reset to completely empty state
                                    setFilterOptions({
                                        leadDateFrom: '',
                                        leadDateTo: '',
                                        leadAgeFrom: '',
                                        leadAgeTo: '',
                                        createdBy: [],
                                        leadParentStatus: [],
                                        leadAllStatus: [],
                                        teamName: [],
                                        assignedTL: [],
                                        noActivityFrom: '',
                                        noActivityTo: '',
                                        noActivity: false,
                                        noActivityDate: '',
                                        selectedStatuses: [],
                                        loanTypeFilter: [],
                                        fileSentToLogin: false,
                                        checkDuplicateLeads: false,
                                        fileSentToLoginDateFrom: '',
                                        fileSentToLoginDateTo: '',
                                        totalIncomeSort: '',
                                        totalIncomeFrom: '',
                                        totalIncomeTo: ''
                                    });
                                    // Clear search states
                                    clearFilterSearchTerms();
                                    // Increment filter revision to force useMemo re-computation
                                    setFilterRevision(prev => prev + 1);
                                }}
                                className="px-6 py-2  bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
                            >
                                Clear all filter
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowFilterPopup(false);
                                        clearFilterSearchTerms();
                                    }}
                                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowFilterPopup(false);
                                        clearFilterSearchTerms();
                                        // Increment filter revision to force useMemo re-computation
                                        setFilterRevision(prev => prev + 1);
                                    }}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Change Popup */}
            {showStatusChangePopup && (
                <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg p-6 w-[400px] max-w-[90vw]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">Status Updated</h2>
                            <button
                                onClick={() => setShowStatusChangePopup(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="text-center">
                            <div className="mb-4">
                                <p className="text-gray-300 mb-2">Custom Lead ID:</p>
                                <p className="text-cyan-400 font-bold text-lg">{statusChangeInfo.customLeadId}</p>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-300 mb-2">Status changed to:</p>
                                <p className="text-green-400 font-bold text-lg">{typeof statusChangeInfo.newStatus === 'object' ? statusChangeInfo.newStatus.name : statusChangeInfo.newStatus}</p>
                            </div>

                            <button
                                onClick={() => setShowStatusChangePopup(false)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            </div>
        </div>
    );
});

export default LeadCRM;