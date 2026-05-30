import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import {
  Plus
} from 'lucide-react';
import API from "../services/api";
import { toast } from "react-toastify";
import { formatDateTime } from '../utils/dateUtils';
import { getUserPermissions, hasPermission, isSuperAdmin } from '../utils/permissions';
import useTabWithHistory from '../hooks/useTabWithHistory';
import useModalHistory from '../hooks/useModalHistory';
import useNavbarPageSearch from '../hooks/useNavbarPageSearch';

// API base URL - Always use API proxy
const API_BASE_URL = '/api';

// Lazy load heavy components for better initial load time
const CreateTicket = lazy(() => import("./CreateTicket"));
const EditTicket = lazy(() => import("./EditTicket"));

// Helper to break a long message into multiple lines of a given length
const breakMessage = (message, maxLen = 41) => {
  if (!message) return "";
  const words = message.split(" ");
  let lines = [];
  let currentLine = "";
  words.forEach((word) => {
    if ((currentLine + " " + word).trim().length > maxLen) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += " " + word;
    }
  });
  if (currentLine) lines.push(currentLine.trim());
  return lines;
};

// Main component with optimizations
export default function TicketPage() {
  const ticketPageStyles = `
    .task-page-container { padding: 0; max-width: 100%; background: #000; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Lexend Deca', sans-serif; color: #e2e8f0; }
    .task-top-bar { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; border-bottom: 1px solid #1f1f27; background: #000; }
    .task-top-bar-left h1 { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0 0 2px; line-height: 1.2; }
    .task-top-bar-left p { font-size: 13px; color: #6b7a99; margin: 0 0 12px; }
    .task-top-bar-right { display: flex; gap: 8px; align-items: center; padding-top: 4px; }
    .task-btn-secondary { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; }
    .task-btn-secondary:hover { background: #22222e; border-color: #3a3a50; }
    .task-btn-create { background: #3b82f6; color: #fff; border: none; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s; white-space: nowrap; }
    .task-btn-create:hover { background: #2563eb; }
    .task-view-toggle-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 24px; background: #000; border-bottom: 1px solid #1f1f27; flex-wrap: wrap; }
    .task-view-toggle-group { display: flex; gap: 0; flex-wrap: wrap; flex: 0 1 auto; min-width: 0; }
    .task-view-toggle-btn { padding: 12px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #6b7a99; cursor: pointer; border-bottom: 3px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
    .task-view-toggle-btn:hover { color: #c8d0e0; }
    .task-view-toggle-btn.active { color: #f97316; font-weight: 800; border-bottom-color: #f97316; }
    .task-filter-dropdown { padding: 6px 28px 6px 10px; border-radius: 3px; border: 1px solid #2a2a3a; background-color: #1a1a24; color: #c8d0e0; font-size: 13px; font-weight: 500; appearance: none; min-height: 32px; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%236b7a99" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 8px center; cursor: pointer; outline: none; }
    .task-filter-dropdown:focus { border-color: #3b82f6; }
    .task-filter-dropdown-assign { min-width: 140px; }
    .task-search-box--in-bar { position: relative; width: 260px; min-width: 200px; flex-shrink: 0; }
    .task-search-box--in-bar input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 6px 14px 6px 32px; color: #c8d0e0; font-size: 13px; width: 100%; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
    .task-search-box--in-bar input::placeholder { color: #4a5570; }
    .task-search-box--in-bar input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .task-search-box--in-bar svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: #4a5570; }
    .task-toolbar-right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; flex-shrink: 0; flex-wrap: wrap; }
    .task-select-controls { display: flex; align-items: center; gap: 8px; }
    .task-select-controls label { display: flex; align-items: center; cursor: pointer; color: #c8d0e0; font-size: 13px; gap: 5px; }
    .task-select-controls span { color: #6b7a99; font-size: 13px; }
    .task-select-btn-del { padding: 5px 12px; background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; border-radius: 3px; font-size: 13px; cursor: pointer; }
    .task-select-btn-del:hover { background: #2a0f0f; }
    .task-select-btn-cancel { padding: 5px 12px; background: #1a1a24; color: #6b7a99; border: 1px solid #2a2a3a; border-radius: 3px; font-size: 13px; cursor: pointer; }
    .task-select-btn-cancel:hover { background: #22222e; }
    .task-data-table-header { background: #ffffff; border-top: 1px solid #e5e7eb; border-bottom: 2px solid #e5e7eb; display: flex; padding: 12px 24px; align-items: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .task-th { color: #03b0f5; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; text-align: left; flex: 1; }
    .task-th.number { flex: 0 0 36px; }
    .task-th.created { flex: 1.2; }
    .task-th.subject { flex: 2; }
    .task-th.record { flex: 1.5; }
    .task-th.assigned { flex: 1.5; }
    .task-th.status { flex: 0 0 100px; }
    .task-data-table-body { display: flex; flex-direction: column; }
    .task-row { background: #000; border-bottom: 1px solid #1a1a22; display: flex; padding: 11px 24px; align-items: center; cursor: pointer; transition: background 0.1s; animation: taskSlideIn 0.2s ease-out; }
    .task-row:hover { background: #13131c; }
    .task-td { font-size: 13px; color: #ffffff; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 12px; }
    .task-td.number { flex: 0 0 36px; color: #ffffff; font-size: 12px; font-weight: 600; }
    .task-td.created { flex: 1.2; }
    .task-td.subject { flex: 2; font-weight: 700; color: #ffffff; }
    .task-td.record { flex: 1.5; white-space: normal; line-height: 1.4; }
    .task-td.assigned { flex: 1.5; }
    .task-td.status { flex: 0 0 100px; }
    .task-status-badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 2px; font-size: 11px; font-weight: 600; }
    .task-sts-pending { background: #1a1a24; color: #6b7a99; border: 1px solid #2a2a3a; }
    .task-sts-complete { background: #0a2a22; color: #34d399; border: 1px solid #064e3b; }
    .task-sts-failed { background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; }
    .task-created-meta-col { display: flex; flex-direction: column; gap: 1px; }
    .task-created-meta-name { font-weight: 600; color: #ffffff; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .task-created-meta-date { font-size: 11px; color: #ffffff; font-weight: 500; }
    .task-empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; text-align: center; }
    .task-empty-state-title { font-size: 17px; font-weight: 700; color: #c8d0e0; margin: 0 0 6px; }
    .task-empty-state-sub { font-size: 14px; color: #4a5570; margin: 0; }
    .task-loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; }
    .task-loading-spinner .spinner { width: 32px; height: 32px; border: 3px solid #1a1a24; border-top-color: #3b82f6; border-radius: 50%; animation: taskSpin 0.7s linear infinite; margin-bottom: 12px; }
    @keyframes taskSpin { to { transform: rotate(360deg); } }
    .task-error-banner { margin: 0 24px 16px; padding: 12px 16px; background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 3px; color: #f87171; }
    .task-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
    @keyframes taskSlideIn { from { opacity: 0; } to { opacity: 1; } }
  `;

  // State management - grouped for better performance
  const [tickets, setTickets] = useState([]);
  const [allTicketsForCounting, setAllTicketsForCounting] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Start with false for faster initial render
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  useNavbarPageSearch(setSearch);
  const [activeFilter, setActiveFilter] = useTabWithHistory('status', 'open', { localStorageKey: 'ticketActiveFilter' });
  const [assignmentFilter, setAssignmentFilter] = useTabWithHistory('assignment', 'me', { localStorageKey: 'ticketAssignmentFilter' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [subordinateUserIds, setSubordinateUserIds] = useState([]);
  
  // Browser back button closes ticket edit modal
  useModalHistory(!!selectedTicket, () => {
    setSelectedTicket(null);
    setModalLoading(false);
    setPreventDuplicateModal(false);
    setLastClickedTicketId(null);
  });
  
  // Modal loading and duplicate prevention states
  const [modalLoading, setModalLoading] = useState(false);
  const [preventDuplicateModal, setPreventDuplicateModal] = useState(false);
  const [lastClickedTicketId, setLastClickedTicketId] = useState(null); // Track last clicked ticket
  
  // Cache for faster tab switching
  const [ticketCache, setTicketCache] = useState({});
  
  // Flag to prevent useEffect from triggering during status change
  const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState(false);
  
  // Removed pagination state as we now show all tickets at once

  const userIdentity = useMemo(() => {
    try {
      const raw = localStorage.getItem('userData');
      const parsed = raw ? JSON.parse(raw) : {};
      const currentUserName = (currentUser || '').toLowerCase().trim();
      return {
        id: parsed.user_id || parsed._id || parsed.id || '',
        name: currentUserName,
      };
    } catch (error) {
      return { id: '', name: (currentUser || '').toLowerCase().trim() };
    }
  }, [currentUser]);

  // Permission management
  const [permissions, setPermissions] = useState({
    show: true,
    own: true,
    junior: false,
    all: false, // Add all permission field to initial state
    delete: false // Reset to false - will be set by API or wildcard permissions
  });

  // Select button states
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // Load permissions - Using same pattern as Tasks for consistency
  const loadPermissions = () => {
    try {
      const userPermissions = getUserPermissions();
      console.log('🎫 ===== LOADING TICKET PERMISSIONS =====');
      console.log('🎫 userPermissions:', JSON.stringify(userPermissions, null, 2));
      console.log('🎫 Type:', typeof userPermissions, '| Is Array:', Array.isArray(userPermissions));
      
      // Check if user is super admin
      if (isSuperAdmin(userPermissions)) {
        console.log('✅ User is Super Admin - granting all permissions');
        setPermissions({
          show: true,
          own: true,
          junior: true,
          all: true,
          delete: true // Super admin gets all permissions including delete
        });
        return;
      }

      // Check specific ticket permissions using hasPermission utility (SAME AS TASKS)
      const ticketPermissions = {
        show: hasPermission(userPermissions, 'tickets', 'show') || hasPermission(userPermissions, 'Tickets', 'show'),
        own: hasPermission(userPermissions, 'tickets', 'own') || hasPermission(userPermissions, 'Tickets', 'own'),
        junior: hasPermission(userPermissions, 'tickets', 'junior') || hasPermission(userPermissions, 'tickets', 'view_team') || hasPermission(userPermissions, 'Tickets', 'junior') || hasPermission(userPermissions, 'Tickets', 'view_team'),
        all: hasPermission(userPermissions, 'tickets', 'all') || hasPermission(userPermissions, 'tickets', 'view_all') || hasPermission(userPermissions, 'Tickets', 'all') || hasPermission(userPermissions, 'Tickets', 'view_all'),
        delete: hasPermission(userPermissions, 'tickets', 'delete') || hasPermission(userPermissions, 'Tickets', 'delete')
      };

      console.log('🔍 Ticket Permissions from hasPermission:', ticketPermissions);

      // Check for wildcard permissions (not the same as "all" permission)
      if (userPermissions?.tickets === "*" || userPermissions?.Tickets === "*") {
        console.log('✅ Wildcard permission detected - granting everything');
        setPermissions({
          show: true,
          own: true,
          junior: true,
          all: true,
          delete: true // Wildcard (*) users get delete permission
        });
        return;
      }

      // Set calculated permissions (SIMPLIFIED - use hasPermission results directly like Tasks)
      if (ticketPermissions.show) {
        setPermissions({
          show: true,
          own: ticketPermissions.own || true,
          junior: ticketPermissions.junior,
          all: ticketPermissions.all,
          delete: ticketPermissions.delete // Use hasPermission result directly
        });
        console.log('✅ Final permissions set:', {
          show: true,
          own: ticketPermissions.own || true,
          junior: ticketPermissions.junior,
          all: ticketPermissions.all,
          delete: ticketPermissions.delete
        });
      } else {
        setPermissions({
          show: false,
          own: false,
          junior: false,
          all: false,
          delete: false
        });
        console.log('⚠️ No show permission - denying all access');
      }
    } catch (error) {
      console.error('❌ Error loading permissions:', error);
      // Set minimal default permissions on error
      setPermissions({
        show: true,
        own: true,
        junior: false,
        all: false,
        delete: false
      });
    }
  };

  useEffect(() => {
    // Get current user ID from localStorage
    try {
      const userId = localStorage.getItem('userId');
      if (userId) {
        setCurrentUserId(userId);
      } else {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          setCurrentUserId(parsed.user_id || parsed._id || parsed.id || '');
        }
      }
    } catch (e) {}

    // Get current user from localStorage
    try {
      const userName = localStorage.getItem('userName');
      const userFirstName = localStorage.getItem('userFirstName');
      const userLastName = localStorage.getItem('userLastName');
      
      // Check for userName first as it's likely the most complete format
      if (userName) {
        setCurrentUser(userName);
        return;
      }
      
      // Check for first and last name combination
      if (userFirstName && userLastName) {
        setCurrentUser(`${userFirstName} ${userLastName}`);
        return;
      }
      if (userFirstName) {
        setCurrentUser(userFirstName);
        return;
      }
      
      // Check for a full user object
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          // Return user info in order of most likely to contain a full name
          if (parsedUser.name) {
            setCurrentUser(parsedUser.name);
            return;
          }
          if (parsedUser.fullName) {
            setCurrentUser(parsedUser.fullName);
            return;
          }
          if (parsedUser.firstName && parsedUser.lastName) {
            setCurrentUser(`${parsedUser.firstName} ${parsedUser.lastName}`);
            return;
          }
          if (parsedUser.firstName) {
            setCurrentUser(parsedUser.firstName);
            return;
          }
          if (parsedUser.username) {
            setCurrentUser(parsedUser.username);
            return;
          }
          if (parsedUser.email) {
            setCurrentUser(parsedUser.email);
            return;
          }
        } catch (parseError) {
        }
      }
      
      setCurrentUser("Current User");
    } catch (error) {
      setCurrentUser("Current User");
    }
  }, []);

  // Call fetchTickets when component mounts or filter/page changes
  useEffect(() => {
    console.log('🚀 Initializing TicketPage component...');
    const hasLoadedPermissions = loadPermissions(); // Synchronous - sets permissions state
    
    // Set a flag to indicate permissions have been loaded
    if (hasLoadedPermissions !== false) {
      setIsInitialLoad(false);
    }
  }, []);

  // Listen for permission changes from other tabs/windows or when permissions are updated
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Check if userPermissions changed
      if (e.key === 'userPermissions' || e.key === null) {
        console.log('🔄 Permissions changed in localStorage, reloading...');
        loadPermissions();
        // Clear cache to force fresh fetch
        setTicketCache({});
      }
    };

    // Listen for storage events (changes from other tabs)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event for same-tab updates
    const handlePermissionUpdate = () => {
      console.log('🔄 Permissions updated (same tab), reloading...');
      loadPermissions();
      setTicketCache({});
    };
    
    window.addEventListener('permissionsUpdated', handlePermissionUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('permissionsUpdated', handlePermissionUpdate);
    };
  }, []);

  // Fetch tickets when permissions change (junior or all)
  useEffect(() => {
    // Skip the initial render - wait for permissions to load first
    if (isInitialLoad) {
      console.log('⏳ Skipping fetch - waiting for permissions to load');
      return;
    }
    
    console.log('📋 Permissions or filter changed, fetching tickets with:', {
      junior: permissions.junior,
      all: permissions.all,
      activeFilter
    });
    
    fetchTickets();
    fetchAllTicketsForCounting();
  }, [permissions.junior, permissions.all, activeFilter, isInitialLoad]); // Trigger when permissions or filter change

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      // Check cache first for instant display
      // Cache key includes both junior and all permissions since both affect what tickets we see
      const cacheKey = `${activeFilter}_${permissions.junior}_${permissions.all}`;
      if (ticketCache[cacheKey] && !isInitialLoad) {
        setTickets(ticketCache[cacheKey]);
        setIsLoading(false);
        // Fetch in background to update cache
        fetchTicketsFromAPI(cacheKey);
        return;
      }
      
      setIsLoading(true);
      await fetchTicketsFromAPI(cacheKey);
    } catch (err) {
      handleFetchError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Separate function for actual API call
  const fetchTicketsFromAPI = async (cacheKey) => {
    setError(null);
    try {
      // Check authentication first
      const userData = localStorage.getItem('userData');
      
      if (!userData) {
        setError("Please log in to view tickets");
        return;
      }
      
      // Parse user data to get user ID
      let parsedUserData;
      try {
        parsedUserData = JSON.parse(userData);
      } catch (parseError) {
        setError("Invalid user session. Please log in again.");
        return;
      }
      
      // Determine status filter based on activeFilter
      const statusFilter = activeFilter === 'open' ? 'open' : 
                           activeFilter === 'closed' ? 'closed' : 
                           activeFilter === 'failed' ? 'failed' : undefined;
      
      // Add permission-based filtering parameters
      const apiParams = statusFilter ? { status: statusFilter } : {};
      
      // Use the permission utility which handles both object and array formats
      const userPermissions = getUserPermissions();
      
      console.log('🔍 userPermissions:', userPermissions);

      // Check ticket permissions using hasPermission (handles both formats correctly)
      const hasJunior = isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'tickets', 'junior');
      const hasAll = isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'tickets', 'all');
      
      console.log('🔍 Direct permission check - junior:', hasJunior, 'all:', hasAll);
      
      // IMPORTANT: Backend requires user_id parameter for identification
      // BUT it handles the actual filtering based on the user's role permissions stored in DB
      // The frontend doesn't need to do any filtering - backend handles everything
      // We just pass the status filter
      
      console.log('🎫 Fetching tickets with apiParams:', apiParams);
      console.log('📝 Note: Backend will filter based on user role permissions (junior/all) automatically');
      
      // Fetch tickets efficiently - just one page with reasonable limit
      const response = await API.tickets.getTickets(
        1,
        100, // Fetch 100 tickets at a time (reasonable for most use cases)
        apiParams
      );
      
      // Validate response structure
      if (!response || !Array.isArray(response.tickets)) {
        throw new Error("Invalid response format from server");
      }
      
      // Process tickets to ensure attachment info is displayed correctly
      const processedTickets = response.tickets.map(ticket => {
        // Ensure attachments is always an array
        if (!ticket.attachments) {
          ticket.attachments = [];
        }
        
        // Normalize status to lowercase for consistency
        if (ticket.status) {
          ticket.status = ticket.status.toLowerCase();
        }
        
        return ticket;
      });
      
      // Update state with the processed tickets
      setTickets(processedTickets);
      
      // Update cache for faster tab switching
      setTicketCache(prev => ({
        ...prev,
        [cacheKey]: processedTickets
      }));
      
      // If we don't have counting data yet, and this is the "all" filter, use this data for counting
      if (allTicketsForCounting.length === 0 && (!activeFilter || activeFilter === 'all')) {
        setAllTicketsForCounting(processedTickets);
      }
      
    } catch (err) {
      throw err; // Re-throw to be handled by fetchTickets
    }
  };

  // Error handler
  const handleFetchError = (err) => {
    let errorMessage = "Failed to load tickets. ";
    if (err.message.includes("User not authenticated")) {
      errorMessage += "Please log in and try again.";
    } else if (err.message.includes("Network error")) {
      errorMessage += "Please check your internet connection.";
    } else if (err.message.includes("fetch")) {
      errorMessage += "Cannot connect to server. Please verify the backend is running.";
    } else {
      errorMessage += "Please try again later.";
    }
    
    setError(errorMessage);
    toast.error(errorMessage);
  };

  // Separate useEffect for filter changes (pagination removed)
  useEffect(() => {
    // Don't fetch if it's the initial load (already done in main useEffect)
    // Don't fetch if we're in the middle of updating a ticket status (prevents race condition)
    if (!isInitialLoad && permissions.show && !isUpdatingTicketStatus) {
      console.log('🔄 Filter changed to:', activeFilter, '- Fetching tickets...');
      // Clear cache for the new filter to force fresh data
      const cacheKey = `${activeFilter}_${permissions.junior}_${permissions.all}`;
      setTicketCache(prev => {
        const newCache = { ...prev };
        delete newCache[cacheKey];
        return newCache;
      });
      
      fetchTickets();
      // Don't refetch counting data on every filter change - only on initial load
    }
  }, [activeFilter, isInitialLoad, permissions.show, permissions.junior, permissions.all, isUpdatingTicketStatus]); // Include permissions.all to refetch when it changes

  useEffect(() => {
    const isSuperAdminUser = isSuperAdmin(getUserPermissions());
    if (assignmentFilter === 'team' && !permissions.junior && !permissions.all && !isSuperAdminUser) {
      setAssignmentFilter('me');
    }
    if (assignmentFilter === 'all' && !permissions.all && !isSuperAdminUser) {
      setAssignmentFilter('me');
    }
  }, [assignmentFilter, permissions.junior, permissions.all]);

  // Load strict subordinate IDs for Team filter (reporting-chain based)
  useEffect(() => {
    if (!currentUserId) return;
    const loadSubordinates = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${currentUserId}/subordinates`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await response.json();
        const ids = Array.isArray(data?.subordinate_ids)
          ? data.subordinate_ids.map((id) => String(id))
          : [];
        setSubordinateUserIds(ids);
      } catch (error) {
        console.warn('Failed to load subordinate IDs for Team filter:', error);
        setSubordinateUserIds([]);
      }
    };
    loadSubordinates();
  }, [currentUserId]);

  // Calculate dynamic counts for OpenTicket, CloseTicket, All from ALL tickets (not filtered by active filter)
  
  // Fetch all tickets for counting purposes (regardless of status filter)
  const fetchAllTicketsForCounting = async (currentPermissions = null) => {
    try {
      const userData = localStorage.getItem('userData');
      if (!userData) {
        setAllTicketsForCounting([]);
        return;
      }
      
      const parsedUserData = JSON.parse(userData);
      
      // Fetch all tickets without status filter for counting
      const apiParams = {};
      
      // Use permission utility which handles both object and array formats
      const userPermissions = getUserPermissions();
      
      // Check ticket permissions using hasPermission (handles both formats correctly)
      const hasJunior = isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'tickets', 'junior');
      const hasAll = isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'tickets', 'all');
      
      // If user doesn't have permission to view others' tickets, add user filter
      // Check both junior and all permissions - either allows viewing all tickets
      if (!hasJunior && !hasAll) {
        apiParams.user_id = parsedUserData.user_id;
        apiParams.created_by_me = true;
      }
      
      console.log('📊 Fetching all tickets for counting with permissions:', { junior: hasJunior, all: hasAll, filtering: !hasJunior && !hasAll });
      
      // Fetch all tickets for counting - optimized to fetch just one page
      const countingResponse = await API.tickets.getTickets(1, 100, apiParams);
      
      if (countingResponse && Array.isArray(countingResponse.tickets)) {
        setAllTicketsForCounting(countingResponse.tickets);
        
        // Force immediate count calculation after setting the state
        const openCount = countingResponse.tickets.filter((t) => t.status === "open").length;
        const closedCount = countingResponse.tickets.filter((t) => t.status === "closed").length;
        const failedCount = countingResponse.tickets.filter((t) => t.status === "failed").length;
        const allCount = countingResponse.tickets.length;
      } else {
        setAllTicketsForCounting([]);
      }
    } catch (error) {
      setAllTicketsForCounting([]);
    }
  };

  // Apply assignment filter to the counting pool first, then derive status counts
  const assignmentFilteredCounting = useMemo(() => {
    const source = allTicketsForCounting.length > 0 ? allTicketsForCounting : tickets;
    if (!source.length) return source;

    const normalizeStr = (val) => String(val || '').toLowerCase().trim();
    const currentUserIdStr = normalizeStr(userIdentity.id);
    const currentUserNameStr = normalizeStr(userIdentity.name);
    const subordinateIdSet = new Set(subordinateUserIds.map((id) => String(id)));

    const isMyTicket = (ticket) => {
      const createdById = normalizeStr(ticket.created_by);
      const createdByName = normalizeStr(ticket.created_by_name);
      const assignedIds = Array.isArray(ticket.assigned_users) ? ticket.assigned_users.map(normalizeStr) : [];
      const assignedNames = Array.isArray(ticket.assigned_users_details)
        ? ticket.assigned_users_details.map((u) => normalizeStr(u?.name))
        : [];
      return (!!currentUserIdStr && (createdById === currentUserIdStr || assignedIds.includes(currentUserIdStr))) ||
             (!!currentUserNameStr && (createdByName === currentUserNameStr || assignedNames.includes(currentUserNameStr)));
    };

    const isTeamTicket = (ticket) => {
      const createdById = String(ticket.created_by || '');
      const assignedIds = Array.isArray(ticket.assigned_users) ? ticket.assigned_users.map((id) => String(id)) : [];
      return subordinateIdSet.has(createdById) || assignedIds.some((id) => subordinateIdSet.has(id));
    };

    if (assignmentFilter === 'me') return source.filter(isMyTicket);
    if (assignmentFilter === 'team') return source.filter(isTeamTicket);
    return source; // 'all'
  }, [allTicketsForCounting, tickets, assignmentFilter, userIdentity, subordinateUserIds]);

  // Memoized filter counts — always respect the active assignment filter
  const filterCounts = useMemo(() => ({
    open: assignmentFilteredCounting.filter((t) => t.status === "open").length,
    closed: assignmentFilteredCounting.filter((t) => t.status === "closed").length,
    failed: assignmentFilteredCounting.filter((t) => t.status === "failed").length,
    all: assignmentFilteredCounting.length,
  }), [assignmentFilteredCounting]);

  // Memoized filters with counts
  const FILTERS_WITH_COUNTS = useMemo(() => [
    { key: "open", label: "Open", count: filterCounts.open },
    { key: "closed", label: "Closed", count: filterCounts.closed },
    { key: "failed", label: "Failed", count: filterCounts.failed },
    { key: "all", label: "All", count: filterCounts.all },
  ], [filterCounts]);

  // Memoized filtered tickets for better search performance
  const filteredTickets = useMemo(() => {
    let baseTickets = tickets;

    const normalize = (val) => String(val || '').toLowerCase().trim();
    const currentUserIdStr = normalize(userIdentity.id);
    const currentUserName = normalize(userIdentity.name);
    const subordinateIdSet = new Set(subordinateUserIds.map((id) => String(id)));

    const isMyTicket = (ticket) => {
      const createdById = normalize(ticket.created_by);
      const createdByName = normalize(ticket.created_by_name);
      const assignedUserIds = Array.isArray(ticket.assigned_users) ? ticket.assigned_users.map(normalize) : [];
      const assignedUserNames = Array.isArray(ticket.assigned_users_details)
        ? ticket.assigned_users_details.map((user) => normalize(user?.name))
        : [];

      const matchesById = !!currentUserIdStr && (
        createdById === currentUserIdStr || assignedUserIds.includes(currentUserIdStr)
      );

      const matchesByName = !!currentUserName && (
        createdByName === currentUserName || assignedUserNames.includes(currentUserName)
      );

      return matchesById || matchesByName;
    };

    const isTeamTicket = (ticket) => {
      const createdById = String(ticket.created_by || '');
      const assignedUserIds = Array.isArray(ticket.assigned_users)
        ? ticket.assigned_users.map((id) => String(id))
        : [];
      return subordinateIdSet.has(createdById) || assignedUserIds.some((id) => subordinateIdSet.has(id));
    };

    // Step 1: Apply assignment filter
    if (assignmentFilter === 'me') {
      baseTickets = baseTickets.filter(isMyTicket);
    } else if (assignmentFilter === 'team') {
      baseTickets = baseTickets.filter(isTeamTicket);
    }
    // 'all' → no assignment filter

    // Step 2: Apply status filter on top of assignment-filtered set
    if (activeFilter === 'open') {
      baseTickets = baseTickets.filter(ticket => ticket.status === 'open');
    } else if (activeFilter === 'closed') {
      baseTickets = baseTickets.filter(ticket => ticket.status === 'closed');
    } else if (activeFilter === 'failed') {
      baseTickets = baseTickets.filter(ticket => ticket.status === 'failed');
    }
    
    // Apply search filtering if there's a search term
    if (!search.trim()) return baseTickets;
    
    const searchLower = search.toLowerCase();
    return baseTickets.filter((ticket) => {
      return (
        (ticket.created_by_name && ticket.created_by_name.toLowerCase().includes(searchLower)) ||
        ticket.subject.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower) ||
        (ticket.assigned_users_details && 
         ticket.assigned_users_details.some(user => 
           user.name && user.name.toLowerCase().includes(searchLower)
         ))
      );
    });
  }, [tickets, search, activeFilter, assignmentFilter, userIdentity, subordinateUserIds]);

  // Handle row click to show EditTicket
  const handleRowClick = useCallback(async (ticket) => {
    try {
      // Prevent duplicate modal opening
      if (preventDuplicateModal || selectedTicket || modalLoading || lastClickedTicketId === ticket.id) {
        return;
      }
      
      setLastClickedTicketId(ticket.id);
      setModalLoading(true);
      setPreventDuplicateModal(true);
      
      // Reset prevention after a short delay to allow proper clicking
      setTimeout(() => {
        setLastClickedTicketId(null);
      }, 1000);
      
      // Add slight delay to prevent rapid clicks
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        // Get the complete ticket data including attachments
        const currentTicketId = ticket._id || ticket.id;
        
        const fullTicket = await API.tickets.getTicketById(currentTicketId);
        
        // Ensure attachments are properly handled
        if (fullTicket) {
          // Make sure attachments is always an array
          if (!fullTicket.attachments) {
            fullTicket.attachments = [];
          }
          
          // Process attachment URLs if needed
          if (fullTicket.attachments && fullTicket.attachments.length > 0) {
            fullTicket.attachments = fullTicket.attachments.map(attachment => {
              // Ensure URL is complete
              if (attachment.url && !attachment.url.startsWith('http')) {
                attachment.url = `${API_BASE_URL}${attachment.url}`;
              }
              return attachment;
            });
          }
          
          setSelectedTicket(fullTicket);
        } else {
          // Fallback to the provided ticket data if API call fails
          // Ensure the fallback ticket has an attachments array
          if (!ticket.attachments) {
            ticket.attachments = [];
          }
          setSelectedTicket(ticket);
        }
      } catch (error) {
        // Fallback to the provided ticket data if API call fails
        if (!ticket.attachments) {
          ticket.attachments = [];
        }
        setSelectedTicket(ticket);
      } finally {
        setModalLoading(false);
        setPreventDuplicateModal(false);
        setLastClickedTicketId(null);
      }
    } catch (error) {
      setModalLoading(false);
      setPreventDuplicateModal(false);
      setLastClickedTicketId(null);
    }
  }, [preventDuplicateModal, selectedTicket, modalLoading, lastClickedTicketId]);

  // Select button handlers
  // Select button and bulk delete functionality
  const handleShowCheckboxes = () => {
    setShowCheckboxes(true);
    setSelectedRows([]);
    setSelectAll(false);
  };

  const handleRowSelect = (ticketId, checked) => {
    setSelectedRows(prev => 
      checked 
        ? [...prev, ticketId] 
        : prev.filter(id => id !== ticketId)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedRows(checked ? filteredTickets.map(ticket => ticket.id || ticket._id) : []);
  };

  const handleCancelSelection = () => {
    setSelectedRows([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} selected ticket(s)?`)) {
      return;
    }

    try {
      console.log(`🗑️ Deleting ${selectedRows.length} tickets...`);
      
      // Delete each selected ticket
      let successCount = 0;
      let failCount = 0;
      
      for (const ticketId of selectedRows) {
        try {
          await API.tickets.deleteTicket(ticketId);
          successCount++;
          console.log(`✅ Deleted ticket: ${ticketId}`);
        } catch (error) {
          failCount++;
          console.error(`❌ Failed to delete ticket: ${ticketId}`, error);
        }
      }
      
      // Show appropriate message
      if (successCount > 0 && failCount === 0) {
        toast.success(`Successfully deleted ${successCount} ticket(s)`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`Deleted ${successCount} ticket(s), failed to delete ${failCount} ticket(s)`);
      } else {
        toast.error(`Failed to delete all ${failCount} ticket(s)`);
      }
      
      // Reset selection state
      handleCancelSelection();
      
      // Refresh the list after deletion
      console.log('🔄 Refreshing ticket list after deletion...');
      await fetchTickets();
      await fetchAllTicketsForCounting(permissions);
      console.log('✅ Ticket list refreshed');
      
    } catch (error) {
      console.error('Error in bulk delete operation:', error);
      toast.error('Error deleting tickets');
    }
  };

  // Helper function to fetch tickets for a specific filter
  const fetchTicketsForFilter = async (statusFilter) => {
    try {
      const userData = localStorage.getItem('userData');
      if (!userData) return;
      
      const parsedUserData = JSON.parse(userData);
      const apiParams = statusFilter ? { status: statusFilter } : {};
      
      // Check both junior and all permissions - either allows viewing all tickets
      if (!permissions.junior && !permissions.all) {
        apiParams.user_id = parsedUserData.user_id;
        apiParams.created_by_me = true;
      }
      
      const response = await API.tickets.getTickets({
        page: pagination.page,
        perPage: pagination.perPage,
        ...apiParams
      });
      
      if (response && response.data) {
        setTickets(response.data);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination.total,
            totalPages: response.pagination.totalPages
          }));
        }
      }
    } catch (error) {
    }
  };

  // Handle save ticket from EditTicket
  const handleSaveTicket = async (updatedTicket) => {
    try {
      // Get ticketId upfront for consistent variable scoping
      const currentTicketId = updatedTicket._id || updatedTicket.id;
      
      // Convert to the format expected by the API
      const ticketData = {
        subject: updatedTicket.subject,
        description: updatedTicket.description || updatedTicket.message,
        priority: updatedTicket.priority || "medium",
        assigned_users: Array.isArray(updatedTicket.assigned_users) 
          ? updatedTicket.assigned_users 
          : [updatedTicket.assign],
        status: updatedTicket.status.toLowerCase()
      };
      
      // Check if status is changing
      const originalTicket = tickets.find(t => (t._id || t.id) === currentTicketId);
      const statusChangedToClosed = ticketData.status === 'closed' && originalTicket?.status === 'open';
      const statusChangedToOpen = ticketData.status === 'open' && (originalTicket?.status === 'closed' || originalTicket?.status === 'failed');
      const statusChangedToFailed = ticketData.status === 'failed' && originalTicket?.status === 'open';
      
      // **SET FLAG TO PREVENT PREMATURE USEEFFECT TRIGGER**
      if (statusChangedToClosed || statusChangedToFailed || statusChangedToOpen) {
        console.log('🔒 Setting isUpdatingTicketStatus flag to prevent premature refresh');
        setIsUpdatingTicketStatus(true);
      }
      
      // **IMMEDIATE UI UPDATES AND TAB SWITCHING**
      console.log('🚀 Starting immediate UI updates for ticket:', currentTicketId);
      
      // 1. Close edit modal IMMEDIATELY
      setSelectedTicket(null);
      console.log('✅ Edit modal closed immediately');
      
      // 2. **MAKE API CALL FIRST** - Wait for it to complete
      try {
        console.log('📡 Making API call to update ticket:', currentTicketId, 'with data:', ticketData);
        await API.tickets.updateTicket(currentTicketId, ticketData);
        console.log('✅ API call completed successfully for ticket:', currentTicketId);
        
      } catch (error) {
        console.error('❌ API call failed:', error);
        toast.error(`Failed to update ticket: ${error.message}`);
        // Release the flag on error
        setIsUpdatingTicketStatus(false);
        return; // Exit early on error
      }
      
      // 3. **NOW DO TAB SWITCHING AND DATA REFRESH** - After API success
      if (statusChangedToClosed && activeFilter === 'open') {
        // Trigger immediate tab switch to closed tickets
        console.log('🔄 Ticket closed: switching to closed tab and refreshing data');
        
        // Clear the cache for the closed filter to force fresh data
        const closedCacheKey = `closed_${permissions.junior}_${permissions.all}`;
        setTicketCache(prev => {
          const newCache = { ...prev };
          delete newCache[closedCacheKey];
          return newCache;
        });
        
        // Switch tab
        setActiveFilter('closed');
        
        // Wait a moment for state to update, then refresh
        setTimeout(async () => {
          console.log('🔄 Fetching fresh closed tickets data...');
          await fetchTickets();
          await fetchAllTicketsForCounting(permissions);
          console.log('✅ Closed tickets refreshed - releasing flag');
          setIsUpdatingTicketStatus(false); // Release the flag
        }, 300);
        
        // Dispatch custom event
        const customEvent = new CustomEvent('ticketStatusChanged', {
          detail: {
            ticketId: currentTicketId,
            newStatus: 'closed',
            oldStatus: 'open',
            suggestedTab: 'closed',
            shouldAutoSwitch: true,
            immediate: true,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(customEvent);
        
      } else if (statusChangedToFailed && activeFilter === 'open') {
        // Trigger immediate tab switch to failed tickets
        console.log('🔄 Ticket failed: switching to failed tab and refreshing data');
        
        // Clear the cache for the failed filter to force fresh data
        const failedCacheKey = `failed_${permissions.junior}_${permissions.all}`;
        setTicketCache(prev => {
          const newCache = { ...prev };
          delete newCache[failedCacheKey];
          return newCache;
        });
        
        // Switch tab
        setActiveFilter('failed');
        
        // Wait a moment for state to update, then refresh
        setTimeout(async () => {
          console.log('🔄 Fetching fresh failed tickets data...');
          await fetchTickets();
          await fetchAllTicketsForCounting(permissions);
          console.log('✅ Failed tickets refreshed - releasing flag');
          setIsUpdatingTicketStatus(false); // Release the flag
        }, 300);
        
        // Success message
        toast.success("Ticket marked as failed! Switched to Failed tab.");
        
        // Dispatch custom event
        const customEvent = new CustomEvent('ticketStatusChanged', {
          detail: {
            ticketId: currentTicketId,
            newStatus: 'failed',
            oldStatus: 'open',
            suggestedTab: 'failed',
            shouldAutoSwitch: true,
            immediate: true,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(customEvent);
        
      } else if (statusChangedToOpen && (activeFilter === 'closed' || activeFilter === 'failed')) {
        // Trigger immediate tab switch to open tickets
        console.log('🔄 Ticket reopened: switching to open tab and refreshing data');
        
        // Clear the cache for the open filter to force fresh data
        const openCacheKey = `open_${permissions.junior}_${permissions.all}`;
        setTicketCache(prev => {
          const newCache = { ...prev };
          delete newCache[openCacheKey];
          return newCache;
        });
        
        // Switch tab
        setActiveFilter('open');
        
        // Wait a moment for state to update, then refresh
        setTimeout(async () => {
          console.log('🔄 Fetching fresh open tickets data...');
          await fetchTickets();
          await fetchAllTicketsForCounting(permissions);
          console.log('✅ Open tickets refreshed - releasing flag');
          setIsUpdatingTicketStatus(false); // Release the flag
        }, 300);
        
        // Dispatch custom event
        const customEvent = new CustomEvent('ticketStatusChanged', {
          detail: {
            ticketId: currentTicketId,
            newStatus: 'open',
            oldStatus: originalTicket?.status || 'closed',
            suggestedTab: 'open',
            shouldAutoSwitch: true,
            immediate: true,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(customEvent);
        
      } else {
        // No status change or different scenario - just refresh normally
        console.log('🔄 Ticket updated without status change - refreshing data');
        await fetchTickets();
        await fetchAllTicketsForCounting(permissions);
        toast.success("Ticket updated successfully");
        setIsUpdatingTicketStatus(false); // Release the flag
      }
        
      // Handle file attachments if needed
        if (updatedTicket.newAttachments && updatedTicket.newAttachments.length > 0) {
          try {
            
            // Extract actual File objects from newAttachments
            const filesToUpload = updatedTicket.newAttachments
              .filter(attachment => attachment.file)
              .map(attachment => attachment.file);
            
            
            if (filesToUpload.length > 0) {
              
              // Use the new API function to upload attachments
              const attachmentResult = await API.tickets.uploadAttachments(
                currentTicketId, 
                filesToUpload
              );
              toast.success("Attachments uploaded successfully");
            } else {
            }
          } catch (attachmentError) {
            toast.error(`Failed to upload attachments: ${attachmentError.message}`);
          }
        } else {
        }
        
        // Handle attachments to remove if needed
        if (updatedTicket.attachmentsToRemove && updatedTicket.attachmentsToRemove.length > 0) {
          try {
            // We would need an API endpoint to delete attachments
            // This is just a placeholder for when that endpoint exists
            // for (const attachmentId of updatedTicket.attachmentsToRemove) {
            //   await API.tickets.deleteAttachment(currentTicketId, attachmentId);
            // }
          } catch (removeError) {
          }
        }
        
        // Refresh counting data
        fetchAllTicketsForCounting(permissions);
        
    } catch (error) {
      console.error('Error in handleSaveTicket:', error);
      toast.error("Failed to save ticket changes");
      setSelectedTicket(null);
      setIsUpdatingTicketStatus(false); // Release the flag on error
    }
  };

  // Handle cancel from EditTicket
  const handleCancelEdit = useCallback(() => {
    setSelectedTicket(null);
    setModalLoading(false);
    setPreventDuplicateModal(false);
    setLastClickedTicketId(null); // Reset clicked ticket
    console.log('✅ Edit modal cancelled and state reset');
  }, []);

  // Create Ticket Modal controls
  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);
  
  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setModalLoading(false);
    setPreventDuplicateModal(false);
    setLastClickedTicketId(null); // Reset any ticket selection state
    console.log('✅ Create modal closed and state reset');
  }, []);

  // Create new ticket from the CreateTicket component
  const handleCreateTicket = async (newTicket) => {
    try {
      
      // Convert to the format expected by the API
      const ticketData = {
        subject: newTicket.subject,
        description: newTicket.details || newTicket.message,
        priority: newTicket.priority || "medium",
        assigned_users: Array.isArray(newTicket.assignedUserIds) && newTicket.assignedUserIds.length > 0
          ? newTicket.assignedUserIds 
          : (Array.isArray(newTicket.assignedTo) 
              ? newTicket.assignedTo 
              : [newTicket.assign])
      };
      
      
      // First create the ticket
      const createdTicket = await API.tickets.createTicket(ticketData);
      
      // If there are files to upload, handle them
      if (newTicket.files && newTicket.files.length > 0) {
        try {
          // Use the new API function to upload attachments
          const attachmentResult = await API.tickets.uploadAttachments(createdTicket._id, newTicket.files);
        } catch (attachmentError) {
          // attachment upload failed silently
        }
      }
      
      // Refresh tickets list to show the new ticket with attachments
      fetchTickets();
      fetchAllTicketsForCounting(permissions); // Also refresh the counting data
      setShowCreateModal(false);
      // Trigger immediate popup for assigned users (same mechanism as tasks & announcements)
      window.dispatchEvent(new CustomEvent('ticket-created'));
      try {
        localStorage.setItem('globalTaskTrigger', JSON.stringify({ timestamp: Date.now(), actionType: 'ticket-created' }));
      } catch (_) {}
      try {
        const bc = new BroadcastChannel('rupiyame_task_events');
        bc.postMessage('ticket-created');
        bc.close();
      } catch (_) {}
    } catch (err) {
      toast.error("Failed to create ticket");
    }
  };

  // Delete ticket handler
  const handleDeleteTicket = async (ticketId) => {
    try {
      await API.tickets.deleteTicket(ticketId);
      toast.success("Ticket deleted successfully");
      
      // Refresh tickets list
      fetchTickets();
      fetchAllTicketsForCounting(permissions);
    } catch (error) {
      console.error("Failed to delete ticket:", error);
      throw error; // Re-throw to let DeleteButton handle the error display
    }
  };

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    fetchTickets();
    fetchAllTicketsForCounting(permissions);
  }, [fetchTickets, fetchAllTicketsForCounting, permissions]);

  // Search and filter handlers
  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleFilterChange = useCallback((filterKey) => {
    setActiveFilter(filterKey);
  }, []);

  const getTicketStatusBadge = (status) => {
    const s = (status || 'open').toLowerCase();
    if (s === 'closed') return { cls: 'task-status-badge task-sts-complete', label: 'Closed' };
    if (s === 'failed') return { cls: 'task-status-badge task-sts-failed', label: 'Failed' };
    return { cls: 'task-status-badge task-sts-pending', label: 'Open' };
  };

  const isAllFilter = activeFilter === 'all';
  const canDeleteTickets = permissions.delete || isSuperAdmin(getUserPermissions());
  const canViewTeam = permissions.junior || permissions.all || isSuperAdmin(getUserPermissions());
  const canViewAll = permissions.all || isSuperAdmin(getUserPermissions());

  return (
    <>
      <style>{ticketPageStyles}</style>
      <div className="task-page-container">
        <div className="task-top-bar">
          <div className="task-top-bar-left">
            <h1>Tickets</h1>
            <p>{filteredTickets.length} record{filteredTickets.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="task-top-bar-right">
            {canDeleteTickets && !showCheckboxes && (
              <button className="task-btn-secondary" onClick={handleShowCheckboxes}>Select</button>
            )}
            {showCheckboxes && (
              <div className="task-select-controls">
                <label>
                  <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#3b82f6' }} />
                  Select All
                </label>
                <span>{selectedRows.length} selected</span>
                <button className="task-select-btn-del" onClick={handleDeleteSelected} disabled={selectedRows.length === 0}>Delete ({selectedRows.length})</button>
                <button className="task-select-btn-cancel" onClick={handleCancelSelection}>Cancel</button>
              </div>
            )}
            <button className="task-btn-create" onClick={openCreateModal}>
              <Plus size={15} />
              Create ticket
            </button>
          </div>
        </div>

        <div className="task-view-toggle-bar">
          <div className="task-view-toggle-group">
            {FILTERS_WITH_COUNTS.map((f) => (
              <button
                key={f.key}
                className={`task-view-toggle-btn${activeFilter === f.key ? ' active' : ''}`}
                onClick={() => handleFilterChange(f.key)}
              >
                {f.label}
                {f.count > 0 && <span style={{ marginLeft: 5, fontSize: 11, color: activeFilter === f.key ? '#f97316' : '#6b7a99' }}>{f.count}</span>}
              </button>
            ))}
          </div>
          <div className="task-toolbar-right">
            <div className="task-search-box--in-bar">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                placeholder="Search subject, details, assign..."
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <select
              className="task-filter-dropdown task-filter-dropdown-assign"
              value={
                (assignmentFilter === 'all' && !canViewAll)
                || (assignmentFilter === 'team' && !canViewTeam)
                  ? 'me'
                  : assignmentFilter
              }
              onChange={(e) => setAssignmentFilter(e.target.value)}
            >
              <option value="me">My Tickets</option>
              {canViewTeam && <option value="team">Team Tickets</option>}
              {canViewAll && <option value="all">All Tickets</option>}
            </select>
          </div>
        </div>

        {error && (
          <div className="task-error-banner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ flex: 1, margin: 0, fontSize: 13 }}>{error}</p>
              <button onClick={handleRefresh} style={{ background: '#f87171', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>Retry</button>
            </div>
          </div>
        )}

        {isLoading && tickets.length === 0 && (
          <div className="task-loading-spinner">
            <div className="spinner" />
            <p style={{ color: '#60a5fa', fontSize: 16, fontWeight: 700 }}>Loading tickets...</p>
          </div>
        )}

        {(!isLoading || tickets.length > 0) && (
          <div>
            <div className="task-data-table-header">
              {showCheckboxes && canDeleteTickets && (
                <div className="task-th" style={{ flex: '0 0 36px' }}>
                  <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
                </div>
              )}
              <div className="task-th number">#</div>
              <div className="task-th created">DATE & TIME</div>
              <div className="task-th created">CREATED BY</div>
              <div className="task-th subject">SUBJECT</div>
              <div className="task-th record">TICKET DETAILS</div>
              <div className="task-th assigned">ASSIGN</div>
              {isAllFilter && <div className="task-th status">STATUS</div>}
            </div>

            <div className="task-data-table-body">
              {filteredTickets.length === 0 ? (
                <div className="task-empty-state">
                  <p className="task-empty-state-title">{isLoading ? 'Loading tickets…' : 'No tickets found.'}</p>
                  {!isLoading && (
                    <p className="task-empty-state-sub">
                      {tickets.length === 0 ? "Create your first ticket using the 'Create ticket' button." : 'Try changing filters or search.'}
                    </p>
                  )}
                </div>
              ) : (
                filteredTickets.map((ticket, index) => {
                  const statusBadge = getTicketStatusBadge(ticket.status);
                  const detailsLines = breakMessage(ticket.description, 41);
                  const detailsPreview = detailsLines.slice(0, 2).join(' ');
                  const detailsText = detailsLines.length > 2 ? `${detailsPreview}...` : detailsPreview;

                  return (
                    <div
                      key={ticket._id || ticket.id}
                      className={`task-row${preventDuplicateModal || modalLoading || lastClickedTicketId === ticket.id ? ' opacity-50 cursor-not-allowed' : ''}`}
                      onClick={(e) => {
                        if (showCheckboxes && e.target.type === 'checkbox') return;
                        handleRowClick(ticket);
                      }}
                    >
                      {showCheckboxes && canDeleteTickets && (
                        <div className="task-td" style={{ flex: '0 0 36px' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(ticket.id || ticket._id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleRowSelect(ticket.id || ticket._id, e.target.checked);
                            }}
                            style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                          />
                        </div>
                      )}
                      <div className="task-td number">{index + 1}</div>
                      <div className="task-td created">
                        <div className="task-created-meta-col">
                          <span className="task-created-meta-name">{ticket.created_at ? formatDateTime(ticket.created_at) : 'N/A'}</span>
                        </div>
                      </div>
                      <div className="task-td created">
                        <div className="task-created-meta-col">
                          <span className="task-created-meta-name">{ticket.created_by_name || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="task-td subject">{ticket.subject}</div>
                      <div className="task-td record">{detailsText}</div>
                      <div className="task-td assigned">
                        {ticket.assigned_users_details && ticket.assigned_users_details.length > 0
                          ? ticket.assigned_users_details.map((user) => user.name).join(', ')
                          : 'Unassigned'}
                      </div>
                      {isAllFilter && (
                        <div className="task-td status">
                          <span className={statusBadge.cls}>{statusBadge.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="task-modal-overlay">
          <EditTicket
            ticket={selectedTicket}
            onSave={handleSaveTicket}
            onClose={handleCancelEdit}
          />
        </div>
      )}

      {showCreateModal && (
        <Suspense fallback={
          <div className="task-modal-overlay">
            <div className="task-loading-spinner"><div className="spinner" /></div>
          </div>
        }>
          <CreateTicket
            onClose={closeCreateModal}
            onSubmit={handleCreateTicket}
          />
        </Suspense>
      )}
    </>
  );
}
