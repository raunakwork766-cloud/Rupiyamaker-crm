import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import {
    Card,
    Table,
    Button,
    Select,
    Input,
    Space,
    Tag,
    Modal,
    Form,
    Checkbox,
    message,
    Typography,
    Row,
    Col,
    Divider,
    DatePicker,
    InputNumber,
    Dropdown,
    Menu,
    Tabs
} from 'antd';

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

// Query Parameter Handler for Direct Login View
// This code runs immediately when the component is loaded
(() => {
  try {
    // Get the current URL and parse query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const leadId = urlParams.get('lead_id');
    
    if (leadId) {
      console.log('LoginCRM: Direct login view requested for ID:', leadId);
      
      // Store the lead ID in sessionStorage so it persists during component mounting
      sessionStorage.setItem('directViewLoginId', leadId);
      
      // Remove the query parameter to prevent infinite loops on reload
      // but keep the history clean
      if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  } catch (error) {
    console.error('Error handling lead_id query parameter:', error);
  }
})();

// ⚡ PERFORMANCE: Lazy load heavy components to reduce initial bundle size
const LeadDetails = lazy(() => import('./LeadDetails'));
const OperationsSection = lazy(() => import('./sections/OperationsSection'));

// Import components for detailed lead view
import { 
    AboutSection,
    HowToProcessSection,
    TaskComponent,
    RemarkSection,
    LeadActivity,
    Attachments,
    ObligationSection,
    ImportantQuestionsSection,
    LoginFormSection,
    CopyLeadSection,
    LazySection
} from './LazyLeadSections';
import { 
  getUserPermissions, 
  isSuperAdmin, 
  hasPermission,
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId 
} from '../utils/permissions';
import {
    SearchOutlined,
    FilterOutlined,
    EyeOutlined,
    EditOutlined,
    UserOutlined,
    TeamOutlined,
    PlusOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    DollarOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined,
    QuestionCircleOutlined,
    MoreOutlined
} from '@ant-design/icons';

// Import Lucide icons for dark mode UI
import {
    Users,
    CheckCircle,
    DollarSign,
    AlertTriangle,
    XCircle,
    FileText,
    Copy,
    MessageSquare,
    CheckSquare,
    Paperclip,
    Search as SearchIcon,
    Filter,
    Plus,
    Eye,
    Edit,
    Trash2,
    User,
    Building,
    CreditCard,
    UserCheck,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Settings,
    X,
    Square,
    Edit2,
    ListTodo,
    Calendar,
    Clock,
    RefreshCw
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import dayjs from 'dayjs';
import { leadsService } from '../services/leadsService';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

const { Option } = Select;
const { Search } = Input;
const { Title, Text } = Typography;
const { confirm } = Modal;
const { TabPane } = Tabs;

// Status card configuration for dark UI
// Static status card configuration - fallback hardcoded values
const statusCardConfig = [
    {
        key: "Active Login",
        label: "ACTIVE LOGIN",
        icon: Users,
        gradient: "from-blue-500 to-cyan-400",
        shadowColor: "shadow-blue-500/25",
    },
    {
        key: "Approve",
        label: "APPROVED",
        icon: CheckCircle,
        gradient: "from-green-500 to-emerald-400",
        shadowColor: "shadow-green-500/25",
    },
    {
        key: "Disbursed",
        label: "DISBURSED",
        icon: DollarSign,
        gradient: "from-purple-500 to-violet-400",
        shadowColor: "shadow-purple-500/25",
    },
    {
        key: "Lost by Mistake",
        label: "LOST BY MISTAKE",
        icon: AlertTriangle,
        gradient: "from-orange-500 to-amber-400",
        shadowColor: "shadow-orange-500/25",
    },
    {
        key: "Lost Login",
        label: "LOST LOGIN",
        icon: XCircle,
        gradient: "from-red-500 to-pink-400",
        shadowColor: "shadow-red-500/25",
    },
];

// Helper function for currency rendering
const renderCurrency = (value) => {
    // Handle undefined, null, empty string or zero
    if (value === undefined || value === null || value === '') return '-';
    if (value === 0) return '₹0';

    // Handle both string and number types
    let numValue;
    
    try {
        if (typeof value === 'string') {
            // Remove any non-numeric characters except decimal point
            const cleanedStr = value.replace(/[^\d.-]/g, '');
            numValue = parseFloat(cleanedStr);
        } else {
            numValue = parseFloat(value);
        }
        
        // If we have a valid number, format it with commas
        if (!isNaN(numValue)) {
            return `₹${numValue.toLocaleString()}`;
        }
    } catch (error) {
    }

    // Fallback for any other case
    return '-';
};

// Helper function to get field value from lead with dynamic_fields fallback
const getLeadField = (lead, fieldName) => {
    if (!lead) return '';

    // Special field mappings based on the actual data structure
    switch (fieldName) {
        case 'customer_name':
            // Try multiple name sources
            if (lead.first_name || lead.last_name) {
                return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
            }
            return lead.customer_name || lead.name || '';

        case 'login_date':
            // Use login_date (set when lead is transferred to login), fallback to other dates
            return lead.login_date || lead.login_created_at || lead.login_department_sent_date || lead.created_date || lead.created_at || '';

        case 'creator_name':
            return lead.created_by_name || lead.creator_name || '';

        case 'team_name':
            return lead.department_name || lead.team_name || '';

        case 'salary':
            // Check financial_details for monthly_income
            if (lead.dynamic_fields?.financial_details?.monthly_income) {
                return lead.dynamic_fields.financial_details.monthly_income;
            }
            return lead.salary || lead.monthly_income || '';

        case 'total_income':
            // Check financial_details for total_income first, then monthly_income
            if (lead.dynamic_fields?.financial_details?.total_income) {
                return lead.dynamic_fields.financial_details.total_income;
            }
            if (lead.dynamic_fields?.financial_details?.monthly_income) {
                return lead.dynamic_fields.financial_details.monthly_income;
            }
            // Fallback to direct fields
            return lead.total_income || lead.salary || lead.monthly_income || '';

        case 'cibil_score':
            // Check financial_details for cibil_score
            if (lead.dynamic_fields?.financial_details?.cibil_score) {
                return lead.dynamic_fields.financial_details.cibil_score;
            }
            return lead.cibil_score || '';

        case 'city':
            // Check address structure
            if (lead.dynamic_fields?.address?.city) {
                return lead.dynamic_fields.address.city;
            }
            return lead.city || '';

        case 'pincode':
            // Check address structure for pincode
            if (lead.dynamic_fields?.address?.pincode) {
                return lead.dynamic_fields.address.pincode;
            }
            if (lead.dynamic_fields?.address?.postal_code) {
                return lead.dynamic_fields.address.postal_code;
            }
            return lead.pincode || '';

        case 'company_name':
            // Check personal_details for company_name
            if (lead.dynamic_fields?.personal_details?.company_name) {
                return lead.dynamic_fields.personal_details.company_name;
            }
            return lead.company_name || '';

        case 'company_category':
            // Check personal_details for company_category (array)
            if (lead.dynamic_fields?.personal_details?.company_category) {
                const category = lead.dynamic_fields.personal_details.company_category;
                return Array.isArray(category) ? category.join(', ') : category;
            }
            return lead.company_category || '';

        case 'loan_eligibility':
            // Check eligibility_details for finalEligibility
            if (lead.dynamic_fields?.eligibility_details?.finalEligibility) {
                return lead.dynamic_fields.eligibility_details.finalEligibility;
            }
            // Also check check_eligibility
            if (lead.dynamic_fields?.check_eligibility?.loan_eligibility_status) {
                return lead.dynamic_fields.check_eligibility.loan_eligibility_status;
            }
            return lead.loan_eligibility || lead.eligibility || '';

        case 'amount_approved':
            return lead.operations_amount_approved || lead.amount_approved || '';

        case 'foir_eligibility':
        case 'foir':
            // Check eligibility_details for finalEligibility (FOIR Eligibility is stored as finalEligibility in backend)
            if (lead.dynamic_fields?.eligibility_details?.finalEligibility) {
                return lead.dynamic_fields.eligibility_details.finalEligibility;
            }
            // Also check for final_eligibility (snake_case variant)
            if (lead.dynamic_fields?.eligibility_details?.final_eligibility) {
                return lead.dynamic_fields.eligibility_details.final_eligibility;
            }
            // Check for foir_eligibility variant
            if (lead.dynamic_fields?.eligibility_details?.foir_eligibility) {
                return lead.dynamic_fields.eligibility_details.foir_eligibility;
            }
            // Check eligibility object
            if (lead.dynamic_fields?.eligibility?.finalEligibility) {
                return lead.dynamic_fields.eligibility.finalEligibility;
            }
            if (lead.dynamic_fields?.eligibility?.final_eligibility) {
                return lead.dynamic_fields.eligibility.final_eligibility;
            }
            // Check root level eligibility fields
            if (lead.eligibility?.finalEligibility) {
                return lead.eligibility.finalEligibility;
            }
            if (lead.eligibility?.final_eligibility) {
                return lead.eligibility.final_eligibility;
            }
            // Fallback to direct fields
            return lead.foir_eligibility || lead.final_eligibility || lead.foir || '';

        case 'net_disbursement_amount':
            // Map to net_disbursement_amount field
            return lead.net_disbursement_amount || lead.operations_net_disbursement_amount || '';

        default:
            // First check if it exists directly in lead
            if (lead[fieldName] !== undefined && lead[fieldName] !== '') {
                return lead[fieldName];
            }

            // Then check in dynamic_fields
            if (lead.dynamic_fields && lead.dynamic_fields[fieldName] !== undefined && lead.dynamic_fields[fieldName] !== '') {
                return lead.dynamic_fields[fieldName];
            }

            return '';
    }
};



const LoginCRM = ({ user, selectedLoanType: initialLoanType, department = "login" }) => {
    // CSS styles for sticky headers and smooth animations
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
        
        /* Smooth animations for filter popup */
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
        }
        
        /* Smooth scrollbar for filter popup */
        .filter-scroll::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        
        .filter-scroll::-webkit-scrollbar-track {
            background: #1f2937;
            border-radius: 4px;
        }
        
        .filter-scroll::-webkit-scrollbar-thumb {
            background: #4b5563;
            border-radius: 4px;
            transition: background 0.2s;
        }
        
        .filter-scroll::-webkit-scrollbar-thumb:hover {
            background: #6b7280;
        }
    `;

    // Ensure login department context is set
    useEffect(() => {
        localStorage.setItem('userDepartment', 'login');
    }, []);

    // ⚡ PERFORMANCE: Initialize permissions from cache immediately
    const [permissions, setPermissions] = useState(() => {
        try {
            const cached = localStorage.getItem('userPermissions');
            return cached ? JSON.parse(cached) : {};
        } catch {
            return {};
        }
    });
    const [permissionsLoading, setPermissionsLoading] = useState(false); // Start false since we have cache
    const [isUserSuperAdmin, setIsUserSuperAdmin] = useState(() => {
        try {
            const cached = localStorage.getItem('userPermissions');
            if (cached) {
                const perms = JSON.parse(cached);
                return Array.isArray(perms) 
                    ? perms.some(p => p.page === '*' && (p.actions === '*' || (Array.isArray(p.actions) && p.actions.includes('*'))))
                    : false;
            }
        } catch {
            return false;
        }
        return false;
    });
    
    const userId = localStorage.getItem('userId');
    
    // Permission helper functions - Updated to support super admin and case variations
    const hasLoginPermission = (permission) => {
        // Get permissions from localStorage/API
        const userPermissions = getUserPermissions();
        
        // First try the standard permission checker
        if (hasPermission(userPermissions, 'login', permission)) {
            return true;
        }
        
        // Handle the database array format if standard checker fails
        if (Array.isArray(userPermissions)) {
            // Find the login page permission object
            const loginPerm = userPermissions.find(perm => perm.page === 'login');
            
            if (loginPerm) {
                // Check if user has the specific permission
                if (Array.isArray(loginPerm.actions)) {
                    return loginPerm.actions.includes(permission) || loginPerm.actions.includes('*');
                } else if (loginPerm.actions === '*') {
                    return true;
                }
            }
        }
        
        // Handle potential object format
        if (userPermissions && typeof userPermissions === 'object' && !Array.isArray(userPermissions)) {
            // Check for super admin permissions
            if (userPermissions['*'] === '*' || 
                userPermissions['Global'] === '*' || 
                userPermissions['global'] === '*' ||
                (userPermissions['pages'] === '*' && userPermissions['actions'] === '*')) {
                return true;
            }
            
            // Check login-specific permissions
            const loginUpper = userPermissions['Login'];
            const loginLower = userPermissions['login'];
            
            if (loginUpper === '*' || loginLower === '*') {
                return true;
            }
            
            if (Array.isArray(loginUpper) && loginUpper.includes(permission)) {
                return true;
            }
            
            if (Array.isArray(loginLower) && loginLower.includes(permission)) {
                return true;
            }
        }
        
        return false;
    };
    
    const canShowLogin = () => hasLoginPermission('show');
    const canViewOwnLogin = () => hasLoginPermission('own');
    const canViewOtherLogin = () => hasLoginPermission('view_other');
    const canViewAllLogin = () => hasLoginPermission('all');
    const canDeleteLogin = () => hasLoginPermission('delete');
    const canViewJuniorLogin = () => hasLoginPermission('junior');
    const canEditLogin = () => hasLoginPermission('edit');
    
    // Check if user is super admin (has page * and action * permissions)
    const checkSuperAdmin = (perms) => {
        // Handle array format from database
        if (Array.isArray(perms)) {
            return perms.some(perm => 
                perm.page === '*' && (perm.actions === '*' || 
                (Array.isArray(perm.actions) && perm.actions.includes('*')))
            );
        }
        
        // Handle object format (legacy)
        return (perms['pages'] === '*' && perms['actions'] === '*') || 
               perms['Global'] === '*' || 
               perms['global'] === '*';
    };
    
    // Load user permissions
    const loadPermissions = async () => {
        try {
            // First try to get permissions from localStorage
            const storedPermissions = localStorage.getItem('userPermissions');
            if (storedPermissions) {
                const parsedPermissions = JSON.parse(storedPermissions);
                setPermissions(parsedPermissions);
                setIsUserSuperAdmin(checkSuperAdmin(parsedPermissions));
                setPermissionsLoading(false);
                return;
            }
            
            // Fallback to API if localStorage is empty
            const response = await fetch(`${API_BASE_URL}/users/permissions/${userId}`);
            const data = await response.json();
            
            // The API returns permissions directly as an array, not wrapped in an object
            const apiPermissions = Array.isArray(data) ? data : (data.permissions || data || []);
            
            // Store permissions in localStorage for getUserPermissions() to use
            localStorage.setItem('userPermissions', JSON.stringify(apiPermissions));
            
            setPermissions(apiPermissions);
            setIsUserSuperAdmin(checkSuperAdmin(apiPermissions));
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setPermissionsLoading(false);
        }
    };
    
    // ⚡ PERFORMANCE: Defer permissions loading to not block initial render
    useEffect(() => {
        // Load permissions after initial render
        setTimeout(() => {
            loadPermissions();
        }, 0);
    }, [userId]);

    // ⚡ PERFORMANCE: Defer status loading to not block initial render
    useEffect(() => {
        if (!loadingStatuses && !statusesLoadedRef.current) {
            // Load statuses after component is visible
            setTimeout(() => {
                statusesLoadedRef.current = true;
                loadStatusesAndSubStatuses();
            }, 100);
        }
    }, []);

    // Get the selected loan type from localStorage (set by Sidebar) or from props
    const [selectedLoanType, setSelectedLoanType] = useState(() => {
        // Only use loginCrmLoanTypeId for Login CRM
        return initialLoanType || localStorage.getItem('loginCrmLoanTypeId') || 'all';
    });
    
    // Listen for loan type changes from sidebar specifically for Login CRM
    useEffect(() => {
        const handleLoginCrmLoanTypeChange = (event) => {
            const { loanTypeId, loanTypeName, cleanLoanTypeName } = event.detail;
            
            // Use the loan type ID for filtering - this is the most reliable way
            // as it directly matches the database records
            setSelectedLoanType(loanTypeId);
            
            // Store both the display name (with "Login") and the clean name for filtering
            if (cleanLoanTypeName) {
                localStorage.setItem('loginCrmCleanLoanTypeName', cleanLoanTypeName);
            }
        };

        // Listen for the Login CRM specific event
        window.addEventListener('loginCrmLoanTypeChanged', handleLoginCrmLoanTypeChange);
        
        // Only check for Login CRM specific loan type in localStorage
        const savedLoginCrmLoanType = localStorage.getItem('loginCrmLoanTypeId');
        
        if (savedLoginCrmLoanType) {
            setSelectedLoanType(savedLoginCrmLoanType);
        }
        // Do not fall back to general loan type - only use Login CRM specific one
        
        return () => {
            window.removeEventListener('loginCrmLoanTypeChanged', handleLoginCrmLoanTypeChange);
        };
    }, []);

    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showingCachedData, setShowingCachedData] = useState(false);
    
    // Pagination for display (initial 50, then load 100 more)
    const [displayedCount, setDisplayedCount] = useState(50);
    const INITIAL_LOAD = 50;
    const LOAD_MORE_COUNT = 100;
    
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    // ⚡ PERFORMANCE: Debounced search term to prevent excessive filtering  
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedLead, setSelectedLead] = useState(null);
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [operationsVisible, setOperationsVisible] = useState(false);
    const [questionsVisible, setQuestionsVisible] = useState(false);
    const [assignmentVisible, setAssignmentVisible] = useState(false);
    const [bulkAssignmentVisible, setBulkAssignmentVisible] = useState(false);
    const [leadDetailsVisible, setLeadDetailsVisible] = useState(false);
    const [showLeadDetails, setShowLeadDetails] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [openSection, setOpenSection] = useState(0);
    
    // Bank options state for dynamic dropdown
    const [bankOptions, setBankOptions] = useState(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]); // Default banks, will be fetched from backend
    
    // Add employees state for filters - separate states for different purposes
    const [employees, setEmployees] = useState([]); // Team leaders for Assigned TL filter
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    
    // All employees for Login Department filter
    const [allEmployees, setAllEmployees] = useState([]);
    const [loadingAllEmployees, setLoadingAllEmployees] = useState(false);
    
    // Teams data for Team Name filter - using assignment API
    const [teams, setTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    
    // Table horizontal scroll states
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const tableScrollRef = useRef(null);
    
    // Unsaved changes tracking for ObligationSection
    const [hasUnsavedObligationChanges, setHasUnsavedObligationChanges] = useState(false);
    const [showObligationUnsavedModal, setShowObligationUnsavedModal] = useState(false);
    const [pendingTabChange, setPendingTabChange] = useState(null);
    const [obligationModalTrigger, setObligationModalTrigger] = useState(null);
    
    const [users, setUsers] = useState([]);
    const [juniorUsers, setJuniorUsers] = useState([]);
    const [loanTypes, setLoanTypes] = useState([]);
    const [importantQuestions, setImportantQuestions] = useState([]);
    const [questionResponses, setQuestionResponses] = useState({});
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [checkboxVisible, setCheckboxVisible] = useState(false);
    const [checkedRows, setCheckedRows] = useState([]);
    // State variables for status and sub-status editing
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [newSubStatus, setNewSubStatus] = useState('');
    const [availableSubStatuses, setAvailableSubStatuses] = useState([]);

    // Status dropdown states (for in-table dropdown like LeadCRM)
    const [showStatusDropdown, setShowStatusDropdown] = useState(null); // Track which row's dropdown is open
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, maxHeight: 400 });
    const [statusSearchTerm, setStatusSearchTerm] = useState('');
    
    // State for hierarchical dropdown navigation
    const [selectedMainStatus, setSelectedMainStatus] = useState(null); // Track which main status is selected in dropdown
    const [showMainStatuses, setShowMainStatuses] = useState(true); // Toggle between main statuses and sub-statuses view
    
    // Status data from API (start with empty arrays to force API loading)
    const [allStatuses, setAllStatuses] = useState([]);
    const [allSubStatuses, setAllSubStatuses] = useState([]);
    const [statusHierarchy, setStatusHierarchy] = useState({});
    const [subStatusToMainStatus, setSubStatusToMainStatus] = useState({});
    const [loadingStatuses, setLoadingStatuses] = useState(false);
    const statusesLoadedRef = useRef(false); // Track if statuses have been loaded to prevent multiple API calls

    // Loading states for secondary data
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);
    const [isFilteringActivity, setIsFilteringActivity] = useState(false);

    // Auto-save state management for lead details
    const [pendingSaves, setPendingSaves] = useState({});
    const [saveTimeouts, setSaveTimeouts] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    
    // State for collapsible sections in lead details view - default all collapsed except About section
    const [collapsedSections, setCollapsedSections] = useState({
        '0-1': true, // Login Operations collapsed
        '0-2': true, // How to Process collapsed  
        '0-3': true, // APPLICANT FORM collapsed
        '0-4': true, // Important Questions collapsed
    });

    // Validation function to check if lead still exists
    const validateLeadExists = async (leadId) => {
        try {
            const userId = localStorage.getItem('userId');
            // IMPORTANT: Check login leads endpoint, not main leads
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${leadId}?user_id=${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('Error validating login lead existence:', error);
            return false;
        }
    };

    // Enhanced auto-save function with better error handling and validation
    const performAutoSave = async (field, value, skipSuccessMessage = false) => {
        if (!selectedLead) return;
        
        // Validate that the lead still exists before attempting to update
        const leadExists = await validateLeadExists(selectedLead._id);
        if (!leadExists) {
            console.error('Lead validation failed - lead does not exist:', selectedLead._id);
            message.warning('⚠️ This lead no longer exists. Refreshing the list...');
            setSelectedLead(null);
            setShowLeadDetails(false);
            fetchLoginDepartmentLeads();
            return;
        }
        
        try {
            setIsSaving(true);
            const userId = localStorage.getItem('userId');
            // IMPORTANT: Use login leads endpoint, not main leads endpoint
            const apiUrl = `/api/lead-login/login-leads/${selectedLead._id}?user_id=${userId}`;
            
            console.log('performAutoSave called:', {
                field,
                value,
                leadId: selectedLead._id,
                apiUrl
            });
            
            // Prepare the update data based on field type
            let updateData = {};
            
            if (field === "co_applicant_form" || field === "applicant_form") {
                updateData = {
                    dynamic_fields: {
                        ...selectedLead.dynamic_fields,
                        [field]: value
                    }
                };
            } else {
                updateData = { [field]: value };
            }
            
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updateData)
            });
            
            console.log('Auto-save response:', {
                status: response.status,
                ok: response.ok,
                leadId: selectedLead._id
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.error('Lead not found during auto-save:', selectedLead._id);
                    message.warning('⚠️ This lead may have been deleted. Please refresh the page.');
                    
                    // Clear the selected lead since it doesn't exist
                    setSelectedLead(null);
                    setShowLeadDetails(false);
                    
                    // Refresh the leads list
                    fetchLoginDepartmentLeads();
                    return;
                }
                
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            // Clear from pending saves
            setPendingSaves(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
            
            const result = await response.json();
            console.log('Auto-save successful:', {
                leadId: selectedLead._id,
                field,
                result
            });
            
            // Update the selected lead with the response data if available
            if (result && result._id) {
                setSelectedLead(result);
                
                // Update the lead in the leads list as well
                setLeads(prevLeads => 
                    prevLeads.map(lead => 
                        lead._id === result._id ? result : lead
                    )
                );
            }
            
            // Optional: Show success feedback
            if (!skipSuccessMessage) {
                message.success('✅ Changes saved successfully', 1);
            }
            
        } catch (error) {
            console.error('Error performing auto-save:', error);
            
            if (error.message.includes('404')) {
                message.error('⚠️ Lead not found. It may have been deleted.');
                setSelectedLead(null);
                setShowLeadDetails(false);
                fetchLoginDepartmentLeads();
                return;
            } else if (error.message.includes('403')) {
                message.error('🔒 You do not have permission to edit this lead');
            } else if (error.message.includes('401')) {
                message.error('🔐 Session expired. Please login again.');
            } else {
                message.error(`❌ Failed to save ${field}: ${error.message}`);
            }
            
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
        } finally {
            setIsSaving(false);
        }
    };
    
    // Function to update lead fields with debounced auto-save functionality
    const handleSelectedLeadFieldChange = (field, value, skipSuccessMessage = false, saveDelay = 2000) => {
        if (!selectedLead) return;
        
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
            } else {
                // For other fields, set directly
                updated[field] = value;
            }
            
            return updated;
        });
        
        // Also update the leads array immediately
        setLeads(leads => 
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
                    })
                } : l
            )
        );
        
        // Mark as pending save
        setPendingSaves(prev => ({ ...prev, [field]: value }));
        
        // Clear existing timeout for this field
        if (saveTimeouts[field]) {
            clearTimeout(saveTimeouts[field]);
        }
        
        // Set new timeout for auto-save (only if saveDelay > 0)
        if (saveDelay > 0) {
            const newTimeout = setTimeout(() => {
                performAutoSave(field, value, skipSuccessMessage);
            }, saveDelay);
            
            setSaveTimeouts(prev => ({ ...prev, [field]: newTimeout }));
        } else {
            // Immediate save for special cases
            performAutoSave(field, value, skipSuccessMessage);
        }
    };
    
    // Function to force save on field blur (when user moves focus away)
    const handleFieldBlur = (field) => {
        // If there's a pending save for this field, save immediately
        if (pendingSaves[field] !== undefined) {
            // Clear the timeout
            if (saveTimeouts[field]) {
                clearTimeout(saveTimeouts[field]);
                setSaveTimeouts(prev => {
                    const updated = { ...prev };
                    delete updated[field];
                    return updated;
                });
            }
            
            // Perform immediate save
            performAutoSave(field, pendingSaves[field], true);
        }
    };
    
    // Enhanced version for form sections that need blur handling
    const handleSelectedLeadFieldChangeWithBlur = (field, value, skipSuccessMessage = false) => {
        // Use the regular change handler with a longer delay
        handleSelectedLeadFieldChange(field, value, skipSuccessMessage, 3000);
        
        // Return blur handler for the field
        return () => handleFieldBlur(field);
    };
    
    // Cleanup timeouts on component unmount or lead change
    useEffect(() => {
        return () => {
            Object.values(saveTimeouts).forEach(timeout => {
                if (timeout) clearTimeout(timeout);
            });
        };
    }, [selectedLead?._id, saveTimeouts]);
    
    // Save all pending changes when lead details is closed
    useEffect(() => {
        if (!showLeadDetails && Object.keys(pendingSaves).length > 0) {
            // Save any pending changes when lead details closes
            Object.entries(pendingSaves).forEach(([field, value]) => {
                performAutoSave(field, value, true);
            });
        }
    }, [showLeadDetails, pendingSaves]);

    // Filter popup states
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState('leadDate');

    // Search states for filter options
    const [teamNameSearch, setTeamNameSearch] = useState('');
    const [createdBySearch, setCreatedBySearch] = useState('');
    const [statusSearch, setStatusSearch] = useState('');
    const [assignedTLSearch, setAssignedTLSearch] = useState('');
    const [campaignNameSearch, setCampaignNameSearch] = useState('');
    const [loginDepartmentSearch, setLoginDepartmentSearch] = useState('');
    const [channelNameSearch, setChannelNameSearch] = useState('');

    // Clear search states when filter popup is closed or category changes
    const clearSearchStates = () => {
        setTeamNameSearch('');
        setCreatedBySearch('');
        setStatusSearch('');
        setAssignedTLSearch('');
        setCampaignNameSearch('');
        setLoginDepartmentSearch('');
        setChannelNameSearch('');
    };

    // Enhanced filter management
    const [filterRevision, setFilterRevision] = useState(0);
    
    // Helper function to trigger filter recalculation
    const triggerFilterUpdate = () => {
        setFilterRevision(prev => prev + 1);
        setDisplayedItemsCount(50); // Reset pagination if it exists
    };

    const [filterOptions, setFilterOptions] = useState({
        leadStatus: '',
        dateFrom: '', // No default date filter
        dateTo: '',   // No default date filter
        noActivityDate: '', // Date Filters - no activity date filter
        selectedStatuses: [], // Empty array means show all statuses - Combined status filtering
        fileSentToLogin: false, // Enhanced: File sent to login checkbox filter
        checkDuplicateLeads: false, // Quick Filters - duplicate leads filter
        disbursementDateFrom: '', // Date Filters - disbursement date from
        disbursementDateTo: '', // Date Filters - disbursement date to
        
        // Enhanced date filters
        leadDateFrom: '', // Lead date range filter (from)
        leadDateTo: '', // Lead date range filter (to)
        fileSentToLoginDateFrom: '', // File sent to login date range (from)
        fileSentToLoginDateTo: '', // File sent to login date range (to)
        
        // Enhanced filter options (arrays for multiple selection)
        teamName: [], // Changed to array for multiple team selection
        createdBy: [], // Changed to array for multiple creator selection
        assignedTL: [], // Changed to array for multiple TL selection
        loanTypeFilter: [], // Loan type filter
        campaignName: [], // Changed to array for multiple campaign selection
        loginDepartment: [], // Login person/department filter
        channelName: [], // Channel name filter from leads.channel_name
        incomeRangeFrom: '', // Income range filter from
        incomeRangeTo: '', // Income range filter to
        incomeSortOrder: '' // Income sort order: 'asc', 'desc', or ''
    });

    // Calculate status counts from leads data
    const calculateStatusCounts = (leadsData, loanTypeFilter = null) => {
        const counts = {
            "Active Login": 0,
            "Approve": 0,
            "Disbursed": 0,
            "Lost by Mistake": 0,
            "Lost Login": 0
        };

        // Ensure leadsData is an array before processing
        if (Array.isArray(leadsData)) {
            let filteredLeads = leadsData;

            // Apply loan type filter if specified - using same logic as main filtering
            if (loanTypeFilter && loanTypeFilter !== 'all') {
                filteredLeads = leadsData.filter(lead => {
                    // Check for exact match on loan_type_id first (most reliable)
                    if (lead.loan_type_id === loanTypeFilter) {
                        return true;
                    }
                    
                    // Get the clean loan type name (without "Login" suffix) from localStorage
                    const cleanLoanTypeName = localStorage.getItem('loginCrmCleanLoanTypeName');
                    
                    // If we have a clean name, use it for comparison
                    if (cleanLoanTypeName && 
                        (lead.loan_type === cleanLoanTypeName || 
                         lead.loan_type_name === cleanLoanTypeName)) {
                        return true;
                    }
                    
                    // Legacy check using the stored name
                    const effectiveSelectedLoanType = typeof loanTypeFilter === 'string' ? 
                        loanTypeFilter.replace(" Login", "") : 
                        loanTypeFilter;
                    
                    // Check for exact match on name fields
                    if (lead.loan_type === effectiveSelectedLoanType || lead.loan_type_name === effectiveSelectedLoanType) {
                        return true;
                    }
                    
                    // For PL & OD (ID: 68595a524cec3069a38501e6)
                    if (loanTypeFilter === "68595a524cec3069a38501e6" && 
                        (lead.loan_type === "PL & OD" || lead.loan_type_name === "PL & OD")) {
                        return true;
                    }
                    
                    // For Home Loan (ID: 68595a524cec3069a38501e5)
                    if (loanTypeFilter === "68595a524cec3069a38501e5" && 
                        (lead.loan_type === "Home Loan" || lead.loan_type_name === "Home Loan")) {
                        return true;
                    }

                    return false;
                });
            }

            filteredLeads.forEach((lead, index) => {
                // Count leads by status
                if (counts.hasOwnProperty(lead.status)) {
                    counts[lead.status]++;
                } else {
                    // Handle variations in status naming (case-insensitive)
                    const lowerStatus = lead.status?.toLowerCase();
                    if (lowerStatus === 'active login') {
                        counts["Active Login"]++;
                    } else if (lowerStatus === 'approve' || lowerStatus === 'approved') {
                        counts["Approve"]++;
                    } else if (lowerStatus === 'disbursed' || lowerStatus === 'disbursement') {
                        counts["Disbursed"]++;
                    } else if (lowerStatus === 'lost by mistake' || lowerStatus === 'lost by mistake') {
                        counts["Lost by Mistake"]++;
                    } else if (lowerStatus === 'lost login' || lowerStatus === 'lost leads' || lowerStatus === 'lost lead') {
                        counts["Lost Login"]++;
                    } else {
                        // Default to "Active Login" for unknown statuses in login department
                        counts["Active Login"]++;
                    }
                }
            });
        }

        return counts;
    };

    // Status counts for status cards
    const [statusCounts, setStatusCounts] = useState({
        "Active Login": 0,
        "Approve": 0,
        "Disbursed": 0,
        "Lost by Mistake": 0,
        "Lost Login": 0
    });

    // ⚡ PERFORMANCE: Memoized status counts calculation based on filtered data
    const memoizedStatusCounts = useMemo(() => {
        const counts = {
            "Active Login": 0,
            "Approve": 0,
            "Disbursed": 0,
            "Lost by Mistake": 0,
            "Lost Login": 0
        };

        // Use the same filtering logic as filterLeads to ensure consistency
        let filtered = Array.isArray(leads) ? [...leads] : [];

        // Apply same filters as main filtering
        if (selectedLoanType !== 'all') {
            filtered = filtered.filter(lead => {
                if (lead.loan_type_id === selectedLoanType) return true;
                
                const cleanLoanTypeName = localStorage.getItem('loginCrmCleanLoanTypeName');
                if (cleanLoanTypeName && 
                    (lead.loan_type === cleanLoanTypeName || lead.loan_type_name === cleanLoanTypeName)) {
                    return true;
                }
                
                const effectiveSelectedLoanType = typeof selectedLoanType === 'string' ? 
                    selectedLoanType.replace(" Login", "") : selectedLoanType;
                
                if (lead.loan_type === effectiveSelectedLoanType || lead.loan_type_name === effectiveSelectedLoanType) {
                    return true;
                }
                
                if (selectedLoanType === "68595a524cec3069a38501e6" && 
                    (lead.loan_type === "PL & OD" || lead.loan_type_name === "PL & OD")) {
                    return true;
                }
                
                if (selectedLoanType === "68595a524cec3069a38501e5" && 
                    (lead.loan_type === "Home Loan" || lead.loan_type_name === "Home Loan")) {
                    return true;
                }
                
                return false;
            });
        }

        if (selectedStatus !== 'all') {
            filtered = filtered.filter(lead => lead.status === selectedStatus);
        }

        // Apply filter options with same logic as main filtering
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(lead =>
                (lead.name && lead.name.toLowerCase().includes(searchLower)) ||
                (lead.phone && lead.phone.toString().includes(searchLower)) ||
                (lead.mobile_number && lead.mobile_number.toString().includes(searchLower)) ||
                (lead.email && lead.email.toLowerCase().includes(searchLower))
            );
        }

        // Apply enhanced filters
        filtered = filtered.filter(lead => {
            const leadDate = new Date(lead.login_date);
            
            // Date range filter
            let dateInRange = true;
            if (filterOptions.dateFrom && filterOptions.dateFrom.trim() !== '') {
                const dateFrom = new Date(filterOptions.dateFrom);
                dateInRange = dateInRange && leadDate >= dateFrom;
            }
            if (filterOptions.dateTo && filterOptions.dateTo.trim() !== '') {
                const dateTo = new Date(filterOptions.dateTo);
                dateInRange = dateInRange && leadDate <= dateTo;
            }

            // Enhanced combined status filtering
            const hasFileSentToLoginFilter = filterOptions.fileSentToLogin;
            const hasStatusFilters = filterOptions.selectedStatuses && filterOptions.selectedStatuses.length > 0;
            
            let statusMatch = true;
            if (hasFileSentToLoginFilter || hasStatusFilters) {
                let matches = false;
                
                if (hasFileSentToLoginFilter && lead.file_sent_to_login === true) {
                    matches = true;
                }
                
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
                
                statusMatch = matches;
            } else {
                statusMatch = (!filterOptions.leadStatus || lead.status === filterOptions.leadStatus);
            }

            // Disbursement date filter
            let disbursementDateMatch = true;
            if (filterOptions.disbursementDateFrom || filterOptions.disbursementDateTo) {
                const disbursementDate = lead.disbursement_date ? new Date(lead.disbursement_date) : null;
                
                if (disbursementDate) {
                    if (filterOptions.disbursementDateFrom && filterOptions.disbursementDateFrom.trim() !== '') {
                        const dateFrom = new Date(filterOptions.disbursementDateFrom);
                        disbursementDateMatch = disbursementDateMatch && disbursementDate >= dateFrom;
                    }
                    if (filterOptions.disbursementDateTo && filterOptions.disbursementDateTo.trim() !== '') {
                        const dateTo = new Date(filterOptions.disbursementDateTo);
                        dateTo.setHours(23, 59, 59, 999);
                        disbursementDateMatch = disbursementDateMatch && disbursementDate <= dateTo;
                    }
                } else {
                    disbursementDateMatch = false;
                }
            }

            // Enhanced filters with array support
            const teamMatch = (!filterOptions.teamName?.length || filterOptions.teamName.includes(lead.team_name));
            const campaignMatch = (!filterOptions.campaignName?.length || filterOptions.campaignName.includes(lead.operations_channel_name));
            const createdByMatch = (!filterOptions.createdBy?.length || filterOptions.createdBy.includes(lead.creator_name));
            const assignedTLMatch = (!filterOptions.assignedTL?.length || filterOptions.assignedTL.includes(lead.assigned_tl_name));
            const loginDepartmentMatch = (!filterOptions.loginDepartment?.length || filterOptions.loginDepartment.includes(lead.creator_name) || filterOptions.loginDepartment.includes(lead.department_name) || filterOptions.loginDepartment.includes(lead.team_name));
            const channelMatch = (!filterOptions.channelName?.length || filterOptions.channelName.includes(lead.channel_name || lead.campaign_name));

            // Income filter - Enhanced to use total_income field like the table column
            let incomeMatch = true;
            if (filterOptions.incomeRangeFrom || filterOptions.incomeRangeTo) {
                // Use the same logic as the table column: total_income first, then salary
                const totalIncome = getLeadField(lead, 'total_income') || getLeadField(lead, 'salary');
                const leadIncome = parseFloat(totalIncome) || 0;
                
                const minIncome = filterOptions.incomeRangeFrom ? parseFloat(filterOptions.incomeRangeFrom) : 0;
                const maxIncome = filterOptions.incomeRangeTo ? parseFloat(filterOptions.incomeRangeTo) : Infinity;
                
                // Debug logging for income filter
                if (leadIncome > 0) {
                    console.log(`💰 Income Filter - Lead: ${lead.customer_name || 'Unknown'}, Income: ${leadIncome}, Range: ${minIncome}-${maxIncome}, Match: ${leadIncome >= minIncome && leadIncome <= maxIncome}`);
                }
                
                // Apply income range filter
                incomeMatch = leadIncome >= minIncome && leadIncome <= maxIncome;
            }

            return statusMatch && dateInRange && disbursementDateMatch && teamMatch && campaignMatch && createdByMatch && assignedTLMatch && loginDepartmentMatch && channelMatch && incomeMatch;
        });

        // Apply duplicate filter with enhanced algorithm
        if (filterOptions.checkDuplicateLeads) {
            const normalizePhone = (phone) => {
                if (!phone) return null;
                const normalized = phone.toString().replace(/\D/g, '');
                return normalized.length >= 10 ? normalized : null;
            };
            
            const phoneMap = new Map();
            
            filtered.forEach(lead => {
                // Get all phone numbers from this lead and remove duplicates within the same lead
                const allPhones = [
                    normalizePhone(lead.mobile_number),
                    normalizePhone(lead.phone),
                    normalizePhone(lead.alternative_phone),
                    normalizePhone(lead.alt_phone_number)
                ].filter(p => p !== null);
                
                // Remove duplicates within the same lead using Set
                const uniquePhonesFromThisLead = [...new Set(allPhones)];
                
                // Add each unique phone from this lead to the map
                uniquePhonesFromThisLead.forEach(phone => {
                    if (!phoneMap.has(phone)) {
                        phoneMap.set(phone, []);
                    }
                    phoneMap.get(phone).push(lead);
                });
            });
            
            const duplicatePhones = new Set();
            phoneMap.forEach((leads, phone) => {
                if (leads.length > 1) {
                    duplicatePhones.add(phone);
                }
            });
            
            if (duplicatePhones.size === 0) {
                filtered = [];
            } else {
                filtered = filtered.filter(lead => {
                    // Get all phone numbers from this lead and remove duplicates within the same lead
                    const allPhones = [
                        normalizePhone(lead.mobile_number),
                        normalizePhone(lead.phone),
                        normalizePhone(lead.alternative_phone),
                        normalizePhone(lead.alt_phone_number)
                    ].filter(p => p !== null);
                    
                    // Remove duplicates within the same lead using Set
                    const uniquePhonesFromThisLead = [...new Set(allPhones)];
                    
                    return uniquePhonesFromThisLead.some(phone => duplicatePhones.has(phone));
                });
            }
        }

        // Now count the statuses from the filtered data
        filtered.forEach(lead => {
            if (counts.hasOwnProperty(lead.status)) {
                counts[lead.status]++;
            } else {
                const lowerStatus = lead.status?.toLowerCase();
                if (lowerStatus === 'active login') {
                    counts["Active Login"]++;
                } else if (lowerStatus === 'approve' || lowerStatus === 'approved') {
                    counts["Approve"]++;
                } else if (lowerStatus === 'disbursed' || lowerStatus === 'disbursement') {
                    counts["Disbursed"]++;
                } else if (lowerStatus === 'lost by mistake' || lowerStatus === 'lost by mistake') {
                    counts["Lost by Mistake"]++;
                } else if (lowerStatus === 'lost login' || lowerStatus === 'lost leads' || lowerStatus === 'lost lead') {
                    counts["Lost Login"]++;
                } else {
                    counts["Active Login"]++;
                }
            }
        });

        return counts;
    }, [leads, selectedLoanType, selectedStatus, searchTerm, filterOptions, filterRevision]);

    const [operationsForm] = Form.useForm();
    const [assignmentForm] = Form.useForm();
    const [bulkAssignmentForm] = Form.useForm();

    // Dynamic status options from API - uses loadStatusesAndSubStatuses data
    const getStatusOptions = () => {
        // Create options from API data with 'All Status' as first option
        const dynamicOptions = [{ value: 'all', label: 'All Status' }];
        
        // Add main statuses from API data
        if (allStatuses.length > 0) {
            allStatuses.forEach(status => {
                dynamicOptions.push({ value: status, label: status });
            });
        } else {
            // Fallback to hardcoded values if API data not loaded yet
            ['Active Login', 'Approve', 'Disbursed', 'Lost by Mistake', 'Lost Login'].forEach(status => {
                dynamicOptions.push({ value: status, label: status });
            });
        }
        
        return dynamicOptions;
    };

    // Status options for login department (now dynamic)
    const statusOptions = getStatusOptions();

    // Get unique teams and creators dynamically from the data
    const getUniqueTeams = () => {
        // Use teams from assignment API (departments) instead of lead data for consistency
        if (teams && teams.length > 0) {
            console.log('Debug: Teams from assignment API:', teams);
            return teams.sort();
        }
        // Fallback to lead data if teams not loaded yet
        console.log('Debug: No teams loaded from assignment API, falling back to lead data');
        return [...new Set(leads.map(lead => lead.team_name).filter(Boolean))].sort();
    };

    const getUniqueCreators = () => {
        return [...new Set(leads.map(lead => lead.creator_name).filter(Boolean))].sort();
    };

    const getUniqueAssignedTLs = () => {
        // Use employees from API (team leaders) instead of lead data
        if (employees && employees.length > 0) {
            return employees.map(emp => {
                // Use name or construct from first_name + last_name
                return emp.name || (emp.first_name && emp.last_name 
                    ? `${emp.first_name} ${emp.last_name}`.trim()
                    : emp.first_name || emp.last_name || 'Unknown');
            }).filter(Boolean).sort();
        }
        // Fallback to lead data if employees not loaded yet
        return [...new Set(leads.map(lead => lead.assigned_tl_name || lead.assignedTL).filter(Boolean))].sort();
    };

    const getUniqueLoginDepartments = () => {
        // Filter users from login department using same logic as OperationsSection.jsx
        if (allEmployees && allEmployees.length > 0) {
            console.log('Debug: All users from assignment API:', allEmployees);
            
            // Filter to show only users from login department - same logic as OperationsSection
            const loginDepartmentUsers = allEmployees.filter(user => {
                const userDepartment = user.department_name || user.department || '';
                const isLoginDept = userDepartment.toLowerCase().includes('login');
                
                console.log(`User: ${user.name || user.first_name || user.username}`, {
                    department: userDepartment,
                    isLoginDept: isLoginDept
                });
                
                return isLoginDept;
            });

            console.log('Debug: Filtered login department users:', loginDepartmentUsers);
            
            // Extract names using same logic as OperationsSection
            const loginUserNames = loginDepartmentUsers.map(user => {
                return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.id;
            }).filter(name => name && name.trim());

            const uniqueNames = [...new Set(loginUserNames)].sort();
            console.log('Debug: Final login department user names:', uniqueNames);
            
            return uniqueNames;
        }

        // Fallback to lead data if users not loaded
        console.log('Debug: No users loaded from assignment API, falling back to lead data');
        const departments = new Set();
        leads.forEach(lead => {
            if (lead.creator_name) departments.add(lead.creator_name);
            if (lead.department_name) departments.add(lead.department_name);
            if (lead.team_name) departments.add(lead.team_name);
        });
        return [...departments].filter(Boolean).sort();
    };

    // Filtered functions for search functionality
    const getFilteredTeams = () => {
        const teams = getUniqueTeams();
        return teams.filter(team => 
            team.toLowerCase().includes(teamNameSearch.toLowerCase())
        );
    };

    const getFilteredCreators = () => {
        const creators = getUniqueCreators();
        return creators.filter(creator => 
            creator.toLowerCase().includes(createdBySearch.toLowerCase())
        );
    };

    const getFilteredAssignedTLs = () => {
        const tls = getUniqueAssignedTLs();
        return tls.filter(tl => 
            tl.toLowerCase().includes(assignedTLSearch.toLowerCase())
        );
    };

    const getFilteredLoginDepartments = () => {
        const departments = getUniqueLoginDepartments();
        return departments.filter(department => 
            department.toLowerCase().includes(loginDepartmentSearch.toLowerCase())
        );
    };

    const getFilteredCampaigns = () => {
        const campaigns = [...new Set(leads.map(lead => lead.operations_channel_name).filter(Boolean))].sort();
        return campaigns.filter(campaign => 
            campaign.toLowerCase().includes(campaignNameSearch.toLowerCase())
        );
    };

    const getFilteredChannels = () => {
        // Get unique channel names - prefer channel_name field, fall back to campaign_name
        const channels = [...new Set(leads.map(lead => {
            return lead.channel_name || lead.campaign_name;
        }).filter(Boolean))].sort();
        return channels.filter(channel => 
            channel.toLowerCase().includes(channelNameSearch.toLowerCase())
        );
    };

    const getFilteredStatuses = () => {
        if (!statusSearch.trim()) {
            return statusHierarchy;
        }
        
        const filtered = {};
        Object.keys(statusHierarchy).forEach(parentStatus => {
            const parentMatches = parentStatus.toLowerCase().includes(statusSearch.toLowerCase());
            const filteredSubStatuses = statusHierarchy[parentStatus]?.filter(subStatus => {
                const statusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                return statusName && statusName.toLowerCase().includes(statusSearch.toLowerCase());
            }) || [];
            
            if (parentMatches || filteredSubStatuses.length > 0) {
                filtered[parentStatus] = parentMatches ? statusHierarchy[parentStatus] : filteredSubStatuses;
            }
        });
        
        return filtered;
    };

    // Count active filters
    const getActiveFilterCount = () => {
        let count = 0;
        if (filterOptions.leadStatus) count++;
        if (filterOptions.dateFrom || filterOptions.dateTo) count++;
        if (filterOptions.teamName?.length > 0) count++;
        if (filterOptions.campaignName?.length > 0) count++;
        if (filterOptions.createdBy?.length > 0) count++;
        if (filterOptions.assignedTL?.length > 0) count++;
        if (filterOptions.selectedStatuses?.length > 0) count++;
        if (filterOptions.fileSentToLogin) count++;
        if (filterOptions.checkDuplicateLeads) count++;
        if (filterOptions.disbursementDateFrom || filterOptions.disbursementDateTo) count++;
        if (filterOptions.leadDateFrom || filterOptions.leadDateTo) count++;
        if (filterOptions.fileSentToLoginDateFrom || filterOptions.fileSentToLoginDateTo) count++;
        if (filterOptions.noActivityDate) count++;
        if (filterOptions.loanTypeFilter?.length > 0) count++;
        // Add income filter counting
        if (filterOptions.incomeRangeFrom || filterOptions.incomeRangeTo) {
            count++;
            console.log('🔢 Income Range Filter Active:', filterOptions.incomeRangeFrom, '-', filterOptions.incomeRangeTo);
        }
        if (filterOptions.incomeSortOrder) {
            count++;
            console.log('📊 Income Sort Filter Active:', filterOptions.incomeSortOrder);
        }
        // Add other missing filters
        if (filterOptions.loginDepartment?.length > 0) count++;
        if (filterOptions.channelName?.length > 0) count++;
        
        console.log('🎯 Total Active Filters:', count);
        return count;
    };

    // Get filter count for specific category
    const getFilterCategoryCount = (category) => {
        switch (category) {
            case 'leadDate':
                let leadDateCount = 0;
                if (filterOptions.dateFrom || filterOptions.dateTo) leadDateCount++;
                if (filterOptions.disbursementDateFrom || filterOptions.disbursementDateTo) leadDateCount++;
                if (filterOptions.leadDateFrom || filterOptions.leadDateTo) leadDateCount++;
                if (filterOptions.fileSentToLoginDateFrom || filterOptions.fileSentToLoginDateTo) leadDateCount++;
                if (filterOptions.noActivityDate) leadDateCount++;
                return leadDateCount;
            case 'leads':
                return filterOptions.leadStatus ? 1 : 0;
            case 'date':
                return 0; // For Login Age - placeholder
            case 'team':
                return filterOptions.teamName?.length || 0;
            case 'createdBy':
                return filterOptions.createdBy?.length || 0;
            case 'leadActivity':
                // Count duplicate leads and file sent to login filters
                let activityCount = 0;
                if (filterOptions.checkDuplicateLeads) activityCount++;
                if (filterOptions.fileSentToLogin) activityCount++;
                return activityCount;
            case 'status':
                return filterOptions.selectedStatuses?.length || 0;
            case 'assignedTL':
                return filterOptions.assignedTL?.length || 0;
            case 'loginDepartment':
                return filterOptions.loginDepartment?.length || 0;
            case 'channelName':
                return filterOptions.channelName?.length || 0;
            case 'other':
                return filterOptions.campaignName?.length || 0;
            case 'income':
                let incomeCount = 0;
                if (filterOptions.incomeRangeFrom || filterOptions.incomeRangeTo) incomeCount++;
                if (filterOptions.incomeSortOrder) incomeCount++;
                return incomeCount;
            default:
                return 0;
        }
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

    // Update scroll buttons when table content changes
    useEffect(() => {
        updateScrollButtons();
    }, [filteredLeads]);

    useEffect(() => {
        // ⚡ ULTRA PERFORMANCE: Instant UI + aggressive parallel loading
        
        // Check localStorage on component mount first
        const handleStorageChange = () => {
            const newLoanType = localStorage.getItem('loginCrmLoanTypeId') || 'all';
            setSelectedLoanType(newLoanType);
        };
        handleStorageChange();
        
        // Start loading immediately - don't wait for anything
        const loadData = async () => {
            // Start all critical requests in parallel
            const promises = [
                fetchLoginDepartmentLeads(),
                fetchLoanTypes(),
            ];
            
            try {
                await Promise.all(promises);
                console.log('✅ Initial data loaded successfully');
            } catch (error) {
                console.error('❌ Error in initial load:', error);
            }
        };
        
        // Execute immediately
        loadData();

        // Create custom event listener for cross-tab communication
        window.addEventListener('storage', handleStorageChange);

        // Cleanup
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // ⚡ ULTRA FAST: Load secondary data in optimized batches
    useEffect(() => {
        // Start loading secondary data as soon as leads start appearing
        if (leads.length > 0 && !loading) {
            // Batch 1: Immediate critical data (no delay)
            setTimeout(async () => {
                await Promise.all([
                    fetchBankOptions(),
                    fetchUsers(),
                ]).catch(err => console.warn('Batch 1 error:', err));
            }, 0);
            
            // Batch 2: Important data (500ms delay)
            setTimeout(async () => {
                await Promise.all([
                    fetchEmployees(),
                    fetchJuniorUsers(),
                ]).catch(err => console.warn('Batch 2 error:', err));
            }, 500);
            
            // Batch 3: Nice-to-have data (1000ms delay)
            setTimeout(async () => {
                await Promise.all([
                    fetchImportantQuestions(),
                    fetchLoginDepartmentUsers(),
                    fetchTeams()
                ]).catch(err => console.warn('Batch 3 error:', err));
            }, 1000);
        }
    }, [leads.length, loading]);

    // ⚡ ULTRA FAST: Prefetch data when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // Check if cache is stale when user returns to tab
                const userId = localStorage.getItem('userId');
                const cacheKey = `logincrm_leads_${userId}_${selectedStatus}_${selectedLoanType}`;
                const cacheTimeKey = `${cacheKey}_time`;
                const cacheTime = localStorage.getItem(cacheTimeKey);
                
                if (cacheTime) {
                    const cacheAge = Date.now() - parseInt(cacheTime);
                    // Refresh if cache is older than 2 minutes
                    if (cacheAge > 120000) {
                        console.log('🔄 Cache stale, refreshing data...');
                        fetchLoginDepartmentLeads();
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [selectedStatus, selectedLoanType]);

    // Effect for filtering leads when any filter changes
    // NOTE: Filtering is handled automatically by the filteredLeadsData useMemo
    // This effect is removed to avoid circular dependency issues
    // The filtering happens automatically when leads, selectedLoanType, selectedStatus,
    // debouncedSearchTerm, filterOptions, or filterRevision change

    // ⚡ PERFORMANCE: Removed duplicate fetchLoginDepartmentLeads - now only triggered by selectedLoanType change
    // Refetch leads when selected loan type changes
    useEffect(() => {
        if (selectedLoanType) {
            fetchLoginDepartmentLeads();
        }
    }, [selectedLoanType]);

    // Effect to handle clicks outside status dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showStatusDropdown !== null && 
                !event.target.closest('.status-dropdown-container') &&
                !event.target.closest('.status-dropdown-button') &&
                !event.target.closest('.status-dropdown-menu')) {
                setShowStatusDropdown(null);
            }
        };

        const handleKeyDown = (event) => {
            if (showStatusDropdown !== null) {
                if (event.key === 'Escape') {
                    setShowStatusDropdown(null);
                }
            }
        };

        const handleScroll = (event) => {
            if (showStatusDropdown !== null) {
                // Check if the scroll target is within the dropdown
                const target = event.target;
                const isDropdownScroll = target.closest('.status-dropdown-container') || 
                                       target.closest('.status-dropdown-menu') ||
                                       target.classList.contains('status-dropdown-container') ||
                                       target.classList.contains('status-dropdown-menu');
                
                // Only close dropdown if scroll is NOT within the dropdown container
                if (!isDropdownScroll) {
                    setShowStatusDropdown(null);
                    setSelectedMainStatus(null);
                    setShowMainStatuses(true);
                    setStatusSearchTerm('');
                }
            }
        };

        if (showStatusDropdown !== null) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
            // Listen to scroll events on the document and window
            document.addEventListener('scroll', handleScroll, true);
            window.addEventListener('scroll', handleScroll, true);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [showStatusDropdown]);

    // Function to handle viewing a lead by ID - used by direct navigation from query parameters
    const handleViewLead = async (leadId) => {
        if (!leadId) {
            console.error('LoginCRM: No lead ID provided for direct view');
            return;
        }
        
        try {
            const userId = localStorage.getItem('userId');
            // Fetch the specific login lead by ID
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${leadId}?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch lead with ID ${leadId}`);
            }
            
            const leadData = await response.json();
            
            // Set the selected lead and show lead details
            setSelectedLead(leadData);
            setShowLeadDetails(true);
            
            return leadData;
        } catch (error) {
            console.error(`LoginCRM: Error fetching lead for direct view:`, error);
            message.error(`Could not load lead details: ${error.message}`);
            throw error;
        }
    };

    // Force refresh with cache clearing - use after critical operations like delete/copy
    const forceRefreshLoginLeads = async () => {
        console.log('🔄 Force refreshing leads with cache clearing...');
        setClearingCache(true);
        setShowingCachedData(false);
        
        try {
            const userId = localStorage.getItem('userId');
            const cacheKey = `logincrm_leads_${userId}_${selectedStatus}_${selectedLoanType}`;
            const cacheTimeKey = `${cacheKey}_time`;
            
            // Clear localStorage cache
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimeKey);
            console.log('💾 LocalStorage cache cleared');
            
            // Clear browser cache API
            if ('caches' in window) {
                try {
                    await caches.delete('api-cache');
                    console.log('🗑️ Browser cache cleared');
                } catch (error) {
                    console.warn('Failed to clear browser cache:', error);
                }
            }
            
            // Clear component state
            setLeads([]);
            
            // Force refresh with immediate execution (skip cache check)
            await fetchLoginDepartmentLeads();
            
            // Show success message
            message.success('✅ Data refreshed with cache cleared', 2);
            
        } catch (error) {
            console.error('Error during force refresh:', error);
            message.error('❌ Failed to refresh data');
        } finally {
            setClearingCache(false);
        }
    };

    // Effect to refetch leads when no activity filter changes
    useEffect(() => {
        // Only trigger when component is fully mounted and filter value changes meaningfully
        if (leads.length > 0 || filterOptions.noActivityDate) {
            fetchLoginDepartmentLeads();
        }
    }, [filterOptions.noActivityDate]);

    // ⚡ PERFORMANCE: Memoize fetchLoginDepartmentLeads with useCallback
    const fetchLoginDepartmentLeads = useCallback(async () => {
        // Check for direct view request from query parameter
        const directViewLoginId = sessionStorage.getItem('directViewLoginId');
        if (directViewLoginId) {
            // ⚡ PERFORMANCE: Only log in development
            if (process.env.NODE_ENV === 'development') {
                console.log('LoginCRM: Found direct view lead ID in session storage:', directViewLoginId);
            }
            // Remove from session storage to prevent repeated processing
            sessionStorage.removeItem('directViewLoginId');
            
            // Open the lead details directly
            try {
                await handleViewLead(directViewLoginId);
                if (process.env.NODE_ENV === 'development') {
                    console.log('LoginCRM: Direct lead view initiated successfully');
                }
            } catch (error) {
                console.error('LoginCRM: Failed to open direct lead view:', error);
            }
        }
        
        const userId = localStorage.getItem('userId');
        const params = new URLSearchParams({
            user_id: userId
        });

        if (selectedStatus !== 'all') {
            params.append('status_filter', selectedStatus);
        }

        // Add loan type filter parameter if a specific loan type is selected
        if (selectedLoanType !== 'all') {
            params.append('loan_type', selectedLoanType);
        }

        // Add no_activity_date parameter if filter is active
        if (filterOptions.noActivityDate && filterOptions.noActivityDate.trim() !== '') {
            params.append('no_activity_date', filterOptions.noActivityDate);
        }

        // ⚡ CACHE KEY for stale-while-revalidate strategy
        const cacheKey = `logincrm_leads_${userId}_${selectedStatus}_${selectedLoanType}`;
        const cacheTimeKey = `${cacheKey}_time`;
        
        // ⚡ ULTRA FAST: Show cached data IMMEDIATELY (Stale-While-Revalidate)
        try {
            const cachedData = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheTimeKey);
            
            if (cachedData && cacheTime) {
                const parsedData = JSON.parse(cachedData);
                const cacheAge = Date.now() - parseInt(cacheTime);
                
                // Show cached data if less than 5 minutes old (increased from 60s)
                if (cacheAge < 300000 && parsedData.length > 0) {
                    console.log('⚡ Showing cached leads instantly (age:', Math.round(cacheAge/1000), 'seconds)');
                    setLeads(parsedData);
                    setShowingCachedData(true);
                    setLoading(false);
                    
                    // If cache is fresh (< 30 seconds), skip background refresh
                    if (cacheAge < 30000) {
                        console.log('✅ Cache is very fresh, skipping background refresh');
                        return; // Don't fetch if cache is super fresh
                    }
                    // Continue to fetch fresh data in background for older cache
                }
            }
        } catch (cacheError) {
            console.warn('Cache read error:', cacheError);
        }
        
        // Always set loading for fresh data fetch
        setLoading(true);
        
        // Set filtering activity state when no activity date filter is active
        if (filterOptions.noActivityDate && filterOptions.noActivityDate.trim() !== '') {
            setIsFilteringActivity(true);
        }
        
        try {
            // ⚡ ULTRA FAST: Optimized timeout and fetch settings
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
            
            const fetchStartTime = Date.now();

            const response = await fetch(`${API_BASE_URL}/lead-login/login-department-leads?${params}`, {
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                    'Priority': 'high', // Request priority hint
                    'Accept-Encoding': 'gzip, deflate, br', // Request compression
                },
                // ⚡ Performance hints for faster fetch
                keepalive: true,
                mode: 'cors',
                credentials: 'include',
            });
            
            clearTimeout(timeoutId);
            const fetchDuration = Date.now() - fetchStartTime;
            
            if (fetchDuration > 3000) {
                console.warn(`⚠️ Slow API response: ${fetchDuration}ms`);
            } else {
                console.log(`✅ API responded in ${fetchDuration}ms`);
            }

            if (response.ok) {
                const data = await response.json();
                const fetchedLeads = data.leads || [];
                
                console.log(`📊 Received ${fetchedLeads.length} leads from API`);
                
                // ⚡ CACHE THE RESULTS for instant next load
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(fetchedLeads));
                    localStorage.setItem(cacheTimeKey, Date.now().toString());
                    console.log('💾 Cached leads for next load');
                } catch (cacheError) {
                    console.warn('Failed to cache leads:', cacheError);
                }
                
                // ⚡ Just set the leads directly - much faster
                setLeads(fetchedLeads);
                setShowingCachedData(false); // Now showing fresh data
                // No need to call filterLeads here as it will be called by the useEffect when leads change
            } else {
                console.error(`❌ API error: ${response.status}`);
                message.error(`Failed to fetch leads. Status: ${response.status}`);
                // Don't clear leads if we have cached data
                if (leads.length === 0) {
                    setLeads([]);
                    setFilteredLeads([]);
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('⏱️ API request timeout after 15 seconds');
                message.error('Request timeout. Please check your connection and try again.');
            } else {
                console.error('❌ API error:', error);
                message.error(`Error fetching leads: ${error.message}`);
            }
            // Don't clear leads if we have cached data showing
            if (leads.length === 0) {
                setLeads([]);
                setFilteredLeads([]);
            }
        } finally {
            setLoading(false);
            setIsFilteringActivity(false);
        }
    }, [selectedStatus, selectedLoanType, filterOptions.noActivityDate, leads.length]); // Dependencies for useCallback

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            
            // ⚡ PERFORMANCE: Check cache first (10 minute cache)
            const cacheKey = 'logincrm_users';
            const cacheTimeKey = 'logincrm_users_time';
            const cachedData = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheTimeKey);
            
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
            
            if (cachedData && cacheTime && parseInt(cacheTime) > tenMinutesAgo) {
                const data = JSON.parse(cachedData);
                setUsers(data);
                setLoadingUsers(false);
                return;
            }
            
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${API_BASE_URL}/users/all-users?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const users = data.users || [];
                setUsers(users);
                
                // ⚡ Cache the result
                localStorage.setItem(cacheKey, JSON.stringify(users));
                localStorage.setItem(cacheTimeKey, Date.now().toString());
            } else if (response.status === 404) {
                console.warn('Users API endpoint not found - setting empty users list');
                setUsers([]);
            } else {
                console.error(`Failed to fetch users: ${response.status}`);
                setUsers([]);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Fetch junior users (users under current user's hierarchy)
    const fetchJuniorUsers = async () => {
        try {
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${API_BASE_URL}/lead-login/junior-users?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setJuniorUsers(data.users || []);
            } else {
                // Fallback to all users if junior users endpoint fails
                setJuniorUsers(users);
            }
        } catch (error) {
            // Fallback to all users
            setJuniorUsers(users);
        }
    };

    const fetchLoanTypes = async () => {
        try {
            setLoadingLoanTypes(true);
            
            // ⚡ PERFORMANCE: Check cache first (15 minute cache)
            const cacheKey = 'logincrm_loan_types';
            const cacheTimeKey = 'logincrm_loan_types_time';
            const cachedData = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheTimeKey);
            
            const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
            
            if (cachedData && cacheTime && parseInt(cacheTime) > fifteenMinutesAgo) {
                const data = JSON.parse(cachedData);
                setLoanTypes(data);
                setLoadingLoanTypes(false);
                return;
            }
            
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${API_BASE_URL}/loan-types?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const loanTypesData = data.items || data.loan_types || data || [];

                // Add "All Loan Types" option at the beginning
                const finalData = [
                    { _id: 'all', name: 'All Loan Types', description: 'Show all leads' },
                    ...loanTypesData
                ];
                
                setLoanTypes(finalData);
                
                // ⚡ Cache the result
                localStorage.setItem(cacheKey, JSON.stringify(finalData));
                localStorage.setItem(cacheTimeKey, Date.now().toString());
            } else {
                setDefaultLoanTypes();
            }
        } catch (error) {
            setDefaultLoanTypes();
        } finally {
            setLoadingLoanTypes(false);
        }
    };

    // Set default loan types if API call fails
    const setDefaultLoanTypes = () => {
        setLoanTypes([
            { _id: 'all', name: 'All Loan Types', description: 'Show all leads' },
            { _id: 'personal', name: 'Personal Loan', description: 'Personal loans' },
            { _id: 'home', name: 'Home Loan', description: 'Home loans' },
            { _id: 'business', name: 'Business Loan', description: 'Business loans' }
        ]);
    };

    const fetchImportantQuestions = async () => {
        try {
            setLoadingQuestions(true);
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${API_BASE_URL}/lead-login/important-questions?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setImportantQuestions(data.questions || []);
            }
        } catch (error) {
        } finally {
            setLoadingQuestions(false);
        }
    };

    // Fetch bank options from backend
    const fetchBankOptions = async () => {
        try {
            const currentUserId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            
            if (!currentUserId) {
                setBankOptions(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/settings/bank-names?user_id=${currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (Array.isArray(data) && data.length > 0) {
                    // Extract bank names from the BankNameInDB objects
                    const bankNames = data
                        .filter(bank => bank && bank.is_active === true)
                        .map(bank => bank.name)
                        .filter(name => name && name.trim()); // Remove empty names
                    
                    if (bankNames.length > 0) {
                        setBankOptions(bankNames);
                    } else {
                        setBankOptions(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
                    }
                } else {
                    setBankOptions(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
                }
            } else {
                setBankOptions(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
            }
        } catch (error) {
            setBankOptions(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
        }
    };

    // Fetch teams/departments using the same assignment API
    const fetchTeams = async () => {
        setLoadingTeams(true);
        try {
            const apiBaseUrl = '/api';
            
            // Use the assignment options API to get departments/teams
            const response = await fetch(`${apiBaseUrl}/leads/assignment-options?user_id=${userId}&show_all_users=true`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Debug: Teams API response:', data);
                
                // Extract departments/teams from the API response
                let teamsList = [];
                if (data.departments && Array.isArray(data.departments)) {
                    teamsList = data.departments.map(dept => dept.name).filter(Boolean);
                    console.log('Debug: Extracted teams from departments:', teamsList);
                }
                
                setTeams(teamsList);
            } else {
                console.error('Failed to fetch teams');
                setTeams([]);
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            setTeams([]);
        } finally {
            setLoadingTeams(false);
        }
    };

    // Fetch login department users using the same API as OperationsSection.jsx
    const fetchLoginDepartmentUsers = async () => {
        setLoadingAllEmployees(true);
        try {
            const apiBaseUrl = '/api';
            
            // Use the same API as OperationsSection.jsx for Login Person field
            const response = await fetch(`${apiBaseUrl}/leads/assignment-options?user_id=${userId}&show_all_users=true`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Debug: Login department API response:', data);
                
                let allUsers = [];
                
                // Handle departments structure - same logic as OperationsSection
                if (data.departments && Array.isArray(data.departments)) {
                    for (const dept of data.departments) {
                        try {
                            const deptResponse = await fetch(`${apiBaseUrl}/leads/assignment-options?user_id=${userId}&department_id=${dept.id}&show_all_users=true`, {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (deptResponse.ok) {
                                const deptData = await deptResponse.json();
                                if (deptData.users && Array.isArray(deptData.users)) {
                                    const usersWithDept = deptData.users.map(user => ({
                                        ...user,
                                        department_name: dept.name || user.department_name,
                                        department_id: dept.id
                                    }));
                                    allUsers = [...allUsers, ...usersWithDept];
                                }
                            }
                        } catch (deptError) {
                            console.error('Error fetching department users:', deptError);
                        }
                    }
                }
                
                // Fallback to users array if no departments found
                if (allUsers.length === 0 && data.users) {
                    allUsers = data.users;
                }
                
                console.log('Debug: All users from assignment API:', allUsers);
                setAllEmployees(allUsers);
            } else {
                console.error('Failed to fetch login department users');
                setAllEmployees([]);
            }
        } catch (error) {
            console.error('Error fetching login department users:', error);
            setAllEmployees([]);
        } finally {
            setLoadingAllEmployees(false);
        }
    };

    // Fetch employees (team leaders) for Assigned TL filter - restore original functionality
    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const apiBaseUrl = '/api';
            // Try different possible endpoints for team leaders
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
                    // Continue to next endpoint
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
            console.error('Error fetching employees:', error);
            setEmployees([]);
        } finally {
            setLoadingEmployees(false);
        }
    };

    // ⚡ CRITICAL PERFORMANCE: Convert filtering to useMemo for INSTANT filtering
    // This runs synchronously and only when dependencies change
    const filteredLeadsData = useMemo(() => {
        if (!leads || leads.length === 0) {
            return [];
        }

        let filtered = [...leads];

        // Filter by loan type
        if (selectedLoanType !== 'all') {
            filtered = filtered.filter(lead => {
                // Check for exact match on loan_type_id first (most reliable)
                if (lead.loan_type_id === selectedLoanType) {
                    return true;
                }
                
                // Get the clean loan type name (without "Login" suffix) from localStorage
                const cleanLoanTypeName = localStorage.getItem('loginCrmCleanLoanTypeName');
                
                // If we have a clean name, use it for comparison
                if (cleanLoanTypeName && 
                    (lead.loan_type === cleanLoanTypeName || 
                     lead.loan_type_name === cleanLoanTypeName)) {
                    return true;
                }
                
                // Legacy check using the stored name
                const effectiveSelectedLoanType = typeof selectedLoanType === 'string' ? 
                    selectedLoanType.replace(" Login", "") : 
                    selectedLoanType;
                
                // Check for exact match on name fields
                if (lead.loan_type === effectiveSelectedLoanType || lead.loan_type_name === effectiveSelectedLoanType) {
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

        // Filter by status
        if (selectedStatus !== 'all') {
            filtered = filtered.filter(lead => lead.status === selectedStatus);
        }

        // Filter by search term
        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(lead => {
                // Get customer name from different possible fields
                const customerName = getLeadField(lead, 'customer_name') || 
                                `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '';
                
                // Get company name from different possible fields
                const companyName = getLeadField(lead, 'company_name') || '';
                
                // Get city from different possible fields
                const city = getLeadField(lead, 'city') || '';
                
                // Get pincode from different possible fields
                const pincode = getLeadField(lead, 'pincode') || '';
                
                return (
                    customerName.toLowerCase().includes(term) ||
                    (typeof lead.phone === 'string' && lead.phone.includes(term)) ||
                    (typeof lead.alternative_phone === 'string' && lead.alternative_phone.includes(term)) ||
                    (typeof lead.email === 'string' && lead.email.toLowerCase().includes(term)) ||
                    companyName.toLowerCase().includes(term) ||
                    (typeof lead.creator_name === 'string' && lead.creator_name.toLowerCase().includes(term)) ||
                    (typeof lead.team_name === 'string' && lead.team_name.toLowerCase().includes(term)) ||
                    (typeof lead.operations_channel_name === 'string' && lead.operations_channel_name.toLowerCase().includes(term)) ||
                    city.toLowerCase().includes(term) ||
                    (typeof pincode === 'string' && pincode.includes(term)) ||
                    (typeof lead.status === 'string' && lead.status.toLowerCase().includes(term)) ||
                    (typeof lead.sub_status === 'string' && lead.sub_status.toLowerCase().includes(term)) ||
                    (typeof lead.custom_lead_id === 'string' && lead.custom_lead_id.toLowerCase().includes(term)) ||
                    (typeof lead.login === 'string' && lead.login.toLowerCase().includes(term))
                );
            });
        }

        // Apply additional filter options (date ranges, etc.)
        if (Object.values(filterOptions).some(option => option)) {
            filtered = filtered.filter(lead => {
                const leadDate = new Date(lead.login_date);
                
                // Date filters
                if (filterOptions.dateFrom && filterOptions.dateTo) {
                    const fromDate = new Date(filterOptions.dateFrom);
                    const toDate = new Date(filterOptions.dateTo);
                    if (leadDate < fromDate || leadDate > toDate) {
                        return false;
                    }
                }

                // Other filters...
                return true;
            });
        }

        return filtered;
    }, [leads, selectedLoanType, selectedStatus, debouncedSearchTerm, filterOptions, filterRevision]);

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

    // ⚡ Update filteredLeads when filteredLeadsData changes (synchronous)
    useEffect(() => {
        setFilteredLeads(filteredLeadsData);
        setStatusCounts(memoizedStatusCounts);
    }, [filteredLeadsData, memoizedStatusCounts]);

    // Reset pagination when filters or search term changes
    useEffect(() => {
        setDisplayedCount(INITIAL_LOAD);
    }, [
        debouncedSearchTerm,
        selectedLoanType,
        selectedStatus,
        filterOptions,
        filterRevision
    ]);

    // Direct copy lead function - no modal, immediate copy like LeadCRM
    const handleDirectCopyLead = async () => {
        console.log('handleDirectCopyLead called');
        console.log('selectedLead:', selectedLead);
        
        // Test immediate message to verify message system
        message.info('🔄 Copy process initiated...', 2);
        
        if (!selectedLead) {
            console.log('No lead selected');
            message.error('⚠️ No lead selected to copy');
            return;
        }

        try {
            console.log('Starting copy process...');
            message.loading('📋 Copying lead...', 0); // Show loading message
            
            const userId = localStorage.getItem('userId');
            console.log('userId:', userId);
            const apiUrl = `/api/leads/copy?user_id=${userId}`;
            console.log('API URL:', apiUrl);
            
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
            
            console.log('Copy data:', copyData);
            console.log('Making API request...');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(copyData)
            });
            
            console.log('API response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.log('API error data:', errorData);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            // Get the newly created lead ID from the response
            const responseData = await response.json();
            console.log('API response data:', responseData);
            console.log('Available fields in response:', Object.keys(responseData));
            
            const newLeadId = responseData.lead_id || responseData._id || responseData.id;
            const displayLeadId = responseData.custom_lead_id || responseData.lead_number || newLeadId;
            
            console.log('newLeadId:', newLeadId);
            console.log('displayLeadId:', displayLeadId);
            
            message.destroy(); // Hide loading message
            console.log('About to show success message');
            
            // Show success message immediately
            console.log('Showing success message now');
            try {
                const successMessage = newLeadId ? 
                    `✅ Lead copied successfully! New Lead ID: ${displayLeadId}` : 
                    '✅ Lead copied successfully!';
                
                console.log('Success message content:', successMessage);
                
                message.success({
                    content: successMessage,
                    duration: 8, // Increased duration
                    style: { 
                        marginTop: '10vh',
                        zIndex: 9999,
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }
                });
                
                // Also show a notification as backup
                if (window.Notification && Notification.permission === "granted") {
                    new Notification("Lead Copied", {
                        body: successMessage,
                        icon: "/favicon.ico"
                    });
                } else if (window.Notification && Notification.permission !== "denied") {
                    // Request permission for future notifications
                    Notification.requestPermission();
                }
                
                // Additional visual feedback - change button text temporarily
                const copyButton = document.querySelector('.copy-lead-button');
                if (copyButton) {
                    const originalText = copyButton.textContent;
                    copyButton.textContent = '✅ Copied!';
                    copyButton.style.backgroundColor = '#10b981';
                    setTimeout(() => {
                        copyButton.textContent = originalText;
                        copyButton.style.backgroundColor = '';
                    }, 3000);
                }
                
                } catch(msgError) {
                    console.error('Error showing message:', msgError);
                    // Multiple fallbacks
                    try {
                        // Try basic message
                        message.success('✅ Lead copied successfully!');
                    } catch(fallbackError) {
                        console.error('Antd message also failed:', fallbackError);
                        // Final fallback - create custom toast
                        const toast = document.createElement('div');
                        toast.innerHTML = `✅ Lead copied successfully! New Lead ID: ${displayLeadId}`;
                        toast.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            background: #52c41a;
                            color: white;
                            padding: 12px 20px;
                            border-radius: 8px;
                            font-weight: bold;
                            z-index: 10000;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            opacity: 0;
                            transform: translateX(100%);
                            transition: all 0.3s ease-out;
                        `;
                        
                        // Add keyframe animation
                        if (!document.getElementById('toast-styles')) {
                            const style = document.createElement('style');
                            style.id = 'toast-styles';
                            style.textContent = `
                                .toast-enter {
                                    opacity: 1 !important;
                                    transform: translateX(0) !important;
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                        document.body.appendChild(toast);
                        
                        // Trigger animation
                        setTimeout(() => toast.classList.add('toast-enter'), 10);
                        setTimeout(() => {
                            if (document.body.contains(toast)) {
                                document.body.removeChild(toast);
                            }
                        }, 5000);
                        
                        // And alert as ultimate fallback
                        alert(`Lead copied successfully! New Lead ID: ${displayLeadId}`);
                    }
                }
                
            console.log('Refreshing leads...');
            // Force refresh after copying to clear cache
            forceRefreshLoginLeads();
            
        } catch (error) {
            message.destroy(); // Hide loading message
            console.error('Copy lead error:', error);
            
            // Try multiple ways to show error message
            try {
                message.error(`Failed to copy lead: ${error.message}`, 5);
            } catch(msgError) {
                console.error('Error showing error message:', msgError);
                alert(`Failed to copy lead: ${error.message}`);
            }
        }
    };
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
                    // Make a second API call to ensure the status is set to "ACTIVE LEAD"
                    const statusUpdateUrl = `/api/leads/${newLeadId}?user_id=${userId}`;
                    const statusUpdateResponse = await fetch(statusUpdateUrl, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({
                            status: "ACTIVE LEAD",
                            sub_status: ""
                        })
                    });
                    
                    if (!statusUpdateResponse.ok) {
                    }
                } catch (statusError) {
                    // Don't fail the whole operation if just the status update fails
                }
            }
            
            message.success('Lead copied successfully! The new lead has been created with "ACTIVE LEAD" status.');
            
            // Refresh leads after copying
            fetchLoginDepartmentLeads();
            
        } catch (error) {
            message.error(`Failed to copy lead: ${error.message}`);
        }
    };

    const handleAssignToMultipleUsers = async (leadId, userIds) => {
        try {
            const userId = localStorage.getItem('userId');
            const userName = localStorage.getItem('userName') || 'Unknown User';

            // Get lead details to include in activity
            const leadDetails = leads.find(lead => lead._id === leadId);
            const oldAssignedTo = leadDetails?.assigned_to || [];

            // Prepare activity data for logging the assignment change
            const activityData = {
                activity_type: 'assignment',
                description: `Lead assigned to ${userIds.length} user(s)`,
                created_by: userName,
                user_id: userId,
                created_at: new Date().toISOString()
            };

            const response = await fetch(`${API_BASE_URL}/lead-login/assign-multiple-users/${leadId}?user_id=${userId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assigned_user_ids: userIds,
                    activity: activityData
                })
            });

            if (response.ok) {
                message.success('Lead assigned successfully');
                fetchLoginDepartmentLeads();
            } else {
                message.error('Failed to assign lead');
            }
        } catch (error) {
            message.error('Error assigning lead');
        }
    };

    const handleUpdateOperations = async (leadId, operationsData) => {
        try {
            const userId = localStorage.getItem('userId');
            const userName = localStorage.getItem('userName') || 'Unknown User';

            // Create activity data for logging operations changes
            const activityData = {
                activity_type: 'operations_update',
                description: 'Lead operations data updated',
                created_by: userName,
                user_id: userId,
                created_at: new Date().toISOString(),
                details: {
                    fields_updated: Object.keys(operationsData)
                }
            };

            // Add activity to operations data
            const dataWithActivity = {
                ...operationsData,
                activity: activityData
            };

            const response = await fetch(`${API_BASE_URL}/lead-login/update-operations/${leadId}?user_id=${userId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataWithActivity)
            });

            if (response.ok) {
                message.success('Operations data updated successfully');
                fetchLoginDepartmentLeads();
            } else {
                message.error('Failed to update operations data');
            }
        } catch (error) {
            message.error('Error updating operations data');
        }
    };

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

            const response = await fetch(`${API_BASE_URL}/lead-login/validate-questions/${leadId}?user_id=${userId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataWithActivity)
            });

            if (response.ok) {
                message.success('All questions validated successfully');
                fetchLoginDepartmentLeads();
            } else {
                const errorData = await response.json();
                message.error(errorData.detail || 'Failed to validate questions');
            }
        } catch (error) {
            message.error('Error validating questions');
        }
    };

    // Bulk assignment functionality
    const handleBulkAssignment = async (userIds) => {
        if (selectedLeads.length === 0) {
            message.warning('Please select leads to assign');
            return;
        }

        try {
            const userId = localStorage.getItem('userId');
            const userName = localStorage.getItem('userName') || 'Unknown User';

            // Prepare activity data for logging the bulk assignment
            const activityData = {
                activity_type: 'bulk_assignment',
                description: `Leads assigned to ${userIds.length} user(s) in bulk operation`,
                created_by: userName,
                user_id: userId,
                created_at: new Date().toISOString()
            };

            const promises = selectedLeads.map(leadId =>
                fetch(`${API_BASE_URL}/lead-login/assign-multiple-users/${leadId}?user_id=${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        assigned_user_ids: userIds,
                        activity: activityData
                    })
                })
            );

            const results = await Promise.all(promises);
            const successCount = results.filter(r => r.ok).length;

            if (successCount === selectedLeads.length) {
                message.success(`Successfully assigned ${successCount} leads`);
            } else {
                message.warning(`Assigned ${successCount} out of ${selectedLeads.length} leads`);
            }

            setSelectedLeads([]);
            fetchLoginDepartmentLeads();
        } catch (error) {
            message.error('Error bulk assigning leads');
        }
    };

    // Handle lead selection for bulk operations
    const handleLeadSelection = (leadId, checked) => {
        if (checked) {
            setSelectedLeads(prev => [...prev, leadId]);
        } else {
            setSelectedLeads(prev => prev.filter(id => id !== leadId));
        }
    };

    // Select all leads
    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedLeads(filteredLeads.map(lead => lead._id));
        } else {
            setSelectedLeads([]);
        }
    };

    // Handle clicking on a lead to open LeadDetails with fresh data
    const handleLeadClick = async (lead) => {
        console.log('handleLeadClick called with lead:', lead);
        
        try {
            // Fetch fresh lead data from API to ensure we have the latest version
            // IMPORTANT: Fetch from login leads endpoint, not main leads
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${lead._id}?user_id=${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const freshLeadData = await response.json();
                console.log('Fresh lead data fetched:', freshLeadData);
                setSelectedLead(freshLeadData);
                setShowLeadDetails(true);
                console.log('Lead click handler completed with fresh data');
            } else if (response.status === 404) {
                message.warning('⚠️ This lead no longer exists. Refreshing the list...');
                fetchLoginDepartmentLeads();
            } else {
                // Fallback to using the lead data from the list
                console.log('Could not fetch fresh data, using cached lead data');
                setSelectedLead(lead);
                setShowLeadDetails(true);
                message.info('Using cached lead data - some information may not be up to date');
            }
        } catch (error) {
            console.error('Error fetching fresh lead data:', error);
            // Fallback to using the lead data from the list
            setSelectedLead(lead);
            setShowLeadDetails(true);
            message.warning('Could not fetch latest data - using cached information');
        }
    };

    // Status dropdown handlers (similar to LeadCRM)
    const handleStatusDropdownClick = (rowIdx, event) => {
        event.stopPropagation(); // Prevent row click from opening lead details
        
        // If clicking the same dropdown, close it
        if (showStatusDropdown === rowIdx) {
            setShowStatusDropdown(null);
            setStatusSearchTerm('');
            return;
        }
        
        // Calculate dropdown position relative to viewport
        const rect = event.target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Calculate dynamic dropdown height based on content
        const headerHeight = 80; // Header with search
        const optionHeight = 40; // Each option height
        let totalOptions;
        
        if (showMainStatuses && !statusSearchTerm) {
            // Count main statuses when showing main status view
            totalOptions = Object.keys(statusHierarchy).length || statusOptions.length;
        } else if (selectedMainStatus && statusHierarchy[selectedMainStatus]) {
            // Count sub-statuses when in sub-status view
            totalOptions = statusHierarchy[selectedMainStatus].length;
        } else {
            // Fallback to all available options
            totalOptions = statusOptions.length;
        }
        
        // Calculate dynamic height with some padding and max limit
        const calculatedHeight = Math.min(headerHeight + (totalOptions * optionHeight), 400);
        
        // Check viewport constraints
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const dropdownWidth = 300; // Approximate width
        
        // Adjust horizontal position if needed
        let left = rect.left + scrollLeft;
        if (left + dropdownWidth > viewportWidth) {
            left = viewportWidth - dropdownWidth - 10; // 10px margin from edge
        }
        
        // Calculate vertical position - prefer opening below, but open above if not enough space
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        let top;
        let maxHeight;
        
        if (spaceBelow >= calculatedHeight + 10) {
            // Enough space below - open downward
            top = rect.bottom + scrollTop + 5; // 5px gap below the button
            maxHeight = Math.min(calculatedHeight, spaceBelow - 10);
        } else if (spaceAbove >= calculatedHeight + 10) {
            // Not enough space below but enough above - open upward
            top = rect.top + scrollTop - calculatedHeight - 5; // 5px gap above the button
            maxHeight = Math.min(calculatedHeight, spaceAbove - 10);
        } else {
            // Limited space both ways - use the side with more space
            if (spaceAbove > spaceBelow) {
                // Open upward with available space
                maxHeight = spaceAbove - 10;
                top = rect.top + scrollTop - maxHeight - 5;
            } else {
                // Open downward with available space
                maxHeight = spaceBelow - 10;
                top = rect.bottom + scrollTop + 5;
            }
        }
        
        setDropdownPosition({ 
            top, 
            left, 
            maxHeight: Math.max(maxHeight, 200) // Ensure minimum usable height
        });
        setShowStatusDropdown(rowIdx);
        setStatusSearchTerm(''); // Reset search term when opening dropdown
        
        // Initialize hierarchical navigation state
        setSelectedMainStatus(null);
        setShowMainStatuses(true);
    };

    // Handle status change from dropdown
    const handleStatusChange = async (rowIdx, newStatus, isDirectSelection = false) => {
        const lead = filteredLeads[rowIdx];
        
        // If this is a direct selection from search results
        if (isDirectSelection) {
            const searchResults = getSearchResults();
            const selectedResult = searchResults.results.find(r => r.name === newStatus);
            
            if (selectedResult) {
                if (selectedResult.type === 'sub') {
                    // Direct sub-status selection - update with both main and sub-status
                    await updateLeadStatus(rowIdx, selectedResult.mainStatus, selectedResult.subStatus);
                    handleCloseStatusDropdown(); // Close dropdown after successful update
                    return;
                } else {
                    // Direct main status selection - check if it has sub-statuses
                    const hasSubStatuses = statusHierarchy[newStatus] && statusHierarchy[newStatus].length > 0;
                    if (hasSubStatuses) {
                        // Navigate to sub-statuses view
                        handleMainStatusClick(newStatus);
                        return; // Keep dropdown open
                    } else {
                        // For standalone statuses, we'll set both status and sub_status to the same value
                        // but let the updateLeadStatus function handle the logic
                        await updateLeadStatus(rowIdx, newStatus, newStatus);
                        handleCloseStatusDropdown();
                        return;
                    }
                }
            }
        }
        
        // If we're showing main statuses and user clicked on one
        if (showMainStatuses) {
            // Check if this main status has sub-statuses
            const hasSubStatuses = statusHierarchy[newStatus] && statusHierarchy[newStatus].length > 0;
            
            if (hasSubStatuses) {
                // Navigate to sub-statuses view
                handleMainStatusClick(newStatus);
                return; // Don't close dropdown, just show sub-statuses
            } else {
                // This main status has no sub-statuses, update directly
                // For standalone statuses with no sub-statuses, let updateLeadStatus handle the logic
                await updateLeadStatus(rowIdx, newStatus, newStatus);
                handleCloseStatusDropdown(); // Close dropdown after successful update
                return;
            }
        }
        
        // If we're showing sub-statuses, update with both main status and sub-status
        
        // Find the main status for this sub-status
        let mainStatus = selectedMainStatus;
        if (!mainStatus && subStatusToMainStatus[newStatus]) {
            mainStatus = subStatusToMainStatus[newStatus];
        }
        
        if (!mainStatus) {
            mainStatus = newStatus;
        }
        
        // Update with both main status and sub-status
        await updateLeadStatus(rowIdx, mainStatus, newStatus);
        handleCloseStatusDropdown(); // Close dropdown after successful update
    };

    // Helper function to actually update the lead status
    const updateLeadStatus = async (rowIdx, mainStatus, subStatus = null) => {
        const lead = filteredLeads[rowIdx];

        try {
            // Prepare the update payload
            const updatePayload = {
                status: mainStatus
            };
            
            // Determine the correct sub_status to use
            let effectiveSubStatus = subStatus;
            
            // Case 1: If subStatus is explicitly provided, use it
            if (subStatus) {
                effectiveSubStatus = subStatus;
            }
            // Case 2: If no subStatus is provided but this main status has sub-statuses in the hierarchy
            else if (statusHierarchy[mainStatus] && statusHierarchy[mainStatus].length > 0) {
                // Don't auto-set sub_status for statuses that have defined sub-statuses
                // This allows the API to use its default behavior
                effectiveSubStatus = null;
            }
            // Case 3: This is a standalone main status with no sub-statuses defined
            else {
                // For standalone main statuses, use the main status as the sub_status
                effectiveSubStatus = mainStatus;
            }
            
            // Only include sub_status in payload if we have a value
            if (effectiveSubStatus) {
                updatePayload.sub_status = effectiveSubStatus;
            }
            
            // Debug log for status update
            console.log('Status update payload:', {
                mainStatus,
                providedSubStatus: subStatus,
                effectiveSubStatus,
                hasDefinedSubStatuses: statusHierarchy[mainStatus] && statusHierarchy[mainStatus].length > 0,
                finalPayload: updatePayload
            });
            

            // Update login lead status via API
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${lead._id}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updatePayload)
            });

            if (response.ok) {
                
                // Get the API response data to get the actual values that were applied
                const responseData = await response.json();
                
                // Use the server-returned values if available, otherwise use our sent values
                const finalStatus = responseData?.status || mainStatus;
                const finalSubStatus = responseData?.sub_status || effectiveSubStatus || mainStatus;
                
                // Update local state immediately with the final values
                const updatedLeads = [...filteredLeads];
                updatedLeads[rowIdx] = { 
                    ...updatedLeads[rowIdx], 
                    status: finalStatus,
                    sub_status: finalSubStatus
                };
                setFilteredLeads(updatedLeads);
                
                // Also update main leads state with the final values
                const allLeadsUpdated = leads.map(l => 
                    l._id === lead._id ? { 
                        ...l, 
                        status: finalStatus, 
                        sub_status: finalSubStatus 
                    } : l
                );
                setLeads(allLeadsUpdated);
                
                // Immediately update status counts to reflect the change
                setStatusCounts(calculateStatusCounts(allLeadsUpdated, selectedLoanType));
                
                // Close dropdown and reset state
                handleCloseStatusDropdown();
                message.success('Status updated successfully');
            } else {
                throw new Error('Failed to update status');
            }
        } catch (error) {
            message.error('Failed to update status');
        }
    };

    // Get filtered status options based on search term and hierarchical navigation
    const getFilteredStatusOptions = () => {
        
        // When department is "login", show hierarchical status navigation (same logic as LeadCRM)
        if (department === "login") {
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

                // Return search results (exact matches first, then partial matches)
                const searchResults = [...exactMatches, ...partialMatches];
                return searchResults;
            }
            
            // Show main statuses when in main view (no search term)
            if (showMainStatuses) {
                return allStatuses;
            }
            
            // Show sub-statuses for selected main status
            if (!showMainStatuses && selectedMainStatus) {
                const subStatusOptions = statusHierarchy[selectedMainStatus] || [];
                return subStatusOptions;
            }
        }
        
        // Fallback for non-login departments or if no conditions met
        return allStatuses.length > 0 ? allStatuses : [
            'ACTIVE LOGIN',
            'APPROVED', 
            'DISBURSED',
            'LOST BY MISTAKE',
            'LOST LOGIN'
        ];
    };

    // Helper function to handle main status click (navigate to sub-statuses)
    const handleMainStatusClick = (mainStatus) => {
        
        setSelectedMainStatus(mainStatus);
        setShowMainStatuses(false);
        setStatusSearchTerm(''); // Clear search when navigating
        
        // DON'T close the dropdown - keep it open for sub-status selection
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
    };

    // Handle tab switching with unsaved changes check
    const handleTabChange = (newTabIndex) => {
        // Check if we're leaving the Obligation tab (tab index 5) and there are unsaved changes
        if (activeTab === 5 && hasUnsavedObligationChanges) {
            setPendingTabChange(newTabIndex);
            if (obligationModalTrigger) {
                obligationModalTrigger(); // Trigger the modal from ObligationSection
            } else {
                setShowObligationUnsavedModal(true); // Fallback modal
            }
            return;
        }
        
        // No unsaved changes, proceed with tab change
        setActiveTab(newTabIndex);
        setOpenSection(0);
    };

    // Handle unsaved changes callback from ObligationSection
    const handleObligationUnsavedChanges = (hasUnsaved, modalTrigger) => {
        setHasUnsavedObligationChanges(hasUnsaved);
        setObligationModalTrigger(() => modalTrigger);
    };

    // Refetch the currently selected lead to get fresh data
    const refetchSelectedLead = async () => {
        if (!selectedLead?._id) {
            console.warn('No selected lead to refetch');
            return;
        }

        try {
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${selectedLead._id}?user_id=${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedLead = await response.json();
            
            // Update selectedLead state
            setSelectedLead(updatedLead);
            
            // Also update in the leads array
            setLeads(prevLeads => 
                prevLeads.map(l => l._id === updatedLead._id ? updatedLead : l)
            );
            
            console.log('✅ Selected lead refetched and updated:', updatedLead._id);
        } catch (error) {
            console.error('❌ Error refetching selected lead:', error);
        }
    };

    // Continue with tab change after user decides to discard changes
    const handleContinueWithoutSaving = () => {
        setShowObligationUnsavedModal(false);
        if (pendingTabChange !== null) {
            setActiveTab(pendingTabChange);
            setOpenSection(0);
            setPendingTabChange(null);
        }
        setHasUnsavedObligationChanges(false);
    };

    // Stay on current tab
    const handleStayOnCurrentTab = () => {
        setShowObligationUnsavedModal(false);
        setPendingTabChange(null);
    };

    // Toggle section collapse/expand
    const toggleSectionCollapse = (sectionKey) => {
        setCollapsedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    // Enhanced search function that shows both main and sub-status matches
    const getSearchResults = () => {
        if (!statusSearchTerm) {
            return { type: 'normal', results: [] };
        }

        const searchTerm = statusSearchTerm.toLowerCase();
        const results = [];

        // Search through main statuses
        const mainStatusOptions = allStatuses.length > 0 ? allStatuses : [
            'Active Login', 'Approve', 'Disbursed', 'Lost by Mistake', 'Lost Login'
        ];

        mainStatusOptions.forEach(status => {
            const statusName = typeof status === 'object' ? status.name : status;
            if (statusName.toLowerCase().includes(searchTerm)) {
                results.push({
                    type: 'main',
                    name: statusName,
                    mainStatus: statusName,
                    subStatus: null
                });
            }
        });

        // Search through all sub-statuses
        Object.entries(statusHierarchy).forEach(([mainStatus, subStatuses]) => {
            subStatuses.forEach(subStatus => {
                const subStatusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                if (subStatusName.toLowerCase().includes(searchTerm)) {
                    results.push({
                        type: 'sub',
                        name: subStatusName,
                        mainStatus: mainStatus,
                        subStatus: subStatusName
                    });
                }
            });
        });

        return { type: 'search', results };
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

    // Calculate days old from login date
    const calculateDaysOld = (date) => {
        if (!date) return 0;
        
        // Normalize dates to avoid timezone issues
        const today = new Date();
        const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const leadDate = new Date(date);
        const normalizedLeadDate = new Date(leadDate.getFullYear(), leadDate.getMonth(), leadDate.getDate());
        
        // Calculate difference in milliseconds and convert to days
        const timeDifference = currentDate.getTime() - normalizedLeadDate.getTime();
        const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));
        
        // Ensure we don't return negative days
        return Math.max(0, daysDifference);
    };

    // Format date with days old for login department
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
                            daysOld > 0 ? `${daysOld} days old` : 'Future date'}
                </div>
            </div>
        );
    };

    // Auto-assign status when lead comes to login department
    const autoAssignLoginStatus = async (leadId) => {
        try {
            const updateData = {
                status: 'ACTIVE LOGIN',
                sub_status: 'NEW LOGIN'
            };
            
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${leadId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                return true;
            } else if (response.status === 404) {
                console.warn(`Lead ${leadId} not found during auto-assign - it may have been deleted`);
                return false;
            } else {
                console.error(`Failed to auto-assign status to lead ${leadId}: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error(`Error auto-assigning status to lead ${leadId}:`, error);
            return false;
        }
    };

    // Load statuses and sub-statuses from API for login department
    const loadStatusesAndSubStatuses = async () => {
        setLoadingStatuses(true);
        try {
            // ⚡ PERFORMANCE: Check cache first (15 minute cache)
            const cacheKey = 'logincrm_statuses';
            const cacheTimeKey = 'logincrm_statuses_time';
            const cachedData = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheTimeKey);
            
            const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
            
            if (cachedData && cacheTime && parseInt(cacheTime) > fifteenMinutesAgo) {
                const data = JSON.parse(cachedData);
                setAllStatuses(data.allStatuses || []);
                setAllSubStatuses(data.allSubStatuses || []);
                setSubStatusToMainStatus(data.subStatusToMainStatus || {});
                setStatusHierarchy(data.statusHierarchy || {});
                setLoadingStatuses(false);
                return;
            }
            
            // Use the same admin API endpoint as StatusManagementTab
            const apiBaseUrl = '/api';
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

                // Filter statuses for the current department (login)
                const department = 'login';
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
                
                // ⚡ Cache the result
                const cacheKey = 'logincrm_statuses';
                const cacheTimeKey = 'logincrm_statuses_time';
                localStorage.setItem(cacheKey, JSON.stringify({
                    allStatuses: mainStatusesArray,
                    allSubStatuses: allSubStatusesArray,
                    subStatusToMainStatus: subToMainMap,
                    statusHierarchy: statusHierarchyMap
                }));
                localStorage.setItem(cacheTimeKey, Date.now().toString());

            } else {
                // Fallback to hardcoded mapping
                const fallbackStatuses = [
                    'ACTIVE LOGIN',
                    'APPROVED', 
                    'DISBURSED',
                    'LOST BY MISTAKE',
                    'LOST LOGIN'
                ];
                
                setAllStatuses(fallbackStatuses);
                setAllSubStatuses(['NEW LOGIN', 'SENT TO BANK', 'LOGIN COMPLETE UNDERWRITING', 'CASE FORWARDED', 'RELOOK', 'IMPORTANT RELOOK', 'ABND', 'CUSTOMER DENIED FOR LOGIN', 'CUSTOMER RESIGNED', 'LOCATION NOT DOABLE']);
                
                // Create hierarchy from hardcoded mapping
                const hierarchyMap = {
                    'ACTIVE LOGIN': ['NEW LOGIN', 'SENT TO BANK', 'LOGIN COMPLETE UNDERWRITING', 'CASE FORWARDED', 'RELOOK', 'IMPORTANT RELOOK'],
                    'LOST BY MISTAKE': ['ABND', 'CUSTOMER DENIED FOR LOGIN', 'CUSTOMER RESIGNED', 'LOCATION NOT DOABLE'],
                    'APPROVED': [],
                    'DISBURSED': [],
                    'LOST LOGIN': []
                };
                setStatusHierarchy(hierarchyMap);
                
                setSubStatusToMainStatus({
                    'NEW LOGIN': 'ACTIVE LOGIN',
                    'SENT TO BANK': 'ACTIVE LOGIN',
                    'LOGIN COMPLETE UNDERWRITING': 'ACTIVE LOGIN',
                    'CASE FORWARDED': 'ACTIVE LOGIN',
                    'RELOOK': 'ACTIVE LOGIN',
                    'IMPORTANT RELOOK': 'ACTIVE LOGIN',
                    'ABND': 'LOST BY MISTAKE',
                    'CUSTOMER DENIED FOR LOGIN': 'LOST BY MISTAKE',
                    'CUSTOMER RESIGNED': 'LOST BY MISTAKE',
                    'LOCATION NOT DOABLE': 'LOST BY MISTAKE'
                });
            }
            
        } catch (error) {
            // Fallback to hardcoded mapping
            const fallbackStatuses = [
                'ACTIVE LOGIN',
                'APPROVED', 
                'DISBURSED',
                'LOST BY MISTAKE',
                'LOST LOGIN'
            ];
            
            setAllStatuses(fallbackStatuses);
            setAllSubStatuses(['NEW LOGIN', 'SENT TO BANK', 'LOGIN COMPLETE UNDERWRITING', 'CASE FORWARDED', 'RELOOK', 'IMPORTANT RELOOK', 'ABND', 'CUSTOMER DENIED FOR LOGIN', 'CUSTOMER RESIGNED', 'LOCATION NOT DOABLE']);

            // Create hierarchy from hardcoded mapping
            const hierarchyMap = {
                'ACTIVE LOGIN': ['NEW LOGIN', 'SENT TO BANK', 'LOGIN COMPLETE UNDERWRITING', 'CASE FORWARDED', 'RELOOK', 'IMPORTANT RELOOK'],
                'LOST BY MISTAKE': ['ABND', 'CUSTOMER DENIED FOR LOGIN', 'CUSTOMER RESIGNED', 'LOCATION NOT DOABLE'],
                'APPROVED': [],
                'DISBURSED': [],
                'LOST LOGIN': []
            };
            setStatusHierarchy(hierarchyMap);
            
            setSubStatusToMainStatus({
                'NEW LOGIN': 'ACTIVE LOGIN',
                'SENT TO BANK': 'ACTIVE LOGIN',
                'LOGIN COMPLETE UNDERWRITING': 'ACTIVE LOGIN',
                'CASE FORWARDED': 'ACTIVE LOGIN',
                'RELOOK': 'ACTIVE LOGIN',
                'IMPORTANT RELOOK': 'ACTIVE LOGIN',
                'ABND': 'LOST BY MISTAKE',
                'CUSTOMER DENIED FOR LOGIN': 'LOST BY MISTAKE',
                'CUSTOMER RESIGNED': 'LOST BY MISTAKE',
                'LOCATION NOT DOABLE': 'LOST BY MISTAKE'
            });
        } finally {
            setLoadingStatuses(false);
        }
    };

    // Checkbox selection handlers for AllHomeLoan-style selection
    const handleShowCheckboxes = () => {
        console.log('handleShowCheckboxes called - showing checkboxes');
        setCheckboxVisible(true);
        setCheckedRows([]);
        setSelectedLeads([]);
        console.log('checkboxVisible set to true');
    };

    const handleCancelSelection = () => {
        setCheckboxVisible(false);
        setCheckedRows([]);
        setSelectedLeads([]);
    };

    const handleDeleteSelected = async () => {
        if (checkedRows.length === 0) return;
        
        console.log('handleDeleteSelected called with', checkedRows.length, 'leads');
        
        // Show confirmation dialog
        const confirmDelete = window.confirm(
            `Are you sure you want to delete ${checkedRows.length} selected lead${checkedRows.length > 1 ? 's' : ''}?`
        );
        
        if (confirmDelete) {
            try {
                console.log('User confirmed deletion, starting delete process...');
                
                // Show loading message
                message.loading('Deleting selected leads...', 0);
                
                // Get the selected lead IDs
                const selectedLeadIds = checkedRows.map(rowIdx => filteredLeads[rowIdx]._id);
                console.log('Selected lead IDs for deletion:', selectedLeadIds);
                
                const userId = localStorage.getItem('userId');
                const token = localStorage.getItem('token');
                
                // Delete each login lead via API
                const deletePromises = selectedLeadIds.map(async (leadId) => {
                    const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${leadId}?user_id=${userId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Failed to delete lead ${leadId}: ${response.status}`);
                    }
                    
                    return leadId;
                });
                
                // Wait for all deletions to complete
                const deletedIds = await Promise.all(deletePromises);
                console.log('Successfully deleted leads:', deletedIds);
                
                message.destroy(); // Hide loading message
                
                // Show success message
                message.success(`✅ Successfully deleted ${checkedRows.length} lead${checkedRows.length > 1 ? 's' : ''}!`, 5);
                
                // Reset selection state
                setCheckboxVisible(false);
                setCheckedRows([]);
                setSelectedLeads([]);
                
                // Clear any cached data and force immediate refresh
                console.log('Refreshing leads after deletion...');
                
                // Clear browser cache for this API endpoint
                if ('caches' in window) {
                    caches.delete('api-cache');
                }
                
                // Force immediate refresh with cache busting
                setTimeout(() => {
                    forceRefreshLoginLeads();
                }, 100); // Small delay to ensure backend deletion is processed
                
            } catch (error) {
                message.destroy(); // Hide loading message
                console.error('Delete leads error:', error);
                
                try {
                    message.error(`❌ Failed to delete leads: ${error.message}`, 5);
                } catch(msgError) {
                    alert(`Failed to delete leads: ${error.message}`);
                }
            }
        } else {
            console.log('User cancelled deletion');
        }
    };

    // Handle individual lead deletion
    const handleDeleteLead = async (leadId) => {
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${leadId}?user_id=${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Force immediate refresh
                forceRefreshLoginLeads();
                return { success: true };
            } else {
                throw new Error('Failed to delete lead');
            }
        } catch (error) {
            console.error('Error deleting lead:', error);
            throw error;
        }
    };

    const handleCheckboxChange = (rowIdx) => {
        let newCheckedRows;
        if (checkedRows.includes(rowIdx)) {
            newCheckedRows = checkedRows.filter((idx) => idx !== rowIdx);
        } else {
            newCheckedRows = [...checkedRows, rowIdx];
        }
        setCheckedRows(newCheckedRows);
        
        // Update selectedLeads as well for compatibility
        const selectedLeadIds = newCheckedRows.map(idx => filteredLeads[idx]._id);
        setSelectedLeads(selectedLeadIds);
    };

    const handleSelectAllCheckboxes = (e) => {
        if (e.target.checked) {
            const allRowIndices = filteredLeads.map((_, idx) => idx);
            setCheckedRows(allRowIndices);
            setSelectedLeads(filteredLeads.map(lead => lead._id));
        } else {
            setCheckedRows([]);
            setSelectedLeads([]);
        }
    };

    const allRowsChecked = checkedRows.length === filteredLeads.length && filteredLeads.length > 0;

    // Function to open status edit modal and set initial values
    const handleEditStatus = (lead) => {
        setEditingLead(lead);
        setNewStatus(lead.status || '');
        setNewSubStatus(lead.sub_status || '');

        // Fetch sub-statuses for the current status
        if (lead.status) {
            fetchSubStatuses(lead.status);
        }

        setStatusModalVisible(true);
    };

    // Function to fetch sub-statuses based on main status
    const fetchSubStatuses = async (status) => {
        try {
            // Using the correct API endpoint for statuses
            const response = await fetch(`${API_BASE_URL}/leads/statuses/login?user_id=${localStorage.getItem('userId')}`);
            if (response.ok) {
                const statusesData = await response.json();

                // The status in the database might be stored in uppercase or different format
                // So do a case-insensitive comparison
                const selectedStatus = statusesData.find(s =>
                    s.name.toLowerCase() === status.toLowerCase()
                );

                if (selectedStatus && selectedStatus.sub_statuses && selectedStatus.sub_statuses.length > 0) {
                    // Extract sub-statuses for the selected status
                    // Format them for the dropdown with proper casing
                    setAvailableSubStatuses(selectedStatus.sub_statuses.map(subStatus => ({
                        value: subStatus.name,
                        label: subStatus.name
                    })));
                } else {
                    setAvailableSubStatuses([]);
                }
            } else {
                setAvailableSubStatuses([]);
            }
        } catch (error) {
            setAvailableSubStatuses([]);
        }
    };

    // Function to update status and sub-status
    const handleStatusUpdate = async () => {
        if (!editingLead || !newStatus) {
            message.error('Status is required');
            return;
        }

        try {
            setLoading(true);
            const userId = localStorage.getItem('userId');
            const userName = localStorage.getItem('userName') || 'Unknown User';

            // Prepare activity data for logging the status change
            const activityData = {
                activity_type: 'status_update',
                description: `Status changed from "${editingLead.status || 'Not Set'}" to "${newStatus}"${newSubStatus ? ` with sub-status "${newSubStatus}"` : ''
                    }`,
                performed_by: userId,
                performed_by_name: userName,
                details: {
                    previous_status: editingLead.status || null,
                    previous_sub_status: editingLead.sub_status || null,
                    new_status: newStatus,
                    new_sub_status: newSubStatus || null
                }
            };

            // Use the general login lead update endpoint with activity tracking
            const response = await fetch(`${API_BASE_URL}/lead-login/login-leads/${editingLead._id}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    sub_status: newSubStatus || null,
                    // Include activity data to create an activity record
                    activity: activityData
                })
            });

            if (response.ok) {
                message.success('Status updated successfully');
                setStatusModalVisible(false);

                // Update local state immediately for instant UI feedback
                const updatedLeads = leads.map(lead => 
                    lead._id === editingLead._id ? { 
                        ...lead, 
                        status: newStatus,
                        sub_status: newSubStatus || null
                    } : lead
                );
                setLeads(updatedLeads);
                
                // Immediately update status counts to reflect the change
                setStatusCounts(calculateStatusCounts(updatedLeads, selectedLoanType));

                // Refresh the leads list (for any server-side updates)
                await fetchLoginDepartmentLeads();
            } else {
                const errorData = await response.json();
                message.error(errorData.detail || 'Failed to update status');
            }
        } catch (error) {
            message.error('Error updating status');
        } finally {
            setLoading(false);
        }
    };

    const renderActionMenu = (record) => {
        const menu = (
            <Menu>
                <Menu.Item
                    key="show"
                    icon={<EyeOutlined />}
                    onClick={() => {
                        handleLeadClick(record);
                    }}
                >
                    View Full Details
                </Menu.Item>
                <Menu.Item
                    key="operations"
                    icon={<EditOutlined />}
                    onClick={() => {
                        setSelectedLead(record);
                        setOperationsVisible(true);
                        // Populate form with existing data
                        operationsForm.setFieldsValue({
                            channel_name: record.operations_channel_name,
                            rate: record.operations_rate,
                            amount_disbursed: record.operations_amount_disbursed,
                            los_number: record.operations_los_number,
                            pf_insurance: record.operations_pf_insurance,
                            internal_top: record.operations_internal_top,
                            amount_approved: record.operations_amount_approved,
                            tenure_given: record.operations_tenure_given,
                            cashback_to_customer: record.operations_cashback_to_customer,
                            net_disbursement_amount: getLeadField(record, 'net_disbursement_amount'),
                            disbursement_date: record.operations_disbursement_date ? dayjs(record.operations_disbursement_date) : null
                        });
                    }}
                >
                    Update Operations
                </Menu.Item>
                <Menu.Item
                    key="assign"
                    icon={<UserOutlined />}
                    onClick={() => {
                        setSelectedLead(record);
                        setAssignmentVisible(true);
                        assignmentForm.setFieldsValue({
                            assigned_users: record.assigned_users?.map(u => u.user_id) || []
                        });
                    }}
                >
                    Assign Users
                </Menu.Item>
                <Menu.Item
                    key="questions"
                    icon={<CheckCircleOutlined />}
                    onClick={() => {
                        setSelectedLead(record);
                        setQuestionsVisible(true);
                        setQuestionResponses(record.question_responses || {});
                    }}
                >
                    Validate Questions
                </Menu.Item>
            </Menu>
        );

        return (
            <Dropdown overlay={menu} trigger={['click']}>
                <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
        );
    };

    const columns = [
        {
            title: '#',
            key: 'index',
            render: (_, record, index) => index + 1,
            width: 60,
            fixed: 'left'
        },
        {
            title: 'LOGIN DATE',
            key: 'login_date',
            render: (_, record) => {
                const loginDate = getLeadField(record, 'login_date');
                return loginDate ? formatDateWithAge(loginDate) : '-';
            },
            width: 140
        },
        {
            title: 'CREATED BY',
            key: 'created_by',
            render: (_, record) => getLeadField(record, 'creator_name') || '-',
            width: 120
        },
        {
            title: 'TEAM NAME',
            key: 'team_name',
            render: (_, record) => getLeadField(record, 'team_name') || '-',
            width: 120
        },
        {
            title: 'CUSTOMER NAME',
            key: 'customer_name',
            render: (_, record) => getLeadField(record, 'customer_name') || '-',
            width: 150
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            render: (status, record) => {
                let color = 'default';
                switch (status) {
                    case 'Active Login': color = 'processing'; break;
                    case 'Approve': color = 'success'; break;
                    case 'Disbursed': color = 'green'; break;
                    case 'Lost by Mistake': color = 'orange'; break;
                    case 'Lost Login': color = 'error'; break;
                }

                // Make the status clickable to edit
                return (
                    <div onClick={(e) => {
                        e.stopPropagation();
                        handleEditStatus(record);
                    }} style={{ cursor: 'pointer' }}>
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Tag color={color}>{status || 'Not Set'} <EditOutlined style={{ fontSize: '16px', marginLeft: '3px' }} /></Tag>
                            {record.sub_status && <Tag color="default" style={{ marginTop: '4px' }}>{record.sub_status}</Tag>}
                        </Space>
                    </div>
                );
            },
            width: 150
        },
        {
            title: 'TOTAL INCOME',
            key: 'total_income',
            render: (_, record) => {
                const totalIncome = getLeadField(record, 'total_income') || getLeadField(record, 'salary');
                return renderCurrency(totalIncome);
            },
            width: 120
        },
        {
            title: 'FOIR ELIGIBILITY',
            key: 'foir_eligibility',
            render: (_, record) => {
                const foir = getLeadField(record, 'foir_eligibility') || getLeadField(record, 'foir');
                return foir || '-';
            },
            width: 130
        },
        {
            title: 'LOAN AMOUNT REQUIRED',
            dataIndex: 'loan_amount',
            key: 'loan_amount',
            render: (amount) => {
                if (!amount && amount !== 0) return '-';
                // Handle both string and number types
                let value;
                if (typeof amount === 'string') {
                    // Remove any non-numeric characters except decimal point
                    const cleanedStr = amount.replace(/[^\d.-]/g, '');
                    value = parseFloat(cleanedStr);
                } else {
                    value = amount;
                }
                return isNaN(value) ? `₹${amount}` : `₹${value.toLocaleString()}`;
            },
            width: 150
        },
        {
            title: 'NET DISBURSEMENT AMOUNT',
            dataIndex: 'net_disbursement_amount',
            key: 'net_disbursement',
            render: (amount, record) => {
                const netAmount = getLeadField(record, 'net_disbursement_amount');
                if (!netAmount && netAmount !== 0) return '-';
                // Handle both string and number types
                let value;
                if (typeof netAmount === 'string') {
                    // Remove any non-numeric characters except decimal point
                    const cleanedStr = netAmount.replace(/[^\d.-]/g, '');
                    value = parseFloat(cleanedStr);
                } else {
                    value = netAmount;
                }
                return isNaN(value) ? `₹${netAmount}` : `₹${value.toLocaleString()}`;
            },
            width: 130
        },
        {
            title: 'COMPANY NAME',
            key: 'company_name',
            render: (_, record) => getLeadField(record, 'company_name') || '-',
            width: 150
        }
    ];

    // Ensure login department context is set

    // If lead details view is open, render it with tabs from LeadCRM 
    if (showLeadDetails && selectedLead) {
        console.log('Rendering lead details section for lead:', selectedLead.customer_name || selectedLead._id);
        console.log('showLeadDetails:', showLeadDetails, 'selectedLead:', !!selectedLead);

        // Define detailSections inside the component so it can access component functions
        const detailSections = [
          {
            label: "LEAD DETAILS",
            getContent: (lead, handleFieldChange) => [
              {
                label: "About",
                content: <LazySection height="300px">
                  <AboutSection 
                    lead={lead} 
                    onSave={(updatePayload) => {
                      // AboutSection sends the full update payload object
                      // We need to save it properly to the login lead endpoint
                      if (!selectedLead) return;
                      
                      const userId = localStorage.getItem('userId');
                      const apiUrl = `/api/lead-login/login-leads/${selectedLead._id}?user_id=${userId}`;
                      
                      return fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(updatePayload)
                      })
                      .then(response => {
                        if (!response.ok) {
                          throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                      })
                      .then(result => {
                        // Update the selected lead with the response
                        setSelectedLead(result);
                        // Update in the leads list
                        setLeads(prevLeads => 
                          prevLeads.map(l => l._id === result._id ? result : l)
                        );
                        console.log('✅ AboutSection data saved successfully');
                        return result;
                      })
                      .catch(error => {
                        console.error('❌ Error saving AboutSection data:', error);
                        throw error;
                      });
                    }} 
                    canEdit={canEditLogin()} 
                  />
                </LazySection>
              },
              {
                label: "How to Process",
                content: <LazySection height="250px">
                  <HowToProcessSection process={lead.process} onSave={(field, value) => handleSelectedLeadFieldChange(field, value, true, 1500)} lead={lead} canEdit={canEditLogin()} />
```
                </LazySection>
              },
              {
                label: "Login Operations",
                content: <OperationsSection lead={lead} onSave={(field, value) => handleSelectedLeadFieldChange(field, value, true, 1500)} canEdit={canEditLogin()} />
              },
              {
                label: "APPLICANT FORM",
                content: (
                  <div className="space-y-4 sm:space-y-6 w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-[#03B0F5]">Primary Applicant</h3>
                      <button
                        className={`px-3 sm:px-4 py-2 rounded-lg transition font-bold text-sm sm:text-lg whitespace-nowrap ${
                          canEditLogin() 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (!canEditLogin()) return;
                          // Add co-applicant functionality - initialize with empty co-applicant form
                          const coApplicantData = {
                            // Initialize with empty form structure to ensure the form appears
                            first_name: '',
                            last_name: '',
                            mobile_number: '',
                            email: '',
                            date_of_birth: '',
                            // Add other default fields as needed to match LoginFormSection expectations
                            address: '',
                            city: '',
                            state: '',
                            pincode: '',
                            pan_number: '',
                            aadhar_number: '',
                            initialized: true // Flag to ensure form shows up
                          };
                          handleFieldChange("co_applicant_form", coApplicantData);
                        }}
                        disabled={!canEditLogin()}
                      >
                        + Add Co-Applicant
                      </button>
                    </div>
                    <LoginFormSection
                      data={lead.dynamic_fields?.applicant_form || lead.loginForm || {}}
                      onSave={updated => {
                        // Use the enhanced field change handler with immediate save (delay=0) since 
                        // LoginFormSection already handles onBlur properly
                        handleSelectedLeadFieldChange("applicant_form", updated, true, 0);
                      }}
                      bankOptions={bankOptions}
                      mobileNumber={lead.mobile_number}
                      bankName={lead.salaryAccountBank || lead.bank_name}
                      isReadOnlyMobile={true}
                      leadId={lead._id}
                      leadCustomerName={lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name}` : lead.customerName}
                      leadData={lead}
                      canEdit={canEditLogin()}
                    />
                    {(lead.dynamic_fields?.co_applicant_form || lead.coApplicantForm) && (
                      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t-2 border-cyan-400 w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-[#03B0F5]">Co-Applicant</h3>
                          <button
                            className={`px-3 sm:px-4 py-2 rounded-lg transition font-bold text-sm sm:text-lg whitespace-nowrap ${
                              canEditLogin() 
                                ? 'bg-red-600 text-white hover:bg-red-700' 
                                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (!canEditLogin()) return;
                              handleFieldChange("co_applicant_form", null);
                            }}
                            disabled={!canEditLogin()}
                          >
                            Remove Co-Applicant
                          </button>
                        </div>
                        <LoginFormSection
                          data={lead.dynamic_fields?.co_applicant_form || lead.coApplicantForm || {}}
                          onSave={updated => {
                            // Use the enhanced field change handler with immediate save (delay=0) since 
                            // LoginFormSection already handles onBlur properly
                            handleSelectedLeadFieldChange("co_applicant_form", updated, true, 0);
                          }}
                          bankOptions={bankOptions}
                          mobileNumber=""
                          bankName=""
                          isCoApplicant={true}
                          leadId={lead._id}
                          leadCustomerName={lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name} - Co-Applicant` : `${lead.customerName || lead.customer_name || ''} - Co-Applicant`}
                          leadData={lead}
                          canEdit={canEditLogin()}
                        />
                      </div>
                    )}
                  </div>
                ),
              },
              {
                label: "Important Questions",
                content: (
                  <ImportantQuestionsSection
                    leadData={lead} 
                    onUpdate={updated => {
                      // Use debounced save for important questions
                      handleSelectedLeadFieldChange("importantquestion", updated, true, 2000);
                      // Also update question_responses field to ensure data consistency
                      if (updated.question_responses) {
                        handleSelectedLeadFieldChange("question_responses", updated.question_responses, true, 2000);
                      }
                    }}
                    currentUserRole={{ 
                      permissions: [], 
                      _id: localStorage.getItem('userId'),
                      department: localStorage.getItem('userDepartment') || 'login'
                    }}
                    canEdit={canEditLogin()}
                  />
                )
              },
            ]
          },
          {
            label: "OBLIGATION",
            getContent: (lead, handleFieldChange) => [
              {
                content: (
                  <div>
                    <ObligationSection
                      leadData={lead}
                      handleChangeFunc={(field, value) => {
                        // Pass to the original handleFieldChange with skipSuccessMessage=true
                        handleSelectedLeadFieldChange(field, value, true);
                      }}
                      onDataUpdate={async () => {
                        // Immediately refetch the selected lead to show updated values
                        await refetchSelectedLead();
                        // Also refresh the leads list in the background
                        fetchLoginDepartmentLeads();
                      }}
                      onUnsavedChangesUpdate={handleObligationUnsavedChanges}
                      canEdit={canEditLogin()}
                    />
                  </div>
                )
              }
            ]
          },
          {
            label: "REMARK",
            getContent: (leadData) => [
              {
                content: (
                  <div>
                    <RemarkSection leadData={leadData} canEdit={canEditLogin()} />
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
                  <div>
                    <div className="font-bold text-cyan-400 mb-2">
                      <LazySection height="300px">
                        <TaskComponent leadData={lead} canEdit={canEditLogin()} />
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
                     <Attachments 
                       leadId={lead._id} 
                       userId={lead.created_by}
                       onContentInteraction={(isInteracting) => {
                         // Optional: Handle when user is actively interacting with attachments
                         // This could be used to prevent accidental tab switches during file operations
                       }}
                       canEdit={canEditLogin()}
                     />
                   </LazySection>
                  </div>
                )
              }
            ]
          },
          {
            label: "LEADS ACTIVITY",
            getContent: (lead) => [
              {
                label: "LEADS ACTIVITY",
                content: (
                  <div>
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
          }
        ];

        const activeTabSection = detailSections[activeTab];
        const sectionData = activeTabSection.getContent(
            selectedLead,
            handleSelectedLeadFieldChange
        );
        
        return (
            <div className="min-h-screen bg-black text-white text-sm sm:text-base w-full">
                {/* Header */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-4 sm:py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg">
                    <button
                        onClick={() => {
                            setShowLeadDetails(false);
                            setSelectedLead(null);
                            fetchLoginDepartmentLeads(); // Refresh leads after viewing details
                        }}
                        className="text-cyan-300 mr-2 px-2 py-1 text-xl font-bold rounded hover:bg-cyan-900/20 transition"
                        aria-label="Back"
                    >
                        {"←"}
                    </button>
                    <UserOutlined className="text-cyan-300 w-8 sm:w-12 h-6 sm:h-10 drop-shadow" />
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg sm:text-2xl font-extrabold text-cyan-300 tracking-wide drop-shadow truncate">
                            {getLeadField(selectedLead, 'customer_name') || 'Lead Details'}
                        </h1>
                        {/* Auto-save indicator */}
                        {isSaving && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-600/20 rounded-full border border-yellow-500/50">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400"></div>
                                <span className="text-yellow-400 text-sm font-medium">Saving...</span>
                            </div>
                        )}
                        {Object.keys(pendingSaves).length > 0 && !isSaving && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-orange-600/20 rounded-full border border-orange-500/50">
                                <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                                <span className="text-orange-400 text-sm font-medium">Pending changes</span>
                            </div>
                        )}
                        {/* Refresh button */}
                        <button
                            onClick={() => handleLeadClick(selectedLead)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 rounded-full border border-blue-500/50 hover:bg-blue-600/30 transition-colors"
                            title="Refresh lead data"
                        >
                            <RefreshCw className="w-3 h-3 text-blue-400" />
                            <span className="text-blue-400 text-sm font-medium">Refresh</span>
                        </button>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        {/* Copy Lead Button - Direct copy, no modal */}
                        {selectedLead && (
                            <button 
                                className="copy-lead-button bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
                                onClick={() => {
                                    console.log('Copy Lead button clicked!');
                                    // Immediate test message to verify message system works
                                    message.success('🚀 Copy process started...', 2);
                                    handleDirectCopyLead();
                                }}
                            >
                                <Copy className="mr-2 h-4 w-4" /> COPY THIS LEAD
                            </button>
                        )}
                        
                        {/* File received indicator - only show when file_sent_to_login is true */}
                        {selectedLead?.file_sent_to_login && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-600/20 rounded-full border border-green-500/50">
                                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                                <span className="text-green-400 text-sm font-medium">File Received</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div 
                  className="flex flex-wrap items-center gap-2 px-4 sm:px-7 py-2 sm:py-3 bg-black border-b border-[#232c3a] overflow-x-auto relative "
                  data-tab-area="true"
                >
                    {detailSections.map((tab, idx) => (
                        <button
                            key={tab.label}
                            data-tab-button="true"
                            data-tab-index={idx}
                            className={`
                                flex items-center px-3 sm:px-6 py-2 sm:py-3 rounded-3xl font-extrabold border shadow-md text-sm sm:text-lg transition whitespace-nowrap relative  cursor-pointer
                                ${idx === activeTab
                                    ? "bg-[#03B0F5] via-blue-700 to-cyan-500 text-white border-cyan-400 shadow-lg scale-105"
                                    : "bg-white text-[#03B0F5] border-[#2D3C56] hover:bg-cyan-400/10 hover:text-cyan-400"
                                }
                                focus:outline-none focus:ring-2 focus:ring-cyan-400
                            `}
                            style={{
                                boxShadow: idx === activeTab ? "0 4px 16px 0 #1cb5e080" : undefined,
                                cursor: "pointer",
                                letterSpacing: "0.01em"
                            }}
                            onClick={(e) => {
                                // Ensure tab navigation always works
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Force tab change regardless of any content event blocking
                                try {
                                    handleTabChange(idx);
                                } catch (error) {
                                    // Fallback: directly set the active tab
                                    setActiveTab(idx);
                                }
                            }}
                            onMouseDown={(e) => {
                                // Additional safeguard for tab clicks
                                e.stopPropagation();
                            }}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                // Allow keyboard navigation
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                        handleTabChange(idx);
                                    } catch (error) {
                                        setActiveTab(idx);
                                    }
                                }
                            }}
                        >
                            {tab.icon || null}
                            {tab.label}
                        </button>
                    ))}
                </div>

               

                {/* Content */}
                <div className="px-2 sm:px-4 lg:px-6 py-4 lg:py-6 w-full relative z-0">
                    <div className="w-full relative z-0">
                        {sectionData.map((section, idx) => {
                            const sectionKey = `${activeTab}-${idx}`;
                            const isCollapsed = collapsedSections[sectionKey];
                            
                            return (
                                <div key={idx} className="mb-6 w-full">
                                    {section.label && (
                                        <button
                                            className="w-full px-2 sm:px-5 py-3 font-extrabold text-base sm:text-lg lg:text-[1.05rem] text-[#03B0F5] bg-gray-200 hover:bg-gray-300 border-2 border-gray-400 rounded-lg flex items-center justify-between transition-colors duration-200 shadow-md"
                                            onClick={() => toggleSectionCollapse(sectionKey)}
                                        >
                                            <span>{section.label}</span>
                                            <svg
                                                className={`w-5 h-5 transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    )}
                                    {(!section.label || !isCollapsed) && (
                                        <div className="w-full mt-2">
                                            {section.content}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ⚡ PERFORMANCE: Remove blocking permission check
    // Show content immediately using cached permissions
    // Permission check happens in background, UI shows instantly
    
    // Only show access denied if we've loaded permissions and they don't have access
    // Don't block initial render
    if (!permissionsLoading && permissions && Object.keys(permissions).length > 0 && !canShowLogin()) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                    <p className="text-gray-400">You don't have permission to view login records.</p>
                </div>
            </div>
        );
    }

    return (
        <React.Fragment>
            <style>{stickyHeaderStyles}</style>
            <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
            {/* Grid background pattern */}
            <div
                className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: "20px 20px",
                }}
            ></div>

            <div className="relative z-10 flex h-screen">
                {/* Main Content Area - Full Width */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-8 space-y-8">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        {/* <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Users className="w-6 h-6" /> {loanTypes.find(type => type._id === selectedLoanType)?.name || 'Unknown Loan Type'}
                        </h1> */}
                        {/* {selectedLoanType !== 'all' && (
                            <p className="text-md text-gray-400 mt-1 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Filtered by: {loanTypes.find(type => type._id === selectedLoanType)?.name || 'Unknown Loan Type'}
                            </p>
                        )} */}
                    </div>
                    {/* <div className="flex flex-wrap gap-3">
                        <button 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
                            onClick={() => {
                                message.info('🔄 Force refreshing leads with cache clear...', 1);
                                forceRefreshLoginLeads();
                            }}
                            disabled={loading || clearingCache}
                            title="Force refresh - clears cache for immediate database sync"
                        >
                            {(loading || clearingCache) ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    {clearingCache ? 'Clearing Cache...' : 'Loading...'}
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Force Refresh
                                </>
                            )}
                        </button>
                            <ReloadOutlined style={{ fontSize: '18px' }} />
                            Refresh
                        </button>
                        {selectedLeads.length > 0 && (
                            <button
                                className={`px-4 py-2 rounded flex items-center gap-2 text-white ${
                                    loadingUsers 
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                                onClick={() => setBulkAssignmentVisible(true)}
                                disabled={loadingUsers}
                            >
                                <UserOutlined />
                                {loadingUsers ? 'Loading Users...' : `Assign Selected (${selectedLeads.length})`}
                            </button>
                        )}
                    </div> */}
                </div>
                {/* Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {statusCardConfig.map(({ key, label, icon: Icon, gradient, shadowColor }, index) => (
                        <div key={index} className={`p-4 rounded-xl bg-gradient-to-r ${gradient} shadow-lg ${shadowColor}`}>
                            <div className="flex justify-between items-center">
                                <Icon className="w-6 h-6 text-white" />
                                <span className="text-xl font-bold text-white">{statusCounts[key] || 0}</span>
                            </div>
                            <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Table Section - Fixed Controls with Scrollable Table */}
                <div className="bg-black-900 rounded-xl shadow-lg">
                    {/* Fixed Controls Section - No Scroll */}
                    <div className="sticky top-0 z-10 bg-black-900 rounded-t-xl">
                        {/* Unified Controls Row - Select, Filter, Search and Results Indicator */}
                        <div className="flex items-center justify-between gap-4 mb-4 px-4 pt-4">
                            <div className="flex items-center gap-3">
                                {/* Select Button */}
                                {(canDeleteLogin() || isUserSuperAdmin) && !checkboxVisible ? (
                                    <button
                                        className={`px-5 py-3 rounded-lg flex items-center gap-2 transition font-bold text-base ${
                                            selectedLeads.length > 0 
                                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                : 'bg-[#03B0F5] hover:bg-[#0280b5] text-white'
                                        }`}
                                        onClick={handleShowCheckboxes}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        {selectedLeads.length > 0 
                                            ? `Selected (${selectedLeads.length})` 
                                            : 'Select'
                                        }
                                    </button>
                                ) : (canDeleteLogin() || isUserSuperAdmin) ? (
                                    <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                                        <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                                            <input
                                                type="checkbox"
                                                className="accent-blue-500 mr-2"
                                                checked={allRowsChecked}
                                                onChange={handleSelectAllCheckboxes}
                                                style={{ width: 18, height: 18 }}
                                            />
                                            Select All
                                        </label>
                                        <span className="text-white font-semibold">
                                            {checkedRows.length} row{checkedRows.length !== 1 ? "s" : ""} selected
                                        </span>
                                        {isUserSuperAdmin && (
                                            <button
                                                className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                                onClick={handleDeleteSelected}
                                                disabled={checkedRows.length === 0}
                                            >
                                                Delete ({checkedRows.length})
                                            </button>
                                        )}
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
                                        {filteredLeads.length} of {leads.length} leads
                                        {searchTerm && (
                                            <span className="ml-2">
                                                matching "<span className="text-cyan-400 font-semibold">{searchTerm}</span>"
                                            </span>
                                        )}
                                        {clearingCache && (
                                            <span className="ml-2 text-yellow-400 font-semibold">
                                                • Clearing cache...
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Cache Status Indicator */}
                                {clearingCache && (
                                    <div className="text-base text-yellow-300 bg-yellow-900/20 px-4 py-3 rounded-lg border border-yellow-500/50">
                                        🔄 Cache clearing in progress - ensuring fresh data from database
                                    </div>
                                )}
                                
                                {/* Selected Leads Indicator */}
                                {selectedLeads.length > 0 && !checkboxVisible && (
                                    <div className="text-base text-green-300 bg-[#1b2230] px-4 py-3 rounded-lg border border-green-600">
                                        <span className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {/* Filter Button */}
                                <button
                                    className={`px-5 py-3 rounded-lg font-bold shadow transition relative flex items-center gap-3 text-base ${
                                        getActiveFilterCount() > 0
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
                                
                                {/* Search Input */}
                                <div className="relative w-[320px]">
                                    <input
                                        type="text"
                                        placeholder="Search by name, phone, email, company, city, status..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full py-3 pl-10 pr-4 bg-[#1b2230] text-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base placeholder-gray-500 truncate"
                                        style={{ 
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
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


                    </div>

                    {/* Scrollable Table Container with Scroll Buttons */}
                    <div className="w-full bg-black" style={{ marginLeft: 0 }}>
                        <div className="relative">
                            {/* Horizontal scroll buttons */}
                            {canScrollLeft && (
                                <button
                                    onClick={() => scrollTable('left')}
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                    style={{ 
                                        backgroundColor: 'rgba(37, 99, 235, 1)',
                                        zIndex: 9999
                                    }}
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
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                    style={{ 
                                        backgroundColor: 'rgba(37, 99, 235, 1)',
                                        zIndex: 9999
                                    }}
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
                                onScroll={updateScrollButtons}
                            >
                                <table className="min-w-[1700px] w-full">
                            <thead className="text-blue-900 bg-white sticky top-0 z-10 sticky-header">
                                <tr>
                                    {/* Checkbox column header - only show when checkboxes are visible */}
                                    {(canDeleteLogin() || isUserSuperAdmin) && checkboxVisible && (
                                        <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">
                                            ☑️
                                        </th>
                                    )}
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">#</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">LOGIN DATE</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">CREATED BY</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">TEAM NAME</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">CUSTOMER NAME</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">STATUS</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">TOTAL INCOME</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">FOIR ELIGIBILITY</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">LOAN AMOUNT REQUIRED</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">NET DISBURSEMENT AMOUNT</th>
                                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">COMPANY NAME</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    // ⚡ PERFORMANCE: Show skeleton rows for better perceived performance
                                    <>
                                        {[...Array(10)].map((_, i) => (
                                            <tr key={i} className="border-b border-gray-800 animate-pulse">
                                                {(canDeleteLogin() || isUserSuperAdmin) && checkboxVisible && (
                                                    <td className="py-3 px-4">
                                                        <div className="h-4 w-4 bg-gray-700 rounded"></div>
                                                    </td>
                                                )}
                                                <td className="py-3 px-4"><div className="h-4 w-8 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-24 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-32 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-28 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-40 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-36 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-24 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-20 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-32 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-28 bg-gray-700 rounded"></div></td>
                                                <td className="py-3 px-4"><div className="h-4 w-36 bg-gray-700 rounded"></div></td>
                                            </tr>
                                        ))}
                                    </>
                                ) : isFilteringActivity ? (
                                    <tr>
                                        <td colSpan={((canDeleteLogin() || isUserSuperAdmin) && checkboxVisible) ? "13" : "12"} className="text-center py-10 text-gray-500">
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                                <span>Checking activity for leads...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : displayedLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={((canDeleteLogin() || isUserSuperAdmin) && checkboxVisible) ? "13" : "12"} className="text-center py-10 text-gray-500">
                                            No Leads Found
                                            {selectedLoanType !== 'all' && (
                                                <div className="mt-2">
                                                    <span className="text-md text-gray-400">
                                                        for {loanTypes.find(type => type._id === selectedLoanType)?.name || 'selected loan type'}
                                                    </span>
                                                    <br />
                                                    <button
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-md mt-2"
                                                        onClick={() => {
                                                            setSelectedLoanType('all');
                                                            localStorage.setItem('selectedLoanType', 'all');
                                                        }}
                                                    >
                                                        Show All Leads
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    displayedLeads.map((lead, index) => (
                                        <tr
                                            key={lead._id}
                                            className={`border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer`}
                                            onClick={() => handleLeadClick(lead)}
                                        >
                                            {/* Checkbox column - only show when checkboxes are visible */}
                                            {(canDeleteLogin() || isUserSuperAdmin) && checkboxVisible && (
                                                <td 
                                                    className="text-left py-3 px-4 text-sm font-bold whitespace-nowrap"
                                                    onClick={(e) => e.stopPropagation()} // Prevent row click when clicking checkbox
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-blue-500"
                                                        checked={checkedRows.includes(index)}
                                                        onChange={() => handleCheckboxChange(index)}
                                                        style={{ width: 18, height: 18 }}
                                                    />
                                                </td>
                                            )}
                                            <td className="text-left py-3 px-4 text-sm font-bold whitespace-nowrap">{index + 1}</td>
                                            <td className="text-left py-3 px-4 text-sm font-bold whitespace-nowrap">
                                                {lead.login_date ? formatDateWithAge(lead.login_date) : '-'}
                                            </td>
                                            <td className="text-left py-3 px-4 text-sm font-bold whitespace-nowrap">
                                             <span className="text-sm font-bold text-wrap">{getLeadField(lead, 'creator_name') || '-'}</span>
                                            </td>
                                            <td className="text-left py-3 px-4 text-sm font-bold whitespace-nowrap">{lead.team_name || '-'}</td>
                                            <td className="text-left py-3 px-4 text-sm font-bold whitespace-wrap">{lead.customer_name || '-'}</td>
                                            <td
                                                className="text-left py-3 px-4 text-md whitespace-nowrap relative"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="relative status-dropdown-container">
                                                    <button
                                                        className="bg-gray-800 text-white py-2 px-3 rounded-md border border-gray-600 hover:bg-gray-700 transition-colors w-full text-left min-w-[150px] status-dropdown-button"
                                                        onClick={(e) => handleStatusDropdownClick(index, e)}
                                                    >
                                                        <div className="font-medium text-white truncate w-full text-md">
                                                            {lead.sub_status ? (
                                                                <div>
                                                                    <div>{typeof lead.sub_status === 'object' ? (lead.sub_status.name || 'Unknown Sub-Status') : (lead.sub_status || 'Unknown Sub-Status')}</div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {typeof lead.status === 'object' ? (lead.status.name || 'Unknown Status') : (lead.status || 'Unknown Status')}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                typeof lead.status === 'object' ? (lead.status.name || 'Select Status') : (lead.status || 'Select Status')
                                                            )}
                                                        </div>
                                                    </button>
                                                    
                                                    {showStatusDropdown === index && (
                                                        <div
                                                            className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] status-dropdown-menu flex flex-col"
                                                            style={{
                                                                top: `${dropdownPosition.top}px`,
                                                                left: `${dropdownPosition.left}px`,
                                                                minWidth: '280px',
                                                                maxWidth: '400px',
                                                                maxHeight: `${dropdownPosition.maxHeight || 400}px`,
                                                                backgroundColor: 'white',
                                                                zIndex: 9999,
                                                                overflowY: 'hidden'
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
                                                                {/* Navigation header for login department */}
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
                                                                        placeholder={showMainStatuses ? "Search main statuses..." : "Search sub-statuses..."}
                                                                        value={statusSearchTerm}
                                                                        onChange={(e) => setStatusSearchTerm(e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Options list */}
                                                            <div 
                                                                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 bg-white rounded-b-lg"
                                                                style={{
                                                                    height: '220px', // Height to show exactly 5 options (44px each including borders)
                                                                    overflowY: 'auto'
                                                                }}
                                                                onScroll={(e) => e.stopPropagation()}
                                                            >
                                                                {loadingStatuses ? (
                                                                    <div className="px-4 py-3 text-center text-gray-400">
                                                                        Loading statuses...
                                                                    </div>
                                                                ) : statusSearchTerm ? (
                                                                    // Search results view
                                                                    (() => {
                                                                        const searchResults = getSearchResults();
                                                                        return searchResults.results.length > 0 ? (
                                                                            searchResults.results.map((result, resultIndex) => {
                                                                                const isCurrentStatus = (
                                                                                    (typeof lead.sub_status === 'object' ? (lead.sub_status?.name || 'Unknown') === result.name : lead.sub_status === result.name) || 
                                                                                    (typeof lead.status === 'object' ? (lead.status?.name || 'Unknown') === result.name : lead.status === result.name)
                                                                                );
                                                                                
                                                                                return (
                                                                                    <div
                                                                                        key={`search-result-${resultIndex}-${result.name}`}
                                                                                        className={`px-4 py-3 cursor-pointer text-black hover:bg-blue-100 transition-colors border-b border-gray-100 last:border-b-0 text-left ${
                                                                                            isCurrentStatus ? 'bg-yellow-400 text-black font-bold' : ''
                                                                                        }`}
                                                                                        style={{
                                                                                            minHeight: '40px' // Ensure consistent option height like LeadCRM
                                                                                        }}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleStatusChange(index, result.name, true);
                                                                                        }}
                                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                                    >
                                                                                        <div className="flex items-center justify-between">
                                                                                            <div className="flex-1">
                                                                                                <div className="text-sm font-medium text-left">
                                                                                                    {result.name}
                                                                                                </div>
                                                                                                <div className="text-xs text-gray-500 mt-1">
                                                                                                    {result.type === 'sub' ? (
                                                                                                        <>Sub-status of: {result.mainStatus}</>
                                                                                                    ) : (
                                                                                                        <>Main status{statusHierarchy[result.name] && statusHierarchy[result.name].length > 0 ? ` (${statusHierarchy[result.name].length} sub-statuses)` : ''}</>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                            {result.type === 'main' && statusHierarchy[result.name] && statusHierarchy[result.name].length > 0 && (
                                                                                                <div className="text-blue-500 text-sm font-medium ml-2">
                                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                                                    </svg>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <div className="px-4 py-3 text-base text-gray-500 text-center">
                                                                                No statuses match your search.
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : getFilteredStatusOptions().length > 0 ? (
                                                                    // Normal view (no search)
                                                                    getFilteredStatusOptions().map((status, statusIndex) => {
                                                                        const statusName = typeof status === 'object' ? status.name : status;
                                                                        const hasSubStatuses = showMainStatuses && statusHierarchy[statusName] && statusHierarchy[statusName].length > 0;
                                                                        
                                                                        // Check if current status matches lead's status
                                                                        const isCurrentStatus = (
                                                                            (typeof lead.sub_status === 'object' ? (lead.sub_status?.name || 'Unknown') === statusName : lead.sub_status === statusName) || 
                                                                            (typeof lead.status === 'object' ? (lead.status?.name || 'Unknown') === statusName : lead.status === statusName)
                                                                        );
                                                                        
                                                                        return (
                                                                            <div
                                                                                key={`status-${statusIndex}-${statusName}`}
                                                                                className={`px-4 py-3 cursor-pointer text-black hover:bg-blue-100 transition-colors border-b border-gray-100 last:border-b-0 text-left ${
                                                                                    isCurrentStatus ? 'bg-yellow-400 text-black font-bold' : ''
                                                                                }`}
                                                                                style={{
                                                                                    minHeight: '40px' // Ensure consistent option height like LeadCRM
                                                                                }}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    
                                                                                    // If this is a main status with sub-statuses, navigate to sub-statuses
                                                                                    if (hasSubStatuses) {
                                                                                        handleMainStatusClick(statusName);
                                                                                    } else {
                                                                                        // Direct status selection
                                                                                        handleStatusChange(index, statusName);
                                                                                    }
                                                                                }}
                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                            >
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="flex-1">
                                                                                        <div className="text-sm font-medium text-left">
                                                                                            {statusName}
                                                                                        </div>
                                                                                        {!showMainStatuses && (
                                                                                            <div className="text-xs text-gray-500 mt-1">
                                                                                                Main: {getMainStatusForSubStatus(statusName)}
                                                                                            </div>
                                                                                        )}
                                                                                        {hasSubStatuses && (
                                                                                            <div className="text-xs text-gray-500 mt-1">
                                                                                                {statusHierarchy[statusName].length} sub-status{statusHierarchy[statusName].length !== 1 ? 'es' : ''}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    {hasSubStatuses && (
                                                                                        <div className="text-blue-500 text-sm font-medium ml-2">
                                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                                            </svg>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="px-4 py-3 text-base text-gray-500 text-center">
                                                                        No {showMainStatuses ? 'statuses' : 'sub-statuses'} available.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-left py-3 px-4 text-md whitespace-nowrap">{renderCurrency(getLeadField(lead, 'total_income') || getLeadField(lead, 'salary'))}</td>
                                            <td className="text-left py-3 px-4 text-md whitespace-nowrap">{getLeadField(lead, 'foir_eligibility') || getLeadField(lead, 'foir') || '-'}</td>
                                            <td className="text-left py-3 px-4 text-md whitespace-nowrap">{renderCurrency(lead.loan_amount)}</td>
                                            <td className="text-left py-3 px-4 text-md whitespace-nowrap">{renderCurrency(getLeadField(lead, 'net_disbursement_amount'))}</td>
                                            <td className="text-left py-3 px-4 text-md whitespace-nowrap">
                                                {getLeadField(lead, 'company_name') || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                
                                {/* Show More Button - appears after displayed leads if there are more */}
                                {hasMoreToShow && displayedLeads.length > 0 && (
                                    <tr>
                                        <td 
                                            colSpan={((canDeleteLogin() || isUserSuperAdmin) && checkboxVisible) ? "13" : "12"}
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
                                            colSpan={((canDeleteLogin() || isUserSuperAdmin) && checkboxVisible) ? "13" : "12"}
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
            
            {/* Add all modals */}
            {/* Operations Modal */}
            <Modal
                title="Update Operations Details"
                open={operationsVisible}
                onCancel={() => setOperationsVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setOperationsVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => {
                            operationsForm
                                .validateFields()
                                .then((values) => {
                                    handleUpdateOperations(selectedLead._id, values);
                                    setOperationsVisible(false);
                                    operationsForm.resetFields();
                                })
                                .catch((info) => {
                                });
                        }}
                    >
                        Submit
                    </Button>
                ]}
            >
                <Form form={operationsForm} layout="vertical">
                    {/* Operations modal form fields */}
                </Form>
            </Modal>

            {/* Important Questions Modal */}
            <Modal
                title="Validate Important Questions"
                open={questionsVisible}
                onCancel={() => setQuestionsVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setQuestionsVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => {
                            handleValidateQuestions(selectedLead._id, questionResponses);
                            setQuestionsVisible(false);
                            setQuestionResponses({});
                        }}
                    >
                        Confirm
                    </Button>
                ]}
                width={700}
            >
                {importantQuestions.length > 0 ? (
                    <div className="questions-container">
                        <h4>Please validate the following important questions:</h4>
                        <Divider />
                        <Form layout="vertical">
                            {importantQuestions.map((question, index) => (
                                <Form.Item key={question.id || index} label={question.question || question.question_text}>
                                    {question.type === "checkbox" ? (
                                        <Checkbox
                                            onChange={(e) => {
                                                setQuestionResponses({
                                                    ...questionResponses,
                                                    [question.id || question._id]: e.target.checked
                                                });
                                            }}
                                            checked={questionResponses[question.id || question._id] || false}
                                        >
                                            Yes
                                        </Checkbox>
                                    ) : (
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="Select response"
                                            onChange={(value) => {
                                                setQuestionResponses({
                                                    ...questionResponses,
                                                    [question.id || question._id]: value
                                                });
                                            }}
                                            value={questionResponses[question.id || question._id] || undefined}
                                        >
                                            {question.options && Array.isArray(question.options) ? 
                                                question.options.map((option, idx) => (
                                                    <Select.Option key={idx} value={option}>
                                                        {option}
                                                    </Select.Option>
                                                ))
                                                : 
                                                ["Yes", "No", "N/A"].map((option, idx) => (
                                                    <Select.Option key={idx} value={option}>
                                                        {option}
                                                    </Select.Option>
                                                ))
                                            }
                                        </Select>
                                    )}
                                </Form.Item>
                            ))}
                        </Form>
                    </div>
                ) : (
                    <div className="empty-questions">
                        <p>No important questions are configured for validation. Please contact your administrator.</p>
                    </div>
                )}
            </Modal>

            {/* Assignment Modal */}
            <Modal
                title="Assign Lead to Users"
                open={assignmentVisible}
                onCancel={() => setAssignmentVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setAssignmentVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => {
                            assignmentForm
                                .validateFields()
                                .then((values) => {
                                    handleAssignToMultipleUsers(selectedLead._id, values.assignedUsers);
                                    setAssignmentVisible(false);
                                    assignmentForm.resetFields();
                                })
                                .catch((info) => {
                                });
                        }}
                    >
                        Assign
                    </Button>
                ]}
            >
                <Form form={assignmentForm} layout="vertical">
                    {/* Assignment form fields */}
                </Form>
            </Modal>

            {/* Bulk Assignment Modal */}
            <Modal
                title="Assign Multiple Leads"
                open={bulkAssignmentVisible}
                onCancel={() => setBulkAssignmentVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setBulkAssignmentVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => {
                            bulkAssignmentForm
                                .validateFields()
                                .then((values) => {
                                    handleBulkAssignment(values.assignedUsers);
                                    setBulkAssignmentVisible(false);
                                    bulkAssignmentForm.resetFields();
                                })
                                .catch((info) => {
                                });
                        }}
                    >
                        Assign
                    </Button>
                ]}
            >
                <Form form={bulkAssignmentForm} layout="vertical">
                    {/* Bulk assignment form fields */}
                </Form>
            </Modal>

            {/* Status Edit Modal */}
            <Modal
                title="Update Lead Status"
                open={statusModalVisible}
                onOk={handleStatusUpdate}
                onCancel={() => setStatusModalVisible(false)}
                confirmLoading={loading}
            >
                <Form layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Current Status">
                                <Input value={editingLead?.status || 'Not Set'} disabled />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Current Sub-Status">
                                <Input value={editingLead?.sub_status || 'Not Set'} disabled />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="New Status" required>
                                <Select
                                    value={newStatus}
                                    onChange={(value) => {
                                        setNewStatus(value);
                                        setNewSubStatus(''); // Clear sub-status when main status changes
                                        fetchSubStatuses(value); // Fetch sub-statuses for new selection
                                    }}
                                    style={{ width: '100%' }}
                                >
                                    {statusOptions.map(option => (
                                        option.value !== 'all' && (
                                            <Option key={option.value} value={option.value}>
                                                {option.label}
                                            </Option>
                                        )
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="New Sub-Status">
                                <Select
                                    value={newSubStatus}
                                    onChange={setNewSubStatus}
                                    style={{ width: '100%' }}
                                    placeholder="Select Sub-Status"
                                    allowClear
                                    loading={availableSubStatuses.length === 0 && newStatus !== ''}
                                >
                                    {availableSubStatuses.map(option => (
                                        <Option key={option.value} value={option.value}>
                                            {option.label}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    💡 Selecting a new status will load corresponding sub-statuses
                </div>
            </Modal>

            {/* Filter Popup - Smooth with animations */}
            {showFilterPopup && (
                <div 
                    className="fixed inset-0 bg-transparent bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn"
                    onClick={(e) => {
                        // Close on overlay click
                        if (e.target === e.currentTarget) {
                            setShowFilterPopup(false);
                            clearSearchStates();
                        }
                    }}
                    style={{
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div 
                        className="bg-[#1b2230] border border-gray-600 rounded-lg shadow-2xl p-6 w-[800px] max-w-[90vw] h-[600px] flex flex-col relative transform transition-all duration-300 ease-out"
                        style={{
                            animation: 'slideUp 0.3s ease-out'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Filter className="w-6 h-6 text-blue-400" />
                                Filter Login
                            </h2>
                            <button
                                onClick={() => {
                                    setShowFilterPopup(false);
                                    clearSearchStates();
                                }}
                                className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg p-2 transition-all duration-200 text-2xl leading-none"
                                title="Close"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0 relative">
                            {/* Left side - Filter Categories */}
                            <div className="col-span-1 border-r border-gray-600 pr-4 overflow-y-auto max-h-full relative" style={{scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #1F2937'}}>
                                <h3 className="text-base font-medium text-gray-300 mb-4 sticky top-0 bg-[#1b2230] py-2 z-10">Filter Categories</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setSelectedFilterCategory('leadDate')}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'leadDate'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-[#2a3441]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Calendar className="w-5 h-5" />
                                                <span className="text-base"> Login Date Filters</span>
                                            </div>
                                            {getFilterCategoryCount('leadDate') > 0 && (
                                                <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                                                    {getFilterCategoryCount('leadDate')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('date')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'date'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-[#2a3441]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                Login Age
                                            </div>
                                            {getFilterCategoryCount('date') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('date')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('createdBy')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'createdBy'
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
                                        onClick={() => setSelectedFilterCategory('status')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'status'
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
                                        onClick={() => setSelectedFilterCategory('team')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'team'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-[#2a3441]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Team Name
                                            </div>
                                            {getFilterCategoryCount('team') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('team')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('assignedTL')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'assignedTL'
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
                                        onClick={() => setSelectedFilterCategory('loginDepartment')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'loginDepartment'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-[#2a3441]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                Login Person/Department
                                            </div>
                                            {getFilterCategoryCount('loginDepartment') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('loginDepartment')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('channelName')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'channelName'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-[#2a3441]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TeamOutlined className="w-4 h-4" />
                                                Channel
                                            </div>
                                            {getFilterCategoryCount('channelName') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('channelName')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('income')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'income'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-[#2a3441]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                Total Income
                                            </div>
                                            {getFilterCategoryCount('income') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('income')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('leadActivity')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                            selectedFilterCategory === 'leadActivity'
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
                                </div>
                            </div>

                            {/* Right side - Selected Category Options */}
                            <div className="col-span-2 overflow-y-auto max-h-full relative" style={{scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #1F2937'}}>
                                <div className="h-full pr-2">
                                {/* Date Filters */}
                                {selectedFilterCategory === 'leadDate' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Login Date Filters</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">From Date</label>
                                                <input
                                                    type="date"
                                                    value={filterOptions.dateFrom}
                                                    onChange={(e) => setFilterOptions({...filterOptions, dateFrom: e.target.value})}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">To Date</label>
                                                <input
                                                    type="date"
                                                    value={filterOptions.dateTo}
                                                    onChange={(e) => setFilterOptions({...filterOptions, dateTo: e.target.value})}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setFilterOptions({ ...filterOptions, dateFrom: '', dateTo: '' })}
                                            className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Clear Date Range
                                        </button>

                                        {/* Disbursement Date Filter */}
                                        <div className="border-t border-gray-600 pt-6 mt-6">
                                            <h4 className="text-sm font-medium text-gray-300 mb-4">Disbursement Date Range</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">From Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.disbursementDateFrom}
                                                        onChange={(e) => setFilterOptions({...filterOptions, disbursementDateFrom: e.target.value})}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">To Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.disbursementDateTo}
                                                        onChange={(e) => setFilterOptions({...filterOptions, disbursementDateTo: e.target.value})}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setFilterOptions({ ...filterOptions, disbursementDateFrom: '', disbursementDateTo: '' })}
                                                className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Clear Disbursement Date Range
                                            </button>
                                        </div>

                                        {/* No Activity Filter */}
                                        <div className="border-t border-gray-600 pt-6 mt-6">
                                            <h4 className="text-sm font-medium text-gray-300 mb-4">No Activity Filter</h4>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">
                                                        Show leads with no activity since this date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.noActivityDate || ''}
                                                        onChange={(e) => setFilterOptions({ 
                                                            ...filterOptions, 
                                                            noActivityDate: e.target.value 
                                                        })}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                        placeholder="Select date"
                                                    />
                                                </div>
                                                {filterOptions.noActivityDate && (
                                                    <div className="space-y-2">
                                                        {isFilteringActivity && (
                                                            <div className="flex items-center space-x-2 text-xs text-blue-400">
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                                                                <span>Checking activities...</span>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => setFilterOptions({ ...filterOptions, noActivityDate: '' })}
                                                            className="text-xs text-blue-400 hover:text-blue-300"
                                                        >
                                                            Clear No Activity Filter
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Login Age Filter */}
                                {selectedFilterCategory === 'date' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Login Age Range (Days)</h3>
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">From Age (Days)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">To Age (Days)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    placeholder="365"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Clear Age Range
                                        </button>
                                    </div>
                                )}

                                {selectedFilterCategory === 'leads' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Login Status</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">
                                                    Lead Status
                                                </label>
                                                <select
                                                    value={filterOptions.leadStatus}
                                                    onChange={(e) => setFilterOptions({...filterOptions, leadStatus: e.target.value})}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="">All Status</option>
                                                    <option value="Active Login">Active Login</option>
                                                    <option value="Approve">Approve</option>
                                                    <option value="Disbursed">Disbursed</option>
                                                    <option value="Lost by Mistake">Lost by Mistake</option>
                                                    <option value="Lost Login">Lost Login</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {selectedFilterCategory === 'date' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Login Date Range</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">From Date</label>
                                                <input
                                                    type="date"
                                                    value={filterOptions.dateFrom}
                                                    onChange={(e) => setFilterOptions({...filterOptions, dateFrom: e.target.value})}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">To Date</label>
                                                <input
                                                    type="date"
                                                    value={filterOptions.dateTo}
                                                    onChange={(e) => setFilterOptions({...filterOptions, dateTo: e.target.value})}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setFilterOptions({ ...filterOptions, dateFrom: '', dateTo: '' })}
                                            className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Clear Date Range
                                        </button>
                                    </div>
                                )}
                                
                                {selectedFilterCategory === 'team' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Team Name</h3>
                                        
                                        {/* Search bar for teams */}
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search teams..."
                                                    value={teamNameSearch}
                                                    onChange={(e) => setTeamNameSearch(e.target.value)}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                                        
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {getFilteredTeams().map(team => (
                                                <label key={team} className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        value={team}
                                                        checked={Array.isArray(filterOptions.teamName) ? 
                                                            filterOptions.teamName.includes(team) : 
                                                            filterOptions.teamName === team}
                                                        onChange={(e) => {
                                                            const currentTeams = Array.isArray(filterOptions.teamName) ? 
                                                                filterOptions.teamName : 
                                                                (filterOptions.teamName ? [filterOptions.teamName] : []);
                                                            
                                                            if (e.target.checked) {
                                                                // Add team to selection
                                                                setFilterOptions({
                                                                    ...filterOptions, 
                                                                    teamName: [...currentTeams, team]
                                                                });
                                                            } else {
                                                                // Remove team from selection
                                                                setFilterOptions({
                                                                    ...filterOptions, 
                                                                    teamName: currentTeams.filter(selectedTeam => selectedTeam !== team)
                                                                });
                                                            }
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">{team}</span>
                                                </label>
                                            ))}
                                            
                                            {/* Show "No results" message when search yields no results */}
                                            {teamNameSearch && getFilteredTeams().length === 0 && (
                                                <div className="text-gray-400 text-sm py-2 text-center">
                                                    No teams found matching "{teamNameSearch}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {selectedFilterCategory === 'createdBy' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Created By</h3>
                                        
                                        {/* Search bar for creators */}
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search creators..."
                                                    value={createdBySearch}
                                                    onChange={(e) => setCreatedBySearch(e.target.value)}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                                            {getFilteredCreators().map(creator => (
                                                <label key={creator} className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        value={creator}
                                                        checked={Array.isArray(filterOptions.createdBy) ? 
                                                            filterOptions.createdBy.includes(creator) : 
                                                            filterOptions.createdBy === creator}
                                                        onChange={(e) => {
                                                            const currentCreators = Array.isArray(filterOptions.createdBy) ? 
                                                                filterOptions.createdBy : 
                                                                (filterOptions.createdBy ? [filterOptions.createdBy] : []);
                                                            
                                                            if (e.target.checked) {
                                                                // Add creator to selection
                                                                setFilterOptions({
                                                                    ...filterOptions, 
                                                                    createdBy: [...currentCreators, creator]
                                                                });
                                                            } else {
                                                                // Remove creator from selection
                                                                setFilterOptions({
                                                                    ...filterOptions, 
                                                                    createdBy: currentCreators.filter(selectedCreator => selectedCreator !== creator)
                                                                });
                                                            }
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">{creator}</span>
                                                </label>
                                            ))}
                                            
                                            {/* Show "No results" message when search yields no results */}
                                            {createdBySearch && getFilteredCreators().length === 0 && (
                                                <div className="text-gray-400 text-sm py-2 text-center">
                                                    No creators found matching "{createdBySearch}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Quick Filters */}
                                {selectedFilterCategory === 'leadActivity' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Quick Filters</h3>
                                        <div className="space-y-4">
                                            {/* Check Duplicate Leads Filter */}
                                            <div>
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={filterOptions.checkDuplicateLeads || false}
                                                        onChange={(e) => {
                                                            setFilterOptions({ 
                                                                ...filterOptions, 
                                                                checkDuplicateLeads: e.target.checked
                                                            });
                                                            setTimeout(() => triggerFilterUpdate(), 0);
                                                        }}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">Check Duplicate Leads</span>
                                                </label>
                                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                                    Show leads with same phone number or alternative phone number
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Check Duplicate Leads Filter */}
                                {selectedFilterCategory === 'duplicateLeads' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Check Duplicate Leads</h3>
                                        <div className="space-y-4">
                                            <p className="text-gray-400 text-sm mb-4">
                                                This filter will show leads that have the same phone number or alternative phone number.
                                            </p>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={filterOptions.checkDuplicateLeads || false}
                                                    onChange={(e) => {
                                                        setFilterOptions({ 
                                                            ...filterOptions, 
                                                            checkDuplicateLeads: e.target.checked
                                                        });
                                                        setTimeout(() => triggerFilterUpdate(), 0);
                                                    }}
                                                    className="accent-blue-500 mr-2"
                                                />
                                                <span className="text-gray-300">Show Only Duplicate Leads</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Disbursement Date Filter */}
                                {selectedFilterCategory === 'disbursementDate' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Disbursement Date Range</h3>
                                        <div className="space-y-4">
                                            <p className="text-gray-400 text-sm mb-4">
                                                Filter leads by disbursement date. You can specify from date, to date, or both.
                                            </p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">From Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.disbursementDateFrom}
                                                        onChange={(e) => setFilterOptions({...filterOptions, disbursementDateFrom: e.target.value})}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">To Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.disbursementDateTo}
                                                        onChange={(e) => setFilterOptions({...filterOptions, disbursementDateTo: e.target.value})}
                                                        className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Status Filter */}
                                {selectedFilterCategory === 'status' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Status</h3>
                                        
                                        {/* Search bar for statuses */}
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search statuses..."
                                                    value={statusSearch}
                                                    onChange={(e) => setStatusSearch(e.target.value)}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                                                    // Filtering happens automatically via useMemo when filterOptions changes
                                                }}
                                                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                            >
                                                Clear All
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Get all available statuses
                                                    const allAvailableStatuses = [];
                                                    Object.entries(statusHierarchy).forEach(([mainStatus, subStatuses]) => {
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
                                                    // Filtering happens automatically via useMemo when filterOptions changes
                                                }}
                                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                            >
                                                Select All
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
                                                                    setTimeout(() => triggerFilterUpdate(), 0);
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
                                                                                    setTimeout(() => triggerFilterUpdate(), 0);
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
                                                // Show "No results" message when search yields no results
                                                <div className="text-gray-400 text-sm py-2 text-center">
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

                                {/* Assigned TL Filter */}
                                {selectedFilterCategory === 'assignedTL' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Assigned TL</h3>
                                        
                                        {/* Search bar for assigned TLs */}
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search TLs..."
                                                    value={assignedTLSearch}
                                                    onChange={(e) => setAssignedTLSearch(e.target.value)}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                                        
                                        {/* Select All / Clear All buttons */}
                                        {!loadingEmployees && getFilteredAssignedTLs().length > 0 && (
                                            <div className="mb-3 flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const allFilteredTLs = getFilteredAssignedTLs();
                                                        setFilterOptions({
                                                            ...filterOptions,
                                                            assignedTL: allFilteredTLs
                                                        });
                                                    }}
                                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setFilterOptions({
                                                            ...filterOptions,
                                                            assignedTL: []
                                                        });
                                                    }}
                                                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                        
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {/* Show loading state while fetching employees */}
                                            {loadingEmployees ? (
                                                <div className="text-gray-400 text-sm py-2 text-center">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                                    Loading team leaders...
                                                </div>
                                            ) : (
                                                <>
                                                    {getFilteredAssignedTLs().map(tl => (
                                                        <label key={tl} className="flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                value={tl}
                                                                checked={Array.isArray(filterOptions.assignedTL) ? 
                                                                    filterOptions.assignedTL.includes(tl) : 
                                                                    filterOptions.assignedTL === tl}
                                                                onChange={(e) => {
                                                                    const currentTLs = Array.isArray(filterOptions.assignedTL) ? 
                                                                        filterOptions.assignedTL : 
                                                                        (filterOptions.assignedTL ? [filterOptions.assignedTL] : []);
                                                                    
                                                                    if (e.target.checked) {
                                                                        // Add TL to selection
                                                                        setFilterOptions({
                                                                            ...filterOptions, 
                                                                            assignedTL: [...currentTLs, tl]
                                                                        });
                                                                    } else {
                                                                        // Remove TL from selection
                                                                        setFilterOptions({
                                                                            ...filterOptions, 
                                                                            assignedTL: currentTLs.filter(selectedTL => selectedTL !== tl)
                                                                        });
                                                                    }
                                                                }}
                                                                className="accent-blue-500 mr-2"
                                                            />
                                                            <span className="text-gray-300">{tl}</span>
                                                        </label>
                                                    ))}
                                                    
                                                    {/* Show "No results" message when search yields no results */}
                                                    {assignedTLSearch && getFilteredAssignedTLs().length === 0 && (
                                                        <div className="text-gray-400 text-sm py-2 text-center">
                                                            No TLs found matching "{assignedTLSearch}"
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show message when no employees loaded */}
                                                    {!loadingEmployees && employees.length === 0 && !assignedTLSearch && getFilteredAssignedTLs().length === 0 && (
                                                        <div className="text-gray-400 text-sm py-2 text-center">
                                                            No team leaders found
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Channel Name Filter */}
                                {selectedFilterCategory === 'channelName' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Channel Name</h3>
                                        
                                        {/* Search bar for channels */}
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search channels..."
                                                    value={channelNameSearch}
                                                    onChange={(e) => setChannelNameSearch(e.target.value)}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <SearchOutlined className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            </div>
                                        </div>
                                        
                                        {/* Channel options */}
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {getFilteredChannels().map((channel, index) => (
                                                <label key={index} className="flex items-center cursor-pointer p-2 rounded hover:bg-[#2a3441] transition-colors">
                                                    <Checkbox
                                                        checked={filterOptions.channelName?.includes(channel) || false}
                                                        onChange={(e) => {
                                                            const isChecked = e.target.checked;
                                                            const currentChannels = filterOptions.channelName || [];
                                                            
                                                            if (isChecked) {
                                                                setFilterOptions({
                                                                    ...filterOptions,
                                                                    channelName: [...currentChannels, channel]
                                                                });
                                                            } else {
                                                                setFilterOptions({
                                                                    ...filterOptions,
                                                                    channelName: currentChannels.filter(c => c !== channel)
                                                                });
                                                            }
                                                        }}
                                                        className="mr-3"
                                                    />
                                                    <span className="text-gray-300 flex-1">
                                                        {channel}
                                                    </span>
                                                </label>
                                            ))}
                                            
                                            {channelNameSearch && getFilteredChannels().length === 0 && (
                                                <div className="text-gray-400 text-sm py-2 text-center">
                                                    No channels found matching "{channelNameSearch}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Login Person/Department Filter */}
                                {selectedFilterCategory === 'loginDepartment' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Login Person/Department</h3>
                                        
                                        {/* Search bar for login employees */}
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search login employees..."
                                                    value={loginDepartmentSearch}
                                                    onChange={(e) => setLoginDepartmentSearch(e.target.value)}
                                                    className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 pl-10 text-gray-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                {loginDepartmentSearch && (
                                                    <button
                                                        onClick={() => setLoginDepartmentSearch('')}
                                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Select All / Clear All buttons */}
                                        {!loadingAllEmployees && getFilteredLoginDepartments().length > 0 && (
                                            <div className="mb-3 flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const allFilteredEmployees = getFilteredLoginDepartments();
                                                        setFilterOptions({
                                                            ...filterOptions,
                                                            loginDepartment: allFilteredEmployees
                                                        });
                                                    }}
                                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setFilterOptions({
                                                            ...filterOptions,
                                                            loginDepartment: []
                                                        });
                                                    }}
                                                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                        
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {/* Show loading state while fetching employees */}
                                            {loadingAllEmployees ? (
                                                <div className="text-gray-400 text-sm py-2 text-center">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                                    Loading login employees...
                                                </div>
                                            ) : (
                                                <>
                                                    {getFilteredLoginDepartments().map(employee => (
                                                        <label key={employee} className="flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                value={employee}
                                                                checked={Array.isArray(filterOptions.loginDepartment) ? 
                                                                    filterOptions.loginDepartment.includes(employee) : 
                                                                    filterOptions.loginDepartment === employee}
                                                                onChange={(e) => {
                                                                    const currentEmployees = Array.isArray(filterOptions.loginDepartment) ? 
                                                                        filterOptions.loginDepartment : 
                                                                        (filterOptions.loginDepartment ? [filterOptions.loginDepartment] : []);
                                                                    
                                                                    if (e.target.checked) {
                                                                        // Add employee to selection
                                                                        setFilterOptions({
                                                                            ...filterOptions, 
                                                                            loginDepartment: [...currentEmployees, employee]
                                                                        });
                                                                    } else {
                                                                        // Remove employee from selection
                                                                        setFilterOptions({
                                                                            ...filterOptions, 
                                                                            loginDepartment: currentEmployees.filter(selectedEmployee => selectedEmployee !== employee)
                                                                        });
                                                                    }
                                                                }}
                                                                className="accent-blue-500 mr-2"
                                                            />
                                                            <span className="text-gray-300">{employee}</span>
                                                        </label>
                                                    ))}
                                                    
                                                    {/* Show "No results" message when search yields no results */}
                                                    {loginDepartmentSearch && getFilteredLoginDepartments().length === 0 && (
                                                        <div className="text-gray-400 text-sm py-2 text-center">
                                                            No employees found matching "{loginDepartmentSearch}"
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show message when no employees loaded */}
                                                    {!loadingAllEmployees && allEmployees.length === 0 && !loginDepartmentSearch && getFilteredLoginDepartments().length === 0 && (
                                                        <div className="text-gray-400 text-sm py-2 text-center">
                                                            No login employees found
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                
                                {selectedFilterCategory === 'other' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Campaign Name</h3>
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="campaignName"
                                                    value=""
                                                    checked={!filterOptions.campaignName}
                                                    onChange={(e) => setFilterOptions({...filterOptions, campaignName: ''})}
                                                    className="accent-blue-500 mr-2"
                                                />
                                                <span className="text-gray-300">All Campaigns</span>
                                            </label>
                                            {[...new Set(leads.map(lead => lead.operations_channel_name).filter(Boolean))].sort().map(campaign => (
                                                <label key={campaign} className="flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                                    name="campaignName"
                                                                    value={campaign}
                                                                    checked={filterOptions.campaignName === campaign}
                                                                    onChange={(e) => setFilterOptions({...filterOptions, campaignName: e.target.value})}
                                                                    className="accent-blue-500 mr-2"
                                                                />
                                                                <span className="text-gray-300">{campaign}</span>
                                                            </label>
                                                        ))}
                                        </div>
                                    </div>
                                )}

                                {/* Income Filter */}
                                {selectedFilterCategory === 'income' && (
                                    <div>
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Total Income Filter</h3>
                                        
                                        {/* Income Range Filter */}
                                        <div className="mb-6">
                                            <h4 className="text-sm font-medium text-gray-400 mb-3">Income Range</h4>
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <label className="block text-xs text-gray-400 mb-1">From</label>
                                                    <input
                                                        type="number"
                                                        placeholder="Min income"
                                                        value={filterOptions.incomeRangeFrom}
                                                        onChange={(e) => setFilterOptions({...filterOptions, incomeRangeFrom: e.target.value})}
                                                        className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-xs text-gray-400 mb-1">To</label>
                                                    <input
                                                        type="number"
                                                        placeholder="Max income"
                                                        value={filterOptions.incomeRangeTo}
                                                        onChange={(e) => setFilterOptions({...filterOptions, incomeRangeTo: e.target.value})}
                                                        className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Income Sorting */}
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-400 mb-3">Sort by Income</h4>
                                            <div className="space-y-2">
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="incomeSortOrder"
                                                        value=""
                                                        checked={!filterOptions.incomeSortOrder}
                                                        onChange={(e) => setFilterOptions({...filterOptions, incomeSortOrder: ''})}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">No sorting</span>
                                                </label>
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="incomeSortOrder"
                                                        value="desc"
                                                        checked={filterOptions.incomeSortOrder === 'desc'}
                                                        onChange={(e) => setFilterOptions({...filterOptions, incomeSortOrder: e.target.value})}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">Highest to Lowest</span>
                                                </label>
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="incomeSortOrder"
                                                        value="asc"
                                                        checked={filterOptions.incomeSortOrder === 'asc'}
                                                        onChange={(e) => setFilterOptions({...filterOptions, incomeSortOrder: e.target.value})}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">Lowest to Highest</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filter Actions */}
                        <div className="flex justify-between gap-[250px] items-center mt-6 pt-4 border-t border-gray-600 flex-shrink-0">
                            <button
                                onClick={() => {
                                    // Clear all filters - reset to completely empty state
                                    setFilterOptions({
                                        leadStatus: '',
                                        dateFrom: '', // Clear all date filters
                                        dateTo: '',   // Clear all date filters
                                        teamName: [],
                                        campaignName: [],
                                        createdBy: [],
                                        assignedTL: [], // Clear assigned TL filter
                                        loginDepartment: [], // Clear login department filter
                                        channelName: [], // Clear channel name filter
                                        loanTypeFilter: [], // Clear loan type filter
                                        noActivityDate: '',
                                        selectedStatuses: [], // Clear status filters
                                        checkDuplicateLeads: false, // Clear duplicate leads filter
                                        disbursementDateFrom: '', // Clear disbursement date from
                                        disbursementDateTo: '', // Clear disbursement date to
                                        
                                        // Enhanced date filters
                                        leadDateFrom: '', // Clear lead date from
                                        leadDateTo: '', // Clear lead date to
                                        fileSentToLoginDateFrom: '', // Clear file sent date from
                                        fileSentToLoginDateTo: '', // Clear file sent date to
                                        fileSentToLogin: false, // Clear file sent to login filter
                                        
                                        incomeRangeFrom: '', // Clear income range from
                                        incomeRangeTo: '', // Clear income range to
                                        incomeSortOrder: '' // Clear income sort order
                                    });
                                    // Also clear search states
                                    clearSearchStates();
                                    // Increment filter revision to force re-computation
                                    triggerFilterUpdate();
                                }}
                                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
                            >
                                Clear all filter
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowFilterPopup(false);
                                        clearSearchStates();
                                    }}
                                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowFilterPopup(false);
                                        clearSearchStates();
                                        // Increment filter revision to force re-computation
                                        triggerFilterUpdate();
                                    }}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fallback Unsaved Changes Modal for Obligation Section */}
            {showObligationUnsavedModal && (
                <div className="fixed inset-0 bg-transparent bg-opacity-50 z-[9999] flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 m-4 max-w-md w-full relative z-[9999]">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Unsaved Changes</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                You have unsaved changes in the obligation section. Do you want to save your changes before switching tabs?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleStayOnCurrentTab}
                                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                                >
                                    Stay Here
                                </button>
                                <button
                                    onClick={handleContinueWithoutSaving}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                >
                                    Continue Without Saving
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lead Details Modal - Lazy loaded for better performance */}
            {showLeadDetails && selectedLead && (
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-screen bg-black">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                            <p className="text-cyan-300 text-lg">Loading lead details...</p>
                        </div>
                    </div>
                }>
                    <LeadDetails
                        lead={selectedLead}
                        user={user}
                        onBack={() => {
                            setShowLeadDetails(false);
                            setSelectedLead(null);
                            // Refresh leads after viewing details to ensure table shows latest data
                            fetchLoginDepartmentLeads();
                        }}
                        onLeadUpdate={(updatedLead) => {
                            // Update the lead in the leads array
                            setLeads(prevLeads => 
                                prevLeads.map(lead => 
                                    lead._id === updatedLead._id ? updatedLead : lead
                                )
                            );
                            // Update selected lead
                            setSelectedLead(updatedLead);
                        }}
                    />
                </Suspense>
            )}

            </div>
        </div>
        </div>
        </div>
        </div>
        </React.Fragment>
    );
};

// ⚡ PERFORMANCE: Memoize component to prevent unnecessary re-renders
export default React.memo(LoginCRM);
