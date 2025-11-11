import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, Search, ExternalLink } from 'lucide-react';
import { saveObligationData, loadSavedObligationData } from '../../utils/leadDataHelper';
import { saveObligationDataToAPIDebounced, prepareObligationData } from '../../utils/obligationDataHelper';
import { API_BASE_URL } from '../../config/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Get userId from localStorage
const getUserId = () => {
  try {
    const userId = localStorage.getItem('userId');
    console.log('🔍 Getting userId from localStorage:', userId);
    if (userId) return userId;
    
    // Try to get from user object
    const userData = localStorage.getItem('user');
    console.log('🔍 Getting user data from localStorage:', userData);
    if (userData) {
      const parsedUser = JSON.parse(userData);
      console.log('🔍 Parsed user data:', parsedUser);
      const id = parsedUser.id || parsedUser._id || parsedUser.user_id;
      console.log('🔍 Extracted user ID:', id);
      return id;
    }
    
    // Try to get from userData 
    const userDataAlt = localStorage.getItem('userData');
    console.log('🔍 Getting userData from localStorage:', userDataAlt);
    if (userDataAlt) {
      const parsedUserAlt = JSON.parse(userDataAlt);
      console.log('🔍 Parsed userData:', parsedUserAlt);
      const idAlt = parsedUserAlt.id || parsedUserAlt._id || parsedUserAlt.user_id;
      console.log('🔍 Extracted user ID from userData:', idAlt);
      return idAlt;
    }
    
    console.warn('⚠️ No user ID found in localStorage');
    return null;
  } catch (error) {
    console.error('❌ Error getting user ID:', error);
    return null;
  }
};

// Fetch company names from Vakilsearch API with improved error handling
const fetchCompanyNames = async (companyName) => {
  try {
    const userId = getUserId();
    if (!userId) {
      console.warn('⚠️ No user ID available for Vakilsearch API');
      return [];
    }
    
    if (!companyName || companyName.trim().length < 1) {
      // Don't make API calls for empty search terms
      return [];
    }
    
    console.log(`🔍 Fetching Vakilsearch data for company: ${companyName}`);
    
    const response = await fetch(`${API_BASE_URL}/settings/company-names-from-vakilsearch?company_name=${encodeURIComponent(companyName)}&user_id=${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        })
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Vakilsearch API Error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📥 Vakilsearch API response:', data);
    
    if (Array.isArray(data) && data.length > 0) {
      console.log(`✅ Found ${data.length} companies from Vakilsearch`);
      return data;
    } else {
      console.log('⚠️ No company matches found in Vakilsearch');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching company names from Vakilsearch:', error);
    // Return empty array on error
    return [];
  }
};

// Fetch company categories based on company name
const fetchCompanyCategoriesForCompany = async (companyName) => {
  try {
    const userId = getUserId();
    if (!userId) {
      console.error('No userId available for company categories API');
      return [];
    }
    if (!companyName) {
      console.error('No company name provided for categories API');
      return [];
    }
    
    console.log(`🔍 Fetching categories for company: "${companyName}" with userId: ${userId}`);
    
    // Using POST method with company_name and similarity_threshold
    const apiUrl = `${API_BASE_URL}/settings/search-companies?user_id=${userId}`;
    const requestBody = {
      company_name: companyName,
      similarity_threshold: 0.6
    };
    
    console.log(`📡 API Request:`, {
      url: apiUrl,
      method: 'POST',
      body: requestBody
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        })
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📤 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📥 Raw API response for company categories:', {
      companyName,
      responseType: typeof data,
      isArray: Array.isArray(data),
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'Not an object',
      dataLength: Array.isArray(data) ? data.length : 'Not an array',
      fullData: data
    });
    
    // Handle the new API response structure
    let categories = [];
    if (Array.isArray(data)) {
      // Return the data as-is since it matches the new structure
      categories = data;
      console.log(`✅ Using direct array response with ${categories.length} items`);
    } else if (data.companies && Array.isArray(data.companies)) {
      categories = data.companies;
      console.log(`✅ Using data.companies with ${categories.length} items`);
    } else if (data.categories && Array.isArray(data.categories)) {
      categories = data.categories;
      console.log(`✅ Using data.categories with ${categories.length} items`);
    } else if (data.data && Array.isArray(data.data)) {
      categories = data.data;
      console.log(`✅ Using data.data with ${categories.length} items`);
    } else {
      console.warn(`⚠️ Unexpected API response structure for company categories:`, data);
    }
    
    // Log first item structure if available
    if (categories.length > 0) {
      console.log(`🔍 First category item structure:`, {
        firstItem: categories[0],
        keys: Object.keys(categories[0] || {}),
        hasCompanyName: !!(categories[0]?.company_name),
        hasBankNames: !!(categories[0]?.bank_names),
        hasCategories: !!(categories[0]?.categories)
      });
    }
    
    // Return the raw data without transformation for the new structure
    console.log(`📊 Returning ${categories.length} categories for "${companyName}"`);
    return categories;
  } catch (error) {
    console.error(`❌ Error fetching company categories for "${companyName}":`, error);
    // Return empty array on error to show proper "no results" message
    return [];
  }
};

// Fetch bank names from settings API
const fetchBankNames = async () => {
  try {
    const userId = getUserId();
    if (!userId) {
      console.warn('⚠️ No user ID available for bank names API');
      return ['Custom'];
    }
    
    console.log('🏦 Fetching bank names from settings API...');
    
    // Using the specific API endpoint for bank names
    const response = await fetch(`${API_BASE_URL}/settings/bank-names?user_id=${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        })
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error fetching bank names: ${response.status} - ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📥 Bank names API response:', data);
    
    // Add "Custom" option to the list
    let bankNames = [];
    if (Array.isArray(data)) {
      bankNames = data;
    } else if (data.bank_names && Array.isArray(data.bank_names)) {
      bankNames = data.bank_names;
    } else if (data.data && Array.isArray(data.data)) {
      bankNames = data.data;
    } else {
      console.warn('⚠️ Unexpected bank names API response structure:', data);
    }
    
    const finalBankList = [
      'Custom', // Always keep Custom as an option
      ...bankNames.map(bank => bank.name || bank)
    ];
    
    console.log(`✅ Successfully loaded ${finalBankList.length} bank names`);
    return finalBankList;
  } catch (error) {
    console.error('❌ Error fetching bank names:', error);
    // Return at least Custom option in case of error
    return ['Custom'];
  }
};

// Fetch company categories from settings API
const fetchCompanyCategories = async () => {
  try {
    const userId = getUserId();
    if (!userId) return [];
    
    // Note: This function is used for loading categories when no specific company is selected
    // Since the backend API requires a company name, we return empty array
    // Categories should be loaded via fetchCompanyCategoriesForCompany when a company is selected
    console.log('fetchCompanyCategories called - returning empty array as no specific company provided');
    return [];
  } catch (error) {
    console.error('Error fetching company categories:', error);
    return [];
  }
};

export default function CustomerObligationForm({ leadData, handleChangeFunc, onDataUpdate, onUnsavedChangesUpdate, canEdit = true }) {
  // Immediate safety check to prevent any initialization errors
  if (typeof React === 'undefined' || !React.useState) {
    console.error('React is not properly loaded');
    return <div>Loading...</div>;
  }
  

  
  // All State variables - moved to beginning to avoid initialization errors
  const [salary, setSalary] = useState('');
  const [partnerSalary, setPartnerSalary] = useState('');
  const [yearlyBonus, setYearlyBonus] = useState('');
  const [bonusDivision, setBonusDivision] = useState(null);
  const [loanRequired, setLoanRequired] = useState('');
  const [companyName, setCompanyName] = useState('');
  // Always initialize companyType as an array to prevent "companyType.map is not a function" error
  const [companyType, setCompanyType] = useState([]);
  const [showBankPopup, setShowBankPopup] = useState(false);
  const [companyCategory, setCompanyCategory] = useState([]);
  const [showCategoryPopup, setShowCategoryPopup] = useState(false);
  const [totalBtPos, setTotalBtPos] = useState('0');
  const [totalObligation, setTotalObligation] = useState('0');
  const [cibilScore, setCibilScore] = useState('');
  const [obligations, setObligations] = useState([
    {
      id: Date.now(), // Add unique ID
      product: '',
      bankName: '',
      tenure: '',
      roi: '',
      totalLoan: '',
      outstanding: '',
      emi: '',
      action: 'Obligate',
      selectedPercentage: null, // Keep for backward compatibility
      selectedTenurePercentage: null, // For 4% tenure button
      selectedRoiPercentage: null // For 5% ROI button
    }
  ]);
  
  // Unsaved changes detection
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [originalData, setOriginalData] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if data is being initially loaded
  const [hasUserInteraction, setHasUserInteraction] = useState(false); // Track if user has actually made any changes
  
  // Auto-save states
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef(null);
  
  // Force re-render state for Credit Card button updates
  const [forceRender, setForceRender] = useState(0);
  const [renderKey, setRenderKey] = useState(Date.now());
  const [lastSaveTime, setLastSaveTime] = useState(0);
  
  // Add state to force complete component remount after save
  const [componentKey, setComponentKey] = useState(Date.now());
  
  // Bank list state from API
  const [bankList, setBankList] = useState(['Custom']);
  
  // Note: companyType now stores selected banks for "Decide Bank For Case" (supports multiple selection)

  // States for searchable dropdowns in obligation table - initialized with proper defaults to prevent initialization errors
  const [productSearchStates, setProductSearchStates] = useState({ 0: { isOpen: false, searchQuery: '' } });
  const [bankSearchStates, setBankSearchStates] = useState({ 0: { isOpen: false, searchQuery: '' } });
  
  // State to track action dropdown interactions to prevent disruption during save
  const [actionDropdownInteracting, setActionDropdownInteracting] = useState(false);
  
  // State to track which specific dropdown is being interacted with
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  
  // Company name dropdown states
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [isCompanyLoading, setIsCompanyLoading] = useState(false);
  const [companySearchTimeout, setCompanySearchTimeout] = useState(null);
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false);
  
  // Company dropdown ref for positioning
  const companyDropdownRef = useRef(null);

  // Notify parent component when unsaved changes state updates
  useEffect(() => {
    if (onUnsavedChangesUpdate && typeof onUnsavedChangesUpdate === 'function') {
      onUnsavedChangesUpdate(hasUnsavedChanges, () => setShowUnsavedChangesModal(true));
    }
  }, [hasUnsavedChanges, onUnsavedChangesUpdate]);
  
  // Cleanup blur save timer on unmount
  useEffect(() => {
    return () => {
      if (blurSaveTimerRef.current) {
        clearTimeout(blurSaveTimerRef.current);
        console.log('💾 [CLEANUP] Cleared blur save timer on component unmount');
      }
    };
  }, []);
  
  // Force immediate DOM update when save happens
  useLayoutEffect(() => {
    if (lastSaveTime > 0) {
      console.log('🔄 useLayoutEffect triggered by save - forcing DOM update');
      // This forces React to re-evaluate the entire component tree
      const forceUpdate = () => setForceRender(prev => prev + 1);
      forceUpdate();
    }
  }, [lastSaveTime]);
  
  // Debug obligations state changes
  useEffect(() => {
    console.log('🔄 Obligations state changed:', {
      obligationsCount: obligations.length,
      obligationsData: obligations.map((obl, idx) => ({
        index: idx,
        action: obl.action,
        product: obl.product,
        id: obl.id
      })),
      timestamp: new Date().toLocaleTimeString()
    });
  }, [obligations]);
  
  // Emergency safety check - ensure states are always defined
  const safeProductSearchStates = productSearchStates || {};
  const safeBankSearchStates = bankSearchStates || {};
  
  // Used for tracking if a bank list API call is in progress
  const [bankListLoaded, setBankListLoaded] = useState(false);
  
  // Eligibility states - moved here to avoid initialization errors
  const [eligibility, setEligibility] = useState({
    totalIncome: '',
    foirAmount: '',
    totalObligations: '',
    totalBtPos: '',
    finalEligibility: '',
    multiplierEligibility: ''
  });
  
  // Track if backend eligibility data was loaded (to preserve backend final_eligibility)
  const [backendEligibilityLoaded, setBackendEligibilityLoaded] = useState(false);
  const [backendFinalEligibility, setBackendFinalEligibility] = useState(null);
  const [justSavedEligibility, setJustSavedEligibility] = useState(false); // Flag to prevent overwrite after save
  
  // Check Eligibility section states - moved here to be available for useEffects
  const [loanEligibilityStatus, setLoanEligibilityStatus] = useState('Not Eligible');
  
  const [ceCompanyCategory, setCeCompanyCategory] = useState('');
  const [ceFoirPercent, setCeFoirPercent] = useState(60);
  const [ceCustomFoirPercent, setCeCustomFoirPercent] = useState('');
  const [ceMonthlyEmiCanPay, setCeMonthlyEmiCanPay] = useState(0);
  const [ceTenureMonths, setCeTenureMonths] = useState('');
  const [ceTenureYears, setCeTenureYears] = useState('');
  const [ceRoi, setCeRoi] = useState('');
  const [ceMultiplier, setCeMultiplier] = useState('0');

  // State to track if data has been loaded to prevent continuous API calls
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastLoadedLeadId, setLastLoadedLeadId] = useState(null);
  
  // State to track if data is stable for file_sent_to_login scenarios
  const [dataStableForFileSentToLogin, setDataStableForFileSentToLogin] = useState(false);
  
  // State to store the API response data for monitoring and debugging
  const [savedData, setSavedData] = useState(null);
  
  // Debug state watcher to track when values are being cleared
  const [debugStateValues, setDebugStateValues] = useState({});
  
  // Backup data store for file_sent_to_login scenarios
  const [backupObligationData, setBackupObligationData] = useState(null);

  // Debug state for file_sent_to_login tracking and recovery
  const [debugState, setDebugState] = useState({
    fileSentToLogin: false,
    recoveryCount: 0,
    lastRecoveryTime: null,
    dataCleared: false,
    renderCount: 0
  });

  // Update debug state when leadData changes
  useEffect(() => {
    if (leadData?.file_sent_to_login !== debugState.fileSentToLogin) {
      setDebugState(prev => ({
        ...prev,
        fileSentToLogin: !!leadData?.file_sent_to_login,
        renderCount: prev.renderCount + 1
      }));
    }
  }, [leadData?.file_sent_to_login, debugState.fileSentToLogin]);

  // Handle scroll events to close dropdowns and handle click outside
  useEffect(() => {
    // Function to close dropdowns on scroll (but not when scrolling inside dropdown)
    const handleScroll = (event) => {
      // Check if the scroll is happening inside a dropdown
      const isDropdownScroll = event.target.closest('[data-dropdown-scroll]') || 
                               event.target.hasAttribute('data-dropdown-scroll');
      
      // Only close dropdowns if scrolling outside the dropdown
      if (!isDropdownScroll) {
        const hasOpenDropdowns = Object.values(safeProductSearchStates).some(state => state?.isOpen) ||
                                 Object.values(safeBankSearchStates).some(state => state?.isOpen);
        
        if (hasOpenDropdowns) {
          closeAllDropdowns();
        }
      }
    };
    
    // Function to handle click outside dropdowns
    const handleClickOutside = (event) => {
      const target = event.target;
      
      // Check if click is inside a dropdown or dropdown trigger
      const isDropdownClick = target.closest('[data-dropdown-container]') || 
                             target.closest('[data-dropdown-trigger]') ||
                             target.closest('[data-search-input]');
      
      if (!isDropdownClick) {
        // Close all dropdowns
        closeAllDropdowns();
      }
    };
    
    // Add event listeners
    window.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scrolls
    window.addEventListener('resize', closeAllDropdowns); // Close on resize too
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', closeAllDropdowns);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [safeProductSearchStates, safeBankSearchStates]); // Re-run when dropdown states change

  // Permission check function for download obligation button
  const hasDownloadObligationPermission = () => {
    try {
      console.log('🔐 Checking DOWNLOAD OBLIGATION permission...');
      
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        
        // Check if super admin
        if (user.role?.name && user.role.name.toLowerCase().includes('super admin')) {
          console.log('✅ User is Super Admin - has DOWNLOAD permission');
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
            
            const hasDownload = actions.includes('download_obligation') || actions.includes('download');
            console.log('🔍 PL & ODD LEADS permission check:', {
              page: plOddPermission.page,
              actions: actions,
              hasDownload: hasDownload
            });
            
            if (hasDownload) {
              console.log('✅ User has DOWNLOAD OBLIGATION permission');
              return true;
            }
          }
          
          // Check for general leads permission (backward compatibility)
          const leadsPermission = user.role.permissions.find(p => p.page === 'leads' || p.page === 'Leads');
          if (leadsPermission && leadsPermission.actions) {
            const actions = Array.isArray(leadsPermission.actions) ? 
              leadsPermission.actions : [leadsPermission.actions];
            
            const hasDownload = actions.includes('download_obligation') || actions.includes('download');
            if (hasDownload) {
              console.log('✅ User has DOWNLOAD permission (unified format)');
              return true;
            }
          }
        }
      }
      
      console.log('❌ User does NOT have DOWNLOAD OBLIGATION permission');
      return false;
    } catch (error) {
      console.error('❌ Error checking download obligation permission:', error);
      return false;
    }
  };

  // Helper function to check if a product is a credit card
  const isCreditCard = (product) => {
    return product === 'CC (Credit Card)' || 
           product === 'CC (CREDIT CARD)' || 
           product === 'CC' ||
           (product && typeof product === 'string' && product.toLowerCase() === 'cc (credit card)');
  };

  // Helper function for AND-based company name matching
  const matchesAllWords = (companyName, searchQuery) => {
    if (!companyName || !searchQuery) return false;
    
    // Split search query into tokens, trim spaces, and filter out empty strings
    const searchTokens = searchQuery
      .toLowerCase()
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length > 0);
    
    // If no valid tokens, return false
    if (searchTokens.length === 0) return false;
    
    // Convert company name to lowercase for case-insensitive matching
    const lowerCompanyName = companyName.toLowerCase();
    
    // Check if ALL tokens are found in the company name
    return searchTokens.every(token => lowerCompanyName.includes(token));
  };

  // Helper function to calculate relevance score for sorting
  const calculateRelevanceScore = (companyName, searchQuery) => {
    if (!companyName || !searchQuery) return 0;
    
    const lowerCompanyName = companyName.toLowerCase();
    const lowerSearchQuery = searchQuery.toLowerCase().trim();
    const searchTokens = lowerSearchQuery
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length > 0);
    
    let score = 0;
    
    // Exact match gets highest score
    if (lowerCompanyName === lowerSearchQuery) {
      score += 1000;
    }
    
    // Starts with search query gets high score
    if (lowerCompanyName.startsWith(lowerSearchQuery)) {
      score += 500;
    }
    
    // Contains exact search query gets medium-high score
    if (lowerCompanyName.includes(lowerSearchQuery)) {
      score += 300;
    }
    
    // Score based on token matching
    searchTokens.forEach(token => {
      // Exact word match (word boundaries)
      const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
      if (wordRegex.test(companyName)) {
        score += 100;
      }
      
      // Starts with token
      if (lowerCompanyName.startsWith(token)) {
        score += 50;
      }
      
      // Contains token
      if (lowerCompanyName.includes(token)) {
        score += 20;
      }
    });
    
    // Bonus for shorter names (more specific matches)
    if (companyName.length < 30) {
      score += 10;
    }
    
    // Penalty for very long names
    if (companyName.length > 50) {
      score -= 5;
    }
    
    return score;
  };

  // Load saved obligation data from API when component mounts
  useEffect(() => {
    const fetchObligationData = async () => {
      // Only fetch if we have a different lead or haven't loaded data yet
      const currentLeadId = leadData?._id;
      if (currentLeadId && currentLeadId !== lastLoadedLeadId) {
        setIsInitialLoad(true); // Mark as initial load when loading new lead data
        setHasUserInteraction(false); // Reset user interaction flag for new lead
        
        // Prevent aggressive component resets during file_sent_to_login scenarios
        console.log('🔍 DATA LOAD CONTEXT:', {
          leadId: currentLeadId,
          file_sent_to_login: leadData?.file_sent_to_login,
          lastLoadedLeadId: lastLoadedLeadId,
          dataLoaded: dataLoaded
        });
        
        try {
          const userId = getUserId();
          if (!userId) {
            console.warn('No user ID available');
            return;
          }
          
          setLastLoadedLeadId(currentLeadId);
          
          // Determine if this is a login lead by checking for original_lead_id
          const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
          const apiUrl = isLoginLead
            ? `${API_BASE_URL}/lead-login/login-leads/${currentLeadId}/obligations?user_id=${userId}`
            : `${API_BASE_URL}/leads/${currentLeadId}/obligations?user_id=${userId}`;
          
          console.log(`📡 ObligationSection: Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint for GET`);

          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const apiResponse = await response.json();
          setSavedData(apiResponse); // Store in state for monitoring
          const savedData = apiResponse; // Keep local variable for backward compatibility
          
          // � IMMEDIATE LOAN REQUIRED DEBUG - Check what API returned
          console.log('🔍 ==================== LOAN REQUIRED API CHECK ====================');
          console.log('API Response loanRequired fields:', {
            'savedData.loanRequired': savedData?.loanRequired,
            'savedData.loan_required': savedData?.loan_required,
            'savedData.loan_amount': savedData?.loan_amount,
            'savedData.dynamic_fields': savedData?.dynamic_fields ? 'EXISTS' : 'NULL',
            'savedData.dynamic_fields.loanRequired': savedData?.dynamic_fields?.loanRequired,
            'savedData.dynamic_fields.loan_required': savedData?.dynamic_fields?.loan_required,
            'savedData.dynamic_fields.financial_details': savedData?.dynamic_fields?.financial_details ? 'EXISTS' : 'NULL',
            'savedData.dynamic_fields.financial_details.loanRequired': savedData?.dynamic_fields?.financial_details?.loanRequired,
            'savedData.dynamic_fields.financial_details.loan_required': savedData?.dynamic_fields?.financial_details?.loan_required,
            'savedData.dynamic_details': savedData?.dynamic_details ? 'EXISTS' : 'NULL',
            'savedData.dynamic_details.financial_details.loanRequired': savedData?.dynamic_details?.financial_details?.loanRequired,
          });
          console.log('Full savedData keys:', Object.keys(savedData || {}));
          if (savedData?.dynamic_fields) {
            console.log('dynamic_fields keys:', Object.keys(savedData.dynamic_fields));
          }
          console.log('==================================================================');
          
          // �🚨 COMPREHENSIVE BACKEND DATA ANALYSIS - LOGIN TRANSFER DEBUG
          console.log('🚨 ==========================================');
          console.log('🚨 ENHANCED API RESPONSE DEBUGGING');
          console.log('🚨 ==========================================');
          console.log('🚨 Lead Info:', {
            leadId: leadData?._id,
            leadName: leadData?.name || leadData?.customer_name || 'Unknown',
            file_sent_to_login: leadData?.file_sent_to_login,
            lead_status: leadData?.status,
            created_at: leadData?.created_at,
            updated_at: leadData?.updated_at
          });

          // Check if this is the Gunjan Sharma lead specifically
          const isGunjanLead = (leadData?.name || '').toLowerCase().includes('gunjan') || 
                              (leadData?.customer_name || '').toLowerCase().includes('gunjan');
          
          // 🎯 LEAD CREATION DATA LOSS ANALYSIS
          const isLeadFromCreation = leadData?.source === 'create_lead' || 
                                   leadData?.created_from === 'lead_creation' ||
                                   leadData?.lead_source === 'create_lead' ||
                                   !leadData?.file_sent_to_login; // New leads haven't been sent yet
          
          const isLoginTransferLead = leadData?.file_sent_to_login === true;

          if (isGunjanLead) {
            console.log('🎯 GUNJAN SHARMA LEAD DETECTED - DETAILED ANALYSIS');
            console.log('🎯 ===============================================');
          }
          
          if (isLeadFromCreation || isLoginTransferLead) {
            console.log('🎯 LEAD CREATION → LOGIN DATA LOSS ANALYSIS');
            console.log('🎯 ================================================');
            console.log('🎯 Lead Classification:', {
              isFromCreation: isLeadFromCreation,
              isLoginTransfer: isLoginTransferLead,
              leadSource: leadData?.source || leadData?.created_from || leadData?.lead_source,
              file_sent_to_login: leadData?.file_sent_to_login,
              created_at: leadData?.created_at,
              updated_at: leadData?.updated_at
            });
          }

          console.log('🚨 API Response Analysis:', {
            apiResponseExists: !!savedData,
            apiResponseType: typeof savedData,
            apiResponseKeys: savedData ? Object.keys(savedData) : [],
            apiResponseSize: savedData ? Object.keys(savedData).length : 0,
            apiResponseEmpty: !savedData || Object.keys(savedData).length === 0,
            hasObligationData: !!(savedData?.obligation_data),
            hasDynamicFields: !!(savedData?.dynamic_fields),
            hasDynamicDetails: !!(savedData?.dynamic_details)
          });

          console.log('🚨 LeadData Structure Analysis:', {
            leadDataExists: !!leadData,
            leadDataType: typeof leadData,
            leadDataKeys: leadData ? Object.keys(leadData) : [],
            leadDataSize: leadData ? Object.keys(leadData).length : 0,
            hasDynamicFields: !!(leadData?.dynamic_fields),
            hasDynamicDetails: !!(leadData?.dynamic_details),
            hasPersonalDetails: !!(leadData?.personal_details),
            hasFinancialDetails: !!(leadData?.financial_details)
          });

          // Deep dive into dynamic_fields structure
          if (leadData?.dynamic_fields) {
            console.log('🚨 DYNAMIC_FIELDS Deep Analysis:', {
              dynamic_fields_keys: Object.keys(leadData.dynamic_fields),
              has_obligation_data: !!(leadData.dynamic_fields.obligation_data),
              has_financial_details: !!(leadData.dynamic_fields.financial_details),
              has_personal_details: !!(leadData.dynamic_fields.personal_details),
              has_check_eligibility: !!(leadData.dynamic_fields.check_eligibility),
              obligation_data_content: leadData.dynamic_fields.obligation_data ? Object.keys(leadData.dynamic_fields.obligation_data) : null,
              financial_details_content: leadData.dynamic_fields.financial_details ? Object.keys(leadData.dynamic_fields.financial_details) : null
            });
          }

          // Deep dive into dynamic_details structure  
          if (leadData?.dynamic_details) {
            console.log('🚨 DYNAMIC_DETAILS Deep Analysis:', {
              dynamic_details_keys: Object.keys(leadData.dynamic_details),
              has_financial_details: !!(leadData.dynamic_details.financial_details),
              has_personal_details: !!(leadData.dynamic_details.personal_details),
              financial_details_content: leadData.dynamic_details.financial_details ? Object.keys(leadData.dynamic_details.financial_details) : null,
              personal_details_content: leadData.dynamic_details.personal_details ? Object.keys(leadData.dynamic_details.personal_details) : null
            });
          }

          // Check for critical obligation fields in ALL possible locations
          const criticalFieldsAnalysis = {
            salary_locations: {
              'leadData.salary': leadData?.salary,
              'leadData.monthly_income': leadData?.monthly_income,
              'leadData.dynamic_fields?.financial_details?.monthly_income': leadData?.dynamic_fields?.financial_details?.monthly_income,
              'leadData.dynamic_fields?.financial_details?.salary': leadData?.dynamic_fields?.financial_details?.salary,
              'leadData.dynamic_details?.financial_details?.monthly_income': leadData?.dynamic_details?.financial_details?.monthly_income,
              'leadData.dynamic_details?.financial_details?.salary': leadData?.dynamic_details?.financial_details?.salary,
              'savedData.salary': savedData?.salary,
              'savedData.monthly_income': savedData?.monthly_income
            },
            loan_required_locations: {
              'leadData.loan_required': leadData?.loan_required,
              'leadData.loan_amount': leadData?.loan_amount,
              'leadData.loanRequired': leadData?.loanRequired,
              'leadData.dynamic_fields?.financial_details?.loan_required': leadData?.dynamic_fields?.financial_details?.loan_required,
              'leadData.dynamic_details?.financial_details?.loan_required': leadData?.dynamic_details?.financial_details?.loan_required,
              'savedData.loan_required': savedData?.loan_required,
              'savedData.loanRequired': savedData?.loanRequired
            },
            company_name_locations: {
              'leadData.company_name': leadData?.company_name,
              'leadData.companyName': leadData?.companyName,
              'leadData.dynamic_fields?.personal_details?.company_name': leadData?.dynamic_fields?.personal_details?.company_name,
              'leadData.dynamic_details?.personal_details?.company_name': leadData?.dynamic_details?.personal_details?.company_name,
              'savedData.company_name': savedData?.company_name,
              'savedData.companyName': savedData?.companyName
            },
            eligibility_locations: {
              'leadData.dynamic_fields?.check_eligibility': leadData?.dynamic_fields?.check_eligibility ? Object.keys(leadData.dynamic_fields.check_eligibility) : null,
              'leadData.dynamic_fields?.eligibility': leadData?.dynamic_fields?.eligibility ? Object.keys(leadData.dynamic_fields.eligibility) : null,
              'savedData.check_eligibility': savedData?.check_eligibility ? Object.keys(savedData.check_eligibility) : null,
              'savedData.eligibility': savedData?.eligibility ? Object.keys(savedData.eligibility) : null
            }
          };

          console.log('🚨 CRITICAL FIELDS ANALYSIS:', criticalFieldsAnalysis);

          // Count how many locations have data for each field
          const fieldAvailability = {
            salary: Object.values(criticalFieldsAnalysis.salary_locations).filter(v => v !== undefined && v !== null && v !== '').length,
            loan_required: Object.values(criticalFieldsAnalysis.loan_required_locations).filter(v => v !== undefined && v !== null && v !== '').length,
            company_name: Object.values(criticalFieldsAnalysis.company_name_locations).filter(v => v !== undefined && v !== null && v !== '').length,
            eligibility: Object.values(criticalFieldsAnalysis.eligibility_locations).filter(v => v !== undefined && v !== null).length
          };

          console.log('🚨 FIELD AVAILABILITY SUMMARY:', fieldAvailability);
          
          // 🎯 LEAD CREATION DATA PERSISTENCE ANALYSIS
          if (isLeadFromCreation || isLoginTransferLead) {
            console.log('🎯 LEAD CREATION DATA PERSISTENCE DIAGNOSIS:', {
              dataLossScenario: {
                noApiData: !savedData || Object.keys(savedData).length === 0,
                noLeadFieldData: fieldAvailability.salary + fieldAvailability.loan_required + fieldAvailability.company_name === 0,
                partialDataOnly: fieldAvailability.salary + fieldAvailability.loan_required + fieldAvailability.company_name > 0 && fieldAvailability.salary + fieldAvailability.loan_required + fieldAvailability.company_name < 6
              },
              dataStorageProblems: {
                apiEndpointEmpty: !savedData || Object.keys(savedData).length === 0,
                wrongFieldNames: fieldAvailability.salary === 0 && leadData?.monthly_income,
                missingDynamicFields: !leadData?.dynamic_fields && !leadData?.dynamic_details,
                dataNotTransferred: isLoginTransferLead && fieldAvailability.salary + fieldAvailability.loan_required === 0
              },
              recommendedAction: (() => {
                if (!savedData || Object.keys(savedData).length === 0) return 'CHECK_API_ENDPOINT';
                if (fieldAvailability.salary + fieldAvailability.loan_required === 0) return 'CHECK_FIELD_NAMES';
                if (isLoginTransferLead && fieldAvailability.salary + fieldAvailability.loan_required < 2) return 'CHECK_SEND_TO_LOGIN_PROCESS';
                return 'DATA_AVAILABLE';
              })()
            });
          }

          if (isGunjanLead) {
            console.log('🎯 GUNJAN SHARMA - FINAL DIAGNOSIS:', {
              has_any_salary: fieldAvailability.salary > 0,
              has_any_loan_required: fieldAvailability.loan_required > 0,
              has_any_company_name: fieldAvailability.company_name > 0,
              has_any_eligibility: fieldAvailability.eligibility > 0,
              total_data_sources: fieldAvailability.salary + fieldAvailability.loan_required + fieldAvailability.company_name + fieldAvailability.eligibility,
              diagnosis: fieldAvailability.salary + fieldAvailability.loan_required + fieldAvailability.company_name === 0 ? 'DATA_COMPLETELY_MISSING' : 'PARTIAL_DATA_AVAILABLE'
            });
          }

          console.log('🚨 ==========================================');
          
          // 🎯 SEND TO LOGIN DATA TRANSFER VERIFICATION
          if (isLoginTransferLead) {
            console.log('🎯 SEND TO LOGIN DATA TRANSFER CHECK:', {
              transferStatus: {
                hasOriginalCreationData: !!(leadData?.dynamic_fields || leadData?.dynamic_details),
                hasApiResponse: !!(savedData && Object.keys(savedData).length > 0),
                hasAnyObligationData: !!(leadData?.salary || leadData?.monthly_income || leadData?.loan_required || savedData?.salary || savedData?.loan_required),
                dataTransferSuccess: !!(savedData && Object.keys(savedData).length > 0 && (savedData.salary || savedData.loan_required || savedData.dynamic_details || savedData.dynamic_fields))
              },
              potentialIssues: {
                apiEndpointNotFound: !savedData,
                dataNotSavedToBackend: savedData && Object.keys(savedData).length === 0,
                fieldNamesMismatch: !savedData?.salary && !savedData?.loan_required && (leadData?.salary || leadData?.loan_required),
                incompleteTransfer: savedData && Object.keys(savedData).length > 0 && !savedData.salary && !savedData.loan_required
              },
              suggestedFix: (() => {
                if (!savedData) return 'Check API endpoint for login leads';
                if (Object.keys(savedData).length === 0) return 'Data not saved to backend during send-to-login';
                if (!savedData.salary && !savedData.loan_required) return 'Field names mismatch between creation and retrieval';
                return 'No issues detected';
              })()
            });
          }

          // The backend returns data at root level, not wrapped in 'data' or 'obligation_data'
          let obligationData = null;
          
          // PRIORITY 1: Check if data is at the root level (current backend response format)
          if (savedData && typeof savedData === 'object' && Object.keys(savedData).length > 0) {
            // Check if it has ANY expected obligation fields
            const hasObligationFields = savedData.salary || 
                                       savedData.partnerSalary || 
                                       savedData.obligations || 
                                       savedData.companyName || 
                                       savedData.loanRequired ||
                                       savedData.cibilScore ||
                                       savedData.yearlyBonus;
            
            if (hasObligationFields) {
              obligationData = savedData;
              console.log('✅ Found data at root level (backend response format)');
              console.log('✅ Obligation fields found:', {
                salary: savedData.salary,
                partnerSalary: savedData.partnerSalary,
                obligations: savedData.obligations?.length || 0,
                companyName: savedData.companyName
              });
            }
          }
          
          // PRIORITY 2: Check if data is wrapped in a 'data' key (legacy format)
          if (!obligationData && savedData?.data && typeof savedData.data === 'object') {
            obligationData = savedData.data;
            console.log('✅ Found data in savedData.data (legacy format)');
          }
          
          // PRIORITY 3: Check if data is wrapped in 'obligation_data' key (alternative legacy format)
          if (!obligationData && savedData?.obligation_data && typeof savedData.obligation_data === 'object') {
            obligationData = savedData.obligation_data;
            console.log('✅ Found data in savedData.obligation_data (alternative legacy format)');
          }
          
          console.log('🔍 Final extracted obligationData:', obligationData);
          console.log('🔍 Obligation data keys:', obligationData ? Object.keys(obligationData) : 'null');
          
          // DEBUG: Comprehensive data structure analysis for ALL leads (not just login leads)
          console.log('🔍 UNIVERSAL LEAD DEBUGGING - Full data structure analysis:');
          console.log('📋 Lead Info:', {
            leadId: leadData?._id,
            file_sent_to_login: leadData?.file_sent_to_login,
            lead_type: leadData?.lead_type || 'unknown'
          });
          
          console.log('📋 Raw savedData structure:', {
            keys: savedData ? Object.keys(savedData) : [],
            hasObligationData: !!savedData?.obligation_data,
            hasDynamicFields: !!savedData?.dynamic_fields,
            hasDynamicDetails: !!savedData?.dynamic_details,
            hasPersonalDetails: !!savedData?.personal_details,
            hasFinancialDetails: !!savedData?.financial_details,
            dataSize: savedData ? Object.keys(savedData).length : 0
          });
          
          console.log('📋 leadData structure:', {
            keys: leadData ? Object.keys(leadData) : [],
            hasDynamicFields: !!leadData?.dynamic_fields,
            hasDynamicDetails: !!leadData?.dynamic_details,
            hasPersonalDetails: !!leadData?.personal_details,
            hasFinancialDetails: !!leadData?.financial_details,
            dynamicFieldsKeys: leadData?.dynamic_fields ? Object.keys(leadData.dynamic_fields) : [],
            dynamicDetailsKeys: leadData?.dynamic_details ? Object.keys(leadData.dynamic_details) : []
          });
          
          // Check all possible data locations for key fields
          console.log('💰 COMPREHENSIVE FIELD ANALYSIS:', {
            // Loan Required paths
            loan_required_paths: {
              'savedData.loan_required': savedData?.loan_required,
              'savedData.loanRequired': savedData?.loanRequired,
              'savedData.loan_amount': savedData?.loan_amount,
              'savedData.dynamic_details?.financial_details?.loan_required': savedData?.dynamic_details?.financial_details?.loan_required,
              'savedData.dynamic_fields?.financial_details?.loan_required': savedData?.dynamic_fields?.financial_details?.loan_required,
              'savedData.dynamic_fields?.loan_required': savedData?.dynamic_fields?.loan_required,
              'leadData.dynamic_details?.financial_details?.loan_required': leadData?.dynamic_details?.financial_details?.loan_required,
              'leadData.dynamic_fields?.financial_details?.loan_required': leadData?.dynamic_fields?.financial_details?.loan_required,
              'leadData.dynamic_fields?.loan_required': leadData?.dynamic_fields?.loan_required,
              'leadData.loan_amount': leadData?.loan_amount,
              'leadData.loanRequired': leadData?.loanRequired
            },
            
            // Salary paths
            salary_paths: {
              'savedData.salary': savedData?.salary,
              'savedData.monthly_income': savedData?.monthly_income,
              'savedData.dynamic_details?.financial_details?.monthly_income': savedData?.dynamic_details?.financial_details?.monthly_income,
              'savedData.dynamic_fields?.financial_details?.monthly_income': savedData?.dynamic_fields?.financial_details?.monthly_income,
              'leadData.dynamic_details?.financial_details?.monthly_income': leadData?.dynamic_details?.financial_details?.monthly_income,
              'leadData.dynamic_fields?.financial_details?.monthly_income': leadData?.dynamic_fields?.financial_details?.monthly_income
            },
            
            // Company Name paths
            company_name_paths: {
              'savedData.company_name': savedData?.company_name,
              'savedData.companyName': savedData?.companyName,
              'savedData.dynamic_details?.personal_details?.company_name': savedData?.dynamic_details?.personal_details?.company_name,
              'savedData.dynamic_fields?.personal_details?.company_name': savedData?.dynamic_fields?.personal_details?.company_name,
              'leadData.dynamic_details?.personal_details?.company_name': leadData?.dynamic_details?.personal_details?.company_name,
              'leadData.dynamic_fields?.personal_details?.company_name': leadData?.dynamic_fields?.personal_details?.company_name
            }
          });
          
          // Process the data if found
          if (obligationData && Object.keys(obligationData).length > 0) {
            console.log('✅ Processing API data with', Object.keys(obligationData).length, 'fields');
            processObligationData(obligationData);
            setDataLoaded(true);
            
            // 💾 ENHANCED DATA BACKUP SYSTEM - Save processed data for recovery
            try {
              const backupData = {
                leadId: leadData?._id,
                timestamp: Date.now(),
                source: 'API_RESPONSE',
                data: obligationData,
                rawApiResponse: savedData,
                leadDataSnapshot: {
                  dynamic_fields: leadData?.dynamic_fields,
                  dynamic_details: leadData?.dynamic_details,
                  file_sent_to_login: leadData?.file_sent_to_login
                }
              };
              localStorage.setItem(`obligationBackup_${leadData?._id}`, JSON.stringify(backupData));
              console.log('💾 Data backup saved successfully for recovery');
            } catch (e) {
              console.warn('⚠️ Failed to save data backup:', e);
            }
            
            // Mark data as stable for file_sent_to_login scenarios
            if (leadData?.file_sent_to_login) {
              setTimeout(() => {
                setDataStableForFileSentToLogin(true);
                console.log('🔒 FILE_SENT_TO_LOGIN: Data marked as stable');
              }, 200);
            }
          } else {
            // 🔄 ENHANCED RECOVERY MECHANISMS FOR LOGIN TRANSFERS
            console.log('⚠️ No data from API, initiating comprehensive recovery strategies...');
            
            // 🎯 ENHANCED RECOVERY FOR LEAD CREATION → LOGIN DATA LOSS
            if ((leadData?.file_sent_to_login || isLeadFromCreation) && (!obligationData || Object.keys(obligationData).length === 0)) {
              console.log('🔄 LEAD CREATION → LOGIN RECOVERY - No API data found, attempting comprehensive recovery...');
              
              // Try multiple recovery strategies for both login transfers AND lead creation data loss
              const recoveryStrategies = [
                {
                  name: 'Dynamic Fields Obligation Data',
                  data: leadData?.dynamic_fields?.obligation_data
                },
                {
                  name: 'Dynamic Details Root',
                  data: leadData?.dynamic_details
                },
                {
                  name: 'Dynamic Fields Root', 
                  data: leadData?.dynamic_fields
                },
                {
                  name: 'Lead Root Data (Direct Fields)',
                  data: (() => {
                    // Extract direct fields from lead data for lead creation scenarios
                    const directFields = {};
                    if (leadData?.salary || leadData?.monthly_income) directFields.salary = leadData.salary || leadData.monthly_income;
                    if (leadData?.loan_required || leadData?.loan_amount || leadData?.loanRequired) directFields.loan_required = leadData.loan_required || leadData.loan_amount || leadData.loanRequired;
                    if (leadData?.company_name || leadData?.companyName) directFields.company_name = leadData.company_name || leadData.companyName;
                    if (leadData?.cibil_score || leadData?.cibilScore) directFields.cibil_score = leadData.cibil_score || leadData.cibilScore;
                    return Object.keys(directFields).length > 0 ? directFields : null;
                  })()
                },
                {
                  name: 'Lead Form Data (Alternative Fields)',
                  data: (() => {
                    // Check for alternative field names used in lead creation forms
                    const formFields = {};
                    if (leadData?.income || leadData?.monthly_salary) formFields.salary = leadData.income || leadData.monthly_salary;
                    if (leadData?.required_loan || leadData?.loan_amt) formFields.loan_required = leadData.required_loan || leadData.loan_amt;
                    if (leadData?.employer || leadData?.company) formFields.company_name = leadData.employer || leadData.company;
                    return Object.keys(formFields).length > 0 ? formFields : null;
                  })()
                },
                {
                  name: 'Local Storage Backup',
                  data: (() => {
                    try {
                      const stored = localStorage.getItem(`obligationBackup_${leadData?._id}`);
                      return stored ? JSON.parse(stored) : null;
                    } catch (e) {
                      return null;
                    }
                  })()
                }
              ];
              
              let recoveredData = null;
              
              for (const strategy of recoveryStrategies) {
                if (strategy.data && typeof strategy.data === 'object' && Object.keys(strategy.data).length > 0) {
                  // Check if this data source has relevant obligation fields
                  const hasRelevantFields = strategy.data.salary || 
                                           strategy.data.monthly_income ||
                                           strategy.data.loan_required ||
                                           strategy.data.loan_amount ||
                                           strategy.data.company_name ||
                                           strategy.data.companyName ||
                                           strategy.data.financial_details ||
                                           strategy.data.personal_details ||
                                           strategy.data.check_eligibility ||
                                           strategy.data.eligibility ||
                                           strategy.data.obligations;
                  
                  if (hasRelevantFields) {
                    console.log(`✅ LOGIN TRANSFER RECOVERY: Using ${strategy.name}`);
                    console.log(`✅ Recovery data keys:`, Object.keys(strategy.data));
                    console.log(`✅ Recovery data sample:`, {
                      salary: strategy.data.salary || strategy.data.monthly_income,
                      loan_required: strategy.data.loan_required || strategy.data.loan_amount,
                      company_name: strategy.data.company_name || strategy.data.companyName
                    });
                    
                    recoveredData = strategy.data;
                    break;
                  }
                }
              }
              
              if (recoveredData) {
                console.log('🔄 Processing recovered data for login transfer...');
                processObligationData(recoveredData);
                setDataLoaded(true);
              } else {
                console.error('❌ LOGIN TRANSFER: No recoverable data found in any strategy');
              }
            }
            
            // Enhanced fallback for login leads - try multiple data sources
            console.log('⚠️ Checking additional comprehensive fallback sources...');
            
            // For login leads, try more comprehensive fallback sources
            let fallbackSources = [];
            
            if (leadData?.file_sent_to_login) {
              // Login leads - check all possible data locations
              fallbackSources = [
                leadData?.dynamic_details,  // Primary new structure
                leadData?.dynamic_fields?.obligation_data,  // Nested obligation data
                leadData?.dynamic_fields,  // Root dynamic fields
                leadData,  // Direct lead data (some fields might be at root)
                loadSavedObligationData()  // Local storage backup
              ];
              console.log('🔍 LOGIN LEAD FALLBACK: Checking', fallbackSources.length, 'potential data sources');
            } else {
              // Regular leads - standard fallback
              fallbackSources = [
                leadData?.dynamic_fields?.obligation_data,
                leadData?.dynamic_fields,
                loadSavedObligationData()
              ];
              console.log('🔍 REGULAR LEAD FALLBACK: Checking', fallbackSources.length, 'potential data sources');
            }
            
            let foundData = null;
            for (let i = 0; i < fallbackSources.length; i++) {
              const source = fallbackSources[i];
              if (source && typeof source === 'object' && Object.keys(source).length > 0) {
                // Check if this source has any obligation-relevant fields
                const hasRelevantFields = source.salary || 
                                         source.partnerSalary || 
                                         source.obligations || 
                                         source.companyName || 
                                         source.company_name ||
                                         source.loanRequired ||
                                         source.loan_required ||
                                         source.loan_amount ||
                                         source.cibilScore ||
                                         source.cibil_score ||
                                         source.financial_details ||
                                         source.personal_details ||
                                         source.obligation_data ||
                                         source.dynamic_details ||
                                         source.dynamic_fields;
                
                if (hasRelevantFields) {
                  console.log(`✅ Found relevant data in fallback source ${i + 1}:`, {
                    sourceKeys: Object.keys(source),
                    hasFinancialDetails: !!source.financial_details,
                    hasPersonalDetails: !!source.personal_details,
                    hasDynamicDetails: !!source.dynamic_details,
                    hasDynamicFields: !!source.dynamic_fields
                  });
                  foundData = source;
                  break;
                }
              }
            }
            
            if (foundData) {
              console.log('✅ Using fallback data source');
              processObligationData(foundData);
              setDataLoaded(true);
              
              // Mark data as stable for file_sent_to_login scenarios
              if (leadData?.file_sent_to_login) {
                setTimeout(() => {
                  setDataStableForFileSentToLogin(true);
                  console.log('🔒 FILE_SENT_TO_LOGIN: Fallback data marked as stable');
                }, 200);
              }
            } else {
              console.warn('⚠️ No obligation data available from any fallback source');
              setDataLoaded(true);
            }
          }
        } catch (error) {
          console.error('❌ Error fetching obligation data:', error);
          setSavedData(null); // Clear savedData state on error
          console.log('🔄 Attempting fallback to leadData.dynamic_fields...');
          
          // Comprehensive fallback to local data if API call fails
          const localData = 
            leadData?.dynamic_fields?.obligation_data || 
            leadData?.dynamic_fields || 
            loadSavedObligationData();
          
          console.log('🔍 Fallback data source:', localData);
          console.log('🔍 Fallback data keys:', localData ? Object.keys(localData) : 'null');
          
          if (localData && Object.keys(localData).length > 0) {
            // Check if this fallback data has relevant fields
            const hasRelevantFields = localData.salary || 
                                     localData.partnerSalary || 
                                     localData.obligations || 
                                     localData.companyName || 
                                     localData.loanRequired ||
                                     localData.cibilScore ||
                                     localData.financial_details ||
                                     localData.obligation_data;
            
            if (hasRelevantFields) {
              console.log('✅ Using fallback data after API error');
              processObligationData(localData);
              setDataLoaded(true);
            } else {
              console.warn('⚠️ Fallback data found but no relevant obligation fields');
              setDataLoaded(true);
            }
          } else {
            console.warn('⚠️ No fallback data available');
            setDataLoaded(true);
          }
        }
      } else if (!dataLoaded && !currentLeadId) {
        // No lead ID, load from local storage only if we haven't loaded data yet
        const localData = loadSavedObligationData();
        if (localData && Object.keys(localData).length > 0) {
          processObligationData(localData);
          setDataLoaded(true);
        }
      }
    };
    
    // Helper function to process obligation data and update state
    const processObligationData = (savedData) => {
      if (!savedData || Object.keys(savedData).length === 0) {
        console.warn('⚠️ processObligationData called with empty data');
        return;
      }
      
      console.log('🔄 ========================================');
      console.log('🔄 PROCESSING OBLIGATION DATA');
      console.log('🔄 ========================================');
      console.log('🔄 Full savedData:', JSON.stringify(savedData, null, 2));
      console.log('🔄 savedData keys:', Object.keys(savedData));
      console.log('🔄 ========================================');
      
      // Enhanced field extraction helper - checks multiple possible paths
      const getFieldValue = (fieldConfigs) => {
        for (const config of fieldConfigs) {
          let value = savedData;
          const path = config.split('.');
          
          for (const key of path) {
            if (value && typeof value === 'object' && key in value) {
              value = value[key];
            } else {
              value = undefined;
              break;
            }
          }
          
          if (value !== undefined && value !== null && value !== '') {
            return value;
          }
        }
        return null;
      };
      
      // Capture current obligations for ID preservation
      const currentObligations = [...obligations];
      console.log('🔍 Current obligations before reload:', currentObligations.map(o => ({ id: o.id, action: o.action, product: o.product })));
      
      // **Enhanced field extraction with leadData fallback**      // Enhanced field extraction helper that comprehensively checks both savedData and leadData
      const getFieldValueEnhanced = (fieldConfigs) => {
        // First try getting from savedData
        const savedResult = getFieldValue(fieldConfigs);
        if (savedResult !== null && savedResult !== undefined && savedResult !== '') {
          return savedResult;
        }
        
        // If not found in savedData, try leadData with the same field configurations
        for (const config of fieldConfigs) {
          let value = leadData;
          const path = config.split('.');
          
          for (const key of path) {
            if (value && typeof value === 'object' && key in value) {
              value = value[key];
            } else {
              value = undefined;
              break;
            }
          }
          
          if (value !== undefined && value !== null && value !== '') {
            return value;
          }
        }
        
        // If still not found and this is a login lead, try some additional common paths
        if (leadData?.file_sent_to_login) {
          // Additional paths specific to login leads
          const additionalPaths = [
            // Check if field name appears anywhere in the lead data structure
            ...Object.keys(leadData || {}).filter(key => 
              fieldConfigs.some(config => config.includes(key.toLowerCase()) || key.toLowerCase().includes(config.split('.').pop()?.toLowerCase()))
            ).map(key => key),
            
            // Check nested structures that might contain the field
            ...(leadData?.form_data ? Object.keys(leadData.form_data) : []).map(key => `form_data.${key}`),
            ...(leadData?.application_data ? Object.keys(leadData.application_data) : []).map(key => `application_data.${key}`)
          ];
          
          for (const path of additionalPaths) {
            let value = leadData;
            const pathParts = path.split('.');
            
            for (const part of pathParts) {
              if (value && typeof value === 'object' && part in value) {
                value = value[part];
              } else {
                value = undefined;
                break;
              }
            }
            
            if (value !== undefined && value !== null && value !== '') {
              return value;
            }
          }
        }
        
        return null;
      };
      
      // Enhanced field extraction with comprehensive paths for login leads AND lead creation
      const extractedSalary = getFieldValueEnhanced([
        // Primary dynamic_details paths
        'dynamic_details.financial_details.monthly_income',
        'dynamic_details.financial_details.salary',
        'dynamic_details.personal_details.salary',
        'dynamic_details.salary',
        
        // Direct backend fields
        'salary', 
        'monthly_income',
        
        // 🎯 LEAD CREATION SPECIFIC SALARY PATHS
        'income',              // Common in lead forms
        'monthly_salary',      // Descriptive field
        'gross_salary',        // Gross income field
        'net_salary',         // Net income field
        'annual_income',      // Yearly income (needs conversion)
        'employee_income',    // Employee-specific
        'take_home',         // Take-home salary
        'current_income',    // Current income field
        
        // Dynamic_fields paths (fallback for older structure)
        'dynamic_fields.financial_details.monthly_income',
        'dynamic_fields.financial_details.salary',
        'dynamic_fields.financial_details.income',           // Lead creation
        'dynamic_fields.financial_details.monthly_salary',   // Lead creation
        'financial_details.monthly_income',
        'financial_details.salary',
        'financial_details.income',                          // Lead creation
        'dynamic_fields.personal_details.salary', 
        'personal_details.salary',
        'personal_details.income',                           // Lead creation
        
        // 🎯 CREATE LEAD FORM SALARY PATHS
        'dynamic_fields.create_lead.salary',
        'dynamic_fields.create_lead.monthly_income',
        'dynamic_fields.create_lead.income',
        'dynamic_fields.lead_form.salary',
        'dynamic_fields.lead_form.monthly_income',
        'dynamic_fields.application.salary',
        
        // Form and process paths
        'dynamic_fields.obligation_data.salary',
        'dynamic_fields.login_form.salary',
        'obligation_data.salary',
        
        // Additional paths for different data structures
        'data.salary',
        'data.monthly_income'
      ]);
      
      const extractedPartnerSalary = getFieldValueEnhanced([
        'dynamic_details.financial_details.partner_salary',  // Primary path: dynamic_details
        'partnerSalary', 
        'partner_salary', 
        'dynamic_fields.financial_details.partner_salary',  // Fallback
        'financial_details.partner_salary',
        'dynamic_fields.login_form.partner_salary'
      ]);
      
      const extractedYearlyBonus = getFieldValueEnhanced([
        'dynamic_details.financial_details.yearly_bonus',  // Primary path: dynamic_details
        'yearlyBonus', 
        'yearly_bonus', 
        'dynamic_fields.financial_details.yearly_bonus',  // Fallback
        'financial_details.yearly_bonus',
        'dynamic_fields.login_form.yearly_bonus'
      ]);
      
      const extractedBonusDivision = getFieldValueEnhanced([
        'dynamic_details.financial_details.bonus_division',  // Primary path: dynamic_details
        'bonusDivision', 
        'bonus_division', 
        'dynamic_fields.financial_details.bonus_division',  // Fallback
        'financial_details.bonus_division',
        'dynamic_fields.login_form.bonus_division'
      ]);
      
      const extractedLoanRequired = getFieldValueEnhanced([
        // Direct backend fields - prioritize loanRequired (camelCase)
        'loanRequired',        // Primary backend field name (camelCase)
        'loan_required',       // Alternative snake_case
        'loan_amount',
        
        // Dynamic_fields root level (where backend GET expects it)
        'dynamic_fields.loanRequired',
        'dynamic_fields.loan_required',
        'dynamic_fields.loan_amount',
        
        // Primary dynamic_details paths
        'dynamic_details.financial_details.loanRequired',
        'dynamic_details.financial_details.loan_required',
        'dynamic_details.financial_details.loan_amount',
        'dynamic_details.loanRequired',
        'dynamic_details.loan_required',
        'dynamic_details.loan_amount',
        
        // 🎯 LEAD CREATION SPECIFIC PATHS
        'required_loan',        // Common in lead creation forms
        'loan_amt',            // Alternative short name
        'amount_required',     // General amount field
        'loan_requirement',    // Descriptive field name
        'finance_required',    // Alternative finance field
        'credit_amount',       // Credit application field
        'requested_amount',    // Request-based field
        
        // Dynamic_fields paths (fallback for older structure)
        'dynamic_fields.financial_details.loan_required',
        'dynamic_fields.financial_details.loan_amount',
        'dynamic_fields.financial_details.loanRequired',
        'dynamic_fields.financial_details.required_loan',    // Lead creation
        'dynamic_fields.financial_details.loan_amt',         // Lead creation
        'financial_details.loan_required',
        'financial_details.loan_amount',
        'financial_details.required_loan',                   // Lead creation
        
        // Process and form paths
        'dynamic_fields.process.loan_amount_required',
        'dynamic_fields.process.loan_required',
        'dynamic_fields.login_form.loan_amount',
        'dynamic_fields.login_form.loan_required',
        'dynamic_fields.loan_required',
        'dynamic_fields.loan_amount',
        
        // 🎯 CREATE LEAD FORM PATHS
        'dynamic_fields.create_lead.loan_required',
        'dynamic_fields.create_lead.loan_amount',
        'dynamic_fields.create_lead.required_loan',
        'dynamic_fields.lead_form.loan_required',
        'dynamic_fields.lead_form.loan_amount',
        'dynamic_fields.application.loan_required',
        
        // Nested obligation data paths
        'dynamic_fields.obligation_data.loan_required',
        'dynamic_fields.obligation_data.loan_amount',
        'obligation_data.loan_required',
        'obligation_data.loan_amount',
        
        // Additional potential paths for login leads
        'dynamic_fields.personal_details.loan_required',
        'dynamic_fields.personal_details.loan_amount',
        'personal_details.loan_required',
        'personal_details.loan_amount',
        
        // Legacy paths
        'data.loan_required',
        'data.loan_amount'
      ]);
      
      // Enhanced loan required extraction debugging - always log for troubleshooting
      console.log('💰 DETAILED LOAN REQUIRED EXTRACTION:', {
        extractedValue: extractedLoanRequired,
        hasExtractedData: !!extractedLoanRequired,
        rawDataInspection: {
          'leadData.loanRequired': leadData?.loanRequired,
          'leadData.loan_required': leadData?.loan_required,
          'leadData.loan_amount': leadData?.loan_amount,
          'leadData.dynamic_details': leadData?.dynamic_details,
          'leadData.dynamic_fields': leadData?.dynamic_fields,
          'leadData.dynamic_fields.loanRequired': leadData?.dynamic_fields?.loanRequired,
          'leadData.dynamic_fields.financial_details': leadData?.dynamic_fields?.financial_details,
          'leadData.dynamic_fields.financial_details.loanRequired': leadData?.dynamic_fields?.financial_details?.loanRequired,
          'savedData.loanRequired': savedData?.loanRequired,
          'savedData.loan_required': savedData?.loan_required,
          'savedData.loan_amount': savedData?.loan_amount,
          'savedData.dynamic_fields': savedData?.dynamic_fields,
          'savedData.dynamic_fields.loanRequired': savedData?.dynamic_fields?.loanRequired,
          'savedData.dynamic_fields.financial_details.loanRequired': savedData?.dynamic_fields?.financial_details?.loanRequired,
        },
        dataSourceKeys: savedData ? Object.keys(savedData) : [],
        leadDataKeys: leadData ? Object.keys(leadData) : [],
        leadId: leadData?._id,
        file_sent_to_login: leadData?.file_sent_to_login,
        searchedPaths: [
          'loanRequired',
          'loan_required',
          'dynamic_details.financial_details.loanRequired',
          'loan_amount',
          'dynamic_fields.financial_details.loan_required'
        ],
        timestamp: new Date().toLocaleTimeString()
      });
      
      const extractedCompanyName = getFieldValueEnhanced([
        // Primary dynamic_details paths
        'dynamic_details.personal_details.company_name',
        'dynamic_details.company_name',
        'dynamic_details.financial_details.company_name',
        
        // Direct backend fields
        'companyName', 
        'company_name',
        'customer_name',
        
        // 🎯 LEAD CREATION SPECIFIC COMPANY PATHS
        'employer',            // Common in lead forms
        'company',            // Short company field
        'employer_name',      // Full employer name
        'organization',       // Organization field
        'workplace',          // Workplace field
        'office',            // Office field
        'firm',              // Firm name
        'business',          // Business name
        'corporation',       // Corporate name
        
        // Dynamic_fields paths (fallback)
        'dynamic_fields.personal_details.company_name',
        'dynamic_fields.personal_details.employer',         // Lead creation
        'dynamic_fields.personal_details.company',          // Lead creation
        'personal_details.company_name',
        'personal_details.employer',                        // Lead creation
        'dynamic_fields.company_name', 
        'dynamic_fields.employer',                          // Lead creation
        'dynamic_fields.financial_details.company_name',
        
        // 🎯 CREATE LEAD FORM COMPANY PATHS
        'dynamic_fields.create_lead.company_name',
        'dynamic_fields.create_lead.employer',
        'dynamic_fields.lead_form.company_name',
        'dynamic_fields.lead_form.employer',
        'dynamic_fields.application.company_name',
        
        // Form and obligation paths
        'dynamic_fields.obligation_data.companyName',
        'dynamic_fields.obligation_data.company_name',
        'dynamic_fields.login_form.company_name',
        'obligation_data.companyName',
        'obligation_data.company_name',
        
        // Additional potential paths for login leads
        'dynamic_fields.basic_details.company_name',
        'basic_details.company_name',
        'data.company_name',
        'data.companyName'
      ]);
      
      const extractedCompanyType = getFieldValueEnhanced([
        'dynamic_details.personal_details.company_type',  // Primary path: dynamic_details
        'companyType', 
        'company_type', 
        'processingBank', 
        'processing_bank', 
        'bankName', 
        'selectedBanks', 
        'dynamic_fields.personal_details.company_type',  // Fallback
        'personal_details.company_type',
        'dynamic_fields.process.processing_bank',  // Process section
        'dynamic_fields.login_form.processing_bank'
      ]);
      
      // Convert company_type to array if it's a comma-separated string (for backward compatibility)
      let normalizedCompanyType = extractedCompanyType;
      if (typeof extractedCompanyType === 'string' && extractedCompanyType.includes(',')) {
        normalizedCompanyType = extractedCompanyType.split(',').map(bank => bank.trim()).filter(Boolean);
      } else if (extractedCompanyType && !Array.isArray(extractedCompanyType)) {
        normalizedCompanyType = [extractedCompanyType];
      }
      
      const extractedCompanyCategory = getFieldValueEnhanced([
        'dynamic_details.personal_details.company_category',  // Primary path: dynamic_details
        'companyCategory', 
        'company_category', 
        'dynamic_fields.personal_details.company_category',  // Fallback
        'personal_details.company_category', 
        'dynamic_fields.company_category',
        'dynamic_fields.login_form.company_category',
        'dynamic_fields.check_eligibility.company_category'  // Check eligibility section
      ]);
      
      const extractedCibilScore = getFieldValueEnhanced([
        'dynamic_details.financial_details.cibil_score',  // Primary path: dynamic_details
        'cibilScore', 
        'cibil_score', 
        'dynamic_fields.financial_details.cibil_score',  // Fallback
        'financial_details.cibil_score',
        'dynamic_fields.login_form.cibil_score'
      ]);
      
      const extractedObligations = getFieldValueEnhanced([
        'obligations', 
        'dynamic_fields.obligations', 
        'dynamic_fields.obligation_data.obligations',
        'dynamic_fields.login_form.obligations'
      ]);
      
      const extractedTotalBtPos = getFieldValueEnhanced([
        'totalBtPos', 
        'total_bt_pos', 
        'dynamic_fields.eligibility_details.totalBtPos', 
        'dynamic_fields.eligibility_details.total_bt_pos', 
        'eligibility_details.totalBtPos', 
        'eligibility_details.total_bt_pos', 
        'eligibility.totalBtPos', 
        'eligibility.total_bt_pos',
        'dynamic_fields.check_eligibility.total_bt_pos'
      ]);
      
      const extractedTotalObligation = getFieldValueEnhanced([
        'totalObligation', 
        'total_obligation', 
        'dynamic_fields.eligibility_details.totalObligations', 
        'eligibility_details.totalObligations', 
        'eligibility.totalObligations',
        'dynamic_fields.check_eligibility.total_obligation'
      ]);
      
      // Store original data for unsaved changes detection
      const currentData = {
        salary: extractedSalary || '',
        partnerSalary: extractedPartnerSalary || '',
        yearlyBonus: extractedYearlyBonus || '',
        bonusDivision: extractedBonusDivision || null,
        loanRequired: extractedLoanRequired || '',
        companyName: extractedCompanyName || '',
        companyType: extractedCompanyType || [],
        companyCategory: extractedCompanyCategory || [],
        cibilScore: extractedCibilScore || '',
        obligations: extractedObligations || [],
        totalBtPos: extractedTotalBtPos || '0',
        totalObligation: extractedTotalObligation || '0'
      };
      setOriginalData(currentData);
      setHasUnsavedChanges(false);
      setIsInitialLoad(false); // Mark initial loading as complete
      setHasUserInteraction(false); // Reset user interaction flag when data is loaded
      
      console.log('✅ Data loading complete - hasUserInteraction reset to false');
      
      // Try to fetch bank names in the background if not already loaded
      if (!bankListLoaded) {
        fetchBankNames().then(bankNames => {
          if (Array.isArray(bankNames) && bankNames.length > 0) {
            const normalizedBankNames = bankNames.map(bank => 
              typeof bank === 'string' ? bank : (bank.name || bank.label || String(bank))
            );
            
            // Always include 'Custom' if not already in the list
            if (!normalizedBankNames.includes('Custom')) {
              normalizedBankNames.unshift('Custom');
            }
            
            setBankList(normalizedBankNames);
            setBankListLoaded(true);
          }
        }).catch(error => {
          console.error('Error fetching bank names:', error);
        });
      }
      
      // Extract and set all fields using the enhanced getter - always log for troubleshooting
      console.log('🔍 COMPLETE FIELD EXTRACTION SUMMARY:', {
        leadId: leadData?._id,
        file_sent_to_login: leadData?.file_sent_to_login,
        extractionResults: {
          salary: { extracted: extractedSalary, hasValue: !!extractedSalary },
          partnerSalary: { extracted: extractedPartnerSalary, hasValue: !!extractedPartnerSalary },
          yearlyBonus: { extracted: extractedYearlyBonus, hasValue: !!extractedYearlyBonus },
          loanRequired: { extracted: extractedLoanRequired, hasValue: !!extractedLoanRequired },
          companyName: { extracted: extractedCompanyName, hasValue: !!extractedCompanyName },
          cibilScore: { extracted: extractedCibilScore, hasValue: !!extractedCibilScore },
          companyType: { extracted: extractedCompanyType, hasValue: !!extractedCompanyType },
          companyCategory: { extracted: extractedCompanyCategory, hasValue: !!extractedCompanyCategory },
          obligationsCount: extractedObligations?.length || 0
        },
        dataSourceAnalysis: {
          savedDataSize: savedData ? Object.keys(savedData).length : 0,
          leadDataSize: leadData ? Object.keys(leadData).length : 0,
          hasSavedDataContent: savedData && Object.keys(savedData).length > 0,
          hasLeadDataContent: leadData && Object.keys(leadData).length > 0
        }
      });
      
      // Determine loading strategy - for login leads, always update with extracted data (even if empty to ensure proper clearing)
      // For other scenarios, be more conservative about preserving existing data
      const isLoginLead = leadData?.file_sent_to_login;
      const isLoadingNewLead = lastLoadedLeadId && leadData?._id !== lastLoadedLeadId;
      const shouldAlwaysUpdate = isLoginLead || isLoadingNewLead || isInitialLoad;
      
      console.log('📋 DATA UPDATE STRATEGY:', {
        isLoginLead,
        isLoadingNewLead,
        isInitialLoad,
        shouldAlwaysUpdate,
        leadId: leadData?._id,
        lastLoadedLeadId
      });
      
      // 🔄 COMPREHENSIVE STATE UPDATE LOGGING - BEFORE VALUES SET
      console.log('🔄 STATE UPDATE OPERATION - FULL ANALYSIS:', {
        leadInfo: {
          leadId: leadData?._id,
          file_sent_to_login: leadData?.file_sent_to_login,
          isLoginLead,
          shouldAlwaysUpdate
        },
        currentStateValues: {
          salary: salary,
          partnerSalary: partnerSalary,
          yearlyBonus: yearlyBonus,
          loanRequired: loanRequired,
          companyName: companyName,
          obligationsCount: obligations.length
        },
        extractedRawValues: {
          salary: extractedSalary,
          partnerSalary: extractedPartnerSalary,
          yearlyBonus: extractedYearlyBonus,
          loanRequired: extractedLoanRequired,
          companyName: extractedCompanyName,
          obligationsCount: extractedObligations?.length || 0
        }
      });

      // Set salary - always update for login leads or new leads
      const salaryValue = extractedSalary ? 
        (typeof extractedSalary === 'string' ? extractedSalary : formatINR(String(extractedSalary))) : 
        (shouldAlwaysUpdate ? '' : salary);
      if (shouldAlwaysUpdate || salaryValue !== salary) {
        console.log('💰 SALARY UPDATE:', { from: salary, to: salaryValue, shouldUpdate: shouldAlwaysUpdate || salaryValue !== salary });
        setSalary(salaryValue);
      }
      
      // Set partner salary - always update for login leads or new leads
      const partnerSalaryValue = extractedPartnerSalary ? 
        (typeof extractedPartnerSalary === 'string' ? extractedPartnerSalary : formatINR(String(extractedPartnerSalary))) : 
        (shouldAlwaysUpdate ? '' : partnerSalary);
      if (shouldAlwaysUpdate || partnerSalaryValue !== partnerSalary) {
        console.log('👥 PARTNER SALARY UPDATE:', { from: partnerSalary, to: partnerSalaryValue, shouldUpdate: shouldAlwaysUpdate || partnerSalaryValue !== partnerSalary });
        setPartnerSalary(partnerSalaryValue);
      }
      
      // Set yearly bonus - always update for login leads or new leads
      const yearlyBonusValue = extractedYearlyBonus ? 
        (typeof extractedYearlyBonus === 'string' ? extractedYearlyBonus : formatINR(String(extractedYearlyBonus))) : 
        (shouldAlwaysUpdate ? '' : yearlyBonus);
      if (shouldAlwaysUpdate || yearlyBonusValue !== yearlyBonus) setYearlyBonus(yearlyBonusValue);
      
      // Set bonus division - always update for login leads or new leads
      const bonusDivisionValue = extractedBonusDivision ? Number(extractedBonusDivision) : (shouldAlwaysUpdate ? null : bonusDivision);
      if (shouldAlwaysUpdate || bonusDivisionValue !== bonusDivision) setBonusDivision(bonusDivisionValue);
      
      // Set loan required - always update for login leads or new leads
      const loanRequiredValue = extractedLoanRequired ? 
        (typeof extractedLoanRequired === 'string' ? extractedLoanRequired : formatINR(String(extractedLoanRequired))) : 
        (shouldAlwaysUpdate ? '' : loanRequired);
      
      // Enhanced loan required logging
      if (shouldAlwaysUpdate || loanRequired !== loanRequiredValue) {
        console.log('💰 LOAN REQUIRED STATE UPDATE:', {
          from: loanRequired,
          to: loanRequiredValue,
          extracted: extractedLoanRequired,
          isLoginLead,
          shouldAlwaysUpdate,
          leadId: leadData?._id,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
      if (shouldAlwaysUpdate || loanRequiredValue !== loanRequired) setLoanRequired(loanRequiredValue);
      
      // Set company name - always update for login leads or new leads
      const companyNameValue = extractedCompanyName ? String(extractedCompanyName) : (shouldAlwaysUpdate ? '' : companyName);
      if (shouldAlwaysUpdate || companyNameValue !== companyName) {
        console.log('🏢 COMPANY NAME UPDATE:', { from: companyName, to: companyNameValue, shouldUpdate: shouldAlwaysUpdate || companyNameValue !== companyName });
        setCompanyName(companyNameValue);
      }
      
      // Set CIBIL score - always update for login leads or new leads
      const cibilScoreValue = extractedCibilScore ? String(extractedCibilScore) : (shouldAlwaysUpdate ? '' : cibilScore);
      if (shouldAlwaysUpdate || cibilScoreValue !== cibilScore) setCibilScore(cibilScoreValue);
      
      // Set company type (Processing Bank) - always update for login leads or new leads
      const companyTypeValue = normalizedCompanyType ? 
        (Array.isArray(normalizedCompanyType) ? normalizedCompanyType : [normalizedCompanyType]) : 
        (shouldAlwaysUpdate ? [] : companyType);
      if (shouldAlwaysUpdate || JSON.stringify(companyTypeValue) !== JSON.stringify(companyType)) setCompanyType(companyTypeValue);
      
      // Set company category - always update for login leads or new leads
      const companyCategoryValue = extractedCompanyCategory ? 
        (Array.isArray(extractedCompanyCategory) ? extractedCompanyCategory : [extractedCompanyCategory]) : 
        (shouldAlwaysUpdate ? [] : companyCategory);
      if (shouldAlwaysUpdate || JSON.stringify(companyCategoryValue) !== JSON.stringify(companyCategory)) setCompanyCategory(companyCategoryValue);
      
      // Handle FOIR settings - check multiple locations
      const checkEligibilityData = savedData.check_eligibility || savedData.dynamic_fields?.check_eligibility;
      const foirPercentValue = getFieldValue(['ceFoirPercent', 'foirPercent', 'check_eligibility.foir_percent', 'dynamic_fields.check_eligibility.foir_percent']);
      
      if (foirPercentValue) {
        if (foirPercentValue === 'custom') {
          setCeFoirPercent('custom');
          const customValue = getFieldValue(['ceCustomFoirPercent', 'customFoirPercent', 'check_eligibility.custom_foir_percent', 'dynamic_fields.check_eligibility.custom_foir_percent']);
          if (customValue) {
            setCeCustomFoirPercent(String(customValue));
          }
        } else {
          setCeFoirPercent(Number(foirPercentValue));
        }
      }
      
      if (extractedObligations && Array.isArray(extractedObligations) && extractedObligations.length > 0) {
        console.log('🔍 Debug saved obligations data:', extractedObligations);
        // Ensure Credit Card percentage fields are included when loading from obligations
        const processedObligations = extractedObligations.map((obl, index) => {
          console.log('🔍 Debug processing saved obligation:', {
            product: obl.product,
            bank: obl.bank_name || obl.bankName,
            totalLoan: obl.total_loan || obl.totalLoan,
            outstanding: obl.outstanding,
            emi: obl.emi,
            action: obl.action,
            fullObject: obl
          });
          
          // Try to preserve existing ID by matching obligation content
          let preservedId = null;
          const currentMatch = currentObligations.find(current => {
            // Match by key fields to preserve ID across save/reload
            const oblBankName = obl.bank_name || obl.bankName || '';
            const oblTotalLoan = obl.total_loan || obl.totalLoan || obl.loan_amount || obl.principal_amount || '0';
            const oblOutstanding = obl.outstanding || '0';
            
            return current.product === obl.product &&
                   current.bankName === oblBankName &&
                   parseFloat(current.totalLoan?.replace(/[^\d.]/g, '') || '0') === parseFloat(oblTotalLoan.toString().replace(/[^\d.]/g, '') || '0') &&
                   parseFloat(current.outstanding?.replace(/[^\d.]/g, '') || '0') === parseFloat(oblOutstanding.toString().replace(/[^\d.]/g, '') || '0');
          });
          
          if (currentMatch) {
            preservedId = currentMatch.id;
            console.log('🎯 Preserving existing ID for obligation:', preservedId, 'product:', obl.product);
          } else {
            // Generate new unique ID only if no match found
            preservedId = obl.id || `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            console.log('🆕 Generated new ID for obligation:', preservedId, 'product:', obl.product);
          }
          
          // Enhanced field mapping for obligations
          const oblBankName = obl.bank_name || obl.bankName || '';
          const oblTenure = obl.tenure;
          const oblRoi = obl.roi;
          const oblTotalLoan = obl.total_loan || obl.totalLoan || obl.loan_amount || obl.principal_amount || '';
          const oblOutstanding = obl.outstanding || '';
          const oblEmi = obl.emi || '';
          const oblAction = obl.action || 'Obligate';
          
          return {
            id: preservedId,
            product: obl.product || '',
            bankName: oblBankName,
            tenure: oblTenure && oblTenure !== 0 && oblTenure !== '0' ? 
                   (String(oblTenure).includes('Months') ? String(oblTenure) : formatTenure(String(oblTenure))) : '',
            roi: oblRoi && oblRoi !== 0 && oblRoi !== '0' ? 
                (String(oblRoi).includes('%') ? String(oblRoi) : formatROI(String(oblRoi))) : '',
            totalLoan: oblTotalLoan ? formatINR(String(oblTotalLoan)) : '',
            outstanding: oblOutstanding && oblOutstanding !== 0 && oblOutstanding !== '0' ? formatINR(String(oblOutstanding)) : '',
            emi: oblEmi && oblEmi !== 0 && oblEmi !== '0' ? formatINR(String(oblEmi)) : '',
            action: (oblAction && oblAction.trim() !== '') ? oblAction : 'Obligate',
            selectedPercentage: obl.selectedPercentage || obl.selected_percentage || null,
            selectedTenurePercentage: (obl.selectedTenurePercentage || obl.selected_tenure_percentage) ? parseInt(obl.selectedTenurePercentage || obl.selected_tenure_percentage) : null,
            selectedRoiPercentage: (obl.selectedRoiPercentage || obl.selected_roi_percentage) ? parseInt(obl.selectedRoiPercentage || obl.selected_roi_percentage) : null
          };
        });
        
        // Validate for duplicate IDs
        const ids = processedObligations.map(o => o.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          console.warn('🚨 Duplicate obligation IDs detected:', duplicateIds);
          // Re-generate IDs for duplicates
          processedObligations.forEach((obl, index) => {
            if (duplicateIds.includes(obl.id)) {
              obl.id = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            }
          });
        }
        
        console.log('🔍 Debug final processed obligations:', processedObligations);
        
        // Final verification: ensure all IDs are unique after processing
        const finalIds = processedObligations.map(o => o.id);
        const finalDuplicateIds = finalIds.filter((id, index) => finalIds.indexOf(id) !== index);
        if (finalDuplicateIds.length > 0) {
          console.warn('🚨 Final duplicate obligation IDs detected:', finalDuplicateIds);
          // Force regenerate IDs for any remaining duplicates
          processedObligations.forEach((obl, index) => {
            if (finalDuplicateIds.includes(obl.id)) {
              obl.id = `${Date.now()}-FINAL-${index}-${Math.random().toString(36).substr(2, 9)}`;
              console.log('🔄 Regenerated final ID:', obl.id);
            }
          });
        }
        
        console.log('🔍 Final processed obligations with preserved/generated IDs:', processedObligations.map(o => ({ id: o.id, action: o.action, product: o.product })));
        
        // Don't sort immediately after reload to prevent dropdown index mismatch
        console.log('📋 OBLIGATIONS UPDATE:', {
          currentCount: obligations.length,
          newCount: processedObligations.length,
          leadId: leadData?._id,
          isLoginLead,
          firstObligation: processedObligations[0] ? { 
            product: processedObligations[0].product, 
            bankName: processedObligations[0].bankName,
            emi: processedObligations[0].emi 
          } : null
        });
        setObligations(processedObligations);
        setDataLoaded(true); // Mark data as loaded after successful obligation load
        
        // React will handle re-rendering automatically when obligations change
      } else {
        // No obligations found - check if we should preserve existing data or create default
        console.log('⚠️ No obligations found in API response');
        console.log('📋 OBLIGATION LOAD DECISION:', { 
          currentCount: obligations.length, 
          hasExistingObligations: obligations.length > 0 && obligations[0].product,
          shouldPreserve: dataLoaded && obligations.length > 0,
          leadId: leadData?._id 
        });
        
        // If we already have obligations loaded and this is not the first load,
        // preserve them instead of clearing (protects against race conditions)
        if (dataLoaded && obligations.length > 0 && obligations[0].product) {
          console.log('🔒 PRESERVING existing obligations - API returned empty but data was previously loaded');
        } else {
          // Create default obligation only for truly new/empty leads
          console.log('📋 DEFAULT OBLIGATIONS UPDATE:', { currentCount: obligations.length, newCount: 1, leadId: leadData?._id });
          setObligations([{
            id: `${Date.now()}-default-${Math.random().toString(36).substr(2, 9)}`,
            product: '',
            bankName: '',
            tenure: '',
            roi: '',
            totalLoan: '',
            outstanding: '',
            emi: '',
            action: 'Obligate',
            selectedPercentage: null,
            selectedTenurePercentage: null,
            selectedRoiPercentage: null
          }]);
          setDataLoaded(true); // Mark data as loaded even for default
        }
      }
      
      // Load calculated totals with enhanced extraction
      if (extractedTotalBtPos) {
        console.log('📝 Setting total BT POS:', extractedTotalBtPos);
        setTotalBtPos(typeof extractedTotalBtPos === 'string' ? extractedTotalBtPos : formatINR(String(extractedTotalBtPos)));
      }
      
      // Enhanced eligibility data extraction for existing leads
      const eligibilityDetails = getFieldValue([
        'eligibility',
        'dynamic_fields.eligibility_details',
        'eligibility_details',
        'dynamic_fields.eligibility',
        'dynamic_fields.obligation_data.eligibility'
      ]);
      
      if (eligibilityDetails && typeof eligibilityDetails === 'object') {
        console.log('📝 Setting eligibility details:', eligibilityDetails);
        
        // Extract backend final eligibility with all possible field names
        let backendFinalElig = eligibilityDetails.finalEligibility || 
                               eligibilityDetails.final_eligibility || 
                               eligibilityDetails.foir_eligibility || 
                               eligibilityDetails.loan_eligibility_foir ||
                               '';
        
        console.log('🔍 Raw backend final eligibility value:', backendFinalElig, 'Type:', typeof backendFinalElig);
        
        // Parse numeric value if it's a number or numeric string
        let numericValue = 0;
        if (typeof backendFinalElig === 'number') {
          numericValue = backendFinalElig;
        } else if (typeof backendFinalElig === 'string') {
          // Remove currency symbols and parse
          numericValue = parseFloat(backendFinalElig.replace(/[^\d.-]/g, '')) || 0;
        }
        
        console.log('🔍 Parsed numeric final eligibility:', numericValue);
        
        // Format as currency string for consistency
        const formattedBackendFinalElig = numericValue > 0 ? formatINR(Math.round(numericValue).toString()) : '';
        
        console.log('🔍 Formatted backend final eligibility:', formattedBackendFinalElig);
        
        // Store backend final eligibility separately to preserve it
        // BUT: Don't overwrite if we just saved (within the same session)
        if (justSavedEligibility) {
          console.log('⏭️  SKIPPING backend eligibility update - we just saved, keeping our calculated value');
          console.log('⏭️  Current backendFinalEligibility:', backendFinalEligibility);
          setJustSavedEligibility(false); // Reset the flag for next time
        } else if (numericValue > 0) {
          console.log('✅ ═══════════════════════════════════════════════════');
          console.log('✅ PRESERVING BACKEND FINAL ELIGIBILITY');
          console.log('✅ Original Value:', backendFinalElig);
          console.log('✅ Numeric Value:', numericValue);
          console.log('✅ Formatted Value:', formattedBackendFinalElig);
          console.log('✅ ═══════════════════════════════════════════════════');
          setBackendFinalEligibility(formattedBackendFinalElig);
          setBackendEligibilityLoaded(true);
        } else {
          console.log('⚠️ No valid backend final eligibility found (value is 0 or empty), will use calculated value');
          setBackendFinalEligibility(null);
          setBackendEligibilityLoaded(false);
        }
        
        setEligibility({
          totalIncome: eligibilityDetails.totalIncome || eligibilityDetails.total_income || '',
          foirAmount: eligibilityDetails.foirAmount || eligibilityDetails.foir_amount || '',
          totalObligations: eligibilityDetails.totalObligations || eligibilityDetails.total_obligations || '',
          totalBtPos: eligibilityDetails.totalBtPos || eligibilityDetails.total_bt_pos || '',
          finalEligibility: formattedBackendFinalElig, // Use the formatted backend value
          multiplierEligibility: eligibilityDetails.multiplierEligibility || eligibilityDetails.multiplier_eligibility || ''
        });
      }
      
      // 🔍 ENHANCED ELIGIBILITY DATA RECOVERY for login transfers
      const recoverEligibilityData = () => {
        console.log('🔍 ELIGIBILITY RECOVERY for login transfer...');
        
        const eligibilitySources = [
          savedData?.check_eligibility,
          savedData?.eligibility,
          savedData?.dynamic_fields?.check_eligibility,
          savedData?.dynamic_fields?.eligibility,
          leadData?.dynamic_fields?.check_eligibility,
          leadData?.dynamic_fields?.eligibility,
          leadData?.check_eligibility,
          leadData?.eligibility,
          // Additional nested sources
          savedData?.dynamic_details?.check_eligibility,
          savedData?.dynamic_details?.eligibility,
          leadData?.dynamic_details?.check_eligibility,
          leadData?.dynamic_details?.eligibility
        ];
        
        for (const source of eligibilitySources) {
          if (source && typeof source === 'object' && Object.keys(source).length > 0) {
            console.log('✅ Found eligibility data in source:', source);
            
            // Set eligibility fields from found source
            if (source.company_category) {
              console.log('✅ Recovered company_category:', source.company_category);
              setCeCompanyCategory(String(source.company_category));
            }
            if (source.foir_percent !== undefined) {
              console.log('✅ Recovered foir_percent:', source.foir_percent);
              setCeFoirPercent(source.foir_percent);
            }
            if (source.custom_foir_percent) {
              console.log('✅ Recovered custom_foir_percent:', source.custom_foir_percent);
              setCeCustomFoirPercent(String(source.custom_foir_percent));
            }
            if (source.monthly_emi_can_pay !== undefined) {
              console.log('✅ Recovered monthly_emi_can_pay:', source.monthly_emi_can_pay);
              setCeMonthlyEmiCanPay(Number(source.monthly_emi_can_pay));
            }
            if (source.tenure_months) {
              console.log('✅ Recovered tenure_months:', source.tenure_months);
              setCeTenureMonths(String(source.tenure_months));
            }
            if (source.tenure_years) {
              console.log('✅ Recovered tenure_years:', source.tenure_years);
              setCeTenureYears(String(source.tenure_years));
            }
            if (source.roi) {
              console.log('✅ Recovered roi:', source.roi);
              setCeRoi(String(source.roi));
            }
            if (source.multiplier) {
              console.log('✅ Recovered multiplier:', source.multiplier);
              setCeMultiplier(String(source.multiplier));
            }
            if (source.loan_eligibility_status) {
              console.log('✅ Recovered loan_eligibility_status:', source.loan_eligibility_status);
              setLoanEligibilityStatus(String(source.loan_eligibility_status));
            }
            
            console.log('✅ Eligibility data recovered successfully');
            return true;
          }
        }
        
        console.warn('⚠️ No eligibility data found in any source');
        return false;
      };

      // Call the recovery function for login transfers
      if (leadData?.file_sent_to_login) {
        recoverEligibilityData();
      }

      // Check eligibility fields from all possible locations (enhanced with more paths)
      const ceCompanyCategoryValue = getFieldValue([
        'ceCompanyCategory', 
        'check_eligibility.company_category', 
        'dynamic_fields.check_eligibility.company_category',
        'dynamic_details.check_eligibility.company_category',
        'eligibility.company_category',
        'dynamic_fields.eligibility.company_category',
        'dynamic_details.eligibility.company_category'
      ]);
      if (ceCompanyCategoryValue) {
        console.log('📝 Setting CE company category:', ceCompanyCategoryValue);
        setCeCompanyCategory(String(ceCompanyCategoryValue));
      }
      
      const ceMonthlyEmiValue = getFieldValue(['ceMonthlyEmiCanPay', 'check_eligibility.monthly_emi_can_pay', 'dynamic_fields.check_eligibility.monthly_emi_can_pay']);
      if (ceMonthlyEmiValue !== null) {
        console.log('📝 Setting CE monthly EMI can pay:', ceMonthlyEmiValue);
        setCeMonthlyEmiCanPay(Number(ceMonthlyEmiValue));
      }
      
      const ceTenureMonthsValue = getFieldValue(['ceTenureMonths', 'check_eligibility.tenure_months', 'dynamic_fields.check_eligibility.tenure_months']);
      if (ceTenureMonthsValue) {
        console.log('📝 Setting CE tenure months:', ceTenureMonthsValue);
        setCeTenureMonths(String(ceTenureMonthsValue));
      }
      
      const ceTenureYearsValue = getFieldValue(['ceTenureYears', 'check_eligibility.tenure_years', 'dynamic_fields.check_eligibility.tenure_years']);
      if (ceTenureYearsValue) {
        console.log('📝 Setting CE tenure years:', ceTenureYearsValue);
        setCeTenureYears(String(ceTenureYearsValue));
      }
      
      const ceRoiValue = getFieldValue(['ceRoi', 'check_eligibility.roi', 'dynamic_fields.check_eligibility.roi']);
      if (ceRoiValue) {
        console.log('📝 Setting CE ROI:', ceRoiValue);
        setCeRoi(String(ceRoiValue));
      }
      
      // Handle multiplier with robust default value logic
      const multiplierValue = getFieldValue(['ceMultiplier', 'check_eligibility.multiplier', 'dynamic_fields.check_eligibility.multiplier']);
      if (multiplierValue !== null && multiplierValue !== undefined) {
        console.log('📝 Setting CE multiplier:', multiplierValue);
        setCeMultiplier(String(multiplierValue));
      } else {
        console.log('📝 Setting CE multiplier to default: 0');
        setCeMultiplier('0');
      }
      
      const loanEligibilityStatusValue = getFieldValue(['loanEligibilityStatus', 'check_eligibility.loan_eligibility_status', 'dynamic_fields.check_eligibility.loan_eligibility_status']);
      if (loanEligibilityStatusValue) {
        console.log('📝 Setting loan eligibility status:', loanEligibilityStatusValue);
        setLoanEligibilityStatus(String(loanEligibilityStatusValue));
      }

      // Store backup data for recovery when file_sent_to_login is true
      if (leadData?.file_sent_to_login) {
        console.log('🔒 FILE_SENT_TO_LOGIN: Storing backup data for recovery');
        
        setBackupObligationData({
          salary: salaryValue || '',
          partnerSalary: partnerSalaryValue || '',
          yearlyBonus: yearlyBonusValue || '',
          bonusDivision: bonusDivisionValue || null,
          loanRequired: loanRequiredValue || '',
          companyName: companyNameValue || '',
          cibilScore: cibilScoreValue || '',
          companyType: companyTypeValue || [],
          companyCategory: companyCategoryValue || [],
          rawSavedData: savedData || {},
          timestamp: Date.now()
        });
        
        // Add a small delay to ensure data is properly set before any other effects run
        setTimeout(() => {
          console.log('🔒 FILE_SENT_TO_LOGIN: Data protection timeout complete, data should remain visible');
        }, 100);
      }
    };
    
    fetchObligationData();
    
    // Ensure initial load flag is reset even if no data is loaded, but be more careful with file_sent_to_login scenarios
    const resetDelay = leadData?.file_sent_to_login ? 500 : 100; // Longer delay for file_sent_to_login scenarios
    setTimeout(() => {
      setIsInitialLoad(false);
      // Don't reset hasUserInteraction here - let it stay false until actual user action
      console.log('🔄 Initial load timeout complete - file_sent_to_login:', leadData?.file_sent_to_login);
    }, resetDelay);

    // 🏁 FINAL STATE SUMMARY - What values are actually in the component now
    setTimeout(() => {
      console.log('🏁 FINAL OBLIGATION SECTION STATE SUMMARY:', {
        leadInfo: {
          leadId: leadData?._id,
          file_sent_to_login: leadData?.file_sent_to_login,
          lastLoadedLeadId
        },
        finalStateValues: {
          salary: salary || '(empty)',
          partnerSalary: partnerSalary || '(empty)', 
          yearlyBonus: yearlyBonus || '(empty)',
          loanRequired: loanRequired || '(empty)',
          companyName: companyName || '(empty)',
          cibilScore: cibilScore || '(empty)',
          obligationsCount: obligations.length,
          firstObligationProduct: obligations[0]?.product || '(no obligations)'
        },
        dataSourceInfo: {
          savedDataAvailable: savedData && Object.keys(savedData).length > 0,
          leadDataAvailable: leadData && Object.keys(leadData).length > 0,
          savedDataSize: savedData ? Object.keys(savedData).length : 0,
          leadDataSize: leadData ? Object.keys(leadData).length : 0
        },
        timestamp: new Date().toLocaleTimeString()
      });
    }, 100);
  }, [leadData?._id, bankListLoaded]); // Use leadData._id to ensure reload on lead change
  
  // Debug state watcher to track changes in key fields (optimized to reduce console spam)
  useEffect(() => {
    const currentState = {
      salary,
      partnerSalary,
      yearlyBonus,
      loanRequired,
      companyName,
      cibilScore,
      obligationsCount: obligations.length,
      timestamp: Date.now()
    };
    
    // Only log significant changes, not every render
    const hasSignificantChange = !debugStateValues.timestamp || 
      debugStateValues.salary !== salary || 
      debugStateValues.loanRequired !== loanRequired || 
      debugStateValues.companyName !== companyName;
    
    if (hasSignificantChange && !isInitialLoad) {
      console.log('🔍 SIGNIFICANT STATE CHANGE:', {
        changes: {
          salary: debugStateValues.salary !== salary ? {from: debugStateValues.salary, to: salary} : 'unchanged',
          loanRequired: debugStateValues.loanRequired !== loanRequired ? {from: debugStateValues.loanRequired, to: loanRequired} : 'unchanged',
          companyName: debugStateValues.companyName !== companyName ? {from: debugStateValues.companyName, to: companyName} : 'unchanged'
        },
        leadId: leadData?._id,
        file_sent_to_login: leadData?.file_sent_to_login
      });
    }
    
    // Check for unexpected data clearing (only if data was previously set)
    if (debugStateValues.timestamp && !isInitialLoad) {
      const fieldsCleared = [];
      if (debugStateValues.salary && !salary) fieldsCleared.push('salary');
      if (debugStateValues.partnerSalary && !partnerSalary) fieldsCleared.push('partnerSalary');
      if (debugStateValues.yearlyBonus && !yearlyBonus) fieldsCleared.push('yearlyBonus');
      if (debugStateValues.loanRequired && !loanRequired) fieldsCleared.push('loanRequired');
      if (debugStateValues.companyName && !companyName) fieldsCleared.push('companyName');
      if (debugStateValues.cibilScore && !cibilScore) fieldsCleared.push('cibilScore');
      
      if (fieldsCleared.length > 0) {
        console.warn('🚨 DATA CLEARING DETECTED:', {
          clearedFields: fieldsCleared,
          context: {
            isInitialLoad,
            dataLoaded,
            hasUserInteraction,
            file_sent_to_login: leadData?.file_sent_to_login
          }
        });
        
        // 🚨 EMERGENCY DATA RECOVERY - Attempt to recover cleared data
        if (fieldsCleared.length >= 2 && leadData?.file_sent_to_login) {
          console.warn('🚨 CRITICAL DATA LOSS - Initiating emergency recovery...');
          
          // Try to recover from multiple sources
          const recoverySources = [
            // Local storage backup
            (() => {
              try {
                const backup = localStorage.getItem(`obligationBackup_${leadData._id}`);
                return backup ? JSON.parse(backup) : null;
              } catch (e) {
                return null;
              }
            })(),
            // State snapshot
            (() => {
              try {
                const snapshot = localStorage.getItem(`stateSnapshot_${leadData._id}`);
                return snapshot ? JSON.parse(snapshot) : null;
              } catch (e) {
                return null;
              }
            })(),
            // Backup obligation data
            backupObligationData
          ];
          
          for (const source of recoverySources) {
            if (source && typeof source === 'object') {
              let recovered = false;
              
              if (fieldsCleared.includes('salary') && source.salary) {
                console.log('🔄 Recovering salary:', source.salary);
                setSalary(source.salary);
                recovered = true;
              }
              if (fieldsCleared.includes('loanRequired') && source.loanRequired) {
                console.log('🔄 Recovering loanRequired:', source.loanRequired);
                setLoanRequired(source.loanRequired);
                recovered = true;
              }
              if (fieldsCleared.includes('companyName') && source.companyName) {
                console.log('🔄 Recovering companyName:', source.companyName);
                setCompanyName(source.companyName);
                recovered = true;
              }
              
              if (recovered) {
                console.log('✅ Emergency recovery successful from source:', source);
                break;
              }
            }
          }
        }
      }
    }
    
    // Auto-recovery for file_sent_to_login scenarios (only when needed)
    if (leadData?.file_sent_to_login && backupObligationData && dataStableForFileSentToLogin) {
      let shouldRecover = false;
      
      if (debugStateValues.salary && !salary && backupObligationData.salary) {
        console.warn('🚨 Recovering SALARY from backup:', backupObligationData.salary);
        setSalary(backupObligationData.salary);
        shouldRecover = true;
      }
      if (debugStateValues.loanRequired && !loanRequired && backupObligationData.loanRequired) {
        console.warn('🚨 Recovering LOAN REQUIRED from backup:', backupObligationData.loanRequired);
        setLoanRequired(backupObligationData.loanRequired);
        shouldRecover = true;
      }
      if (debugStateValues.companyName && !companyName && backupObligationData.companyName) {
        console.warn('🚨 Recovering COMPANY NAME from backup:', backupObligationData.companyName);
        setCompanyName(backupObligationData.companyName);
        shouldRecover = true;
      }
      
      if (shouldRecover) {
        console.log('🔄 FILE_SENT_TO_LOGIN: Auto-recovery performed from backup data');
      }
    }
    
    setDebugStateValues(currentState);
  }, [salary, partnerSalary, yearlyBonus, loanRequired, companyName, cibilScore, obligations.length, 
      leadData?.file_sent_to_login, backupObligationData, dataStableForFileSentToLogin, isInitialLoad, dataLoaded, hasUserInteraction]);
  
  // Protective effect to prevent data clearing in file_sent_to_login scenarios
  useEffect(() => {
    if (leadData?.file_sent_to_login && dataStableForFileSentToLogin && obligations.length === 0) {
      console.warn('🚨 FILE_SENT_TO_LOGIN: Data was cleared unexpectedly! Attempting recovery...');
      
      // Try to recover data from leadData.dynamic_fields
      const recoveryData = leadData?.dynamic_fields?.obligation_data || 
                          leadData?.dynamic_fields || 
                          loadSavedObligationData();
      
      if (recoveryData && Object.keys(recoveryData).length > 0) {
        console.log('🔄 FILE_SENT_TO_LOGIN: Recovering data from backup sources');
        processObligationData(recoveryData);
      }
    }
  }, [leadData?.file_sent_to_login, dataStableForFileSentToLogin, obligations.length]);
  
  // Force data persistence check for file_sent_to_login scenarios
  useEffect(() => {
    if (leadData?.file_sent_to_login && backupObligationData) {
      const persistenceCheck = setInterval(() => {
        console.log('🔍 FILE_SENT_TO_LOGIN: Periodic data persistence check');
        
        // Check if any field has been unexpectedly cleared
        let recoveryNeeded = false;
        if (backupObligationData?.salary && !salary) {
          console.log('🔄 Restoring salary from backup');
          setSalary(backupObligationData.salary);
          recoveryNeeded = true;
        }
        if (backupObligationData?.companyName && !companyName) {
          console.log('🔄 Restoring company name from backup');
          setCompanyName(backupObligationData.companyName);
          recoveryNeeded = true;
        }
        if (backupObligationData?.partnerSalary && !partnerSalary) {
          console.log('🔄 Restoring partner salary from backup');
          setPartnerSalary(backupObligationData.partnerSalary);
          recoveryNeeded = true;
        }
        if (backupObligationData?.yearlyBonus && !yearlyBonus) {
          console.log('🔄 Restoring yearly bonus from backup');
          setYearlyBonus(backupObligationData.yearlyBonus);
          recoveryNeeded = true;
        }
        if (backupObligationData?.loanRequired && !loanRequired) {
          console.log('🔄 Restoring loan required from backup');
          setLoanRequired(backupObligationData.loanRequired);
          recoveryNeeded = true;
        }
        if (backupObligationData?.cibilScore && !cibilScore) {
          console.log('🔄 Restoring cibil score from backup');
          setCibilScore(backupObligationData.cibilScore);
          recoveryNeeded = true;
        }
        
        // Update debug state if any recovery was needed
        if (recoveryNeeded) {
          setDebugState(prev => ({
            ...prev,
            recoveryCount: prev.recoveryCount + 1,
            lastRecoveryTime: new Date().toLocaleTimeString()
          }));
        }
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(persistenceCheck);
    }
  }, [leadData?.file_sent_to_login, backupObligationData, salary, companyName, partnerSalary, yearlyBonus, loanRequired, cibilScore]);

  // Function to check if current data differs from original data
  const hasDataChanged = () => {
    if (!originalData || Object.keys(originalData).length === 0) {
      console.log("No original data available, cannot determine changes");
      return false;
    }
    
    const currentData = {
      salary,
      partnerSalary,
      yearlyBonus,
      bonusDivision,
      loanRequired,
      companyName,
      companyType,
      companyCategory,
      cibilScore,
      obligations,
      totalBtPos,
      totalObligation
    };
    
    // Log current and original data for debugging
    console.log("Checking for changes - Current data:", currentData);
    console.log("Checking for changes - Original data:", originalData);
    
    // Deep comparison of objects
    const hasChanged = JSON.stringify(currentData) !== JSON.stringify(originalData);
    console.log("Data has changed:", hasChanged);
    
    return hasChanged;
  };

  // Function to mark data as changed
  const markAsChanged = () => {
    // Be more conservative about marking changes for file_sent_to_login scenarios during initial load
    if (leadData?.file_sent_to_login && isInitialLoad) {
      console.log("🔒 FILE_SENT_TO_LOGIN: Skipping markAsChanged during initial load to prevent data interference");
      return;
    }
    
    setHasUserInteraction(true); // Mark that user has interacted with the form
    
    // Force hasUnsavedChanges to true whenever user makes any change
    setHasUnsavedChanges(true);
    
    // Log debug info
    console.log("User interaction detected - marking as changed");
    console.log("Current hasUnsavedChanges state:", hasUnsavedChanges);
    console.log("Has data changed:", hasDataChanged());
  };

  // Removed beforeunload event to allow page reload/close without alerts
  // Users can still save manually before closing the page

  // Force re-render for Credit Card button states and synchronize table data when obligations change
  useEffect(() => {
    // Skip synchronization during initial load to avoid unnecessary calculations
    if (isInitialLoad) return;
    
    // Add extra protection for file_sent_to_login scenarios to prevent data interference
    if (leadData?.file_sent_to_login && !dataLoaded) {
      console.log('🔒 FILE_SENT_TO_LOGIN: Skipping table synchronization until data is fully loaded');
      return;
    }
    
    const creditCardObligations = obligations.filter(obl => obl.product === 'CC (Credit Card)');
    if (creditCardObligations.length > 0) {
      // React will handle re-rendering automatically when obligations change
      // No need to force re-render which can cause infinite loops
    }
    
    // Synchronize totals and derived states when obligations change
    const syncTableData = () => {
      console.log('🔄 Synchronizing table data after obligations change...');
      
      // Don't recalculate total obligations here - let dedicated useEffect handle it
      // const newTotalObligation = obligations.reduce((sum, obl) => {
      //   const emiValue = parseINR(obl.emi);
      //   return sum + (isNaN(emiValue) ? 0 : emiValue);
      // }, 0);
      
      // Recalculate BT/POS total
      const newBtPosTotal = obligations.reduce((sum, obl) => {
        if (obl.action === 'BT') {
          const outstandingValue = parseINR(obl.outstanding);
          return sum + (isNaN(outstandingValue) ? 0 : outstandingValue);
        }
        return sum;
      }, 0);
      
      // Update totals if they've changed
      // const formattedTotalObligation = formatINR(newTotalObligation.toString());
      const formattedBtPosTotal = formatINR(newBtPosTotal.toString());
      
      // Don't update total obligation here - let dedicated useEffect handle it
      // if (totalObligation !== formattedTotalObligation) {
      //   setTotalObligation(formattedTotalObligation);
      //   console.log('📊 Updated total obligation:', formattedTotalObligation);
      // }
      
      if (totalBtPos !== formattedBtPosTotal) {
        setTotalBtPos(formattedBtPosTotal);
        console.log('📊 Updated BT/POS total:', formattedBtPosTotal);
      }
      
      console.log('✅ Table data synchronization completed');
    };
    
    // Use longer debounce for file_sent_to_login scenarios to prevent interference
    const debounceDelay = leadData?.file_sent_to_login ? 300 : 100;
    const timeoutId = setTimeout(syncTableData, debounceDelay);
    
    return () => clearTimeout(timeoutId);
  }, [obligations, isInitialLoad, totalObligation, totalBtPos, leadData?.file_sent_to_login, dataLoaded]);

  // Enhanced save function that resets unsaved changes
  const handleSaveObligationsWithChangeTracking = async () => {
    try {
      console.log("=== SAVE BUTTON CLICKED ===");
      console.log("hasUnsavedChanges:", hasUnsavedChanges);
      console.log("hasUserInteraction:", hasUserInteraction);
      console.log("Current data:", {
        salary,
        partnerSalary,
        yearlyBonus,
        bonusDivision,
        loanRequired,
        companyName,
        companyType,
        companyCategory,
        cibilScore,
        obligations,
        totalBtPos,
        totalObligation,
        // Additional fields
        ceCompanyCategory,
        ceFoirPercent,
        ceCustomFoirPercent,
        ceMonthlyEmiCanPay,
        ceTenureMonths,
        ceTenureYears,
        ceRoi,
        ceMultiplier,
        loanEligibilityStatus
      });
      
      // Force proceed with save operation regardless of change detection
      await handleSaveObligations();
      
      // Update original data to current state after successful save
      const savedData = {
        salary,
        partnerSalary,
        yearlyBonus,
        bonusDivision,
        loanRequired,
        companyName,
        companyType,
        companyCategory,
        cibilScore,
        obligations,
        totalBtPos,
        totalObligation,
        // Include additional fields
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
      setOriginalData(savedData);
      setHasUnsavedChanges(false);
      setHasUserInteraction(false);
      
      console.log("Save completed successfully");
      
      // Force component state refresh after save, but avoid aggressive reloads for file_sent_to_login scenarios
      console.log("🔄 Refreshing component state after save...");
      
      // Only force complete remount if NOT in file_sent_to_login scenario to prevent data hiding
      if (!leadData?.file_sent_to_login) {
        console.log("🔄 Standard save scenario - performing full component remount");
        setComponentKey(Date.now());
        
        // Clear all states and force reload from API
        setTimeout(() => {
          // Reset all state variables to initial values for fresh reload
          setIsInitialLoad(true);
          setHasUserInteraction(false);
          setDataLoaded(false);
          setActionDropdownInteracting(false);
          setLastLoadedLeadId(null); // Force fresh data load
          
          // Reset obligation table states
          setProductSearchStates({ 0: { isOpen: false, searchQuery: '' } });
          setBankSearchStates({ 0: { isOpen: false, searchQuery: '' } });
          setForceRender(prev => prev + 1);
          setRenderKey(Date.now());
          
          console.log("✅ Component reloaded successfully after save");
        }, 300);
      } else {
        console.log("🔒 FILE_SENT_TO_LOGIN scenario - performing gentle state refresh only");
        // Gentle refresh for file_sent_to_login scenarios to prevent data hiding
        setTimeout(() => {
          setHasUserInteraction(false);
          setActionDropdownInteracting(false);
          
          // Reset obligation table states only
          setProductSearchStates({ 0: { isOpen: false, searchQuery: '' } });
          setBankSearchStates({ 0: { isOpen: false, searchQuery: '' } });
          setForceRender(prev => prev + 1);
          
          console.log("✅ Gentle state refresh completed for file_sent_to_login scenario");
        }, 100);
      }
    } catch (error) {
      console.error('Error saving obligations:', error);
      alert("Failed to save changes. Please try again.");
    }
  };

  // Initialize search states when obligations are loaded
  useEffect(() => {
    const initialProductSearchStates = {};
    const initialBankSearchStates = {};
    
    obligations.forEach((_, index) => {
      initialProductSearchStates[index] = { isOpen: false, searchQuery: '' };
      initialBankSearchStates[index] = { isOpen: false, searchQuery: '' };
    });
    
    setProductSearchStates(initialProductSearchStates);
    setBankSearchStates(initialBankSearchStates);
  }, [obligations.length]);

  // Focus search input when dropdown opens - with proper guards against initialization errors
  useEffect(() => {
    try {
      // Guard: Only proceed if productSearchStates is properly initialized
      if (safeProductSearchStates && typeof safeProductSearchStates === 'object' && Object.keys(safeProductSearchStates).length > 0) {
        Object.keys(safeProductSearchStates).forEach(idx => {
          if (safeProductSearchStates[idx]?.isOpen) {
            setTimeout(() => {
              const input = document.querySelector(`[data-search-input="product"]`);
              if (input) input.focus();
            }, 50);
          }
        });
      }
      
      // Guard: Only proceed if bankSearchStates is properly initialized
      if (safeBankSearchStates && typeof safeBankSearchStates === 'object' && Object.keys(safeBankSearchStates).length > 0) {
        Object.keys(safeBankSearchStates).forEach(idx => {
          if (safeBankSearchStates[idx]?.isOpen) {
            setTimeout(() => {
              const input = document.querySelector(`[data-search-input="bank"]`);
              if (input) input.focus();
            }, 50);
          }
        });
      }
    } catch (error) {
      console.warn('Error in focus effect:', error);
    }
  }, [productSearchStates, bankSearchStates]);

  // Close dropdowns when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is inside any dropdown or popup
      const clickedElement = event.target;
      const isInsideDropdown = clickedElement.closest('[data-dropdown-container]') || 
                              clickedElement.closest('.fixed.z-\\[9999\\]') ||
                              clickedElement.closest('.fixed.z-50') || // CategoryPopup uses z-50
                              clickedElement.closest('[data-dropdown-trigger]') ||
                              clickedElement.closest('[data-category-popup-container]') || // CategoryPopup container
                              clickedElement.closest('[data-category-popup-backdrop]') || // CategoryPopup backdrop
                              clickedElement.closest('[data-category-popup-item]') || // CategoryPopup items
                              clickedElement.closest('.bg-transparent.backdrop-blur-sm'); // CategoryPopup container
      
      if (!isInsideDropdown) {
        closeAllDropdowns();
      }
    };

    const handleScroll = (event) => {
      // Check if scrolling is happening inside a dropdown container
      const scrolledElement = event.target;
      const isInsideDropdown = scrolledElement.closest('[data-dropdown-container]') || 
                              scrolledElement.closest('.fixed.z-\\[9999\\]') ||
                              scrolledElement.closest('[data-dropdown-scroll]') ||
                              scrolledElement.hasAttribute('data-dropdown-scroll') ||
                              scrolledElement.classList.contains('max-h-60') ||
                              scrolledElement.classList.contains('max-h-48') ||
                              scrolledElement.classList.contains('overflow-y-auto');
      
      // Only close dropdowns if scrolling is NOT inside a dropdown
      if (!isInsideDropdown) {
        closeAllDropdowns();
      }
    };

    const handleResize = () => {
      // Close all dropdowns when window is resized
      closeAllDropdowns();
    };

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
    window.addEventListener('resize', handleResize);
    
    return () => {
      // Cleanup event listeners
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // **DUPLICATE FUNCTION REMOVED** - The enhanced processObligationData function above handles all data processing comprehensively

  // Create a function to prepare obligation data that we'll use with the Save button
  // Enhanced for lead creation → login transfer scenarios
  const prepareObligationDataForSave = () => {
    // 🎯 LEAD CREATION → LOGIN DATA PERSISTENCE ENHANCEMENT
    console.log('💾 PREPARING DATA FOR SAVE - Lead Creation → Login Transfer Analysis:', {
      leadInfo: {
        leadId: leadData?._id,
        file_sent_to_login: leadData?.file_sent_to_login,
        isFromCreation: !leadData?.file_sent_to_login,
        isLoginTransfer: leadData?.file_sent_to_login
      },
      currentData: {
        salary: salary || '(empty)',
        loanRequired: loanRequired || '(empty)',
        companyName: companyName || '(empty)',
        obligationsCount: obligations.length
      }
    });
    
    // Determine effective company name - use first company from categories if available, otherwise use companyName
    let effectiveCompanyName = companyName;
    
    console.log('=== COMPANY NAME CALCULATION DEBUG ===');
    console.log('prepareObligationDataForSave - Initial companyName:', companyName);
    console.log('prepareObligationDataForSave - companyCategory:', companyCategory);
    console.log('companyCategory type:', typeof companyCategory);
    console.log('companyCategory isArray:', Array.isArray(companyCategory));
    console.log('companyCategory length:', Array.isArray(companyCategory) ? companyCategory.length : 'Not array');
    
    if (Array.isArray(companyCategory) && companyCategory.length > 0) {
      console.log('Processing categories to find company name...');
      // Find the first category with a company name
      const firstCategoryWithCompany = companyCategory.find(cat => {
        console.log('Checking category object:', cat);
        console.log('Category type:', typeof cat);
        if (typeof cat === 'object' && cat.company_name) {
          console.log('Found company_name:', cat.company_name);
          console.log('Trimmed length:', cat.company_name.trim().length);
          return cat.company_name.trim() !== '';
        }
        return false;
      });
      
      console.log('First category with company found:', firstCategoryWithCompany);
      if (firstCategoryWithCompany && firstCategoryWithCompany.company_name) {
        effectiveCompanyName = firstCategoryWithCompany.company_name;
        console.log('✅ Using first company from categories as effective company name:', effectiveCompanyName);
      } else {
        console.log('❌ No valid company found in categories, keeping original:', companyName);
      }
    } else {
      console.log('❌ No categories array or empty, keeping original companyName:', companyName);
    }
    
    console.log('🎯 FINAL effectiveCompanyName result:', effectiveCompanyName);
    console.log('=====================================');
    
    console.log('Final effective company name:', effectiveCompanyName);
    
    // Structure the data to match both the API expectations and the dynamic_fields structure
    const obligationData = {
      // Direct fields
      salary,
      partnerSalary,
      yearlyBonus,
      bonusDivision,
      loanRequired,
      companyName: effectiveCompanyName, // Use effective company name
      companyType, 
      companyCategory: (() => {
        // Send complete category objects with company name, bank name, and category name
        if (Array.isArray(companyCategory)) {
          return companyCategory.map(cat => {
            if (typeof cat === 'string') {
              // Legacy format - convert to object structure
              return {
                company_name: effectiveCompanyName || '',
                bank_name: '',
                category_name: cat,
                display: cat
              };
            } else if (typeof cat === 'object' && cat !== null) {
              // New format - preserve all information
              return {
                company_name: cat.company_name || effectiveCompanyName || '',
                bank_name: cat.bank_name || '',
                category_name: cat.category_name || cat.key || cat.display || '',
                display: cat.display || cat.key || '',
                ...cat // Include any additional fields
              };
            }
            return cat;
          });
        }
        return companyCategory;
      })(),
      cibilScore,
      obligations,
      foirPercent: ceFoirPercent,
      customFoirPercent: ceCustomFoirPercent,
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
      loanEligibilityStatus,
      
      // Multiple banks support - send as array and string formats for API compatibility
      processingBanks: companyType, // Array of selected banks
      processing_banks: companyType, // Array format
      processing_bank: companyType.length > 0 ? companyType[0] : '', // First bank for backward compatibility
      bank_name: companyType.length > 0 ? companyType.join(', ') : '', // Comma-separated string
      bankName: companyType.length > 0 ? companyType.join(', ') : '', // Comma-separated string
      selectedBanks: companyType, // Clear naming for selected banks
      
      // 🎯 ENHANCED NESTED STRUCTURE FOR LEAD CREATION → LOGIN COMPATIBILITY
      dynamic_fields: {
        // Root-level fields for backward compatibility (backend GET expects these at root)
        salary,
        partnerSalary,
        yearlyBonus,
        bonusDivision,
        loanRequired,
        companyName: effectiveCompanyName,
        companyType,
        companyCategory,
        cibilScore,
        
        financial_details: {
          // Primary field names (current system)
          monthly_income: salary ? parseINR(salary) : null,
          partner_salary: partnerSalary ? parseINR(partnerSalary) : null,
          yearly_bonus: yearlyBonus ? parseINR(yearlyBonus) : null,
          bonus_division: bonusDivision || null,
          cibil_score: cibilScore ? String(cibilScore) : null,
          loan_required: loanRequired ? parseINR(loanRequired) : null,
          loanRequired: loanRequired ? parseINR(loanRequired) : null,  // Backend camelCase field name
          
          // 🎯 LEAD CREATION ALTERNATIVE FIELD NAMES (for compatibility)
          salary: salary ? parseINR(salary) : null,              // Alternative name
          income: salary ? parseINR(salary) : null,              // Common in lead forms
          monthly_salary: salary ? parseINR(salary) : null,      // Descriptive name
          loan_amount: loanRequired ? parseINR(loanRequired) : null,  // Alternative name
          required_loan: loanRequired ? parseINR(loanRequired) : null, // Lead creation common
          loan_amt: loanRequired ? parseINR(loanRequired) : null       // Short name
        },
        personal_details: {
          // Primary company field names (current system)
          company_name: effectiveCompanyName || '', // Use empty string instead of null
          company_type: Array.isArray(companyType) ? companyType : (companyType ? [companyType] : []), // Save as array
          
          // 🎯 LEAD CREATION ALTERNATIVE COMPANY FIELD NAMES (for compatibility)
          employer: effectiveCompanyName || '',                    // Common in lead forms
          employer_name: effectiveCompanyName || '',               // Full employer name
          company: effectiveCompanyName || '',                     // Short field name
          organization: effectiveCompanyName || '',                // Organization field
          workplace: effectiveCompanyName || '',                   // Workplace field
          company_category: (() => {
            // Send complete category objects with company name, bank name, and category name
            if (Array.isArray(companyCategory)) {
              return companyCategory.map(cat => {
                if (typeof cat === 'string') {
                  // Legacy format - convert to object structure
                  return {
                    company_name: effectiveCompanyName || '', // Use effective company name
                    bank_name: '',
                    category_name: cat,
                    display: cat
                  };
                } else if (typeof cat === 'object' && cat !== null) {
                  // New format - preserve all information
                  return {
                    company_name: cat.company_name || effectiveCompanyName || '', // Use effective company name
                    bank_name: cat.bank_name || '',
                    category_name: cat.category_name || cat.key || cat.display || '',
                    display: cat.display || cat.key || '',
                    ...cat // Include any additional fields
                  };
                }
                return cat;
              });
            }
            return companyCategory;
          })()
        },
        check_eligibility: {
          company_category: ceCompanyCategory ? String(ceCompanyCategory) : null,
          foir_percent: ceFoirPercent || 60,
          custom_foir_percent: ceCustomFoirPercent || null,
          monthly_emi_can_pay: ceMonthlyEmiCanPay || 0,
          tenure_months: ceTenureMonths || null,
          tenure_years: ceTenureYears || null,
          roi: ceRoi || null,
          multiplier: ceMultiplier || null,
          loan_eligibility_status: loanEligibilityStatus || 'Not Eligible'
        },
        eligibility_details: {
          // Send both camelCase and snake_case for maximum compatibility
          totalIncome: eligibility?.totalIncome || '',
          total_income: eligibility?.totalIncome || '',
          foirAmount: eligibility?.foirAmount || '',
          foir_amount: eligibility?.foirAmount || '',
          totalObligations: eligibility?.totalObligations || '',
          total_obligations: eligibility?.totalObligations || '',
          totalBtPos: eligibility?.totalBtPos || '',
          total_bt_pos: eligibility?.totalBtPos || '',
          finalEligibility: eligibility?.finalEligibility || '',
          final_eligibility: eligibility?.finalEligibility || '', // Backend expects snake_case
          multiplierEligibility: eligibility?.multiplierEligibility || '',
          multiplier_eligibility: eligibility?.multiplierEligibility || ''
        },
        obligations: obligations.map((obl, index) => {
          // Make sure bank name is properly captured from the row
          
          return {
            product: obl.product || '',
            bank_name: obl.bankName || '', // This maps to bank_name in the API
            bankName: obl.bankName || '',  // Adding this to make sure both versions are sent
            tenure: obl.tenure ? parseINR(obl.tenure) : null,
            roi: obl.roi ? parseROI(obl.roi) : null,
            total_loan: obl.totalLoan ? parseINR(obl.totalLoan) : null,
            outstanding: obl.outstanding ? parseINR(obl.outstanding) : null,
            emi: obl.emi ? parseINR(obl.emi) : null,
            action: obl.action || 'Obligate',
            // Include Credit Card button states for proper persistence
            selectedPercentage: obl.selectedPercentage || null, // Keep for backward compatibility
            selectedTenurePercentage: obl.selectedTenurePercentage || null, // For 4% tenure button
            selectedRoiPercentage: obl.selectedRoiPercentage || null, // For 5% ROI button
            // Also include snake_case versions for backend compatibility
            selected_percentage: obl.selectedPercentage || null,
            selected_tenure_percentage: obl.selectedTenurePercentage || null,
            selected_roi_percentage: obl.selectedRoiPercentage || null
          };
        })
      },
      // 🎯 DYNAMIC_DETAILS STRUCTURE FOR NEW SYSTEM COMPATIBILITY
      dynamic_details: {
        financial_details: {
          // Mirror the dynamic_fields structure in dynamic_details for new system compatibility
          monthly_income: salary ? parseINR(salary) : null,
          salary: salary ? parseINR(salary) : null,
          income: salary ? parseINR(salary) : null,
          partner_salary: partnerSalary ? parseINR(partnerSalary) : null,
          yearly_bonus: yearlyBonus ? parseINR(yearlyBonus) : null,
          bonus_division: bonusDivision || null,
          cibil_score: cibilScore ? String(cibilScore) : null,
          loan_required: loanRequired ? parseINR(loanRequired) : null,
          loanRequired: loanRequired ? parseINR(loanRequired) : null,  // Backend camelCase field name
          loan_amount: loanRequired ? parseINR(loanRequired) : null,
          required_loan: loanRequired ? parseINR(loanRequired) : null
        },
        personal_details: {
          company_name: effectiveCompanyName || '',
          employer: effectiveCompanyName || '',
          employer_name: effectiveCompanyName || '',
          company: effectiveCompanyName || '',
          organization: effectiveCompanyName || '',
          company_type: Array.isArray(companyType) ? companyType : (companyType ? [companyType] : []), // Save as array
          company_category: companyCategory
        },
        check_eligibility: {
          company_category: ceCompanyCategory ? String(ceCompanyCategory) : null,
          foir_percent: ceFoirPercent || 60,
          custom_foir_percent: ceCustomFoirPercent || null,
          monthly_emi_can_pay: ceMonthlyEmiCanPay || 0,
          tenure_months: ceTenureMonths || null,
          tenure_years: ceTenureYears || null,
          roi: ceRoi || null,
          multiplier: ceMultiplier || null,
          loan_eligibility_status: loanEligibilityStatus || 'Not Eligible'
        },
        eligibility_details: {
          // Send both camelCase and snake_case for maximum compatibility
          totalIncome: eligibility?.totalIncome || '',
          total_income: eligibility?.totalIncome || '',
          foirAmount: eligibility?.foirAmount || '',
          foir_amount: eligibility?.foirAmount || '',
          totalObligations: eligibility?.totalObligations || '',
          total_obligations: eligibility?.totalObligations || '',
          totalBtPos: eligibility?.totalBtPos || '',
          total_bt_pos: eligibility?.totalBtPos || '',
          finalEligibility: eligibility?.finalEligibility || '',
          final_eligibility: eligibility?.finalEligibility || '', // Backend expects snake_case
          multiplierEligibility: eligibility?.multiplierEligibility || '',
          multiplier_eligibility: eligibility?.multiplierEligibility || ''
        }
      }
    };
    
    console.log('=== ENHANCED OBLIGATION DATA FOR LEAD CREATION → LOGIN ===');
    console.log('Current companyName state:', companyName);
    console.log('Current companyCategory state:', companyCategory);
    console.log('Calculated effectiveCompanyName:', effectiveCompanyName);
    console.log('Final obligationData.companyName:', effectiveCompanyName);
    console.log('💾 Enhanced Data Structure:');
    console.log('  - Root level fields: salary, loanRequired, companyName');
    console.log('  - dynamic_fields structure: comprehensive field name coverage');
    console.log('  - dynamic_details structure: new system compatibility');
    console.log('  - Alternative field names: income, employer, required_loan, etc.');
    console.log('💾 FINAL ELIGIBILITY DATA BEING SAVED:');
    console.log('  - eligibility state:', eligibility);
    console.log('  - finalEligibility (camelCase):', eligibility?.finalEligibility);
    console.log('  - dynamic_fields.eligibility_details.final_eligibility (snake_case):', obligationData.dynamic_fields.eligibility_details.final_eligibility);
    console.log('  - dynamic_details.eligibility_details.final_eligibility (snake_case):', obligationData.dynamic_details.eligibility_details.final_eligibility);
    console.log('=================================================================');
    
    // 🎯 LEAD CREATION DATA BACKUP - Store for recovery if send-to-login fails
    try {
      const leadCreationBackup = {
        leadId: leadData?._id,
        timestamp: Date.now(),
        source: 'LEAD_CREATION_SAVE',
        salary: salary,
        loanRequired: loanRequired,
        companyName: effectiveCompanyName,
        obligationData: obligationData
      };
      localStorage.setItem(`leadCreationBackup_${leadData?._id}`, JSON.stringify(leadCreationBackup));
      console.log('💾 Lead creation data backup saved for send-to-login recovery');
    } catch (e) {
      console.warn('⚠️ Failed to save lead creation backup:', e);
    }
    
    // Return the prepared data
    return obligationData;
  };
  
  // Track if changes have been made that need saving
  const [isSaving, setIsSaving] = useState(false);

  // Synchronous initialization to prevent race conditions
  useLayoutEffect(() => {
    try {
      if (!productSearchStates || typeof productSearchStates !== 'object' || Object.keys(productSearchStates).length === 0) {
        console.warn('Synchronous initialization of productSearchStates');
        setProductSearchStates({ 0: { isOpen: false, searchQuery: '' } });
      }
      if (!bankSearchStates || typeof bankSearchStates !== 'object' || Object.keys(bankSearchStates).length === 0) {
        console.warn('Synchronous initialization of bankSearchStates');
        setBankSearchStates({ 0: { isOpen: false, searchQuery: '' } });
      }
    } catch (error) {
      console.error('Error in synchronous state initialization:', error);
    }
  }, []);
  
  // Emergency initialization effect to prevent any race conditions
  useEffect(() => {
    try {
      if (!productSearchStates || typeof productSearchStates !== 'object') {
        console.warn('Emergency initialization of productSearchStates');
        setProductSearchStates({ 0: { isOpen: false, searchQuery: '' } });
      }
      if (!bankSearchStates || typeof bankSearchStates !== 'object') {
        console.warn('Emergency initialization of bankSearchStates');
        setBankSearchStates({ 0: { isOpen: false, searchQuery: '' } });
      }
    } catch (error) {
      console.error('Error in emergency state initialization:', error);
    }
  }, []);
  
  // State to track dropdown positions for smart positioning
  const [dropdownPositions, setDropdownPositions] = useState({});
  
  // Refs for dropdown elements to calculate positions
  const dropdownRefs = useRef({});
  
  // Handler for save button click
  // Save function - Now used by auto-save (manual save button removed)
  const handleSaveObligations = async () => {
    console.log('💾 ========================================');
    console.log('💾 SAVE OPERATION TRIGGERED (AUTO-SAVE)');
    console.log('💾 ========================================');
    console.log('💾 Current data being saved:', {
      salary,
      partnerSalary,
      yearlyBonus,
      loanRequired,
      companyName,
      cibilScore,
      hasUnsavedChanges,
      leadId: leadData?._id,
      file_sent_to_login: leadData?.file_sent_to_login
    });
    
    if (!hasUnsavedChanges) {
      console.log('💾 No changes to save');
      return;
    }
    
    setIsSaving(true);
    
    // Notify parent that saving is starting
    if (onDataUpdate && typeof onDataUpdate === 'function') {
      onDataUpdate({
        hasUnsavedChanges: true,
        isSaving: true
      });
    }
    
    try {
      const obligationData = prepareObligationDataForSave();
      
      console.log('💾 ═══════════════════════════════════════════════════');
      console.log('💾 FINAL ELIGIBILITY BEING SAVED:');
      console.log('💾 Current eligibility state:', eligibility);
      console.log('💾 finalEligibility (display):', eligibility?.finalEligibility);
      console.log('💾 Sending to backend:');
      console.log('💾   - dynamic_fields.eligibility_details.final_eligibility:', 
        obligationData?.dynamic_fields?.eligibility_details?.final_eligibility);
      console.log('💾   - dynamic_details.eligibility_details.final_eligibility:', 
        obligationData?.dynamic_details?.eligibility_details?.final_eligibility);
      console.log('💾 ═══════════════════════════════════════════════════');
      
      console.log('💾 Prepared obligation data for save:', {
        loanRequired: obligationData.loanRequired,
        loan_required: obligationData.loan_required,
        dynamic_fields: {
          financial_details: {
            loan_required: obligationData.dynamic_fields?.financial_details?.loan_required
          }
        },
        fullData: obligationData
      });
      
      // Debug Credit Card button states being saved
      const creditCardObligations = obligationData.obligations?.filter(obl => obl.product === 'CC (Credit Card)');
      
      if (leadData?._id) {
        console.log('💾 Calling API to save data...');
        // Call API to save data
        await saveObligationDataToAPI(obligationData);
        console.log('💾 API save completed successfully');
      } else {
        console.log('💾 No lead ID, saving to localStorage...');
        // Local storage save for offline/temporary use
        saveObligationData(obligationData);
        console.log('💾 LocalStorage save completed');
      }
      
      setHasUnsavedChanges(false);
      
      // 🔥 IMPORTANT: Update backend final eligibility with the current calculated value
      // This ensures that after save, the backend value matches what we just saved
      if (eligibility?.finalEligibility) {
        console.log('💾 Updating backendFinalEligibility with saved value:', eligibility.finalEligibility);
        setBackendFinalEligibility(eligibility.finalEligibility);
        setBackendEligibilityLoaded(true);
        setJustSavedEligibility(true); // Mark that we just saved to prevent overwrite on reload
      }
      
      setHasUserInteraction(false); // Reset user interaction flag after saving
      
      console.log('🔄 Refreshing table data after save to ensure UI reflects latest state...');
      
      // Force refresh of obligation table data and reset search states
      refreshObligationTableData();
      
      // Reload data after save to ensure UI shows the correctly formatted/typed values
      if (leadData?._id) {
        // Reload from API by fetching fresh data
        try {
          console.log('🔄 Starting data reload after save...');
          const userId = getUserId();
          if (userId) {
            // Determine if this is a login lead
            const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
            const apiUrl = isLoginLead
              ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/obligations?user_id=${userId}`
              : `${API_BASE_URL}/leads/${leadData._id}/obligations?user_id=${userId}`;
            console.log(`🔄 Fetching fresh data from: ${apiUrl} (${isLoginLead ? 'LOGIN' : 'MAIN'} leads)`);

            
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            
            if (response.ok) {
              const refreshedData = await response.json();
              console.log('🔄 ═══════════════════════════════════════════════════');
              console.log('🔄 FRESH DATA RECEIVED FROM API AFTER SAVE:');
              console.log('🔄 Eligibility in response:');
              console.log('🔄   - dynamic_fields.eligibility_details:', refreshedData?.dynamic_fields?.eligibility_details);
              console.log('🔄   - dynamic_details.eligibility_details:', refreshedData?.dynamic_details?.eligibility_details);
              console.log('🔄   - eligibility_details.final_eligibility:', 
                refreshedData?.dynamic_fields?.eligibility_details?.final_eligibility ||
                refreshedData?.dynamic_details?.eligibility_details?.final_eligibility);
              console.log('🔄 ═══════════════════════════════════════════════════');
              console.log('🔄 Fresh data received from API:', {
                hasData: !!(refreshedData && Object.keys(refreshedData).length > 0),
                loanRequiredInResponse: refreshedData?.loan_required || refreshedData?.loanRequired,
                dynamicDetailsLoanRequired: refreshedData?.dynamic_details?.financial_details?.loan_required,
                dynamicFieldsLoanRequired: refreshedData?.dynamic_fields?.financial_details?.loan_required,
                fullResponse: refreshedData
              });
              
              if (refreshedData && Object.keys(refreshedData).length > 0) {
                console.log('✅ Successfully reloaded data from API after save - processing...');
                await processObligationData(refreshedData);
                
                // Log the state after processing
                console.log('🔄 State after processing fresh API data:', {
                  salary,
                  loanRequired,
                  companyName,
                  cibilScore
                });
                
                // Refresh obligation table data after processing
                refreshObligationTableData();
                
                // Force immediate synchronous re-render using flushSync
                console.log('🔄 Forcing immediate synchronous UI re-render with flushSync after data reload...');
                flushSync(() => {
                  setForceRender(prev => prev + 1);
                  setRenderKey(Date.now());
                  setLastSaveTime(Date.now());
                });
                
                // Don't create new array reference - this breaks dropdown handlers!
                // setObligations(current => [...current]); // REMOVED - causes handler corruption
                console.log('✅ Immediate synchronous UI re-render completed without breaking references');
              } else {
                console.warn('⚠️ No data in API response after save');
              }
            } else {
              console.error('❌ Failed to fetch fresh data - response not ok:', response.status);
            }
          } else {
            console.error('❌ No userId available for data reload');
          }
        } catch (error) {
          console.error('❌ Failed to reload data after save:', error);
          // Even if reload fails, refresh the table data with current state
          refreshObligationTableData();
        }
      } else {
        // Reload from localStorage
        const localData = loadSavedObligationData();
        if (localData) {
          console.log('🔄 Reloading from localStorage after save...');
          await processObligationData(localData);
          
          // Refresh obligation table data after processing
          refreshObligationTableData();
          
          // Force immediate synchronous re-render using flushSync
          console.log('🔄 Forcing immediate synchronous UI re-render with flushSync after localStorage reload...');
          flushSync(() => {
            setForceRender(prev => prev + 1);
            setRenderKey(Date.now());
            setLastSaveTime(Date.now());
          });
          
          // Don't create new array reference - this breaks dropdown handlers!
          // setObligations(current => [...current]); // REMOVED - causes handler corruption
          console.log('✅ Immediate synchronous UI re-render completed without breaking references');
          
          console.log('✅ Successfully reloaded data from localStorage after save');
        } else {
          // If no local data, still refresh the table with current state
          refreshObligationTableData();
        }
      }
      
      // Update originalData to reflect the newly saved state (including Credit Card button states)
      const currentData = {
        salary,
        partnerSalary,
        yearlyBonus,
        bonusDivision,
        loanRequired,
        companyName,
        companyType,
        companyCategory,
        cibilScore,
        obligations, // This includes selectedTenurePercentage and selectedRoiPercentage
        totalBtPos,
        totalObligation
      };
      setOriginalData(currentData);
      console.log('Updated originalData to reflect saved state, including Credit Card button states');
      
      // Force comprehensive synchronous re-render and state synchronization
      console.log('🔄 Forcing comprehensive synchronous UI re-render and state update...');
      flushSync(() => {
        setForceRender(prev => prev + 1);
        setRenderKey(Date.now());
        setLastSaveTime(Date.now());
        
        // Force obligation array refresh with new reference
        setObligations(currentObligations => [...currentObligations]);
      });
      
      // Final state synchronization after flushSync
      setTimeout(() => {
        // Don't calculate total obligation here - let dedicated useEffect handle it
        // const finalTotalObligation = obligations.reduce((sum, obl) => {
        //   const emiValue = parseINR(obl.emi);
        //   return sum + (isNaN(emiValue) ? 0 : emiValue);
        // }, 0);
        // setTotalObligation(formatINR(finalTotalObligation.toString()));
        
        const finalBtPosTotal = obligations.reduce((sum, obl) => {
          if (obl.action === 'BT') {
            const outstandingValue = parseINR(obl.outstanding);
            return sum + (isNaN(outstandingValue) ? 0 : outstandingValue);
          }
          return sum;
        }, 0);
        setTotalBtPos(formatINR(finalBtPosTotal.toString()));
        
        console.log('✅ Final state synchronization completed');
      }, 100);
      
      console.log('✅ Comprehensive synchronous UI refresh completed');
      
      // Notify parent that saving is completed successfully
      if (onDataUpdate && typeof onDataUpdate === 'function') {
        onDataUpdate({
          hasUnsavedChanges: false,
          isSaving: false
        });
      }
      
      console.log('✅ Obligation data saved successfully');
      console.log('======= SAVE OPERATION COMPLETED =======');
    } catch (error) {
      console.error('❌ ERROR SAVING OBLIGATION DATA:', error);
      console.error('Error details:', error.message);
      
      // Notify parent that saving failed
      if (onDataUpdate && typeof onDataUpdate === 'function') {
        onDataUpdate({
          hasUnsavedChanges: true,
          isSaving: false,
          error: error.message
        });
      }
      
      // Could add user-visible error notification here
    } finally {
      setIsSaving(false);
    }
  };

  // 🚀 AUTO-SAVE FUNCTIONALITY (Similar to AboutSection)
  const triggerAutoSave = async () => {
    if (!leadData?._id || isInitialLoad || !hasUserInteraction) {
      console.log('⏭️ Skipping autosave:', {
        noLeadId: !leadData?._id,
        isInitialLoad,
        noUserInteraction: !hasUserInteraction
      });
      return;
    }

    console.log('💾 Auto-save triggered...');
    setIsAutoSaving(true);
    setAutoSaveStatus('saving');

    try {
      const obligationData = prepareObligationDataForSave();
      
      console.log('💾 AUTO-SAVE: Saving obligation data...');
      
      if (leadData?._id) {
        await saveObligationDataToAPI(obligationData);
        
        // Update backend final eligibility with the current calculated value
        if (eligibility?.finalEligibility) {
          setBackendFinalEligibility(eligibility.finalEligibility);
          setBackendEligibilityLoaded(true);
          setJustSavedEligibility(true);
        }
        
        console.log('✅ AUTO-SAVE: Successfully saved to API');
        setAutoSaveStatus('saved');
        setHasUnsavedChanges(false);
        
        // Clear save status after 3 seconds
        setTimeout(() => setAutoSaveStatus(''), 3000);
      } else {
        saveObligationData(obligationData);
        console.log('✅ AUTO-SAVE: Successfully saved to localStorage');
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(''), 3000);
      }
    } catch (error) {
      console.error('❌ AUTO-SAVE ERROR:', error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus(''), 5000);
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Debounced autosave - triggers 2 seconds after user stops typing/changing
  useEffect(() => {
    if (hasUserInteraction && hasUnsavedChanges && !isInitialLoad) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout for autosave
      autoSaveTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Autosave timeout reached, triggering save...');
        triggerAutoSave();
      }, 300); // 300ms delay for near-immediate save

      // Cleanup
      return () => {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
      };
    }
  }, [
    salary, 
    partnerSalary, 
    yearlyBonus, 
    bonusDivision, 
    loanRequired,
    companyName,
    companyType,
    companyCategory,
    cibilScore,
    obligations,
    ceFoirPercent,
    ceCustomFoirPercent,
    ceMonthlyEmiCanPay,
    ceTenureMonths,
    ceTenureYears,
    ceRoi,
    ceMultiplier,
    hasUserInteraction,
    hasUnsavedChanges,
    isInitialLoad
  ]);
  
  // Set unsaved changes flag whenever key data changes (but only after initial load and with user interaction)
  useEffect(() => {
    // Be more conservative about setting unsaved changes for file_sent_to_login scenarios
    if (!isInitialLoad && hasUserInteraction) {
      // Add extra protection for file_sent_to_login scenarios to prevent premature state changes
      const shouldSetUnsaved = leadData?.file_sent_to_login ? 
        (hasUserInteraction && dataLoaded && !isInitialLoad) : 
        true;
      
      if (shouldSetUnsaved) {
        setHasUnsavedChanges(true);
        console.log("Data changed after initial load with user interaction - setting unsaved changes flag");
      } else {
        console.log("🔒 FILE_SENT_TO_LOGIN: Skipping unsaved changes flag to prevent interference");
      }
    }
  }, [
    salary, partnerSalary, yearlyBonus, bonusDivision, loanRequired, companyName, companyType, companyCategory, cibilScore, obligations,
    ceFoirPercent, ceCustomFoirPercent, totalBtPos, totalObligation, eligibility,
    ceCompanyCategory, ceMonthlyEmiCanPay, ceTenureMonths, ceTenureYears, ceRoi, ceMultiplier, loanEligibilityStatus, 
    isInitialLoad, hasUserInteraction, leadData?.file_sent_to_login, dataLoaded
  ]);
  
  // Data preservation effect - prevent data from being cleared after it has been loaded (more conservative)
  useEffect(() => {
    // Only activate data protection after data has been stable for a while and user has interacted
    if (!isInitialLoad && dataLoaded && hasUserInteraction && debugStateValues.timestamp) {
      // Wait for at least 2 seconds after initial load before activating protection
      const timeSinceLastChange = Date.now() - debugStateValues.timestamp;
      if (timeSinceLastChange < 2000) return; // Too soon after last change
      
      // Once data is loaded and stable, prevent it from being set to empty values unless explicitly by user
      const dataIsEmpty = !salary && !partnerSalary && !yearlyBonus && !loanRequired && !companyName && !cibilScore && obligations.length <= 1;
      
      // Only protect if we had substantial data before
      const hadSignificantData = (debugStateValues.salary && debugStateValues.salary.length > 0) || 
                               (debugStateValues.loanRequired && debugStateValues.loanRequired.length > 0) || 
                               (debugStateValues.companyName && debugStateValues.companyName.length > 0);
      
      if (dataIsEmpty && hadSignificantData) {
        console.warn('🛡️ DATA PROTECTION: Preventing unexpected data clearing after user interaction', {
          previousState: debugStateValues,
          currentState: { salary, partnerSalary, yearlyBonus, loanRequired, companyName, cibilScore },
          leadId: leadData?._id,
          file_sent_to_login: leadData?.file_sent_to_login,
          timeSinceLastChange: timeSinceLastChange
        });
        
        // Only restore if we have valid backup data and it's not during a save operation
        if (backupObligationData && !isSaving) {
          console.log('🛡️ Restoring from backup data');
          if (backupObligationData.salary && !salary) setSalary(backupObligationData.salary);
          if (backupObligationData.loanRequired && !loanRequired) setLoanRequired(backupObligationData.loanRequired);
          if (backupObligationData.companyName && !companyName) setCompanyName(backupObligationData.companyName);
          if (backupObligationData.partnerSalary && !partnerSalary) setPartnerSalary(backupObligationData.partnerSalary);
          if (backupObligationData.yearlyBonus && !yearlyBonus) setYearlyBonus(backupObligationData.yearlyBonus);
          if (backupObligationData.cibilScore && !cibilScore) setCibilScore(backupObligationData.cibilScore);
        }
      }
    }
  }, [salary, partnerSalary, yearlyBonus, loanRequired, companyName, cibilScore, obligations.length, 
      isInitialLoad, dataLoaded, backupObligationData, debugStateValues, leadData?.file_sent_to_login, hasUserInteraction, isSaving]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  
  // Dynamic company category states
  const [dynamicCompanyCategories, setDynamicCompanyCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  
  // Constants
  const bonusDivisions = [
    { value: 1, label: '1' },
    { value: 3, label: '3' },
    { value: 6, label: '6' },
    { value: 12, label: '12' },
    { value: 24, label: '24' },
    { value: 48, label: '48' }
  ];

  const [companyTypes, setCompanyTypes] = useState([
    { value: 'private', label: 'Private' },
    { value: 'government', label: 'Government' },
    { value: 'psu', label: 'PSU' },
    { value: 'mnc', label: 'MNC' },
    { value: 'decide-bank-for-case', label: 'Decide Bank For Case' }
  ]);

  const companyCategories = [
    { value: 'category-a', label: 'Category A' },
    { value: 'category-b', label: 'Category B' },
    { value: 'category-c', label: 'Category C' }
  ];

  const productTypes = [
    { value: '', label: 'Select Product' },
    { value: 'PL (Personal Loan)', label: 'PL (Personal Loan)' },
    { value: 'OD (Overdraft)', label: 'OD (Overdraft)' },
    { value: 'CC (Credit Card)', label: 'CC (Credit Card)' },
    { value: 'BL (Business Loan)', label: 'BL (Business Loan)' },
    { value: 'HL (Home Loan)', label: 'HL (Home Loan)' },
    { value: 'LAP (Loan Against Property)', label: 'LAP (Loan Against Property)' },
    { value: 'AL (Auto Loan/ Car Loan)', label: 'AL (Auto Loan/ Car Loan)' },
    { value: 'EL (Education Loan)', label: 'EL (Education Loan)' },
    { value: 'GL (Gold Loan)', label: 'GL (Gold Loan)' },
    { value: 'LOC (Loan On Credit Card)', label: 'LOC (Loan On Credit Card)' },
    { value: 'CD (Consumer Durable Loan)', label: 'CD (Consumer Durable Loan)' },
    { value: 'APP LOAN', label: 'APP LOAN' },
    { value: 'INSURANCE', label: 'INSURANCE' }
  ];

  const actionTypes = [
    { value: 'BT', label: 'BT', color: 'green' },        // Highest priority - Balance Transfer
    { value: 'Obligate', label: 'Obligate', color: 'yellow' },  // Second priority - Default obligation
    { value: 'CO-PAY', label: 'CO-PAY', color: 'orange' },      // Third priority - Co-payment
    { value: 'NO-PAY', label: 'NO-PAY', color: 'blue' },        // Fourth priority - No payment
    { value: 'Closed', label: 'Closed', color: 'red' }          // Lowest priority - Closed/Finished
  ];

  const checkEligibilityCompanyCategories = [
    { value: 'category-a', label: 'Category A' },
    { value: 'category-b', label: 'Category B' },
    { value: 'category-c', label: 'Category C' },
    { value: 'category-d', label: 'Category D' },
    { value: 'unlisted-company', label: 'Unlisted Company' }
  ];

  // Utility functions
  const formatINR = (value) => {
    if (!value) return '';
    // Ensure we're dealing with a string before using replace
    const strValue = String(value);
    const number = parseFloat(strValue.replace(/[^0-9.]/g, ''));
    if (isNaN(number)) return '';
    return new Intl.NumberFormat('en-IN').format(number);
  };

  const parseINR = (value) => {
    if (!value) return 0;
    // Handle non-string values by converting to string first
    const strValue = String(value);
    return parseFloat(strValue.replace(/[^0-9.]/g, '')) || 0;
  };

  // Format tenure with "Months" suffix
  const formatTenure = (value) => {
    if (!value) return '';
    // Ensure we're dealing with a string before using replace
    const strValue = String(value);
    const number = strValue.replace(/[^0-9]/g, '');
    return number ? `${number} Months` : '';
  };

  // Parse tenure to get just the number
  const parseTenure = (value) => {
    if (!value) return '';
    // Handle non-string values by converting to string first
    const strValue = String(value);
    return strValue.replace(/[^0-9]/g, '');
  };

  // Format ROI with "%" suffix
  const formatROI = (value) => {
    if (!value) return '';
    // Ensure we're dealing with a string before using replace
    const strValue = String(value);
    const number = strValue.replace(/[^0-9.]/g, '');
    return number ? `${number}%` : '';
  };

  // Parse ROI to get just the number
  const parseROI = (value) => {
    if (!value) return '';
    // Handle non-string values by converting to string first
    const strValue = String(value);
    return strValue.replace(/[^0-9.]/g, '');
  };

  // Utility function to sort obligations by action priority
  const sortObligationsByPriority = (obligations) => {
    console.log('🔄 Sorting obligations by priority');
    return [...obligations].sort((a, b) => {
      const priority = { 'BT': 1, 'Obligate': 2, 'CO-PAY': 3, 'NO-PAY': 4, 'Closed': 5 };
      const priorityA = priority[a.action] || 6;
      const priorityB = priority[b.action] || 6;
      console.log(`Sorting: ${a.action} (${priorityA}) vs ${b.action} (${priorityB})`);
      return priorityA - priorityB;
    });
  };

  // Parse years to get just the number
  const parseYears = (value) => {
    if (!value) return '';
    // Handle non-string values by converting to string first
    const strValue = String(value);
    return strValue.replace(/[^0-9.]/g, '');
  };

  // Utility function to refresh and synchronize table data after save operations
  const refreshObligationTableData = () => {
    console.log('🔄 Refreshing obligation table data and search states...');
    
    // Skip refresh if user is currently interacting with action dropdowns
    if (actionDropdownInteracting) {
      console.log('⏸️ Skipping table refresh - user interacting with action dropdown');
      // Don't retry automatically to prevent interference
      return;
    }
    
    // Be gentler with file_sent_to_login scenarios to prevent data hiding
    if (leadData?.file_sent_to_login) {
      console.log('🔒 FILE_SENT_TO_LOGIN: Using gentle refresh to prevent data hiding');
    }
    
    // Reset all search dropdown states to prevent UI inconsistencies
    const resetProductSearchStates = {};
    const resetBankSearchStates = {};
    
    obligations.forEach((_, index) => {
      resetProductSearchStates[index] = { isOpen: false, searchQuery: '' };
      resetBankSearchStates[index] = { isOpen: false, searchQuery: '' };
    });
    
    setProductSearchStates(resetProductSearchStates);
    setBankSearchStates(resetBankSearchStates);
    
    // Don't force recalculation of total obligation here - let dedicated useEffect handle it
    // const recalculatedTotal = obligations.reduce((sum, obl) => {
    //   const emiValue = parseINR(obl.emi);
    //   return sum + (isNaN(emiValue) ? 0 : emiValue);
    // }, 0);
    // setTotalObligation(formatINR(recalculatedTotal.toString()));
    
    // Calculate BT/POS total
    const btPosTotal = obligations.reduce((sum, obl) => {
      if (obl.action === 'BT') {
        const outstandingValue = parseINR(obl.outstanding);
        return sum + (isNaN(outstandingValue) ? 0 : outstandingValue);
      }
      return sum;
    }, 0);
    setTotalBtPos(formatINR(btPosTotal.toString()));
    
    // Only force re-render keys if not in the middle of an interaction and handle file_sent_to_login gently
    if (!actionDropdownInteracting) {
      const refreshDelay = leadData?.file_sent_to_login ? 200 : 100; // Longer delay for file_sent_to_login
      setTimeout(() => {
        // Only update force render, avoid updating renderKey for file_sent_to_login to prevent UI disruption
        setForceRender(prev => prev + 1);
        if (!leadData?.file_sent_to_login) {
          setRenderKey(Date.now());
        }
        console.log('✅ Render keys updated after safe delay');
      }, refreshDelay);
    }
    
    console.log('✅ Obligation table data and search states refreshed successfully');
  };

  // Event handlers
  const handleSalaryChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const formattedValue = formatINR(raw);
    setSalary(formattedValue);
    
    // Mark as changed and force unsaved changes flag
    markAsChanged();
    setHasUnsavedChanges(true);
    setHasUserInteraction(true);
    
    console.log("Salary changed to:", formattedValue);
    
    // DO NOT notify parent on every keystroke - only on blur/save
    // if (handleChangeFunc) {
    //   handleChangeFunc('salary', formattedValue);
    // }
  };

  const handlePartnerSalaryChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const formattedValue = formatINR(raw);
    setPartnerSalary(formattedValue);
    markAsChanged();
    
    // DO NOT notify parent on every keystroke - only on blur/save
    // if (handleChangeFunc) {
    //   handleChangeFunc('partner_salary', formattedValue);
    // }
  };

  const handleYearlyBonusChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const formattedValue = formatINR(raw);
    setYearlyBonus(formattedValue);
    markAsChanged();
    
    // Clear division when bonus is cleared
    if (!raw) {
      setBonusDivision(null);
      // DO NOT notify parent on every keystroke
      // if (handleChangeFunc) {
      //   handleChangeFunc('bonus_division', null);
      // }
    }
    
    // DO NOT notify parent on every keystroke - only on blur/save
    // if (handleChangeFunc) {
    //   handleChangeFunc('yearly_bonus', formattedValue);
    // }
  };

  // Handle bonus division toggle (like credit card buttons)
  const handleBonusDivisionToggle = (division) => {
    const bonusAmount = parseINR(yearlyBonus);
    
    // Only proceed if there's a bonus amount
    if (bonusAmount > 0) {
      let newDivision;
      // If the same division is already selected, deactivate it
      if (bonusDivision === division) {
        newDivision = null;
        setBonusDivision(null);
      } else {
        // Activate the selected division
        newDivision = division;
        setBonusDivision(division);
      }
      
      markAsChanged();
      
      // DO NOT notify parent immediately - will be called on blur/save
      // if (handleChangeFunc) {
      //   handleChangeFunc('bonus_division', newDivision);
      // }
    }
  };

  const handleObligationChange = (index, field, value) => {
    // Immediately mark as changed when any obligation field is changed
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    
    console.log(`Obligation field changed: index=${index}, field=${field}, value=${value}`);
    
    setObligations(prevObligations => {
      const newObligations = [...prevObligations];
      
      // Convert text values to uppercase for display consistency
      let processedValue = value;
      if (typeof value === 'string' && !['emi', 'roi', 'tenure', 'totalLoan', 'outstanding', 'action'].includes(field)) {
        processedValue = value.toUpperCase();
      }
      
      // Special handling for bank name field to ensure it's properly saved
      if (field === "bankName") {
        console.log(`Setting bank name for obligation ${index} to "${processedValue}"`);
        // Set the bankName field properly
        newObligations[index] = { ...newObligations[index], bankName: processedValue, bank_name: processedValue };
        
        // Log both fields to verify they're set correctly
        console.log(`Obligation ${index} bank fields: bankName=${processedValue}, bank_name=${processedValue}`);
      } else {
        newObligations[index] = { ...newObligations[index], [field]: processedValue };
      }
      
      // Credit Card specific logic
      if (isCreditCard(newObligations[index].product)) {
        if (field === 'product') {
          // Clear tenure, ROI, EMI, and all button states for credit card
          newObligations[index] = {
            ...newObligations[index],
            tenure: '',
            roi: '',
            emi: '',
            selectedPercentage: null,
            selectedRoiPercentage: null,
            selectedTenurePercentage: null
          };
          
          // If there's already an outstanding amount, calculate 5% EMI and set ROI button
          const outstandingAmount = parseINR(newObligations[index].outstanding);
          if (outstandingAmount > 0) {
            const emiAmount = outstandingAmount * 0.05; // 5% of outstanding amount
            newObligations[index] = { 
              ...newObligations[index], 
              emi: formatINR(emiAmount.toString()),
              roi: '5%',
              selectedRoiPercentage: 5,
              selectedTenurePercentage: null
            };
          }
        }
        
        // Handle outstanding changes for credit card
        if (field === 'outstanding') {
          const outstandingAmount = parseINR(value);
          if (outstandingAmount > 0) {
            // Automatically calculate 5% EMI for credit card and set ROI button
            const emiAmount = outstandingAmount * 0.05; // 5% of outstanding amount
            newObligations[index] = { 
              ...newObligations[index], 
              emi: formatINR(emiAmount.toString()),
              roi: '5%',
              selectedRoiPercentage: 5,
              selectedTenurePercentage: null
            };
          } else {
            // Clear EMI and percentage if outstanding is cleared or zero
            newObligations[index] = {
              ...newObligations[index],
              emi: '',
              roi: '',
              selectedPercentage: null,
              selectedRoiPercentage: null,
              selectedTenurePercentage: null
            };
          }
        }
      } else if (field === 'product' && !isCreditCard(newObligations[index].product)) {
        // Clear all credit card specific fields if changing away from credit card
        newObligations[index] = { 
          ...newObligations[index], 
          selectedPercentage: null,
          selectedRoiPercentage: null,
          selectedTenurePercentage: null
        };
      }
      
      // Sort obligations based on action priority when action changes
      if (field === 'action') {
        console.log('🔄 Action changed via handleObligationChange, deferring sorting to preserve dropdown state:', {
          beforeSort: newObligations.map((o, i) => ({ index: i, action: o.action, id: o.id })),
        });
        
        // Notify parent component of changes immediately for unsaved changes detection
        if (handleChangeFunc) {
          handleChangeFunc('obligations', newObligations);
        }
        
        markAsChanged();
        
        // Don't sort immediately for action changes to prevent dropdown confusion
        // The sorting will be handled by the dropdown change handler
        return newObligations;
      } else {
        // DO NOT notify parent component during typing - only on blur
        // This prevents auto-save from triggering on every keystroke
        // if (handleChangeFunc) {
        //   handleChangeFunc('obligations', newObligations);
        // }
        
        markAsChanged();
        return newObligations;
      }
    });
  };

  // Ref to store debounce timer for blur events
  const blurSaveTimerRef = useRef(null);

  // Handler for blur events on obligation input fields - triggers debounced save
  const handleObligationFieldBlur = () => {
    // Only proceed if there are unsaved changes and we have user interaction
    if (!hasUnsavedChanges || !hasUserInteraction || !leadData?._id) {
      console.log('💾 [BLUR] Skipping save - no changes or no lead ID');
      return;
    }

    console.log('💾 [BLUR] Field unfocused, scheduling save in 500ms...');
    
    // Clear any existing timer
    if (blurSaveTimerRef.current) {
      clearTimeout(blurSaveTimerRef.current);
      console.log('💾 [BLUR] Cleared previous save timer');
    }
    
    // Set a new timer - will only save if no more blur events happen within 500ms
    blurSaveTimerRef.current = setTimeout(async () => {
      console.log('💾 [BLUR] 500ms elapsed with no more changes, saving now...');
      
      // Notify parent component about the final obligation state
      if (handleChangeFunc) {
        handleChangeFunc('obligations', obligations);
      }
      
      try {
        await handleSaveObligations();
        console.log('✅ [BLUR] Save completed successfully');
      } catch (error) {
        console.error('❌ [BLUR] Save failed:', error);
      }
    }, 500); // Wait 500ms (0.5 seconds) after last blur before saving
  };

  // Handle credit card tenure (4%) selection with mutual exclusivity
  const handleCreditCardTenure = (index) => {
    setObligations(prevObligations => {
      const newObligations = [...prevObligations];
      const outstandingAmount = parseINR(newObligations[index].outstanding);
      
      // Only proceed if there's an outstanding amount
      if (outstandingAmount > 0) {
        // If 4% is already selected for tenure, deactivate it
        if (newObligations[index].selectedTenurePercentage === 4) {
          newObligations[index] = {
            ...newObligations[index],
            tenure: '',
            roi: '',
            emi: '',
            selectedTenurePercentage: null,
            selectedRoiPercentage: null
          };
        } else {
          // Activate 4% for tenure and deactivate ROI (mutual exclusivity)
          newObligations[index] = {
            ...newObligations[index],
            tenure: '48 Months', // Standard 4 year tenure for credit card
            roi: '4%', // Set ROI to 4% for calculation
            selectedTenurePercentage: 4,
            selectedRoiPercentage: null // Clear ROI button selection
          };
          
          // Calculate EMI immediately when 4% is selected
          const emiAmount = outstandingAmount * 0.04; // 4% of outstanding
          newObligations[index].emi = formatINR(emiAmount.toString());
        }
        
        // Notify parent component of changes immediately for unsaved changes detection
        if (handleChangeFunc) {
          handleChangeFunc('obligations', newObligations);
        }
        
        markAsChanged();
        return newObligations;
      }
      
      return prevObligations;
    });
  };

  // Handle credit card ROI (5%) selection with mutual exclusivity
  const handleCreditCardRoi = (index) => {
    setObligations(prevObligations => {
      const newObligations = [...prevObligations];
      const outstandingAmount = parseINR(newObligations[index].outstanding);
      
      // Only proceed if there's an outstanding amount
      if (outstandingAmount > 0) {
        // If 5% is already selected for ROI, deactivate it
        if (newObligations[index].selectedRoiPercentage === 5) {
          newObligations[index] = {
            ...newObligations[index],
            tenure: '',
            roi: '',
            emi: '',
            selectedTenurePercentage: null,
            selectedRoiPercentage: null
          };
        } else {
          // Activate 5% for ROI and deactivate tenure (mutual exclusivity)
          newObligations[index] = {
            ...newObligations[index],
            tenure: '60 Months', // Standard 5 year tenure for credit card
            roi: '5%',
            selectedTenurePercentage: null, // Clear tenure button selection
            selectedRoiPercentage: 5
          };
          
          // Calculate EMI immediately when 5% is selected
          const emiAmount = outstandingAmount * 0.05; // 5% of outstanding
          newObligations[index].emi = formatINR(emiAmount.toString());
        }
        
        // Notify parent component of changes immediately for unsaved changes detection
        if (handleChangeFunc) {
          handleChangeFunc('obligations', newObligations);
        }
        
        markAsChanged();
        return newObligations;
      }
      
      return prevObligations;
    });
  };

  // Legacy function - keep for backward compatibility but mark as deprecated
  const handleCreditCardEmiPercentage = (index, percentage) => {
    console.warn('handleCreditCardEmiPercentage is deprecated. Use handleCreditCardTenure or handleCreditCardRoi instead.');
    // For backward compatibility, if percentage is 4, treat as tenure, if 5, treat as ROI
    if (percentage === 4) {
      handleCreditCardTenure(index);
    } else if (percentage === 5) {
      handleCreditCardRoi(index);
    }
  };

  const handleAddObligation = () => {
    const newIndex = obligations.length;
    const newObligations = [...obligations, {
      id: Date.now() + Math.random(), // Add unique ID
      product: '',
      bankName: '',
      tenure: '',
      roi: '',
      totalLoan: '',
      outstanding: '',
      emi: '',
      action: 'Obligate',
      selectedPercentage: null, // Keep for backward compatibility
      selectedTenurePercentage: null, // For 4% tenure button
      selectedRoiPercentage: null // For 5% ROI button
    }];
    setObligations(newObligations);
    
    // Initialize search states for the new row
    initializeSearchState(newIndex);
    
    // Notify parent component of changes immediately for unsaved changes detection
    if (handleChangeFunc) {
      handleChangeFunc('obligations', newObligations);
    }
  };

  const handleDeleteObligation = (index) => {
    if (obligations.length > 1) {
      // Create a new array without the deleted row
      const newObligations = obligations.filter((_, i) => i !== index);
      setObligations(newObligations);
      
      // Clean up search states for deleted row and reindex remaining rows
      const newProductSearchStates = {};
      const newBankSearchStates = {};
      
      if (productSearchStates && typeof productSearchStates === 'object') {
        Object.keys(productSearchStates).forEach(key => {
          const idx = parseInt(key);
          if (idx < index) {
            newProductSearchStates[idx] = productSearchStates[key];
          } else if (idx > index) {
            newProductSearchStates[idx - 1] = productSearchStates[key];
          }
        });
      }
      
      if (bankSearchStates && typeof bankSearchStates === 'object') {
        Object.keys(bankSearchStates).forEach(key => {
          const idx = parseInt(key);
          if (idx < index) {
            newBankSearchStates[idx] = bankSearchStates[key];
          } else if (idx > index) {
            newBankSearchStates[idx - 1] = bankSearchStates[key];
          }
        });
      }
      
      setProductSearchStates(newProductSearchStates);
      setBankSearchStates(newBankSearchStates);
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      // Notify parent component of changes immediately for unsaved changes detection
      if (handleChangeFunc) {
        handleChangeFunc('obligations', newObligations);
      }
      
      console.log(`Deleted obligation row at index ${index}. ${newObligations.length} rows remaining.`);
      
      // Trigger immediate save after deletion
      console.log('💾 [DELETE] Row deleted, triggering immediate save...');
      setTimeout(async () => {
        try {
          await handleSaveObligations();
          console.log('✅ [DELETE] Save completed successfully after row deletion');
        } catch (error) {
          console.error('❌ [DELETE] Save failed after row deletion:', error);
        }
      }, 100); // Small delay to ensure state is updated
    } else {
      // If it's the last row, just clear the values but keep the row
      console.log("Can't delete the last row. Clearing values instead.");
      const clearedObligation = {
        product: '',
        bankName: '',
        tenure: '',
        roi: '',
        totalLoan: '',
        outstanding: '',
        emi: '',
        action: 'Obligate',
        selectedPercentage: null
      };
      const clearedObligations = [clearedObligation];
      setObligations(clearedObligations);
      
      // Reset search states for the cleared row
      setProductSearchStates({ 0: { isOpen: false, searchQuery: '' } });
      setBankSearchStates({ 0: { isOpen: false, searchQuery: '' } });
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      // Notify parent component of changes immediately for unsaved changes detection
      if (handleChangeFunc) {
        handleChangeFunc('obligations', clearedObligations);
      }
    }
  };

  // Eligibility handlers
  const handleCeCompanyCategoryChange = (e) => {
    const value = e.target.value;
    setCeCompanyCategory(value);
    
    // Mark as changed to trigger save button
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    console.log("Company category changed:", value);
    
    // DO NOT notify parent on every change - only on blur/save
    // if (handleChangeFunc) {
    //   handleChangeFunc('ce_company_category', value);
    // }
  };

  const handleCeFoirPercentChange = (e) => {
    const value = e.target.value;
    setCeFoirPercent(value);
    
    // Mark as changed to trigger save button
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    
    // If switching to custom, start with empty value
    if (value === 'custom') {
      setCeCustomFoirPercent('');
    }
    
    // DO NOT notify parent on every change - only on blur/save
    // if (handleChangeFunc) {
    //   handleChangeFunc('ce_foir_percent', value);
    // }
    
    console.log("FOIR percent changed:", value);
  };

  const handleCeTenureMonthsChange = (e) => {
    const input = e.target;
    const cursorPosition = input.selectionStart;
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const formattedValue = rawValue ? formatTenure(rawValue) : '';
    const months = Number(rawValue);
    setCeTenureMonths(formattedValue);
    
    // Mark as changed to trigger save button
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    console.log("Tenure months changed:", formattedValue);
    
    // Format years with proper display
    if (months) {
      const totalYears = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      if (remainingMonths === 0) {
        setCeTenureYears(`${totalYears} Years`);
      } else if (remainingMonths === 1) {
        setCeTenureYears(`${totalYears} Years 1 Month`);
      } else {
        setCeTenureYears(`${totalYears} Years ${remainingMonths} Months`);
      }
    } else {
      setCeTenureYears('');
    }
    
    // Restore cursor position after formatting
    setTimeout(() => {
      if (input && rawValue) {
        const newPosition = Math.min(cursorPosition, rawValue.length);
        input.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleCeTenureYearsChange = (e) => {
    const input = e.target;
    const cursorPosition = input.selectionStart;
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const years = Number(rawValue);
    
    // Mark as changed to trigger save button
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    console.log("Tenure years changed:", rawValue);
    
    if (rawValue) {
      setCeTenureYears(`${rawValue} Years`);
      setCeTenureMonths(formatTenure((years * 12).toString()));
    } else {
      setCeTenureYears('');
      setCeTenureMonths('');
    }
    
    // Restore cursor position after formatting
    setTimeout(() => {
      if (input && rawValue) {
        const newPosition = Math.min(cursorPosition, rawValue.length);
        input.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleCeRoiChange = (e) => {
    const input = e.target;
    const cursorPosition = input.selectionStart;
    const rawValue = e.target.value.replace(/[^0-9.]/g, "");
    const formattedValue = rawValue ? formatROI(rawValue) : '';
    setCeRoi(formattedValue);
    
    // Mark as changed to trigger save button
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    console.log("ROI changed:", formattedValue);
    
    // Restore cursor position after formatting
    setTimeout(() => {
      if (input && rawValue) {
        const newPosition = Math.min(cursorPosition, rawValue.length);
        input.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleCeMultiplierChange = (e) => {
    const value = e.target.value;
    setCeMultiplier(value);
    
    // Mark as changed to trigger save button
    setHasUserInteraction(true);
    setHasUnsavedChanges(true);
    console.log("Multiplier changed:", value);
  };

  // Get row styling - No background colors, just clean white rows
  const getRowStyling = (action) => {
    return 'bg-white border-white'; // Clean white rows with white borders
  };

  // Get input styling based on action - Color the cell content based on action
  const getInputStyling = (action) => {
    switch (action) {
      case 'BT':
        return 'bg-green-400 border-green-600 text-black font-bold'; // Green background for BT cells
      case 'Obligate':
        return 'bg-yellow-400 border-yellow-600 text-black font-bold'; // Yellow background for Obligate cells
      case 'CO-PAY':
        return 'bg-orange-400 border-orange-600 text-black font-bold'; // Orange background for CO-PAY cells
      case 'NO-PAY':
        return 'bg-blue-400 border-blue-600 text-black font-bold'; // Blue background for NO-PAY cells
      case 'Closed':
        return 'bg-red-400 border-red-600 text-black font-bold'; // Red background for Closed cells
      default:
        return 'bg-yellow-400 border-yellow-600 text-black font-bold'; // Default to Obligate styling
    }
  };

  // Get action select styling - Color the action dropdown based on selected action
  const getActionSelectStyling = (action) => {
    switch (action) {
      case 'BT':
        return 'bg-green-400 border-green-600 text-black font-bold'; // Green background for BT
      case 'Obligate':
        return 'bg-yellow-400 border-yellow-600 text-black font-bold'; // Yellow background for Obligate
      case 'CO-PAY':
        return 'bg-orange-400 border-orange-600 text-black font-bold'; // Orange background for CO-PAY
      case 'NO-PAY':
        return 'bg-blue-400 border-blue-600 text-black font-bold'; // Blue background for NO-PAY
      case 'Closed':
        return 'bg-red-400 border-red-600 text-black font-bold'; // Red background for Closed
      default:
        return 'bg-white border-gray-300 text-black font-bold'; // Default white background for no action
    }
  };

  // Bank handlers for Decide Bank For Case - Updated to support multiple selections
  const handleRemoveBank = (bankToRemove) => {
    if (bankToRemove) {
      // Remove specific bank from companyType array
      setCompanyType(prev => {
        const updatedBanks = prev.filter(bank => bank !== bankToRemove);
        
        // Notify parent component of changes immediately for unsaved changes detection
        if (handleChangeFunc) {
          handleChangeFunc('company_type', updatedBanks);
        }
        
        return updatedBanks;
      });
      console.log('Removed bank:', bankToRemove);
      
      // Mark as changed to trigger auto-save
      markAsChanged();
      setHasUnsavedChanges(true);
      setHasUserInteraction(true);
    } else {
      // Clear all banks
      setCompanyType([]);
      
      // Notify parent component of changes immediately for unsaved changes detection
      if (handleChangeFunc) {
        handleChangeFunc('company_type', []);
      }
      
      console.log('All banks cleared');
      
      // Mark as changed to trigger auto-save
      markAsChanged();
      setHasUnsavedChanges(true);
      setHasUserInteraction(true);
    }
  };

  // Download obligations as PDF - Exact UI capture
  const handleDownloadObligations = async () => {
    try {
      console.log('🎯 Starting UI capture for PDF generation...');
      console.log('📊 Eligibility state at PDF generation:', {
        eligibility: eligibility,
        finalEligibility: eligibility?.finalEligibility,
        backendFinalEligibility: backendFinalEligibility,
        backendEligibilityLoaded: backendEligibilityLoaded
      });
      
      // Create a container element that will hold our PDF content
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'fixed';
      pdfContainer.style.top = '-9999px';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.width = '1200px';
      pdfContainer.style.background = 'white';
      pdfContainer.style.padding = '20px';
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.color = 'black';
      
      // Create the PDF content HTML that matches the UI exactly
      pdfContainer.innerHTML = `
        <div style="background: white; color: black; padding: 20px; width: 100%; box-sizing: border-box;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
            <h1 style="color: black; margin: 0; font-size: 28px; font-weight: bold;">Customer Obligation Report</h1>
            <p style="margin: 10px 0; font-size: 16px;"><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
            ${leadData?.name ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Customer:</strong> ${leadData.name}</p>` : ''}
            ${leadData?.phone ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Phone:</strong> ${leadData.phone}</p>` : ''}
          </div>

          <!-- Customer Details Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: black; font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #ccc; padding-bottom: 10px;">Customer Details</h2>
            
            <!-- Financial Information Row -->
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Salary</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 18px; font-weight: bold;">₹${salary || '0'}</div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Partner's Salary</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 18px; font-weight: bold;">₹${partnerSalary || '0'}</div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Bonus ${bonusDivision ? `(Divide by ${bonusDivision} Month${bonusDivision === 1 ? '' : 's'})` : ''}</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 18px; font-weight: bold;">₹${yearlyBonus || '0'}</div>
              </div>
            </div>

            <!-- Second Row -->
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Loan Amount Required</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 18px; font-weight: bold;">₹${loanRequired || '0'}</div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Company Name</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 18px; font-weight: bold;">${companyName || 'N/A'}</div>
              </div>
            </div>

            <!-- Third Row -->
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Decide Bank For Case</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 16px; font-weight: bold;">
                  ${Array.isArray(companyType) && companyType.length > 0 ? 
                    companyType.map(bank => `<span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; margin: 2px; border-radius: 6px; font-weight: bold;">${bank}</span>`).join(' ') : 
                    'N/A'
                  }
                </div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: black; margin-bottom: 5px;">Company Category</label>
                <div style="padding: 12px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; font-size: 16px; font-weight: bold;">
                  ${Array.isArray(companyCategory) && companyCategory.length > 0 ? 
                    companyCategory.map(cat => {
                      const displayText = typeof cat === 'object' ? (cat.display_text || cat.category_name || 'Unknown') : cat;
                      return `<span style="display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; margin: 2px; border-radius: 6px; font-weight: bold;">${displayText}</span>`;
                    }).join(' ') : 
                    'N/A'
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Customer Obligations Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #10b981; font-size: 32px; font-weight: bold; text-align: center; margin-bottom: 20px;">Customer Obligations</h2>
            
            <!-- Summary Section -->
            <div style="display: flex; gap: 20px; margin-bottom: 30px; justify-content: center;">
              <div style="text-align: center;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: #10b981; margin-bottom: 10px;">TOTAL BT POS</label>
                <div style="background: #10b981; color: black; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; min-width: 200px;">₹${totalBtPos}</div>
              </div>
              <div style="text-align: center;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: #facc15; margin-bottom: 10px;">TOTAL OBLIGATION</label>
                <div style="background: #facc15; color: black; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; min-width: 200px;">₹${totalObligation}</div>
              </div>
              <div style="text-align: center;">
                <label style="display: block; font-weight: bold; font-size: 18px; color: #60a5fa; margin-bottom: 10px;">CIBIL SCORE</label>
                <div style="background: #dbeafe; color: black; padding: 15px 30px; border: 2px solid #60a5fa; border-radius: 8px; font-size: 24px; font-weight: bold; min-width: 200px;">${cibilScore || 'N/A'}</div>
              </div>
            </div>
          </div>

          <!-- Obligations Table -->
          <div style="margin-bottom: 30px;">
            <div style="background: #374151; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
              <h3 style="margin: 0; font-size: 20px; font-weight: bold;">Bank-wise Customer Obligations</h3>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; border: 2px solid #374151;">
              <thead>
                <tr style="background: black; color: white;">
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">#</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">PRODUCT</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">BANK NAME</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">TENURE</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">ROI %</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">TOTAL LOAN</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">OUTSTANDING</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">EMI</th>
                  <th style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 14px;">ACTION</th>
                </tr>
              </thead>
              <tbody>
                ${obligations.map((obl, index) => {
                  // Determine action-based styling
                  let actionBg = '#f8f9fa';
                  let actionColor = 'black';
                  const action = (obl.action || '').toLowerCase();
                  
                  switch (action) {
                    case 'bt':
                      actionBg = '#4ade80';
                      actionColor = 'black';
                      break;
                    case 'obligate':
                      actionBg = '#facc15';
                      actionColor = 'black';
                      break;
                    case 'co-pay':
                    case 'copay':
                      actionBg = '#fb923c';
                      actionColor = 'black';
                      break;
                    case 'no-pay':
                    case 'nopay':
                      actionBg = '#60a5fa';
                      actionColor = 'black';
                      break;
                    case 'closed':
                      actionBg = '#f87171';
                      actionColor = 'black';
                      break;
                  }
                  
                  return `
                    <tr style="background: ${index % 2 === 0 ? '#f8f9fa' : 'white'};">
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 12px;">${index + 1}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; font-weight: bold; font-size: 12px;">${obl.product || 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; font-weight: bold; font-size: 12px;">${obl.bankName || 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 12px;">${obl.tenure || 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; font-weight: bold; font-size: 12px;">${obl.roi || 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: right; font-weight: bold; font-size: 12px;">${obl.totalLoan ? '₹' + obl.totalLoan : 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: right; font-weight: bold; font-size: 12px;">${obl.outstanding ? '₹' + obl.outstanding : 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: right; font-weight: bold; font-size: 12px;">${obl.emi ? '₹' + obl.emi : 'N/A'}</td>
                      <td style="padding: 12px 8px; border: 2px solid #6b7280; text-align: center; background: ${actionBg}; color: ${actionColor}; font-weight: bold; font-size: 12px;">${obl.action || 'N/A'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Check Eligibility Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: black; font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #ccc; padding-bottom: 10px;">CHECK ELIGIBILITY</h2>
            
            <!-- First Row -->
            <div style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
              <!-- Total Income -->
              <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">Total Income</label>
                <div style="padding: 8px; background: black; color: white; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold;">₹${eligibility.totalIncome || '0'}</div>
              </div>
              <!-- Company Category -->
              <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">Company Category</label>
                <div style="padding: 8px; background: #f8f9fa; border: 2px solid #6b7280; border-radius: 6px; font-size: 16px; font-weight: bold;">${ceCompanyCategory || 'N/A'}</div>
              </div>
              <!-- FOIR % -->
              <div style="flex: 1; min-width: 120px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">FOIR %</label>
                <div style="padding: 8px; background: #f8f9fa; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold; text-align: center;">${ceFoirPercent === 'custom' ? ceCustomFoirPercent || '60%' : ceFoirPercent + '%'}</div>
              </div>
              <!-- FOIR Amount -->
              <div style="flex: 1; min-width: 160px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">FOIR Amount</label>
                <div style="padding: 8px; background: black; color: white; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold;">₹${eligibility.foirAmount || '0'}</div>
              </div>
              <!-- Total Obligation -->
              <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">Total Obligation</label>
                <div style="padding: 8px; background: #facc15; color: black; border: 2px solid #eab308; border-radius: 6px; font-size: 18px; font-weight: bold;">₹${eligibility.totalObligations || totalObligation || '0'}</div>
              </div>
            </div>

            <!-- Second Row -->
            <div style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
              <!-- Monthly EMI Can Pay -->
              <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">Monthly EMI Can Pay</label>
                <div style="padding: 8px; background: black; color: white; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold;">₹${ceMonthlyEmiCanPay || '0'}</div>
              </div>
              <!-- Tenure (Months) -->
              <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">TENURE (Months)</label>
                <div style="padding: 8px; background: #f8f9fa; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold; text-align: center;">${ceTenureMonths || 'N/A'}</div>
              </div>
              <!-- Tenure (Years) -->
              <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">TENURE (Years)</label>
                <div style="padding: 8px; background: black; color: white; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold; text-align: center;">${ceTenureYears || 'N/A'}</div>
              </div>
              <!-- ROI -->
              <div style="flex: 1; min-width: 140px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">ROI</label>
                <div style="padding: 8px; background: #f8f9fa; border: 2px solid #6b7280; border-radius: 6px; font-size: 18px; font-weight: bold; text-align: center;">${ceRoi || 'N/A'}</div>
              </div>
              <!-- TOTAL BT POS -->
              <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">TOTAL BT POS</label>
                <div style="padding: 8px; background: #22c55e; color: black; border: 2px solid #16a34a; border-radius: 6px; font-size: 18px; font-weight: bold;">₹${eligibility.totalBtPos || totalBtPos || '0'}</div>
              </div>
            </div>

            <!-- Third Row - Loan Eligibility Results -->
            <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;">
              <!-- FOIR Eligibility -->
              <div style="flex: 1; min-width: 280px;">
                <label style="display: block; font-weight: bold; font-size: 16px; color: black; margin-bottom: 5px;">FOIR Eligibility</label>
                <div style="padding: 20px; background: black; color: white; border: 2px solid #6b7280; border-radius: 6px; font-size: 24px; font-weight: bold; text-align: center;">${
                  (() => {
                    const value = eligibility.finalEligibility || '0';
                    // If value already has ₹, return as is, otherwise add ₹
                    return value.includes('₹') ? value : `₹${value}`;
                  })()
                }</div>
              </div>
              <!-- Multiplier Eligibility -->
              <div style="flex: 1; min-width: 280px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <label style="font-weight: bold; font-size: 16px; color: black;">Multiplier Eligibility</label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 12px; font-weight: bold; color: black;">Multiplier:</span>
                    <div style="padding: 4px 8px; background: #facc15; color: black; border: 2px solid #eab308; border-radius: 4px; font-weight: bold; font-size: 14px;">${ceMultiplier || '0'}</div>
                  </div>
                </div>
                <div style="padding: 20px; background: black; color: white; border: 2px solid #6b7280; border-radius: 6px; font-size: 24px; font-weight: bold; text-align: center;">₹${eligibility.multiplierEligibility || '0'}</div>
              </div>
            </div>

            <!-- Balance Transfer Eligibility Message -->
            ${(() => {
              const foirEligibility = parseFloat((eligibility?.finalEligibility || '0').replace(/[^\d.-]/g, '')) || 0;
              const totalBtPosValue = parseFloat((eligibility?.totalBtPos || totalBtPos || '0').replace(/[^\d.-]/g, '')) || 0;
              
              if (foirEligibility > 0 && totalBtPosValue > 0) {
                if (foirEligibility >= totalBtPosValue) {
                  return `
                    <div style="padding: 24px; background: #00FF00; color: black; border-radius: 8px; text-align: center; margin-top: 20px;">
                      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                        <div style="width: 32px; height: 32px; margin-right: 12px;">✓</div>
                        <h2 style="font-size: 28px; font-weight: bold; margin: 0;">Congratulations!</h2>
                      </div>
                      <p style="font-size: 20px; font-weight: bold; margin: 0;">Balance Transfer is Eligible</p>
                    </div>
                  `;
                } else {
                  const shortfall = totalBtPosValue - foirEligibility;
                  return `
                    <div style="padding: 24px; background: #FF0000; color: white; border-radius: 8px; text-align: center; margin-top: 20px;">
                      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                        <div style="width: 32px; height: 32px; margin-right: 12px;">✗</div>
                        <h2 style="font-size: 28px; font-weight: bold; margin: 0;">Balance Transfer Not Possible</h2>
                      </div>
                      <p style="font-size: 20px; font-weight: bold; margin: 0;">There is a shortfall of ₹${shortfall.toLocaleString('en-IN')}</p>
                    </div>
                  `;
                }
              }
              return '';
            })()}
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ccc; font-size: 12px; color: #666;">
            <p>This report was generated automatically from the Customer Obligation Management System</p>
            <p>Report ID: ${Date.now()} | Version: 2.0</p>
          </div>
        </div>
      `;

      // Append to document
      document.body.appendChild(pdfContainer);

      // Wait for content to be rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the content with html2canvas
      const canvas = await html2canvas(pdfContainer, {
        scale: 2, // Higher quality
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 1200,
        height: pdfContainer.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });

      // Remove the temporary container
      document.body.removeChild(pdfContainer);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Calculate dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF
      const fileName = `Customer_Obligation_Report_${leadData?.name ? leadData.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Report'}_${new Date().getTime()}.pdf`;
      pdf.save(fileName);

      console.log('✅ UI-matched PDF generated successfully:', fileName);
    } catch (error) {
      console.error('❌ Error generating UI-matched PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleAddBank = (newBankName) => {
    console.log('Selected bank for Decide Bank For Case:', newBankName);
    
    // Check if bank is already selected to prevent duplicates
    if (companyType.includes(newBankName)) {
      console.log('Bank already selected:', newBankName);
      return;
    }
    
    // Add new bank to the existing list (multiple selection allowed)
    setCompanyType(prevBanks => {
      const updatedBanks = [...prevBanks, newBankName];
      console.log('Updated bank list:', updatedBanks);
      
      // Notify parent component of changes immediately for unsaved changes detection
      if (handleChangeFunc) {
        handleChangeFunc('company_type', updatedBanks);
      }
      
      return updatedBanks;
    });
    
    console.log('Bank added to selection:', newBankName);
    console.log('Multiple bank selection enabled');
    
    // Mark as changed to trigger auto-save
    markAsChanged();
    setHasUnsavedChanges(true);
    setHasUserInteraction(true);
    
    // Also add to bankList if not already included, for obligations dropdown
    setBankList(prevBanks => {
      if (!prevBanks.includes(newBankName)) {
        return [...prevBanks, newBankName];
      }
      return prevBanks;
    });
  };

  // Category handlers for multiple selection
  const handleRemoveCategory = (categoryToRemove) => {
    setCompanyCategory((prev) => {
      const newList = prev.filter((category) => {
        // Handle both string (legacy) and object (new format) comparisons
        if (typeof categoryToRemove === 'string') {
          if (typeof category === 'string') {
            return category !== categoryToRemove;
          } else if (typeof category === 'object') {
            return category.key !== categoryToRemove && category.display !== categoryToRemove;
          }
        } else if (typeof categoryToRemove === 'object') {
          if (typeof category === 'string') {
            return category !== categoryToRemove.key && category !== categoryToRemove.display;
          } else if (typeof category === 'object') {
            return category.key !== categoryToRemove.key;
          }
        }
        return true;
      });
      console.log('Category removed:', categoryToRemove, 'New list:', newList);
      
      // Notify parent component of changes immediately for unsaved changes detection
      if (handleChangeFunc) {
        handleChangeFunc('company_category', newList);
      }
      
      return newList;
    });
  };

  const handleAddCategory = (newCategoryData, isRemove = false) => {
    console.log('handleAddCategory called with:', { newCategoryData, isRemove });
    
    // Handle both string (legacy) and object (new format) inputs
    let categoryKey, displayText, categoryName;
    
    if (typeof newCategoryData === 'string') {
      // Legacy format - just the category name
      categoryKey = newCategoryData;
      displayText = newCategoryData;
      categoryName = newCategoryData;
    } else if (typeof newCategoryData === 'object' && newCategoryData !== null) {
      // New format - full category object with company, bank, and category info
      const { company_name, bank_name, category_name, display_key } = newCategoryData;
      categoryKey = display_key || category_name; // Use display_key as unique identifier
      categoryName = category_name; // Extract just the category name for backend
      
      // Create display text in format: "Company → Bank → Category" or "Company → Category"
      if (company_name && bank_name && category_name) {
        displayText = `${company_name} → ${bank_name} → ${category_name}`;
      } else if (company_name && category_name) {
        displayText = `${company_name} → ${category_name}`;
      } else {
        displayText = category_name || categoryKey;
      }
    } else {
      console.error('Invalid category data format:', newCategoryData);
      return;
    }
    
    console.log('Processed category:', { categoryKey, displayText, categoryName });
    
    if (isRemove) {
      // If this is a remove operation from the popup
      console.log('Removing category from main display:', categoryKey);
      setCompanyCategory((prev) => {
        const newList = prev.filter((category) => {
          // Handle both string and object comparisons
          if (typeof category === 'string') {
            // For legacy string format, compare with categoryKey/displayText/categoryName
            return category !== categoryKey && category !== displayText && category !== categoryName;
          } else if (typeof category === 'object') {
            // For object format, compare all three: company_name, bank_name, and category_name
            const existingCompany = category.company_name || '';
            const existingBank = category.bank_name || '';
            const existingCategory = category.category_name || category.key || category.display || '';
            
            const removeCompany = newCategoryData.company_name || '';
            const removeBank = newCategoryData.bank_name || '';
            
            // Keep the category if it doesn't match all three components
            return !(existingCompany === removeCompany && 
                    existingBank === removeBank && 
                    existingCategory === categoryName);
          }
          return true;
        });
        console.log('Category removed:', {
          company: newCategoryData.company_name,
          bank: newCategoryData.bank_name,
          category: categoryName
        }, 'New list:', newList);
        
        // Notify parent component of changes immediately for unsaved changes detection
        // Send complete category objects with all information
        if (handleChangeFunc) {
          const categoryObjects = newList.map(cat => {
            if (typeof cat === 'string') {
              return {
                company_name: companyName || '',
                bank_name: '',
                category_name: cat,
                display: cat
              };
            } else if (typeof cat === 'object') {
              return {
                company_name: cat.company_name || companyName || '',
                bank_name: cat.bank_name || '',
                category_name: cat.category_name || cat.key || cat.display || '',
                display: cat.display || cat.key || '',
                ...cat
              };
            }
            return cat;
          });
          handleChangeFunc('company_category', categoryObjects);
        }
        
        return newList;
      });
      return;
    }
    
    // Check if this exact combination of company+bank+category already exists (prevent duplicates)
    if (Array.isArray(companyCategory)) {
      const categoryAlreadyExists = companyCategory.some((category) => {
        if (typeof category === 'string') {
          // For legacy string format, compare with categoryName only
          return category === categoryName;
        } else if (typeof category === 'object') {
          // For object format, compare all three: company_name, bank_name, and category_name
          const existingCompany = category.company_name || '';
          const existingBank = category.bank_name || '';
          const existingCategory = category.category_name || category.key || category.display || '';
          
          const newCompany = newCategoryData.company_name || '';
          const newBank = newCategoryData.bank_name || '';
          
          return existingCompany === newCompany && 
                 existingBank === newBank && 
                 existingCategory === categoryName;
        }
        return false;
      });
      
      if (categoryAlreadyExists) {
        console.log('Exact combination of company+bank+category already exists, not adding again:', {
          company: newCategoryData.company_name,
          bank: newCategoryData.bank_name,
          category: categoryName
        });
        return;
      }
    }
    
    console.log('Adding category to main display:', displayText);
    setCompanyCategory((prevCategories) => {
      const currentCategories = Array.isArray(prevCategories) ? prevCategories : [];
      
      // Store as object with both key and display text for full information
      const categoryObject = {
        key: categoryKey,
        display: displayText,
        category_name: categoryName, // Store the actual category name for backend
        ...newCategoryData // Include all original data for reference
      };
      
      const newList = [...currentCategories, categoryObject];
      console.log('Category added:', displayText, 'New list:', newList);
      
      // Notify parent component of changes immediately for unsaved changes detection
      // Send complete category objects with all information
      if (handleChangeFunc) {
        const categoryObjects = newList.map(cat => {
          if (typeof cat === 'string') {
            return {
              company_name: companyName || '',
              bank_name: '',
              category_name: cat,
              display: cat
            };
          } else if (typeof cat === 'object') {
            return {
              company_name: cat.company_name || companyName || '',
              bank_name: cat.bank_name || '',
              category_name: cat.category_name || cat.key || cat.display || '',
              display: cat.display || cat.key || '',
              ...cat
            };
          }
          return cat;
        });
        console.log('Sending complete category objects to backend:', categoryObjects);
        handleChangeFunc('company_category', categoryObjects);
      }
      
      // Auto-update company name with the first company from categories if not already set
      if (newList.length > 0) {
        // Find the first category with a company name
        const firstCategoryWithCompany = newList.find(cat => {
          if (typeof cat === 'object' && cat.company_name) {
            return cat.company_name.trim() !== '';
          }
          return false;
        });
        
        if (firstCategoryWithCompany && firstCategoryWithCompany.company_name) {
          // Update company name if it's empty or if we want to always use first company
          if (!companyName.trim()) {
            console.log('Auto-updating company name to first company:', firstCategoryWithCompany.company_name);
            setCompanyName(firstCategoryWithCompany.company_name);
            if (handleChangeFunc) {
              handleChangeFunc('company_name', firstCategoryWithCompany.company_name);
            }
          }
        }
      }
      
      return newList;
    });
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
  };

  // Initialize search states for new obligations - defined as regular function to avoid initialization errors
  function initializeSearchState(index) {
    setProductSearchStates(prev => ({
      ...prev,
      [index]: { isOpen: false, searchQuery: '' }
    }));
    setBankSearchStates(prev => ({
      ...prev,
      [index]: { isOpen: false, searchQuery: '' }
    }));
  }

  // Function to calculate optimal dropdown position - defined as regular function to avoid initialization errors
  function calculateDropdownPosition(triggerElement) {
    if (!triggerElement) return { openUpward: false, left: 0, top: 0, width: 200 };
    
    const rect = triggerElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 250; // Estimated height of dropdown with search and options
    const dropdownWidth = Math.max(rect.width, 300); // Minimum 300px width for better UX
    
    // Calculate space below and above
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // If there's not enough space below, open upward
    const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    
    // Calculate position relative to viewport
    let left = rect.left;
    let top = shouldOpenUpward ? rect.top - dropdownHeight : rect.bottom;
    
    // Ensure dropdown doesn't go off-screen horizontally
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 10; // 10px margin from edge
    }
    if (left < 10) {
      left = 10; // 10px margin from left edge
    }
    
    // Ensure dropdown doesn't go off-screen vertically
    if (top < 10) {
      top = 10;
    }
    if (top + dropdownHeight > viewportHeight - 10) {
      top = viewportHeight - dropdownHeight - 10;
    }
    
    return { 
      openUpward: shouldOpenUpward, 
      left: left, 
      top: top, 
      width: dropdownWidth 
    };
  }

  // Function to close all dropdowns - centralized function for consistency
  function closeAllDropdowns() {
    // Close all product dropdowns
    setProductSearchStates(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        updated[key] = { ...prev[key], isOpen: false };
      });
      return updated;
    });
    
    // Close all bank dropdowns
    setBankSearchStates(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        updated[key] = { ...prev[key], isOpen: false };
      });
      return updated;
    });
    
    // Close company dropdown
    setCompanyDropdownOpen(false);
  }

  // Handlers for product dropdown - defined as regular functions to avoid initialization errors
  function handleProductDropdownToggle(index) {
    if (!safeProductSearchStates || typeof safeProductSearchStates !== 'object') {
      console.warn('productSearchStates not properly initialized');
      return;
    }
    const isOpening = !(safeProductSearchStates && safeProductSearchStates[index]?.isOpen);
    
    if (isOpening) {
      // Close all other dropdowns first (both product and bank dropdowns)
      closeAllDropdowns();
      
      // Calculate position when opening
      const triggerElement = dropdownRefs.current[`product-${index}`];
      const position = calculateDropdownPosition(triggerElement);
      
      setDropdownPositions(prev => ({
        ...prev,
        [`product-${index}`]: position
      }));
      
      // Open this specific product dropdown
      setProductSearchStates(prev => ({
        ...prev,
        [index]: { 
          ...prev[index], 
          isOpen: true,
          searchQuery: prev[index]?.searchQuery || ''
        }
      }));
    } else {
      // Close this dropdown
      setProductSearchStates(prev => ({
        ...prev,
        [index]: { 
          ...prev[index], 
          isOpen: false,
          searchQuery: prev[index]?.searchQuery || ''
        }
      }));
    }
  }

  function handleProductSearchChange(index, query) {
    if (!productSearchStates || typeof productSearchStates !== 'object') {
      console.warn('productSearchStates not properly initialized');
      return;
    }
    setProductSearchStates(prev => ({
      ...prev,
      [index]: { ...prev[index], searchQuery: query }
    }));
  }

  function handleProductSelect(index, product) {
    console.log(`Product selection triggered for index ${index} with product: "${product.label}"`);
    handleObligationChange(index, "product", product.value);
    setProductSearchStates(prev => ({
      ...prev,
      [index]: { isOpen: false, searchQuery: '' }
    }));
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    console.log(`Product dropdown closed for index ${index}`);
  }

  // Handlers for bank dropdown
  function handleBankDropdownToggle(index) {
    if (!bankSearchStates || typeof bankSearchStates !== 'object') {
      console.warn('bankSearchStates not properly initialized');
      return;
    }
    const isOpening = !(bankSearchStates && bankSearchStates[index]?.isOpen);
    
    if (isOpening) {
      // Close all other dropdowns first (both product and bank dropdowns)
      closeAllDropdowns();
      
      // Calculate position when opening
      const triggerElement = dropdownRefs.current[`bank-${index}`];
      const position = calculateDropdownPosition(triggerElement);
      
      setDropdownPositions(prev => ({
        ...prev,
        [`bank-${index}`]: position
      }));
      
      // Open this specific bank dropdown
      setBankSearchStates(prev => ({
        ...prev,
        [index]: { 
          ...prev[index], 
          isOpen: true,
          searchQuery: prev[index]?.searchQuery || ''
        }
      }));
    } else {
      // Close this dropdown
      setBankSearchStates(prev => ({
        ...prev,
        [index]: { 
          ...prev[index], 
          isOpen: false,
          searchQuery: prev[index]?.searchQuery || ''
        }
      }));
    }
  }

  function handleBankSearchChange(index, query) {
    if (!bankSearchStates || typeof bankSearchStates !== 'object') {
      console.warn('bankSearchStates not properly initialized');
      return;
    }
    setBankSearchStates(prev => ({
      ...prev,
      [index]: { ...prev[index], searchQuery: query }
    }));
  }

  function handleBankSelect(index, bank) {
    console.log(`Bank selection triggered for index ${index} with bank: "${bank}"`);
    const bankValue = bank.includes('') ? bank.replace(' ', '') : bank;
    console.log(`Cleaned bank value: "${bankValue}"`);
    
    handleObligationChange(index, "bankName", bankValue);
    
    setBankSearchStates(prev => ({
      ...prev,
      [index]: { isOpen: false, searchQuery: '' }
    }));
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    console.log(`Bank dropdown closed for index ${index}`);
  }

  // Handlers for company name dropdown
  function handleCompanyDropdownToggle() {
    const isOpening = !companyDropdownOpen;
    
    if (isOpening) {
      // Close all other dropdowns first
      closeAllDropdowns();
      
      // Load suggestions if we have enough text
      if (companyName.trim().length >= 2) {
        loadCompanySuggestions(companyName.trim());
      }
    }
    
    setCompanyDropdownOpen(isOpening);
  }

  function handleCompanySearchChange(query) {
    // No need for separate search query state since company name is the search
    
    // Load suggestions if we have any text
    if (query.trim().length >= 1) {
      // Debounce the search
      if (companySearchTimeout) {
        clearTimeout(companySearchTimeout);
      }
      
      const timeout = setTimeout(() => {
        loadCompanySuggestions(query.trim());
      }, 300);
      
      setCompanySearchTimeout(timeout);
    } else {
      setCompanySuggestions([]);
    }
  }

  async function handleCompanySelect(companyName) {
    console.log(`🏢 Company selected: "${companyName}"`);
    
    // Set flag to prevent onBlur interference
    setIsSelectingFromDropdown(true);
    
    // Set the company name immediately and mark as changed
    setCompanyName(companyName);
    setCompanyDropdownOpen(false);
    setHasUnsavedChanges(true);
    markAsChanged();
    
    // Immediately notify parent component to ensure the change is tracked
    if (handleChangeFunc) {
      handleChangeFunc('company_name', companyName);
    }
    
    // Clear suggestions after selection to prevent interference
    setCompanySuggestions([]);
    
    // Force focus on the input to ensure value is displayed
    setTimeout(() => {
      if (companyDropdownRef.current) {
        companyDropdownRef.current.focus();
        companyDropdownRef.current.blur(); // Immediately blur to trigger value display
      }
    }, 100);
    
    console.log(`✅ Company name set to: "${companyName}"`);
    
    // Load categories for the selected company
    if (companyName && companyName.trim()) {
      setIsLoadingCategories(true);
      try {
        console.log(`🏢 Loading categories for company: "${companyName}"`);
        const categories = await fetchCompanyCategoriesForCompany(companyName.trim());
        console.log(`📋 Categories received:`, categories);
        
        if (categories && categories.length > 0) {
          console.log(`🔄 Processing ${categories.length} categories...`);
          
          // Transform the API response to the expected format
          const formattedCategories = categories.map((company, index) => {
            console.log(`Processing category ${index}:`, company);
            
            const formatted = {
              id: `${company.company_name || 'Unknown'}-${company.bank_names?.[0] || 'Unknown'}-${company.categories?.[0] || 'Unknown'}-${index}`,
              company_name: company.company_name || 'Unknown',
              bank_name: company.bank_names?.[0] || company.bank_name || null,
              category_name: company.categories?.[0] || company.category_name || null,
              similarity_percentage: company.similarity_percentage || 0,
              display_key: `${company.company_name || 'Unknown'}-${company.bank_names?.[0] || company.bank_name || 'Unknown'}-${company.categories?.[0] || company.category_name || 'Unknown'}`,
              display_text: `${company.company_name || 'Unknown'} → ${company.bank_names?.[0] || company.bank_name || 'Unknown'} → ${company.categories?.[0] || company.category_name || 'Unknown'}`,
              label: `${company.company_name || 'Unknown'} → ${company.bank_names?.[0] || company.bank_name || 'Unknown'} → ${company.categories?.[0] || company.category_name || 'Unknown'}`,
              value: `${company.company_name || 'Unknown'}-${company.bank_names?.[0] || company.bank_name || 'Unknown'}-${company.categories?.[0] || company.category_name || 'Unknown'}`
            };
            
            console.log(`✅ Formatted category ${index}:`, formatted);
            return formatted;
          });
          
          setDynamicCompanyCategories(formattedCategories);
          console.log(`✅ Successfully loaded ${formattedCategories.length} categories for company: "${companyName}"`, formattedCategories);
        } else {
          console.log(`⚠️ No categories found for company: "${companyName}"`);
          setDynamicCompanyCategories([]);
        }
      } catch (error) {
        console.error(`❌ Error loading categories for company "${companyName}":`, error);
        setDynamicCompanyCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    } else {
      // Clear categories if no company is selected
      console.log(`🧹 Clearing categories - no company name provided`);
      setDynamicCompanyCategories([]);
    }
    
    console.log(`🎯 Company selection completed. Final value: "${companyName}"`);
    
    // Reset the selection flag after a longer delay to ensure value is properly displayed
    setTimeout(() => {
      setIsSelectingFromDropdown(false);
      console.log(`🔄 Selection flag reset. Company name should be: "${companyName}"`);
    }, 500);
  }

  // Function to load company suggestions with AND-based filtering
  async function loadCompanySuggestions(searchText) {
    setIsCompanyLoading(true);
    try {
      // For AND-based filtering, we need to get broader results from API
      // Use the full search text for API call to ensure we don't miss relevant companies
      const companyData = await fetchCompanyNames(searchText.trim());
      let allSuggestions = [];
      
      if (Array.isArray(companyData)) {
        allSuggestions = companyData.map(company => 
          company.name || company.company_name || company
        );
      } else if (companyData && typeof companyData === 'object') {
        if (companyData.companies && Array.isArray(companyData.companies)) {
          allSuggestions = companyData.companies.map(company => 
            company.name || company.company_name || company
          );
        } else if (companyData.data && Array.isArray(companyData.data)) {
          allSuggestions = companyData.data.map(company => 
            company.name || company.company_name || company
          );
        }
      }
      
      // If we got limited results from the full query, try with just the first word to get more options
      if (allSuggestions.length < 5) {
        const words = searchText.trim().split(' ').filter(w => w.length > 0);
        if (words.length > 1) {
          try {
            const additionalData = await fetchCompanyNames(words[0]);
            let additionalSuggestions = [];
            
            if (Array.isArray(additionalData)) {
              additionalSuggestions = additionalData.map(company => 
                company.name || company.company_name || company
              );
            } else if (additionalData && typeof additionalData === 'object') {
              if (additionalData.companies && Array.isArray(additionalData.companies)) {
                additionalSuggestions = additionalData.companies.map(company => 
                  company.name || company.company_name || company
                );
              } else if (additionalData.data && Array.isArray(additionalData.data)) {
                additionalSuggestions = additionalData.data.map(company => 
                  company.name || company.company_name || company
                );
              }
            }
            
            // Combine and deduplicate
            allSuggestions = [...allSuggestions, ...additionalSuggestions];
          } catch (error) {
            console.log('Additional search failed, using original results:', error);
          }
        }
      }
      
      // Filter out non-string values and ensure uniqueness
      allSuggestions = [...new Set(allSuggestions.filter(name => typeof name === 'string'))];
      
      // Apply client-side AND-based filtering
      const filteredSuggestions = allSuggestions.filter(companyName => 
        matchesAllWords(companyName, searchText.trim())
      );

      // Sort by relevance score (highest first)
      const sortedSuggestions = filteredSuggestions
        .map(companyName => ({
          name: companyName,
          score: calculateRelevanceScore(companyName, searchText.trim())
        }))
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map(item => item.name); // Extract just the names
      
      // Debug logging for AND-based filtering and sorting
      console.log('🔍 Company Search Debug:', {
        searchText: searchText.trim(),
        searchTokens: searchText.trim().toLowerCase().split(' ').map(t => t.trim()).filter(t => t.length > 0),
        totalSuggestions: allSuggestions.length,
        filteredSuggestions: filteredSuggestions.length,
        topResults: sortedSuggestions.slice(0, 5).map(name => ({
          name,
          score: calculateRelevanceScore(name, searchText.trim())
        }))
      });
      
      // If no filtered suggestions found, but original search text has content
      if (sortedSuggestions.length === 0 && searchText.trim()) {
        // Include the search text as an option
        setCompanySuggestions([searchText.trim()]);
      } else {
        setCompanySuggestions(sortedSuggestions);
      }
    } catch (error) {
      console.error('Error loading company suggestions:', error);
      setCompanySuggestions([searchText.trim()]);
    } finally {
      setIsCompanyLoading(false);
    }
  }

  // Filter functions - defined as regular functions to avoid initialization errors
  function getFilteredProducts(index) {
    if (!safeProductSearchStates || typeof safeProductSearchStates !== 'object') {
      return productTypes.slice(1);
    }
    const searchQuery = (safeProductSearchStates && safeProductSearchStates[index]?.searchQuery) || '';
    return productTypes.slice(1).filter(product =>
      product.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  function getFilteredBanks(index) {
    if (!bankSearchStates || typeof bankSearchStates !== 'object') {
      return [];
    }
    const searchQuery = (bankSearchStates && bankSearchStates[index]?.searchQuery) || '';
    const allBanks = [];
    
    // Add selected banks if they exist and not in bankList
    companyType.forEach(selectedBank => {
      if (selectedBank && !bankList.includes(selectedBank)) {
        allBanks.push(`${selectedBank}`);
      }
    });
    
    // Add all banks from bankList
    bankList.forEach(bank => {
      if (bank) {
        const isSelected = companyType.includes(bank);
        allBanks.push(isSelected ? `${bank}` : bank);
      }
    });
    
    return allBanks.filter(bank =>
      bank.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Fetch API data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingBanks(true);
      
      try {
        // Fetch bank names and company categories in parallel
        const [bankNames, categoryData] = await Promise.all([
          fetchBankNames(),
          fetchCompanyCategories()
        ]);
        
        // Make sure bankNames is always an array of strings
        const processedBankNames = Array.isArray(bankNames) ? bankNames : ['Custom'];
        
        // Ensure all banks are strings, not objects
        const normalizedBankNames = processedBankNames.map(bank => 
          typeof bank === 'string' ? bank : (bank.name || bank.label || String(bank))
        );
        
        // Always include 'Custom' if it's not already in the list
        if (!normalizedBankNames.includes('Custom')) {
          normalizedBankNames.unshift('Custom');
        }
        
        // Update bank list
        setBankList(normalizedBankNames);
        
        // Always load dynamic categories on component mount
        if (categoryData && categoryData.length > 0) {
          setDynamicCompanyCategories(categoryData);
          console.log('Loaded dynamic categories on mount:', categoryData);
        }
        
        // Fetch company categories for 'Decide Bank For Case'
        // Ensure companyType is always treated as an array
        const companyTypeArray = Array.isArray(companyType) ? companyType : 
                               (typeof companyType === 'string' && companyType ? [companyType] : []);
        
        if (companyTypeArray.includes('decide-bank-for-case')) {
          const categories = await fetchCompanyCategories();
          if (categories && categories.length > 0) {
            setCompanyTypes(prevCompanyTypes => 
              prevCompanyTypes.map(type => 
                type.value === 'decide-bank-for-case' 
                  ? { ...type, categories } 
                  : type
              )
            );
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoadingBanks(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Update company categories when company type changes to 'decide-bank-for-case'
  useEffect(() => {
    // Ensure companyType is always treated as an array to prevent "companyType.map is not a function" error
    const companyTypeArray = Array.isArray(companyType) ? companyType : 
                             (typeof companyType === 'string' && companyType ? [companyType] : []);
    
    // Check if companyType includes 'decide-bank-for-case'
    if (companyTypeArray.includes('decide-bank-for-case')) {
      const loadCategories = async () => {
        setIsLoadingCategories(true);
        try {
          const categories = await fetchCompanyCategories();
          setDynamicCompanyCategories(categories);
        } catch (error) {
          console.error('Error loading company categories:', error);
        } finally {
          setIsLoadingCategories(false);
        }
      };
      
      loadCategories();
    }
  }, [companyType]);

  // Calculate totals and eligibility
  useEffect(() => {
    console.log('📊 ========================================');
    console.log('📊 CALCULATING ELIGIBILITY');
    console.log('📊 ========================================');
    
    // Only include bonus in total income if a division is selected
    const bonusContribution = bonusDivision ? (parseINR(yearlyBonus) / bonusDivision) : 0;
    const totalIncome = parseINR(salary) + parseINR(partnerSalary) + bonusContribution;
    
    console.log('📊 Input values:', {
      salary: salary,
      parsedSalary: parseINR(salary),
      partnerSalary: partnerSalary,
      parsedPartnerSalary: parseINR(partnerSalary),
      yearlyBonus: yearlyBonus,
      parsedYearlyBonus: parseINR(yearlyBonus),
      bonusDivision: bonusDivision,
      bonusContribution: bonusContribution,
      totalIncome: totalIncome
    });
    
    // Get the effective FOIR percentage
    const effectiveFoirPercent = ceFoirPercent === 'custom' ? parseROI(ceCustomFoirPercent) : ceFoirPercent;
    const foirAmount = (totalIncome * effectiveFoirPercent) / 100;
    
    console.log('📊 FOIR calculation:', {
      ceFoirPercent: ceFoirPercent,
      ceCustomFoirPercent: ceCustomFoirPercent,
      effectiveFoirPercent: effectiveFoirPercent,
      foirAmount: foirAmount
    });
    
    // Calculate total obligations based on action logic
    let totalObligations = 0;
    let totalBtPosValue = 0;
    
    obligations.forEach(obl => {
      const emiValue = parseINR(obl.emi);
      const outstandingValue = parseINR(obl.outstanding);
      
      switch (obl.action) {
        case 'BT':
          totalBtPosValue += outstandingValue;
          break;
        case 'Obligate':
          totalObligations += emiValue;
          break;
        case 'CO-PAY':
          totalObligations += emiValue / 2; // Half of EMI for CO-PAY
          break;
        case 'NO-PAY':
        case 'Closed':
          // Nothing added to totals
          break;
        default:
          // Default to Obligate behavior
          totalObligations += emiValue;
          break;
      }
    });
    
    // Auto-calculate Monthly EMI Can Pay (FOIR Amount - Total Obligation)
    const monthlyEmiCanPay = Math.max(0, foirAmount - totalObligations);
    
    // Update the Monthly EMI Can Pay state with the calculated value
    setCeMonthlyEmiCanPay(Math.round(monthlyEmiCanPay));
    
    // Calculate Loan Eligibility as per Foir using PMT formula
    // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
    // Where P = Principal, r = monthly interest rate, n = number of months
    const roiValue = parseROI(ceRoi); // Get ROI value without default
    const numberOfMonths = parseTenure(ceTenureMonths); // Parse months from formatted string
    
    let loanEligibilityFoir = 0;
    // Only calculate if ROI, tenure, and EMI are all provided
    if (roiValue > 0 && numberOfMonths > 0 && monthlyEmiCanPay > 0) {
      const monthlyRate = roiValue / 100 / 12; // Convert ROI to monthly rate
      // Using PMT formula rearranged to find Principal: P = EMI * [(1+r)^n - 1] / [r(1+r)^n]
      const powerTerm = Math.pow(1 + monthlyRate, numberOfMonths);
      loanEligibilityFoir = monthlyEmiCanPay * (powerTerm - 1) / (monthlyRate * powerTerm);
    }
    
    const multiplierValue = Number(ceMultiplier) || 0; // Handle empty multiplier
    const multiplierEligibility = (totalIncome - totalObligations) * multiplierValue;
    
    console.log('📊 Final calculations:', {
      totalIncome: totalIncome,
      foirAmount: foirAmount,
      totalObligations: totalObligations,
      totalBtPosValue: totalBtPosValue,
      loanEligibilityFoir: loanEligibilityFoir,
      multiplierValue: multiplierValue,
      multiplierEligibility: multiplierEligibility,
      backendEligibilityLoaded: backendEligibilityLoaded,
      backendFinalEligibility: backendFinalEligibility
    });
    
    // Determine which final eligibility to use
    let finalEligibilityToUse;
    
    console.log('🎯 FINAL ELIGIBILITY DECISION LOGIC:', {
      backendEligibilityLoaded: backendEligibilityLoaded,
      backendFinalEligibility: backendFinalEligibility,
      hasUserInteraction: hasUserInteraction,
      calculatedValue: formatINR(Math.round(loanEligibilityFoir).toString())
    });
    
    // PRIORITY 1: If backend has final eligibility and user hasn't made changes yet, use backend value
    if (backendEligibilityLoaded && backendFinalEligibility && !hasUserInteraction) {
      console.log('✅ ═══════════════════════════════════════════════════');
      console.log('✅ USING BACKEND FINAL ELIGIBILITY (no user changes)');
      console.log('✅ Value:', backendFinalEligibility);
      console.log('✅ ═══════════════════════════════════════════════════');
      finalEligibilityToUse = backendFinalEligibility;
    } 
    // PRIORITY 2: If user has made changes OR no backend value, use calculated value
    else {
      console.log('🔄 ═══════════════════════════════════════════════════');
      console.log('🔄 USING CALCULATED FINAL ELIGIBILITY');
      console.log('🔄 Reason:', hasUserInteraction ? 'User made changes' : 'No backend value');
      console.log('🔄 Value:', formatINR(Math.round(loanEligibilityFoir).toString()));
      console.log('🔄 ═══════════════════════════════════════════════════');
      finalEligibilityToUse = formatINR(Math.round(loanEligibilityFoir).toString());
    }
    
    // Round off all values to remove decimals
    const eligibilityData = {
      totalIncome: formatINR(Math.round(totalIncome).toString()),
      foirAmount: formatINR(Math.round(foirAmount).toString()),
      totalObligations: formatINR(Math.round(totalObligations).toString()),
      totalBtPos: formatINR(Math.round(totalBtPosValue).toString()),
      finalEligibility: finalEligibilityToUse, // Use backend or calculated value
      multiplierEligibility: formatINR(Math.round(multiplierEligibility).toString())
    };
    
    console.log('📊 Setting eligibility state:', eligibilityData);
    setEligibility(eligibilityData);

    setTotalBtPos(formatINR(Math.round(totalBtPosValue).toString()));

    // Check eligibility status
    const requiredAmount = parseINR(loanRequired);
    const eligibilityStatus = Math.round(loanEligibilityFoir) >= requiredAmount ? 'Eligible' : 'Not Eligible';
    console.log('📊 Loan eligibility status:', {
      loanRequired: loanRequired,
      requiredAmount: requiredAmount,
      loanEligibilityFoir: Math.round(loanEligibilityFoir),
      status: eligibilityStatus
    });
    setLoanEligibilityStatus(eligibilityStatus);
    
    console.log('📊 ========================================');
    console.log('📊 ELIGIBILITY CALCULATION COMPLETE');
    console.log('📊 ========================================');
  }, [salary, partnerSalary, yearlyBonus, bonusDivision, obligations, ceFoirPercent, ceCustomFoirPercent, ceMultiplier, ceRoi, ceTenureMonths, ceTenureYears, loanRequired, backendEligibilityLoaded, backendFinalEligibility, hasUserInteraction]);

  // Separate useEffect to recalculate total obligation immediately when obligations change
  useEffect(() => {
    let totalObligations = 0;
    
    console.log('🟦 [DEDICATED] Starting total obligation calculation at', new Date().toISOString());
    
    obligations.forEach((obl, index) => {
      const emiValue = parseINR(obl.emi);
      
      console.log(`🟦 [DEDICATED] Processing obligation ${index + 1}:`, {
        action: obl.action,
        emi: obl.emi,
        parsedEmi: emiValue
      });
      
      switch (obl.action) {
        case 'BT':
          console.log(`🟦 [DEDICATED] BT - NOT adding ${emiValue} to total`);
          // BT doesn't contribute to total obligations
          break;
        case 'Obligate':
          console.log(`🟦 [DEDICATED] Obligate - ADDING ${emiValue} to total`);
          totalObligations += emiValue;
          break;
        case 'CO-PAY':
          console.log(`🟦 [DEDICATED] CO-PAY - ADDING ${emiValue / 2} to total`);
          totalObligations += emiValue / 2; // Half of EMI for CO-PAY
          break;
        case 'NO-PAY':
        case 'Closed':
          console.log(`🟦 [DEDICATED] ${obl.action} - NOT adding to total`);
          // Nothing added to totals
          break;
        default:
          console.log(`🟦 [DEDICATED] Default/undefined "${obl.action}" - ADDING ${emiValue} to total`);
          // Default to Obligate behavior for undefined actions
          totalObligations += emiValue;
          break;
      }
    });
    
    const formattedValue = formatINR(Math.round(totalObligations).toString());
    
    console.log('� [DEDICATED] Setting total obligation to:', {
      rawTotal: totalObligations,
      roundedTotal: Math.round(totalObligations),
      formattedValue: formattedValue,
      timestamp: new Date().toISOString()
    });
    
    // Update total obligation immediately when obligations change
    setTotalObligation(formattedValue);
    
    // Set a timeout to check if our value gets overridden
    setTimeout(() => {
      console.log('🟦 [DEDICATED] Checking if value was overridden after 100ms...');
    }, 100);
    
  }, [obligations]);

  // Function to save obligation data to backend API - Using debounced version to avoid excessive API calls
  const saveObligationDataToAPI = async (obligationData) => {
    if (!leadData?._id) {
      console.warn('No lead ID available, cannot save to API');
      return;
    }

    try {
      const userId = getUserId();
      if (!userId) {
        console.warn('No user ID available');
        return;
      }
      
      const token = localStorage.getItem('token');
      
      // Ensure processingBank is properly included in all relevant fields
      const enrichedData = {
        ...obligationData,
        // Ensure bank name is consistently stored in all required fields
        processingBank: obligationData.bank_name || '',
        processing_bank: obligationData.bank_name || '',
        bank_name: obligationData.bank_name || '',
        bankName: obligationData.bank_name || '',
      };
      
      // Log the data being sent to API for debugging
      console.log('Sending obligation data to API with bank info:', { 
        processingBank: enrichedData.processingBank,
        processing_bank: enrichedData.processing_bank,
        bankName: enrichedData.bankName,
        bank_name: enrichedData.bank_name,
        selectedBanks: enrichedData.selectedBanks
      });
      
      // Make a direct API call (not debounced) when explicitly saving
      // Use the raw API call instead of debounced version to avoid delayed saving
      // Determine if this is a login lead
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const apiUrl = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/obligations?user_id=${userId}`
        : `${API_BASE_URL}/leads/${leadData._id}/obligations?user_id=${userId}`;
      
      console.log(`Making API call to: ${apiUrl} (${isLoginLead ? 'LOGIN' : 'MAIN'} leads)`);

      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(enrichedData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ API SAVE RESPONSE:', responseData);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      // Check if the response contains the saved data
      if (responseData && responseData.personal_details) {
        console.log('📋 SAVED personal_details from API response:', responseData.personal_details);
        console.log('🏢 SAVED company_name from API response:', responseData.personal_details.company_name);
      }
      
      console.log('API response:', responseData);
      
      // Update parent component if handleChangeFunc is provided - use the correct field structure
      if (handleChangeFunc) {
        const updatedDynamicFields = {
          ...leadData.dynamic_fields,
          // Store obligation data in the structure the component expects
          obligation_data: obligationData,
          obligations: obligationData.obligations || [],
          // Also update individual fields for easier access
          personal_details: {
            ...leadData.dynamic_fields?.personal_details,
            salary: obligationData.salary,
            partner_salary: obligationData.partnerSalary,
            company_name: obligationData.companyName,
            company_type: obligationData.companyType,
            company_category: obligationData.companyCategory,
            yearly_bonus: obligationData.yearlyBonus,
            bonus_division: obligationData.bonusDivision,
            loan_required: obligationData.loanRequired,
            cibil_score: obligationData.cibilScore ? String(obligationData.cibilScore) : null
          },
          financial_details: {
            ...leadData.dynamic_fields?.financial_details,
            monthly_income: obligationData.salary,
            partner_salary: obligationData.partnerSalary,
            yearly_bonus: obligationData.yearlyBonus,
            bonus_division: obligationData.bonusDivision,
            loan_required: obligationData.loanRequired,
            cibil_score: obligationData.cibilScore ? String(obligationData.cibilScore) : null
          },
          check_eligibility: {
            ...leadData.dynamic_fields?.check_eligibility,
            company_category: obligationData.ceCompanyCategory,
            foir_percent: obligationData.ceFoirPercent,
            custom_foir_percent: obligationData.ceCustomFoirPercent,
            monthly_emi_can_pay: obligationData.ceMonthlyEmiCanPay,
            tenure_months: obligationData.ceTenureMonths,
            tenure_years: obligationData.ceTenureYears,
            roi: obligationData.ceRoi,
            multiplier: obligationData.ceMultiplier,
            total_bt_pos: obligationData.totalBtPos,
            total_obligation: obligationData.totalObligation,
            eligibility: obligationData.eligibility,
            loan_eligibility_status: obligationData.loanEligibilityStatus
          }
        };
        
        // Update the dynamic_fields with all the obligation data
        handleChangeFunc('dynamic_fields', updatedDynamicFields);
        
        // Also update root-level fields for backward compatibility
        handleChangeFunc('obligations', obligationData.obligations || []);
        handleChangeFunc('salary', obligationData.salary);
        handleChangeFunc('total_obligation', obligationData.totalObligation);
        handleChangeFunc('eligibility', obligationData.eligibility);
        handleChangeFunc('processing_banks', obligationData.selectedBanks || []);
        handleChangeFunc('bank_name', obligationData.bank_name || '');
      }
      
      // Call onDataUpdate callback to notify parent component about data update
      if (onDataUpdate && typeof onDataUpdate === 'function') {
        console.log('Calling onDataUpdate callback to refresh parent component data');
        onDataUpdate({
          hasUnsavedChanges: false,
          isSaving: false
        });
      }
      
      console.log('Obligation data saved successfully to API');
      
    } catch (error) {
      console.error('Error saving obligation data to API:', error);
      // Fallback to localStorage save
      saveObligationData(obligationData);
      throw error; // Re-throw to allow handling in the calling function
    }
  };

  // Final safety check before rendering
  if (!safeProductSearchStates || !safeBankSearchStates) {
    console.warn('Dropdown states not properly initialized, showing loading state');
    return <div className="min-h-screen bg-black p-6 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>;
  }

  // Debug render values and emergency recovery for file_sent_to_login scenarios
  if (leadData?.file_sent_to_login) {
    console.log('🖼️ RENDER DEBUG FILE_SENT_TO_LOGIN:', {
      leadId: leadData._id,
      file_sent_to_login: leadData.file_sent_to_login,
      renderValues: {
        salary: salary,
        partnerSalary: partnerSalary,
        yearlyBonus: yearlyBonus,
        companyName: companyName,
        cibilScore: cibilScore,
        loanRequired: loanRequired,
        obligationsCount: obligations.length
      },
      backupAvailable: !!backupObligationData,
      dataLoaded: dataLoaded,
      dataStable: dataStableForFileSentToLogin,
      isInitialLoad: isInitialLoad
    });
    
    // Emergency render-time recovery if no data is visible but we have sources
    if (!isInitialLoad && dataLoaded && !salary && !companyName && obligations.length === 0) {
      console.warn('🚨 EMERGENCY: No data visible at render time, attempting immediate recovery');
      
      // Try to recover from backup first
      if (backupObligationData) {
        console.log('🔄 EMERGENCY: Recovering from backup data');
        setDebugState(prev => ({
          ...prev,
          recoveryCount: prev.recoveryCount + 1,
          lastRecoveryTime: new Date().toLocaleTimeString()
        }));
        setTimeout(() => {
          if (backupObligationData?.salary) setSalary(backupObligationData.salary);
          if (backupObligationData?.companyName) setCompanyName(backupObligationData.companyName);
          if (backupObligationData?.partnerSalary) setPartnerSalary(backupObligationData.partnerSalary);
          if (backupObligationData?.yearlyBonus) setYearlyBonus(backupObligationData.yearlyBonus);
          if (backupObligationData?.loanRequired) setLoanRequired(backupObligationData.loanRequired);
          if (backupObligationData?.cibilScore) setCibilScore(backupObligationData.cibilScore);
        }, 0);
      } else {
        // Try to re-process from leadData
        console.log('🔄 EMERGENCY: Attempting re-processing from leadData');
        const emergencyData = leadData?.dynamic_fields?.obligation_data || 
                             leadData?.dynamic_fields || 
                             {};
        
        if (emergencyData && Object.keys(emergencyData).length > 0) {
          setTimeout(() => processObligationData(emergencyData), 0);
        }
      }
    }
  }

  // 📊 Activate real-time data monitoring for this component
  useDataMonitoring(leadData, salary, loanRequired, companyName, ceCompanyCategory, ceFoirPercent, obligations, dataLoaded, isInitialLoad, savedData);

  return (
    <div key={leadData?.file_sent_to_login ? `obligation-stable-${leadData._id}` : `obligation-component-${componentKey}-${renderKey}-${lastSaveTime}`} className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">



        <div className="mb-8 form-section">
          {/* Customer Details Section with Download Button */}
          <div className="mb-6">
            <div className="mb-2 flex justify-between items-center">
              <div className="text-2xl font-bold text-white">Customer Details</div>
              {hasDownloadObligationPermission() && (
                <button 
                  type="button"
                  onClick={handleDownloadObligations}
                  className="download-obligations-btn"
                style={{
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#15803d';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#16a34a';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                }}
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Complete Report PDF
              </button>
              )}
            </div>
            <div className="p-4 mb-4 border rounded-lg bg-black border-gray-600">
              {/* Row 1: Salary, Partner's Salary, Bonus */}
              <div className="flex flex-wrap items-end gap-4 mb-6">
                {/* Salary */}
                <div className="form-group flex-1 min-w-[140px] max-w-[180px]">
                  <label className="block mb-2 text-lg font-bold text-white">
                    Salary
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-white bg-gray-700 border text-lg rounded-lg border-gray-600 focus:outline-none focus:border-sky-400 font-bold placeholder-gray-400 uppercase"
                    value={formatINR(salary)}
                    onChange={canEdit ? handleSalaryChange : undefined}
                    onBlur={handleObligationFieldBlur}
                    disabled={!canEdit}
                    placeholder="In Rupees"
                    inputMode="numeric"
                  />
                </div>
                {/* Partner's Salary */}
                <div className="form-group flex-1 min-w-[140px] max-w-[180px]">
                  <label className="block mb-2 text-lg font-bold text-white">Partner's Salary</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-lg text-white bg-gray-700 border rounded-lg border-gray-600 focus:outline-none focus:border-sky-400 font-bold placeholder-gray-400 uppercase"
                    value={formatINR(partnerSalary)}
                    onChange={canEdit ? handlePartnerSalaryChange : undefined}
                    onBlur={handleObligationFieldBlur}
                    disabled={!canEdit}
                    
                    placeholder="In Rupees"
                    inputMode="numeric"
                  />
                </div>
                {/* Bonus with Divide By dropdown on the right */}
                <div className="form-group flex-1 min-w-[200px]">
                  <label htmlFor="yearlyBonus" className="block mb-2 text-lg font-bold text-white">Bonus</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="yearlyBonus"
                      className="flex-1 px-3 py-2 text-lg text-white bg-gray-700 border rounded-lg border-gray-600 focus:outline-none focus:border-sky-400 font-bold placeholder-gray-400 uppercase"
                      value={formatINR(yearlyBonus)}
                      onChange={canEdit ? handleYearlyBonusChange : undefined}
                      onBlur={handleObligationFieldBlur}
                      disabled={!canEdit}
                      placeholder="In Rupees"
                      inputMode="numeric"
                    />
                    {yearlyBonus && parseINR(yearlyBonus) > 0 && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-white whitespace-nowrap">Divide By:</label>
                        <select
                          className="px-2 py-2 text-white text-lg bg-gray-700 border rounded-lg form-select border-gray-600 focus:outline-none focus:border-sky-400 font-bold"
                          value={bonusDivision || ''}
                          onChange={(e) => canEdit && handleBonusDivisionToggle(Number(e.target.value))}
                          disabled={!canEdit}
                        >
                          <option value="" className="text-gray-400 font-bold">Select</option>
                          {bonusDivisions.map((opt) => (
                            <option key={opt.value} value={opt.value} className="text-white font-bold bg-gray-700">
                              {opt.label} {opt.value === 1 ? 'Month' : 'Months'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Loan Amount Required, Company Name */}
              <div className="flex flex-wrap items-end gap-4 mb-4">
                {/* Loan Amount Required */}
                <div className="form-group flex-1 min-w-[140px]">
                  <label className="block mb-2 text-lg font-bold text-white">Loan Amount Required</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-white text-lg bg-gray-700 border rounded-lg border-gray-600 focus:outline-none focus:border-sky-400 font-bold placeholder-gray-400 uppercase"
                    value={formatINR(loanRequired)}
                    onChange={(e) => {
                      if (!canEdit) return;
                      const value = e.target.value;
                      
                      console.log('💰 LOAN REQUIRED CHANGE DETECTED:', {
                        oldValue: loanRequired,
                        newValue: value,
                        formattedValue: formatINR(value),
                        leadId: leadData?._id,
                        file_sent_to_login: leadData?.file_sent_to_login,
                        timestamp: new Date().toLocaleTimeString(),
                        stackTrace: new Error().stack.split('\n').slice(0, 5).join('\n')
                      });
                      
                      setLoanRequired(value);
                      
                      // Mark as changed to trigger save button
                      markAsChanged();
                      setHasUserInteraction(true);
                      setHasUnsavedChanges(true);
                      
                      // DO NOT notify parent on every keystroke - only on blur/save
                      // if (handleChangeFunc) {
                      //   handleChangeFunc('loanRequired', value);
                      // }
                      
                      console.log("Loan required changed:", value);
                    }}
                    onBlur={handleObligationFieldBlur}
                    disabled={!canEdit}
                    placeholder="In Rupees"
                    inputMode="numeric"
                  />
                </div>

                {/* Company Name with searchable input */}
                <div className="form-group flex-1 min-w-[250px] relative">
                  <label className="block mb-2 text-lg font-bold text-white">
                    Company Name
                  </label>
                  <div className="relative">
                    <input
                      ref={companyDropdownRef}
                      type="text"
                      className="w-full px-3 py-2 text-lg text-white bg-gray-700 border rounded-lg border-gray-600 focus:outline-none focus:border-sky-400 font-bold placeholder-gray-400 uppercase"
                      placeholder="Type company name..."
                      value={companyName}
                      disabled={!canEdit}
                      onChange={(e) => {
                        if (!canEdit) return;
                        
                        const value = e.target.value.toUpperCase();
                        console.log(`📝 Company input changed to: "${value}"`);
                        
                        // Only process changes if not in the middle of a dropdown selection
                        if (!isSelectingFromDropdown) {
                          setCompanyName(value);
                          markAsChanged();
                          
                          // Only trigger search if user is actually typing (has inputType)
                          if (e.nativeEvent && e.nativeEvent.inputType) {
                            handleCompanySearchChange(value);
                            if (!companyDropdownOpen && value.length >= 1) {
                              setCompanyDropdownOpen(true);
                              setIsSelectingFromDropdown(false); // Reset flag when dropdown opens from typing
                            }
                          }
                          
                          // Notify parent component of changes immediately for unsaved changes detection
                          if (handleChangeFunc) {
                            handleChangeFunc('company_name', value);
                          }
                        } else {
                          console.log(`🚫 Ignoring input change during dropdown selection`);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && companyName.trim().length >= 1) {
                          e.preventDefault();
                          if (companySuggestions.length > 0) {
                            // Select the first suggestion
                            handleCompanySelect(companySuggestions[0]);
                          } else {
                            // Add the typed text as new company
                            handleCompanySelect(companyName.trim());
                          }
                        } else if (e.key === 'Escape') {
                          setCompanyDropdownOpen(false);
                        }
                      }}
                      onFocus={() => {
                        if (companyName.length >= 1) {
                          setCompanyDropdownOpen(true);
                          setIsSelectingFromDropdown(false); // Reset flag when dropdown opens from focus
                        }
                      }}
                      onBlur={(e) => {
                        const currentValue = e.target.value.trim();
                        console.log(`🔍 Company input blur. Current value: "${currentValue}"`);
                        
                        // Delay to allow for dropdown selection
                        setTimeout(() => {
                          setCompanyDropdownOpen(false);
                          
                          // Only auto-select if user manually typed something and we're not in the middle of a dropdown selection
                          if (currentValue && currentValue.length >= 1 && !isSelectingFromDropdown) {
                            // Check if this is a new value or just confirming existing selection
                            if (currentValue !== companyName.trim()) {
                              console.log(`🎯 Auto-selecting manually typed company: "${currentValue}"`);
                              handleCompanySelect(currentValue);
                            } else {
                              console.log(`✅ Company value already set: "${currentValue}"`);
                            }
                          } else if (isSelectingFromDropdown) {
                            console.log(`🚫 Skipping auto-select due to dropdown selection in progress`);
                          }
                        }, 200);
                      }}
                      data-dropdown-trigger="true"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      {/* Search button to open Zaubacorp website */}
                      <button
                        type="button"
                        onClick={() => {
                          window.open('https://www.zaubacorp.com/', '_blank', 'noopener,noreferrer');
                        }}
                        className="p-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-all duration-200 flex items-center justify-center"
                        title="Search on Zaubacorp"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                          />
                        </svg>
                      </button>
                      {isCompanyLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-sky-400"></div>
                      )}
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Decide Bank For Case, Company Category */}
              <div className="flex flex-wrap items-end gap-4">
                {/* Decide Bank For Case - Updated to show multiple selected banks */}
                <div className="form-group flex-1 min-w-[140px]">
                  <label className="block mb-2 text-lg font-extrabold text-white">Decide Bank For Case</label>
                  <div className="flex flex-wrap items-center gap-2 border border-gray-600 rounded-lg bg-gray-700 p-2 min-h-[42px]">
                    {/* Display all selected banks as pills */}
                    {companyType.map((bank, index) => {
                      // Ensure bank is a string and handle null/undefined/object cases
                      const bankString = bank && typeof bank === 'object' ? 
                        (bank.name || bank.label || bank.value || String(bank)) : 
                        String(bank || '');
                      
                      const bankDisplay = bankString || 'Unknown';
                      const firstLetter = bankDisplay.length > 0 ? bankDisplay.charAt(0).toUpperCase() : 'B';
                      
                      return (
                        <div
                          key={`${bankDisplay}-${index}`}
                          className="bg-blue-100 text-blue-800 py-1 px-3 rounded-md flex items-center"
                        >
                          {/* Profile icon with bank's first letter */}
                          <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-2 text-xs flex-shrink-0">
                            {firstLetter}
                          </div>
                          <span className="text-lg font-extrabold uppercase">{bankDisplay}</span>
                          <button
                            type="button"
                            className="ml-2 h-10 w-10 text-xl text-blue-500 hover:text-blue-700 font-bold"
                            onClick={() => canEdit && handleRemoveBank(bank)}
                            disabled={!canEdit}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="text-white text-lg font-medium hover:text-gray-300 ml-auto"
                      onClick={() => canEdit && setShowBankPopup(true)}
                      disabled={!canEdit}
                    >
                      + Add Bank
                    </button>
                  </div>
                </div>

                {/* Company Category - Multi-select Enabled */}
                <div className="form-group flex-1 min-w-[140px]">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-lg font-extrabold text-white">Company Category</label>
                    {isLoadingCategories && (
                      <div className="flex items-center gap-1 text-sm text-yellow-400">
                        <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-yellow-400"></div>
                        Loading...
                      </div>
                    )}
                    {!isLoadingCategories && dynamicCompanyCategories.length > 0 && (
                      <span className="text-sm text-green-400">
                        {dynamicCompanyCategories.length} found
                      </span>
                    )}
                    {!isLoadingCategories && companyName && companyName.trim() && dynamicCompanyCategories.length === 0 && (
                      <span className="text-sm text-red-400">
                        No categories found
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border border-gray-600 rounded-lg bg-gray-700 p-2 min-h-[42px]">
                    {/* Display all selected categories as pills */}
                    {Array.isArray(companyCategory) && companyCategory.length > 0 ? (
                      companyCategory.map((category, index) => {
                        // Handle both string (legacy) and object (new format) categories
                        let displayText, categoryKey, initialsText;
                        
                        if (typeof category === 'string') {
                          // Legacy format - just the category name
                          displayText = category;
                          categoryKey = category;
                          initialsText = String(category);
                        } else if (typeof category === 'object' && category !== null) {
                          // New format - full category object with display text
                          displayText = category.display || category.display_text || category.label || category.category_name || 
                                       (category.company_name && category.bank_name && category.category_name 
                                        ? `${category.company_name} → ${category.bank_name} → ${category.category_name}`
                                        : category.company_name && category.category_name 
                                        ? `${category.company_name} → ${category.category_name}`
                                        : 'Unknown Category');
                          categoryKey = category.key || category.display_key || category.value || category.display || `category-${index}`;
                          // Use the category name for initials if available, otherwise use display text - ensure it's a string
                          const rawInitialsText = category.category_name || category.display || category.display_text || category.label || 'CA';
                          initialsText = String(rawInitialsText);
                        } else {
                          // Fallback for unexpected formats
                          displayText = 'Unknown Category';
                          categoryKey = `unknown-${index}`;
                          initialsText = 'CA';
                        }
                        
                        return (
                          <div
                            key={`${categoryKey}-${index}`}
                            className="bg-green-100 text-green-800 py-1 px-3 rounded-md flex items-center"
                          >
                            {/* Profile icon with initials */}
                            <div className="w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center mr-2 text-xs flex-shrink-0">
                              {(() => {
                                try {
                                  // Safely generate initials with error handling
                                  const safeInitialsText = String(initialsText || 'CA');
                                  return safeInitialsText.split(' ')
                                    .map(part => (part && part.length > 0) ? part[0] : '')
                                    .filter(letter => letter.trim() !== '')
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase() || 'CA';
                                } catch (error) {
                                  console.warn('Error generating category initials:', error);
                                  return 'CA';
                                }
                              })()}
                            </div>
                            <span className="text-lg font-extrabold uppercase">{displayText}</span>
                            <button
                              type="button"
                              className="ml-2 h-10 w-10 text-xl text-green-500 hover:text-green-700 font-bold"
                              onClick={() => canEdit && handleRemoveCategory(category)}
                              disabled={!canEdit}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-gray-400 italic">No categories selected</span>
                    )}
                    <button
                      type="button"
                      className="text-white text-lg font-medium hover:text-gray-300 ml-auto"
                      disabled={!canEdit}
                      onClick={async () => {
                        if (!canEdit) return;
                        setShowCategoryPopup(true);
                        
                        // Load categories from API when popup opens
                        if (dynamicCompanyCategories.length === 0) {
                          setIsLoadingCategories(true);
                          try {
                            const categories = await fetchCompanyCategories();
                            setDynamicCompanyCategories(categories);
                            console.log('Loaded categories for popup:', categories);
                          } catch (error) {
                            console.error('Error loading company categories:', error);
                          } finally {
                            setIsLoadingCategories(false);
                          }
                        }
                      }}
                    >
                      + Add Categories
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Customer Obligation Section - with enhanced styling and logic */}
          <div className="mb-4">
            <div className="mb-4 flex items-center justify-center gap-4">
              <div className="text-3xl font-bold text-center text-green-400">Customer Obligations</div>
              
              {/* Auto-save status indicator */}
              {autoSaveStatus && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                  autoSaveStatus === 'saving' ? 'bg-blue-500/20 text-blue-400 border border-blue-500' :
                  autoSaveStatus === 'saved' ? 'bg-green-500/20 text-green-400 border border-green-500' :
                  autoSaveStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500' :
                  ''
                }`}>
                  {autoSaveStatus === 'saving' && (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Auto-saving...</span>
                    </>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Auto-saved</span>
                    </>
                  )}
                  {autoSaveStatus === 'error' && (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                      <span>Auto-save failed</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Summary fields with enhanced styling */}
            <div className="flex flex-wrap items-center gap-6 p-6 mb-4 bg-black/90 border-2 border-gray-600 rounded-lg shadow-lg">
              <div className="form-group flex-1 min-w-[250px]">
                <label className="block mb-2 text-lg font-bold text-green-400 uppercase tracking-wide">TOTAL BT POS</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 font-bold text-2xl text-center text-black bg-green-400 border-2 border-green-500 rounded-lg"
                  value={totalBtPos}
                  readOnly
                />
              </div>
              <div className="form-group flex-1 min-w-[250px]">
                <label className="block mb-2 text-lg font-bold text-yellow-400 uppercase tracking-wide">TOTAL OBLIGATION</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 font-bold text-2xl text-center text-black bg-yellow-400 border-2 border-yellow-500 rounded-lg"
                  value={totalObligation}
                  readOnly
                />
              </div>
              <div className="form-group flex-1 min-w-[200px]">
                <label className="block mb-2 text-lg font-bold text-blue-400 uppercase tracking-wide">CIBIL Score</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 text-xl text-center text-black bg-blue-100 border-2 border-blue-400 rounded-lg focus:outline-none focus:border-blue-600 font-bold placeholder-black"
                  value={cibilScore}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCibilScore(value);
                    // Notify parent component of changes immediately for unsaved changes detection
                    if (handleChangeFunc) {
                      handleChangeFunc('cibil_score', value);
                    }
                  }}
                  placeholder="Enter CIBIL Score"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
          
          {/* Company Name Dropdown Portal */}
          {companyDropdownOpen && (
            <div 
              className="fixed inset-0 z-[9999]" 
              style={{ zIndex: 9999 }}
            >
              {/* Backdrop */}
              <div 
                className="absolute inset-0" 
                onClick={() => setCompanyDropdownOpen(false)}
              />
              
              {/* Dropdown Content */}
              <div 
                className="absolute bg-gray-800 border border-gray-600 rounded-lg shadow-lg"
                style={{
                  left: companyDropdownRef.current ? companyDropdownRef.current.getBoundingClientRect().left : 0,
                  top: companyDropdownRef.current ? companyDropdownRef.current.getBoundingClientRect().bottom + 5 : 0,
                  width: companyDropdownRef.current ? companyDropdownRef.current.getBoundingClientRect().width : 300,
                  minWidth: '300px'
                }}
                data-dropdown-container="true"
              >
                {/* Options List - Directly show options without search input */}
                <div className="max-h-60 overflow-y-auto" data-dropdown-scroll="true">
                  {companySuggestions.length > 0 ? (
                    companySuggestions.map((company, index) => {
                      // Ensure company is a string and handle object cases
                      const companyString = company && typeof company === 'object' ? 
                        (company.name || company.label || company.company_name || String(company)) : 
                        String(company || '');
                      
                      const companyDisplay = companyString || 'Unknown Company';
                      const firstLetter = companyDisplay.length > 0 ? companyDisplay.charAt(0).toUpperCase() : 'C';
                      
                      return (
                        <div
                          key={`company-${index}`}
                          className="px-4 py-3 text-lg text-white cursor-pointer hover:bg-gray-700 border-b border-gray-700 last:border-b-0 transition-colors"
                          onClick={() => canEdit && handleCompanySelect(company)}
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 text-sm font-bold">
                              {firstLetter}
                            </div>
                            <span className="font-medium">{companyDisplay}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : companyName.length >= 2 && !isCompanyLoading ? (
                    <div className="px-4 py-3 text-lg text-gray-400 italic">
                      No companies match "{companyName}"
                    </div>
                  ) : companyName.length < 2 ? (
                    <div className="px-4 py-3 text-lg text-gray-400 italic">
                      Type at least 2 characters to search...
                    </div>
                  ) : null}
                  
                  {/* Add custom option if company name exists and is not in suggestions */}
                  {companyName.length >= 2 && !companySuggestions.includes(companyName) && (
                    <div
                      className="px-4 py-3 text-lg text-sky-400 cursor-pointer hover:bg-gray-700 border-t border-gray-600 font-medium transition-colors"
                      onClick={() => canEdit && handleCompanySelect(companyName)}
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center mr-3 text-sm font-bold">
                          +
                        </div>
                        <span>Add "{companyName}"</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Enhanced Obligations Table */}
          <div className="mb-6 bg-black rounded-lg border-2 border-gray-600 shadow-lg relative">
            {/* Simple Header */}
            <div className="bg-gray-800 px-4 py-3 border-b-2 border-gray-600">
              <h3 className="text-lg font-bold text-white">Bank-wise Customer Obligations</h3>
            </div>
            <div className="relative" style={{ position: 'relative', zIndex: 1 }}>
              <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
                <table 
                  key={`obligations-table-${forceRender}-${renderKey}-${lastSaveTime}-${obligations.length}`}
                  className="w-full border-collapse align-middle" 
                  style={{ position: 'relative' }}
                >
                <thead>
                  <tr className="bg-black border-b-2 border-gray-600 align-middle">
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-8">#</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-48">PRODUCT</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-72">BANK NAME</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-26">TENURE</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-16">ROI %</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-32">TOTAL LOAN</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-32">OUTSTANDING</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-28">EMI</th>
                    <th className="px-2 py-2 text-sm font-bold text-white border-r-2 border-gray-600 text-center w-24">ACTIONS</th>
                    <th className="px-2 py-2 text-sm font-bold text-white text-center w-8">DEL</th>
                  </tr>
                </thead>
                <tbody key={`obligations-tbody-${forceRender}-${renderKey}-${lastSaveTime}-${obligations.map(o => `${o.id}-${o.selectedRoiPercentage}-${o.selectedTenurePercentage}`).join(',')}`}>
                  {obligations.map((row, idx) => {
                    // Create simple, direct action change handler
                    const createActionChangeHandler = (rowId, rowIndex) => {
                      return (e) => {
                        console.log('🔄 Action dropdown onChange for row:', rowIndex, 'ID:', rowId);
                        
                        if (!canEdit) {
                          console.log('❌ Cannot edit - disabled');
                          return;
                        }
                        
                        const newAction = e.target.value;
                        console.log('✅ Changing action from', row.action, 'to', newAction, 'for ID:', rowId);
                        
                        // Mark that we're interacting with a dropdown to prevent interference
                        setActionDropdownInteracting(true);
                        
                        // Simple, direct state update using ID-based targeting
                        setObligations(prevObligations => {
                          const updatedObligations = prevObligations.map(obligation => {
                            // Use strict ID matching to ensure we only update the correct row
                            if (String(obligation.id) === String(rowId)) {
                              console.log('🎯 Updating obligation:', rowId, 'action from', obligation.action, 'to:', newAction);
                              return { ...obligation, action: newAction };
                            }
                            return obligation;
                          });
                          
                          // Don't sort immediately to prevent dropdown confusion
                          // Instead, mark for deferred sorting
                          console.log('✅ Action updated for ID:', rowId, 'deferring sort to prevent dropdown issues');
                          
                          // Mark as changed and notify parent
                          setHasUserInteraction(true);
                          setHasUnsavedChanges(true);
                          
                          if (handleChangeFunc) {
                            handleChangeFunc('obligations', updatedObligations);
                          }
                          
                          // Reset dropdown interaction flag after a short delay
                          setTimeout(() => {
                            setActionDropdownInteracting(false);
                            
                            // Now perform the sorting after dropdown interaction is complete
                            setObligations(prevObs => {
                              const sortedObligations = sortObligationsByPriority(prevObs);
                              console.log('🔄 Deferred sorting completed for action change');
                              
                              if (handleChangeFunc) {
                                handleChangeFunc('obligations', sortedObligations);
                              }
                              
                              return sortedObligations;
                            });
                          }, 100);
                          
                          return updatedObligations;
                        });
                      };
                    };
                    
                    // Debug Credit Card button states
                    if (isCreditCard(row.product)) {
                      console.log(`Rendering Credit Card row ${idx}:`, {
                        selectedTenurePercentage: row.selectedTenurePercentage,
                        selectedRoiPercentage: row.selectedRoiPercentage,
                        selectedTenurePercentageType: typeof row.selectedTenurePercentage,
                        selectedRoiPercentageType: typeof row.selectedRoiPercentage,
                        tenure: row.tenure,
                        roi: row.roi,
                        tenureButtonActive: (row.selectedTenurePercentage === 4 || row.selectedTenurePercentage === '4' || parseInt(row.selectedTenurePercentage) === 4),
                        roiButtonActive: (row.selectedRoiPercentage === 5 || row.selectedRoiPercentage === '5' || parseInt(row.selectedRoiPercentage) === 5),
                        tenureButtonActiveOriginal: row.selectedTenurePercentage === 4,
                        roiButtonActiveOriginal: row.selectedRoiPercentage === 5
                      });
                    }
                    
                    // Debug action state
                    console.log(`🎯 Row ${idx} Action Debug:`, {
                      action: row.action,
                      actionType: typeof row.action,
                      rowId: row.id,
                      product: row.product
                    });
                    
                    return (
                    <tr key={`${row.id}-${idx}-action-${row.action}`} className={`border-b-2 text-[12px] border-gray-600 align-middle ${getRowStyling(row.action)}`}>
                      <td className="px-1 py-1 text-center  text-white font-bold border-r-2 border-gray-600 bg-black">{idx + 1}</td>

                      {/* Product Select - Searchable Dropdown */}
                      <td className="px-2 py-2 border-r-2 border-gray-600 bg-black relative">
                        <div className="relative">
                          <div 
                            ref={el => dropdownRefs.current[`product-${idx}`] = el}
                            className={`w-full px-2 py-2 text-sm font-bold rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer flex items-center justify-between ${getInputStyling(row.action)} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => canEdit && handleProductDropdownToggle(idx)}
                            data-dropdown-trigger="true"
                          >
                            <span className={`${row.product ? '' : 'text-black'} uppercase`}>
                              {row.product ? productTypes.find(p => p.value === row.product)?.label || row.product : 'Select Product'}
                            </span>
                            <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                          </div>
                        </div>
                      </td>

                      {/* Bank Name Select - Searchable Dropdown */}
                      <td className="px-2 py-2 border-r-2 border-gray-600 bg-black relative">
                        <div className="relative">
                          <div 
                            ref={el => dropdownRefs.current[`bank-${idx}`] = el}
                            className={`w-full px-2 py-2 text-sm font-bold rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer flex items-center justify-between ${getInputStyling(row.action)} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => canEdit && handleBankDropdownToggle(idx)}
                            data-dropdown-trigger="true"
                          >
                            <span className={`${row.bankName ? '' : 'text-black'} uppercase`}>
                              {row.bankName || ''}
                              {row.bankName && companyType.includes(row.bankName) ? '': ''}
                            </span>
                            <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                          </div>
                        </div>
                      </td>

                      {/* Tenure - Show 4% button for Credit Card */}
                      <td className="px-1 py-1 border-r-2 border-gray-600 bg-black">
                        {isCreditCard(row.product) ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              type="button"
                              className={`px-2 py-1 text-sm font-bold rounded border-2 transition-colors ${
                                (row.selectedTenurePercentage === 4 || row.selectedTenurePercentage === '4' || parseInt(row.selectedTenurePercentage) === 4)
                                  ? 'bg-green-500 text-white border-green-600' 
                                  : 'bg-white text-black border-gray-300 hover:bg-gray-100'
                              } ${
                                !row.outstanding || parseINR(row.outstanding) === 0
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!canEdit) return;
                                console.log('4% button clicked for row:', idx, 'Current selectedTenurePercentage:', row.selectedTenurePercentage, 'Type:', typeof row.selectedTenurePercentage);
                                handleCreditCardTenure(idx);
                              }}
                              disabled={!canEdit || !row.outstanding || parseINR(row.outstanding) === 0}
                            >
                              4%
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            className={`w-full px-2 py-2 text-sm text-center rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 ${getInputStyling(row.action)} placeholder-black`}
                            placeholder="months"
                            maxLength="12"
                            value={row.tenure}
                            disabled={!canEdit}
                            onFocus={e => {
                              // Position cursor at the end of numbers when focusing
                              const input = e.target;
                              const rawValue = input.value.replace(/[^0-9]/g, "");
                              if (rawValue) {
                                setTimeout(() => {
                                  input.setSelectionRange(rawValue.length, rawValue.length);
                                }, 0);
                              }
                            }}
                            onChange={e => {
                              if (!canEdit) return;
                              const input = e.target;
                              const cursorPosition = input.selectionStart;
                              const rawValue = e.target.value.replace(/[^0-9]/g, "");
                              const formattedValue = rawValue ? formatTenure(rawValue) : '';
                              handleObligationChange(idx, "tenure", formattedValue);
                              
                              // Restore cursor position after formatting
                              setTimeout(() => {
                                if (input && rawValue) {
                                  const newPosition = Math.min(cursorPosition, rawValue.length);
                                  input.setSelectionRange(newPosition, newPosition);
                                }
                              }, 0);
                            }}
                            onBlur={handleObligationFieldBlur}
                          />
                        )}
                      </td>

                      {/* ROI - Show 5% button for Credit Card */}
                      <td className="px-1 py-1 border-r-2 border-gray-600 bg-black">
                        {isCreditCard(row.product) ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              type="button"
                              className={`px-2 py-1 text-sm font-bold rounded border-2 transition-colors ${(() => {
                                const roiValue = row.selectedRoiPercentage;
                                const isHighlighted = roiValue === 5 || roiValue === '5' || parseInt(roiValue) === 5;
                                console.log('🔍 5% Button render state:', {
                                  rowId: row.id,
                                  rowIndex: idx,
                                  selectedRoiPercentage: roiValue,
                                  selectedRoiPercentageType: typeof roiValue,
                                  parsedValue: parseInt(roiValue),
                                  isHighlighted,
                                  roiField: row.roi,
                                  outstanding: row.outstanding,
                                  canEdit,
                                  timestamp: new Date().toLocaleTimeString()
                                });
                                return isHighlighted 
                                  ? 'bg-green-500 text-white border-green-600' 
                                  : 'bg-white text-black border-gray-300 hover:bg-gray-100';
                              })()} ${
                                !row.outstanding || parseINR(row.outstanding) === 0
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!canEdit) {
                                  console.log('❌ 5% button blocked - canEdit is false');
                                  return;
                                }
                                console.log('🔄 5% button clicked:', {
                                  rowId: row.id,
                                  rowIndex: idx,
                                  currentSelectedRoiPercentage: row.selectedRoiPercentage,
                                  currentSelectedRoiPercentageType: typeof row.selectedRoiPercentage,
                                  canEdit,
                                  outstanding: row.outstanding,
                                  outstandingParsed: parseINR(row.outstanding),
                                  timestamp: new Date().toLocaleTimeString()
                                });
                                handleCreditCardRoi(idx);
                              }}
                              disabled={!canEdit || !row.outstanding || parseINR(row.outstanding) === 0}
                            >
                              5%
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            className={`w-full px-2 py-2 text-sm text-center rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 ${getInputStyling(row.action)} placeholder-black`}
                            placeholder="%"
                            maxLength="8"
                            value={row.roi}
                            disabled={!canEdit}
                            onFocus={e => {
                              // Position cursor at the end of numbers when focusing
                              const input = e.target;
                              const rawValue = input.value.replace(/[^0-9.]/g, "");
                              if (rawValue) {
                                setTimeout(() => {
                                  input.setSelectionRange(rawValue.length, rawValue.length);
                                }, 0);
                              }
                            }}
                            onChange={e => {
                              if (!canEdit) return;
                              const input = e.target;
                              const cursorPosition = input.selectionStart;
                              const rawValue = e.target.value.replace(/[^0-9.]/g, "");
                              const formattedValue = rawValue ? formatROI(rawValue) : '';
                              handleObligationChange(idx, "roi", formattedValue);
                              
                              // Restore cursor position after formatting
                              setTimeout(() => {
                                if (input && rawValue) {
                                  const newPosition = Math.min(cursorPosition, rawValue.length);
                                  input.setSelectionRange(newPosition, newPosition);
                                }
                              }, 0);
                            }}
                            onBlur={handleObligationFieldBlur}
                          />
                        )}
                      </td>

                      {/* Total Loan */}
                      <td className="px-1 py-1 border-r-2 border-gray-600 bg-black">
                        <input
                          type="text"
                          className={`w-full px-1 py-1 text-sm text-center rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 ${getInputStyling(row.action)} placeholder-black`}
                          placeholder="Total loan"
                          value={row.totalLoan}
                          disabled={!canEdit}
                          onChange={e => {
                            if (!canEdit) return;
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            handleObligationChange(idx, "totalLoan", formatINR(raw));
                          }}
                          onBlur={handleObligationFieldBlur}
                          inputMode="numeric"
                        />
                      </td>

                      {/* Outstanding */}
                      <td className="px-1 py-1 border-r-2 border-gray-600 bg-black">
                        <input
                          type="text"
                          className={`w-full px-1 py-1 text-sm text-center rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 ${getInputStyling(row.action)} placeholder-black`}
                          placeholder="Outstanding"
                          value={row.outstanding}
                          disabled={!canEdit}
                          onChange={e => {
                            if (!canEdit) return;
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            handleObligationChange(idx, "outstanding", formatINR(raw));
                          }}
                          onBlur={handleObligationFieldBlur}
                          inputMode="numeric"
                        />
                      </td>

                      {/* EMI - Read-only for Credit Card */}
                      <td className="px-1 py-1 border-r-2 border-gray-600 bg-black">
                        <input
                          type="text"
                          className={`w-full px-1 py-1 text-sm text-center rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 ${getInputStyling(row.action)} placeholder-black`}
                          placeholder="EMI"
                          value={row.emi}
                          disabled={!canEdit}
                          onChange={e => {
                            if (!canEdit || isCreditCard(row.product)) return;
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            handleObligationChange(idx, "emi", formatINR(raw));
                          }}
                          onBlur={handleObligationFieldBlur}
                          readOnly={isCreditCard(row.product)}
                          inputMode="numeric"
                        />
                      </td>

                      {/* Action Select with Enhanced Color Coding */}
                      <td className="px-1 py-1 border-r-2 border-gray-600 bg-black">
                        {(() => {
                          console.log(`🔍 Rendering dropdown for row ${idx}:`, {
                            rowId: row.id,
                            action: row.action,
                            actionType: typeof row.action,
                            actionValue: JSON.stringify(row.action),
                            isEmpty: !row.action,
                            isEmptyString: row.action === '',
                            isUndefined: row.action === undefined,
                            isNull: row.action === null
                          });
                          return null;
                        })()}
                        <select
                          key={`action-select-${row.id}-${idx}-${row.action}`}
                          className="w-full px-1 py-1 text-sm text-center rounded border-2 focus:outline-none focus:ring-1 focus:ring-blue-400 font-bold"
                          value={row.action || ''}
                          disabled={!canEdit}
                          onChange={createActionChangeHandler(row.id, idx)}
                          style={{
                            backgroundColor: 
                              row.action === 'BT' ? '#4ade80' :
                              row.action === 'Obligate' ? '#facc15' :
                              row.action === 'CO-PAY' ? '#fb923c' :
                              row.action === 'NO-PAY' ? '#60a5fa' :
                              row.action === 'Closed' ? '#f87171' :
                              '#ffffff',
                            color: '#000000',
                            fontWeight: 'bold'
                          }}
                        >
                          <option value="" style={{ backgroundColor: '#ffffff', color: '#666666' }}>
                            Select Action
                          </option>
                          {(() => {
                            // Show all action types, with selected action marked with checkmark
                            const selectedAction = row.action;
                            
                            return actionTypes.map(opt => (
                              <option 
                                key={`${idx}-${opt.value}`}
                                value={opt.value}
                                style={{
                                  backgroundColor: 
                                    opt.value === 'BT' ? '#4ade80' :
                                    opt.value === 'Obligate' ? '#facc15' :
                                    opt.value === 'CO-PAY' ? '#fb923c' :
                                    opt.value === 'NO-PAY' ? '#60a5fa' :
                                    opt.value === 'Closed' ? '#f87171' :
                                    '#ffffff',
                                  color: '#000000',
                                  fontWeight: 'bold'
                                }}
                              >
                                {opt.label} {opt.value === selectedAction ? '✓' : ''}
                              </option>
                            ));
                          })()}
                        </select>
                      </td>

                      {/* Delete Button */}
                      <td className="px-1 py-1 text-center bg-black">
                        <button
                          className={`${
                            obligations.length <= 1 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-red-500 hover:text-red-700 hover:bg-red-100'
                          } p-1 rounded transition-colors`}
                          onClick={() => handleDeleteObligation(idx)}
                          disabled={obligations.length <= 1}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
            
            {/* Add New Row Button */}
            <div className="flex justify-center p-4 bg-black border-t-2 border-gray-600">
              <button
                className="px-6 py-3 font-bold text-lg text-white bg-blue-600 border-2 border-blue-700 rounded-lg hover:bg-blue-700 hover:border-blue-800 transition-all duration-200"
                onClick={handleAddObligation}
                type="button"
              >
                ADD NEW ROW
              </button>
            </div>
          </div>

          {/* --- CHECK ELIGIBILITY SECTION --- */}
          <div className="p-4 mt-6 mb-4 border rounded-lg border-gray-600 bg-black">
            <div className="mb-3 text-2xl font-bold text-green-400">Check Eligibility</div>
            {/* First Row */}
            <div className="flex flex-wrap gap-4 mb-4">
              {/* Total Income */}
              <div className="form-group flex-1 min-w-[180px]">
                <label className="block mb-1 text-base font-bold text-white">Total Income</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg font-bold text-white bg-black border rounded-lg form-control border-gray-600"
                  value={eligibility.totalIncome}
                  readOnly
                />
              </div>
              {/* Company Category Dropdown */}
              <div className="form-group flex-1 min-w-[320px]">
                <label className="block mb-1 text-base font-bold text-white">
                  Company Category
                </label>
                <select
                  className="w-full px-2 py-1 text-lg text-white bg-gray-700 border rounded-lg form-select border-gray-600 font-bold"
                  value={ceCompanyCategory}
                  onChange={canEdit ? handleCeCompanyCategoryChange : undefined}
                  disabled={!canEdit}
                >
                  <option value="" className="text-gray-400 font-bold">Select Category</option>
                  {checkEligibilityCompanyCategories.map((opt) => (
                    <option key={opt.value || opt.id} value={opt.value || opt.id} className="text-white font-bold bg-gray-700">
                      {opt.label || opt.display_text || opt.category_name}
                    </option>
                  ))}
                </select>
              </div>
              {/* FOIR % */}
              <div className="form-group flex-1 min-w-[120px] max-w-[120px]">
                <label className="block mb-1 text-base font-bold text-white">FOIR %</label>
                {ceFoirPercent === 'custom' ? (
                  <input
                    type="text"
                    className="w-full px-2 py-1 text-lg text-white bg-gray-700 border rounded-lg form-control border-gray-600 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-400"
                    value={ceCustomFoirPercent}
                    placeholder="Enter %"
                    disabled={!canEdit}
                    onFocus={e => {
                      // Position cursor at the end of numbers when focusing
                      const input = e.target;
                      const rawValue = input.value.replace(/[^0-9.]/g, "");
                      if (rawValue) {
                        setTimeout(() => {
                          input.setSelectionRange(rawValue.length, rawValue.length);
                        }, 0);
                      }
                    }}
                    onChange={e => {
                      if (!canEdit) return;
                      const input = e.target;
                      const cursorPosition = input.selectionStart;
                      const rawValue = e.target.value.replace(/[^0-9.]/g, "");
                      const formattedValue = rawValue ? formatROI(rawValue) : '';
                      setCeCustomFoirPercent(formattedValue);
                      
                      // Mark as changed to trigger save button
                      setHasUserInteraction(true);
                      setHasUnsavedChanges(true);
                      console.log("Custom FOIR percent changed:", formattedValue);
                      
                      // If custom value is cleared, switch back to dropdown
                      if (!rawValue) {
                        setCeFoirPercent(60); // Switch back to default dropdown value
                      }
                      
                      // Restore cursor position after formatting
                      setTimeout(() => {
                        if (input && rawValue) {
                          const newPosition = Math.min(cursorPosition, rawValue.length);
                          input.setSelectionRange(newPosition, newPosition);
                        }
                      }, 0);
                    }}
                  />
                ) : (
                  <select
                    className="w-full px-2 py-1 text-lg text-white bg-gray-700 border rounded-lg form-select border-gray-600 font-bold"
                    value={ceFoirPercent}
                    onChange={canEdit ? handleCeFoirPercentChange : undefined}
                    disabled={!canEdit}
                  >
                    <option value={45} className="text-white font-bold bg-gray-700">45%</option>
                    <option value={50} className="text-white font-bold bg-gray-700">50%</option>
                    <option value={55} className="text-white font-bold bg-gray-700">55%</option>
                    <option value={60} className="text-white font-bold bg-gray-700">60%</option>
                    <option value={65} className="text-white font-bold bg-gray-700">65%</option>
                    <option value={70} className="text-white font-bold bg-gray-700">70%</option>
                    <option value={75} className="text-white font-bold bg-gray-700">75%</option>
                    <option value={80} className="text-white font-bold bg-gray-700">80%</option>
                    <option value="custom" className="text-white font-bold bg-gray-700">Custom</option>
                  </select>
                )}
              </div>
              {/* FOIR Amount */}
              <div className="form-group flex-1 min-w-[160px]">
                <label className="block mb-1 text-base font-bold text-white">FOIR Amount</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg font-bold text-white bg-black border rounded-lg form-control border-gray-600"
                  value={eligibility.foirAmount}
                  readOnly
                />
              </div>
              {/* Total Obligation */}
              <div className="form-group flex-1 min-w-[180px] max-w-[180px]">
                <label className="block mb-1 text-base font-bold text-white">Total Obligation</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg font-bold text-black bg-yellow-400 border border-yellow-600 rounded-lg form-control"
                  value={eligibility.totalObligations}
                  readOnly
                />
              </div>
            </div>
            {/* Second Row */}
            <div className="flex flex-wrap gap-4 mb-4">
              {/* Monthly EMI Can Pay - Auto Calculated */}
              <div className="form-group flex-1 min-w-[180px]">
                <label className="block mb-1 text-base font-bold text-white">Monthly EMI Can Pay</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg font-bold text-white bg-black border rounded-lg form-control border-gray-600"
                  value={formatINR(ceMonthlyEmiCanPay.toString())}
                  readOnly
                />
              </div>
              {/* Tenure (Months) */}
              <div className="form-group flex-1 min-w-[180px]">
                <label className="block mb-1 text-base font-bold text-white">TENURE (Months)</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg text-white bg-gray-700 border rounded-lg form-control border-gray-600 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-400"
                  value={ceTenureMonths}
                  placeholder="Months"
                  disabled={!canEdit}
                  onFocus={e => {
                    // Position cursor at the end of numbers when focusing
                    const input = e.target;
                    const rawValue = input.value.replace(/[^0-9]/g, "");
                    if (rawValue) {
                      setTimeout(() => {
                        input.setSelectionRange(rawValue.length, rawValue.length);
                      }, 0);
                    }
                  }}
                  onChange={canEdit ? handleCeTenureMonthsChange : undefined}
                />
              </div>
              {/* Tenure (Years) */}
              <div className="form-group flex-1 min-w-[180px]">
                <label className="block mb-1 text-base font-bold text-white">TENURE (Years)</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg text-white bg-black border rounded-lg form-control border-gray-600 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-400"
                  value={ceTenureYears}
                  placeholder="Years"
                  disabled
                  onFocus={e => {
                    // Position cursor at the end of numbers when focusing
                    const input = e.target;
                    const rawValue = input.value.replace(/[^0-9.]/g, "");
                    if (rawValue) {
                      setTimeout(() => {
                        input.setSelectionRange(rawValue.length, rawValue.length);
                      }, 0);
                    }
                  }}
                  onChange={handleCeTenureYearsChange}
                />
              </div>
              {/* ROI */}
              <div className="form-group flex-1 min-w-[140px]">
                <label className="block mb-1 text-base font-bold text-white">ROI</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg text-white bg-gray-700 border rounded-lg form-control border-gray-600 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-400"
                  value={ceRoi}
                  placeholder="%"
                  disabled={!canEdit}
                  onFocus={e => {
                    // Position cursor at the end of numbers when focusing
                    const input = e.target;
                    const rawValue = input.value.replace(/[^0-9.]/g, "");
                    if (rawValue) {
                      setTimeout(() => {
                        input.setSelectionRange(rawValue.length, rawValue.length);
                      }, 0);
                    }
                  }}
                  onChange={canEdit ? handleCeRoiChange : undefined}
                />
              </div>
              {/* TOTAL BT POS */}
              <div className="form-group flex-1 min-w-[180px] max-w-[180px]">
                <label className="block mb-1 text-base font-bold text-white">TOTAL BT POS</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-lg font-bold text-black bg-green-400 border border-green-600 rounded-lg form-control"
                  value={eligibility.totalBtPos}
                  readOnly
                />
              </div>
            </div>
            {/* Third Row - Loan Eligibility Results */}
            <div className="flex flex-wrap items-end gap-4 mb-2">
              {/* Loan Eligibility As Per FOIR */}
              <div className="form-group flex-1 min-w-[280px]">
                <label className="block mb-1 text-base font-bold text-white">FOIR Eligibility</label>
                <input
                  type="text"
                  className="w-full px-4 py-4 font-bold text-white bg-black border rounded-lg form-control border-gray-600 text-2xl"
                  value={eligibility.finalEligibility}
                  readOnly
                />
              </div>
              {/* Loan Eligibility As Per Multiplier */}
              <div className="form-group flex-1 min-w-[280px]">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-base font-bold text-white">Multiplier Eligibility</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Multiplier:</span>
                    <input
                      type="text"
                      className="w-16 px-2 py-1 text-black bg-yellow-400 border rounded-lg form-control border-yellow-600 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-black text-sm"
                      value={ceMultiplier}
                      onChange={canEdit ? handleCeMultiplierChange : undefined}
                      disabled={!canEdit}
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  className="w-full px-4 py-4 font-bold text-white bg-black border rounded-lg form-control border-gray-600 text-2xl"
                  value={eligibility.multiplierEligibility}
                  readOnly
                />
              </div>
            </div>
            
            {/* Balance Transfer Eligibility Message */}
            <div className="mt-6">
              {(() => {
                try {
                  const foirEligibility = parseINR(eligibility?.finalEligibility) || 0;
                  const totalBtPos = parseINR(eligibility?.totalBtPos) || 0;
                  
                  // Only show message if there's meaningful data for calculation
                  // Check if user has provided necessary inputs for a valid calculation
                  const hasRequiredInputs = 
                    (salary && parseINR(salary) > 0 || partnerSalary && parseINR(partnerSalary) > 0) && // Some income
                    (ceFoirPercent !== '' && ceFoirPercent !== null && ceFoirPercent !== undefined) && // FOIR percentage set
                    (ceRoi && parseROI(ceRoi) > 0) && // ROI provided
                    (ceTenureMonths && parseTenure(ceTenureMonths) > 0) && // Tenure provided
                    totalBtPos > 0; // Some BT POS amount exists
                  
                  if (!hasRequiredInputs) {
                    return null; // Don't show message if required inputs are missing
                  }
                  
                  if (foirEligibility >= totalBtPos) {
                    // Success message
                    return (
                      <div className="p-6 rounded-lg text-black text-center" style={{ backgroundColor: '#00FF00' }}>
                        <div className="flex items-center justify-center mb-2">
                          <svg className="w-8 h-8 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <h2 className="text-3xl font-extrabold">Congratulations!</h2>
                        </div>
                        <p className="text-2xl font-bold">Balance Transfer is Eligible</p>
                      </div>
                    );
                  } else {
                    // Failure message with shortfall
                    const shortfall = Math.max(0, totalBtPos - foirEligibility);
                    return (
                      <div className="p-6 rounded-lg text-white text-center" style={{ backgroundColor: '#FF0000' }}>
                        <div className="flex items-center justify-center mb-2">
                          <svg className="w-8 h-8 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <h2 className="text-3xl font-extrabold">Balance Transfer Not Possible</h2>
                        </div>
                        <p className="text-2xl font-bold">There is a shortfall of ₹{formatINR(shortfall.toString())}</p>
                      </div>
                    );
                  }
                } catch (error) {
                  console.error('Error in eligibility calculation:', error);
                  return null;
                }
              })()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Dropdown Cards - Positioned outside table container */}
      {(() => {
        try {
          if (!safeProductSearchStates || typeof safeProductSearchStates !== 'object') return null;
          
          const stateKeys = Object.keys(safeProductSearchStates || {});
          if (stateKeys.length === 0) return null;
          
          return stateKeys.map(idx => {
            // Multiple safety checks inside the map function
            if (!safeProductSearchStates || !safeProductSearchStates[idx] || typeof safeProductSearchStates[idx] !== 'object') return null;
            
            const stateForIdx = safeProductSearchStates[idx];
            if (!stateForIdx || !stateForIdx.isOpen) return null;
            
            return (
          <div
            key={`product-dropdown-${idx}`}
            className="fixed z-[9999] bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
            data-dropdown-container="true"
            style={{
              left: `${(dropdownPositions && dropdownPositions[`product-${idx}`]?.left) || 0}px`,
              top: `${(dropdownPositions && dropdownPositions[`product-${idx}`]?.top) || 0}px`,
              width: `${(dropdownPositions && dropdownPositions[`product-${idx}`]?.width) || 300}px`,
              maxHeight: '250px'
            }}
          >
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Search products..."
                  value={(safeProductSearchStates && safeProductSearchStates[idx]?.searchQuery) || ''}
                  onChange={(e) => canEdit && handleProductSearchChange(parseInt(idx), e.target.value)}
                  disabled={!canEdit}
                  onClick={(e) => e.stopPropagation()}
                  data-search-input="product"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto bg-white" data-dropdown-scroll="true">
              {getFilteredProducts(parseInt(idx)).map((product, index) => (
                <div
                  key={product.value}
                  className="px-4 py-3 text-sm text-black cursor-pointer hover:bg-blue-50 font-medium border-b border-gray-100 last:border-b-0 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProductSelect(parseInt(idx), product);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>{product.label}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">#{index + 1}</span>
                  </div>
                </div>
              ))}
              {getFilteredProducts(parseInt(idx)).length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                  <div className="text-gray-400 mb-1">🔍</div>
                  No products found
                </div>
              )}
            </div>
          </div>
            );
          });
        } catch (error) {
          console.warn('Error rendering product dropdowns:', error);
          return null;
        }
      })()}
      
      {(() => {
        try {
          if (!safeBankSearchStates || typeof safeBankSearchStates !== 'object') return null;
          
          const stateKeys = Object.keys(safeBankSearchStates || {});
          if (stateKeys.length === 0) return null;
          
          return stateKeys.map(idx => {
            // Multiple safety checks inside the map function
            if (!safeBankSearchStates || !safeBankSearchStates[idx] || typeof safeBankSearchStates[idx] !== 'object') return null;
            
            const stateForIdx = safeBankSearchStates[idx];
            if (!stateForIdx || !stateForIdx.isOpen) return null;
            
            return (
          <div
            key={`bank-dropdown-${idx}`}
            className="fixed z-[9999] bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
            data-dropdown-container="true"
            style={{
              left: `${(dropdownPositions && dropdownPositions[`bank-${idx}`]?.left) || 0}px`,
              top: `${(dropdownPositions && dropdownPositions[`bank-${idx}`]?.top) || 0}px`,
              width: `${(dropdownPositions && dropdownPositions[`bank-${idx}`]?.width) || 300}px`,
              maxHeight: '250px'
            }}
          >
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Search banks..."
                  value={(safeBankSearchStates && safeBankSearchStates[idx]?.searchQuery) || ''}
                  onChange={(e) => canEdit && handleBankSearchChange(parseInt(idx), e.target.value)}
                  disabled={!canEdit}
                  onClick={(e) => e.stopPropagation()}
                  data-search-input="bank"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto bg-white" data-dropdown-scroll="true">
              {getFilteredBanks(parseInt(idx)).map((bank, index) => (
                <div
                  key={`${bank}-${index}`}
                  className="px-4 py-3 text-sm text-black cursor-pointer hover:bg-blue-50 font-medium border-b border-gray-100 last:border-b-0 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log(`Bank option clicked: "${bank}" for index ${parseInt(idx)}`);
                    handleBankSelect(parseInt(idx), bank);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>{bank}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">#{index + 1}</span>
                  </div>
                </div>
              ))}
              {getFilteredBanks(parseInt(idx)).length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                  <div className="text-gray-400 mb-1">🔍</div>
                  No banks found
                </div>
              )}
            </div>
          </div>
            );
          });
        } catch (error) {
          console.warn('Error rendering bank dropdowns:', error);
          return null;
        }
      })()}

      {/* Bank Selection Popup - Updated for multiple selections */}
      {showBankPopup && (
        <BankPopup
          onClose={() => setShowBankPopup(false)}
          onSelect={(bank, isRemove = false) => {
            console.log('BankPopup: Selected bank for processing:', bank, isRemove ? '(removing)' : '(adding)');
            
            if (isRemove) {
              // Remove bank from selection
              setCompanyType(prev => {
                const updatedBanks = prev.filter(b => b !== bank);
                
                // Notify parent component of changes immediately for unsaved changes detection
                if (handleChangeFunc) {
                  handleChangeFunc('company_type', updatedBanks);
                }
                
                return updatedBanks;
              });
              console.log('Bank removed from selection:', bank);
              
              // Mark as changed to trigger auto-save
              markAsChanged();
              setHasUnsavedChanges(true);
              setHasUserInteraction(true);
            } else {
              // Add bank to selection
              handleAddBank(bank);
            }
            
            // Don't close popup automatically - allow multiple selections
            
            // Notification - auto-save will trigger automatically
            console.log('Bank selection updated. Data will auto-save immediately.');
          }}
          multiSelect={true}
          companyTypes={companyTypes}
          selectedInitial={companyType}
        />
      )}

      {/* Category Selection Popup */}
      {showCategoryPopup && (
        <CategoryPopup
        className="text-lg"
          initialCompanyName={companyName} // Pass current company name to pre-populate search
          onClose={() => setShowCategoryPopup(false)}
          onSelect={(category, isRemove = false) => {
            console.log('CategoryPopup: Selected category for immediate feedback:', category, isRemove ? '(removing)' : '(adding)');
            console.log('🔒 PARENT onSelect: This should NOT close the popup in multi-select mode');
            
            // For real-time visual feedback, immediately update the display in the main field
            // This makes selections visible instantly without waiting for Done button
            if (isRemove) {
              // Remove category from main state for immediate visual feedback
              setCompanyCategory(prev => {
                const getUniqueKey = (cat) => {
                  if (typeof cat === 'string') return cat;
                  if (cat.company_name && cat.bank_name && cat.category_name) {
                    return `${cat.company_name}_${cat.bank_name}_${cat.category_name}`;
                  }
                  if (cat.company_name && cat.category_name && !cat.bank_name) {
                    return `${cat.company_name}_${cat.category_name}`;
                  }
                  return cat.display_key || cat.value || cat.display_text || cat.label || cat.category_name || JSON.stringify(cat);
                };
                
                const categoryKey = getUniqueKey(category);
                return prev.filter(cat => getUniqueKey(cat) !== categoryKey);
              });
            } else {
              // Add category to main state for immediate visual feedback
              setCompanyCategory(prev => {
                const getUniqueKey = (cat) => {
                  if (typeof cat === 'string') return cat;
                  if (cat.company_name && cat.bank_name && cat.category_name) {
                    return `${cat.company_name}_${cat.bank_name}_${cat.category_name}`;
                  }
                  if (cat.company_name && cat.category_name && !cat.bank_name) {
                    return `${cat.company_name}_${cat.category_name}`;
                  }
                  return cat.display_key || cat.value || cat.display_text || cat.label || cat.category_name || JSON.stringify(cat);
                };
                
                const categoryKey = getUniqueKey(category);
                // Check if already exists to avoid duplicates
                if (prev.some(cat => getUniqueKey(cat) === categoryKey)) {
                  return prev;
                }
                return [...prev, category];
              });
            }
            
            console.log('✅ Immediate visual feedback applied to main field - popup should stay open');
            // DO NOT close the popup here - let the CategoryPopup handle its own state
          }}
          onSave={() => {
            // This is called when Done button is clicked
            console.log('CategoryPopup Done button clicked, popup will handle category processing');
            setShowCategoryPopup(false);
          }}
          multiSelect={true}
          companyCategories={dynamicCompanyCategories.length > 0 ? dynamicCompanyCategories : companyCategories}
          selectedInitial={companyCategory} // Pass the current selections
          // Add onAddCategory callback to handle final category additions
          onAddCategory={(categories) => {
            console.log('=== MAIN COMPONENT: onAddCategory CALLED ===');
            console.log('Received categories from popup:', categories);
            console.log('Categories count:', categories.length);
            console.log('Current companyCategory state before processing:', companyCategory);
            
            // Since we're already providing immediate feedback through onSelect,
            // the onAddCategory is mainly for final confirmation
            // Just ensure the final state matches what was selected
            setCompanyCategory(categories || []);
            
            // Notify parent component of changes immediately for unsaved changes detection
            if (handleChangeFunc) {
              const categoryObjects = (categories || []).map(cat => ({
                company_name: cat.company_name || companyName || '',
                bank_name: cat.bank_name || '',
                category_name: cat.category_name || cat.key || cat.display || '',
                display_text: cat.display_text || cat.display || cat.label || '',
                ...cat
              }));
              console.log('Sending complete category objects to backend:', categoryObjects);
              handleChangeFunc('company_category', categoryObjects);
            }
            
            console.log('Final category update completed');
            // Mark as having unsaved changes
            setHasUnsavedChanges(true);
          }}
        />
      )}
      
      {/* Save button removed - Using auto-save instead */}

      {/* Unsaved Changes Modal */}
      {showUnsavedChangesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 m-4 max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Unsaved Changes</h3>
              <p className="text-sm text-gray-600 mb-6">
                You have unsaved changes in the obligation section. Do you want to save your changes before leaving?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnsavedChangesModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Stay Here
                </button>
                <button
                  onClick={() => {
                    setShowUnsavedChangesModal(false);
                    setHasUnsavedChanges(false);
                    // Allow navigation to continue
                    window.location.reload();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Continue Without Saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// BankPopup component
function BankPopup({ onClose, onSelect, onSave, companyTypes, multiSelect = true, selectedInitial = [] }) {
  const [bankName, setBankName] = useState("");
  const [filteredBanks, setFilteredBanks] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [selectedBanks, setSelectedBanks] = useState(selectedInitial || []);
  const [popularBanks, setPopularBanks] = useState([
    'AXIS BANK', 'HDFC BANK', 'ICICI BANK', 'SBI', 'YES BANK',
    'KOTAK BANK', 'IDFC FIRST BANK', 'BAJAJ FINANCE'
  ]);

  // Fetch bank names on component mount
  useEffect(() => {
    const loadBanks = async () => {
      setIsLoadingBanks(true);
      try {
        const banks = await fetchBankNames();
        if (banks && banks.length > 0) {
          // Convert to the format expected by the component
          const formattedBanks = banks.map(bank => ({
            value: typeof bank === 'string' ? bank : (bank.name || bank.label || String(bank)),
            label: typeof bank === 'string' ? bank : (bank.name || bank.label || String(bank))
          }));
          
          // Ensure popular banks are at the top
          const allBanks = [...formattedBanks];
          const uniqueBanks = [];
          
          // Add popular banks first (if they're in the list)
          popularBanks.forEach(popularBank => {
            const foundBank = allBanks.find(bank => 
              bank.label.toUpperCase().includes(popularBank) || 
              popularBank.includes(bank.label.toUpperCase())
            );
            
            if (foundBank) {
              uniqueBanks.push(foundBank);
            }
          });
          
          // Then add all other banks that aren't already in the list
          allBanks.forEach(bank => {
            if (!uniqueBanks.some(b => b.value === bank.value)) {
              uniqueBanks.push(bank);
            }
          });
          
          setBankList(uniqueBanks);
          setFilteredBanks(uniqueBanks);
        } else {
          // Fallback to companyTypes if API call fails
          setFilteredBanks(companyTypes);
        }
      } catch (error) {
        console.error('Error loading banks:', error);
        setFilteredBanks(companyTypes);
      } finally {
        setIsLoadingBanks(false);
      }
    };

    loadBanks();
  }, [companyTypes, popularBanks]);

  // Filter banks based on search input
  useEffect(() => {
    // If bankName is empty, show all banks
    if (bankName.trim() === "") {
      setFilteredBanks(bankList.length > 0 ? bankList : companyTypes);
    } else {
      // Otherwise, filter based on input
      const banksToFilter = bankList.length > 0 ? bankList : companyTypes;
      setFilteredBanks(
        banksToFilter.filter((bank) =>
          bank.label.toLowerCase().includes(bankName.toLowerCase())
        )
      );
    }
  }, [bankName, bankList, companyTypes]);

  const handleAssign = () => {
    if (bankName.trim()) {
      console.log('Bank assigned via Add Bank button:', bankName);
      
      // For multi-select mode, use the selected banks
      if (multiSelect) {
        // Add the current typed bank if needed
        if (bankName.trim() && !selectedBanks.includes(bankName.trim())) {
          onSelect(bankName.trim(), false);
          
          // Also add to local selection state
          setSelectedBanks(prev => [...prev, bankName.trim()]);
        }
      } 
      // For single-select mode, just use the current input
      else {
        onSelect(bankName.trim(), false);
        onClose(); // Only close in single-select mode
      }
      
      // Clear the input after assigning but keep popup open in multi-select mode
      setBankName("");
      
      // Never close the popup in multi-select mode from this function
      // The user must explicitly click "Done" or "Cancel"
    }
  };

  const selectBank = (selectedBank) => {
    // Ensure label is a string
    const labelValue = typeof selectedBank.label === 'string' 
      ? selectedBank.label 
      : String(selectedBank.label || selectedBank.value || '');
    
    // Check if the bank is already selected
    const isAlreadySelected = selectedBanks.includes(labelValue);
    
    if (isAlreadySelected) {
      // Remove from selected banks if already selected
      setSelectedBanks(prev => prev.filter(bank => bank !== labelValue));
      
      // Always notify parent that item was removed, regardless of multi-select mode
      // This ensures changes show up in the main field immediately
      if (typeof onSelect === 'function') {
        onSelect(labelValue, true); // true indicates removal
      }
    } else {
      // Add to selected banks
      setSelectedBanks(prev => [...prev, labelValue]);
      
      // Always notify parent when a bank is selected, regardless of multi-select mode
      // This ensures changes show up in the main field immediately
      if (typeof onSelect === 'function') {
        onSelect(labelValue, false); // false indicates addition
      }
    }
    
    // Don't set search field to the selected bank name
    // Keep search field empty to allow manual searching
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
    >
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[95%] max-w-2xl mx-auto relative">
        <div className="flex items-center mb-4 bg-white bg-opacity-90 p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white text-lg flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
            </svg>
          </div>
          <h3 className="font-bold text-lg text-black">{multiSelect ? "Select Multiple Banks" : "Select Bank"}</h3>
          {multiSelect && <span className="ml-2 text-sm text-gray-600">(Click multiple items to select)</span>}
        </div>

        <div className="mb-4 bg-white bg-opacity-90 p-3 rounded-md">
          <label className="block font-bold text-gray-700 mb-2 text-lg">
            Search Banks {multiSelect && "(Select Multiple)"}
          </label>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 border border-cyan-400 rounded text-black font-bold text-lg"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Search or enter bank name"
            />
            {bankName && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-lg text-gray-400 hover:text-gray-600"
                onClick={() => setBankName("")}
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Show loading or the bank list */}
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90">
          {isLoadingBanks ? (
            <div className="p-5 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 text-lg border-t-2 border-b-2 border-cyan-500"></div>
              <span className="ml-3 text-gray-600 text-lg">Loading banks...</span>
            </div>
          ) : filteredBanks.length > 0 ? (
            filteredBanks.map((bank) => {
              // Get label value for consistency
              const labelValue = typeof bank.label === 'string' 
                ? bank.label 
                : String(bank.label || bank.value || '');
                
              // Check if this bank is selected (using more robust check)
              const isSelected = selectedBanks.some(b => 
                b === labelValue || 
                (typeof b === 'object' && b?.label === labelValue)
              );
              
              return (
                <div
                  key={bank.value || labelValue}
                  className={`p-3 border-b last:border-b-0 cursor-pointer text-lg text-black transition flex items-center ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                  onClick={() => selectBank(bank)}
                >
                  {/* Profile icon with initials */}
                  <div className={`w-8 h-8 rounded-full ${isSelected ? 'bg-cyan-600' : 'bg-[#03B0F5]'} text-white flex items-center justify-center mr-3 flex-shrink-0`}>
                    {typeof labelValue === 'string' 
                      ? labelValue.split(' ')
                          .map(part => part[0] || '')
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'BK'}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg">{labelValue}</div>
                  </div>
                  {/* Show checkmark if selected */}
                  {isSelected && (
                    <div className="ml-2 text-cyan-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            bankName.trim() !== "" && ( // Only show "No results" if user typed something and no results
              <div className="p-3 text-gray-500 text-center text-lg">No matching banks found.</div>
            )
          )}
        </div>

        <div className="flex justify-end gap-4 mt-4 bg-white bg-opacity-90 p-3 rounded-b-xl">
          {bankName.trim() && (
            <button
              className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow text-lg hover:bg-cyan-700 transition"
              onClick={handleAssign}
            >
              {multiSelect ? "Add Bank" : "Add Bank"}
            </button>
          )}
          {multiSelect && (
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow text-lg hover:bg-blue-700 transition"
              onClick={() => {
                // Keep all selections and close the popup
                onClose();
              }}
            >
              Done
            </button>
          )}
          <button
            className="px-6 py-3 bg-gray-400 text-white text-lg rounded-xl shadow hover:bg-gray-500 transition"
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

// 📊 REAL-TIME DATA MONITORING for Login Transfers and Gunjan Sharma Analysis
function useDataMonitoring(leadData, salary, loanRequired, companyName, ceCompanyCategory, ceFoirPercent, obligations, dataLoaded, isInitialLoad, savedData) {
  useEffect(() => {
    // Monitor specific leads and login transfers
    const isGunjanLead = (leadData?.name || '').toLowerCase().includes('gunjan') || 
                        (leadData?.customer_name || '').toLowerCase().includes('gunjan');
    const isLoginTransfer = leadData?.file_sent_to_login;
    
    if (isGunjanLead || isLoginTransfer) {
      const leadType = isGunjanLead ? '🎯 GUNJAN SHARMA' : '🔄 LOGIN TRANSFER';
      
      console.log(`${leadType} - REAL-TIME DATA MONITORING:`, {
        timestamp: new Date().toISOString(),
        leadInfo: {
          leadId: leadData?._id,
          leadName: leadData?.name || leadData?.customer_name || 'Unknown',
          file_sent_to_login: leadData?.file_sent_to_login,
          isGunjan: isGunjanLead,
          isLogin: isLoginTransfer
        },
        currentState: {
          salary: salary || '(empty)',
          loanRequired: loanRequired || '(empty)', 
          companyName: companyName || '(empty)',
          ceCompanyCategory: ceCompanyCategory || '(empty)',
          ceFoirPercent: ceFoirPercent || '(empty)',
          obligationsCount: obligations.length,
          dataLoaded: dataLoaded,
          isInitialLoad: isInitialLoad
        },
        dataSourceSnapshot: {
          hasApiData: !!savedData && Object.keys(savedData).length > 0,
          hasDynamicFields: !!leadData?.dynamic_fields,
          hasDynamicDetails: !!leadData?.dynamic_details,
          hasFinancialDetails: !!(leadData?.dynamic_fields?.financial_details || leadData?.dynamic_details?.financial_details),
          hasEligibilityData: !!(leadData?.dynamic_fields?.check_eligibility || leadData?.dynamic_fields?.eligibility),
          apiDataSize: savedData ? Object.keys(savedData).length : 0,
          leadDataSize: leadData ? Object.keys(leadData).length : 0
        },
        dataLossIndicators: {
          emptyFieldsCount: [salary, loanRequired, companyName, ceCompanyCategory].filter(v => !v || v === '').length,
          totalFieldsChecked: 4,
          dataLossPercentage: ([salary, loanRequired, companyName, ceCompanyCategory].filter(v => !v || v === '').length / 4) * 100
        }
      });

      // Store state snapshot for recovery
      if (leadData?._id && (salary || loanRequired || companyName)) {
        try {
          const stateSnapshot = {
            salary,
            loanRequired, 
            companyName,
            ceCompanyCategory,
            ceFoirPercent,
            timestamp: Date.now(),
            leadId: leadData._id
          };
          localStorage.setItem(`stateSnapshot_${leadData._id}`, JSON.stringify(stateSnapshot));
          console.log(`${leadType} - State snapshot saved for recovery`);
        } catch (e) {
          console.warn(`${leadType} - Failed to save state snapshot:`, e);
        }
      }
    }
  }, [leadData?._id, leadData?.file_sent_to_login, salary, loanRequired, companyName, ceCompanyCategory, ceFoirPercent, obligations.length, dataLoaded, isInitialLoad, savedData]);
}

// CategoryPopup component - Enhanced company category search with API integration
function CategoryPopup({ initialCompanyName = '', onClose, onSelect, onSave, onAddCategory, companyCategories, multiSelect = true, selectedInitial = [] }) {
  const [companySearchInput, setCompanySearchInput] = useState(initialCompanyName || ""); // Use passed company name as initial search
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(selectedInitial || []);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Debug log
  console.log('CategoryPopup rendered with multiSelect:', multiSelect, 'Initial selections:', selectedInitial, 'Initial company name:', initialCompanyName);

  // Initialize selected categories from props
  useEffect(() => {
    if (selectedInitial && Array.isArray(selectedInitial) && selectedInitial.length > 0) {
      console.log('Initializing selected categories from props:', selectedInitial);
      setSelectedCategories(selectedInitial);
    } else {
      console.log('No initial selections provided or empty array');
      setSelectedCategories([]);
    }
  }, [selectedInitial]);

  // Auto-search when popup opens with initial company name
  useEffect(() => {
    if (initialCompanyName && initialCompanyName.trim().length >= 2) {
      console.log('Auto-searching for initial company name:', initialCompanyName);
      // Delay the search slightly to allow the component to fully mount
      setTimeout(() => {
        handleSearch();
      }, 100);
    }
  }, [initialCompanyName]); // Only run when component mounts with initial company name
  
  // Auto-search when user types
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Only set timeout if there's input to search
    if (companySearchInput.trim() !== "" && companySearchInput.trim().length >= 2) {
      // Set new timeout for debounced search
      const timeout = setTimeout(() => {
        handleSearch();
      }, 500); // Increased delay for better performance
      
      setSearchTimeout(timeout);
      
      // Cleanup function
      return () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    } else {
      // Clear search results when input is empty or too short
      setSearchResults([]);
      setFilteredCategories([]);
      setHasSearched(false);
      setErrorMessage('');
    }
  }, [companySearchInput]);

  // Enhanced search function for company categories
  const handleSearch = async () => {
    const searchQuery = companySearchInput.trim();
    
    if (!searchQuery || searchQuery.length < 2) {
      console.log('Search query too short, skipping search');
      setErrorMessage('Please enter at least 2 characters to search');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setHasSearched(true);
    
    try {
      const userId = getUserId();
      
      if (!userId) {
        throw new Error('No user ID found. Please log in again.');
      }

      console.log('🔍 Searching for company:', searchQuery);

      const requestPayload = {
        company_name: searchQuery,
        similarity_threshold: 0.6
      };

      const response = await fetch(`${API_BASE_URL}/settings/search-companies?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        if (response.status === 422) {
          throw new Error('Invalid search query. Please check your input.');
        } else if (response.status === 404) {
          throw new Error('No companies found matching your search.');
        } else {
          throw new Error(`Search failed with status ${response.status}`);
        }
      }

      const data = await response.json();
      console.log('✅ Search results received:', data);

      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
        
        // Transform data for display
        const transformedCategories = data.map((company, index) => {
          const companyName = company.company_name || 'Unknown Company';
          const categories = company.categories || [];
          const bankNames = company.bank_names || [];
          const similarity = company.similarity_percentage || 0;
          
          return categories.map((categoryName, catIndex) => ({
            id: `${companyName}-${categoryName}-${bankNames[0] || 'Unknown'}-${index}-${catIndex}`,
            company_name: companyName,
            category_name: categoryName,
            bank_name: bankNames[0] || 'No Bank Info',
            bank_names: bankNames,
            categories: categories,
            similarity_percentage: similarity,
            display_text: `${companyName} → ${bankNames[0] || 'No Bank'} → ${categoryName}`,
            display_key: `${companyName}-${bankNames[0] || 'Unknown'}-${categoryName}`,
            label: `${companyName} → ${bankNames[0] || 'No Bank'} → ${categoryName}`,
            value: `${companyName}-${bankNames[0] || 'Unknown'}-${categoryName}`
          }));
        }).flat();
        
        setFilteredCategories(transformedCategories);
        console.log('📊 Transformed categories:', transformedCategories.length, 'categories found');
        
      } else {
        setSearchResults([]);
        setFilteredCategories([]);
        setErrorMessage(`No companies found matching "${searchQuery}". Try a different search term.`);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
      setFilteredCategories([]);
      setErrorMessage(error.message || 'Failed to search companies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle category selection/deselection
  const handleCategoryClick = (category) => {
    console.log('🔥 CATEGORY CLICKED:', category);
    
    if (!multiSelect) {
      // Single select mode
      setSelectedCategories([category]);
    } else {
      // Multi select mode
      let newSelection = [...selectedCategories];
      const categoryKey = category.display_key || category.value || category.display_text || category.category_name || JSON.stringify(category);
      
      // Check if category is already selected
      const existingIndex = newSelection.findIndex(selected => {
        const selectedKey = selected.display_key || selected.value || selected.display_text || selected.category_name || JSON.stringify(selected);
        return selectedKey === categoryKey;
      });
      
      if (existingIndex >= 0) {
        // Remove from selection
        newSelection.splice(existingIndex, 1);
      } else {
        // Add to selection
        newSelection.push(category);
      }
      
      setSelectedCategories(newSelection);
    }
  };

  // Check if a category is selected
  const isCategorySelected = (category) => {
    const categoryKey = category.display_key || category.value || category.display_text || category.category_name || JSON.stringify(category);
    return selectedCategories.some(selected => {
      const selectedKey = selected.display_key || selected.value || selected.display_text || selected.category_name || JSON.stringify(selected);
      return selectedKey === categoryKey;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
      data-category-popup-backdrop="true"
      onClick={(e) => {
        // Only close if clicking EXACTLY on the backdrop, not on the popup content
        console.log('Backdrop clicked, checking if should close popup');
        console.log('Event target:', e.target);
        console.log('Current target:', e.currentTarget);
        console.log('Are they the same?', e.target === e.currentTarget);
        
        if (e.target === e.currentTarget) {
          console.log('✅ Clicked on backdrop - closing popup');
          onClose();
        } else {
          console.log('❌ Clicked inside popup content - NOT closing');
        }
      }}
    >
      <div 
        className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[95%] max-w-2xl mx-auto relative"
        data-category-popup-container="true"
        onClick={(e) => {
          // Prevent clicks inside the popup from bubbling up and closing it
          e.stopPropagation();
        }}
      >
        <div className="flex items-center mb-4 bg-white bg-opacity-90 p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#10B981] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="font-bold text-lg text-black">{multiSelect ? "Select Multiple Categories" : "Select Category"}</h3>
          {multiSelect && <span className="ml-2 text-sm text-gray-600">(Select multiple, options stay open)</span>}
        </div>

        <div className="mb-4 bg-white bg-opacity-90 p-3 rounded-md">
          <label className="block font-bold text-gray-700 mb-2 text-lg">
            Search Categories {multiSelect && "(Options stay open for multiple selection)"}
          </label>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 border border-green-400 rounded text-black font-bold text-lg"
              value={companySearchInput}
              onChange={(e) => {
                setCompanySearchInput(e.target.value);
                // Search will be triggered automatically by useEffect
              }}
              placeholder="Search by company name"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            {companySearchInput && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setCompanySearchInput("")}
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Categories list */}
        <div 
          className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90"
          data-category-list="true"
          onClick={(e) => {
            // Prevent clicks in the categories list from bubbling up
            e.stopPropagation();
          }}
        >
          {loading ? (
            <div className="p-5 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              <span className="ml-3 text-gray-600">Loading categories...</span>
            </div>
          ) : (
            // Show different content based on search input
            companySearchInput.trim() === "" ? (
              // No search input - show instruction message
              <div className="p-5 text-center">
                <div className="text-gray-500 text-lg mb-2">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  Search company name to choose Company Category
                </div>
                <div className="text-sm text-gray-400">
                  Type a company name above to see available categories
                </div>
              </div>
            ) : (
              // Has search input - show results or no results message
              filteredCategories.length > 0 ? (
                filteredCategories.map((category, index) => {
                  // Handle both string and object formats
                  let labelValue, displayText;
                  
                  if (typeof category === 'string') {
                    labelValue = category;
                    displayText = category;
                  } else {
                    labelValue = category.label || category.display_text || category.category_name || '';
                    displayText = category.display_text || category.label || `${category.company_name || ''} → ${category.bank_name || ''} → ${category.category_name || ''}`;
                  }

                  // Check if this category is selected using our helper function
                  const isSelected = isCategorySelected(category);
                  
                  // Generate a unique key for React
                  const categoryKey = category.display_key || category.value || category.display_text || category.category_name || JSON.stringify(category);

                  console.log(`🎨 Rendering "${displayText}" - isSelected: ${isSelected}, key: ${categoryKey}, total selected: ${selectedCategories.length}`);

                  // MANUAL SELECTION ONLY - Users select options manually by clicking
                  const shouldShowSelected = isSelected; // Only show selected if actually selected by user
                  console.log(`🖌️ Visual Debug - shouldShowSelected: ${shouldShowSelected} for "${displayText}" (manual selection only)`);
                  
                  // DIRECT STYLE TEST - Let's try a different approach
                  const itemStyles = shouldShowSelected ? {
                    backgroundColor: '#dcfce7',
                    borderColor: '#86efac',
                    borderWidth: '3px',
                    borderStyle: 'solid',
                    boxShadow: '0 0 10px rgba(134, 239, 172, 0.5)'
                  } : {
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    boxShadow: 'none'
                  };
                  
                  console.log(`🎨 ITEM STYLES for "${displayText}":`, itemStyles);
                  
                  return (
                    <div
                      key={`category-${categoryKey}-${index}`}
                      className="p-3 border-b last:border-b-0 cursor-pointer text-lg text-black transition flex items-center"
                      style={itemStyles}
                      onClick={(e) => {
                        // Prevent ALL event propagation
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.stopImmediatePropagation) {
                          e.stopImmediatePropagation();
                        }
                        
                        console.log('🖱️ ========== CATEGORY CLICKED ==========');
                        console.log('🖱️ Display Text:', displayText);
                        console.log('🖱️ Current isSelected BEFORE click:', isSelected);
                        console.log('🖱️ shouldShowSelected BEFORE click:', shouldShowSelected);
                        console.log('🖱️ Category object:', category);
                        console.log('🖱️ Current selectedCategories BEFORE:', selectedCategories);
                        console.log('🖱️ selectedCategories length:', selectedCategories.length);
                        
                        handleCategoryClick(category);
                        
                        console.log('🖱️ ========== CLICK COMPLETE ==========');
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.stopImmediatePropagation) {
                          e.stopImmediatePropagation();
                        }
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.stopImmediatePropagation) {
                          e.stopImmediatePropagation();
                        }
                      }}
                      data-category-popup-item="true"
                    >
                      {/* Profile icon with initials */}
                      <div 
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center mr-3 flex-shrink-0"
                        style={{
                          backgroundColor: shouldShowSelected ? '#16a34a' : '#10B981',
                          border: shouldShowSelected ? '2px solid #059669' : 'none'
                        }}>
                        {labelValue
                          ? labelValue.split(' ')
                              .map(part => part[0] || '')
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : 'CA'}
                      </div>
                      <div className="flex-1">
                        <div 
                          style={{
                            color: shouldShowSelected ? '#166534' : '#111827',
                            fontWeight: shouldShowSelected ? 'bold' : 'normal'
                          }}
                          className="font-medium text-lg">{displayText}</div>
                      </div>
                      {/* Show checkmark if selected */}
                      {shouldShowSelected && (
                        <div className="ml-2" style={{ color: '#16a34a' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ stroke: '#16a34a', strokeWidth: '3' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Search input provided but no results found
                <div className="p-5 text-center">
                  <div className="text-red-500 text-lg mb-2">
                    <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33"></path>
                    </svg>
                    No search company found
                  </div>
                  <div className="text-sm text-gray-500">
                    Try searching with a different company name
                  </div>
                </div>
              )
            )
          )}
        </div>

        <div className="flex justify-end gap-4 mt-4 bg-white bg-opacity-90 p-3 rounded-b-xl">
          {/* DEBUG: Show selected count */}
          <div className="px-4 py-2 bg-gray-100 rounded text-sm">
            Selected: {selectedCategories.length} categories
          </div>
          
          {multiSelect && (
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow text-lg hover:bg-blue-700 transition"
              onClick={() => {
                console.log('=== DONE BUTTON CLICKED ===');
                console.log('selectedCategories to send:', selectedCategories);
                console.log('onAddCategory function available:', typeof onAddCategory === 'function');
                console.log('onSelect function available:', typeof onSelect === 'function');
                
                // Send all selected categories to parent when Done is clicked
                
                // Use onAddCategory callback if available (new approach)
                if (onAddCategory && typeof onAddCategory === 'function') {
                  console.log('Using onAddCategory callback to process categories');
                  onAddCategory(selectedCategories);
                } else {
                  console.log('Fallback: Using onSelect for each category');
                  // Fallback to old approach
                  selectedCategories.forEach(category => {
                    console.log('Adding category via onSelect:', category);
                    onSelect(category, false); // false indicates addition
                  });
                }
                
                console.log('=== CLOSING POPUP ===');
                // Close the popup after sending categories
                if (onSave) onSave();
                else onClose();
              }}
            >
              Done
            </button>
          )}
          <button
            className="px-6 py-3 bg-gray-400 text-white text-lg rounded-xl shadow hover:bg-gray-500 transition"
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