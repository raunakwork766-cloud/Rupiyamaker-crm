import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback, useRef } from "react";
import {
  CheckSquare, Plus, Search, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getUserPermissions, hasPermission, isSuperAdmin } from '../utils/permissions';
import { formatDate as formatDateUtil, formatDateTime } from '../utils/dateUtils';

// Lazy load heavy components for faster initial loading
const CreateTask = lazy(() => import("./CreateTask"));
const EditTask = lazy(() => import("./EditTask"));

// Pre-warm components for instant loading (optional optimization)
const preWarmComponents = () => {
  // Pre-load components when page loads to make them instantly available
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const createTaskPromise = import("./CreateTask");
      const editTaskPromise = import("./EditTask");
      
      // Cache promises for instant access
      window.__componentCache = {
        createTask: createTaskPromise,
        editTask: editTaskPromise
      };
    }, 1000); // Pre-load after 1 second of initial page load
  }
};

// Preload components on hover for instant opening
const preloadComponents = () => {
  CreateTask.preload?.();
  EditTask.preload?.();
};

// Enhanced lazy loading with immediate preload capability
const LazyCreateTask = lazy(() => 
  import("./CreateTask").then(module => {
    // Cache the component for immediate access
    LazyCreateTask._component = module.default;
    return module;
  })
);

const LazyEditTask = lazy(() => 
  import("./EditTask").then(module => {
    // Cache the component for immediate access  
    LazyEditTask._component = module.default;
    return module;
  })
);

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

// Helper function for API calls with proper headers
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  // Check if the body is FormData to handle file uploads correctly
  const isFormData = options.body instanceof FormData;
  
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      // Only set Content-Type for non-FormData requests
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      // The following headers help with CORS issues
      'Accept': 'application/json',
      'Origin': window.location.origin
    },
    // Don't use credentials: 'include' when the API uses wildcard CORS
    // credentials: 'include' // This was causing the CORS error
  };

  // Merge default options with provided options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  try {
    // Add retry logic with exponential backoff
    let retries = 3;
    let delay = 500; // Start with 500ms delay
    let lastError = null;

    while (retries > 0) {
      try {
        const response = await fetch(url, mergedOptions);

        if (!response.ok) {
          // For 422 errors, try to get the validation error details
          if (response.status === 422) {
            try {
              const errorData = await response.clone().json();
              console.error('🔴 422 Validation Error Details:');
              console.error(JSON.stringify(errorData, null, 2));
              console.error('Full error object:', errorData);
            } catch (e) {
              const errorText = await response.clone().text();
              console.error('🔴 422 Error Response (text):', errorText);
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError = error;
        retries--;

        if (retries > 0) {
          // Wait for the specified delay before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          // Exponential backoff - double the delay for the next attempt
          delay *= 2;
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  } catch (error) {
    throw error;
  }
};

// All possible statuses for update - mapping to backend enum values
const STATUS_OPTIONS = [
  "Pending",
  "In Progress",
  "Completed",
  "Failed",
  "Cancelled",
];

// Task type options - mapping to backend enum values
const TASK_TYPE_OPTIONS = [
  "To-Do",
  "Call",
  "Pendency",
  "Processing",
  "Completed"
];

// Task priority options
const PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Urgent"
];

// Helper function for status display in table - Memoized component
const StatusPill = React.memo(({ status }) => {
  switch (status) {
    case "Completed":
      return (
        <span className="bg-green-900 text-green-300 px-3 py-1 rounded-full text-xs font-bold">
          Completed
        </span>
      );
    case "Failed":
    case "FAILED":
      return (
        <span className="bg-orange-900 text-orange-300 px-3 py-1 rounded-full text-xs font-bold">
          Failed
        </span>
      );
    case "Cancelled":
      return (
        <span className="bg-red-900 text-red-300 px-3 py-1 rounded-full text-xs font-bold">
          Cancelled
        </span>
      );
    case "Pending":
      return (
        <span className="bg-blue-900 text-blue-300 px-3 py-1 rounded-full text-xs font-bold">
          Pending
        </span>
      );
    case "In Progress":
      return (
        <span className="bg-yellow-900 text-yellow-300 px-3 py-1 rounded-full text-xs font-bold">
          In Progress
        </span>
      );
    default:
      return (
        <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-bold">
          {status}
        </span>
      );
  }
});
StatusPill.displayName = 'StatusPill';

// Legacy function for backward compatibility
function statusPill(status) {
  return <StatusPill status={status} />;
}

// Helper to truncate message for table
function truncate(str, length = 30) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
}

// Helper to format date for display
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    return formatDateUtil(dateString);
  } catch (error) {
    return dateString; // Return original if parsing fails
  }
}

// Helper to format time for display  
function formatTime(timeString) {
  if (!timeString) return "N/A";
  try {
    // Handle both "HH:MM:SS" and "HH:MM" formats
    const timeParts = timeString.split(':');
    if (timeParts.length >= 2) {
      let hours = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return timeString;
  } catch (error) {
    return timeString; // Return original if parsing fails
  }
}

const initialTaskForm = {
  subject: "",
  message: "",
  typeTask: TASK_TYPE_OPTIONS[0],
  leadLogin: "",
  customerName: "",
  date: "",
  time: "",
  assign: "",
  createdBy: "",
  status: STATUS_OPTIONS[0],
};

export default function Task({ onTaskStatusChange, onTaskUpdate } = {}) {
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

  // PERFORMANCE: Cache keys for localStorage
  const CACHE_KEYS = {
    TASKS: 'tasks_cache_v1',
    STATS: 'stats_cache_v1',
    TIMESTAMP: 'tasks_cache_timestamp'
  };
  
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache validity

  // OPTIMIZATION: Load cached data immediately for instant display
  const getCachedData = () => {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
      const now = Date.now();
      
      // Check if cache is still valid
      if (timestamp && (now - parseInt(timestamp)) < CACHE_DURATION) {
        const cachedTasks = localStorage.getItem(CACHE_KEYS.TASKS);
        const cachedStats = localStorage.getItem(CACHE_KEYS.STATS);
        
        if (cachedTasks && cachedStats) {
          return {
            tasks: JSON.parse(cachedTasks),
            stats: JSON.parse(cachedStats)
          };
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    return null;
  };

  // State management with optimistic loading from cache
  const cachedData = getCachedData();
  const [tasks, setTasks] = useState(cachedData?.tasks || []);
  const [taskStats, setTaskStats] = useState(cachedData?.stats || {
    total_tasks: 0,
    pending_tasks: 0,
    in_progress_tasks: 0,
    completed_tasks: 0,
    failed_tasks: 0,
    overdue_tasks: 0,
    assigned_to_me: 0,
    due_today_tasks: 0,
    upcoming_tasks: 0
  });
  const [loading, setLoading] = useState(!cachedData); // Show loading only if no cache
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("due_today");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [editTask, setEditTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [formError, setFormError] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isInitialized, setIsInitialized] = useState(false); // Track initialization
  const [modalLoading, setModalLoading] = useState(false); // Track modal loading state
  const [preventDuplicateModal, setPreventDuplicateModal] = useState(false); // Prevent duplicate modals
  const [lastClickedTaskId, setLastClickedTaskId] = useState(null); // Track last clicked task
  const [clickTimeout, setClickTimeout] = useState(null); // Debounce click handling
  // Scroll to top functionality
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Select button and bulk delete functionality
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // PERFORMANCE: Request deduplication - prevent multiple simultaneous API calls
  const fetchInProgressRef = useRef(false);
  const lastFetchParamsRef = useRef('');
  
  // PERFORMANCE: Track if initial load is complete
  const initialLoadCompleteRef = useRef(false);

  // Table horizontal scroll controls - matching LeadCRM.jsx
  const tableScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // "Show More" state instead of pagination for better UX
  const [displayedTasksCount, setDisplayedTasksCount] = useState(50); // Start with 50 tasks
  const tasksPerLoad = 50; // Load 50 more tasks each time

  // Table horizontal scroll functions - exactly from LeadCRM.jsx
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

  // Permission management
  const [permissions, setPermissions] = useState({
    show: true,
    create: false,
    edit_others: false
  });

  // Memoized user management for better performance
  const getCurrentUserId = useCallback(() => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return null;
  }, []);

  // Optimized permission loading
  const loadPermissions = useCallback(() => {
    try {
      const userPermissions = getUserPermissions();
      
      if (isSuperAdmin(userPermissions)) {
        setPermissions({
          show: true,
          create: true,
          edit_others: true,
          delete: true // Add delete permission for super admin
        });
        return;
      }

      const taskPermissions = {
        show: hasPermission(userPermissions, 'tasks', 'show') || hasPermission(userPermissions, 'Tasks', 'show'),
        create: hasPermission(userPermissions, 'tasks', 'create') || hasPermission(userPermissions, 'Tasks', 'create'),
        edit_others: hasPermission(userPermissions, 'tasks', 'edit_others') || hasPermission(userPermissions, 'Tasks', 'edit_others'),
        delete: hasPermission(userPermissions, 'tasks', 'delete') || hasPermission(userPermissions, 'Tasks', 'delete') // Add delete permission check
      };

      if (userPermissions?.tasks === "*" || userPermissions?.Tasks === "*" ||
          userPermissions?.tasks === "all" || userPermissions?.Tasks === "all") {
        setPermissions({
          show: true,
          create: true,
          edit_others: true,
          delete: true // Add delete permission for wildcard users
        });
        return;
      }

      if (taskPermissions.show) {
        setPermissions({
          show: true,
          create: taskPermissions.create || true,
          edit_others: taskPermissions.edit_others,
          delete: taskPermissions.delete // Add delete permission
        });
      } else {
        setPermissions({
          show: false,
          create: false,
          edit_others: false,
          delete: false // Add delete permission
        });
      }
    } catch (error) {
      setPermissions({
        show: true,
        create: false,
        edit_others: false
      });
    }
  }, []);

  // Immediate initialization effect - runs first and fast
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Get user info synchronously from localStorage
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        const userFirstName = localStorage.getItem('userFirstName');
        const userLastName = localStorage.getItem('userLastName');

        if (userId) {
          setCurrentUserId(userId);
        }

        // Set current user name with fallback chain
        if (userName) {
          setCurrentUser(userName);
        } else if (userFirstName && userLastName) {
          setCurrentUser(`${userFirstName} ${userLastName}`);
        } else if (userFirstName) {
          setCurrentUser(userFirstName);
        } else {
          const userData = localStorage.getItem('userData');
          if (userData) {
            try {
              const parsedUser = JSON.parse(userData);
              if (parsedUser.name) {
                setCurrentUser(parsedUser.name);
              } else if (parsedUser.fullName) {
                setCurrentUser(parsedUser.fullName);
              } else if (parsedUser.firstName && parsedUser.lastName) {
                setCurrentUser(`${parsedUser.firstName} ${parsedUser.lastName}`);
              } else if (parsedUser.firstName) {
                setCurrentUser(parsedUser.firstName);
              } else if (parsedUser.username) {
                setCurrentUser(parsedUser.username);
              } else if (parsedUser.email) {
                setCurrentUser(parsedUser.email);
              } else {
                setCurrentUser("Current User");
              }
            } catch (parseError) {
              setCurrentUser("Current User");
            }
          } else {
            setCurrentUser("Current User");
          }
        }

        // Load permissions
        loadPermissions();
        
        // Mark as initialized
        setIsInitialized(true);
        
        // Pre-warm components for instant popup loading
        preWarmComponents();
        
        // OPTIMIZATION: Start loading data immediately (no setTimeout delay)
        // If we have cached data, this will refresh it in the background
        if (userId) {
          fetchTasks();
        }
      } catch (error) {
        setCurrentUser("Current User");
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []); // Empty dependency array for one-time initialization

  // **OPTIMIZED: Fetch tasks AND stats in a single API call with optional limit**
  const fetchTasksAndStats = async (filters = {}, initialLoad = false) => {
    if (!currentUserId) {
      return;
    }

    // PERFORMANCE: Prevent duplicate simultaneous requests
    const paramsKey = JSON.stringify({ currentUserId, filters, search, initialLoad });
    if (fetchInProgressRef.current && paramsKey === lastFetchParamsRef.current) {
      console.log('🚫 Skipping duplicate API call');
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchParamsRef.current = paramsKey;

    try {
      // Only show loading spinner on initial load or if no cache
      if (!cachedData || initialLoad) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        user_id: currentUserId,
        ...filters
      });

      // Add search filter if provided
      if (search) {
        params.append('search', search);
      }

      // PERFORMANCE: Limit initial load to 150 most recent tasks
      if (initialLoad && !initialLoadCompleteRef.current) {
        params.append('limit', '150');
      }

      // PERFORMANCE: Use combined endpoint to reduce API calls from 2 to 1
      const response = await fetchWithAuth(`${API_BASE_URL}/tasks/with-stats?${params}`);
      const data = await response.json();

      // Extract tasks and stats from combined response
      const tasksArray = data.tasks || [];
      const statsData = data.stats || {};

      // Validate data structure
      if (!Array.isArray(tasksArray)) {
        throw new Error('Invalid response format from server');
      }

      // Transform API response
      const transformedTasks = tasksArray.map((task) => {
        const taskId = task.id || task._id;

        return {
          id: taskId,
          createdBy: task.creator_name || 'Unknown',
          status: (task.notes && task.notes.includes('[SYSTEM_FAILED_TASK]')) 
            ? 'FAILED'
            : task.status,
          subject: task.subject,
          message: task.task_details || '',
          typeTask: task.task_type,
          leadLogin: task.lead_info?.lead_login || 'N/A',
          customerName: task.lead_info?.customer_name || 'N/A',
          date: task.due_date || new Date().toISOString().split('T')[0],
          time: task.due_time || '00:00',
          assign: task.assigned_users?.map(u => u.name).join(', ') || 'Unassigned',
          priority: task.priority || 'Medium',
          created_at: task.created_at,
          updated_at: task.updated_at,
          is_urgent: task.is_urgent || false,
          notes: task.notes || '',
          lead_id: task.lead_id,
          loan_type: task.loan_type,
          assigned_to: task.assigned_to || [],
          created_by: task.created_by,
          repeat_type: task.repeat_type || task.recurrence_type || task.is_recurring || task.repeat_frequency || task.recurring || task.repeat_interval || (task.is_repeat ? 'Yes' : 'No'),
          createdDate: task.created_at ? formatDateUtil(task.created_at) : formatDateUtil(new Date()),
          createdTime: task.created_at ? formatDateTime(task.created_at) : formatDateTime(new Date())
        };
      });

      setTasks(transformedTasks);
      
      // Update stats from the combined response
      const updatedStats = {
        total_tasks: statsData.total_tasks || 0,
        pending_tasks: statsData.pending_tasks || 0,
        in_progress_tasks: statsData.in_progress_tasks || 0,
        completed_tasks: statsData.completed_tasks || 0,
        overdue_tasks: statsData.overdue_tasks || 0,
        urgent_tasks: statsData.urgent_tasks || 0,
        my_tasks: statsData.my_tasks || 0,
        assigned_to_me: statsData.assigned_to_me || 0,
        due_today_tasks: statsData.due_today_tasks || 0,
        upcoming_tasks: statsData.upcoming_tasks || 0,
        failed_tasks: statsData.failed_tasks || 0
      };
      
      setTaskStats(updatedStats);

      // PERFORMANCE: Cache the data for faster subsequent loads
      try {
        localStorage.setItem(CACHE_KEYS.TASKS, JSON.stringify(transformedTasks));
        localStorage.setItem(CACHE_KEYS.STATS, JSON.stringify(updatedStats));
        localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
      } catch (cacheError) {
        console.warn('Cache write error:', cacheError);
      }

      // Mark initial load as complete
      if (initialLoad) {
        initialLoadCompleteRef.current = true;
      }

    } catch (error) {
      setError(`Failed to load tasks: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false; // Release the lock
    }
  };

  // Legacy function kept for compatibility (redirects to combined)
  const fetchTasks = async (filters = {}) => {
    return fetchTasksAndStats(filters, true); // Pass initialLoad = true
  };

  // Legacy function kept for compatibility (now a no-op since stats come with tasks)
  const fetchTaskStats = async () => {
    // Stats are now fetched together with tasks in fetchTasksAndStats()
    // This function is kept for backwards compatibility but does nothing
    return;
  };

  // Calculate fallback stats from tasks array when backend stats are missing
  const calculateFallbackStats = () => {
    if (tasks.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);


    // Helper function to safely parse dates
    const parseTaskDate = (dateString) => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return null;
        }
        date.setHours(0, 0, 0, 0);
        return date;
      } catch (error) {
        return null;
      }
    };

    // Filter tasks by status to exclude completed and failed ones from time-based categories
    const activeTasks = tasks.filter(task => task.status !== 'Completed' && task.status !== 'Cancelled' && task.status !== 'Failed' && task.status !== 'FAILED');

    const dueTodayTasks = activeTasks.filter(task => {
      const taskDate = parseTaskDate(task.date);
      if (!taskDate) return false;
      return taskDate.getTime() === today.getTime();
    }).length;

    const upcomingTasks = tasks.filter(task => {
      const taskDate = parseTaskDate(task.date);
      if (!taskDate) return false;
      return taskDate.getTime() > today.getTime();
    }).length;

    const overdueTasks = activeTasks.filter(task => {
      const taskDate = parseTaskDate(task.date);
      if (!taskDate) return false;
      return taskDate.getTime() < today.getTime();
    }).length;

    // Calculate completed and other status counts
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const failedTasks = tasks.filter(task => task.status === 'Failed' || task.status === 'FAILED').length;
    const pendingTasks = tasks.filter(task => task.status === 'Pending').length;
    const inProgressTasks = tasks.filter(task => task.status === 'In Progress').length;

    const calculatedStats = {
      dueTodayTasks,
      upcomingTasks,
      overdueTasks,
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      pendingTasks,
      inProgressTasks
    };


    // Always update with calculated stats - this ensures accurate counts
    setTaskStats(prevStats => ({
      ...prevStats,
      due_today_tasks: dueTodayTasks,
      upcoming_tasks: upcomingTasks,
      overdue_tasks: overdueTasks,
      total_tasks: tasks.length,
      completed_tasks: completedTasks,
      failed_tasks: failedTasks,
      pending_tasks: pendingTasks,
      in_progress_tasks: inProgressTasks
    }));
  };

  // Add state to track when a task is edited
  const [lastTaskUpdate, setLastTaskUpdate] = useState(null);

  // Optimized data fetching effect
  useEffect(() => {
    if (isInitialized && currentUserId) {
      fetchTasks();
      fetchTaskStats();
    }
  }, [isInitialized, currentUserId, activeFilter, assignmentFilter]);

  // Calculate fallback stats when tasks are loaded or updated  
  useEffect(() => {
    if (tasks.length > 0) {
      // Add a small delay to ensure state updates are complete
      setTimeout(() => {
        calculateFallbackStats();
      }, 100);
    } else if (tasks.length === 0 && !loading) {
      // If no tasks loaded and not loading, reset stats
      setTaskStats(prevStats => ({
        ...prevStats,
        due_today_tasks: 0,
        upcoming_tasks: 0,
        overdue_tasks: 0,
        total_tasks: 0
      }));
    }
  }, [tasks, loading]);

  // Optimized search with debounce
  useEffect(() => {
    if (!isInitialized || !currentUserId) return;
    
    const timeoutId = setTimeout(() => {
      fetchTasks();
      fetchTaskStats();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [search]);

  // Optimized task updates
  useEffect(() => {
    if (lastTaskUpdate && isInitialized && currentUserId) {
      fetchTasks();
      fetchTaskStats();
    }
  }, [lastTaskUpdate]);

  // Memoized calculations for better performance with frontend pagination
  const { realTimeCounts, safeCounts, filteredTasks } = useMemo(() => {
    if (tasks.length === 0) {
      return {
        realTimeCounts: { dueToday: 0, upcoming: 0, overdue: 0, all: 0, completed: 0 },
        safeCounts: { dueToday: 0, upcoming: 0, overdue: 0, all: 0, completed: 0 },
        filteredTasks: []
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // First, apply assignment filter to get the base set of tasks to work with
    let baseTasks = tasks;
    if (assignmentFilter !== 'all') {
      const currentUserLower = currentUser.toLowerCase().trim();
      
      baseTasks = tasks.filter((task) => {
        if (assignmentFilter === 'assigned_to_me') {
          const assignedToColumn = task.assign || '';
          if (!assignedToColumn.trim() || assignedToColumn === 'Unassigned') return false;
          return assignedToColumn.toLowerCase().includes(currentUserLower);
        } else if (assignmentFilter === 'assigned_by_me') {
          const createdByColumn = task.createdBy || '';
          const assignedToColumn = task.assign || '';
          return createdByColumn.toLowerCase().trim() === currentUserLower && 
                 assignedToColumn !== 'Unassigned' && 
                 assignedToColumn.trim() !== '';
        }
        return true;
      });
    }

    // Calculate real-time counts based on filtered tasks
    const activeTasks = baseTasks.filter(task => 
      task.status !== 'Completed' && 
      task.status !== 'Cancelled' && 
      task.status !== 'Failed' &&
      task.status !== 'FAILED'
    );
    const completedTasks = baseTasks.filter(task => task.status === 'Completed');
    const failedTasks = baseTasks.filter(task => task.status === 'Failed' || task.status === 'FAILED');

    // Helper to parse task dates efficiently
    const getTaskTime = (dateString) => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      } catch {
        return null;
      }
    };

    let dueToday = 0, upcoming = 0, overdue = 0;
    
    activeTasks.forEach(task => {
      const taskTime = getTaskTime(task.date);
      if (taskTime === null) return;
      
      if (taskTime === todayTime) dueToday++;
      else if (taskTime < todayTime) overdue++;
    });

    baseTasks.forEach(task => {
      const taskTime = getTaskTime(task.date);
      if (taskTime && taskTime > todayTime) upcoming++;
    });

    const realTimeCounts = { 
      dueToday, 
      upcoming, 
      overdue, 
      all: baseTasks.length,
      completed: completedTasks.length,
      failed: failedTasks.length
    };
    
    // Use filtered counts when assignment filter is applied, otherwise use stats + real-time
    const safeCounts = assignmentFilter !== 'all' ? realTimeCounts : {
      dueToday: Math.max(taskStats.due_today_tasks || 0, realTimeCounts.dueToday),
      upcoming: Math.max(taskStats.upcoming_tasks || 0, realTimeCounts.upcoming),
      overdue: Math.max(taskStats.overdue_tasks || 0, realTimeCounts.overdue),
      all: Math.max(taskStats.total_tasks || 0, realTimeCounts.all),
      completed: Math.max(taskStats.completed_tasks || 0, realTimeCounts.completed),
      failed: Math.max(taskStats.failed_tasks || 0, realTimeCounts.failed)
    };

    // Filter tasks for display (apply search and date filters)
    const searchLower = search.toLowerCase();
    const filteredTasks = baseTasks.filter((task) => {
      // Search filter - early exit for better performance
      if (search) {
        const searchValid = task.customerName.toLowerCase().includes(searchLower) ||
                          task.subject.toLowerCase().includes(searchLower) ||
                          task.status.toLowerCase().includes(searchLower) ||
                          task.createdBy.toLowerCase().includes(searchLower);
        if (!searchValid) return false;
      }

      // Date filter - apply frontend filtering for all tabs
      if (activeFilter === 'all') return true;
      
      const taskTime = getTaskTime(task.date);
      if (!taskTime) return false;
      
      switch (activeFilter) {
        case 'due_today':
          return taskTime === todayTime && task.status !== 'Completed' && task.status !== 'Cancelled' && task.status !== 'Failed' && task.status !== 'FAILED';
        case 'upcoming':
          return taskTime > todayTime;
        case 'overdue':
          return taskTime < todayTime && task.status !== 'Completed' && task.status !== 'Cancelled' && task.status !== 'Failed' && task.status !== 'FAILED';
        case 'completed':
          return task.status === 'Completed';
        case 'failed':
          return task.status === 'Failed' || task.status === 'FAILED';
        default:
          return true;
      }
    });

    return { realTimeCounts, safeCounts, filteredTasks };
  }, [tasks, taskStats, search, activeFilter, assignmentFilter, currentUser]);

  // Memoized filters
  const FILTERS = useMemo(() => [
    { key: "due_today", label: "Due Today", count: safeCounts.dueToday },
    { key: "upcoming", label: "Upcoming", count: safeCounts.upcoming },
    { key: "overdue", label: "Overdue", count: safeCounts.overdue },
    { key: "completed", label: "Complete", count: safeCounts.completed },
    { key: "failed", label: "Failed", count: safeCounts.failed || 0 },
    { key: "all", label: "All", count: safeCounts.all, active: true },
  ], [safeCounts]);

  // Memoized "Show More" calculation - slice tasks based on displayedTasksCount
  const displayedTasks = useMemo(() => {
    return filteredTasks.slice(0, displayedTasksCount);
  }, [filteredTasks, displayedTasksCount]);

  const hasMoreTasks = useMemo(() => displayedTasksCount < filteredTasks.length, [displayedTasksCount, filteredTasks.length]);

  // Update scroll buttons when table content changes - from LeadCRM.jsx
  useEffect(() => {
    updateScrollButtons();
  }, [displayedTasks]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedTasksCount(50);
  }, [activeFilter, assignmentFilter, search]);

  // Function to load more tasks
  const handleShowMore = () => {
    setDisplayedTasksCount(prev => prev + tasksPerLoad);
  };

  // Function to process attachments to ensure consistent formatting
  const processAttachments = (attachments, taskId) => {
    if (!attachments || attachments.length === 0) return [];
    
    return attachments.map(attachment => {
      // Get attachment ID
      const attachmentId = attachment.id || attachment._id;
      
      // Get file URL
      let fileUrl;
      if (attachment.url) {
        fileUrl = attachment.url;
      } else if (attachment.file_path) {
        // Clean up the file path to avoid double media/tasks
        let cleanPath = attachment.file_path;
        
        if (cleanPath.startsWith('http')) {
          fileUrl = cleanPath;
        } else {
          // Remove any leading slashes to normalize the path
          cleanPath = cleanPath.replace(/^\/+/, '');
          
          // Check if the path already contains media/tasks to avoid duplication
          if (cleanPath.startsWith('media/tasks/')) {
            // Path already has full media/tasks prefix
            fileUrl = `${API_BASE_URL}/${cleanPath}`;
          } else if (cleanPath.startsWith('media/')) {
            // Path starts with media/ but not full media/tasks/
            fileUrl = `${API_BASE_URL}/${cleanPath}`;
          } else {
            // Path doesn't have media prefix - add full media/tasks/
            fileUrl = `${API_BASE_URL}/media/tasks/${cleanPath}`;
          }
        }
      } else {
        fileUrl = `${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}?user_id=${currentUserId}`;
      }
      
      // Process mime type
      const mimeType = attachment.mime_type || attachment.type || 'application/octet-stream';
      const isImage = mimeType.startsWith('image/') || 
                     (attachment.filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.filename)) ||
                     (attachment.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.name));
      
      // Make sure each attachment has all required properties
      return {
        id: attachmentId,
        name: attachment.name || attachment.filename || 'Unnamed File',
        url: fileUrl,
        size: attachment.size || attachment.file_size || 0,
        type: mimeType,
        created_at: attachment.created_at || new Date().toISOString(),
        // Add any missing properties that the editor might expect
        downloadUrl: `${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download?user_id=${currentUserId}`,
        isNew: false,
        isFromBackend: true,
        isImage: isImage,
        contentType: mimeType,
        uploadedAt: attachment.created_at || new Date().toISOString()
      };
    });
  };

  // Function to fetch task attachments separately
  const fetchTaskAttachments = async (taskId) => {
    try {
      const attachmentsResponse = await fetchWithAuth(`${API_BASE_URL}/tasks/${taskId}/attachments?user_id=${currentUserId}`);
      const attachmentsData = await attachmentsResponse.json();
      
      if (Array.isArray(attachmentsData)) {
        return attachmentsData;
      } else if (attachmentsData && attachmentsData.attachments && Array.isArray(attachmentsData.attachments)) {
        return attachmentsData.attachments;
      } else {
        return [];
      }
    } catch (attachmentsError) {
      return [];
    }
  };
  
  // Function to fetch task history
  const fetchTaskHistory = async (taskId) => {
    try {
      const historyResponse = await fetchWithAuth(`${API_BASE_URL}/tasks/${taskId}/history?user_id=${currentUserId}`);
      const historyData = await historyResponse.json();
      
      if (Array.isArray(historyData)) {
        return historyData;
      } else if (historyData && historyData.history && Array.isArray(historyData.history)) {
        return historyData.history;
      } else {
        return [];
      }
    } catch (historyError) {
      return [];
    }
  };

  // Handle row click to show EditTask - Immediate popup with progressive loading
  const handleRowClick = async (task) => {
    try {
      // DUPLICATE PREVENTION - Only block during active loading/processing
      if (preventDuplicateModal || modalLoading) {
        return;
      }
      
      // If a modal is already open, close it first
      if (editTask) {
        setEditTask(null);
      }
      
      setPreventDuplicateModal(true);
      setModalLoading(true);
      setLastClickedTaskId(task.id);

      // Validate task ID format
      if (!task.id || typeof task.id !== 'string' || task.id.length < 12) {
        alert('Invalid task ID. Please refresh the page and try again.');
        setPreventDuplicateModal(false);
        setModalLoading(false);
        setLastClickedTaskId(null);
        return;
      }

      // Check permissions before allowing edit
      const isOwnTask = task.created_by === currentUserId ||
        task.assigned_to?.includes(currentUserId);

      // Super admin or users with show permission can edit all tasks
      const canEdit = isSuperAdmin(getUserPermissions()) || permissions.show || permissions.edit_others || isOwnTask;

      if (!canEdit) {
        alert('You do not have permission to edit this task.');
        setPreventDuplicateModal(false);
        setModalLoading(false);
        setLastClickedTaskId(null);
        return;
      }

      // IMMEDIATE POPUP: Show modal instantly with available data (0.1 seconds)
      const immediateTaskData = {
        id: task.id,
        subject: task.subject || '',
        message: task.message || '',
        typeTask: task.typeTask || 'To-Do',
        status: task.status || 'Pending',
        date: task.date || new Date().toISOString().split('T')[0],
        time: task.time || '00:00',
        assign: task.assign || 'Unassigned',
        priority: task.priority || 'Medium',
        created_at: task.created_at,
        updated_at: task.updated_at,
        is_urgent: task.is_urgent || false,
        notes: task.notes || '',
        lead_id: task.lead_id,
        loan_type: task.loan_type,
        assigned_to: task.assigned_to || [],
        created_by: task.created_by,
        attachments: [], // Start empty, will be loaded
        createdBy: task.createdBy || 'Unknown',
        leadLogin: task.leadLogin || 'N/A',
        customerName: task.customerName || 'N/A',
        history: [], // Start empty, will be loaded
        comments: [], // Start empty, will be loaded
        isLoading: true // Indicate data is still loading
      };

      // Show popup immediately with basic data (0.1 seconds target)
      setEditTask(immediateTaskData);
      setModalLoading(false);


      // BACKGROUND DATA LOADING: Fetch full data and update the popup
      // Use setTimeout with 0 to make it truly non-blocking
      setTimeout(async () => {
        try {
          // Fetch full task details including attachments
          const response = await fetchWithAuth(`${API_BASE_URL}/tasks/${task.id}?user_id=${currentUserId}&include_attachments=true`);

          const fullTaskData = await response.json();
          
          // Always fetch attachments separately to ensure we have the correct data
          const fetchedAttachments = await fetchTaskAttachments(task.id);
          fullTaskData.attachments = fetchedAttachments;
          
          // Fetch task history for the History tab
          fullTaskData.history = await fetchTaskHistory(task.id);

          // Additional fetch for lead info if there's a lead_id
          let leadInfo = null;
          if (fullTaskData.lead_id) {
            try {
              const leadResponse = await fetchWithAuth(`${API_BASE_URL}/leads/${fullTaskData.lead_id}?user_id=${currentUserId}`);
              leadInfo = await leadResponse.json();
            } catch (leadError) {
            }
          }

          // Process attachments for the current task
          const processedAttachments = processAttachments(fullTaskData.attachments, fullTaskData.id || task.id);
          
          // Log history information
          
          // Transform the full task data to match expected format
          const transformedTask = {
            id: fullTaskData.id,
            subject: fullTaskData.subject,
            message: fullTaskData.task_details,
            typeTask: fullTaskData.task_type,
            status: fullTaskData.status,
            date: fullTaskData.due_date || new Date().toISOString().split('T')[0],
            time: fullTaskData.due_time || '00:00',
            assign: fullTaskData.assigned_users?.map(u => u.name).join(', ') || 'Unassigned',
            priority: fullTaskData.priority || 'Medium',
            created_at: fullTaskData.created_at,
            updated_at: fullTaskData.updated_at,
            is_urgent: fullTaskData.is_urgent || false,
            notes: fullTaskData.notes || '',
            lead_id: fullTaskData.lead_id,
            loan_type: fullTaskData.loan_type,
            loan_type_name: fullTaskData.loan_type_name || '',
            assigned_to: fullTaskData.assigned_to || [],
            created_by: fullTaskData.created_by,
            attachments: processedAttachments,
            createdBy: fullTaskData.creator_name || 'Unknown',
            // Include lead details if available
            leadInfo: leadInfo || {},
            // Include lead login and customer name from either the API response or the task data
            leadLogin: fullTaskData.lead_login || fullTaskData.lead_number || task.leadLogin,
            customerName: fullTaskData.customer_name || task.customerName,
            // Include history and comments for the task
            history: fullTaskData.history || [],
            comments: fullTaskData.comments || [],
            // Include creation and modified dates for history
            created_date: fullTaskData.created_at,
            last_modified: fullTaskData.updated_at,
            isLoading: false // Mark as fully loaded
          };

          // Include associated records if available
          if (fullTaskData.associate_with_records || fullTaskData.associateWithRecords) {
            transformedTask.associateWithRecords = fullTaskData.associate_with_records || fullTaskData.associateWithRecords;
          } else if (leadInfo) {
            // If no explicit associate_with_records but we have lead info, create one
            const customerName = leadInfo.full_name || `${leadInfo.first_name || ''} ${leadInfo.last_name || ''}`.trim() || 'Unknown';
            const companyName = leadInfo.company_name || 'N/A';
            const status = leadInfo.status || 'Active';
            transformedTask.associateWithRecords = [`${customerName} - ${companyName} (${status})`];
          }


          // Update the popup with full data
          setEditTask(transformedTask);
          setPreventDuplicateModal(false); // Allow new popups after data is loaded
          setLastClickedTaskId(null); // Reset clicked task
        } catch (error) {
          
          // Handle specific error cases
          if (error.message.includes('404')) {
            // Task not found - this indicates a data synchronization issue
            
            const errorMsg = `Cannot open task "${task.subject}".\n\nThis task appears in the list but cannot be accessed individually. This indicates a data synchronization issue.\n\nPossible causes:\n1. Task was recently deleted by another user\n2. Permission changes\n3. Database inconsistency\n\nPlease refresh the page and try again. If the issue persists, contact your system administrator.`;
            alert(errorMsg);
            
            // Close the popup and refresh the task list
            setEditTask(null);
            setPreventDuplicateModal(false);
            setLastClickedTaskId(null);
            fetchTasks();
            return;
          } else if (error.message.includes('403')) {
            alert('You do not have permission to view this task.');
            setEditTask(null);
            setPreventDuplicateModal(false);
            setLastClickedTaskId(null);
            return;
          } else {
            // For other errors, show error in popup but keep it open
            
            // Update the task to show error state but keep popup open
            setEditTask(prev => ({
              ...prev,
              isLoading: false,
              loadingError: error.message
            }));
            setPreventDuplicateModal(false);
            setLastClickedTaskId(null);
          }
        }
      }, 0); // Load full data immediately after popup shows (0ms for maximum speed)
    } catch (error) {
      setEditTask(null);
      setPreventDuplicateModal(false);
      setModalLoading(false);
      setLastClickedTaskId(null);
      alert(`Error opening task: ${error.message}`);
    }
  };

  // Handle immediate status change for tab switching
  const handleTaskStatusChange = (statusChangeInfo) => {
    // If a task was completed, immediately switch to Complete tab
    if (statusChangeInfo.shouldSwitchToCompleteTab && statusChangeInfo.immediate) {
      setActiveFilter('completed');
      toast.success('Task completed! Switched to Complete tab.', {
        position: 'top-right',
        autoClose: 2000,
      });
    }
    
    // If a task was failed, immediately switch to Failed tab
    if (statusChangeInfo.shouldSwitchToFailedTab && statusChangeInfo.immediate) {
      setActiveFilter('failed');
      toast.error('Task marked as failed! Switched to Failed tab.', {
        position: 'top-right',
        autoClose: 2000,
      });
    }
  };

  // Handle save task from EditTask
  // Function to determine which tab a lead should be in based on task status
  const determineLeadTabByTaskStatus = (taskStatus, leadId) => {
    // Task status to lead tab mapping
    const statusTabMapping = {
      'Completed': 'active_leads', // Completed tasks usually indicate active leads
      'In Progress': 'active_leads', // In progress tasks indicate active leads
      'Pending': 'active_leads', // Pending tasks still indicate active leads
      'Cancelled': 'not_a_lead', // Cancelled tasks might indicate not a lead
      'Failed': 'lost_lead', // Failed tasks might indicate lost leads
      'Rejected': 'lost_lead' // Rejected tasks might indicate lost leads
    };
    
    return statusTabMapping[taskStatus] || 'active_leads'; // Default to active leads
  };

  // Function to automatically refresh lead data and trigger tab updates
  const handleLeadStatusUpdate = async (taskDetails) => {
    if (!taskDetails.leadId) return;
    
    try {
      // Fetch updated lead information
      const leadResponse = await fetchWithAuth(`${API_BASE_URL}/leads/${taskDetails.leadId}?user_id=${currentUserId}`);
      const leadData = await leadResponse.json();
      
      // Determine which tab this lead should be in
      const suggestedTab = determineLeadTabByTaskStatus(taskDetails.newStatus, taskDetails.leadId);
      
      // Trigger a global event that other components can listen to
      const customEvent = new CustomEvent('leadStatusChanged', {
        detail: {
          leadId: taskDetails.leadId,
          leadData: leadData,
          suggestedTab: suggestedTab,
          taskStatus: taskDetails.newStatus,
          previousTaskStatus: taskDetails.oldStatus,
          shouldAutoSwitch: true,
          timestamp: new Date().toISOString()
        }
      });
      
      // Dispatch the event globally
      window.dispatchEvent(customEvent);
      
      // Also call the callback if provided
      if (onTaskStatusChange) {
        onTaskStatusChange({
          ...taskDetails,
          leadData: leadData,
          suggestedTab: suggestedTab,
          shouldSwitchTab: true
        });
      }
      
      // Force refresh of task list to reflect any changes
      await fetchTasks();
      
    } catch (error) {
      // Continue with normal task update even if lead update fails
    }
  };

  const handleSaveTask = async (updatedTask) => {
    try {
      // Get taskId upfront
      const currentTaskId = updatedTask._id || updatedTask.id;
      
      // Track if status changed for history
      const originalTask = tasks.find(t => t.id === currentTaskId);
      const statusChanged = originalTask && originalTask.status !== updatedTask.status;
      const oldStatus = originalTask?.status || 'Unknown';
      
      // Check if this is a status-only change that should keep modal open
      const keepModalOpen = updatedTask.keepModalOpen === true;
      
      // **IMMEDIATE UI UPDATES FIRST - No waiting for API**
      
      // 1. Close the edit modal IMMEDIATELY (unless keepModalOpen flag is set)
      if (!keepModalOpen) {
        setEditTask(null);
      }
      
      // 2. Update local task list IMMEDIATELY for instant UI feedback
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => {
          if (task.id === currentTaskId) {
            // Use uiStatus if provided (for "Failed" display when backend has "Cancelled")
            const displayStatus = updatedTask.uiStatus || updatedTask.status || task.status;
            
            const newTask = {
              ...task,
              subject: updatedTask.subject || updatedTask.title || task.subject,
              message: updatedTask.message || updatedTask.description || task.message,
              status: displayStatus,  // Use UI status for display
              date: updatedTask.date || updatedTask.due_date || task.date,
              time: updatedTask.time || task.time,
              priority: updatedTask.priority || task.priority,
              typeTask: updatedTask.typeTask || updatedTask.task_type || task.typeTask,
              is_urgent: updatedTask.is_urgent || task.is_urgent,
              notes: updatedTask.notes || task.notes,
              updated_at: new Date().toISOString(),
              // Add a unique render key to force re-render
              renderKey: Date.now(),
            };
            return newTask;
          }
          return task;
        });
        return updatedTasks;
      });
      
      // 2b. If keeping modal open, also update the editTask state
      if (keepModalOpen && editTask) {
        setEditTask(prevEditTask => {
          if (prevEditTask && prevEditTask.id === currentTaskId) {
            const displayStatus = updatedTask.uiStatus || updatedTask.status || prevEditTask.status;
            const updatedEditTask = {
              ...prevEditTask,
              subject: updatedTask.subject || updatedTask.title || prevEditTask.subject,
              message: updatedTask.message || updatedTask.description || prevEditTask.message,
              status: displayStatus,
              date: updatedTask.date || updatedTask.due_date || prevEditTask.date,
              time: updatedTask.time || prevEditTask.time,
              priority: updatedTask.priority || prevEditTask.priority,
              typeTask: updatedTask.typeTask || updatedTask.task_type || prevEditTask.typeTask,
              is_urgent: updatedTask.is_urgent || prevEditTask.is_urgent,
              notes: updatedTask.notes || prevEditTask.notes,
              updated_at: new Date().toISOString(),
            };
            return updatedEditTask;
          }
          return prevEditTask;
        });
      }
      
      // 3. If status changed, trigger immediate tab switching
      if (statusChanged && updatedTask.lead_id) {
        const suggestedTab = determineLeadTabByTaskStatus(updatedTask.status, updatedTask.lead_id);
        
        // Trigger immediate global event for tab switching
        const customEvent = new CustomEvent('leadStatusChanged', {
          detail: {
            leadId: updatedTask.lead_id,
            suggestedTab: suggestedTab,
            taskStatus: updatedTask.status,
            previousTaskStatus: oldStatus,
            shouldAutoSwitch: true,
            immediate: true,
            timestamp: new Date().toISOString()
          }
        });
        
        // Dispatch immediately
        window.dispatchEvent(customEvent);
      }
      
      // **NOW HANDLE API CALLS IN BACKGROUND**
      
      // Prepare the task update object with proper field mapping
      const taskUpdate = {
        subject: updatedTask.subject || updatedTask.title,
        task_details: updatedTask.message || updatedTask.description,
        priority: updatedTask.priority || 'Medium',
        status: updatedTask.status,
        assigned_to: updatedTask.assigned_to || updatedTask.assigned_users || [],
        due_date: updatedTask.date || updatedTask.due_date || null,
        due_time: updatedTask.time || null,
        is_urgent: updatedTask.is_urgent || false,
        notes: updatedTask.notes || '',
        task_type: updatedTask.typeTask || updatedTask.task_type || 'To-Do',
        user_id: currentUserId,
        // Include status change information for history tracking
        status_changed: statusChanged,
        old_status: oldStatus,
        // Include comment if provided
        new_comment: updatedTask.newComment || ''
      };

      // Update local task list IMMEDIATELY for instant UI feedback
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => {
          if (task.id === currentTaskId) {
            // Use uiStatus if provided (for "Failed" display when backend has "Cancelled")
            const displayStatus = updatedTask.uiStatus || updatedTask.status || task.status;
            
            return {
              ...task,
              subject: updatedTask.subject || updatedTask.title || task.subject,
              message: updatedTask.message || updatedTask.description || task.message,
              status: displayStatus,  // Use UI status for display
              date: updatedTask.date || updatedTask.due_date || task.date,
              time: updatedTask.time || task.time,
              priority: updatedTask.priority || task.priority,
              typeTask: updatedTask.typeTask || updatedTask.task_type || task.typeTask,
              is_urgent: updatedTask.is_urgent || task.is_urgent,
              notes: updatedTask.notes || task.notes,
              updated_at: new Date().toISOString(),
            };
          }
          return task;
        });
        return updatedTasks;
      });

      // Validate task ID before making the request
      if (!currentTaskId || typeof currentTaskId !== 'string' || currentTaskId.length < 12) {
        throw new Error(`Invalid task ID: ${currentTaskId}. Expected a string with at least 12 characters.`);
      }
      
      // Check if task ID is a valid ObjectId format (24 characters, hex)
      const objectIdRegex = /^[a-fA-F0-9]{24}$/;
      if (!objectIdRegex.test(currentTaskId)) {
      }
      
      const updateUrl = `${API_BASE_URL}/tasks/${currentTaskId}?user_id=${currentUserId}`;
      
      // First, verify the task exists by trying to fetch it
      try {
        
        const verifyResponse = await fetchWithAuth(`${API_BASE_URL}/tasks/${currentTaskId}?user_id=${currentUserId}`);
        const existingTask = await verifyResponse.json();
      } catch (verifyError) {
        
        // If task doesn't exist (404), try to refresh the task list and check again
        if (verifyError.message.includes('404')) {
          
          try {
            // Force refresh the task list to get latest data
            await fetchTasks();
            
            // Check if the task still exists in the refreshed list
            const refreshedTask = tasks.find(t => t.id === currentTaskId);
            if (!refreshedTask) {
              const errorMsg = `Task ${currentTaskId} no longer exists. It may have been deleted by another user.\n\nThe task list has been refreshed. Please try again with a different task.`;
              alert(errorMsg);
              setEditTask(null); // Close the edit modal
              return;
            }
            
            // If task still exists in list but can't be accessed individually,
            // this indicates a data synchronization issue
            const errorMsg = `Data synchronization issue detected!\n\nTask "${updatedTask.subject}" exists in the list but cannot be accessed individually. This could be due to:\n\n1. Database inconsistency\n2. Permission changes\n3. Concurrent modifications\n\nPlease try:\n1. Refreshing the entire page\n2. Logging out and back in\n3. Contacting system administrator if issue persists\n\nThe task list has been refreshed to show current data.`;
            alert(errorMsg);
            setEditTask(null); // Close the edit modal
            return;
            
          } catch (refreshError) {
            const errorMsg = `Cannot verify task status: ${verifyError.message}\n\nAdditionally, failed to refresh data: ${refreshError.message}\n\nPlease refresh the page manually and try again.`;
            alert(errorMsg);
            return;
          }
        } else if (verifyError.message.includes('403')) {
          alert(`Access denied: You don't have permission to edit this task.`);
        } else {
          alert(`Error accessing task: ${verifyError.message}`);
        }
        return; // Stop the update process
      }
      
      // Update the main task data
      const response = await fetchWithAuth(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskUpdate)
      });
      
      // Parse response once
      const responseData = await response.json();

      // Add the comment if one was provided
      if (updatedTask.newComment && updatedTask.newComment.trim() !== '') {
        try {
          await fetchWithAuth(`${API_BASE_URL}/tasks/${currentTaskId}/comments?user_id=${currentUserId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              comment: updatedTask.newComment.trim(),
              user_id: currentUserId
            })
          });
        } catch (commentError) {
          // Continue with the task update even if comment fails
        }
      }

      // Handle attachment removals
      if (updatedTask.attachmentsToRemove && updatedTask.attachmentsToRemove.length > 0) {
        for (const attachmentId of updatedTask.attachmentsToRemove) {
          try {
            await fetchWithAuth(`${API_BASE_URL}/tasks/${currentTaskId}/attachments/${attachmentId}?user_id=${currentUserId}`, {
              method: 'DELETE'
            });
          } catch (attachmentError) {
            // Continue with other removals even if one fails
          }
        }
      }

      // Handle new attachment uploads
      if (updatedTask.newAttachments && updatedTask.newAttachments.length > 0) {
        
        for (const attachment of updatedTask.newAttachments) {
          if (attachment.file) {
            try {
              const attachmentFormData = new FormData();
              attachmentFormData.append('file', attachment.file);


              await fetchWithAuth(`${API_BASE_URL}/tasks/${currentTaskId}/attachments?user_id=${currentUserId}`, {
                method: 'POST',
                body: attachmentFormData
              });
            } catch (attachmentError) {
              // Continue with other uploads even if one fails
            }
          }
        }
      }

      // Fetch both updated task and its attachments to ensure we have complete data
      const updatedTaskResponse = await fetchWithAuth(`${API_BASE_URL}/tasks/${currentTaskId}?user_id=${currentUserId}`);
      const updatedTaskData = await updatedTaskResponse.json();
      
      // Fetch attachments separately to ensure we have the latest
      const taskAttachments = await fetchTaskAttachments(currentTaskId);
      updatedTaskData.attachments = taskAttachments;
      
      // Process attachments using the component-level helper function
      const processedAttachments = processAttachments(updatedTaskData.attachments, currentTaskId);
      
      // Update ONLY attachments since we already updated everything else immediately
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => {
          if (task.id === currentTaskId) {
            // Only update attachments - everything else was already updated immediately
            return {
              ...task,
              attachments: processedAttachments,
              // Ensure we preserve our immediate updates by not overriding them
              updated_at: new Date().toISOString(),
            };
          }
          return task;
        });
        return updatedTasks;
      });

      // Force a complete refresh of tasks to ensure everything is up-to-date
      // COMMENTED OUT: This was overriding our immediate updates
      // setLastTaskUpdate(new Date().toISOString()); // Trigger a refresh
      
      // Instead, just update stats without re-fetching all tasks
      await fetchTaskStats();
      
      // Background lead status update (no need to wait for this)
      if (statusChanged && updatedTaskData.lead_id) {
        handleLeadStatusUpdate({
          taskId: currentTaskId,
          oldStatus: oldStatus,
          newStatus: updatedTask.status,
          leadId: updatedTaskData.lead_id,
          taskDetails: updatedTaskData
        }).catch(error => {
          console.error('Background lead update failed:', error);
          // Don't throw error since UI updates already completed
        });
      }
      
      // Notify parent about general task update if callback provided
      if (onTaskUpdate) {
        onTaskUpdate({
          taskId: currentTaskId,
          taskDetails: updatedTaskData,
          isStatusChange: statusChanged,
          leadId: updatedTaskData.lead_id
        });
      }
      
    } catch (error) {
      // Close the modal immediately even on error to prevent stuck state
      setEditTask(null);
      
      setError('Failed to update task');
      throw error; // Re-throw to let EditTask handle the error
    }
  };

  // Handle cancel from EditTask
  // const handleCancelEdit = () => {
  //   setEditTask(null);
  // };

  // Create Task Modal controls
  // const openCreateModal = () => {
  //   // Initialize with the current logged-in user
  //   setTaskForm({
  //     ...initialTaskForm,
  //     createdBy: currentUser
  //   });
  //   setFormError("");
  //   setShowCreateModal(true);
  // };

  // const closeCreateModal = () => {
  //   setShowCreateModal(false);
  //   setTaskForm(initialTaskForm);
  //   setFormError("");
  // };

  // Handle create form field change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setTaskForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Create new task using API
  const handleCreateTaskSave = async (data) => {
    try {
      // Handle both old FormData format and new object format
      let newTaskData;
      let attachment = null;

      if (data instanceof FormData) {
        // Old FormData format
        newTaskData = {
          subject: data.get('subject'),
          task_details: data.get('task_details') || '',
          task_type: data.get('task_type') || 'To-Do',
          status: 'Pending',
          priority: data.get('priority') || 'Medium',
          due_date: data.get('due_date') || new Date().toISOString().split('T')[0],
          due_time: data.get('due_time') || '09:00:00',
          is_urgent: data.get('is_urgent') === 'true' || false,
          notes: data.get('notes') || '',
          created_by: currentUserId
        };

        // Handle assigned_to - convert from JSON string if present
        const assignedToRaw = data.get('assigned_to');
        if (assignedToRaw) {
          try {
            const assignedToArray = JSON.parse(assignedToRaw);
            newTaskData.assigned_to = [currentUserId];
          } catch (e) {
            newTaskData.assigned_to = [currentUserId];
          }
        } else {
          newTaskData.assigned_to = [currentUserId];
        }

        // Handle lead/loan type if provided
        if (data.get('lead_id')) {
          newTaskData.lead_id = data.get('lead_id');
        }
        if (data.get('loan_type')) {
          newTaskData.loan_type = data.get('loan_type');
        }
      } else {
        // New object format from CreateTask.jsx
        newTaskData = data.taskData;
        attachment = data.attachment;

        // Ensure created_by is set
        if (!newTaskData.created_by) {
          newTaskData.created_by = currentUserId;
        }

        // Ensure assigned_to is set and use currentUserId as fallback
        if (!newTaskData.assigned_to || newTaskData.assigned_to.length === 0) {
          newTaskData.assigned_to = [currentUserId];
        }

        // Ensure user_id is included in the task data
        if (!newTaskData.user_id) {
          newTaskData.user_id = currentUserId;
        }
      }


      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/tasks/?user_id=${currentUserId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newTaskData)
        });

        const responseData = await response.json();

        // Check if there are attachments to upload
        const attachmentFile = data instanceof FormData ? data.get('attachment') : attachment;
        const attachments = data instanceof FormData ? null : (data.attachments || []);
        
        if (attachmentFile && responseData.id) {
          // Handle single attachment (backward compatibility)

          const taskId = responseData.id;
          const attachmentFormData = new FormData();
          attachmentFormData.append('file', attachmentFile);

          try {
            await fetchWithAuth(`${API_BASE_URL}/tasks/${taskId}/attachments?user_id=${currentUserId}`, {
              method: 'POST',
              headers: {
                // Don't set Content-Type for FormData, browser will set it with the boundary
              },
              body: attachmentFormData
            });
          } catch (attachmentError) {
            // Continue even if attachment upload fails
          }
        }

        // Handle multiple attachments (new format)
        if (attachments && attachments.length > 0 && responseData.id) {

          const taskId = responseData.id;
          
          for (let i = 0; i < attachments.length; i++) {
            const attachment = attachments[i];
            if (attachment.file) {
              try {
                const attachmentFormData = new FormData();
                attachmentFormData.append('file', attachment.file);


                await fetchWithAuth(`${API_BASE_URL}/tasks/${taskId}/attachments?user_id=${currentUserId}`, {
                  method: 'POST',
                  headers: {
                    // Don't set Content-Type for FormData, browser will set it with the boundary
                  },
                  body: attachmentFormData
                });
              } catch (attachmentError) {
                // Continue with other attachments even if one fails
              }
            }
          }
        }

        // Refresh tasks and stats after successful creation
        await fetchTasks();
        await fetchTaskStats();
        setShowCreateModal(false);
      } catch (error) {
        throw new Error(`Failed to create task: ${error.message}`);
      }
    } catch (error) {
      setError(`Failed to create task: ${error.message}`);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/tasks/${taskId}/?user_id=${currentUserId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh tasks and stats after successful deletion
        await fetchTasks();
        await fetchTaskStats();
        return { success: true };
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  // Select button and bulk delete functionality
  const handleShowCheckboxes = () => {
    setShowCheckboxes(true);
    setSelectedRows([]);
    setSelectAll(false);
  };

  const handleRowSelect = (taskId, checked) => {
    setSelectedRows(prev => 
      checked 
        ? [...prev, taskId] 
        : prev.filter(id => id !== taskId)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedRows(checked ? filteredTasks.map(task => task.id) : []);
  };

  const handleCancelSelection = () => {
    setSelectedRows([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} selected task(s)?`)) {
      return;
    }

    try {
      // Delete all selected tasks
      for (const taskId of selectedRows) {
        await handleDeleteTask(taskId);
      }
      
      // Reset selection state
      handleCancelSelection();
    } catch (error) {
      setError(`Failed to delete tasks: ${error.message}`);
    }
  };

  // Update select all checkbox based on selected rows
  useEffect(() => {
    if (filteredTasks.length > 0) {
      if (selectedRows.length === filteredTasks.length) {
        setSelectAll(true);
      } else {
        setSelectAll(false);
      }
    }
  }, [selectedRows, filteredTasks]);

  // Scroll-to-top button functionality
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Show scroll-to-top button when scrolled down 300px
      setShowScrollTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Optimized event handlers with duplicate prevention
  const handleFilterChange = useCallback((filterKey) => {
    setActiveFilter(filterKey);
  }, []);

  const handleAssignmentFilterChange = useCallback((filterValue) => {
    setAssignmentFilter(filterValue);
  }, []);

  const openCreateModal = useCallback(() => {
    // Prevent duplicate modal opening
    if (preventDuplicateModal || showCreateModal) return;
    
    setPreventDuplicateModal(true);
    // IMMEDIATE POPUP: Show create modal instantly
    setTaskForm({
      ...initialTaskForm,
      createdBy: currentUser
    });
    setFormError("");
    setShowCreateModal(true);
    
    // Reset prevention after a short delay
    setTimeout(() => setPreventDuplicateModal(false), 300);
  }, [currentUser, preventDuplicateModal, showCreateModal]);

  const closeCreateModal = useCallback(() => {
    // Prevent duplicate close operations
    if (!showCreateModal) return;
    
    setShowCreateModal(false);
    setTaskForm(initialTaskForm);
    setFormError("");
    setPreventDuplicateModal(false);
  }, [showCreateModal]);

  const handleCancelEdit = useCallback(() => {
    // Prevent duplicate close operations
    if (!editTask) return;
    
    // Immediately close the modal
    setEditTask(null);
    setModalLoading(false);
    
    // Use setTimeout to ensure state is fully cleared before allowing new clicks
    setTimeout(() => {
      setPreventDuplicateModal(false);
      setLastClickedTaskId(null);
    }, 100); // Small delay to ensure clean state
  }, [editTask]);

  // Immediate UI render - show main component immediately while data loads
  const renderMainComponent = () => {
    return (
      <>
        <style>{stickyHeaderStyles}</style>
        <div className="min-h-screen bg-black text-[#e4eaf5] py-10 px-4">
        <div className="max-w-none mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {/* Select Button Controls */}
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
            {/* Create Task Button - Positioned on the right side */}
            {(permissions.show || isSuperAdmin(getUserPermissions())) && (
              <button
                className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white text-xl font-bold px-7 py-2 rounded-2xl shadow-lg transition transform hover:scale-105 flex items-center gap-2"
                onClick={openCreateModal}
              >
                <Plus size={24} />
                Create Task
              </button>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-900 border border-red-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-red-200 mb-2">{error}</p>
                  {error.includes('404') && (
                    <p className="text-red-300 text-sm">
                      💡 <strong>Tip:</strong> If you're seeing 404 errors on existing tasks, try the "Force Refresh" button to reload all data from the server.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setError(null);
                      fetchTasks();
                      fetchTaskStats();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      setTasks([]); // Clear current data
                      setPagination(prev => ({ ...prev, page: 1 })); // Reset pagination
                      fetchTasks();
                      fetchTaskStats();
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
                    title="Clear cache and reload all data from server"
                  >
                    Force Refresh
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-300 hover:text-red-100 text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 mb-8 flex-wrap text-xl font-bold">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold border transition-all duration-200 ${activeFilter === f.key
                    ? "bg-[#08B8EA] text-white border-[#08B8EA] shadow-lg"
                    : "bg-white text-[#08B8EA] border-[#232a36] hover:bg-[#1a222e] hover:text-white"
                  }
                `}
              >
                <span>{f.label}</span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${f.count > 0
                      ? "bg-gray-800 text-white"
                      : "bg-[#232a36] text-[#08B8EA]"
                    }`}
                >
                  {f.count}
                </span>
              </button>
            ))}
            
            <div className="ml-auto flex items-center gap-4">
              {/* Assignment Filter Dropdown - Moved to left of search */}
              <div className="flex items-center">
                <select
                  value={assignmentFilter}
                  onChange={(e) => handleAssignmentFilterChange(e.target.value)}
                  className="px-4 py-2 rounded-full bg-white text-[#08B8EA] border border-[#08B8EA] font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-[#08B8EA]"
                >
                  <option value="all">All Tasks</option>
                  <option value="assigned_to_me">Tasks Assigned To Me</option>
                  <option value="assigned_by_me">Tasks Assigned By Me</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  className="rounded-full px-4 py-2 border border-[#08B8EA] bg-[#181e29] text-[#e4eaf5] font-medium focus:outline-none"
                  style={{ minWidth: 220 }}
                  placeholder="Search by name, subject, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Search className="text-[#08B8EA]" size={20} />
              </div>
            </div>
          </div>

          {/* Loading state overlay for when data is being fetched */}
          {loading && tasks.length === 0 && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08B8EA] mx-auto mb-4"></div>
                <p className="text-lg text-[#08B8EA]">Loading tasks...</p>
              </div>
            </div>
          )}

          {/* Table Section - Show immediately, populate with data when available */}
          {(!loading || tasks.length > 0) && (
            <div className="relative">
              {/* Horizontal scroll buttons - exactly from LeadCRM.jsx */}
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
                {/* Table with sticky header - matching LeadCRM.jsx */}
                <table className="min-w-[1600px] w-full bg-black relative">
                <thead 
                  className="bg-white sticky top-0 z-50 shadow-lg border-b-2 border-gray-200"
                >
                  <tr>
                    {/* Checkbox column header - only show when in selection mode */}
                    {(permissions.delete || isSuperAdmin(getUserPermissions())) && showCheckboxes && (
                      <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '60px' }}>
                        <input
                          type="checkbox"
                          className="accent-blue-500"
                          checked={selectAll}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          style={{ width: 18, height: 18 }}
                        />
                      </th>
                    )}
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '60px' }}>
                      #
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '200px' }}>
                      CREATED DATE & TIME
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '150px' }}>
                      CREATED BY
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '200px' }}>
                      SUBJECT
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '120px' }}>
                      STATUS
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '150px' }}>
                      ASSIGNED TO
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '250px' }}>
                      ASSOCIATED WITH RECORDS
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th" style={{ minWidth: '180px' }}>
                      DUE DATE AND TIME
                    </th>
                    <th className="py-1 px-4 text-lg font-extrabold text-[#03B0F5] text-left whitespace-nowrap sticky-th">
                      REPEAT TASK
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={(permissions.delete || isSuperAdmin(getUserPermissions())) && showCheckboxes ? 10 : 9}
                        className="bg-[#000] rounded-xl shadow p-8 text-center text-lg font-bold text-[#08B8EA]"
                      >
                        {loading ? 'Loading tasks...' : 'No Tasks Found'}
                      </td>
                    </tr>
                  ) : (
                    displayedTasks.map((task, idx) => (
                      <tr
                        key={`${task.id}-${task.renderKey || task.updated_at || 'static'}`}
                        className="border-b border-gray-800 bg-[#000] hover:bg-gray-800 transition cursor-pointer"
                        onClick={() => {
                          // DUPLICATE PREVENTION - Only block during active loading
                          if (preventDuplicateModal || modalLoading) {
                            return;
                          }
                          
                          // If a modal is already open, close it first
                          if (editTask) {
                            setEditTask(null);
                          }

                          // Clear any existing timeout
                          if (clickTimeout) {
                            clearTimeout(clickTimeout);
                          }

                          // Add safety check before calling handleRowClick
                          if (!task.id || typeof task.id !== 'string' || task.id.length < 12) {
                            alert('This task has an invalid ID and cannot be opened. Please refresh the page.');
                            return;
                          }
                          
                          // Set a short timeout to debounce rapid clicks
                          const timeout = setTimeout(() => {
                            handleRowClick(task);
                            setClickTimeout(null);
                          }, 50); // 50ms debounce
                          
                          setClickTimeout(timeout);
                        }}
                      >
                        {/* Checkbox column - only show when in selection mode */}
                        {(permissions.delete || isSuperAdmin(getUserPermissions())) && showCheckboxes && (
                          <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="accent-blue-500"
                              checked={selectedRows.includes(task.id)}
                              onChange={(e) => handleRowSelect(task.id, e.target.checked)}
                              style={{ width: 18, height: 18 }}
                            />
                          </td>
                        )}
                        <td className="text-md text-bold py-3 px-4 whitespace-nowrap text-left">
                          {idx + 1}
                        </td>
                        <td className="text-md py-3 px-4 whitespace-nowrap font-bold">
                          {task.createdTime}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap text-left">
                          {task.createdBy}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap text-left">
                          {task.subject}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap text-left">
                          {statusPill(task.status)}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap text-left">
                          {task.assign}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap">
                          {task.leadLogin} - {task.customerName}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap text-left">
                          {formatDateTime(`${task.date}T${task.time}`)}
                        </td>
                        <td className="text-md font-semibold py-3 px-4 whitespace-nowrap text-left">
                          {task.repeat_type || 'No'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Show More Button - Replaces Pagination */}
            {hasMoreTasks && (
              <div className="flex flex-col items-center justify-center mt-6 px-4 gap-3">
                <div className="text-sm text-gray-400">
                  Showing {displayedTasksCount} of {filteredTasks.length} tasks
                </div>
                <button
                  onClick={handleShowMore}
                  className="px-6 py-3 bg-gradient-to-r from-[#08B8EA] to-[#0693C7] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#08B8EA]/50 transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show More ({Math.min(tasksPerLoad, filteredTasks.length - displayedTasksCount)} more)
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
            </div>
          )}

          {/* Render EditTask in a modal popup when a task is selected - IMMEDIATE LOADING */}
          {editTask && (
            <div 
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent bg-opacity-50 p-4" 
              style={{ 
                backdropFilter: "blur(3px)",
                opacity: 1,
                transform: "scale(1)",
                transition: "none" // Remove transition for instant appearance
              }}
            >
              <Suspense fallback={
                <div className="bg-white rounded-lg p-8 text-center min-w-[400px] shadow-2xl animate-pulse">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#08B8EA] mx-auto mb-2"></div>
                  <p className="text-sm text-[#08B8EA]">Loading editor...</p>
                </div>
              }>
                <EditTask
                  key={`edit-task-${editTask.id}`} // Stable key based on task ID
                  taskData={editTask}
                  onClose={handleCancelEdit}
                  onSave={handleSaveTask}
                  onStatusChange={handleTaskStatusChange} // New callback for immediate status changes
                  currentUserId={currentUserId}
                  apiBaseUrl={API_BASE_URL}
                  // Pass lead info if available
                  preselectedLead={editTask.leadInfo || null}
                  // Pass associated records if available
                  associateWithRecords={editTask.associateWithRecords || []}
                  // Include history and comments
                  history={editTask.history || []}
                  comments={editTask.comments || []}
                  // Pass loading state to EditTask
                  isLoading={editTask.isLoading}
                  loadingError={editTask.loadingError}
                />
              </Suspense>
            </div>
          )}

          {/* Modal Popup for Create Task - IMMEDIATE LOADING */}
          {showCreateModal && (
            <div 
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent bg-opacity-50" 
              style={{ 
                backdropFilter: "blur(3px)",
                opacity: 1,
                transform: "scale(1)",
                transition: "none" // Remove transition for instant appearance
              }}
            >
              <div className="w-full max-w-2xl mx-auto">
                <Suspense fallback={
                  <div className="bg-white rounded-lg p-8 text-center min-w-[400px] shadow-2xl animate-pulse">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#08B8EA] mx-auto mb-2"></div>
                    <p className="text-sm text-[#08B8EA]">Loading creator...</p>
                  </div>
                }>
                  <CreateTask
                    onClose={closeCreateModal}
                    onSave={handleCreateTaskSave}
                  />
                </Suspense>
              </div>
            </div>
          )}
        </div>

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="fixed bottom-6 right-6 bg-[#08B8EA] hover:bg-[#12d8fa] text-white p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 z-50"
            title="Scroll to top"
          >
            <ChevronUp size={24} />
          </button>
        )}
      </div>
      </>
    );
  };

  // Early return for non-initialized state - show basic error/loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black text-[#e4eaf5] py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08B8EA] mx-auto mb-4"></div>
              <p className="text-lg text-[#08B8EA]">Initializing...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if critical error prevents rendering
  if (error && !isInitialized) {
    return (
      <div className="min-h-screen bg-black text-[#e4eaf5] py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-lg text-red-400 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setIsInitialized(false);
                  // Re-trigger initialization
                  window.location.reload();
                }}
                className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-4 py-2 rounded-lg"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render main component immediately when initialized
  return renderMainComponent();
}
