import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import ReactDOM from "react-dom";
import SearchableSelect from "./SearchableSelect";
// Lazy-loaded for duplicate lead view
const LeadDetails = lazy(() => import('./LeadDetails'));
import {
  saveCurrentLeadInfoSection,
  getFinalLeadData,
  clearTempLeadData,
  hasCompleteLeadData,
  loadSavedLeadInfoData,
  getTempLeadData,
  saveObligationData
} from "../utils/leadDataHelper";
import { leadEvents } from "../utils/auth";
import { getISTDateYMD, toISTDateYMD, getISTTimestamp } from '../utils/dateUtils';
import ReassignmentPanel from './sections/ReassignmentPanel';

// API base URL
const API_BASE_URL = '/api';

// --- Helper for formatting currency with commas (Indian style) ---
function formatINR(value) {
  // Ensure value is a string before attempting replace
  const stringValue = String(value);
  // Remove all commas, non-digit and non-dot characters for clean parsing
  const cleaned = stringValue.replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";

  // Handle possible multiple dots (only keep the first for decimals)
  let [intPart, decPart] = cleaned.split(".");
  // Remove leading zeros from integer part unless it's just "0"
  if (intPart.length > 1 && intPart.startsWith("0")) intPart = intPart.replace(/^0+/, "") || "0";

  // Insert commas Indian style
  let lastThree = intPart.slice(-3);
  let otherNumbers = intPart.slice(0, -3);
  otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  let formatted = otherNumbers ? otherNumbers + "," + lastThree : lastThree;

  // Append decimal part if it exists, limited to two digits
  if (decPart !== undefined) formatted += "." + decPart.slice(0, 2);
  return formatted;
}
// --- Modified parseINR to return integer values without decimals ---
function parseINR(formatted) {
  if (typeof formatted !== 'string') {
    formatted = String(formatted); // Ensure input is a string
  }
  // Remove all commas from the formatted string
  const withoutCommas = formatted.replace(/,/g, "");
  // Get the part before the decimal point (integer part)
  const integerPartString = withoutCommas.split(".")[0];
  // Parse as an integer. Use 10 for radix to ensure base-10 parsing.
  // If parsing results in NaN (e.g., empty string or non-numeric input), default to 0.
  return parseInt(integerPartString, 10) || 0;
}

// --- API Functions ---
// Get userId from localStorage
export const getUserId = () => {
  try {
    const userId = localStorage.getItem('userId');
    if (userId) return userId;

    // Try to get from user object
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      return parsedUser.id || parsedUser._id || parsedUser.user_id;
    }

    return null;
  } catch (error) {
    return null;
  }
};

// --- User Data Initialization Function ---
// Initialize user data for browser compatibility and API integration
// This function ensures user data is available for lead creation and assignment
const initializeUserData = () => {
  try {
    // Check if we're in a browser environment and localStorage is available
    if (typeof window !== 'undefined' && window.localStorage) {

      // First attempt: Try to get 'userData' from localStorage
      const userData = localStorage.getItem('userData');
      if (userData) {
        // Parse and store user data in window object for global access
        const parsedUserData = JSON.parse(userData);
        
        // Validate department_id before storing
        if (parsedUserData.department_id && 
            (parsedUserData.department_id === 'undefined' || 
             parsedUserData.department_id === 'null' || 
             parsedUserData.department_id === 'default_department_id' ||
             parsedUserData.department_id === '68529a2e8d7cdc3a71c482a0' || // Block specific invalid ID
             parsedUserData.department_id.trim() === '')) {
          delete parsedUserData.department_id;
        }
        
        window.currentUserData = parsedUserData;
        return;
      }

      // Second attempt: Try to get 'user' from localStorage as fallback
      const user = localStorage.getItem('user');
      if (user) {
        // Parse and store user data in window object for global access
        const parsedUser = JSON.parse(user);
        
        // Validate department_id before storing
        if (parsedUser.department_id && 
            (parsedUser.department_id === 'undefined' || 
             parsedUser.department_id === 'null' || 
             parsedUser.department_id === 'default_department_id' ||
             parsedUser.department_id === '68529a2e8d7cdc3a71c482a0' || // Block specific invalid ID
             parsedUser.department_id.trim() === '')) {
          delete parsedUser.department_id;
        }
        
        window.currentUserData = parsedUser;
        return;
      }

      // Third attempt: Try to get 'userId' as minimal fallback
      const userId = localStorage.getItem('userId');
      if (userId) {
        // Get department_id from localStorage if available and valid
        const departmentId = localStorage.getItem('department_id');
        const validDepartmentId = departmentId && 
                                 departmentId !== 'undefined' && 
                                 departmentId !== 'null' && 
                                 departmentId !== 'default_department_id' && 
                                 departmentId.trim() !== '';
        
        // Create minimal user object with just user_id and id fields
        // Only include department_id if it's valid
        window.currentUserData = { 
          user_id: userId, 
          id: userId,
          ...(validDepartmentId ? { department_id: departmentId } : {})
        };
        return;
      }
    }
  } catch (error) {
    // If initialization fails, use default user object
  }

  // Default fallback: If no user data found, create default user object
  // This prevents API errors when user data is not available
  // Don't include department_id in default fallback to prevent validation errors
  window.currentUserData = { user_id: 'default_user', id: 'default_user' };
};

// Cache for API responses to improve performance
const apiCache = {
  loanTypes: null,
  loanTypesTimestamp: 0,
  settings: null,
  settingsTimestamp: 0,
  bankNames: null,
  bankNamesTimestamp: 0,
  companyCategories: null,
  companyCategoriesTimestamp: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Fetch loan types from API with caching
const fetchLoanTypes = async () => {
  // Check cache first
  const now = Date.now();
  if (apiCache.loanTypes && (now - apiCache.loanTypesTimestamp) < CACHE_DURATION) {
    return apiCache.loanTypes;
  }

  try {
    const userId = getUserId();
    if (!userId) {
      const fallbackData = [
        { id: 'personal_loan', name: 'Personal Loan' },
        { id: 'home_loan', name: 'Home Loan' },
        { id: 'business_loan', name: 'Business Loan' },
        { id: 'car_loan', name: 'Car Loan' },
        { id: 'education_loan', name: 'Education Loan' }
      ];
      apiCache.loanTypes = fallbackData;
      apiCache.loanTypesTimestamp = now;
      return fallbackData;
    }

    const response = await fetch(`${API_BASE_URL}/loan-types/?user_id=${userId}`);
    if (!response.ok) {
      return [
        { id: 'personal_loan', name: 'Personal Loan' },
        { id: 'home_loan', name: 'Home Loan' },
        { id: 'business_loan', name: 'Business Loan' },
        { id: 'car_loan', name: 'Car Loan' },
        { id: 'education_loan', name: 'Education Loan' }
      ];
    }
    const data = await response.json();

    // Handle different possible response structures
    let result = [];
    if (Array.isArray(data)) {
      result = data;
    } else if (data.loan_types && Array.isArray(data.loan_types)) {
      result = data.loan_types;
    } else if (data.data && Array.isArray(data.data)) {
      result = data.data;
    }

    // Cache successful response
    apiCache.loanTypes = result;
    apiCache.loanTypesTimestamp = now;
    return result;
  } catch (error) {
    return [
      { id: 'personal_loan', name: 'Personal Loan' },
      { id: 'home_loan', name: 'Home Loan' },
      { id: 'business_loan', name: 'Business Loan' },
      { id: 'car_loan', name: 'Car Loan' },
      { id: 'education_loan', name: 'Education Loan' }
    ];
  }
};

// Check mobile number for duplicates
const checkMobileNumber = async (mobileNumber, loanTypeName = null) => {
  try {
    const userId = getUserId();
    if (!userId) return null;

    let url = `${API_BASE_URL}/leads/check-phone/${encodeURIComponent(mobileNumber)}?user_id=${userId}`;

    // Add loan type parameter if provided
    if (loanTypeName) {
      url += `&loan_type_name=${encodeURIComponent(loanTypeName)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // If leads are found, check reassignment eligibility for the first lead
    if (data && data.found && data.leads && data.leads.length > 0) {
      try {
        const leadId = data.leads[0].id;
        const eligibilityUrl = `${API_BASE_URL}/leads/${leadId}/reassignment-eligibility?user_id=${userId}`;
        
        const eligibilityResponse = await fetch(eligibilityUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (eligibilityResponse.ok) {
          const eligibilityData = await eligibilityResponse.json();
          
          // Add reassignment eligibility data to the response
          data.can_reassign = eligibilityData.can_reassign;
          data.reassignment_reason = eligibilityData.reason;
          data.days_elapsed = eligibilityData.days_elapsed;
          data.reassignment_period = eligibilityData.reassignment_period;
          data.days_remaining = eligibilityData.days_remaining;
          data.is_manager_permission_required = eligibilityData.is_manager_permission_required;
          data.file_sent_to_login = eligibilityData.file_sent_to_login;
          data.status = eligibilityData.status;
          data.sub_status = eligibilityData.sub_status;
          
          // If eligibility response includes lead data, merge it with existing lead data
          if (eligibilityData.lead) {
            data.leads[0] = { 
              ...data.leads[0], 
              ...eligibilityData.lead,
              // Ensure these critical fields from eligibility data are preserved
              file_sent_to_login: eligibilityData.file_sent_to_login,
              status: eligibilityData.status,
              sub_status: eligibilityData.sub_status,
              login_department_sent_date: eligibilityData.lead.login_department_sent_date
            };
          }
        }
      } catch (eligibilityError) {
        // Continue without eligibility data
      }
    }
    
    return data;
  } catch (error) {
    return null;
  }
};

// Fetch settings data with caching
const fetchSettingsData = async () => {
  // Check cache first
  const now = Date.now();
  if (apiCache.settings && (now - apiCache.settingsTimestamp) < CACHE_DURATION) {
    return apiCache.settings;
  }

  try {
    const userId = getUserId();
    if (!userId) return {
      campaignNames: [
        { id: 'default', name: 'Default Campaign' },
        { id: 'online', name: 'Online Campaign' },
        { id: 'offline', name: 'Offline Campaign' }
      ],
      dataCodes: [
        { id: 'hot', code: 'HOT' },
        { id: 'warm', code: 'WARM' },
        { id: 'cold', code: 'COLD' }
      ]
    };

    const response = await fetch(`${API_BASE_URL}/settings/overview?user_id=${userId}`);
    if (!response.ok) {
      const fallbackData = {
        campaignNames: [
          { id: 'default', name: 'Default Campaign' },
          { id: 'online', name: 'Online Campaign' },
          { id: 'offline', name: 'Offline Campaign' }
        ],
        dataCodes: [
          { id: 'hot', code: 'HOT' },
          { id: 'warm', code: 'WARM' },
          { id: 'cold', code: 'COLD' }
        ]
      };
      apiCache.settings = fallbackData;
      apiCache.settingsTimestamp = now;
      return fallbackData;
    }
    const data = await response.json();
    const result = {
      campaignNames: data.campaign_names || [],
      dataCodes: data.data_codes || []
    };
    
    // Cache successful response
    apiCache.settings = result;
    apiCache.settingsTimestamp = now;
    return result;
  } catch (error) {

    return {
      campaignNames: [
        { id: 'default', name: 'Default Campaign' },
        { id: 'online', name: 'Online Campaign' },
        { id: 'offline', name: 'Offline Campaign' }
      ],
      dataCodes: [
        { id: 'hot', code: 'HOT' },
        { id: 'warm', code: 'WARM' },
        { id: 'cold', code: 'COLD' }
      ]
    };
  }
};

// Fetch company names from Vakilsearch API
const fetchCompanyNames = async (companyName) => {
  try {
    const userId = getUserId();
    if (!userId) return [];

    const response = await fetch(`${API_BASE_URL}/settings/company-names-from-vakilsearch?company_name=${encodeURIComponent(companyName)}&user_id=${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data || [];
  } catch (error) {

    return [];
  }
};

// Fetch assignable users - Using the same approach as AboutSection.jsx
const fetchAssignableUsers = async () => {
  try {
    const userId = getUserId();
    if (!userId) return [];

    // Use the same API endpoint as AboutSection.jsx for consistency
    const response = await fetch(`${API_BASE_URL}/roles/users-one-level-above/${userId}?requesting_user_id=${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Senior users fetched for Assigned TL (same as AboutSection):', data);
    
    // The API returns an array of users directly
    const users = Array.isArray(data) ? data : [];
    
    // Format users to include name and designation (same format as AboutSection)
    const formattedUsers = users.map(user => ({
      id: user._id || user.id,
      _id: user._id || user.id,
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User',
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      designation: user.designation,
      role_name: user.role_name,
      email: user.email,
      phone: user.phone,
      department_name: user.department_name // Include department info if available
    }));
    
    console.log(`✅ Fetched ${formattedUsers.length} assignable users (AboutSection style):`, formattedUsers);
    return formattedUsers;
    
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return [];
  }
};

// Fetch bank names from settings API
const fetchBankNames = async () => {
  try {
    const userId = getUserId();
    if (!userId) return [{ id: 'custom', name: 'Custom' }];

    // Using the specific API endpoint for bank names
    const response = await fetch(`${API_BASE_URL}/settings/bank-names?user_id=${userId}`);
    if (!response.ok) {

      return [
        { id: 'custom', name: 'Custom' },
        { id: 'sbi', name: 'State Bank of India' },
        { id: 'hdfc', name: 'HDFC Bank' },
        { id: 'icici', name: 'ICICI Bank' },
        { id: 'axis', name: 'Axis Bank' },
        { id: 'kotak', name: 'Kotak Mahindra Bank' }
      ];
    }
    const data = await response.json();

    // Add "Custom" option to the list
    let bankNames = [];
    if (Array.isArray(data)) {
      bankNames = data;
    } else if (data.bank_names && Array.isArray(data.bank_names)) {
      bankNames = data.bank_names;
    } else if (data.data && Array.isArray(data.data)) {
      bankNames = data.data;
    }

    return [
      { id: 'custom', name: 'Custom' }, // Always keep Custom as an option
      ...bankNames.map(bank => ({ id: bank.id || bank._id || bank.name, name: bank.name || bank }))
    ];
  } catch (error) {

    return [
      { id: 'custom', name: 'Custom' },
      { id: 'sbi', name: 'State Bank of India' },
      { id: 'hdfc', name: 'HDFC Bank' },
      { id: 'icici', name: 'ICICI Bank' },
      { id: 'axis', name: 'Axis Bank' },
      { id: 'kotak', name: 'Kotak Mahindra Bank' }
    ];
  }
};

// Fetch company categories from settings API
const fetchCompanyCategories = async (companyName = "") => {
  try {
    const userId = getUserId();
    if (!userId) return [];

    // Backend only supports POST method with required request body
    // Backend requires company_name with min_length=1, so use fallback if empty
    const finalCompanyName = companyName && companyName.trim() ? companyName.trim() : "default";
    const requestBody = {
      company_name: finalCompanyName,
      similarity_threshold: 0.6
    };

    const response = await fetch(`${API_BASE_URL}/settings/search-companies?user_id=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {

      const errorText = await response.text();

      return [];
    }
    const data = await response.json();

    // Handle different possible response structures
    let categories = [];
    if (Array.isArray(data)) {
      categories = data;
    } else if (data.companies && Array.isArray(data.companies)) {
      categories = data.companies;
    } else if (data.categories && Array.isArray(data.categories)) {
      categories = data.categories;
    } else if (data.data && Array.isArray(data.data)) {
      categories = data.data;
    }

    return categories.map(cat => ({
      value: cat.id || cat._id || cat.name || cat,
      label: cat.name || cat.label || cat
    }));
  } catch (error) {

    return [];
  }
};

// --- Logic and State Hook ---
function useCreateLeadLogic() {
  // State for API data
  const [loanTypes, setLoanTypes] = useState([]);
  const [campaignNames, setCampaignNames] = useState([]);
  const [dataCodes, setDataCodes] = useState([]);
  const [companyCategories, setCompanyCategories] = useState([]);
  const [companyTypes, setCompanyTypes] = useState([
    { value: "", label: "Select Type" },
    { value: "private", label: "Private" },
    { value: "pvt_ltd", label: "Pvt Ltd" },
    { value: "public", label: "Public" },
    { value: "public_ltd", label: "Public Ltd" },
    { value: "government", label: "Government" },
    { value: "psu", label: "PSU" },
    { value: "startup", label: "Startup" },
    { value: "mnc", label: "MNC" },
    { value: "llp", label: "LLP" }
  ]);
  const [bankList, setBankList] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [mobileCheckResult, setMobileCheckResult] = useState(null);
  const [showReassignmentOption, setShowReassignmentOption] = useState(false);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [existingLeadData, setExistingLeadData] = useState(null);
  const [allDuplicateLeads, setAllDuplicateLeads] = useState([]);
  const [reassignmentCancelled, setReassignmentCancelled] = useState(false);
  
  // Reassignment form state
  const [showReassignmentModal, setShowReassignmentModal] = useState(false);
  const [reassignmentReason, setReassignmentReason] = useState('');
  const [newDataCode, setNewDataCode] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [changeDataCode, setChangeDataCode] = useState(false);
  const [changeCampaignName, setChangeCampaignName] = useState(false);
  // Track obligation section unsaved changes
  const [obligationHasUnsavedChanges, setObligationHasUnsavedChanges] = useState(false);
  const [obligationIsSaving, setObligationIsSaving] = useState(false);
  const [obligationDataSaved, setObligationDataSaved] = useState(false); // Track if obligation data has been saved
  
  // Additional loading state flags for each API
  const [loadingBankList, setLoadingBankList] = useState(false);
  const [loadingCompanyCategories, setLoadingCompanyCategories] = useState(false);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [bankListLoaded, setBankListLoaded] = useState(false);
  const [companyDataLoaded, setCompanyDataLoaded] = useState(false);
  const [assignableUsersLoaded, setAssignableUsersLoaded] = useState(false);
  const [backgroundDataLoaded, setBackgroundDataLoaded] = useState(false);
  
  // Button loading states for enhanced UX
  const [checkMobileLoading, setCheckMobileLoading] = useState(false);
  const [createLeadLoading, setCreateLeadLoading] = useState(false);
  const [reassignmentActionLoading, setReassignmentActionLoading] = useState({});
  const [buttonAnimations, setButtonAnimations] = useState({});
  
  // Permission state - check if user has permission to create/add leads
  const [hasAddLeadPermission, setHasAddLeadPermission] = useState(true); // Default to true to avoid flickering
  const [hasReassignmentPopupPermission, setHasReassignmentPopupPermission] = useState(true); // Default to true to avoid flickering

  // Utility function to trigger button animation
  const animateButton = useCallback((buttonId) => {
    setButtonAnimations(prev => ({ ...prev, [buttonId]: true }));
    setTimeout(() => {
      setButtonAnimations(prev => ({ ...prev, [buttonId]: false }));
    }, 200);
  }, []);
  
  // Check user's add lead permission on component mount
  useEffect(() => {
    console.log('🔐 Checking user ADD lead permission on component mount...');
    const hasPermission = checkUserHasAddLeadPermission();
    setHasAddLeadPermission(hasPermission);
    
    if (!hasPermission) {
      console.warn('⚠️ User does NOT have permission to create leads');
    } else {
      console.log('✅ User has permission to create leads');
    }
  }, []);

  // Check user's reassignment popup permission on component mount
  useEffect(() => {
    console.log('🔐 Checking user REASSIGNMENT POPUP permission on component mount...');
    const hasPermission = checkUserHasReassignmentPopupPermission();
    setHasReassignmentPopupPermission(hasPermission);
    
    if (!hasPermission) {
      console.warn('⚠️ User does NOT have permission to view reassignment popup');
    } else {
      console.log('✅ User has permission to view reassignment popup');
    }
  }, []);

  // Load essential data first, then background data
  useEffect(() => {
    const loadPriorityData = async () => {
      try {
        setLoadingLoanTypes(true);

        // PRIORITY: Load loan types first (most critical for form)
        const loanTypesData = await fetchLoanTypes();
        setLoanTypes(loanTypesData);
        setLoadingLoanTypes(false);
        console.log("🎯 Priority data loaded: Loan types ready!");

        // Start background loading immediately after loan types
        loadBackgroundData();

      } catch (error) {
        console.error("Error loading priority data:", error);
        setLoadingLoanTypes(false);
      }
    };

    const loadBackgroundData = async () => {
      try {
        setLoadingSettings(true);

        // Load settings data
        const settingsData = await fetchSettingsData();
        setCampaignNames(settingsData.campaignNames);
        setDataCodes(settingsData.dataCodes);
        setLoadingSettings(false);

        // Load other data in background (non-blocking)
        const backgroundPromises = [
          loadBankListData(),
          loadCompanyData(),
          loadAssignableUsers()
        ];

        Promise.all(backgroundPromises)
          .then(() => {
            setBackgroundDataLoaded(true);
            console.log("✅ All background data loaded successfully");
          })
          .catch(error => {
            console.error("❌ Error loading background data:", error);
            setBackgroundDataLoaded(true); // Set to true anyway to avoid blocking UI
          });

      } catch (error) {
        console.error("Error loading background data:", error);
        setLoadingSettings(false);
      }
    };

    loadPriorityData();
  }, []);
  
  // Load bank list data only when needed
  const loadBankListData = async () => {
    if (bankListLoaded) return; // Skip if already loaded
    
    try {
      setLoadingBankList(true);
      const bankNamesData = await fetchBankNames();
      setBankList(bankNamesData);
      setBankListLoaded(true);
    } catch (error) {

    } finally {
      setLoadingBankList(false);
    }
  };
  
  // Load company categories data only when needed
  const loadCompanyData = async () => {
    if (companyDataLoaded) return; // Skip if already loaded
    
    try {
      setLoadingCompanyCategories(true);
      const companyCategoriesData = await fetchCompanyCategories();
      setCompanyCategories(companyCategoriesData);
      
      // Set company types from the API data
      if (companyCategoriesData && companyCategoriesData.length > 0) {
        setCompanyTypes([
          { value: "", label: "Select Type" },
          ...companyCategoriesData
        ]);
      }
      
      setCompanyDataLoaded(true);
    } catch (error) {

    } finally {
      setLoadingCompanyCategories(false);
    }
  };
  
  // Load assignable users data only when needed
  const loadAssignableUsers = async () => {
    if (assignableUsersLoaded) return; // Skip if already loaded
    
    try {
      setLoadingAssignableUsers(true);
      const usersData = await fetchAssignableUsers();
      setAssignableUsers(usersData);
      setAssignableUsersLoaded(true);

    } catch (error) {

    } finally {
      setLoadingAssignableUsers(false);
    }
  };

  // --- Customer Obligation summary from backend (simulate) ---
  const [totalBtPos, setTotalBtPos] = useState("0");
  const [totalObligation, setTotalObligation] = useState("0");
  const [cibilScore, setCibilScore] = useState(""); // New state variable for CIBIL score
  useEffect(() => {
    setTimeout(() => {
      setTotalBtPos("");
      setTotalObligation("");
      setCibilScore(""); // Reset CIBIL score with other fields
    }, 800);
  }, []);

  // Product types for obligation table - memoized for performance
  const productTypes = useMemo(() => [
    { value: "pl", label: "PL (Personal Loan)" },
    { value: "od", label: "OD (Overdraft)" },
    { value: "cc", label: "CC (Credit Card)" },
    { value: "bl", label: "BL (Business Loan)" },
    { value: "hl", label: "HL (Home Loan)" },
    { value: "lap", label: "LAP (Loan Against Property)" },
    { value: "al", label: "AL (Auto Loan)" },
    { value: "el", label: "EL (Education Loan)" },
    { value: "gl", label: "GL (Gold Loan)" },
    { value: "loc", label: "LOC (Loan On Credit Card)" },
    { value: "cd", label: "CD (Consumer Durable Loan)" },
    { value: "app_loan", label: "App Loan" },
    { value: "insurance", label: "Insurance" },
  ], []);

  // --- Action types for table - memoized for performance ---
  const actionTypes = useMemo(() => [
    { value: "bt", label: "BT" },
    { value: "obligate", label: "Obligate" },
    { value: "co-pay", label: "CO-Pay" },
    { value: "no-pay", label: "No-Pay" },
    { value: "closed", label: "Closed" },
  ], []);

  // Status options
  const statusOptions = [
    { value: "not_a_lead", label: "Not A Lead" },
    {
      value: "lead",
      label: "Lead",

    }
  ];

  const bonusDivisions = [
    { value: "3", label: "3" },
    { value: "6", label: "6" },
    { value: "12", label: "12" },
    { value: "24", label: "24" },
  ];
  const foirPercents = [
    { value: "50", label: "50%" },
    { value: "55", label: "55%" },
    { value: "60", label: "60%" },
    { value: "65", label: "65%" },
    { value: "70", label: "70%" },
  ];

  // Check Eligibility Section - Company Category Dropdown
  const checkEligibilityCompanyCategories = [
    { value: "super_cat_a", label: "Super CAT A" },
    { value: "cat_a", label: "CAT A" },
    { value: "cat_b", label: "CAT B" },
    { value: "cat_c", label: "CAT C" },
    { value: "unlisted", label: "UNLISTED or MANNUAL FILE" },
  ];

  // State
  const [currentDateTime, setCurrentDateTime] = useState(
    getISTTimestamp().replace("T", " ")
  );
  const [productType, setProductType] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileValidationError, setMobileValidationError] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [dataCode, setDataCode] = useState("");
  const [companyCategory, setCompanyCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState([]);
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [status, setStatus] = useState("not_a_lead"); // Set default status to enable Create Lead button
  const [customerName, setCustomerName] = useState("");
  const [alternateNumber, setAlternateNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [salary, setSalary] = useState("");
  const [partnerSalary, setPartnerSalary] = useState("");
  const [yearlyBonus, setYearlyBonus] = useState("");
  const [bonusDivision, setBonusDivision] = useState("12");
  const [loanRequired, setLoanRequired] = useState("");
  const [foirPercent, setFoirPercent] = useState("60");
  const [customFoirPercent, setCustomFoirPercent] = useState("");

  // Form validation states
  const [formValidationErrors, setFormValidationErrors] = useState({
    productType: false,
    mobileNumber: false,
    customerName: false,
    campaignName: false,
    status: false,
    assignedTo: false
  });
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [eligibility, setEligibility] = useState({
    totalIncome: 0,
    foirAmount: 0,
    totalObligations: 0,
    totalBtPos: 0,
    foirEligibility: 0,
    multiplierEligibility: 0,
    finalEligibility: 0,
  });

  // --- Check Eligibility Section State ---
  const [ceCompanyCategory, setCeCompanyCategory] = useState("");
  const [ceFoirPercent, setCeFoirPercent] = useState("");
  const [ceCustomFoirPercent, setCeCustomFoirPercent] = useState("");
  const [ceTenureMonths, setCeTenureMonths] = useState("");
  const [ceTenureYears, setCeTenureYears] = useState("");
  const [ceRoi, setCeRoi] = useState("");
  const [ceMonthlyEmiCanPay, setCeMonthlyEmiCanPay] = useState("");
  const [ceMultiplier, setCeMultiplier] = useState("");
  const [loanEligibilityStatus, setLoanEligibilityStatus] = useState("");

  // Obligations Table State
  const [obligations, setObligations] = useState([
    {
      product: "",
      bankName: "",
      tenure: "",
      roi: "",
      totalLoan: "",
      outstanding: "",
      emi: "",
      action: "",
    },
  ]);
  const [bankDropdowns, setBankDropdowns] = useState([false]);
  const [bankFilters, setBankFilters] = useState([""]);
  const [productDropdowns, setProductDropdowns] = useState([false]);

  // Search states for dropdowns
  const [productTypeSearch, setProductTypeSearch] = useState("");
  const [campaignNameSearch, setCampaignNameSearch] = useState("");
  const [dataCodeSearch, setDataCodeSearch] = useState("");
  const [showProductTypeDropdown, setShowProductTypeDropdown] = useState(false);
  const [showCampaignNameDropdown, setShowCampaignNameDropdown] = useState(false);
  const [showDataCodeDropdown, setShowDataCodeDropdown] = useState(false);

  // Company search
  const [companySearch, setCompanySearch] = useState("");
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [isCompanyLoading, setIsCompanyLoading] = useState(false);

  const leadFormRef = useRef(null);

  useEffect(() => {
    // Use parseINR directly as it now returns a number
    const s = parseINR(salary);
    const ps = parseINR(partnerSalary);
    const yb = parseINR(yearlyBonus);
    const bd = parseInt(bonusDivision) || 12;
    const monthlyBonus = yb / bd;
    const totalIncome = s + ps + monthlyBonus;
    const fp = parseInt(foirPercent) || 60;
    const foirAmount = totalIncome * (fp / 100);

    let totalObligations = 0;
    let totalBtPos = 0;
    for (const row of obligations) {
      totalObligations += parseINR(row.emi); // Use parseINR directly
      totalBtPos += parseINR(row.outstanding); // Use parseINR directly
    }

    // Auto-fill the Total BT POS and Total Obligation fields
    setTotalBtPos(formatINR(totalBtPos));
    setTotalObligation(formatINR(totalObligations));

    const foirEligibility = foirAmount - totalObligations;
    const multiplierEligibility = totalIncome * 0;

    let finalEligibility = 0;
    if (totalBtPos < foirEligibility) {
      finalEligibility = Math.min(foirEligibility, multiplierEligibility);
    } else {
      finalEligibility = multiplierEligibility - totalBtPos;
    }
    finalEligibility = Math.max(finalEligibility, 0);

    setEligibility({
      totalIncome,
      foirAmount,
      totalObligations,
      totalBtPos,
      foirEligibility,
      multiplierEligibility,
      finalEligibility,
    });
    setLoanEligibilityStatus(finalEligibility > 0 ? "Eligible" : "Not Eligible");
  }, [
    salary,
    partnerSalary,
    yearlyBonus,
    bonusDivision,
    foirPercent,
    obligations,
  ]);

  // Obligations Table Handlers
  const handleObligationChange = (idx, field, value) => {
    setObligations((prev) => {
      const next = [...prev];
      
      // Capitalize string values for specific fields (bank names, product types, etc.)
      let processedValue = value;
      if (field === 'bank' || field === 'product' || field === 'action') {
        // Only capitalize if it's a string and not empty
        if (typeof value === 'string' && value.trim() !== '') {
          processedValue = value.toUpperCase();
        }
      }
      
      next[idx] = { ...next[idx], [field]: processedValue };

      // When outstanding field is updated and not empty, automatically set BTPOS (action to "bt")
      if (field === "outstanding" && value) {
        // If action is not yet set or is empty, set it to "bt" (Balance Transfer)
        if (!next[idx].action) {
          next[idx].action = "bt";
        }
      }

      // Calculate and update totalBtPos and totalObligation immediately when changes occur
      let totalBtPosValue = 0;
      let totalObligationValue = 0;

      for (const row of next) {
        totalBtPosValue += parseINR(row.outstanding);
        totalObligationValue += parseINR(row.emi);
      }

      // Update the total values with proper formatting
      setTotalBtPos(formatINR(totalBtPosValue));
      setTotalObligation(formatINR(totalObligationValue));

      return next;
    });
    
    // Mark obligation data as changed for validation tracking
    markObligationDataAsChanged();
  };

  const handleAddObligation = () => {
    setObligations((prev) => [
      ...prev,
      {
        product: "",
        bankName: "",
        tenure: "",
        roi: "",
        totalLoan: "",
        outstanding: "",
        emi: "",
        action: "",
      },
    ]);
    setBankDropdowns((prev) => [...prev, false]);
    setBankFilters((prev) => [...prev, ""]);
    setProductDropdowns((prev) => [...prev, false]);

    // Mark obligation data as changed for validation tracking
    markObligationDataAsChanged();

    // No need to recalculate totals here as adding an empty row doesn't change the values
  };

  const handleDeleteObligation = (idx) => {
    setObligations((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const result = next.length === 0
        ? [
          {
            product: "",
            bankName: "",
            tenure: "",
            roi: "",
            totalLoan: "",
            outstanding: "",
            emi: "",
            action: "",
          },
        ]
        : next;

      // Recalculate totals after deletion
      let totalBtPosValue = 0;
      let totalObligationValue = 0;

      for (const row of result) {
        totalBtPosValue += parseINR(row.outstanding);
        totalObligationValue += parseINR(row.emi);
      }

      // Update the total values with proper formatting
      setTotalBtPos(formatINR(totalBtPosValue));
      setTotalObligation(formatINR(totalObligationValue));

      return result;
    });
    setBankDropdowns((prev) => prev.filter((_, i) => i !== idx));
    setBankFilters((prev) => prev.filter((_, i) => i !== idx));
    setProductDropdowns((prev) => prev.filter((_, i) => i !== idx));
    
    // Mark obligation data as changed for validation tracking
    markObligationDataAsChanged();
  };




  // Bank filter handlers for each row
  const handleBankDropdown = (idx, isOpen) => {
    // Load bank list data when dropdown is opened
    if (isOpen) {
      loadBankListData();
    }
    
    setBankDropdowns((prev) =>
      prev.map((v, i) => (i === idx ? isOpen : false))
    );
  };
  const handleBankFilterChange = (idx, value) => {
    setBankFilters((prev) =>
      prev.map((v, i) => (i === idx ? value : v))
    );
    handleObligationChange(idx, "bankName", value);
  };
  const handleBankSelect = (idx, value) => {
    handleObligationChange(idx, "bankName", value);
    setBankDropdowns((prev) => prev.map((v, i) => (i === idx ? false : v)));
    setBankFilters((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  // Product dropdown handlers for each row
  const handleProductDropdown = (idx, isOpen) => {
    setProductDropdowns((prev) =>
      prev.map((v, i) => (i === idx ? isOpen : false))
    );
  };
  const handleProductSelect = (idx, value) => {
    handleObligationChange(idx, "product", value);
    setProductDropdowns((prev) => prev.map((v, i) => (i === idx ? false : v)));
  };

  // Company search handlers with debouncing
  const debouncedFetchCompanySuggestions = useCallback(
    debounce(async (search) => {
      if (!search || search.trim().length < 2) {
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
        return;
      }

      setIsCompanyLoading(true);
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);

      try {
        const companyNames = await fetchCompanyNames(search.trim());

        // Only show suggestions if we got valid results
        if (Array.isArray(companyNames) && companyNames.length > 0) {
          setCompanySuggestions(companyNames);
          setShowCompanySuggestions(true);
        } else {
          setCompanySuggestions([]);
          setShowCompanySuggestions(false);
        }
      } catch (error) {
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
      } finally {
        setIsCompanyLoading(false);
      }
    }, 300), // 300ms debounce delay
    []
  );

  const fetchCompanySuggestions = async (search) => {
    debouncedFetchCompanySuggestions(search);
  };

  const handleCompanyInputChange = useCallback((e) => {
    const upperCaseValue = e.target.value.toUpperCase();
    setCompanyName(upperCaseValue);
    setCompanySearch(upperCaseValue);
    setShowCompanySuggestions(false);
    
    // If user types more than 2 characters, load company data in preparation
    if (upperCaseValue && upperCaseValue.trim().length > 2) {
      loadCompanyData();
    }
  }, [loadCompanyData]);

  const handleCompanySearchClick = useCallback(() => {
    // Load company data when user searches
    loadCompanyData();
    
    if (companySearch.trim().length > 0) {
      fetchCompanySuggestions(companySearch.trim());
    }
  }, [loadCompanyData, companySearch, fetchCompanySuggestions]);

  const handleCompanySuggestionClick = useCallback((name) => {
    const upperCaseName = name.toUpperCase();
    setCompanyName(upperCaseName);
    setCompanySearch(upperCaseName);
    setShowCompanySuggestions(false);
  }, []);

  // --- Searchable Dropdown Handlers for First Row Fields ---

  // Product Type handlers
  const handleProductTypeSearch = (e) => {
    setProductTypeSearch(e.target.value);
    setShowProductTypeDropdown(true);
  };

  const handleProductTypeSelect = (value, name) => {
    setProductType(value);
    setProductTypeSearch(name);
    setShowProductTypeDropdown(false);
  };

  const handleProductTypeDropdownToggle = () => {
    setShowProductTypeDropdown(!showProductTypeDropdown);
  };

  // Campaign Name handlers
  const handleCampaignNameSearch = (e) => {
    setCampaignNameSearch(e.target.value);
    setShowCampaignNameDropdown(true);
  };

  const handleCampaignNameSelect = (value, name) => {
    setCampaignName(value);
    setCampaignNameSearch(name);
    setShowCampaignNameDropdown(false);
  };

  const handleCampaignNameDropdownToggle = () => {
    setShowCampaignNameDropdown(!showCampaignNameDropdown);
  };

  // Data Code handlers
  const handleDataCodeSearch = (e) => {
    setDataCodeSearch(e.target.value);
    setShowDataCodeDropdown(true);
  };

  const handleDataCodeSelect = (value, name) => {
    setDataCode(value);
    setDataCodeSearch(name);
    setShowDataCodeDropdown(false);
  };

  const handleDataCodeDropdownToggle = () => {
    setShowDataCodeDropdown(!showDataCodeDropdown);
  };

  // --- Check Eligibility Handlers ---
  const handleCeCompanyCategoryChange = (e) => setCeCompanyCategory(e.target.value);
  const handleCeFoirPercentChange = (e) => setCeFoirPercent(e.target.value);
  const handleCeTenureMonthsChange = (e) => {
    setCeTenureMonths(e.target.value.replace(/[^0-9]/g, ""));
    setCeTenureYears(e.target.value ? (parseInt(e.target.value) / 12).toFixed(2) : "");
  };
  const handleCeTenureYearsChange = (e) => {
    setCeTenureYears(e.target.value.replace(/[^0-9.]/g, ""));
    setCeTenureMonths(e.target.value ? Math.round(parseFloat(e.target.value) * 12).toString() : "");
  };
  const handleCeRoiChange = (e) => setCeRoi(e.target.value.replace(/[^0-9.]/g, ""));
  const handleCeMonthlyEmiCanPayChange = (e) => setCeMonthlyEmiCanPay(e.target.value.replace(/[^0-9.]/g, ""));
  const handleCeMultiplierChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, "");
    if (value === "") value = "";
    else if (parseInt(value) > 35) value = "35";
    setCeMultiplier(value);
  };

  // --- Filtered Lists for Searchable Dropdowns ---

  // Filter loan types based on search
  const filteredLoanTypes = loanTypes.filter(loanType =>
    (loanType.name || '').toLowerCase().includes(productTypeSearch.toLowerCase())
  );

  // Filter campaign names based on search
  const filteredCampaignNames = campaignNames.filter(campaign =>
    (campaign.name || '').toLowerCase().includes(campaignNameSearch.toLowerCase())
  );

  // Filter data codes based on search
  const filteredDataCodes = dataCodes.filter(dataCodeItem =>
    (dataCodeItem.name || '').toLowerCase().includes(dataCodeSearch.toLowerCase())
  );

  // --- Enhanced handleCheckMobile function with alternate number check ---
  const handleCheckMobile = async () => {
    if (!productType) {
      alert("Please select a Product Type");
      return;
    }
    if (!mobileNumber || mobileNumber.length !== 10 || !/^\d+$/.test(mobileNumber)) {
      alert("Please enter a valid 10-digit Mobile Number");
      return;
    }

    // Set loading state and trigger animation
    setCheckMobileLoading(true);
    animateButton('checkMobileBtn');

    try {
      // First, check the primary mobile number
      const duplicateCheck = await checkMobileNumber(mobileNumber, productType);
      let leadFound = false;
      
      // If primary number check found a lead, process it
      if (duplicateCheck && duplicateCheck.found) {
        setMobileCheckResult(duplicateCheck);
        setAllDuplicateLeads(duplicateCheck.leads || []);
        leadFound = true;
        
        // Get the first lead from the results
        const firstLead = duplicateCheck.leads && duplicateCheck.leads.length > 0 ? duplicateCheck.leads[0] : null;
        
        if (firstLead) {
          // Process this lead with our new enhanced reassignment logic
          processExistingLead(firstLead, duplicateCheck);
        }
      } 
      
      // If no duplicate found with primary number and alternate number is provided, check it too
      else if (alternateNumber && alternateNumber.length === 10 && /^\d+$/.test(alternateNumber)) {

        const altNumberCheck = await checkMobileNumber(alternateNumber, productType);
        
        // If duplicate found with alternate number, process that lead
        if (altNumberCheck && altNumberCheck.found) {

          setMobileCheckResult(altNumberCheck);
          setAllDuplicateLeads(altNumberCheck.leads || []);
          leadFound = true;
          
          // Get the first lead from the results
          const firstLead = altNumberCheck.leads && altNumberCheck.leads.length > 0 ? altNumberCheck.leads[0] : null;
          
          if (firstLead) {
            // Process this lead with our new enhanced reassignment logic
            processExistingLead(firstLead, altNumberCheck);
          }
        }
      }
      
      // If no leads found with either number, proceed with new lead creation
      if (!leadFound) {

        setShowLeadForm(true);
        
        // Reset obligation tracking states for new lead
        setObligationHasUnsavedChanges(false);
        setObligationIsSaving(false);
        setObligationDataSaved(false);
        
        // Note: Background data loading is handled in useEffect
        // No need to load bank list, company data, and assignable users here
        // as they are already being loaded in the background
        
        setTimeout(() => {
          if (leadFormRef && leadFormRef.current) {
            leadFormRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    } catch (error) {

      alert('Error checking mobile number. Please try again.');
    } finally {
      // Reset loading state
      setCheckMobileLoading(false);
    }
  };

// Debounce utility for mobile number checking
let mobileCheckTimeout = null;

// Debounced mobile number check function
const debouncedMobileCheck = useCallback((mobileNumber, productType, callback) => {
  if (mobileCheckTimeout) {
    clearTimeout(mobileCheckTimeout);
  }
  
  mobileCheckTimeout = setTimeout(() => {
    if (mobileNumber && mobileNumber.length === 10) {
      callback(mobileNumber, productType);
    }
  }, 500); // 500ms delay
}, []);

// Handle mobile number change - closes existing lead window and validates input
const handleMobileNumberChange = (e) => {
    const value = e.target.value;
    
    // Only allow digits but don't limit length during typing
    const cleanedValue = value.replace(/\D/g, '');
    setMobileNumber(cleanedValue);
    
    // Clear form validation error for mobile number when user starts typing
    if (formValidationErrors.mobileNumber) {
      setFormValidationErrors(prev => ({
        ...prev,
        mobileNumber: false
      }));
    }
    
    // Close existing lead window when mobile number changes
    if (showReassignmentOption || showLeadDetails) {
      setShowReassignmentOption(false);
      setShowLeadDetails(false);
      setExistingLeadData(null);
      setMobileCheckResult(null);
      setReassignmentCancelled(false); // Clear cancellation flag
    }
    
    // Validate mobile number
    if (cleanedValue.length === 0) {
      setMobileValidationError("");
    } else if (cleanedValue.length < 10) {
      setMobileValidationError("Mobile number must be exactly 10 digits");
    } else if (cleanedValue.length > 10) {
      setMobileValidationError("Mobile number cannot exceed 10 digits");
    } else if (!/^[6-9]/.test(cleanedValue)) {
      setMobileValidationError("Mobile number must start with 6, 7, 8, or 9");
    } else {
      setMobileValidationError("");
    }
    
    // Clear alternate number if it becomes the same as mobile number
    if (cleanedValue && alternateNumber && cleanedValue === alternateNumber) {
      setAlternateNumber("");
      // The validation message will show automatically due to the conditional rendering
    }
  };

  // Enhanced alternate number change handler with real-time validation
  const handleAlternateNumberChange = (e) => {
    const newValue = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
    
    // If the new value would match mobile number, prevent it completely
    if (newValue && mobileNumber && newValue === mobileNumber) {
      // Show a brief alert and don't update state
      e.target.style.borderColor = '#ef4444'; // red border
      setTimeout(() => {
        e.target.style.borderColor = '';
      }, 1000);
      return;
    }
    
    setAlternateNumber(newValue);
  };

  // --- Obligation Data Tracking Functions ---
  // Function to mark obligation data as having unsaved changes
  const markObligationDataAsChanged = () => {
    if (!obligationHasUnsavedChanges) {
      setObligationHasUnsavedChanges(true);
    }
    if (obligationDataSaved) {
      setObligationDataSaved(false);
    }
  };

  // Enhanced handlers for obligation-related fields that track changes
  const handleSalaryChange = (value) => {
    setSalary(value);
    markObligationDataAsChanged();
  };

  const handlePartnerSalaryChange = (value) => {
    setPartnerSalary(value);
    markObligationDataAsChanged();
  };

  const handleYearlyBonusChange = (value) => {
    setYearlyBonus(value);
    markObligationDataAsChanged();
  };

  const handleBonusDivisionChange = (value) => {
    setBonusDivision(value);
    markObligationDataAsChanged();
  };

  const handleFoirPercentChange = (value) => {
    setFoirPercent(value);
    markObligationDataAsChanged();
  };

  // Function to save obligation data (this should be called by the save button in obligation section)
  const handleSaveObligationData = () => {
    setObligationIsSaving(true);
    
    try {
      // Here you would typically make an API call to save the obligation data
      // For now, we'll just mark it as saved
      setObligationDataSaved(true);
      setObligationHasUnsavedChanges(false);
      

      alert('Obligation data saved successfully!');
    } catch (error) {

      alert('Error saving obligation data. Please try again.');
    } finally {
      setObligationIsSaving(false);
    }
  };

  // Function to clear unsaved changes flag (when user decides to proceed without obligation data)
  const handleClearObligationChanges = () => {
    setObligationHasUnsavedChanges(false);
    setObligationDataSaved(false);
  };

  // Function to check if personal section is complete
  // Function to validate form fields and highlight errors
  const validateFormFields = () => {
    const errors = {
      productType: !productType,
      mobileNumber: !mobileNumber || mobileNumber.length !== 10 || !/^[6-9]/.test(mobileNumber),
      customerName: !customerName || !customerName.trim(),
      campaignName: !campaignName,
      status: !status,
      assignedTo: !assignedTo || assignedTo.length === 0 // Allow "none" as valid selection
    };
    
    setFormValidationErrors(errors);
    setShowValidationErrors(true);
    
    // Return true if no errors
    return !Object.values(errors).some(error => error);
  };

  const isPersonalSectionComplete = () => {
    return (
      productType &&
      mobileNumber && mobileNumber.length === 10 && /^[6-9]/.test(mobileNumber) &&
      customerName && customerName.trim() &&
      campaignName &&
      status
    );
  };

  // Function to check if obligation section has any data
  const hasAnyObligationData = () => {
    const currentTempData = getTempLeadData();
    const currentObligationData = currentTempData.obligation || {};
    
    return (
      currentObligationData.salary ||
      currentObligationData.partnerSalary ||
      currentObligationData.yearlyBonus ||
      currentObligationData.obligations?.length > 0 ||
      currentObligationData.processingBank ||
      salary ||
      partnerSalary ||
      yearlyBonus ||
      obligations?.length > 0
    );
  };

  // Function to check if Create Lead button should be enabled
  const isCreateLeadEnabled = () => {
    // Always enable the button - validation will happen on click
    return true;
  };
  
  // Function to check if user has assign permission for leads - internal version for component use
  const checkUserHasAssignPermission = () => {
    return checkUserHasAssignPermissionGlobal();
  };
  
  // Helper function to process an existing lead and determine reassignment eligibility
  const processExistingLead = (lead, apiResponse) => {
    // Extract all relevant fields from the lead
    const fileSentToLogin = lead.file_sent_to_login || false;
    const mainStatus = (lead.main_status || '').toUpperCase();
    const ageDays = lead.age_days || 0;
    const reassignmentStatus = lead.reassignment_status || 'none'; // none, requested, approved, rejected
    
    console.log('Processing existing lead:', {
      id: lead.id, 
      name: lead.name, 
      status: lead.status,
      main_status: mainStatus,
      file_sent_to_login: fileSentToLogin,
      age_days: ageDays,
      reassignment_status: reassignmentStatus,
      assigned_to: lead.assigned_to,
      created_by: lead.created_by,
      assign_report_to: lead.assign_report_to
    });
    
    // Check if user has assign permission
    const hasAssignPermission = checkUserHasAssignPermission();
    
    // Extract reassignment eligibility data from API response
    const canReassign = apiResponse?.can_reassign === true;
    const reassignmentReason = apiResponse?.reassignment_reason || '';
    const daysElapsed = apiResponse?.days_elapsed || 0;
    const reassignmentPeriod = apiResponse?.reassignment_period || 0;
    const daysRemaining = apiResponse?.days_remaining || 0;
    const isManagerPermissionRequired = apiResponse?.is_manager_permission_required === true;
    
    // Format the lead data for compatibility with existing code
    const leadData = {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      sub_status: lead.sub_status, // Add sub_status here
      loan_type: lead.loan_type,
      created_date: lead.created_at,
      assigned_to: lead.assigned_to,
      assigned_to_name: lead.assigned_to_name || lead.assigned_to_user?.name || lead.assigned_to,
      created_by: lead.created_by,
      created_by_name: lead.created_by_name || 'Unknown User', // Add created_by_name from eligibility API
      assign_report_to: lead.assign_report_to,
      department_name: typeof lead.department_name === 'object' ? (lead.department_name?.name || '') : (lead.department_name || ''),
      age_days: ageDays,
      main_status: mainStatus,
      file_sent_to_login: fileSentToLogin,
      login_department_sent_date: lead.login_department_sent_date, // Add login department sent date
      reassignment_status: reassignmentStatus,
      has_assign_permission: hasAssignPermission,
      // Add reassignment eligibility data
      can_reassign: canReassign,
      reassignment_reason: reassignmentReason,
      days_elapsed: daysElapsed,
      reassignment_period: reassignmentPeriod,
      days_remaining: daysRemaining,
      is_manager_permission_required: isManagerPermissionRequired
    };
    setExistingLeadData(leadData);
    
    // PERMISSION-BASED LOGIC: Control reassignment popup visibility
    // If user does NOT have reassignment_popup permission, just show alert and don't show popup
    if (!hasReassignmentPopupPermission) {
      console.log('❌ User does NOT have reassignment popup permission - showing simple alert');
      setShowReassignmentOption(false);
      setShowLeadDetails(false);
      // Show a compact dark card instead of the detailed popup
      setMobileCheckResult({
        exists: true,
        message: `This mobile number already exists and is assigned to ${leadData.assigned_to_name || 'another user'}.`,
        leads: [leadData],
        days_remaining: daysRemaining,
        is_manager_permission_required: isManagerPermissionRequired
      });
      return;
    }
    
    console.log('✅ User has reassignment popup permission - showing detailed popup');
    
    // Set UI state based on eligibility and user permissions
    if (hasAssignPermission) {
      // Users with assign permission can see reassignment options and handle requests
      // Don't show lead details popup, only show reassignment popup
      setShowLeadDetails(false);
      
      // If there's already a reassignment request for this lead, show different UI for approval/rejection
      if (reassignmentStatus === 'requested') {
        // Show approval UI - handled by UI component
        setShowReassignmentOption(true);
      } else {
        // Regular reassignment eligibility for users with assign permission
        setShowReassignmentOption(true); // Managers can always see reassignment option
      }
    } else {
      // Regular users - follow standard eligibility rules
      if (canReassign) {
        // If user can reassign, show reassignment popup instead of lead details
        setShowReassignmentOption(true);
        setShowLeadDetails(false);
      } else {
        // If user cannot reassign, show lead details popup
        setShowReassignmentOption(false);
        setShowLeadDetails(true);
      }
    }
    
    console.log('Lead reassignment eligibility:', {
      fileSentToLogin,
      mainStatus,
      ageDays,
      canReassign,
      reassignmentReason,
      daysElapsed,
      reassignmentPeriod, 
      daysRemaining,
      isManagerPermissionRequired,
      hasAssignPermission,
      reassignmentStatus
    });
  };

  // Handle reassignment request, approval, or rejection with improved error handling
  const handleReassignmentRequest = async (action = 'request') => {
    try {
      // Ensure action is always a string
      const actionString = typeof action === 'object' ? 'request' : String(action);
      
      const userId = getUserId();
      if (!userId || !existingLeadData?.id) {
        alert('Missing required data for reassignment');
        return;
      }

      // Add validation logic for self-reassignment prevention
      if (actionString === 'request') {
        // Check if user is trying to reassign their own lead to themselves
        if (existingLeadData.created_by === userId) {
          alert("You can't reassign your own lead to yourself.");
          return;
        }

        // Check if user is already in assign_report_to (TL of this lead)
        if (existingLeadData.assign_report_to && 
            (existingLeadData.assign_report_to === userId || 
             (Array.isArray(existingLeadData.assign_report_to) && existingLeadData.assign_report_to.includes(userId)))) {
          alert("You're already TL of this lead.");
          return;
        }

        // Check if user is already assigned to this lead
        if (existingLeadData.assigned_to && 
            (existingLeadData.assigned_to === userId || 
             (Array.isArray(existingLeadData.assigned_to) && existingLeadData.assigned_to.includes(userId)))) {
          alert("You're already assigned to this lead.");
          return;
        }
      }
      
      // Log the reassignment action with lead details
      console.log(`${actionString.toUpperCase()} reassignment for lead:`, {
        leadId: existingLeadData.id,
        name: existingLeadData.name,
        status: existingLeadData.status,
        main_status: existingLeadData.main_status,
        file_sent_to_login: existingLeadData.file_sent_to_login,
        age_days: existingLeadData.age_days,
        has_assign_permission: existingLeadData.has_assign_permission,
        reassignment_status: existingLeadData.reassignment_status,
        can_reassign: existingLeadData.can_reassign,
        reassignment_reason: existingLeadData.reassignment_reason,
        assigned_to: existingLeadData.assigned_to,
        created_by: existingLeadData.created_by,
        assign_report_to: existingLeadData.assign_report_to,
        current_user: userId
      });

      // Construct the API URL based on action and permissions
      let apiUrl;
      let apiMethod = 'POST';
      let requestBody = {
        user_id: userId,
        file_sent_to_login: existingLeadData.file_sent_to_login || false,
        main_status: existingLeadData.main_status || '',
        age_days: existingLeadData.age_days || 0
      };
      
      // For regular reassignment requests, add comprehensive information
      if (actionString === 'request') {
        // Use the reassignmentReason state instead of prompt()
        const reason = reassignmentReason?.trim();
        if (!reason) {
          alert('Please enter a reason for reassignment');
          return;
        }
        
        requestBody.reason = reason;
        
        // Check if manager permission is required
        if (existingLeadData.is_manager_permission_required) {
          // If manager permission is required, set status as pending
          requestBody.reassignment_status = 'pending';
          requestBody.requires_manager_approval = true;
          requestBody.requested_at = getISTTimestamp();
          requestBody.requested_by = userId;
          requestBody.activity_type = 'lead_reassignment_request';
        } else {
          // If no manager permission required, set status as approved for direct reassignment
          requestBody.reassignment_status = 'approved';
          requestBody.approved_at = getISTTimestamp();
          requestBody.approved_by = userId;
          requestBody.activity_type = 'lead_reassigned';
        }
        
        // Add activity logging information
        requestBody.log_activity = true;
        
        // Set activity description based on manager permission requirement
        if (existingLeadData.is_manager_permission_required) {
          requestBody.activity_description = `Reassignment request submitted for manager approval. Reason: ${reason}`;
        } else {
          requestBody.activity_description = `Lead directly reassigned to user ${userId}. Reason: ${reason}`;
        }
        
        // Add schema update flags
        requestBody.update_lead_fields = true;
        requestBody.fields_to_update = [];
        
        // Add data code and campaign name changes if selected
        if (changeDataCode && newDataCode) {
          requestBody.data_code = newDataCode;
          requestBody.new_data_code = newDataCode; // Also include legacy parameter
          requestBody.update_data_code = true;
          requestBody.previous_data_code = existingLeadData.data_code || existingLeadData.dataCode;
          
          requestBody.fields_to_update.push({
            field: 'data_code',
            old_value: existingLeadData.data_code || existingLeadData.dataCode || '',
            new_value: newDataCode
          });
        }
        
        if (changeCampaignName && newCampaignName) {
          requestBody.campaign_name = newCampaignName;
          requestBody.new_campaign_name = newCampaignName; // Also include legacy parameter
          requestBody.update_campaign_name = true;
          requestBody.previous_campaign_name = existingLeadData.campaign_name || existingLeadData.campaignName;
          
          requestBody.fields_to_update.push({
            field: 'campaign_name',
            old_value: existingLeadData.campaign_name || existingLeadData.campaignName || '',
            new_value: newCampaignName
          });
        }
      }
      
      // Check eligibility for reassignment requests (not needed for approvals/rejections)
      if (actionString === 'request' && !existingLeadData.has_assign_permission) {
        // Skip eligibility check for users with assign permission (admin/managers)
        // For regular users, verify eligibility from API before proceeding
        if (!existingLeadData.can_reassign) {
          alert(`Cannot request reassignment: ${existingLeadData.reassignment_reason || 'Not eligible'}`);
          return;
        }
        
        if (existingLeadData.is_manager_permission_required) {
          alert('This lead requires manager approval for reassignment. Your request will be sent to a manager.');
        }
      }
      
      // Try to use the new endpoints first
      if (existingLeadData.has_assign_permission && 
          (actionString === 'approve' || actionString === 'reject')) {
        // Admin action: approve or reject reassignment request
        apiUrl = `${API_BASE_URL}/reassignment/${actionString}/${existingLeadData.id}?user_id=${userId}`;
        
        if (actionString === 'reject') {
          const rejReason = reassignmentReason?.trim();
          if (rejReason) {
            requestBody.rejection_reason = rejReason;
          } else {
            alert('Please enter a reason for rejection');
            return;
          }
        }
      } else {
        // Regular user action: request reassignment
        if (actionString === 'request') {
          // For reassignment requests, the target user is the requesting user themselves
          const targetUserId = userId; // Use the current user's ID as the target
          
          // Build API URL with comprehensive parameters
          apiUrl = `${API_BASE_URL}/reassignment/request?user_id=${userId}&lead_id=${existingLeadData.id}&target_user_id=${targetUserId}&reason=${encodeURIComponent(requestBody.reason)}`;
          
          // Check if manager permission is required
          if (existingLeadData.is_manager_permission_required) {
            // If manager permission is required, send request for approval
            apiUrl += `&reassignment_status=pending`;
            apiUrl += `&requires_manager_approval=true`;
            requestBody.activity_description = `Reassignment request submitted for manager approval. Reason: ${requestBody.reason}`;
          } else {
            // If no manager permission required, direct reassignment
            apiUrl += `&reassignment_status=approved`;
            apiUrl += `&approved_at=${encodeURIComponent(getISTTimestamp())}`;
            apiUrl += `&approved_by=${userId}`;
            requestBody.activity_description = `Lead directly reassigned to user ${userId}. Reason: ${requestBody.reason}`;
          }
          
          // Add activity logging flags
          apiUrl += `&log_activity=true`;
          apiUrl += `&activity_type=lead_reassignment_request`;
          apiUrl += `&activity_description=${encodeURIComponent(requestBody.activity_description)}`;
          
          // Add schema update flag
          apiUrl += `&update_lead_fields=true`;
          
          // Add additional lead metadata
          apiUrl += `&file_sent_to_login=${existingLeadData.file_sent_to_login || false}`;
          apiUrl += `&main_status=${encodeURIComponent(existingLeadData.main_status || '')}`;
          apiUrl += `&age_days=${existingLeadData.age_days || 0}`;
          apiUrl += `&approved_by=${userId}`;
          
          // Add data code change if selected
          if (changeDataCode && newDataCode) {
            apiUrl += `&data_code=${encodeURIComponent(newDataCode)}`;
          }
          
          // Add campaign name change if selected
          if (changeCampaignName && newCampaignName) {
            apiUrl += `&campaign_name=${encodeURIComponent(newCampaignName)}`;
          }
        } else {
          // For other actions, use reason from state
          const otherReason = reassignmentReason?.trim();
          if (!otherReason) {
            alert('Please enter a reason for reassignment');
            return;
          }
          
          // For reassignment requests, the target user is the requesting user themselves
          const targetUserId = userId; // Use the current user's ID as the target
          
          apiUrl = `${API_BASE_URL}/reassignment/request?user_id=${userId}&lead_id=${existingLeadData.id}&target_user_id=${targetUserId}&reason=${encodeURIComponent(otherReason)}`;
        }
      }
      

      
      // Try the new API endpoint, fall back to old one if it fails
      let response;
      try {

        response = await fetch(apiUrl, {
          method: apiMethod,
          headers: {
            'Content-Type': 'application/json',
          },
          body: apiMethod === 'POST' ? JSON.stringify(requestBody) : undefined
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (error) {

        // Fall back to old endpoint
        let fallbackUrl = `${API_BASE_URL}/leads/${existingLeadData.id}`;
        
        if (existingLeadData.has_assign_permission && 
            (action === 'approve' || action === 'reject')) {
          fallbackUrl += `/reassignment/${action}?user_id=${userId}`;
        } else {
          fallbackUrl += `/reassign?user_id=${userId}`;
          if (existingLeadData.main_status) {
            fallbackUrl += `&main_status=${encodeURIComponent(existingLeadData.main_status)}`;
          }
        }
        

        response = await fetch(fallbackUrl, {
          method: apiMethod,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });
      }

      // Handle different response statuses with appropriate messages
      if (response.status === 200 || response.status === 201) {
        const data = await response.json();

        // For direct reassignment, make additional API call to ensure lead schema is updated
        if (actionString === 'request' && (changeDataCode || changeCampaignName)) {
          try {
            const leadUpdateData = {
              lead_id: existingLeadData.id,
              user_id: userId,
              updates: {}
            };
            
            if (changeDataCode && newDataCode) {
              leadUpdateData.updates.data_code = newDataCode;
              leadUpdateData.updates.dataCode = newDataCode; // Support both field names
            }
            
            if (changeCampaignName && newCampaignName) {
              leadUpdateData.updates.campaign_name = newCampaignName;
              leadUpdateData.updates.campaignName = newCampaignName; // Support both field names
            }
            
            // Make secondary API call to update lead schema
            const updateResponse = await fetch(`${API_BASE_URL}/reassignment/leads/${existingLeadData.id}/update-fields?user_id=${userId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(leadUpdateData.updates)
            });
            
            if (updateResponse.ok) {
              console.log('Lead fields updated successfully');
            } else {
              console.warn('Lead fields update failed, but reassignment succeeded');
            }
          } catch (updateError) {
            console.warn('Secondary lead update failed:', updateError);
          }
        }
        
        // Log activity for reassignment
        if (actionString === 'request') {
          try {
            const activityData = {
              lead_id: existingLeadData.id,
              user_id: userId,
              activity_type: 'lead_reassigned',
              activity_title: 'Lead Reassigned',
              activity_description: `Lead reassigned to user ${userId}`,
              details: {
                reason: requestBody.reason || 'Direct reassignment',
                previous_owner: existingLeadData.created_by_name || existingLeadData.assigned_to_name || 'Unknown',
                new_owner: userId,
                reassignment_status: 'approved',
                timestamp: getISTTimestamp()
              }
            };
            
            // Add data code change to activity if applicable
            if (changeDataCode && newDataCode) {
              activityData.details.data_code_changed = {
                from: existingLeadData.data_code || existingLeadData.dataCode || 'Unknown',
                to: newDataCode
              };
              activityData.activity_description += ` | Data Code changed from "${existingLeadData.data_code || existingLeadData.dataCode || 'Unknown'}" to "${newDataCode}"`;
            }
            
            // Add campaign name change to activity if applicable
            if (changeCampaignName && newCampaignName) {
              activityData.details.campaign_name_changed = {
                from: existingLeadData.campaign_name || existingLeadData.campaignName || 'Unknown',
                to: newCampaignName
              };
              activityData.activity_description += ` | Campaign Name changed from "${existingLeadData.campaign_name || existingLeadData.campaignName || 'Unknown'}" to "${newCampaignName}"`;
            }
            
            // Make activity logging API call
            const activityResponse = await fetch(`${API_BASE_URL}/reassignment/leads/${existingLeadData.id}/activity`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(activityData)
            });
            
            if (activityResponse.ok) {
              console.log('Activity logged successfully');
            } else {
              console.warn('Activity logging failed, but reassignment succeeded');
            }
          } catch (activityError) {
            console.warn('Activity logging failed:', activityError);
          }
        }
        
        // Show appropriate success message based on action and user permissions
        if (actionString === 'approve') {
          alert('Lead reassignment approved successfully!');
          // Refresh the page after approval
          window.location.reload();
        } else if (actionString === 'reject') {
          alert('Lead reassignment rejected.');
          // Refresh the page after rejection
          window.location.reload();
        } else {
          // For reassignment requests, check if manager permission is required
          if (existingLeadData.is_manager_permission_required) {
            // If manager permission is required, show request sent message
            alert('Reassignment request sent for manager approval successfully!');
            // Refresh the page after request submission
            window.location.reload();
          } else {
            // If no manager permission required, show direct assignment message
            if (existingLeadData.has_assign_permission) {
              // Users with assign permission get direct assignment
              alert('Lead assigned to you successfully!');
            } else {
              // Regular users get direct reassignment (when no manager permission required)
              alert('Lead reassigned successfully!');
            }
            // Refresh the page after direct assignment
            window.location.reload();
          }
        }
        
        // Reset states and close the reassignment section
        setShowReassignmentOption(false);
        setShowLeadDetails(false);
        setMobileCheckResult(null);
        
        // Only populate form with existing lead data for direct reassignments
        // For manager approval requests, don't populate since reassignment is pending
        if (existingLeadData && !existingLeadData.is_manager_permission_required) {
          console.log('🔄 Populating form with existing lead data:', existingLeadData);
          
          // Populate basic information
          setMobileNumber(existingLeadData.mobile_number || existingLeadData.mobileNumber || '');
          setCustomerName(existingLeadData.name || existingLeadData.customer_name || existingLeadData.customerName || '');
          setAlternateNumber(existingLeadData.alternate_number || existingLeadData.alternateNumber || '');
          
          setCompanyName(existingLeadData.company_name || existingLeadData.companyName || '');
          setCompanyType(existingLeadData.company_type || existingLeadData.companyType || '');
          setCompanyCategory(existingLeadData.company_category || existingLeadData.companyCategory || '');
          
          // Populate financial information
          setSalary(existingLeadData.salary ? formatINR(existingLeadData.salary.toString()) : '');
          setPartnerSalary(existingLeadData.partner_salary || existingLeadData.partnerSalary ? 
            formatINR((existingLeadData.partner_salary || existingLeadData.partnerSalary).toString()) : '');
          setYearlyBonus(existingLeadData.yearly_bonus || existingLeadData.yearlyBonus ? 
            formatINR((existingLeadData.yearly_bonus || existingLeadData.yearlyBonus).toString()) : '');
          setBonusDivision(existingLeadData.bonus_division || existingLeadData.bonusDivision || '12');
          setLoanRequired(existingLeadData.loan_required || existingLeadData.loanRequired ? 
            formatINR((existingLeadData.loan_required || existingLeadData.loanRequired).toString()) : '');
          setFoirPercent(existingLeadData.foir_percent || existingLeadData.foirPercent || '60');
          
          // Populate campaign and data information
          setCampaignName(existingLeadData.campaign_name || existingLeadData.campaignName || '');
          setDataCode(existingLeadData.data_code || existingLeadData.dataCode || '');
          setProductType(existingLeadData.product_type || existingLeadData.productType || '');
          setStatus(existingLeadData.status || 'not_a_lead');
          
          // Populate obligations if available
          if (existingLeadData.obligations && Array.isArray(existingLeadData.obligations)) {
            setObligations(existingLeadData.obligations.map(obligation => ({
              product: obligation.product || '',
              bankName: obligation.bank_name || obligation.bankName || '',
              currentPos: obligation.current_pos || obligation.currentPos || '',
              monthlyEmi: obligation.monthly_emi || obligation.monthlyEmi || '',
              btPercent: obligation.bt_percent || obligation.btPercent || '0',
              btPos: obligation.bt_pos || obligation.btPos || '',
              bounceHistory: obligation.bounce_history || obligation.bounceHistory || 'no'
            })));
          }
          
          // Populate assignee information
          if (existingLeadData.assigned_to) {
            if (Array.isArray(existingLeadData.assigned_to)) {
              setAssignedTo(existingLeadData.assigned_to);
            } else {
              setAssignedTo([existingLeadData.assigned_to]);
            }
          }
          
          // Save the populated data to temporary storage for form continuity
          const populatedData = {
            leadInfo: {
              mobile_number: existingLeadData.mobile_number || existingLeadData.mobileNumber || '',
              customer_name: existingLeadData.name || existingLeadData.customer_name || existingLeadData.customerName || '',
              alternate_number: existingLeadData.alternate_number || existingLeadData.alternateNumber || '',
              company_name: existingLeadData.company_name || existingLeadData.companyName || '',
              company_type: existingLeadData.company_type || existingLeadData.companyType || '',
              company_category: existingLeadData.company_category || existingLeadData.companyCategory || '',
              salary: existingLeadData.salary || '',
              partner_salary: existingLeadData.partner_salary || existingLeadData.partnerSalary || '',
              yearly_bonus: existingLeadData.yearly_bonus || existingLeadData.yearlyBonus || '',
              bonus_division: existingLeadData.bonus_division || existingLeadData.bonusDivision || '12',
              loan_required: existingLeadData.loan_required || existingLeadData.loanRequired || '',
              foir_percent: existingLeadData.foir_percent || existingLeadData.foirPercent || '60',
              campaign_name: existingLeadData.campaign_name || existingLeadData.campaignName || '',
              data_code: existingLeadData.data_code || existingLeadData.dataCode || '',
              product_type: existingLeadData.product_type || existingLeadData.productType || '',
              status: existingLeadData.status || 'not_a_lead',
              lastUpdated: getISTTimestamp()
            }
          };
          
          // Save to temporary storage using helper function
          saveCurrentLeadInfoSection(populatedData.leadInfo);
          
          console.log('✅ Form populated successfully with existing lead data');
        } else if (existingLeadData && existingLeadData.is_manager_permission_required) {
          console.log('ℹ️ Reassignment request sent for manager approval. Form not populated.');
        }
        
        // Clear existingLeadData only after populating the form
        setExistingLeadData(null);
        setShowLeadForm(true);
        
        // Reset reassignment form selections
        setChangeDataCode(false);
        setChangeCampaignName(false);
        setNewDataCode('');
        setNewCampaignName('');
        setReassignmentReason('');
        
        // Reset obligation tracking states for continuing with existing lead
        setObligationHasUnsavedChanges(false);
        setObligationIsSaving(false);
        setObligationDataSaved(false);
      } else if (response.status === 403) {
        // Forbidden - Not eligible for reassignment yet or unauthorized
        const data = await response.json();
        if (existingLeadData.has_assign_permission) {
          // Error for admin users
          alert(data.message || `You don't have permission to ${actionString} this reassignment request.`);
        } else {
          // Error for regular users
          alert(data.message || 'This lead is not eligible for reassignment yet. Please try again later.');
        }
      } else if (response.status === 404) {
        alert('Lead not found. It may have been deleted or moved.');
      } else if (response.status === 409) {
        // Conflict - e.g., already reassigned or request already exists
        const data = await response.json();
        alert(data.message || 'This lead already has a pending reassignment request.');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {

      alert(`Error during reassignment ${actionString}: ` + (error.message || 'Please try again.'));
    }
  };
  
  // Helper functions for approval/rejection (to be used in UI)
  const handleReassignmentApproval = () => handleReassignmentRequest('approve');
  const handleReassignmentRejection = () => handleReassignmentRequest('reject');

  // Handle reassignment cancellation
  const handleReassignmentCancel = () => {
    // Show custom message that reassignment was cancelled due to no reason provided
    alert('Warning: Your request reassignment got cancelled because you didn\'t enter a reason');
    
    // Set the cancellation flag
    setReassignmentCancelled(true);
    
    // Close the reassignment popup
    setShowReassignmentOption(false);
    
    // Don't show lead details popup or create popup UI - just return to mobile check state
    setShowLeadDetails(false);
    setExistingLeadData(null);
    setAllDuplicateLeads([]);
    setMobileCheckResult(null);
    
    // Reset reassignment form selections
    setChangeDataCode(false);
    setChangeCampaignName(false);
    setNewDataCode('');
    setNewCampaignName('');
    setReassignmentReason('');
    
    // Clear mobile number and validation to allow fresh start
    setMobileNumber('');
    setMobileValidationError('');
  };

  // Handle company category change - update everywhere
  const handleCompanyCategoryChange = (newCategory) => {
    setCompanyCategory(newCategory);
    setCeCompanyCategory(newCategory);
  };

  // Shortfall check
  // let shortfall = null;
  // const parsedTotalBtPos = parseINR(totalBtPos); // Use parseINR directly
  // if (parsedTotalBtPos > effectiveFinalEligibility && effectiveFinalEligibility > 0) {
  //   shortfall = parsedTotalBtPos - effectiveFinalEligibility;
  // }

  // Function to remove an assignee
  const handleRemoveAssignee = (userToRemove) => {
    // If removing "None", clear the entire array
    if ((typeof userToRemove === 'object' && userToRemove.id === 'none') || 
        (typeof userToRemove === 'string' && userToRemove === 'None')) {
      setAssignedTo([]);
      return;
    }
    
    setAssignedTo((prev) => prev.filter((user) =>
      (typeof user === 'object' ? user.id : user) !== (typeof userToRemove === 'object' ? userToRemove.id : userToRemove)
    ));
  };

  // Function to add an assignee from the popup
  const handleAddAssignee = (newAssigneeUser) => {
    // Clear form validation error for assignedTo when user selects
    if (formValidationErrors.assignedTo) {
      setFormValidationErrors(prev => ({
        ...prev,
        assignedTo: false
      }));
    }
    
    // Handle "None" option - set it as the only selection
    if (newAssigneeUser.id === 'none' || newAssigneeUser.name === 'None') {
      setAssignedTo([{ id: 'none', name: 'None' }]);
      return;
    }
    
    setAssignedTo((prevAssignedTo) => {
      // If selecting a real user and "None" is currently selected, replace "None"
      const hasNone = prevAssignedTo.some(user => 
        (typeof user === 'object' && user.id === 'none') || 
        (typeof user === 'string' && user === 'None')
      );
      
      if (hasNone) {
        // Replace "None" with the new user
        return [newAssigneeUser];
      }
      
      // Handle both object and string formats for backward compatibility
      const newUserId = typeof newAssigneeUser === 'object' ? newAssigneeUser.id : newAssigneeUser;
      const newUserName = typeof newAssigneeUser === 'object' ? newAssigneeUser.name : newAssigneeUser;

      // Check if user is already assigned (by ID if object, by name if string)
      const isAlreadyAssigned = prevAssignedTo.some(assignedUser => {
        if (typeof assignedUser === 'object' && typeof newAssigneeUser === 'object') {
          return assignedUser.id === newAssigneeUser.id;
        } else if (typeof assignedUser === 'string' && typeof newAssigneeUser === 'string') {
          return assignedUser === newAssigneeUser;
        } else {
          // Mixed types - compare by name
          const assignedName = typeof assignedUser === 'object' ? assignedUser.name : assignedUser;
          return assignedName === newUserName;
        }
      });

      if (!isAlreadyAssigned) {
        return [...prevAssignedTo, newAssigneeUser];
      }
      return prevAssignedTo;
    });
  };

  // Handle obligation data updates from ObligationSection
  const handleObligationDataUpdate = (obligationStatus) => {

    
    if (obligationStatus) {
      setObligationHasUnsavedChanges(obligationStatus.hasUnsavedChanges || false);
      setObligationIsSaving(obligationStatus.isSaving || false);
      
      // Track when obligation data is successfully saved
      if (obligationStatus.hasUnsavedChanges === false && obligationStatus.isSaving === false) {
        setObligationDataSaved(true);

      } else {

      }
    }
  };

  // Create lead API function
  const createLead = async (leadData) => {
    try {
      const userId = getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }



      const response = await fetch(`${API_BASE_URL}/leads/?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData)
      });



      if (!response.ok) {
        const errorData = await response.json();


        // Handle validation errors specifically
        if (errorData.detail && Array.isArray(errorData.detail)) {
          const errorMessages = errorData.detail.map(err =>
            `${err.loc.join('.')}: ${err.msg} (received: ${err.input})`
          ).join('\n');
          throw new Error(`Validation errors:\n${errorMessages}`);
        }

        throw new Error(errorData.message || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log('✅ Lead created successfully:', data.name || data.customer_name);
      
      // ⚡ Emit event to notify LeadCRM component for instant update
      console.log('🚨🚨🚨 EMITTING EVENT AT:', new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
      console.log('📡 Event system available:', typeof leadEvents);
      console.log('📡 Lead data being sent:', data._id);
      
      leadEvents.emit('leadCreated', {
        lead: data,
        timestamp: Date.now()
      });
      
      console.log('✅ Event emitted successfully');
      
      // FALLBACK: Also store in localStorage for cross-page communication
      try {
        localStorage.setItem('newLeadCreated', JSON.stringify({
          lead: data,
          timestamp: Date.now()
        }));
        console.log('💾 Also saved to localStorage for cross-page updates');
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
      
      // Check if any listeners are registered
      setTimeout(() => {
        console.log('⏰ 100ms after emit - checking if LeadCRM received it...');
      }, 100);

      return data;
    } catch (error) {

      throw error;
    }
  };

  // Handle form submission
  // --- Enhanced Lead Submission Handler ---
  // Updated handleSubmit function with comprehensive error handling and validation
  // This function ensures both Lead Info and Obligation section data are properly combined and sent to the API
  const handleSubmit = async () => {
    // CRITICAL: Check if user has permission to create/add leads
    console.log('🔒 Checking CREATE LEAD permission before submission...');
    
    if (!checkUserHasAddLeadPermission()) {
      // User does NOT have permission to create leads
      console.error('❌ PERMISSION DENIED: User does not have permission to create leads');
      
      // Show modal/alert to user
      alert(
        "🚫 PERMISSION DENIED\n\n" +
        "You do not have permission to create leads.\n\n" +
        "The 'Add' permission is required in the 'Create LEAD' section.\n\n" +
        "Please contact your administrator to request access."
      );
      
      // Stop loading state
      setCreateLeadLoading(false);
      return; // Exit function - do not proceed with lead creation
    }
    
    console.log('✅ Permission check passed - user can create leads');
    
    // First validate all required fields
    if (!validateFormFields()) {
      // Just show validation errors, no alert
      setShowValidationErrors(true);
      return;
    }

    // Set loading state and trigger animation
    setCreateLeadLoading(true);
    animateButton('createLeadBtn');
    
    try {
      // --- Step 0: MANDATORY Obligation Data Validation ---
      // Validate that obligation section data has been properly filled and saved
      
      // Check if obligation data is currently being saved
      if (obligationIsSaving) {
        alert('⏳ Please wait for the obligation data to finish saving before creating the lead.');
        setCreateLeadLoading(false);
        return;
      }

      // Skip all obligation validation - obligation data is completely optional


      // --- Step 1.5: Validate Alternate Number ---
      // Ensure alternate number is different from main mobile number
      if (alternateNumber && alternateNumber === mobileNumber) {
        alert(
          "⚠️ INVALID ALTERNATE NUMBER!\n\n" +
          "The alternate mobile number must be different from the main mobile number.\n\n" +
          "Please:\n" +
          "1. Change the alternate number to a different number\n" +
          "2. Or remove the alternate number if not needed\n" +
          "3. Then create the lead again\n\n" +
          "Lead creation has been cancelled."
        );

        setCreateLeadLoading(false);
        return;
      }

      // --- Step 1: Initialize User Data ---
      // Ensure user data is properly initialized before submission
      // This prevents API errors related to missing user identification
      initializeUserData();


      // --- Step 2: Collect Current Lead Info Section Data ---
      // Gather all form data from the Lead Info section
      // This includes basic lead information, contact details, and assignment data
      const currentLeadInfoData = {
        productType,
        mobileNumber,
        customerName,
        alternateNumber,
        companyName,
        companyType,
        companyCategory,
        campaignName,
        dataCode,
        status,
        assignedTo,
        loanRequired,
        // Find the selected loan type ID from the loan types array
        selectedLoanTypeId: loanTypes.find(lt => lt.name === productType)?._id ||
          loanTypes.find(lt => lt.name === productType)?.id || '',
        // Map assigned users to their IDs for API
        assignedToIds: assignedTo.map(assignedUser => {
          if (typeof assignedUser === 'object') {
            // Handle "none" case specially
            if (assignedUser.id === 'none') {
              return 'none';
            }
            return assignedUser.id || assignedUser._id || assignedUser.user_id || '';
          } else {
            // Handle string "None" case
            if (assignedUser === 'None' || assignedUser === 'none') {
              return 'none';
            }
            // Fallback: find user by name if stored as string
            const user = assignableUsers.find(u =>
              u.name === assignedUser ||
              u.full_name === assignedUser ||
              `${u.first_name} ${u.last_name}`.trim() === assignedUser
            );
            return user?.id || user?._id || user?.user_id || '';
          }
        }).filter(id => id && id !== ''), // Keep "none" but remove empty IDs
        // Map assigned users to their supervisor/manager IDs for reporting structure
        assignReportTo: assignedTo.map(assignedUser => {
          // Handle "none" case - return empty string as no reporting needed
          if ((typeof assignedUser === 'object' && assignedUser.id === 'none') ||
              (typeof assignedUser === 'string' && (assignedUser === 'None' || assignedUser === 'none'))) {
            return '';
          }
          
          let user;
          if (typeof assignedUser === 'object') {
            user = assignedUser;
          } else {
            // Fallback: find user by name if stored as string
            user = assignableUsers.find(u =>
              u.name === assignedUser ||
              u.full_name === assignedUser ||
              `${u.first_name} ${u.last_name}`.trim() === assignedUser
            );
          }
          return user?.supervisor_id || user?.manager_id || user?.report_to || '';
        }).filter(id => id), // Remove empty IDs
        // Add eligibility data for calculation of totals
        eligibility: eligibility
      };

      // --- Step 3: Save Data to Temporary Storage ---
      // Save current lead info data to temporary storage for combination with obligation data
      saveCurrentLeadInfoSection(currentLeadInfoData);


      // --- Step 4: Validate Complete Data Availability ---
      // Check if both sections have the required data for lead creation
      if (!hasCompleteLeadData()) {
        // If we don't have complete data in temp storage, try to use current form data

        // Save current data before proceeding
        const currentData = {
          productType,
          mobileNumber,
          customerName,
          alternateNumber,
          companyName,
          companyType,
          companyCategory,
          campaignName,
          dataCode,
          status,
          assignedTo,
          loanRequired,
          selectedLoanTypeId: loanTypes.find(lt => lt.name === productType)?._id ||
            loanTypes.find(lt => lt.name === productType)?.id || '',
          assignedToIds: assignedTo.map(assignedUser => {
            if (typeof assignedUser === 'object') {
              // Handle "none" case specially
              if (assignedUser.id === 'none') {
                return 'none';
              }
              return assignedUser.id || assignedUser._id || assignedUser.user_id || '';
            } else {
              // Handle string "None" case
              if (assignedUser === 'None' || assignedUser === 'none') {
                return 'none';
              }
              return assignedUser; // Keep as string for now
            }
          }).filter(id => id && id !== ''), // Keep "none" but remove empty IDs
          eligibility: eligibility
        };
        saveCurrentLeadInfoSection(currentData);

      }

      // --- Step 5: Simple Validation ---
      // Only check if personal section is complete - obligation data is completely optional
      if (!isCreateLeadEnabled()) {
        alert('Please complete all required personal details before creating the lead.');
        return;
      }

      // --- Step 6: Combine Data from Both Sections ---
      // Get final combined lead data from both Lead Info and Obligation sections
      // Pass hook state as fallback for missing obligation data

      // Get current obligation data from temporary storage
      const currentTempData = getTempLeadData();
      const currentObligationData = currentTempData.obligation || {};



      const hookState = {
        salary,
        partnerSalary,
        yearlyBonus,
        bonusDivision,
        foirPercent,
        customFoirPercent: customFoirPercent || undefined,
        obligations,
        loanRequired,
        companyName,
        companyType: String(companyType || ''), // Ensure companyType is a string
        companyCategory,
        cibilScore,
        // Add calculated totals if available in hook
        totalBtPos: totalBtPos || undefined,
        totalObligation: totalObligation || undefined,
        eligibility: eligibility || undefined,
        // Add Check Eligibility section values if available in hook
        ceCompanyCategory: ceCompanyCategory || undefined,
        ceFoirPercent: ceFoirPercent || undefined,
        ceCustomFoirPercent: ceCustomFoirPercent || undefined,
        ceMonthlyEmiCanPay: ceMonthlyEmiCanPay || undefined,
        ceTenureMonths: ceTenureMonths || undefined,
        ceTenureYears: ceTenureYears || undefined,
        ceRoi: ceRoi || undefined,
        ceMultiplier: ceMultiplier || undefined,
        loanEligibilityStatus: loanEligibilityStatus || undefined,
        // Add processing bank from current obligation data
        processingBank: currentObligationData.processingBank || undefined
      };

      console.log('🔍 HOOKSTATE DEBUG - Obligation Data Being Passed:', {
        salary,
        partnerSalary,
        yearlyBonus,
        obligationsCount: obligations?.length || 0,
        obligations: obligations,
        cibilScore,
        totalBtPos,
        totalObligation
      });


      const leadData = getFinalLeadData(parseINR, hookState);

      console.log('📦 FINAL LEAD DATA - Checking Obligation Fields:', {
        hasDynamicFields: !!leadData.dynamic_fields,
        hasFinancialDetails: !!leadData.dynamic_fields?.financial_details,
        monthlyIncome: leadData.dynamic_fields?.financial_details?.monthly_income,
        obligationsCount: leadData.dynamic_fields?.obligations?.length || 0,
        obligations: leadData.dynamic_fields?.obligations
      });



      // --- Step 7: Additional Backend Validation ---
      // Ensure required fields are properly set for backend compatibility
      if (!leadData.loan_type) {
        leadData.loan_type = productType;
      }
      if (!leadData.loan_type_name) {
        leadData.loan_type_name = productType;
      }

      // Validate critical fields before sending to API
      const validationErrors = [];

      if (!leadData.first_name || leadData.first_name.trim() === '') {
        validationErrors.push('Customer name is required');
      }

      if (!leadData.mobile_number || leadData.mobile_number.length !== 10) {
        validationErrors.push('Valid 10-digit mobile number is required');
      }

      if (!leadData.loan_type || leadData.loan_type.trim() === '') {
        validationErrors.push('Product type is required');
      }

      if (!leadData.campaign_name || leadData.campaign_name.trim() === '') {
        validationErrors.push('Campaign name is required');
      }

      if (!leadData.status || leadData.status.trim() === '') {
        validationErrors.push('Status is required');
      }

      if (validationErrors.length > 0) {
        throw new Error('Validation failed:\n' + validationErrors.join('\n'));
      }

      // Validate and fix company_type if it's not a string
      if (leadData.dynamic_fields?.personal_details?.company_type &&
        typeof leadData.dynamic_fields.personal_details.company_type !== 'string') {

        leadData.dynamic_fields.personal_details.company_type = String(leadData.dynamic_fields.personal_details.company_type);
      }

      // Ensure company_category is a string
      if (leadData.dynamic_fields?.personal_details?.company_category &&
        typeof leadData.dynamic_fields.personal_details.company_category !== 'string') {

        leadData.dynamic_fields.personal_details.company_category = String(leadData.dynamic_fields.personal_details.company_category);
      }

      // Add default process dynamic fields
      if (!leadData.dynamic_fields.process) {
        leadData.dynamic_fields.process = {
          how_to_process: "None",
          case_type: "Normal",
          year: new Date().getFullYear().toString()
        };
      }

      // --- Step 8: Ensure Proper Data Types ---
      // Convert all numeric fields to proper integers for backend compatibility
      leadData.loan_amount = parseInt(leadData.loan_amount) || 0;
      leadData.dynamic_fields.financial_details.monthly_income =
        parseInt(leadData.dynamic_fields.financial_details.monthly_income) || 0;
      leadData.dynamic_fields.financial_details.partner_salary =
        parseInt(leadData.dynamic_fields.financial_details.partner_salary) || 0;
      leadData.dynamic_fields.financial_details.yearly_bonus =
        parseInt(leadData.dynamic_fields.financial_details.yearly_bonus) || 0;

      // --- Step 9: Format Obligation Data ---
      // Ensure obligations is an array as expected by backend
      if (leadData.dynamic_fields.obligations && Array.isArray(leadData.dynamic_fields.obligations)) {
        leadData.dynamic_fields.obligations = leadData.dynamic_fields.obligations.map(obl => ({
          ...obl,
          tenure: parseInt(obl.tenure) || 0,
          roi: parseFloat(obl.roi) || 0,
          total_loan: parseInt(obl.total_loan) || 0,
          outstanding: parseInt(obl.outstanding) || 0,
          emi: parseInt(obl.emi) || 0
        }));
      }

      // --- Step 10: Log Final Data ---
      // Log the complete lead data being sent to the API
      console.log('🚀 FINAL LEAD DATA BEING SENT TO API:');
      console.log('📋 Full leadData object:', JSON.stringify(leadData, null, 2));
      console.log('💰 Financial Details:', leadData.dynamic_fields?.financial_details);
      console.log('📊 Obligations:', leadData.dynamic_fields?.obligations);
      console.log('🏢 Personal Details:', leadData.dynamic_fields?.personal_details);
      console.log('✅ Check Eligibility:', leadData.dynamic_fields?.check_eligibility);


      // --- Step 11: Make API Call ---
      // Send the combined lead data to the backend API
      const result = await createLead(leadData);


      // --- Step 12: Clean Up on Success ---
      // Clear temporary data from storage after successful submission
      try {
        clearTempLeadData();


        // Make sure local storage is also cleared to avoid potential issues
        if (typeof window !== 'undefined') {
          // Remove any temporary lead data keys from localStorage
          const keysToRemove = [
            'temp_lead_info',
            'temp_lead_obligations',
            'temp_lead_data',
            'current_lead_info'
          ];

          keysToRemove.forEach(key => {
            try {
              localStorage.removeItem(key);
            } catch (e) {

            }
          });
        }
      } catch (cleanupError) {

        // Continue with form reset regardless of cleanup errors
      }

      // --- Step 13: Show Success Message ---
      // Inform user of successful lead creation
      alert('Lead created successfully!');

      // --- Step 14: Reset Form ---
      // Reset all form fields to their initial state
      // This prepares the form for the next lead creation
      try {

        // Define default/initial values for all fields
        const initialState = {
          productType: '',
          mobileNumber: '',
          customerName: '',
          alternateNumber: '',
          companyName: '',
          companyType: '',
          campaignName: '',
          dataCode: '',
          status: 'not_a_lead',
          assignedTo: [],
          salary: '',
          partnerSalary: '',
          yearlyBonus: '',
          bonusDivision: '12',
          loanRequired: '',
          foirPercent: '60',
          companyCategory: '',
          cibilScore: '',
          totalBtPos: '0',
          totalObligation: '0',
          companySearch: '',
          ceCompanyCategory: '',
          ceFoirPercent: '',
          ceTenureMonths: '',
          ceTenureYears: '',
          ceRoi: '',
          ceMonthlyEmiCanPay: '',
          ceMultiplier: '',
          obligations: [{
            product: "",
            bankName: "",
            tenure: "",
            roi: "",
            totalLoan: "",
            outstanding: "",
            emi: "",
            action: "",
          }]
        };

        // Reset Lead Information fields
        setProductType(initialState.productType);
        setMobileNumber(initialState.mobileNumber);
        setMobileValidationError(""); // Reset mobile validation error
        setCustomerName(initialState.customerName);
        setAlternateNumber(initialState.alternateNumber);
        setCompanyName(initialState.companyName);
        setCompanyType(initialState.companyType);
        setCampaignName(initialState.campaignName);
        setDataCode(initialState.dataCode);
        setStatus(initialState.status);
        setAssignedTo(initialState.assignedTo);

        // Reset Financial Information fields
        setSalary(initialState.salary);
        setPartnerSalary(initialState.partnerSalary);
        setYearlyBonus(initialState.yearlyBonus);
        setBonusDivision(initialState.bonusDivision);
        setLoanRequired(initialState.loanRequired);
        setFoirPercent(initialState.foirPercent);
        setCompanyCategory(initialState.companyCategory);
        setCibilScore(initialState.cibilScore);

        // Reset Obligation table
        setObligations(initialState.obligations);

        // Reset dropdown states
        setBankDropdowns([false]);
        setBankFilters(['']);
        setProductDropdowns([false]);

        // Reset Check Eligibility section
        setCeCompanyCategory(initialState.ceCompanyCategory);
        setCeFoirPercent(initialState.ceFoirPercent);
        setCeTenureMonths(initialState.ceTenureMonths);
        setCeTenureYears(initialState.ceTenureYears);
        setCeRoi(initialState.ceRoi);
        setCeMonthlyEmiCanPay(initialState.ceMonthlyEmiCanPay);
        setCeMultiplier(initialState.ceMultiplier);

        // Reset the totals
        setTotalBtPos(initialState.totalBtPos);
        setTotalObligation(initialState.totalObligation);

        // Reset company search
        setCompanySearch(initialState.companySearch);
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);

        // Reset obligation tracking states
        setObligationHasUnsavedChanges(false);
        setObligationIsSaving(false);
        setObligationDataSaved(false);



        // Reset lead form visibility
        setShowLeadForm(false);
      } catch (resetError) {

        // Force a simple reset of critical fields to avoid user confusion
        try {
          setProductType('');
          setMobileNumber('');
          setMobileValidationError('');
          setCustomerName('');
          setShowLeadForm(false);
        } catch (e) {

        }
      }

      // --- Step 15: Optional Page Reload ---
      // Uncomment the line below if you want to reload the page after successful submission
      // window.location.reload();

    } catch (error) {
      // --- Error Handling ---
      // Log and display any errors that occur during the submission process




      // Show user-friendly error message
      alert('Error creating lead: ' + error.message);

      // Note: Temporary data is NOT cleared on error to preserve user input


      // Add a recovery option for repeated errors
      const retryConfirmation = confirm('Error creating lead. Would you like to clear the form and start over?');
      if (retryConfirmation) {
        try {
          // Clear temporary data to start fresh
          clearTempLeadData();

          // Reset critical form fields
          setProductType('');
          setMobileNumber('');
          setMobileValidationError('');
          setCustomerName('');
          setShowLeadForm(false);
        } catch (recoveryError) {

          alert('Could not reset the form. Please refresh the page to start over.');
        }
      }
    } finally {
      // Reset loading state
      setCreateLeadLoading(false);
    }
  };

  return {
    // Basic info
    currentDateTime, productType, setProductType,
    mobileNumber, setMobileNumber, mobileValidationError, setMobileValidationError, handleMobileNumberChange, showLeadForm,
    campaignName, setCampaignName, dataCode, setDataCode,
    companyCategory, setCompanyCategory, assignedTo, setAssignedTo, handleRemoveAssignee, handleAddAssignee,
    showAssignPopup, setShowAssignPopup,
    status, setStatus, customerName, setCustomerName,
    alternateNumber, setAlternateNumber, handleAlternateNumberChange,
    companyName, setCompanyName, companyType, setCompanyType,
    salary, handleSalaryChange, partnerSalary, handlePartnerSalaryChange, yearlyBonus, handleYearlyBonusChange,
    bonusDivision, handleBonusDivisionChange, loanRequired, setLoanRequired,
    foirPercent, handleFoirPercentChange, customFoirPercent, setCustomFoirPercent, eligibility, leadFormRef, handleCheckMobile,
    // API data
    loanTypes, campaignNames, dataCodes, companyCategories, assignableUsers,
    loadingLoanTypes, loadingSettings,
    // Mobile check results
    mobileCheckResult, showReassignmentOption, showLeadDetails, existingLeadData,
    allDuplicateLeads, setAllDuplicateLeads,
    setShowReassignmentOption, setShowLeadDetails, setExistingLeadData,
    handleReassignmentRequest, handleReassignmentCancel, handleCompanyCategoryChange,
    // Obligations
    obligations, handleObligationChange, handleAddObligation, handleDeleteObligation,
    // Bank dropdown/filter
    bankList, bankDropdowns, setBankDropdowns, bankFilters, handleBankDropdown,
    handleBankFilterChange, handleBankSelect,
    // Product dropdown
    productTypes, productDropdowns, setProductDropdowns, handleProductDropdown, handleProductSelect,
    // Customer Obligation summary
    totalBtPos, totalObligation, cibilScore, setCibilScore, actionTypes,
    // Company search
    companySearch, companySuggestions, showCompanySuggestions, isCompanyLoading,
    handleCompanyInputChange, handleCompanySearchClick, handleCompanySuggestionClick,
    setShowCompanySuggestions, setCompanySuggestions,
    companyTypes, statusOptions, bonusDivisions, foirPercents,
    // Check Eligibility Section
    ceCompanyCategory, handleCeCompanyCategoryChange,
    ceFoirPercent, handleCeFoirPercentChange, ceCustomFoirPercent, setCeCustomFoirPercent,
    ceTenureMonths, handleCeTenureMonthsChange,
    ceTenureYears, handleCeTenureYearsChange,
    ceRoi, handleCeRoiChange,
    ceMonthlyEmiCanPay, handleCeMonthlyEmiCanPayChange,
    ceMultiplier, handleCeMultiplierChange,
    loanEligibilityStatus,
    checkEligibilityCompanyCategories, formatINR, parseINR,
    // Obligation tracking
    obligationHasUnsavedChanges, obligationIsSaving, obligationDataSaved, handleObligationDataUpdate,
    handleSaveObligationData, handleClearObligationChanges,
    isPersonalSectionComplete, hasAnyObligationData, isCreateLeadEnabled,
    // Reassignment form
    showReassignmentModal, setShowReassignmentModal, reassignmentReason, setReassignmentReason,
    newDataCode, setNewDataCode, newCampaignName, setNewCampaignName,
    changeDataCode, setChangeDataCode, changeCampaignName, setChangeCampaignName,
    // Lead creation
    createLead, handleSubmit,
    // Form validation
    formValidationErrors, setFormValidationErrors, showValidationErrors, setShowValidationErrors,
    // Button states and animations
    checkMobileLoading, createLeadLoading, reassignmentActionLoading, setReassignmentActionLoading,
    buttonAnimations, animateButton,
    // Background loading states
    backgroundDataLoaded, bankListLoaded, companyDataLoaded, assignableUsersLoaded,
    // Permission state
    hasAddLeadPermission,
    hasReassignmentPopupPermission
  };
}

// --- Helper Functions for Permissions ---
// Function to check if user has super admin permissions
export const checkUserIsSuperAdmin = () => {
  try {
    // Get user permissions from localStorage
    const userPermissions = localStorage.getItem('userPermissions');
    if (!userPermissions) return false;
    
    // Try to parse permissions (might be JSON string or other format)
    let permissions;
    try {
      permissions = JSON.parse(userPermissions);
    } catch (e) {

      permissions = userPermissions;
    }
    
    // Check if user is explicitly marked as superadmin in any field
    if (typeof permissions === 'object' && !Array.isArray(permissions)) {
      // NEW: Check for your specific permission format first
      if (
        (permissions.pages === '*' && permissions.actions === '*') ||
        (permissions.Global === '*') ||
        (permissions.global === '*') ||
        (permissions['*'] === '*')
      ) {

        return true;
      }
      
      // Check for Leads wildcard permission - REMOVED: This was incorrectly treating leads permissions as super admin
      // Regular leads permissions like ["show", "own"] should NOT grant super admin privileges
      // if (permissions.Leads === '*' || permissions.leads === '*') {
      //   return true;
      // }
      
      if (
        permissions.superadmin === true || 
        permissions.isSuperAdmin === true || 
        permissions.is_superadmin === true ||
        permissions.is_super_admin === true ||
        permissions.super_admin === true ||
        permissions.role === 'superadmin' ||
        permissions.role === 'super_admin' ||
        permissions.user_type === 'superadmin' ||
        permissions.user_type === 'super_admin' ||
        permissions.admin_type === 'super'
      ) {

        return true;
      }
      
      // Check for admin role with full permissions
      if (
        (permissions.role === 'admin' && permissions.full_access === true) ||
        (permissions.user_type === 'admin' && permissions.full_access === true)
      ) {
        return true;
      }
      
      // Check traditional page/action permission format
      const hasPageStar = permissions['page.*'] || permissions['page *'];
      const hasActionStar = permissions['action.*'] || permissions['action *'];
      if (hasPageStar && hasActionStar) {
        return true;
      }
    }
    
    // Check array format permissions
    if (Array.isArray(permissions)) {
      // Look for superadmin marker in arrays
      if (
        permissions.includes('superadmin') || 
        permissions.includes('super_admin') || 
        permissions.includes('admin.super')
      ) {
        return true;
      }
      
      // Check for wildcard permissions
      const hasPageStar = permissions.some(perm => 
        typeof perm === 'string' && (
          perm === 'page.*' || 
          perm === 'page *' ||
          perm === '*' ||
          perm === 'all'
        )
      );
      
      const hasActionStar = permissions.some(perm => 
        typeof perm === 'string' && (
          perm === 'action.*' || 
          perm === 'action *' ||
          perm === '*' ||
          perm === 'all'
        )
      );
      
      if (hasPageStar && hasActionStar) {
        return true;
      }
    }
    
    // Check for string format that might indicate superadmin
    if (typeof permissions === 'string') {
      const lcPerm = permissions.toLowerCase();
      return (
        lcPerm.includes('superadmin') || 
        lcPerm.includes('super admin') || 
        lcPerm.includes('admin:super') ||
        lcPerm.includes('admin:*')
      );
    }
    
    return false;
  } catch (error) {

    return false;
  }
};

// Function to check if user has assign permission for leads (global version)
export const checkUserHasAssignPermissionGlobal = () => {
  try {
    // First check if user is super admin
    if (checkUserIsSuperAdmin()) {
      return true; // Super admins have all permissions
    }
    
    // Get user data from localStorage (contains role and permissions)
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        console.log('🔍 Checking assign permission for user:', {
          userName: user.name,
          roleName: user.role?.name,
          permissions: user.role?.permissions
        });
        
        // Check if user has super admin role (role name "Super Admin" or similar)
        if (user.role?.name && user.role.name.toLowerCase().includes('super admin')) {
          console.log('✅ User has super admin role');
          return true;
        }
        
        // Check the permissions array in user's role
        if (user.role?.permissions && Array.isArray(user.role.permissions)) {
          const leadsPermission = user.role.permissions.find(p => p.page === 'leads');
          if (leadsPermission && leadsPermission.actions && Array.isArray(leadsPermission.actions)) {
            const hasAssignAction = leadsPermission.actions.includes('assign');
            console.log('🔍 Leads permission check:', {
              leadsActions: leadsPermission.actions,
              hasAssignAction: hasAssignAction
            });
            return hasAssignAction;
          }
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    
    // Fallback: Get user permissions from localStorage (string format)
    const userPermissions = localStorage.getItem('userPermissions');
    if (!userPermissions) return false;
    
    // Try to parse permissions (might be JSON string or other format)
    let permissions;
    try {
      permissions = JSON.parse(userPermissions);
    } catch (e) {

      permissions = userPermissions;
    }
    
    // Check if user has direct assign role marker
    if (typeof permissions === 'object' && !Array.isArray(permissions)) {
      // NEW: Check for your specific permission format first
      if (
        (permissions.pages === '*' && permissions.actions === '*') ||
        (permissions.Leads === '*') ||
        (permissions.leads === '*') ||
        (permissions.Global === '*') ||
        (permissions.global === '*') ||
        (permissions['*'] === '*')
      ) {

        return true;
      }
      
      // Check for assign manager role
      if (
        permissions.role === 'assign_manager' ||
        permissions.role === 'assign_admin' ||
        permissions.user_type === 'assign_manager' ||
        permissions.can_assign === true ||
        permissions.assign_permission === true
      ) {

        return true;
      }
      
      // Check in object format - could be nested under modules
      if (permissions.leads && typeof permissions.leads === 'object') {
        if (permissions.leads.assign === true) return true;
      }
      
      if (permissions.lead && typeof permissions.lead === 'object') {
        if (permissions.lead.assign === true) return true;
      }
      
      // Check for direct assign_leads permission
      if (permissions.assign_leads === true) return true;
      
      // Check for permission in permissions.actions array
      if (Array.isArray(permissions.actions) || Array.isArray(permissions.permissions)) {
        const actionArray = Array.isArray(permissions.actions) ? permissions.actions : permissions.permissions;
        if (actionArray.some(action => 
          (typeof action === 'string' && (
            action.includes('assign') && 
            (action.includes('lead') || action === 'assign')
          ))
        )) {
          return true;
        }
      }
    }
    
    // Check array format permissions
    if (Array.isArray(permissions)) {
      return permissions.some(perm => {
        if (typeof perm === 'string') {
          return (
            perm === 'leads.assign' || 
            perm === 'lead.assign' || 
            perm === 'assign_leads' ||
            perm === 'leads:assign' ||
            perm === 'lead:assign' ||
            perm === 'assign' ||
            perm.includes('assign_lead')
          );
        }
        return false;
      });
    }
    
    // Check for string format
    if (typeof permissions === 'string') {
      const lcPerm = permissions.toLowerCase();
      return (
        lcPerm.includes('assign_leads') || 
        lcPerm.includes('leads.assign') || 
        lcPerm.includes('lead.assign') ||
        lcPerm.includes('assign:leads')
      );
    }
    
    return false;
  } catch (error) {

    return false;
  }
};

// Enhanced permission checker for reassignment approve/reject buttons
// Checks for patterns like "page * and action *" or "page leads and action assign"
export const checkReassignmentPermissions = (rawPermissions) => {
  try {

    
    if (!rawPermissions) {

      return false;
    }
    
    // Handle string permissions - this is the most common format
    if (typeof rawPermissions === 'string') {
      const permStr = rawPermissions.toLowerCase();

      
      // Check for wildcard patterns - EXACT match for user's requirement
      if (permStr.includes('page * and action *')) {

        return true;
      }
      
      // Check for leads assign pattern - EXACT match for user's requirement  
      if (permStr.includes('page leads and action assign')) {

        return true;
      }
      
      // Check for other common wildcard patterns
      if (permStr.includes('page:* and action:*') ||
          permStr.includes('page=* and action=*') ||
          permStr.includes('page*action*')) {

        return true;
      }
      
      // Check for other leads assign patterns
      if (permStr.includes('page:leads and action:assign') ||
          permStr.includes('page=leads and action=assign') ||
          permStr.includes('leads:assign') ||
          permStr.includes('leads.assign') ||
          permStr.includes('leads assign')) {

        return true;
      }
      
      // Check for simple wildcard indicators
      if (permStr === '*' || permStr === 'all' || permStr === 'admin' || permStr === 'superadmin') {

        return true;
      }
      
      // Check for reassignment specific permissions
      if (permStr.includes('reassignment') && (permStr.includes('approve') || permStr.includes('*'))) {

        return true;
      }
      

      return false;
    }
    
    // Handle object/JSON permissions
    let permissions;
    try {
      permissions = typeof rawPermissions === 'object' ? rawPermissions : JSON.parse(rawPermissions);

    } catch (e) {

      return false;
    }
    
    // NEW: Check for your specific permission format
    if (
      (permissions.pages === '*' && permissions.actions === '*') ||
      (permissions.Leads === '*') ||
      (permissions.leads === '*') ||
      (permissions.Global === '*') ||
      (permissions.global === '*') ||
      (permissions['*'] === '*')
    ) {

      return true;
    }
    
    // Check for wildcard permissions in object format
    if ((permissions.page === '*' && permissions.action === '*') ||
        (permissions.pages === '*' && permissions.actions === '*')) {

      return true;
    }
    
    // Check for leads page with assign action in object format
    if ((permissions.page === 'leads' && permissions.action === 'assign') ||
        (permissions.pages === 'leads' && permissions.actions === 'assign') ||
        (permissions.leads && (permissions.leads.assign === true || permissions.leads === '*')) ||
        (permissions.Leads && (permissions.Leads.assign === true || permissions.Leads === '*')) ||
        (permissions.reassignment && (permissions.reassignment.approve === true || permissions.reassignment === '*'))) {

      return true;
    }
    
    // Check for permissions in array format
    if (Array.isArray(permissions)) {

      
      const hasWildcard = permissions.some(perm => {
        if (typeof perm === 'string') {
          const permLower = perm.toLowerCase();
          return permLower.includes('*') || 
                 permLower === 'page * and action *' ||
                 permLower === 'all' ||
                 permLower === 'admin' ||
                 permLower === 'superadmin';
        }
        if (typeof perm === 'object') {
          return (perm.page === '*' && perm.action === '*') ||
                 (perm.pages === '*' && perm.actions === '*');
        }
        return false;
      });
      
      const hasLeadsAssign = permissions.some(perm => {
        if (typeof perm === 'string') {
          const permLower = perm.toLowerCase();
          return permLower.includes('page leads and action assign') ||
                 permLower.includes('leads') && permLower.includes('assign') ||
                 permLower === 'leads.assign' ||
                 permLower === 'leads:assign';
        }
        if (typeof perm === 'object') {
          return (perm.page === 'leads' && perm.action === 'assign') ||
                 (perm.pages === 'leads' && perm.actions === 'assign');
        }
        return false;
      });
      
      if (hasWildcard || hasLeadsAssign) {

        return true;
      }
    }
    

    return false;
  } catch (error) {

    return false;
  }
};

/**
 * Check if user has permission to create/add leads
 * Checks for "add" action in leads.create_lead or general leads permissions
 */
export const checkUserHasAddLeadPermission = () => {
  try {
    console.log('🔍 Checking if user has ADD lead permission...');
    
    // First check if user is super admin - super admins can do everything
    if (checkUserIsSuperAdmin()) {
      console.log('✅ User is Super Admin - has ADD permission');
      return true;
    }
    
    // Get user data from localStorage (contains role and permissions)
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        console.log('🔍 Checking ADD permission for user:', {
          userName: user.name,
          roleName: user.role?.name,
          permissions: user.role?.permissions
        });
        
        // Check if user has super admin role
        if (user.role?.name && user.role.name.toLowerCase().includes('super admin')) {
          console.log('✅ User has super admin role - has ADD permission');
          return true;
        }
        
        // Check the permissions array in user's role
        if (user.role?.permissions && Array.isArray(user.role.permissions)) {
          // Check for nested leads.create_lead permission with "add" action
          const createLeadPermission = user.role.permissions.find(p => 
            p.page === 'leads.create_lead' || p.page === 'leads_create_lead'
          );
          
          if (createLeadPermission && createLeadPermission.actions) {
            const actions = Array.isArray(createLeadPermission.actions) ? 
              createLeadPermission.actions : [createLeadPermission.actions];
            
            const hasAddAction = actions.includes('add');
            console.log('🔍 Nested leads.create_lead permission check:', {
              page: createLeadPermission.page,
              actions: actions,
              hasAddAction: hasAddAction
            });
            
            if (hasAddAction) {
              console.log('✅ User has ADD permission (nested format)');
              return true;
            }
          }
          
          // Check for general leads permission with "add" action (backward compatibility)
          const leadsPermission = user.role.permissions.find(p => p.page === 'leads');
          if (leadsPermission && leadsPermission.actions) {
            const actions = Array.isArray(leadsPermission.actions) ? 
              leadsPermission.actions : [leadsPermission.actions];
            
            const hasAddAction = actions.includes('add');
            console.log('🔍 General leads permission check:', {
              leadsActions: actions,
              hasAddAction: hasAddAction
            });
            
            if (hasAddAction) {
              console.log('✅ User has ADD permission (unified format)');
              return true;
            }
          }
        }
      } catch (e) {
        console.error('❌ Error parsing user data:', e);
      }
    }
    
    // Fallback: Check userPermissions in localStorage (alternative format)
    const userPermissions = localStorage.getItem('userPermissions');
    if (userPermissions) {
      try {
        const permissions = JSON.parse(userPermissions);
        
        // Check for wildcard permissions
        if (permissions['*'] === '*' || 
            permissions.leads === '*' || 
            permissions.Leads === '*') {
          console.log('✅ User has wildcard permission - has ADD');
          return true;
        }
        
        // Check for add in leads permissions
        if (permissions.leads && Array.isArray(permissions.leads)) {
          if (permissions.leads.includes('add')) {
            console.log('✅ User has ADD in leads array');
            return true;
          }
        }
        
        // Check for nested format
        if (permissions['leads.create_lead'] && Array.isArray(permissions['leads.create_lead'])) {
          if (permissions['leads.create_lead'].includes('add')) {
            console.log('✅ User has ADD in leads.create_lead array');
            return true;
          }
        }
      } catch (e) {
        console.error('❌ Error parsing userPermissions:', e);
      }
    }
    
    console.log('❌ User does NOT have ADD lead permission');
    return false;
    
  } catch (error) {
    console.error('❌ Error in checkUserHasAddLeadPermission:', error);
    return false;
  }
};

// Function to check if user has reassignment popup permission
const checkUserHasReassignmentPopupPermission = () => {
  try {
    console.log('🔐 Checking REASSIGNMENT POPUP permission...');
    
    // Super admins always have access
    if (checkUserIsSuperAdmin()) {
      console.log('✅ User is Super Admin - has REASSIGNMENT POPUP permission');
      return true;
    }
    
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        console.log('🔍 Checking REASSIGNMENT POPUP permission for user:', {
          userName: user.name,
          roleName: user.role?.name,
          permissions: user.role?.permissions
        });
        
        // Check if user has super admin role
        if (user.role?.name && user.role.name.toLowerCase().includes('super admin')) {
          console.log('✅ User has super admin role - has REASSIGNMENT POPUP permission');
          return true;
        }
        
        // Check the permissions array in user's role
        if (user.role?.permissions && Array.isArray(user.role.permissions)) {
          // Check for nested leads.create_lead permission with "reassignment_popup" action
          const createLeadPermission = user.role.permissions.find(p => 
            p.page === 'leads.create_lead' || p.page === 'leads_create_lead'
          );
          
          if (createLeadPermission && createLeadPermission.actions) {
            const actions = Array.isArray(createLeadPermission.actions) ? 
              createLeadPermission.actions : [createLeadPermission.actions];
            
            const hasReassignmentPopup = actions.includes('reassignment_popup');
            console.log('🔍 Nested leads.create_lead permission check:', {
              page: createLeadPermission.page,
              actions: actions,
              hasReassignmentPopup: hasReassignmentPopup
            });
            
            if (hasReassignmentPopup) {
              console.log('✅ User has REASSIGNMENT_POPUP permission (nested format)');
              return true;
            }
          }
          
          // Check for general leads permission with "reassignment_popup" action (backward compatibility)
          const leadsPermission = user.role.permissions.find(p => p.page === 'leads');
          if (leadsPermission && leadsPermission.actions) {
            const actions = Array.isArray(leadsPermission.actions) ? 
              leadsPermission.actions : [leadsPermission.actions];
            
            const hasReassignmentPopup = actions.includes('reassignment_popup');
            console.log('🔍 General leads permission check:', {
              leadsActions: actions,
              hasReassignmentPopup: hasReassignmentPopup
            });
            
            if (hasReassignmentPopup) {
              console.log('✅ User has REASSIGNMENT_POPUP permission (unified format)');
              return true;
            }
          }
        }
      } catch (e) {
        console.error('❌ Error parsing user data:', e);
      }
    }
    
    // Fallback: Check userPermissions in localStorage (alternative format)
    const userPermissions = localStorage.getItem('userPermissions');
    if (userPermissions) {
      try {
        const permissions = JSON.parse(userPermissions);
        
        // Check for wildcard permissions
        if (permissions['*'] === '*' || 
            permissions.leads === '*' || 
            permissions.Leads === '*') {
          console.log('✅ User has wildcard permission - has REASSIGNMENT POPUP');
          return true;
        }
        
        // Check for reassignment_popup in leads permissions
        if (permissions.leads && Array.isArray(permissions.leads)) {
          if (permissions.leads.includes('reassignment_popup')) {
            console.log('✅ User has REASSIGNMENT_POPUP in leads array');
            return true;
          }
        }
        
        // Check for nested format
        if (permissions['leads.create_lead'] && Array.isArray(permissions['leads.create_lead'])) {
          if (permissions['leads.create_lead'].includes('reassignment_popup')) {
            console.log('✅ User has REASSIGNMENT_POPUP in leads.create_lead array');
            return true;
          }
        }
      } catch (e) {
        console.error('❌ Error parsing userPermissions:', e);
      }
    }
    
    console.log('❌ User does NOT have REASSIGNMENT POPUP permission');
    return false;
    
  } catch (error) {
    console.error('❌ Error in checkUserHasReassignmentPopupPermission:', error);
    return false;
  }
};

const dummyLeads = [
  {
    id: 1,
    name: "John Doe",
    mobile: "9876543210",
    productType: "Personal Loan",
    assignedTo: "Agent 1",
    status: "Open",
  },
  {
    id: 2,
    name: "Jane Smith",
    mobile: "9123456789",
    productType: "Home Loan",
    assignedTo: "Agent 2",
    status: "Open",
  },
  {
    id: 3,
    name: "Amit Patel",
    mobile: "9001234567",
    productType: "Overdraft",
    assignedTo: "Agent 3",
    status: "Closed",
  },
];

function ReassignmentTable({ 
  reassignmentActionLoading, 
  setReassignmentActionLoading, 
  buttonAnimations, 
  animateButton 
}) {
  const [reassignmentRequests, setReassignmentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filter, setFilter] = useState("all"); // all, pending, approved, rejected
  
  // Check if user has permission to approve/reject reassignments
  const [hasPermissions, setHasPermissions] = useState({
    assign: false,
    superAdmin: false
  });
  
  // Check permissions when component mounts
  useEffect(() => {
    try {
      const rawPermissions = localStorage.getItem('userPermissions');
      
      try {
        const parsedPermissions = JSON.parse(rawPermissions);
      } catch (e) {
      }
      
      // Check for super admin permissions using global function
      const isSuperAdmin = checkUserIsSuperAdmin();
      
      // Check for assign permissions using global function
      const hasAssignPermission = checkUserHasAssignPermissionGlobal();
      
      // Enhanced permission checking for reassignment buttons
      const canApproveReassignmentsAdvanced = checkReassignmentPermissions(rawPermissions);
      
      // Update permissions state
      setHasPermissions({
        assign: hasAssignPermission || canApproveReassignmentsAdvanced,
        superAdmin: isSuperAdmin
      });
      
      console.log('User permissions loaded:', { 
        hasAssignPermission, 
        isSuperAdmin,
        canApproveReassignmentsAdvanced,
        canApprove: hasAssignPermission || isSuperAdmin || canApproveReassignmentsAdvanced
      });
      
      // Log role information if available
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('User role information:', {
          role: user.role,
          userType: user.user_type || user.userType,
          permissions: user.permissions
        });
      } catch (e) {

      }
    } catch (error) {

    }
  }, []);
  
  // Check if user can approve reassignments - using both the state and a direct check
  // This ensures we catch permissions even if they change during the session
  
  // SIMPLIFIED PERMISSION CHECK - Direct pattern matching for user's requirements
  const userPermissions = localStorage.getItem('userPermissions');
  const directPermissionCheck = userPermissions && (
    userPermissions.includes('page * and action *') ||
    userPermissions.includes('page leads and action assign')
  );
  
  const canApproveReassignments = directPermissionCheck || 
                                 hasPermissions.assign || 
                                 hasPermissions.superAdmin || 
                                 checkUserIsSuperAdmin() || 
                                 checkUserHasAssignPermissionGlobal() || 
                                 checkReassignmentPermissions(userPermissions);
  
  // Enhanced Debug logging for permission checks
  const permissionsFromStorage = localStorage.getItem('userPermissions');
  const userData = localStorage.getItem('user');
  
  console.log('🔍 DETAILED Reassignment Permission Debug:', {
    'hasPermissions.assign': hasPermissions.assign,
    'hasPermissions.superAdmin': hasPermissions.superAdmin,
    'checkUserIsSuperAdmin()': checkUserIsSuperAdmin(),
    'checkUserHasAssignPermissionGlobal()': checkUserHasAssignPermissionGlobal(),
    'checkReassignmentPermissions()': checkReassignmentPermissions(permissionsFromStorage),
    'directPermissionCheck': userPermissions && (
      userPermissions.includes('page * and action *') ||
      userPermissions.includes('page leads and action assign')
    ),
    'FINAL canApproveReassignments': canApproveReassignments,
    'rawPermissions': permissionsFromStorage,
    'userData': userData,
    'permissionsType': typeof permissionsFromStorage,
    'permissionsLength': permissionsFromStorage ? permissionsFromStorage.length : 0
  });
  
  // Try to parse and show detailed permission structure
  try {
    if (rawPermissions) {
      console.log('🔍 Raw permissions analysis:', {
        'isString': typeof rawPermissions === 'string',
        'content': rawPermissions,
        'includedPageStar': rawPermissions.includes('page *'),
        'includedActionStar': rawPermissions.includes('action *'),
        'includedLeadsAssign': rawPermissions.includes('leads') && rawPermissions.includes('assign')
      });
      
      // Try to parse as JSON if possible
      try {
        const parsed = JSON.parse(rawPermissions);

      } catch (e) {

      }
    }
    
    // Also check userData structure
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log('🔍 User data structure:', {
          role: parsedUser.role,
          user_type: parsedUser.user_type,
          permissions: parsedUser.permissions,
          pages: parsedUser.pages,
          actions: parsedUser.actions
        });
      } catch (e) {

      }
    }
  } catch (error) {

  }
  
  useEffect(() => {
    fetchReassignmentRequests();
  }, []);
  
  // Fetch reassignment requests from the API
  const fetchReassignmentRequests = async () => {
    try {
      setLoading(true);
      // Get user ID from localStorage directly
      const userId = (() => {
        try {
          const id = localStorage.getItem('userId');
          if (id) return id;
          
          // Try to get from user object if userId not directly available
          const userData = localStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            return parsedUser.id || parsedUser._id || parsedUser.user_id;
          }
          return null;
        } catch (e) {

          return null;
        }
      })();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Try multiple endpoints with fallbacks if previous ones fail
      const possibleEndpoints = [
        `/reassignment/list?user_id=${userId}`,
        `/api/reassignment-requests?user_id=${userId}`,
        `/leads/reassignment?user_id=${userId}`,
        `/leads/reassign/requests?user_id=${userId}`,
        `/reassignment/requests?user_id=${userId}`
      ];
      
      let response = null;
      let lastError = null;
      
      // Try each endpoint until one works
      for (const endpoint of possibleEndpoints) {
        try {

          const attemptResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (attemptResponse.ok) {
            response = attemptResponse;

            break; // Exit the loop if we get a successful response
          } else {

            lastError = new Error(`HTTP error! status: ${attemptResponse.status}`);
          }
        } catch (err) {

          lastError = err;
        }
      }
      
      // If all endpoints failed, throw the last error
      if (!response) {
        throw lastError || new Error("All endpoints failed to respond");
      }
      
      const data = await response.json();

      
      // Handle different API response formats
      let requests = [];
      
      if (data) {
        if (Array.isArray(data)) {
          // If response is directly an array
          requests = data;
        } else if (data.requests && Array.isArray(data.requests)) {
          // If response has a requests property that's an array
          requests = data.requests;
        } else if (data.data && Array.isArray(data.data)) {
          // If response has a data property that's an array
          requests = data.data;
        } else if (data.results && Array.isArray(data.results)) {
          // If response has a results property that's an array
          requests = data.results;
        } else if (data.reassignments && Array.isArray(data.reassignments)) {
          // If response has a reassignments property that's an array
          requests = data.reassignments;
        } else if (data.leads && Array.isArray(data.leads)) {
          // If response has a leads property that's an array
          requests = data.leads;
        } else {

          // Try to extract any array in the response
          const possibleArrays = Object.values(data).filter(val => Array.isArray(val));
          if (possibleArrays.length > 0) {
            requests = possibleArrays[0];

          }
        }
      }
      

      setReassignmentRequests(requests);
    } catch (error) {

      setError(error.message);
      setReassignmentRequests([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle approval of reassignment request
  const handleApproveRequest = async (leadId) => {
    // Set loading state for this specific action
    setReassignmentActionLoading(prev => ({ ...prev, [`approve_${leadId}`]: true }));
    animateButton(`approveBtn_${leadId}`);
    
    try {
      // Get user ID directly from localStorage
      const userId = (() => {
        try {
          const id = localStorage.getItem('userId');
          if (id) return id;
          
          // Try to get from user object if userId not directly available
          const userData = localStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            return parsedUser.id || parsedUser._id || parsedUser.user_id;
          }
          return null;
        } catch (e) {

          return null;
        }
      })();
      
      if (!userId || !leadId) {
        alert('Missing required data for reassignment approval');
        return;
      }
      
      // Try our new API endpoint first, fall back to the old one if it fails
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/reassignment/approve/${leadId}?user_id=${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (error) {

        // Fallback to old endpoint
        response = await fetch(`${API_BASE_URL}/leads/${leadId}/approve-reassign?user_id=${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
      }

      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        alert('Lead reassignment approved successfully!');
        
        // Refresh the page after successful approval
        window.location.reload();
        
        // Update the local state to reflect the change
        setReassignmentRequests(prevRequests => 
          prevRequests.map(req => 
            (req.id === leadId || req._id === leadId)
              ? {...req, 
                 reassignment_status: 'approved',
                 status: 'approved',
                 action_date: getISTTimestamp(),
                 action_by: "Current User"} 
              : req
          )
        );
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {

      alert('Error approving reassignment: ' + (error.message || 'Please try again.'));
    } finally {
      // Reset loading state for this specific action
      setReassignmentActionLoading(prev => ({ ...prev, [`approve_${leadId}`]: false }));
    }
  };
  
  // Handle rejection of reassignment request
  const handleRejectRequest = async (leadId, reason = "Request denied by admin") => {
    // Set loading state for this specific action
    setReassignmentActionLoading(prev => ({ ...prev, [`reject_${leadId}`]: true }));
    animateButton(`rejectBtn_${leadId}`);
    
    try {
      // Get user ID directly from localStorage
      const userId = (() => {
        try {
          const id = localStorage.getItem('userId');
          if (id) return id;
          
          // Try to get from user object if userId not directly available
          const userData = localStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            return parsedUser.id || parsedUser._id || parsedUser.user_id;
          }
          return null;
        } catch (e) {

          return null;
        }
      })();
      
      if (!userId || !leadId) {
        alert('Missing required data for reassignment rejection');
        return;
      }
      
      // Try our new API endpoint first, fall back to the old one if it fails
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/reassignment/reject/${leadId}?user_id=${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rejection_reason: reason
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (error) {

        // Fallback to old endpoint
        response = await fetch(`${API_BASE_URL}/reassignment/reject/${leadId}?user_id=${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: reason
          })
        });
      }

      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        alert('Lead reassignment rejected successfully!');
        
        // Refresh the page after successful rejection
        window.location.reload();
        
        // Update the local state to reflect the change
        setReassignmentRequests(prevRequests => 
          prevRequests.map(req => 
            (req.id === leadId || req._id === leadId)
              ? {...req, 
                 reassignment_status: 'rejected',
                 status: 'rejected', 
                 action_date: getISTTimestamp(),
                 action_by: "Current User",
                 rejection_reason: reason} 
              : req
          )
        );
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {

      alert('Error rejecting reassignment: ' + (error.message || 'Please try again.'));
    } finally {
      // Reset loading state for this specific action
      setReassignmentActionLoading(prev => ({ ...prev, [`reject_${leadId}`]: false }));
    }
  };
  
  // Handle viewing lead details
  const handleViewDetails = (lead) => {

    setSelectedLead(lead);
    setShowDetailsModal(true);
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    try {
      // Handle different date formats
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {

        return '-';
      }
      
      // Format with time for better details
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      });
    } catch (error) {

      return '-';
    }
  };
  
  // Filter requests based on status and user permissions
  const filteredRequests = reassignmentRequests.filter(req => {
    // First filter by status if not "all"
    const statusMatch = filter === "all" || (req.reassignment_status || 'unknown') === filter;
    
    if (!statusMatch) return false;
    
    // If user doesn't have approve permissions, only show their own requests
    if (!canApproveReassignments) {
      const currentUserId = (() => {
        try {
          const id = localStorage.getItem('userId');
          if (id) return id;
          
          const userData = localStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            return parsedUser.id || parsedUser._id || parsedUser.user_id;
          }
          return null;
        } catch (e) {
          return null;
        }
      })();
      
      // Only show requests created by the current user
      return req.reassignment_requested_by === currentUserId || 
             req.requested_by === currentUserId ||
             req.created_by === currentUserId;
    }
    
    // If user has approve permissions, show all requests
    return true;
  });
  
  // Get status badge class
  const getStatusBadgeClass = (status) => {
    // Normalize status by converting to lowercase and handling undefined
    const normalizedStatus = (status || '').toLowerCase();
    
    switch(normalizedStatus) {
      case 'pending': 
      case 'waiting':
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800';
        
      case 'approved':
      case 'complete':
      case 'completed':
      case 'success':
      case 'done':
        return 'bg-green-100 text-green-800';
        
      case 'rejected':
      case 'denied':
      case 'cancelled':
      case 'canceled':
      case 'failed':
        return 'bg-red-100 text-red-800';
        
      case 'unknown':
        return 'bg-gray-100 text-gray-800';
        
      default: 
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="p-6 bg-gray-100 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800">
          {canApproveReassignments ? "ALL REASSIGNMENT REQUESTS" : "YOUR REASSIGNMENT REQUESTS"}
        </h3>
        
        {/* Permission Status Indicator */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          canApproveReassignments 
            ? 'bg-green-100 text-green-700 border border-green-300' 
            : 'bg-blue-100 text-blue-700 border border-blue-300'
        }`}>
          {canApproveReassignments 
            ? '✅ Can Approve/Reject All Requests' 
            : '👤 Viewing Your Own Requests Only'
          }
        </div>
        
        <div className="flex items-center">
          <span className="mr-2 text-gray-700">Filter:</span>
          <select 
            className="px-3 py-1 border rounded bg-white text-gray-700"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <button 
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={fetchReassignmentRequests}
          >
            <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        </div>
      </div>
         
      {loading ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-700">Loading reassignment requests...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-600 bg-white rounded-lg shadow p-4">
          <p>Error loading reassignment requests: {error}</p>
          <button 
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={fetchReassignmentRequests}
          >
            Try Again
          </button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-600 bg-white rounded-lg shadow p-4">
          <p>No reassignment requests found for the selected filter.</p>
          <p className="mt-2 text-sm text-gray-500">
            Please make a request for reassignment from the lead details screen if needed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-200 border-b border-gray-300">
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Lead Name</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Mobile</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Product Type</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Current Owner</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Requested By</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Request Date</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request._id || request.id} className="border-b hover:bg-gray-50 text-gray-700">
                  <td className="px-4 py-3">
                    {request.first_name && request.last_name ? 
                      `${request.first_name} ${request.last_name}` : 
                      request.name || (request.requestor ? request.requestor.name : '-')}
                  </td>
                  <td className="px-4 py-3">{request.mobile_number || request.phone || '-'}</td>
                  <td className="px-4 py-3">{request.loan_type_name || request.loan_type || '-'}</td>
                  <td className="px-4 py-3">
                    {/* Priority: Use created_by_name as the main field for current owner */}
                    {request.created_by_name || 
                     (request.current_assignee ? request.current_assignee.name : 
                      (Array.isArray(request.assigned_to) ? 'Multiple Assignees' : 
                       (request.assigned_to || '-')))}
                  </td>
                  <td className="px-4 py-3">
                    {request.requestor ? request.requestor.name : 
                     (request.requestor_name || request.requested_by || '-')}
                  </td>
                  <td className="px-4 py-3">{formatDate(request.reassignment_requested_at || request.request_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(request.status || request.reassignment_status || 'unknown')}`}>
                      {(request.status || request.reassignment_status || 'unknown').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs mr-2 hover:bg-blue-700 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95"
                      onClick={() => handleViewDetails(request)}
                    >
                      Details
                    </button>
                    
                    {(request.status === 'pending' || request.reassignment_status === 'pending' || 
                      request.pending_reassignment === true) && canApproveReassignments && (
                      <>
                        <button
                          className={`px-3 py-1 text-white rounded text-xs mr-2 shadow-sm transition-all duration-200 transform ${
                            reassignmentActionLoading[`approve_${request._id || request.id}`]
                              ? "bg-gray-400 cursor-not-allowed scale-95"
                              : "bg-green-600 hover:bg-green-700 hover:scale-105 active:scale-95"
                          } ${buttonAnimations[`approveBtn_${request._id || request.id}`] ? 'animate-pulse scale-95' : ''}`}
                          onClick={() => handleApproveRequest(request._id || request.id)}
                          disabled={reassignmentActionLoading[`approve_${request._id || request.id}`]}
                        >
                          {reassignmentActionLoading[`approve_${request._id || request.id}`] ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-1"></i>
                              Approving...
                            </>
                          ) : (
                            "Approve"
                          )}
                        </button>
                        <button
                          className={`px-3 py-1 text-white rounded text-xs shadow-sm transition-all duration-200 transform ${
                            reassignmentActionLoading[`reject_${request._id || request.id}`]
                              ? "bg-gray-400 cursor-not-allowed scale-95"
                              : "bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95"
                          } ${buttonAnimations[`rejectBtn_${request._id || request.id}`] ? 'animate-pulse scale-95' : ''}`}
                          onClick={() => {
                            if (!reassignmentActionLoading[`reject_${request._id || request.id}`]) {
                              const reason = prompt('Enter reason for rejection:', 'Request denied by admin');
                              if (reason !== null) {
                                handleRejectRequest(request._id || request.id, reason);
                              }
                            }
                          }}
                          disabled={reassignmentActionLoading[`reject_${request._id || request.id}`]}
                        >
                          {reassignmentActionLoading[`reject_${request._id || request.id}`] ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-1"></i>
                              Rejecting...
                            </>
                          ) : (
                            "Reject"
                          )}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Lead Details Modal */}
      {showDetailsModal && selectedLead && (
        <div className="fixed inset-0 flex items-center justify-center z-99999999 bg-transparent bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-gray-800">Lead Reassignment Details</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowDetailsModal(false)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 mb-4">
                <h4 className="text-md font-semibold mb-2 border-b pb-1 text-gray-800">Lead Information</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Name:</span> {
                      selectedLead.first_name && selectedLead.last_name ? 
                      `${selectedLead.first_name} ${selectedLead.last_name}` : 
                      selectedLead.name || 'Unknown'
                    }
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Mobile:</span> {selectedLead.phone || selectedLead.mobile || 'Not provided'}
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Product Type:</span> {selectedLead.loan_type || selectedLead.product_type || 'Unknown'}
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Status:</span> {selectedLead.status || selectedLead.reassignment_status || 'Unknown'}
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Lead Age:</span> {selectedLead.age_days ? `${selectedLead.age_days} days` : 'Unknown'}
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">File Sent To Login:</span> {selectedLead.file_sent_to_login === true ? 'Yes' : (selectedLead.file_sent_to_login === false ? 'No' : 'Unknown')}
                  </div>
                </div>
              </div>
              
              <div className="col-span-2 mb-4">
                <h4 className="text-md font-semibold mb-2 border-b pb-1 text-gray-800">Reassignment Information</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Current Owner:</span> {
                      // Use created_by_name as the primary field for current owner
                      selectedLead.created_by_name || 
                      (selectedLead.assigned_to ? (() => {
                        const user = assignableUsers?.find(u => u.id === selectedLead.assigned_to || u._id === selectedLead.assigned_to);
                        return user?.name || selectedLead.assigned_to;
                      })() : 'Unknown')
                    }
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Requested By:</span> {
                      selectedLead.requested_by_name || 
                      selectedLead.requested_by || 
                      (selectedLead.requestor ? selectedLead.requestor.name || 'Unknown' : 'Unknown')
                    }
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Request Date:</span> {formatDate(selectedLead.reassignment_requested_at || selectedLead.request_date)}
                  </div>
                  <div className="text-gray-800">
                    <span className="font-medium text-gray-600">Request Status:</span>
                    <span className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadgeClass(selectedLead.status || selectedLead.reassignment_status || 'unknown')}`}>
                      {(selectedLead.status || selectedLead.reassignment_status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  {selectedLead.reason && (
                    <div className="col-span-2 text-gray-800">
                      <span className="font-medium text-gray-600">Request Reason:</span> {selectedLead.reason}
                    </div>
                  )}
                  {selectedLead.action_date && (
                    <>
                      <div className="text-gray-800">
                        <span className="font-medium text-gray-600">Action Date:</span> {formatDate(selectedLead.action_date)}
                      </div>
                      <div className="text-gray-800">
                        <span className="font-medium text-gray-600">Action By:</span> {selectedLead.action_by || 'Unknown'}
                      </div>
                    </>
                  )}
                  {selectedLead.rejection_reason && (
                    <div className="col-span-2 text-gray-800">
                      <span className="font-medium text-gray-600">Rejection Reason:</span> {selectedLead.rejection_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t">
              {(selectedLead.reassignment_status === 'pending' || 
                selectedLead.status === 'pending' || 
                selectedLead.pending_reassignment === true) && canApproveReassignments && (
                <>
                  <button
                    className={`px-4 py-2 text-white rounded mr-2 transition-all duration-200 transform ${
                      reassignmentActionLoading[`approve_${selectedLead._id || selectedLead.id}`]
                        ? "bg-gray-400 cursor-not-allowed scale-95"
                        : "bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95"
                    } ${buttonAnimations[`approveBtn_${selectedLead._id || selectedLead.id}`] ? 'animate-pulse scale-95' : ''}`}
                    onClick={() => {
                      if (!reassignmentActionLoading[`approve_${selectedLead._id || selectedLead.id}`]) {
                        handleApproveRequest(selectedLead._id || selectedLead.id);
                        setShowDetailsModal(false);
                      }
                    }}
                    disabled={reassignmentActionLoading[`approve_${selectedLead._id || selectedLead.id}`]}
                  >
                    {reassignmentActionLoading[`approve_${selectedLead._id || selectedLead.id}`] ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Approving...
                      </>
                    ) : (
                      "Approve Reassignment"
                    )}
                  </button>
                  <button
                    className={`px-4 py-2 text-white rounded transition-all duration-200 transform ${
                      reassignmentActionLoading[`reject_${selectedLead._id || selectedLead.id}`]
                        ? "bg-gray-400 cursor-not-allowed scale-95"
                        : "bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95"
                    } ${buttonAnimations[`rejectBtn_${selectedLead._id || selectedLead.id}`] ? 'animate-pulse scale-95' : ''}`}
                    onClick={() => {
                      if (!reassignmentActionLoading[`reject_${selectedLead._id || selectedLead.id}`]) {
                        const reason = prompt('Enter reason for rejection:', 'Request denied by admin');
                        if (reason !== null) {
                          handleRejectRequest(selectedLead._id || selectedLead.id, reason);
                          setShowDetailsModal(false);
                        }
                      }
                    }}
                    disabled={reassignmentActionLoading[`reject_${selectedLead._id || selectedLead.id}`]}
                  >
                    {reassignmentActionLoading[`reject_${selectedLead._id || selectedLead.id}`] ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Rejecting...
                      </>
                    ) : (
                      "Reject Reassignment"
                    )}
                  </button>
                </>
              )}
              <button
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded ml-2 hover:bg-gray-400 transition-all duration-200 transform hover:scale-105 active:scale-95"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main CreateLead Component
function CreateLead() {
  // State for tab management
  const [activeTab, setActiveTab] = useState("all");
  const [leadSection, setLeadSection] = useState("leadinfo");

  const [pincodeError, setPincodeError] = useState('');
  const lastChanged = useRef(null);

  // Enhanced permission check for reassignment approve/reject buttons
  const userPermissions = localStorage.getItem('userPermissions');
  const directPermissionCheck = userPermissions && (
    userPermissions.includes('page * and action *') ||
    userPermissions.includes('page leads and action assign')
  );
  
  const canApproveReassignments = directPermissionCheck || 
                                 checkUserIsSuperAdmin() || 
                                 checkUserHasAssignPermissionGlobal() || 
                                 checkReassignmentPermissions(userPermissions);

  // Use the lead logic hook
  const {
    // Basic info
    currentDateTime, productType, setProductType,
    mobileNumber, setMobileNumber, mobileValidationError, setMobileValidationError, handleMobileNumberChange, showLeadForm,
    campaignName, setCampaignName, dataCode, setDataCode,
    companyCategory, setCompanyCategory, assignedTo, setAssignedTo,
    handleRemoveAssignee, handleAddAssignee,
    showAssignPopup, setShowAssignPopup,
    status, setStatus, customerName, setCustomerName,
    alternateNumber, setAlternateNumber, handleAlternateNumberChange,
    companyName, setCompanyName, companyType, setCompanyType,
    salary, setSalary, partnerSalary, setPartnerSalary, yearlyBonus, setYearlyBonus,
    bonusDivision, setBonusDivision, loanRequired, setLoanRequired,
    foirPercent, setFoirPercent, customFoirPercent, setCustomFoirPercent, eligibility, leadFormRef, handleCheckMobile,
    // API data
    loanTypes, campaignNames, dataCodes, companyCategories, assignableUsers,
    loadingLoanTypes, loadingSettings,
    // Mobile check results
    mobileCheckResult, showReassignmentOption, showLeadDetails, existingLeadData,
    allDuplicateLeads, setAllDuplicateLeads,
    setShowReassignmentOption, setShowLeadDetails, setExistingLeadData,
    handleReassignmentRequest, handleReassignmentCancel, handleCompanyCategoryChange,
    // Obligations
    obligations, handleObligationChange, handleAddObligation, handleDeleteObligation,
    // Bank dropdown/filter
    bankList, bankDropdowns, setBankDropdowns, bankFilters, handleBankDropdown,
    handleBankFilterChange, handleBankSelect,
    // Product dropdown
    productTypes, productDropdowns, setProductDropdowns, handleProductDropdown, handleProductSelect,
    // Customer Obligation summary
    totalBtPos, totalObligation, cibilScore, setCibilScore, actionTypes,
    // Company search
    companySearch, companySuggestions, showCompanySuggestions, isCompanyLoading,
    handleCompanyInputChange, handleCompanySearchClick, handleCompanySuggestionClick,
    setShowCompanySuggestions, setCompanySuggestions,
    companyTypes, statusOptions, bonusDivisions, foirPercents,
    // Check Eligibility Section
    ceCompanyCategory, handleCeCompanyCategoryChange,
    ceFoirPercent, handleCeFoirPercentChange, ceCustomFoirPercent, setCeCustomFoirPercent,
    ceTenureMonths, handleCeTenureMonthsChange,
    ceTenureYears, handleCeTenureYearsChange,
    ceRoi, handleCeRoiChange,
    ceMonthlyEmiCanPay, handleCeMonthlyEmiCanPayChange,
    ceMultiplier, handleCeMultiplierChange,
    loanEligibilityStatus,
    checkEligibilityCompanyCategories, formatINR, parseINR,
    // Obligation tracking
    obligationHasUnsavedChanges, obligationIsSaving, obligationDataSaved, handleObligationDataUpdate,
    // Enhanced obligation handlers  
    handleSalaryChange, handlePartnerSalaryChange, handleYearlyBonusChange,
    handleBonusDivisionChange, handleFoirPercentChange,
    handleSaveObligationData, handleClearObligationChanges,
    isPersonalSectionComplete, hasAnyObligationData, isCreateLeadEnabled,
    // Reassignment form
    showReassignmentModal, setShowReassignmentModal, reassignmentReason, setReassignmentReason,
    newDataCode, setNewDataCode, newCampaignName, setNewCampaignName,
    changeDataCode, setChangeDataCode, changeCampaignName, setChangeCampaignName,
    // Lead creation
    createLead, handleSubmit,
    // Form validation
    formValidationErrors, setFormValidationErrors, showValidationErrors, setShowValidationErrors,
    // Button states and animations
    checkMobileLoading, createLeadLoading, reassignmentActionLoading, setReassignmentActionLoading,
    buttonAnimations, animateButton,
    // Background loading states
    backgroundDataLoaded, bankListLoaded, companyDataLoaded, assignableUsersLoaded,
    // Permission state
    hasAddLeadPermission,
    hasReassignmentPopupPermission
  } = useCreateLeadLogic();

  // Local UI state: controls visibility of inline reassignment form
  const [showReassignForm, setShowReassignForm] = useState(false);
  // Reset form whenever a new duplicate lead is loaded
  useEffect(() => { setShowReassignForm(false); }, [existingLeadData?.id]);

  // Read-only lead view overlay state
  const [viewLeadId, setViewLeadId] = useState(null);
  const [viewLeadData, setViewLeadData] = useState(null);
  const [viewLeadLoading, setViewLeadLoading] = useState(false);
  const [viewLeadFromLogin, setViewLeadFromLogin] = useState(false);
  const [viewLeadIsReassignment, setViewLeadIsReassignment] = useState(false);

  // Duplicate tab state
  const [dupActiveTab, setDupActiveTab] = useState('leads');
  const [loginDuplicateLeads, setLoginDuplicateLeads] = useState([]);
  const [loginLeadsLoading, setLoginLeadsLoading] = useState(false);

  // Fetch login leads when a duplicate is detected
  useEffect(() => {
    if (existingLeadData) {
      const phone = existingLeadData.phone || existingLeadData.mobile_number || mobileNumber;
      if (phone) {
        setLoginLeadsLoading(true);
        setDupActiveTab('leads');
        const userId = localStorage.getItem('userId') || '';
        fetch(`/api/lead-login/check-phone/${encodeURIComponent(phone)}?user_id=${userId}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => setLoginDuplicateLeads(data?.leads || []))
          .catch(() => setLoginDuplicateLeads([]))
          .finally(() => setLoginLeadsLoading(false));
      }
    } else {
      setLoginDuplicateLeads([]);
      setDupActiveTab('leads');
    }
  }, [existingLeadData]);

  const handleViewDuplicateLead = async (leadId, fromLogin = false, fromReassignment = false) => {
    if (!leadId) return;
    setViewLeadId(leadId);
    setViewLeadLoading(true);
    setViewLeadData(null);
    setViewLeadFromLogin(fromLogin);
    setViewLeadIsReassignment(fromReassignment);
    try {
      const userId = localStorage.getItem('userId') || '';
      const url = fromLogin
        ? `/api/lead-login/login-leads/${leadId}?user_id=${userId}`
        : `/api/leads/${leadId}?user_id=${userId}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        // For login leads viewed in the duplicate-check overlay, force all tabs visible
        if (fromLogin) {
          data.can_view_all_tabs = true;
          data.can_edit = false; // read-only, but all tabs accessible
          data.can_view = true;
        }
        setViewLeadData(data);
      }
    } catch (e) {
      console.error('Error fetching lead for view:', e);
    } finally {
      setViewLeadLoading(false);
    }
  };

  // Handle section change
  const handleSectionChange = (section) => {
    setLeadSection(section);
  };

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <div className="flex-1 p-6 mx-auto main-content max-w-8xl min-h-screen">
        {/* Tab Selector - Fixed positioning to prevent shifts */}
        <div className="flex items-center mb-8 space-x-2 sticky top-0 z-10 bg-black py-4 border-b border-gray-200">
          <button
            className={`px-6 py-2 rounded-t-md font-extrabold text-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${activeTab === "all"
              ? "bg-sky-400 text-white"
              : "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
              }`}
            onClick={() => {
              animateButton('allTabBtn');
              setActiveTab("all");
            }}
          >
            All
          </button>
          <button
            className={`px-6 py-2 rounded-t-md font-extrabold text-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${activeTab === "reassignment"
              ? "bg-sky-400 text-white"
              : "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
              }`}
            onClick={() => {
              animateButton('reassignmentTabBtn');
              setActiveTab("reassignment");
            }}
          >
            Reassignment
          </button>
        </div>
        {activeTab === "all" && (
          <div className="space-y-6">
            {/* Product selector - Single row layout with fixed positioning */}
            <div className="p-6 bg-white rounded-lg shadow-md card">
              <div className="mb-6 text-xl font-bold card-title text-[#03B0F5]">Select Product Type</div>
              <div className="form-section">
                <div className="form-group">
                  {/* Single row with equal heights and consistent spacing */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                    {/* Product Type - 4 columns */}
                    <div className="lg:col-span-4">
                      <label className="block mb-2 text-md font-bold text-black form-label required-field">
                        Product Type<span className="ml-1 text-red-400">*</span>
                      </label>
                      <div className="h-[42px]">
                        <SearchableSelect
                          options={loanTypes && loanTypes.length > 0 ? loanTypes.map(loanType => ({
                            value: loanType.name,
                            label: loanType.name
                          })) : []}
                          value={productType}
                          onChange={(value) => {
                            setProductType(value);
                            // Clear validation error when user selects
                            if (value && showValidationErrors) {
                              setFormValidationErrors(prev => ({ ...prev, productType: false }));
                            }
                          }}
                          placeholder={loadingLoanTypes ? "Loading..." : "Select Product"}
                          searchPlaceholder="Search products..."
                          disabled={loadingLoanTypes || showLeadForm}
                          emptyMessage={!loadingLoanTypes ? "No loan types available" : "Loading..."}
                          className={`form-select h-full ${showValidationErrors && formValidationErrors.productType ? 'border-red-500' : ''}`}
                        />
                        {showValidationErrors && formValidationErrors.productType && (
                          <p className="text-red-500 text-sm mt-1">Product Type is required</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Mobile Number - 5 columns */}
                    <div className="lg:col-span-5">
                      <label className="block mb-2 text-md font-bold text-black form-label required-field">
                        Mobile Number<span className="ml-1 text-red-400">*</span>
                      </label>
                      <div className="h-[42px]">
                        <input
                          type="text"
                          className={`w-full h-full px-3 py-2 text-white border rounded-lg form-control border-neutral-800 bg-neutral-800 focus:outline-none ${
                            mobileValidationError || (showValidationErrors && formValidationErrors.mobileNumber) 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:border-sky-400'
                          } ${showLeadForm ? 'opacity-60 cursor-not-allowed' : ''}`}
                          placeholder="Enter Mobile Number"
                          value={mobileNumber}
                          onChange={handleMobileNumberChange}
                          disabled={showLeadForm}
                          readOnly={showLeadForm}
                        />
                      </div>
                      {showValidationErrors && formValidationErrors.mobileNumber && (
                        <p className="text-red-500 text-sm mt-1">Mobile Number is required</p>
                      )}
                    </div>
                    
                    {/* Check Button - 3 columns */}
                    <div className="lg:col-span-3">
                      <label className="block mb-2 text-md font-bold text-transparent">Action</label>
                      <div className="h-[42px]">
                        <button
                          type="button"
                          className={`w-full h-full px-4 py-2 font-bold text-white rounded-lg btn transition-all duration-300 transform ${
                            showLeadForm 
                              ? "bg-green-500 hover:bg-green-600 cursor-default" 
                              : checkMobileLoading
                              ? "bg-gray-400 cursor-not-allowed scale-95"
                              : "bg-sky-400 hover:bg-sky-500 hover:scale-105 active:scale-95"
                          } ${buttonAnimations.checkMobileBtn ? 'animate-pulse scale-95' : ''}`}
                          id="checkMobile"
                          onClick={showLeadForm ? undefined : handleCheckMobile}
                          disabled={showLeadForm || checkMobileLoading}
                        >
                          {showLeadForm ? (
                            <>
                              <i className="fas fa-check mr-2"></i>
                              Loaded
                            </>
                          ) : checkMobileLoading ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-2"></i>
                              Checking...
                            </>
                          ) : (
                            "Check & Load"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Error message row - Fixed height to prevent layout shifts */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2">
                    <div className="lg:col-span-4"></div>
                    <div className="lg:col-span-5">
                      <div className="h-[32px] flex items-start">
                        {mobileValidationError && (
                          <div className="text-xl font-bold text-red-600">
                            {mobileValidationError}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="lg:col-span-3"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Check Results - Fixed height container to prevent layout shifts */}
            <div className="min-h-[100px]">
              {/* ─── MULTI-LEAD DUPLICATE DISPLAY ─── */}
              {existingLeadData && (() => {
                const leads = allDuplicateLeads.length > 0 ? allDuplicateLeads : [existingLeadData];
                const bankLoginLeads = leads.filter(l => l.file_sent_to_login);
                const hasBankLogins = bankLoginLeads.length > 0;
                const latestBankLead = hasBankLogins
                  ? [...bankLoginLeads].sort((a, b) => new Date(b.login_department_sent_date || 0) - new Date(a.login_department_sent_date || 0))[0]
                  : null;
                const latestBank = latestBankLead?.bank_name || '—';
                const latestBankDate = latestBankLead?.login_department_sent_date;
                const actualDR = existingLeadData?.days_remaining || 0;
                const isLocked = actualDR > 0;
                const mgr = existingLeadData?.is_manager_permission_required;
                const canRequest = hasReassignmentPopupPermission && !isLocked;
                const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
                const fmtAge = (d) => { if (!d) return '—'; const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return days === 0 ? 'Today' : `${days}d ago`; };
                const refD = existingLeadData?.file_sent_to_login && existingLeadData?.login_department_sent_date ? new Date(existingLeadData.login_department_sent_date) : new Date(existingLeadData?.created_date || Date.now());
                const unlockD = new Date(refD); unlockD.setDate(unlockD.getDate() + (existingLeadData?.reassignment_period || 0));
                const colCount = hasBankLogins ? 7 : 6;
                return (
                  <div className="mb-6 bg-[#0d1117] rounded-xl border border-neutral-700 overflow-hidden">
                    {/* Header strip */}
                    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 bg-neutral-800 border-b border-neutral-700">
                      <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      <span className="text-yellow-400 font-bold text-xs uppercase tracking-wider">Duplicate Lead Found</span>
                      <span className="text-neutral-400 text-xs ml-1">
                        {hasBankLogins
                          ? `${bankLoginLeads.length} bank login${bankLoginLeads.length > 1 ? 's' : ''} — Latest: ${latestBank} (${fmtDate(latestBankDate)})`
                          : `No bank login — locking from lead creation date`}
                      </span>
                      <button className="ml-auto w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700 transition" onClick={handleReassignmentCancel}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </button>
                    </div>

                    {/* ─── TAB BAR ─── */}
                    <div className="flex border-b border-neutral-700 bg-[#0d1117]">
                      <button
                        onClick={() => setDupActiveTab('leads')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold transition-colors border-b-2 ${dupActiveTab === 'leads' ? 'text-cyan-400 border-cyan-400 bg-neutral-800/50' : 'text-neutral-400 border-transparent hover:text-neutral-200'}`}
                      >
                        📋 Leads <span className="bg-neutral-700 text-neutral-300 rounded-full px-2 py-0.5 text-[10px]">{leads.length}</span>
                      </button>
                      <button
                        onClick={() => setDupActiveTab('login')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold transition-colors border-b-2 ${dupActiveTab === 'login' ? 'text-cyan-400 border-cyan-400 bg-neutral-800/50' : 'text-neutral-400 border-transparent hover:text-neutral-200'}`}
                      >
                        🏦 Login in Leads{' '}
                        {loginLeadsLoading
                          ? <span className="text-neutral-500 text-[10px]">...</span>
                          : <span className={`bg-neutral-700 rounded-full px-2 py-0.5 text-[10px] ${loginDuplicateLeads.length > 0 ? 'text-cyan-300' : 'text-neutral-400'}`}>{loginDuplicateLeads.length}</span>}
                      </button>
                    </div>

                    {/* ─── LEADS TAB ─── */}
                    {dupActiveTab === 'leads' ? (<div>
                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#060d1a] border-b border-neutral-700">
                            <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">{hasBankLogins ? 'Login Date & Age' : 'Lead Date & Age'}</th>
                            <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Created By</th>
                            <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Team Name</th>
                            <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Customer Name</th>
                            <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">{hasBankLogins ? 'Login Status' : 'Lead Status'}</th>
                            {hasBankLogins && <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Bank Name</th>}
                            <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Availability</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, idx) => {
                            const isLatestRow = idx === 0 && leads.length > 1;
                            const displayDate = hasBankLogins ? (lead.login_department_sent_date || lead.created_at) : lead.created_at;
                            return (
                              <tr
                                key={lead.id || idx}
                                className="bg-neutral-900 hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-neutral-800/50"
                                onClick={() => handleViewDuplicateLead(lead.id)}
                                title="Click to view full lead details"
                              >
                                {/* Date & Age */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-white font-semibold text-sm">{fmtDate(displayDate)}</div>
                                  <div className="text-cyan-400 text-xs mt-0.5">{fmtAge(displayDate)}</div>
                                  {isLatestRow && (
                                    <div className="inline-flex items-center gap-1 mt-1 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/30 whitespace-nowrap">
                                      ★ LATEST — GOVERNS LOCK
                                    </div>
                                  )}
                                </td>
                                {/* Created By */}
                                <td className="px-4 py-3 whitespace-nowrap text-white font-semibold text-sm">{lead.created_by_name || lead.assigned_to_name || '—'}</td>
                                {/* Team */}
                                <td className="px-4 py-3 whitespace-nowrap text-white font-semibold text-xs uppercase">{lead.department_name || '—'}</td>
                                {/* Customer */}
                                <td className="px-4 py-3 whitespace-nowrap text-white font-semibold text-sm">{lead.name || '—'}</td>
                                {/* Status */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {lead.sub_status ? (
                                    <div>
                                      <div className="text-white font-semibold text-sm">{lead.sub_status}</div>
                                      <div className="text-neutral-400 text-xs mt-0.5">{lead.status}</div>
                                    </div>
                                  ) : <span className="text-white text-sm">{lead.status || '—'}</span>}
                                </td>
                                {/* Bank (bank-login scenario only) */}
                                {hasBankLogins && (
                                  <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                    {lead.bank_name
                                      ? <span className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg px-2.5 py-1 text-xs font-bold">🏦 {lead.bank_name}</span>
                                      : <span className="text-neutral-500 text-xs">—</span>}
                                  </td>
                                )}
                                {/* Availability */}
                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  {idx === 0 ? (
                                    isLocked ? (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold animate-pulse">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                        Locked — {actualDR}d
                                      </span>
                                    ) : !hasReassignmentPopupPermission ? (
                                      <span className="text-neutral-500 text-xs italic">No permission</span>
                                    ) : mgr ? (
                                      <button onClick={() => setShowReassignForm(f => !f)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold hover:bg-yellow-500/30 transition">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        Available — Manager Required {showReassignForm ? '▲' : '▼'}
                                      </button>
                                    ) : (
                                      <button onClick={() => setShowReassignForm(f => !f)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold hover:bg-green-500/30 transition">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a5 5 0 00-5 5h2a3 3 0 016 0h2a5 5 0 00-5-5zm-7 9a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" clipRule="evenodd" /></svg>
                                        Available {showReassignForm ? '▲' : '▼'}
                                      </button>
                                    )
                                  ) : isLocked ? (
                                    <span className="text-red-400/70 text-xs font-medium">
                                      Locked — {actualDR}d
                                      {hasBankLogins && latestBank !== '—' && <span className="text-neutral-500 text-[10px] block">From {latestBank}</span>}
                                    </span>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Footer info row */}
                          <tr className={isLocked ? 'bg-red-950/20' : 'bg-neutral-800/20'}>
                            <td colSpan={colCount} className="px-5 py-2.5">
                              {isLocked ? (
                                hasBankLogins ? (
                                  <span className="text-red-300 text-xs">
                                    <span className="text-red-200 font-bold">{bankLoginLeads.length} login{bankLoginLeads.length > 1 ? 's' : ''}</span> mein se latest: <span className="font-bold text-red-100">{latestBank} ({fmtDate(latestBankDate)})</span> + <span className="font-bold text-red-100">{existingLeadData?.reassignment_period || 0}d</span> = Unlocks <span className="font-bold text-red-100">{fmtDate(unlockD)}</span>. Other bank logins expire hone se unlock NAHI hoga — sirf latest ka expire matter karta hai.
                                  </span>
                                ) : (
                                  <span className="text-red-300 text-xs">
                                    No login found. Lock starts from <span className="font-bold text-red-100">lead creation: {fmtDate(existingLeadData?.created_date)}</span>. Unlocks <span className="font-bold text-red-100">{fmtDate(unlockD)}</span> <span className="text-red-400">({actualDR} days remaining)</span>.
                                  </span>
                                )
                              ) : (
                                <span className="text-green-400 text-xs font-medium">✓ This lead is available for reassignment.</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Inline reassignment form */}
                    {showReassignForm && canRequest && (
                      <div className="border-t border-neutral-700 p-5 space-y-4 bg-neutral-900/50">
                        {mgr && (
                          <div className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3">
                            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            <div>
                              <p className="text-yellow-300 font-semibold text-sm">Manager Approval Required</p>
                              <p className="text-yellow-200/60 text-xs">Your request will be sent for manager review before reassignment</p>
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="block text-neutral-300 text-sm font-semibold mb-1.5">Reason for Reassignment <span className="text-red-400">*</span></label>
                          <textarea value={reassignmentReason} onChange={(e) => setReassignmentReason(e.target.value)} placeholder="Enter your reason for requesting this lead..." className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-cyan-400 resize-none" rows={3} />
                        </div>
                        <div className="flex gap-3 justify-end">
                          <button className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm" onClick={() => handleReassignmentRequest(existingLeadData)} disabled={!reassignmentReason?.trim()}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            {mgr ? 'Request Manager Approval' : 'Request Reassignment'}
                          </button>
                          <button className="flex items-center gap-2 px-5 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 font-bold rounded-lg transition-all text-sm" onClick={handleReassignmentCancel}>Cancel</button>
                        </div>
                      </div>
                    )}
                    </div>) : (
                    /* ─── LOGIN TAB ─── */
                    <div>
                      {loginLeadsLoading ? (
                        <div className="flex items-center justify-center py-8 gap-3">
                          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-neutral-400 text-sm">Checking login leads...</span>
                        </div>
                      ) : loginDuplicateLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <span className="text-neutral-500 text-sm">No login leads found for this number.</span>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-[#060d1a] border-b border-neutral-700">
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Login Date</th>
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Created By</th>
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Team Name</th>
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Customer Name</th>
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Bank Name</th>
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Status</th>
                                <th className="text-cyan-400 font-bold px-4 py-2.5 text-left text-xs tracking-wider uppercase whitespace-nowrap">Loan Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loginDuplicateLeads.map((loginLead, idx) => (
                                <tr
                                  key={loginLead.id || idx}
                                  className="bg-neutral-900 hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-neutral-800/50"
                                  onClick={() => handleViewDuplicateLead(loginLead.id, true)}
                                  title="Click to view login lead details (read-only)"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-white font-semibold text-sm">{fmtDate(loginLead.login_date || loginLead.login_created_at || loginLead.created_at)}</div>
                                    <div className="text-cyan-400 text-xs mt-0.5">{fmtAge(loginLead.login_date || loginLead.login_created_at || loginLead.created_at)}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-white font-semibold text-sm">{loginLead.created_by_name || '—'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-white text-xs uppercase tracking-wider">{loginLead.department_name || '—'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-white font-semibold text-sm">{loginLead.name || '—'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {loginLead.bank_name
                                      ? <span className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg px-2.5 py-1 text-xs font-bold">🏦 {loginLead.bank_name}</span>
                                      : <span className="text-neutral-500 text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {loginLead.sub_status ? (
                                      <div>
                                        <div className="text-white font-semibold text-sm">{loginLead.sub_status}</div>
                                        <div className="text-neutral-400 text-xs mt-0.5">{loginLead.status}</div>
                                      </div>
                                    ) : <span className="text-white text-sm">{loginLead.status || '—'}</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-neutral-300 text-sm">{loginLead.loan_type || '—'}</td>
                                </tr>
                              ))}
                              <tr className="bg-indigo-950/20">
                                <td colSpan={7} className="px-5 py-2.5">
                                  <span className="text-indigo-300 text-xs">🔒 Login leads are view-only. Click any row to view details.</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    )}{/* end tab ternary */}
                  </div>
                );
              })()}
            </div>

            {/* ─── LEAD VIEW PORTAL (mounted at document.body to avoid DOM inheritance issues) ─── */}
            {viewLeadId && ReactDOM.createPortal(
              <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.75)' }} onClick={() => { setViewLeadId(null); setViewLeadData(null); }}>
                <div style={{ width: '100%', maxWidth: 1100, height: '100%', background: '#0d1117', boxShadow: '0 0 40px rgba(0,0,0,0.8)', borderLeft: '1px solid #374151', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                  {/* Top bar */}
                  <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: '#1f2937', borderBottom: '1px solid #374151', flexShrink: 0 }}>
                    <svg style={{ width: 16, height: 16, color: '#60a5fa', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{viewLeadFromLogin ? 'Login Lead Details — View Only' : 'Lead Details — View Only'}</span>
                    <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: '#374151', border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setViewLeadId(null); setViewLeadData(null); }}>
                      ✕ Close
                    </button>
                  </div>
                  {/* Content — flex:1 + overflow:auto for normal tabs; obligations tab uses its own internal scroll */}
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {viewLeadLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0', gap: 12 }}>
                        <div style={{ width: 32, height: 32, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <span style={{ color: '#9ca3af', fontSize: 14 }}>Loading lead details...</span>
                      </div>
                    )}
                    {!viewLeadLoading && viewLeadData && (
                      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0' }}><div style={{ width: 32, height: 32, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div></div>}>
                        <LeadDetails
                          lead={viewLeadData}
                          user={JSON.parse(localStorage.getItem('userData') || '{}') || { id: localStorage.getItem('userId'), name: localStorage.getItem('userName') || 'User' }}
                          onBack={() => { setViewLeadId(null); setViewLeadData(null); }}
                          onLeadUpdate={(updated) => setViewLeadData(prev => ({ ...prev, ...updated }))}
                          readOnly={true}
                          obligationsReadOnly={viewLeadFromLogin}
                          allowedTabs={viewLeadIsReassignment ? ['details', 'obligations'] : null}
                        />
                      </Suspense>
                    )}
                    {!viewLeadLoading && !viewLeadData && (
                      <div style={{ textAlign: 'center', padding: '96px 0', color: '#6b7280' }}>Failed to load lead details.</div>
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )}

            {showLeadDetails && existingLeadData && !showReassignmentOption && (
              <div className="p-6 mb-6 bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                      existingLeadData.reassignment_status === 'requested' ? 'bg-yellow-500/20' :
                      existingLeadData.days_remaining > 0 ? 'bg-red-500/20' : 'bg-neutral-700'
                    }`}>
                      <svg className={`w-6 h-6 ${
                        existingLeadData.reassignment_status === 'requested' ? 'text-yellow-400' :
                        existingLeadData.days_remaining > 0 ? 'text-red-400' : 'text-neutral-400'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {existingLeadData.reassignment_status === 'requested' ? 'Reassignment Already Requested' : 'Lead Already Exists'}
                      </h2>
                      <p className="text-sm text-neutral-400">
                        {existingLeadData.reassignment_status === 'requested' ? 
                          'Reassignment request submitted. Awaiting manager approval.' : 
                          existingLeadData.days_remaining > 0 ?
                          `This lead is locked. Available for reassignment in ${existingLeadData.days_remaining} days.` :
                          'A lead with this mobile number already exists.'}
                      </p>
                    </div>
                  </div>
                  {/* LOCKED / REQUESTED Badge */}
                  <div className="flex items-center gap-3">
                    {existingLeadData.days_remaining > 0 && (
                      <span className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase tracking-wider animate-pulse">
                        LOCKED — {existingLeadData.days_remaining}d
                      </span>
                    )}
                    {existingLeadData.reassignment_status === 'requested' && (
                      <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">
                        PENDING APPROVAL
                      </span>
                    )}
                    <button
                      className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                      onClick={() => { setShowLeadDetails(false); setExistingLeadData(null); setMobileNumber(''); }}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Customer & Lead Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                    <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Customer</span>
                    <p className="text-sm font-semibold text-white mt-0.5 truncate">{existingLeadData?.name || existingLeadData?.customer_name || 'Unknown'}</p>
                  </div>
                  <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                    <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Mobile</span>
                    <p className="text-sm font-semibold text-white mt-0.5">{existingLeadData?.mobile_number || existingLeadData?.phone || mobileNumber || 'Unknown'}</p>
                  </div>
                  <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                    <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Current Owner</span>
                    <p className="text-sm font-semibold text-white mt-0.5 truncate">
                      {(() => {
                        if (existingLeadData?.created_by_name) return existingLeadData.created_by_name;
                        if (existingLeadData?.created_by) {
                          const user = assignableUsers?.find(u => u.id === String(existingLeadData.created_by) || u._id === String(existingLeadData.created_by));
                          if (user?.name) return user.name;
                        }
                        if (existingLeadData?.assigned_to_name) return existingLeadData.assigned_to_name;
                        if (existingLeadData?.assigned_to_user?.name) return existingLeadData.assigned_to_user.name;
                        if (existingLeadData?.assigned_to) {
                          const assignedTo = Array.isArray(existingLeadData.assigned_to) ? existingLeadData.assigned_to[0] : existingLeadData.assigned_to;
                          const user = assignableUsers?.find(u => u.id === String(assignedTo) || u._id === String(assignedTo));
                          if (user?.name) return user.name;
                        }
                        return 'Unassigned';
                      })()}
                    </p>
                  </div>
                  <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                    <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Product</span>
                    <p className="text-sm font-semibold text-white mt-0.5 truncate">{existingLeadData?.product_type || existingLeadData?.loan_type || 'N/A'}</p>
                  </div>
                </div>

                {/* Status Row */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 bg-neutral-700 text-neutral-200 text-xs rounded-md font-medium">
                    {existingLeadData?.status || 'Unknown'}
                  </span>
                  {existingLeadData?.sub_status && (
                    <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-md font-medium">
                      {existingLeadData.sub_status}
                    </span>
                  )}
                  {existingLeadData?.file_sent_to_login && (
                    <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-xs rounded-md font-medium">
                      Sent to Login
                    </span>
                  )}
                  <span className="text-xs text-neutral-500 ml-auto">
                    {existingLeadData?.file_sent_to_login ? 'Login' : 'Created'}: {(() => {
                      const dateToShow = existingLeadData?.file_sent_to_login && existingLeadData?.login_department_sent_date
                        ? existingLeadData.login_department_sent_date
                        : existingLeadData?.created_date;
                      return dateToShow ? new Date(dateToShow).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
                    })()}
                  </span>
                </div>

                {/* Reassignment Info Panel */}
                {(existingLeadData.can_reassign !== undefined || existingLeadData.reassignment_status) && (
                  <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4 mb-4">
                    <h4 className="text-sm font-bold text-neutral-300 mb-3">Reassignment Information</h4>

                    {existingLeadData.can_reassign !== undefined && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-neutral-400">Eligibility:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          existingLeadData.can_reassign ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {existingLeadData.can_reassign ? 'Eligible' : 'Not Eligible'}
                        </span>
                        {existingLeadData.reassignment_reason && (
                          <span className="text-xs text-neutral-500 italic">— {existingLeadData.reassignment_reason}</span>
                        )}
                      </div>
                    )}

                    {existingLeadData.reassignment_period > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="bg-neutral-900 rounded-lg p-2.5 border border-neutral-700">
                          <span className="text-[11px] text-neutral-500">Waiting Period</span>
                          <p className="text-sm font-bold text-white">{existingLeadData.reassignment_period} days</p>
                        </div>
                        <div className="bg-neutral-900 rounded-lg p-2.5 border border-neutral-700">
                          <span className="text-[11px] text-neutral-500">Days Elapsed</span>
                          <p className="text-sm font-bold text-white">
                            {(() => {
                              if (existingLeadData?.file_sent_to_login && existingLeadData?.login_department_sent_date) {
                                return Math.floor((new Date() - new Date(existingLeadData.login_department_sent_date)) / 86400000);
                              }
                              return existingLeadData?.created_date ? Math.floor((new Date() - new Date(existingLeadData.created_date)) / 86400000) : 0;
                            })()}
                          </p>
                        </div>
                        {existingLeadData.days_remaining > 0 && (
                          <div className="bg-red-500/10 rounded-lg p-2.5 border border-red-500/20">
                            <span className="text-[11px] text-red-400">Days Remaining</span>
                            <p className="text-sm font-bold text-red-400">{existingLeadData.days_remaining}</p>
                          </div>
                        )}
                        {existingLeadData.days_remaining > 0 && (
                          <div className="bg-neutral-900 rounded-lg p-2.5 border border-neutral-700">
                            <span className="text-[11px] text-neutral-500">Available On</span>
                            <p className="text-xs font-bold text-white">
                              {(() => {
                                let d = new Date();
                                if (existingLeadData?.file_sent_to_login && existingLeadData?.login_department_sent_date) {
                                  d = new Date(existingLeadData.login_department_sent_date);
                                  d.setDate(d.getDate() + existingLeadData.reassignment_period);
                                } else {
                                  d.setDate(d.getDate() + existingLeadData.days_remaining);
                                }
                                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
                              })()}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {existingLeadData.is_manager_permission_required && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
                        <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-yellow-400 font-medium">Manager Permission Required for Reassignment</span>
                      </div>
                    )}

                    {existingLeadData.reassignment_status && existingLeadData.reassignment_status !== 'none' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">Current Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          existingLeadData.reassignment_status === 'requested' ? 'bg-yellow-500/20 text-yellow-400' :
                          existingLeadData.reassignment_status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          existingLeadData.reassignment_status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-700 text-neutral-300'
                        }`}>
                          {existingLeadData.reassignment_status.charAt(0).toUpperCase() + existingLeadData.reassignment_status.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-center">
                  <button
                    className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium rounded-lg border border-neutral-600 transition-colors"
                    onClick={() => { setShowLeadDetails(false); setExistingLeadData(null); setMobileNumber(''); }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* LEAD FORM - Fixed height to prevent layout shifts */}
            {showLeadForm && (
              <div className="p-6 mb-6 bg-white rounded-lg shadow-md card min-h-[800px]" id="leadForm" ref={leadFormRef}>
                {/* Section Selector - Sticky positioning within form */}
                <div className="flex gap-4 mb-8 sticky top-16 z-10 bg-white pt-2 pb-4 border-b border-gray-100">
                  <button
                    className={`flex-1 px-6 py-3 text-lg font-bold uppercase rounded-t-md border-b-4 transition ${leadSection === "leadinfo"
                      ? "border-sky-400 text-[#03B0F5] bg-neutral-900"
                      : "border-transparent text-[#03B0F5] bg-neutral-800 hover:text-sky-300"
                      }`}
                    onClick={() => handleSectionChange("leadinfo")}
                  >
                    Lead Information
                  </button>
                  {/* OBLIGATION TAB - COMMENTED OUT */}
                  {/* <button
                    className={`flex-1 px-6 py-3 text-lg font-bold uppercase rounded-t-md border-b-4 transition relative ${leadSection === "obligation"
                      ? "border-sky-400 text-sky-400 bg-neutral-900"
                      : "border-transparent text-[#03B0F5] bg-neutral-800 hover:text-sky-300"
                      }`}
                    onClick={() => handleSectionChange("obligation")}
                  >
                    <span className="flex items-center justify-center gap-2">
                      Obligation
                      {obligationIsSaving && (
                        <span className="text-yellow-400 animate-pulse">⏳</span>
                      )}
                      {obligationHasUnsavedChanges && !obligationIsSaving && (
                        <span className="text-orange-400">⚠️</span>
                      )}
                      {obligationDataSaved && !obligationHasUnsavedChanges && !obligationIsSaving && (
                        <span className="text-green-400">✅</span>
                      )}
                      {!obligationDataSaved && !obligationHasUnsavedChanges && !obligationIsSaving && (
                        <span className="text-red-400">❌</span>
                      )}
                    </span>
                  </button> */}
                </div>

                {/* Lead Information Section */}
                {leadSection === "leadinfo" && (
                  <>
                    {/* Card 1: Lead Info */}
                    <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-neutral-200 card">
                      <div className="mb-2 text-lg font-extrabold text-[#03B0F5]">Lead Information</div>
                      <div className="form-section">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row">
                          {/* Column 1 */}
                          <div className="form-group">
                            <label className="block mb-2 text-md font-bold text-black form-label required-field">
                              Campaign Name<span className="ml-1 text-red-400">*</span>
                            </label>
                            <SearchableSelect
                              options={campaignNames.map(campaign => ({
                                value: campaign.name,
                                label: campaign.name
                              }))}
                              value={campaignName}
                              onChange={(value) => {
                                setCampaignName(value);
                                // Clear form validation error for campaign name when user selects
                                if (formValidationErrors.campaignName) {
                                  setFormValidationErrors(prev => ({
                                    ...prev,
                                    campaignName: false
                                  }));
                                }
                              }}
                              placeholder={loadingSettings ? "Loading..." : "Select Campaign"}
                              searchPlaceholder="Search campaigns..."
                              disabled={loadingSettings}
                              className={`form-select ${showValidationErrors && formValidationErrors.campaignName ? 'border-red-500' : ''}`}
                            />
                            {showValidationErrors && formValidationErrors.campaignName && (
                              <p className="text-red-500 text-sm mt-1">Campaign Name is required</p>
                            )}
                          </div>
                          {/* Column 2 */}
                          <div className="form-group">
                            <label className="block mb-2 text-md font-bold text-black form-label">Data Code</label>
                            <SearchableSelect
                              options={dataCodes.map(dataCodeItem => ({
                                value: dataCodeItem.name,
                                label: dataCodeItem.name
                              }))}
                              value={dataCode}
                              onChange={setDataCode}
                              placeholder={loadingSettings ? "Loading..." : "Select Data Code"}
                              searchPlaceholder="Search data codes..."
                              disabled={loadingSettings}
                              className="form-select"
                            />
                          </div>
                          {/* Column 3 */}
                          <div className="form-group">
                            <label className="block mb-2 text-md font-bold text-black form-label required-field">
                              Status<span className="ml-1 text-red-400">*</span>
                            </label>
                            <SearchableSelect
                              options={[
                                ...statusOptions.reduce((acc, opt) => {
                                  acc.push({ value: opt.value, label: opt.label });
                                  if (opt.subOptions && status === 'lead') {
                                    opt.subOptions.forEach(subOpt => {
                                      acc.push({ value: subOpt.value, label: `  ${subOpt.label}` });
                                    });
                                  }
                                  return acc;
                                }, [])
                              ]}
                              value={status}
                              onChange={(value) => {
                                setStatus(value);
                                // Clear form validation error for status when user selects
                                if (formValidationErrors.status) {
                                  setFormValidationErrors(prev => ({
                                    ...prev,
                                    status: false
                                  }));
                                }
                              }}
                              placeholder="Select Status"
                              searchPlaceholder="Search status..."
                              className={`form-select ${showValidationErrors && formValidationErrors.status ? 'border-red-500' : ''}`}
                            />
                            {showValidationErrors && formValidationErrors.status && (
                              <p className="text-red-500 text-sm mt-1">Status is required</p>
                            )}
                          </div>
                        </div>
                        {/* New Row for Assigned To */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row mt-4">
                          {/* Column 1 - Assignee with Multi-Select */}
                          <div className="form-group">
                            <label className="block mb-2 text-md font-bold text-black form-label required-field">
                              Assigned TL<span className="ml-1 text-red-400">*</span>
                            </label>
                            <div className="relative">
                              <div
                                className={`w-full px-3 py-2 text-white border rounded-lg min-h-[40px] flex flex-wrap gap-2 items-center cursor-pointer ${
                                  showValidationErrors && formValidationErrors.assignedTo 
                                    ? 'border-red-500 bg-neutral-800' 
                                    : 'border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400'
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  setShowAssignPopup(true);

                                }}
                              >
                                {assignedTo.length === 0 && (
                                  <span className="text-gray-400">Click to select assignee</span>
                                )}

                                {assignedTo.map((assignee) => {
                                  const displayName = typeof assignee === 'object' ? assignee.name : assignee;
                                  const uniqueKey = typeof assignee === 'object' ? assignee.id || assignee.name : assignee;
                                  const isNone = (typeof assignee === 'object' && assignee.id === 'none') || 
                                                (typeof assignee === 'string' && assignee === 'None') ||
                                                displayName === 'None';
                                  
                                  return (
                                    <div
                                      key={uniqueKey}
                                      className={`flex items-center gap-2 pl-2 pr-1 py-1 rounded-md text-sm ${
                                        isNone ? 'bg-gray-500' : 'bg-gray-700'
                                      }`}
                                    >
                                      {/* Profile icon with initials or special icon for None */}
                                      <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center flex-shrink-0 ${
                                        isNone ? 'bg-gray-400' : 'bg-[#03B0F5]'
                                      }`}>
                                        {isNone ? '∅' : displayName.split(' ')
                                          .map(part => part[0])
                                          .slice(0, 2)
                                          .join('')
                                          .toUpperCase()}
                                      </div>
                                      <span>{displayName}</span>
                                      <button
                                        type="button"
                                        className="text-gray-300 hover:text-white ml-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveAssignee(assignee);
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}

                                {/* Add button */}
                                {assignedTo.length > 0 && (
                                  <button
                                    type="button"
                                    className="w-6 h-6 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAssignPopup(true);
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </div>
                            {showValidationErrors && formValidationErrors.assignedTo && (
                              <p className="text-red-500 text-sm mt-1">Please select a TL</p>
                            )}
                          </div>

                          {/* Column 2 */}
                          {/* Intentionally left empty */}
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Personal */}
                    <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-neutral-200 card">
                      <div className="mb-2 text-lg font-extrabold text-[#03B0F5]">Personal</div>
                      <div className="form-section">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row">
                          {/* Column 1 */}
                          <div className="form-group">
                            <label className="block mb-2 text-md font-bold text-black form-label required-field">
                              Customer Name<span className="ml-1 text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              className={`w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 text-semibold focus:outline-none ${
                                showValidationErrors && formValidationErrors.customerName 
                                  ? 'border-red-500 focus:border-red-500' 
                                  : 'focus:border-sky-400'
                              }`}
                              placeholder="Full Name"
                              value={customerName}
                              onChange={(e) => {
                                setCustomerName(e.target.value.toUpperCase());
                                // Clear form validation error for customer name when user starts typing
                                if (formValidationErrors.customerName) {
                                  setFormValidationErrors(prev => ({
                                    ...prev,
                                    customerName: false
                                  }));
                                }
                              }}
                            />
                            {showValidationErrors && formValidationErrors.customerName && (
                              <p className="text-red-500 text-sm mt-1">Customer Name is required</p>
                            )}
                          </div>
                          {/* Column 2 */}
                          <div className="form-group">
                            <label className="block mb-2 text-md font-bold text-black form-label">Alternate Number</label>
                            <input
                              type="text"
                              className={`w-full px-3 py-2 text-black border rounded-lg form-control focus:outline-none focus:border-sky-400 ${
                                alternateNumber && alternateNumber === mobileNumber 
                                  ? 'border-red-500' 
                                  : 'border-neutral-80'
                              }`}
                              placeholder="Alternate Mobile Number"
                              value={alternateNumber}
                              onChange={handleAlternateNumberChange}
                            />
                            {alternateNumber && alternateNumber === mobileNumber && (
                              <p className="mt-1 text-sm text-red-500">
                                Alternate number must be different from the main mobile number
                              </p>
                            )}
                            {alternateNumber && alternateNumber.length > 0 && alternateNumber.length < 10 && (
                              <p className="mt-1 text-sm text-orange-500">
                                Alternate number must be exactly 10 digits
                              </p>
                            )}
                            {alternateNumber && alternateNumber.length === 10 && !/^[6-9]/.test(alternateNumber) && (
                              <p className="mt-1 text-sm text-red-500">
                                Alternate number must start with 6, 7, 8, or 9
                              </p>
                            )}
                          </div>
                          {/* State input can go here if you decide to add it */}

                          {/* <div className="form-group">
          <label className="block mb-2 text-md font-bold text-black form-label required-field">
            State<span className="ml-1 text-red-400">*</span>
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
            id="state"
            placeholder="State"
            value={state}
            readOnly
          />
        </div> */}

                         
                        </div>

                        {/* Second row for Company Category */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row mt-4">

                        </div>
                      </div>
                    </div>


                  </>
                )}

                {/* OBLIGATION SECTION - CONSOLIDATED */}
                {/* COMMENTED OUT - OBLIGATION TAB HIDDEN */}
                {/* {leadSection === "obligation" && (
                  <CustomerObligationForm 
                    leadData={{
                      _id: null, // Creating new lead, no ID yet
                      dynamic_fields: {
                        financial_details: {
                          monthly_income: salary,
                          partner_salary: partnerSalary,
                          yearly_bonus: yearlyBonus,
                          bonus_division: bonusDivision,
                          foir_percent: foirPercent,
                          custom_foir_percent: customFoirPercent
                        },
                        obligations: obligations,
                        personal_details: {
                          loan_required: loanRequired,
                          company_name: companyName,
                          company_type: companyType,
                          company_category: companyCategory,
                          cibil_score: cibilScore
                        },
                        check_eligibility: {
                          company_category: ceCompanyCategory,
                          foir_percent: ceFoirPercent,
                          custom_foir_percent: ceCustomFoirPercent,
                          monthly_emi_can_pay: ceMonthlyEmiCanPay,
                          tenure_months: ceTenureMonths,
                          tenure_years: ceTenureYears,
                          roi: ceRoi,
                          multiplier: ceMultiplier
                        }
                      }
                    }}
                    handleChangeFunc={(field, value) => {
                      // Update parent component state when obligation data changes
                      console.log('Obligation field changed:', field, value);
                      
                      // Handle different field updates
                      if (field === 'salary') setSalary(value);
                      else if (field === 'partnerSalary') setPartnerSalary(value);
                      else if (field === 'yearlyBonus') setYearlyBonus(value);
                      else if (field === 'bonusDivision') setBonusDivision(value);
                      else if (field === 'foirPercent') setFoirPercent(value);
                      else if (field === 'customFoirPercent') setCustomFoirPercent(value);
                      else if (field === 'obligations') setObligations(value);
                      else if (field === 'loanRequired') setLoanRequired(value);
                      else if (field === 'companyName') setCompanyName(value);
                      else if (field === 'companyType') setCompanyType(value);
                      else if (field === 'companyCategory') setCompanyCategory(value);
                      else if (field === 'cibilScore') setCibilScore(value);
                      else if (field === 'totalBtPos') setTotalBtPos(value);
                      else if (field === 'totalObligation') setTotalObligation(value);
                      else if (field === 'ceCompanyCategory') setCeCompanyCategory(value);
                      else if (field === 'ceFoirPercent') setCeFoirPercent(value);
                      else if (field === 'ceCustomFoirPercent') setCeCustomFoirPercent(value);
                      else if (field === 'ceMonthlyEmiCanPay') setCeMonthlyEmiCanPay(value);
                      else if (field === 'ceTenureMonths') setCeTenureMonths(value);
                      else if (field === 'ceTenureYears') setCeTenureYears(value);
                      else if (field === 'ceRoi') setCeRoi(value);
                      else if (field === 'ceMultiplier') setCeMultiplier(value);
                      else if (field === 'loanEligibilityStatus') setLoanEligibilityStatus(value);
                      else if (field === 'eligibility') {
                        // Handle eligibility object updates
                        setEligibility(value);
                      }
                      
                    }}
                    onDataUpdate={handleObligationDataUpdate}
                    canEdit={true}
                  />
                )} */}
                
                {/* Save Obligation Data Button - Only shown during lead creation */}
                {/* COMMENTED OUT - OBLIGATION TAB HIDDEN */}
                {/* {leadSection === "obligation" && (
                  <div className="flex justify-center mt-4 mb-4">
                    <button
                      type="button"
                      className="px-6 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-lg"
                      onClick={() => {
                        const obligationDataToSave = {
                          salary,
                          partnerSalary,
                          yearlyBonus,
                          bonusDivision,
                          foirPercent,
                          customFoirPercent,
                          obligations,
                          loanRequired,
                          companyName,
                          companyType,
                          companyCategory,
                          cibilScore,
                          totalBtPos,
                          totalObligation,
                          eligibility,
                          ceCompanyCategory,
                          ceFoirPercent,
                          ceCustomFoirPercent,
                          ceMonthlyEmiCanPay,
                          ceTenureMonths,
                          ceTenureYears,
                          ceRoi,
                          ceMultiplier,
                          loanEligibilityStatus
                        };
                        
                        console.log('💾 =====================================');
                        console.log('💾 SAVING OBLIGATION DATA TO TEMP STORAGE');
                        console.log('💾 =====================================');
                        console.log('💾 Data being saved:', obligationDataToSave);
                        console.log('💾 Salary:', obligationDataToSave.salary);
                        console.log('💾 Obligations count:', obligationDataToSave.obligations?.length || 0);
                        console.log('💾 Obligations array:', obligationDataToSave.obligations);
                        console.log('💾 CIBIL Score:', obligationDataToSave.cibilScore);
                        
                        saveObligationData(obligationDataToSave);
                        
                        // Verify it was saved
                        const savedData = getTempLeadData();
                        console.log('✅ =====================================');
                        console.log('✅ VERIFICATION AFTER SAVE');
                        console.log('✅ =====================================');
                        console.log('✅ All temp data:', savedData);
                        console.log('✅ Obligation data specifically:', savedData.obligation);
                        console.log('✅ Salary in saved data:', savedData.obligation?.salary);
                        console.log('✅ Obligations in saved data:', savedData.obligation?.obligations);
                        
                        alert('✅ Obligation data saved successfully!\n\nNow click "Create Lead" to save the lead with this obligation data.');
                      }}
                    >
                      💾 Save Changes
                    </button>
                  </div>
                )} */}


                <div className="flex justify-end gap-4 mt-8 form-actions">
                  <button 
                    type="button" 
                    className="px-5 py-2 font-semibold text-white rounded-lg btn btn-secondary bg-neutral-800 hover:bg-neutral-700"
                    onClick={() => {
                      // Close the lead form but keep product type and mobile number
                      setShowLeadForm(false);
                      
                      // Reset only the lead form data, NOT the product type and mobile number
                      setCustomerName('');
                      setAlternateNumber('');
                      setCampaignName('');
                      setDataCode('');
                      setStatus('');
                      setAssignedTo([]);
                      
                      // Reset lead section to default
                      setLeadSection("leadinfo");
                      
                      // Reset obligation data
                      setObligationDataSaved(false);
                      setObligationHasUnsavedChanges(false);
                      setObligationIsSaving(false);
                      
                      // Clear validation errors (except mobile validation)
                      setPincodeError('');
                      
                      // Reset available cities
                      setAvailableCities([]);
                      
                      // Keep the existing lead data and mobile/product validation intact
                      // This ensures users don't have to re-validate mobile number and product type
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className={`px-5 py-2 font-bold text-white rounded-lg btn transition-all duration-300 transform ${
                      createLeadLoading || !hasAddLeadPermission
                        ? "bg-gray-400 cursor-not-allowed opacity-75 scale-95"
                        : "bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/25"
                    } ${buttonAnimations.createLeadBtn ? 'animate-pulse scale-95' : ''}`}
                    onClick={handleSubmit}
                    disabled={createLeadLoading || !hasAddLeadPermission}
                    title={
                      !hasAddLeadPermission
                        ? "🚫 You don't have permission to create leads. Contact your administrator."
                        : createLeadLoading
                        ? "Creating lead, please wait..."
                        : "Click to create lead. Required fields will be validated."
                    }
                  >
                    {createLeadLoading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Creating...
                      </>
                    ) : !hasAddLeadPermission ? (
                      <>
                        <span className="mr-2">🚫</span>
                        No Permission
                      </>
                    ) : (
                      <>
                        <span className="mr-2">🚀</span>
                        Create Lead
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "reassignment" && (
          <ReassignmentPanel 
            userPermissions={null}
            onLeadAction={() => {}}
            onViewLead={(leadId) => handleViewDuplicateLead(leadId, false, true)}
          />
        )}
      </div>

      {/* AssignPopup component */}
      {showAssignPopup && (
        <AssignPopup
          onClose={() => {

            setShowAssignPopup(false);
          }}
          onSelect={(user) => {

            handleAddAssignee(user);
            setShowAssignPopup(false);
          }}
          assignableUsers={assignableUsers}
        />
      )}
    </>
  );
}

// AssignPopup component
function AssignPopup({ onClose, onSelect, assignableUsers = [] }) { 
  const [assigneeName, setAssigneeName] = useState("");

  // Use the assignableUsers from API, fallback to dummy data if empty
  const dummyAssignees = [
  ];

  // Create a list of users with both ID and name from API data, or use dummy data
  const availableUsers = React.useMemo(() => [
    { id: 'none', name: 'None' }, // Add "None" option at the top
    ...(assignableUsers.length > 0
      ? assignableUsers.map(user => ({
        id: user.id || user._id || user.user_id,
        name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.id,
        designation: user.designation || 'No Designation',
        department_name: user.department_name || 'Unknown Department',
        displayName: `${user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.id} (${user.designation || 'No Designation'}) - ${user.department_name || 'Unknown Department'}`
      }))
      : dummyAssignees)
  ], [assignableUsers]);

  const [filteredAssignees, setFilteredAssignees] = useState(availableUsers);

  useEffect(() => {
    // If assigneeName is empty, show all available users
    if (assigneeName.trim() === "") {
      setFilteredAssignees(availableUsers);
    } else {
      // Otherwise, filter based on input (search name, designation, and department)
      setFilteredAssignees(
        availableUsers.filter((user) =>
          (user.name || '').toLowerCase().includes(assigneeName.toLowerCase()) ||
          (user.designation || '').toLowerCase().includes(assigneeName.toLowerCase()) ||
          (user.department_name || '').toLowerCase().includes(assigneeName.toLowerCase())
        )
      );
    }
  }, [assigneeName, availableUsers]);

  const handleAssign = () => {
    if (assigneeName) {
      // Find the user object that matches the typed name
      const selectedUser = availableUsers.find(user =>
        (user.name || '').toLowerCase() === assigneeName.toLowerCase()
      );
      if (selectedUser) {
        onSelect(selectedUser);
      } else {
        // If no exact match found, create a user object with the typed name
        onSelect({ id: assigneeName.toLowerCase().replace(/\s+/g, '_'), name: assigneeName });
      }
    }
    // Optionally, clear the input after assigning
    setAssigneeName("");
    onClose(); // Close the popup after assigning
  };

  const selectAssignee = (selectedUser) => {
    if (selectedUser.id === 'none') {
      // Handle "None" selection - could clear assignments or handle differently
      setAssigneeName("None");
      onSelect(selectedUser); // Pass the "None" selection to parent
    } else {
      setAssigneeName(selectedUser.name); // Set the selected name in the input
      onSelect(selectedUser); // Pass the selected user object to the parent
    }
    onClose(); // Close the popup
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50"
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)' // Dark semi-transparent overlay - made darker for visibility
      }}
    >
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-[90%] max-w-md mx-auto relative"
           style={{ backgroundColor: 'white', zIndex: 99999 }}>
        
        <div className="flex items-center mb-4 bg-white p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-lg text-black">Select Assignee</h3>
            
          </div>
        </div>

        <div className="mb-4 bg-white p-3 rounded-md">
          <label className="block font-bold text-gray-700 mb-2">
            Assign to
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 border border-cyan-400 rounded text-black font-bold"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value.toUpperCase())}
              placeholder="Search by name, designation, or department"
            />
            {assigneeName && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                onClick={() => setAssigneeName("")}
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Always show the list, filtered or full */}
        <ul className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white">
          {filteredAssignees.length > 0 ? (
            filteredAssignees.map((user) => (
              <li
                key={user.id || user.name}
                className="p-3 border-b last:border-b-0 cursor-pointer text-black transition hover:bg-gray-100 flex items-center"
                onClick={() => selectAssignee(user)}
              >
                {/* Profile icon with initials or avatar */}
                <div className="w-8 h-8 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3 flex-shrink-0">
                  {user.name.split(' ')
                    .map(part => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex flex-col flex-grow">
                  <span className="font-medium">{user.name}</span>
                  {user.designation && user.id !== 'none' && (
                    <span className="text-sm text-gray-600">{user.designation}</span>
                  )}
                  {user.department_name && user.id !== 'none'}
                </div>
              </li>
            ))
          ) : (
            assigneeName.trim() !== "" && ( // Only show "No results" if user typed something and no results
              <li className="p-3 text-gray-500 text-center">No matching assignees found.</li>
            )
          )}
        </ul>

        <div className="flex justify-end gap-4 mt-4 bg-white p-3 rounded-b-xl">
          <button
            className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition"
            onClick={handleAssign}
          >
            Assign
          </button>
          <button
            className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-2xl font-bold"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default CreateLead;
