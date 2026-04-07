import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback, useRef } from "react";
import {
  CheckSquare, Plus, ChevronUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getUserPermissions, hasPermission, isSuperAdmin } from '../utils/permissions';
import { formatDate as formatDateUtil, formatDateTime, getISTDateYMD, toISTDateYMD, getISTTimestamp, getISTToday } from '../utils/dateUtils';
import useTabWithHistory from '../hooks/useTabWithHistory';
import useModalHistory from '../hooks/useModalHistory';

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
  // CSS styles matching task_creation.html design
  const taskPageStyles = `
    .task-page-container { padding: 20px 30px; max-width: 1600px; margin: 0 auto; }
    .task-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .task-btn-create { background-color: #00aaff; color: white; border: none; padding: 10px 24px; border-radius: 30px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(0, 170, 255, 0.3); transition: transform 0.2s, background-color 0.2s; }
    .task-btn-create:hover { transform: translateY(-1px); background-color: #0088cc; }
    .task-btn-select { background-color: #0077bb; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .task-btn-select:hover { opacity: 0.9; }

    .task-view-toggle-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .task-view-toggle-info { display: flex; align-items: center; gap: 8px; }
    .task-view-toggle-role { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: #1e293b; border-radius: 20px; }
    .task-view-toggle-role-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }
    .task-view-toggle-role-name { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
    .task-view-toggle-group { display: flex; background: #1a1a1a; border: 1px solid #333; border-radius: 30px; padding: 3px; gap: 2px; }
    .task-view-toggle-btn { padding: 6px 16px; border: none; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; background: transparent; color: #666; transition: all 0.2s; }
    .task-view-toggle-btn.active { background: #00aaff; color: #fff; box-shadow: 0 2px 8px rgba(0,170,255,0.3); }
    .task-view-toggle-btn:hover:not(.active) { color: #aaa; }

    .task-filters-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
    .task-status-pills { display: flex; gap: 12px; flex-wrap: wrap; }
    .task-pill { background-color: #ffffff; color: #00aaff; border-radius: 30px; padding: 6px 14px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border: none; transition: all 0.2s; }
    .task-pill .task-pill-count { background-color: #ececec; color: #555555; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; justify-content: center; align-items: center; font-size: 11px; font-weight: bold; transition: all 0.2s; }
    .task-pill.active { background-color: #00aaff; color: white; box-shadow: 0 3px 8px rgba(0, 170, 255, 0.3); }
    .task-pill.active .task-pill-count { background-color: white; color: #00aaff; }
    .task-search-area { display: flex; align-items: center; gap: 12px; }
    .task-filter-dropdown { padding: 8px 16px; border-radius: 20px; border: none; background-color: white; color: #00aaff; font-size: 13px; font-weight: 600; appearance: none; padding-right: 30px; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%2300aaff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; outline: none; }
    .task-search-box { position: relative; }
    .task-search-box input { background-color: transparent; border: 1px solid #444; border-radius: 20px; padding: 8px 16px 8px 36px; color: white; font-size: 13px; width: 280px; outline: none; transition: border-color 0.2s; }
    .task-search-box input:focus { border-color: #00aaff; }
    .task-search-box svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666; }

    .task-data-table-header { background-color: #ffffff; border-radius: 4px; display: flex; padding: 12px 15px; align-items: center; margin-bottom: 10px; }
    .task-th { color: #00aaff; font-weight: 800; font-size: 13px; text-transform: uppercase; text-align: left; flex: 1; }
    .task-th.number { flex: 0 0 40px; }
    .task-th.type { flex: 0 0 110px; }
    .task-th.created { flex: 1.2; }
    .task-th.subject { flex: 2; }
    .task-th.record { flex: 1.5; }
    .task-th.assigned { flex: 1.5; }
    .task-th.status { flex: 0 0 90px; }
    .task-th.date { flex: 1.2; }

    .task-data-table-body { display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
    .task-row { background-color: #1a1a1a; border: 1px solid #333; border-radius: 6px; display: flex; padding: 12px 15px; align-items: center; transition: background-color 0.2s, border-color 0.2s; animation: taskSlideIn 0.3s ease-out; cursor: pointer; }
    .task-row:hover { background-color: #222; border-color: #444; }
    .task-td { font-size: 13px; color: #ececec; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 10px; }
    .task-td.number { flex: 0 0 40px; color: #888; font-weight: bold; }
    .task-td.type { flex: 0 0 110px; }
    .task-td.created { flex: 1.2; }
    .task-td.subject { flex: 2; font-weight: 600; color: #fff; }
    .task-td.record { flex: 1.5; font-weight: 600; }
    .task-td.assigned { flex: 1.5; }
    .task-td.status { flex: 0 0 90px; }
    .task-td.date { flex: 1.2; }

    .task-type-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-callback { background-color: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); }
    .badge-pendency { background-color: rgba(243, 156, 18, 0.15); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.3); }
    .badge-todo { background-color: rgba(0, 170, 255, 0.15); color: #00aaff; border: 1px solid rgba(0, 170, 255, 0.3); }

    .task-status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: #fff; }
    .task-sts-pending { background-color: #555; }
    .task-sts-complete { background-color: #2ecc71; }
    .task-sts-failed { background-color: #ff4757; }
    .task-sts-inprogress { background-color: #f39c12; }
    .task-sts-cancelled { background-color: #e74c3c; }

    .task-created-meta-col, .task-due-meta-col { display: flex; flex-direction: column; gap: 2px; }
    .task-created-meta-name { font-weight: 600; color: #00aaff; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .task-created-meta-date { font-size: 11px; color: #888; }
    .task-due-meta-date { font-weight: 700; color: #fff; font-size: 12px; }
    .task-due-meta-time { font-size: 11px; color: #aaa; }
    .task-due-overdue { color: #ff6b81; }

    .task-empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; text-align: center; }
    .task-empty-state p { color: #00aaff; font-size: 18px; font-weight: 700; margin-bottom: 5px; }

    .task-tag-lead { background: rgba(0, 170, 255, 0.1); color: #00aaff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-right: 6px; }
    .task-tag-login { background: rgba(243, 156, 18, 0.1); color: #f39c12; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-right: 6px; }

    .task-record-name { color: #00aaff; font-weight: 700; cursor: pointer; }
    .task-record-name:hover { color: #0077bb; text-decoration: underline; }
    .task-record-number { color: #94a3b8; font-size: 11px; margin-left: 6px; }

    @keyframes taskSlideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

    .task-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
    .task-modal-container { background-color: #ffffff; width: 100%; max-width: 700px; max-height: 96vh; border-radius: 12px; position: relative; box-shadow: 0 15px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; border: 1px solid rgba(0,0,0,0.1); overflow: hidden; transform: scale(1); animation: taskModalIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes taskModalIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

    .task-select-controls { display: flex; align-items: center; gap: 10px; background: #111; border: 1px solid #333; border-radius: 8px; padding: 8px 14px; }
    .task-select-controls label { display: flex; align-items: center; cursor: pointer; color: #00aaff; font-weight: 700; font-size: 13px; gap: 6px; }
    .task-select-controls span { color: #fff; font-weight: 600; font-size: 12px; }
    .task-select-btn-del { padding: 4px 12px; background: #dc2626; color: #fff; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
    .task-select-btn-del:hover { background: #b91c1c; }
    .task-select-btn-cancel { padding: 4px 12px; background: #4b5563; color: #fff; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
    .task-select-btn-cancel:hover { background: #374151; }

    .task-show-more-btn { background: linear-gradient(135deg, #00aaff, #0088cc); color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0, 170, 255, 0.2); }
    .task-show-more-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0, 170, 255, 0.3); }

    .task-scroll-top-btn { position: fixed; bottom: 24px; right: 24px; background: #00aaff; color: white; border: none; padding: 12px; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 10px rgba(0,170,255,0.3); transition: all 0.2s; z-index: 50; }
    .task-scroll-top-btn:hover { background: #0088cc; transform: translateY(-2px); }

    .task-loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; }
    .task-loading-spinner .spinner { width: 40px; height: 40px; border: 3px solid transparent; border-top-color: #00aaff; border-radius: 50%; animation: taskSpin 0.8s linear infinite; margin-bottom: 12px; }
    @keyframes taskSpin { to { transform: rotate(360deg); } }

    .task-error-banner { margin-bottom: 20px; padding: 16px; background: #1a0000; border: 1px solid #ff4757; border-radius: 8px; }
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
  const [activeFilter, setActiveFilter] = useTabWithHistory('filter', 'due_today', { localStorageKey: 'taskActiveFilter' });
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
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
  
  // Browser back button closes task edit modal
  useModalHistory(!!editTask, () => {
    setEditTask(null);
    setModalLoading(false);
    setPreventDuplicateModal(false);
    setLastClickedTaskId(null);
  });
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
          date: task.due_date || getISTDateYMD(),
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

    const _ist = getISTToday();
    const today = new Date(_ist.year, _ist.month - 1, _ist.day);
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

    const _ist = getISTToday();
    const today = new Date(_ist.year, _ist.month - 1, _ist.day);
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // First, apply view filter (me/others/all) to get the base set of tasks
    let baseTasks = tasks;
    if (assignmentFilter !== 'all') {
      const currentUserLower = currentUser.toLowerCase().trim();
      
      baseTasks = tasks.filter((task) => {
        const assignedToColumn = (task.assign || '').toLowerCase();
        const createdByColumn = (task.createdBy || '').toLowerCase().trim();
        const isMyTask = assignedToColumn.includes(currentUserLower) || createdByColumn === currentUserLower;
        
        if (assignmentFilter === 'me') return isMyTask;
        if (assignmentFilter === 'others') return !isMyTask;
        // Legacy support
        if (assignmentFilter === 'assigned_to_me') {
          if (!assignedToColumn.trim() || assignedToColumn === 'unassigned') return false;
          return assignedToColumn.includes(currentUserLower);
        } else if (assignmentFilter === 'assigned_by_me') {
          return createdByColumn === currentUserLower && 
                 assignedToColumn !== 'unassigned' && 
                 assignedToColumn.trim() !== '';
        }
        return true;
      });
    }

    // Apply task type filter
    if (taskTypeFilter !== 'all') {
      baseTasks = baseTasks.filter(task => {
        const type = (task.typeTask || '').toLowerCase();
        if (taskTypeFilter === 'callback') return type === 'call' || type === 'callback';
        if (taskTypeFilter === 'pendency') return type === 'pendency';
        if (taskTypeFilter === 'todo') return type === 'to-do' || type === 'todo';
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
        const searchValid = (task.customerName || '').toLowerCase().includes(searchLower) ||
                          (task.subject || '').toLowerCase().includes(searchLower) ||
                          (task.status || '').toLowerCase().includes(searchLower) ||
                          (task.createdBy || '').toLowerCase().includes(searchLower);
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
  }, [tasks, taskStats, search, activeFilter, assignmentFilter, taskTypeFilter, currentUser]);

  // Memoized filters
  const FILTERS = useMemo(() => [
    { key: "due_today", label: "Due Today", count: safeCounts.dueToday },
    { key: "upcoming", label: "Upcoming", count: safeCounts.upcoming },
    { key: "overdue", label: "Overdue", count: safeCounts.overdue },
    { key: "completed", label: "Complete", count: safeCounts.completed },
    { key: "failed", label: "Failed", count: safeCounts.failed || 0 },
    { key: "all", label: "All Tasks", count: safeCounts.all, active: true },
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
  }, [activeFilter, assignmentFilter, taskTypeFilter, search]);

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
        created_at: attachment.created_at || getISTTimestamp(),
        // Add any missing properties that the editor might expect
        downloadUrl: `${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download?user_id=${currentUserId}`,
        isNew: false,
        isFromBackend: true,
        isImage: isImage,
        contentType: mimeType,
        uploadedAt: attachment.created_at || getISTTimestamp()
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
        date: task.date || getISTDateYMD(),
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
            date: fullTaskData.due_date || getISTDateYMD(),
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
    }
    
    // If a task was failed, immediately switch to Failed tab
    if (statusChangeInfo.shouldSwitchToFailedTab && statusChangeInfo.immediate) {
      setActiveFilter('failed');
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
          timestamp: getISTTimestamp()
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
              updated_at: getISTTimestamp(),
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
              updated_at: getISTTimestamp(),
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
            timestamp: getISTTimestamp()
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
        new_comment: updatedTask.newComment || '',
        // Include remark for status change history
        remark: updatedTask.remark || ''
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
              updated_at: getISTTimestamp(),
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
              updated_at: getISTTimestamp(),
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
          due_date: data.get('due_date') || getISTDateYMD(),
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
      const response = await fetchWithAuth(`${API_BASE_URL}/tasks/${taskId}?user_id=${currentUserId}`, {
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

  // Helpers for task type badge and status badge
  const getTaskTypeBadge = (typeTask) => {
    const type = (typeTask || '').toLowerCase();
    if (type === 'call' || type === 'callback') return { cls: 'task-type-badge badge-callback', label: '📞 Callback' };
    if (type === 'pendency') return { cls: 'task-type-badge badge-pendency', label: '⏳ Pendency' };
    if (type === 'to-do' || type === 'todo') return { cls: 'task-type-badge badge-todo', label: '📝 To-Do' };
    if (type === 'processing') return { cls: 'task-type-badge badge-pendency', label: '⚙️ Processing' };
    return { cls: 'task-type-badge badge-todo', label: typeTask || 'Task' };
  };

  const getStatusBadgeCls = (status) => {
    switch(status) {
      case 'Completed': return 'task-sts-complete';
      case 'Failed': case 'FAILED': return 'task-sts-failed';
      case 'In Progress': return 'task-sts-inprogress';
      case 'Cancelled': return 'task-sts-cancelled';
      default: return 'task-sts-pending';
    }
  };

  const formatDueDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const _ist = getISTToday();
      const todayDate = new Date(_ist.year, _ist.month - 1, _ist.day);
      todayDate.setHours(0,0,0,0);
      const taskDate = new Date(d);
      taskDate.setHours(0,0,0,0);
      if (taskDate.getTime() === todayDate.getTime()) return 'Today';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch { return dateStr; }
  };

  const formatCreatedShort = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  const isTaskOverdue = (task) => {
    if (task.status === 'Completed' || task.status === 'Cancelled' || task.status === 'Failed' || task.status === 'FAILED') return false;
    try {
      const _ist = getISTToday();
      const todayDate = new Date(_ist.year, _ist.month - 1, _ist.day);
      todayDate.setHours(0,0,0,0);
      const taskDate = new Date(task.date);
      taskDate.setHours(0,0,0,0);
      return taskDate.getTime() < todayDate.getTime();
    } catch { return false; }
  };

  // Get user role from localStorage
  const userRole = useMemo(() => {
    try {
      const ud = JSON.parse(localStorage.getItem('userData') || '{}');
      const role = ud.role_name || (typeof ud.role === 'string' ? ud.role : ud.role?.name) || 'Agent';
      return role;
    } catch { return 'Agent'; }
  }, []);

  const isAllFilter = activeFilter === 'all';

  // Immediate UI render - show main component immediately while data loads
  const renderMainComponent = () => {
    return (
      <>
        <style>{taskPageStyles}</style>
        <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
        <div className="task-page-container">

          {/* Top Bar */}
          <div className="task-top-bar" style={{ justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Select Button Controls */}
              {(permissions.delete || isSuperAdmin(getUserPermissions())) && (
                <>
                  {!showCheckboxes ? (
                    <button className="task-btn-select" onClick={handleShowCheckboxes}>
                      Select
                    </button>
                  ) : (
                    <div className="task-select-controls">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: '#00aaff' }}
                        />
                        Select All
                      </label>
                      <span>{selectedRows.length} row{selectedRows.length !== 1 ? 's' : ''} selected</span>
                      <button className="task-select-btn-del" onClick={handleDeleteSelected} disabled={selectedRows.length === 0}>
                        Delete ({selectedRows.length})
                      </button>
                      <button className="task-select-btn-cancel" onClick={handleCancelSelection}>
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {(permissions.show || isSuperAdmin(getUserPermissions())) && (
                <button className="task-btn-create" onClick={openCreateModal}>
                  <Plus size={18} />
                  Create Task
                </button>
              )}
            </div>
          </div>

          {/* View Toggle Bar */}
          <div className="task-view-toggle-bar">
            <div className="task-view-toggle-group">
              {[
                { key: 'me', label: '👤 My' },
                { key: 'others', label: '👥 Others' },
                { key: 'all', label: '📋 All' }
              ].map(v => (
                <button
                  key={v.key}
                  className={`task-view-toggle-btn${assignmentFilter === v.key ? ' active' : ''}`}
                  onClick={() => handleAssignmentFilterChange(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="task-error-banner">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ color: '#ff6b6b', flex: 1 }}>{error}</p>
                <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                  <button onClick={() => { setError(null); fetchTasks(); }} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
                  <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff6b6b', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>×</button>
                </div>
              </div>
            </div>
          )}

          {/* Filters Section */}
          <div className="task-filters-section">
            <div className="task-status-pills">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`task-pill${activeFilter === f.key ? ' active' : ''}`}
                  onClick={() => handleFilterChange(f.key)}
                >
                  {f.label} <span className="task-pill-count">{f.count}</span>
                </button>
              ))}
            </div>
            <div className="task-search-area">
              <select
                className="task-filter-dropdown"
                value={taskTypeFilter}
                onChange={(e) => setTaskTypeFilter(e.target.value)}
              >
                <option value="all">All Task Types</option>
                <option value="callback">Callback</option>
                <option value="pendency">Pendency</option>
                <option value="todo">To-Do</option>
              </select>
              <div className="task-search-box">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && tasks.length === 0 && (
            <div className="task-loading-spinner">
              <div className="spinner" />
              <p style={{ color: '#00aaff', fontSize: 16, fontWeight: 700 }}>Loading tasks...</p>
            </div>
          )}

          {/* Data Table */}
          {(!loading || tasks.length > 0) && (
            <div style={{ position: 'relative' }}>
              {/* Table Header */}
              <div className="task-data-table-header">
                {showCheckboxes && (
                  <div className="task-th" style={{ flex: '0 0 36px' }}>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#00aaff' }}
                    />
                  </div>
                )}
                <div className="task-th number">#</div>
                <div className="task-th type">TYPE</div>
                <div className="task-th created">CREATED INFO</div>
                <div className="task-th subject">OBJECTIVE / SUBJECT</div>
                <div className="task-th record">RECORD/LEAD</div>
                <div className="task-th assigned">ASSIGNED TO</div>
                {isAllFilter && <div className="task-th status">STATUS</div>}
                <div className="task-th date">DUE DATE & TIME</div>
              </div>

              {/* Table Body */}
              <div className="task-data-table-body">
                {displayedTasks.length === 0 ? (
                  <div className="task-empty-state">
                    <p>{loading ? 'Loading tasks...' : 'No Tasks Found'}</p>
                  </div>
                ) : (
                  displayedTasks.map((task, idx) => {
                    const badge = getTaskTypeBadge(task.typeTask);
                    const overdue = isTaskOverdue(task);
                    const recordDisplay = (task.leadLogin && task.leadLogin !== 'N/A')
                      ? task.customerName || task.leadLogin
                      : '-';

                    return (
                      <div
                        key={`${task.id}-${task.renderKey || task.updated_at || 'static'}`}
                        className="task-row"
                        onClick={() => {
                          if (preventDuplicateModal || modalLoading) return;
                          if (editTask) setEditTask(null);
                          if (clickTimeout) clearTimeout(clickTimeout);
                          if (!task.id || typeof task.id !== 'string' || task.id.length < 12) {
                            alert('This task has an invalid ID and cannot be opened. Please refresh the page.');
                            return;
                          }
                          const timeout = setTimeout(() => { handleRowClick(task); setClickTimeout(null); }, 50);
                          setClickTimeout(timeout);
                        }}
                      >
                        {/* Checkbox */}
                        {showCheckboxes && (
                          <div className="task-td" style={{ flex: '0 0 36px' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedRows.includes(task.id)}
                              onChange={(e) => handleRowSelect(task.id, e.target.checked)}
                              style={{ width: 16, height: 16, accentColor: '#00aaff' }}
                            />
                          </div>
                        )}

                        {/* # */}
                        <div className="task-td number">{idx + 1}</div>

                        {/* TYPE */}
                        <div className="task-td type">
                          <span className={badge.cls}>{badge.label}</span>
                        </div>

                        {/* CREATED INFO */}
                        <div className="task-td created">
                          <div className="task-created-meta-col">
                            <span className="task-created-meta-name">{task.createdBy}</span>
                            <span className="task-created-meta-date">{formatCreatedShort(task.created_at)}</span>
                          </div>
                        </div>

                        {/* SUBJECT */}
                        <div className="task-td subject">{task.subject}</div>

                        {/* RECORD/LEAD */}
                        <div className="task-td record">
                          {recordDisplay !== '-' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                              <span className="task-tag-lead">Lead</span>
                              <span className="task-record-name">{task.customerName || 'Unknown'}</span>
                              {task.leadLogin && task.leadLogin !== 'N/A' && (
                                <span className="task-record-number">{task.leadLogin}</span>
                              )}
                            </span>
                          ) : '-'}
                        </div>

                        {/* ASSIGNED TO */}
                        <div className="task-td assigned" style={{ whiteSpace: 'normal', lineHeight: 1.6 }}>
                          {(task.assign || 'Unassigned').split(',').map((name, i) => (
                            <span key={i} style={{ display: 'block', fontSize: 11 }}>👤 {name.trim()}</span>
                          ))}
                        </div>

                        {/* STATUS (only on All filter) */}
                        {isAllFilter && (
                          <div className="task-td status">
                            <span className={`task-status-badge ${getStatusBadgeCls(task.status)}`}>
                              {task.status === 'FAILED' ? 'Failed' : task.status}
                            </span>
                          </div>
                        )}

                        {/* DUE DATE & TIME */}
                        <div className="task-td date">
                          <div className="task-due-meta-col">
                            <span className={`task-due-meta-date${overdue ? ' task-due-overdue' : ''}`}>
                              {formatDueDisplay(task.date)}
                            </span>
                            <span className="task-due-meta-time">{formatTime(task.time)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Show More Button */}
              {hasMoreTasks && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    Showing {displayedTasksCount} of {filteredTasks.length} tasks
                  </span>
                  <button className="task-show-more-btn" onClick={handleShowMore}>
                    ▼ Show More ({Math.min(tasksPerLoad, filteredTasks.length - displayedTasksCount)} more) ▼
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Render EditTask in a modal popup */}
          {editTask && (
            <Suspense fallback={
              <div className="task-modal-overlay">
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="task-loading-spinner"><div className="spinner" /></div>
                  <p style={{ color: '#00aaff', fontSize: 13 }}>Loading editor...</p>
                </div>
              </div>
            }>
              <EditTask
                key={`edit-task-${editTask.id}`}
                taskData={editTask}
                onClose={handleCancelEdit}
                onSave={handleSaveTask}
                onStatusChange={handleTaskStatusChange}
                currentUserId={currentUserId}
                apiBaseUrl={API_BASE_URL}
                preselectedLead={editTask.leadInfo || null}
                associateWithRecords={editTask.associateWithRecords || []}
                history={editTask.history || []}
                comments={editTask.comments || []}
                isLoading={editTask.isLoading}
                loadingError={editTask.loadingError}
              />
            </Suspense>
          )}

          {/* Modal Popup for Create Task */}
          {showCreateModal && (
            <Suspense fallback={
              <div className="task-modal-overlay">
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="task-loading-spinner"><div className="spinner" /></div>
                  <p style={{ color: '#00aaff', fontSize: 13 }}>Loading creator...</p>
                </div>
              </div>
            }>
              <CreateTask
                onClose={closeCreateModal}
                onSave={handleCreateTaskSave}
              />
            </Suspense>
          )}

        </div>

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            className="task-scroll-top-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
      <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <style>{taskPageStyles}</style>
          <div className="task-loading-spinner"><div className="spinner" /></div>
          <p style={{ color: '#00aaff', fontSize: 16, fontWeight: 700 }}>Initializing...</p>
        </div>
      </div>
    );
  }

  // Show error state if critical error prevents rendering
  if (error && !isInitialized) {
    return (
      <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ff6b81', fontSize: 16, marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsInitialized(false);
              window.location.reload();
            }}
            style={{ background: '#00aaff', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 30, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render main component immediately when initialized
  return renderMainComponent();
}
