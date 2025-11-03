import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import {
  TicketIcon, Plus, Search, CheckSquare, X, Trash2
} from 'lucide-react';
import API from "../services/api";
import { toast } from "react-toastify";
import { formatDateTime } from '../utils/dateUtils';
import { getUserPermissions, hasPermission, isSuperAdmin } from '../utils/permissions';

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

// Loading skeleton component for instant UI feedback
const TicketSkeleton = () => (
  <tr className="border-b-[3px] border-white">
    <td className="py-3 px-3">
      <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
    </td>
    <td className="py-3 px-3">
      <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
    </td>
    <td className="py-3 px-3">
      <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
    </td>
    <td className="py-3 px-3">
      <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
    </td>
    <td className="py-3 px-3">
      <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
    </td>
    <td className="py-3 px-3">
      <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
    </td>
  </tr>
);

// Main component with optimizations
export default function TicketPage() {
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
      // z-index: 10;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .sticky-th {
      position: sticky;
      top: 0;
      background: white;
      // z-index: 10;
      border-bottom: 2px solid #e5e7eb;
    }
  `;

  // State management - grouped for better performance
  const [tickets, setTickets] = useState([]);
  const [allTicketsForCounting, setAllTicketsForCounting] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Start with false for faster initial render
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("open");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  
  // Modal loading and duplicate prevention states
  const [modalLoading, setModalLoading] = useState(false);
  const [preventDuplicateModal, setPreventDuplicateModal] = useState(false);
  const [lastClickedTicketId, setLastClickedTicketId] = useState(null); // Track last clicked ticket
  
  // Cache for faster tab switching
  const [ticketCache, setTicketCache] = useState({});
  
  // Flag to prevent useEffect from triggering during status change
  const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState(false);
  
  // Removed pagination state as we now show all tickets at once

  // Permission management
  const [permissions, setPermissions] = useState({
    show: true,
    own: true,
    junior: false,
    delete: false // Reset to false - will be set by API or wildcard permissions
  });

  // Select button states
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // Check for wildcard permissions
  const hasWildcardPermission = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { userPermissions } = JSON.parse(userData);
      return userPermissions === '*' || 
             (userPermissions && userPermissions.pages === '*') ||
             (userPermissions && userPermissions.includes && userPermissions.includes('*'));
    }
    return false;
  };

  // Get current user ID
  const getCurrentUserId = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return null;
  };

  // Load permissions
  const loadPermissions = async () => {
    try {
      const userId = getCurrentUserId();
      
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await API.get(`/tickets/permissions?${queryParams}`);
      let perms = response.data.permissions || {
        show: true,
        own: true,
        junior: false,
        delete: false // Add delete permission default
      };
      
      // If user has wildcard permissions, grant all ticket permissions
      if (hasWildcardPermission()) {
        perms = {
          show: true,
          own: true,
          junior: true,
          delete: true // Grant delete permission for wildcard users
        };
      } else {
        // Add delete permission based on API response or junior permission
        perms.delete = perms.delete || perms.junior || false;
      }
      
      setPermissions(perms);
    } catch (error) {
      // Set default permissions on error
      const defaultPerms = {
        show: true,
        own: true,
        junior: false,
        delete: false // Reset to false for proper permission handling
      };
      setPermissions(defaultPerms);
    }
  };

  useEffect(() => {
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
    const initializeComponent = async () => {
      await loadPermissions();
      // After permissions are loaded, fetch tickets and counts immediately
      fetchTickets();
      fetchAllTicketsForCounting(permissions);
      setIsInitialLoad(false); // Mark initial load as complete
    };
    initializeComponent();
  }, []);

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      // Check cache first for instant display
      const cacheKey = `${activeFilter}_${permissions.junior}`;
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
      
      // If user doesn't have permission to view others' tickets, add user filter
      if (!permissions.junior) {
        apiParams.user_id = parsedUserData.user_id;
        apiParams.created_by_me = true;
      }
      
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

  // Call fetchTickets when component mounts or filter/page changes
  useEffect(() => {
    const initializeComponent = async () => {
      await loadPermissions();
      // After permissions are loaded, fetch tickets and counts
      setTimeout(() => {
        fetchTickets();
        fetchAllTicketsForCounting(permissions);
        setIsInitialLoad(false); // Mark initial load as complete
      }, 100); // Small delay to ensure permissions are set
    };
    initializeComponent();
  }, []);

  // Separate useEffect for filter changes (pagination removed)
  useEffect(() => {
    // Don't fetch if it's the initial load (already done in main useEffect)
    // Don't fetch if we're in the middle of updating a ticket status (prevents race condition)
    if (!isInitialLoad && permissions.show && !isUpdatingTicketStatus) {
      console.log('🔄 Filter changed to:', activeFilter, '- Fetching tickets...');
      // Clear cache for the new filter to force fresh data
      const cacheKey = `${activeFilter}_${permissions.junior}`;
      setTicketCache(prev => {
        const newCache = { ...prev };
        delete newCache[cacheKey];
        return newCache;
      });
      
      fetchTickets();
      // Don't refetch counting data on every filter change - only on initial load
    }
  }, [activeFilter, isInitialLoad, permissions.show, permissions.junior, isUpdatingTicketStatus]); // Added isUpdatingTicketStatus

  // Calculate dynamic counts for OpenTicket, CloseTicket, All from ALL tickets (not filtered by active filter)
  
  // Fetch all tickets for counting purposes (regardless of status filter)
  const fetchAllTicketsForCounting = async (currentPermissions = null) => {
    try {
      const userData = localStorage.getItem('userData');
      if (!userData) {
        setAllTicketsForCounting([]);
        return;
      }

      // Use current permissions or the state permissions
      const permsToUse = currentPermissions || permissions;
      
      const parsedUserData = JSON.parse(userData);
      
      // Fetch all tickets without status filter for counting
      const apiParams = {};
      
      // If user doesn't have permission to view others' tickets, add user filter
      if (!permsToUse.junior) {
        apiParams.user_id = parsedUserData.user_id;
        apiParams.created_by_me = true;
      } else {
      }
      
      
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

  // Calculate counts from all tickets (not just the currently filtered ones)
  const openCount = allTicketsForCounting.filter((t) => t.status === "open").length;
  const closedCount = allTicketsForCounting.filter((t) => t.status === "closed").length;
  const failedCount = allTicketsForCounting.filter((t) => t.status === "failed").length;
  const allCount = allTicketsForCounting.length;

  // Also try to get a simple count from the regular tickets array as fallback
  const fallbackOpenCount = tickets.filter((t) => t.status === "open").length;
  const fallbackClosedCount = tickets.filter((t) => t.status === "closed").length;
  const fallbackFailedCount = tickets.filter((t) => t.status === "failed").length;
  const fallbackAllCount = tickets.length;

  // Use the counting tickets if available, otherwise use fallback from regular tickets
  const displayOpenCount = allTicketsForCounting.length > 0 ? openCount : fallbackOpenCount;
  const displayClosedCount = allTicketsForCounting.length > 0 ? closedCount : fallbackClosedCount;
  const displayFailedCount = allTicketsForCounting.length > 0 ? failedCount : fallbackFailedCount;
  const displayAllCount = allTicketsForCounting.length > 0 ? allCount : fallbackAllCount;

  // For initial load, if both arrays are empty, try to use a basic count from tickets array
  const finalOpenCount = displayOpenCount > 0 ? displayOpenCount : fallbackOpenCount;
  const finalClosedCount = displayClosedCount > 0 ? displayClosedCount : fallbackClosedCount;
  const finalFailedCount = displayFailedCount > 0 ? displayFailedCount : fallbackFailedCount;
  const finalAllCount = displayAllCount > 0 ? displayAllCount : fallbackAllCount;

  useEffect(() => {
    if (allTicketsForCounting.length > 0) {
    }
  }, [allTicketsForCounting, tickets, finalOpenCount, finalClosedCount, finalFailedCount, finalAllCount]);

  // Memoized filter counts for better performance
  const filterCounts = useMemo(() => {
    return {
      open: finalOpenCount,
      closed: finalClosedCount,
      failed: finalFailedCount,
      all: finalAllCount
    };
  }, [finalOpenCount, finalClosedCount, finalFailedCount, finalAllCount]);

  // Memoized filters with counts
  const FILTERS_WITH_COUNTS = useMemo(() => [
    { key: "open", label: "OpenTicket", count: filterCounts.open },
    { key: "closed", label: "CloseTicket", count: filterCounts.closed },
    { key: "failed", label: "Failed", count: filterCounts.failed },
    { key: "all", label: "All", count: filterCounts.all },
  ], [filterCounts]);

  // Memoized filtered tickets for better search performance
  const filteredTickets = useMemo(() => {
    let baseTickets = tickets;
    
    // Apply status filtering as a safety check (server should already do this, but ensure consistency)
    if (activeFilter === 'open') {
      baseTickets = tickets.filter(ticket => ticket.status === 'open');
    } else if (activeFilter === 'closed') {
      baseTickets = tickets.filter(ticket => ticket.status === 'closed');
    } else if (activeFilter === 'failed') {
      baseTickets = tickets.filter(ticket => ticket.status === 'failed');
    }
    // For 'all' filter, use all tickets
    
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
  }, [tickets, search, activeFilter]);

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
      
      if (!permissions.junior) {
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
        const closedCacheKey = `closed_${permissions.junior}`;
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
        
        // Success message
        toast.success("Ticket closed successfully! Switched to Closed Tickets tab.");
        
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
        const failedCacheKey = `failed_${permissions.junior}`;
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
        const openCacheKey = `open_${permissions.junior}`;
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
        
        // Success message
        toast.success("Ticket reopened successfully! Switched to Open Tickets tab.");
        
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
          toast.success(`Ticket created with ${newTicket.files.length} attachment(s)`);
        } catch (attachmentError) {
          toast.warning("Ticket created but attachments could not be uploaded");
        }
      } else {
        toast.success("Ticket created successfully");
      }
      
      // Refresh tickets list to show the new ticket with attachments
      fetchTickets();
      fetchAllTicketsForCounting(permissions); // Also refresh the counting data
      setShowCreateModal(false);
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

  return (
    <>
      <style>{stickyHeaderStyles}</style>
      <div
        className="min-h-screen bg-black text-white font-sans pb-4 p-4"
        style={{ zoom: 0.97, MozTransform: "scale(0.97)" }}
      >
      {/* Top bar */}
      <div className="flex justify-between items-center px-8 pt-8">
        <div className="flex items-center gap-3">
          {/* Select Button - Positioned on the left side */}
          {(permissions.delete || isSuperAdmin(getUserPermissions())) && (
            <div className="flex items-center gap-3">
              {!showCheckboxes ? (
                <button
                  className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                  onClick={handleShowCheckboxes}
                >
                  {selectedRows.length > 0 ? `Select (${selectedRows.length})` : "Select"}
                </button>
              ) : (
                <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                  <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                    <input
                      type="checkbox"
                      className="accent-blue-500 mr-2"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    Select All
                  </label>
                  <span className="text-white font-semibold">
                    {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                  </span>
                  <button
                    className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                    onClick={handleDeleteSelected}
                    disabled={selectedRows.length === 0}
                  >
                    Delete ({selectedRows.length})
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                    onClick={handleCancelSelection}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Create Ticket Button - Positioned on the right side */}
          <button
            className="bg-[#00C5FA] hover:bg-[#00a9d4] text-white text-base font-bold px-6 py-2 rounded-lg shadow focus:outline-none transition"
            onClick={openCreateModal}
          >
            Create Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-7 mt-4 mb-6">
        {FILTERS_WITH_COUNTS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base shadow transition-all duration-200 ${activeFilter === f.key
                ? "bg-[#00C5FA] text-white shadow-lg"
                : "bg-white text-[#00C5FA] hover:bg-blue-50"
              }
            `}
            style={{
              minWidth: 144,
              justifyContent: "center",
              fontSize: "1.18rem",
            }}
          >
            {f.label}
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                f.count > 0 ? "bg-[#222] text-white" : "bg-[#eee] text-[#00C5FA]"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <input
            className="rounded-full px-4 py-2 border-2 border-[#00C5FA] bg-[#232a36] text-[#eee] font-medium focus:outline-none text-base shadow"
            style={{ minWidth: 258, maxWidth: 268 }}
            placeholder="Search by created by, subject, assign, message..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto px-2 sticky-table-container">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="bg-[#181e29] rounded-xl shadow p-5 text-center font-bold text-[#00C5FA]">
              Loading tickets...
            </div>
          </div>
        ) : error ? (
          <div className="flex justify-center py-8">
            <div className="bg-[#181e29] rounded-xl shadow p-5 text-center font-bold text-red-500">
              {error}
            </div>
          </div>
        ) : (
          <table className="min-w-[616px] w-full rounded-xl overflow-hidden">
            <thead className="sticky-header">
              <tr className="bg-white text-[#00C5FA]">
                {(permissions.delete || isSuperAdmin(getUserPermissions())) && showCheckboxes && (
                  <th className="py-1 px-3 text-left text-lg font-extrabold sticky-th">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="py-1 px-4 text-left text-lg font-extrabold sticky-th">#</th>
                <th className="py-1 px-3 text-left text-lg font-extrabold sticky-th">DATE & TIME</th>
                <th className="py-1 px-3 text-left text-lg font-extrabold sticky-th">CREATED BY</th>
                <th className="py-1 px-3 text-left text-lg font-extrabold sticky-th">SUBJECT</th>
                <th className="py-1 px-3 text-left text-lg font-extrabold sticky-th">TICKET DETAILS</th>
                <th className="py-1 px-3 text-left text-lg font-extrabold sticky-th">ASSIGN</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={(permissions.delete || isSuperAdmin(getUserPermissions())) && showCheckboxes ? 7 : 6}
                    className="bg-[#181e29] rounded-xl shadow p-5 text-center font-bold text-[#00C5FA]"
                  >
                    {isLoading ? (
                      "Loading tickets..."
                    ) : tickets.length === 0 ? (
                      <div>
                        <div className="mb-2">No tickets available.</div>
                        <div className="text-sm text-gray-400">
                          {error ? "There was an error loading tickets." : "Create your first ticket using the 'Create Ticket' button above."}
                        </div>
                      </div>
                    ) : (
                      `No tickets match your current filter "${activeFilter}" or search criteria.`
                    )}
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket, index) => (
                  <tr
                    key={ticket._id}
                    className={`border-b border-gray-800 hover:bg-[#1a222e] transition align-top cursor-pointer ${
                      preventDuplicateModal || modalLoading || lastClickedTicketId === ticket.id 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                    onClick={(e) => {
                      // Don't open popup if clicking on checkbox or in selection mode
                      if (showCheckboxes && e.target.type === 'checkbox') {
                        return;
                      }
                      handleRowClick(ticket);
                    }}
                  >
                    {(permissions.delete || isSuperAdmin(getUserPermissions())) && showCheckboxes && (
                      <td 
                        className="py-3 px-3 text-md text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(ticket.id || ticket._id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleRowSelect(ticket.id || ticket._id, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="py-3 text-md font-bold px-3 text-left">{index + 1}</td>
                    <td className="py-3 px-3 text-md font-bold text-left">
                      {ticket.created_at ? formatDateTime(ticket.created_at) : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-md font-bold text-left">{ticket.created_by_name || "Unknown"}</td>
                    <td className="py-3 px-3 text-md font-extrabold text-left">{ticket.subject}</td>
                    <td className="py-3 px-3 text-md font-bold whitespace-pre-line text-left">
                      {(() => {
                        const lines = breakMessage(ticket.description, 41);
                        const maxLines = 2;
                        if (lines.length <= maxLines) {
                          return lines.map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ));
                        } else {
                          return [
                            ...lines.slice(0, maxLines - 1).map((line, idx) => (
                              <div key={idx}>{line}</div>
                            )),
                            <div key="ellipsis">{lines[maxLines - 1]}...</div>
                          ];
                        }
                      })()}
                    </td>
                    <td className="py-3 px-3 text-base font-bold text-left">
                      {ticket.assigned_users_details && ticket.assigned_users_details.length > 0 
                        ? ticket.assigned_users_details.map(user => user.name).join(", ")
                        : "Unassigned"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination removed - showing all tickets at once */}

      {/* Render EditTicket when a ticket is selected */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[1000] flex items-center bg-transparent justify-center" style={{ backdropFilter: "blur(3px)" }}>
          <div className="w-full max-w-xl mx-auto">
            <EditTicket
              ticket={selectedTicket}
              onSave={handleSaveTicket}
              onClose={handleCancelEdit}
            />
          </div>
        </div>
      )}

      {/* Modal Popup for CreateTicket */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent bg-opacity-40 backdrop-blur-sm">
          <div className="w-full min-w-md mx-auto">
            <CreateTicket
              onClose={closeCreateModal}
              onSubmit={handleCreateTicket}
            />
          </div>
        </div>
      )}
    </div>
    </>
  );
}
