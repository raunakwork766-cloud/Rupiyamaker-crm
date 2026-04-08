import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ClockTimePicker from "./ClockTimePicker";
import API from '../services/api';
import { toast } from 'react-toastify';
import { API_BASE_URL, buildApiUrl, buildMediaUrl } from '../config/api';
import { formatDate, formatDateTime } from '../utils/dateUtils';

// Helper functions for date options
function getTodayDate() {
  return formatDate(new Date());
}

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
}

// AssignPopup component for assigning tasks to users
function AssignPopup({ onClose, onSelect }) {
  const [assigneeName, setAssigneeName] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        // ⚡ FIX: Use tasks API endpoint that returns ALL users without hierarchical filtering
        // This allows employees to assign tasks to anyone, not just themselves
        const response = await API.tasks.getUsersForAssignment();

        // Handle the response structure from /tasks/users-for-assignment
        let usersList = [];
        if (response && response.users && Array.isArray(response.users)) {
          usersList = response.users.map(user => ({
            id: user.user_id || user.id,
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            designation: user.role || user.designation || '',
            employee_status: user.employee_status,
            is_active: user.is_active
          }));
        }

        // Filter out entries with empty names and inactive employees
        setUsers(usersList.filter(user => 
          user.name && 
          (user.employee_status === 'active' || user.is_active === true || user.employee_status === undefined)
        ));
      } catch (error) {
        console.error("Failed to fetch users from API.tasks.getUsersForAssignment():", error);
        // Use empty array as fallback
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const [filteredAssignees, setFilteredAssignees] = useState([]);

  useEffect(() => {
    // If assigneeName is empty, show all users
    if (assigneeName.trim() === "") {
      setFilteredAssignees(users);
    } else {
      // Otherwise, filter based on input (searching in name property)
      setFilteredAssignees(
        users.filter((user) =>
          user.name.toLowerCase().includes(assigneeName.toLowerCase())
        )
      );
    }
  }, [assigneeName, users]); // Depend on assigneeName and users to re-filter

  const handleAssign = () => {
    if (assigneeName) {
      // Find the user with matching name
      const selectedUser = users.find(user => user.name.toLowerCase() === assigneeName.toLowerCase());
      if (selectedUser) {
        // Pass complete user object to parent
        onSelect({
          id: selectedUser.id,
          name: selectedUser.name,
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          designation: selectedUser.designation,
          email: selectedUser.email
        });
      } else {
        // If no exact match, just pass the name as entered by user
        onSelect({ name: assigneeName });
      }
    }
    // Clear the input after assigning
    setAssigneeName("");
    onClose(); // Close the popup after assigning
  };

  const selectAssignee = (selectedUser) => {
    // Pass both id and name to parent
    onSelect(selectedUser);
    onClose(); // Close the popup
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent">
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[90%] max-w-5xl mx-auto relative">
        <div className="flex items-center mb-4 bg-white bg-opacity-90 p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-bold text-lg text-black">Assign Task</h3>
        </div>

        <div className="mb-4 bg-white bg-opacity-90 p-3 rounded-md">
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
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Search or enter assignee name"
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

        {/* Show loading or the list */}
        {isLoading ? (
          <div className="text-center p-4 bg-white bg-opacity-90 rounded-lg">
            Loading users...
          </div>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90">
            {filteredAssignees.length > 0 ? (
              filteredAssignees.map((user) => {
                const displayName = user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}`.trim()
                  : user.name;
                
                const initials = displayName.split(' ')
                  .map(part => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <li
                    key={user.id}
                    className="p-3 border-b last:border-b-0 cursor-pointer text-black transition hover:bg-gray-100 flex items-center"
                    onClick={() => selectAssignee(user)}
                  >
                    {/* Profile icon with initials */}
                    <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3 flex-shrink-0 text-sm font-medium">
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{displayName}</span>
                      {user.designation && (
                        <span className="text-xs text-gray-600">{user.designation}</span>
                      )}
                    </div>
                  </li>
                );
              })
            ) : (
              assigneeName.trim() !== "" ? (
                <li className="p-3 text-gray-500 text-center">No matching assignees found.</li>
              ) : null
            )}
          </ul>
        )}

        <div className="flex justify-end gap-4 mt-4 bg-white bg-opacity-90 p-3 rounded-b-xl">
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

function getCurrentDateTimeString() {
  return formatDateTime(new Date());
}

export default function EditTask({ 
  taskData: initialTask, 
  onSave, 
  onClose, 
  currentUserId, 
  apiBaseUrl = API_BASE_URL,
  onStatusChange // New prop for immediate status change notifications
}) {
  // Early return if no initialTask and no onClose callback
  if (!initialTask && !onClose) {
    console.error("EditTask component requires either an initialTask or an onClose callback");
    return null;
  }
  
  // Use the apiBaseUrl prop or fallback to imported API_BASE_URL
  const BASE_URL = apiBaseUrl;

  // Restructure backend task data to fit UI format
  const formatTaskForUI = (backendTask) => {
    // Handle case where backendTask is null, undefined, or not an object
    if (!backendTask || typeof backendTask !== 'object') {
      console.warn("Invalid or missing backend task data:", backendTask);
      return {
        id: '',
        createdBy: "Unknown",
        status: "PENDING",
        title: "",
        description: "",
        assign: "Unassigned",
        assigned_users: [],
        assignedTo: [],
        priority: "medium",
        dueDate: "",
        dueDateOption: "today",
        dueTime: "08:00 AM",
        customDate: null,
        repeatOption: "none",
        repeatCustomDays: [],
        created_by: "",
        comments: [],
        attachments: [],
        removedAttachments: [],
        newAttachments: [],
        newComment: "",
        showAttachments: false,
        associateWithRecords: [], // Initialize empty associate records
        // Lead association fields
        lead_id: null,
        loan_type: null,
        lead_name: null
      };
    }

    console.log("Backend task data:", backendTask);
    console.log("Backend attachments:", backendTask?.attachments);
    console.log("Backend attachments type:", typeof backendTask?.attachments);
    console.log("Backend attachments length:", backendTask?.attachments?.length);

    // Check if this is already transformed data from Task.jsx (has both id and subject fields)
    const isTransformedData = backendTask.id && backendTask.subject;
    
    if (isTransformedData) {
      // Handle data that's already been transformed by Task.jsx
      // Ensure status is uppercase and handle "Failed" status properly
      let taskStatus = backendTask.status?.toUpperCase() || "PENDING";
      
      // If backend status is "Failed" (with capital F), convert to "FAILED"
      if (backendTask.status === "Failed" || backendTask.status === "FAILED") {
        taskStatus = "FAILED";
      }
      
      // CRITICAL: Check for hidden [SYSTEM_FAILED_TASK] marker in notes
      // This handles case where backend returns "Cancelled" but task is actually Failed
      const taskNotes = backendTask.notes || backendTask.message || backendTask.task_details || "";
      if (taskNotes.includes('[SYSTEM_FAILED_TASK]')) {
        taskStatus = "FAILED";
      }
      
      return {
        id: backendTask.id,
        createdBy: backendTask.createdBy || backendTask.creator_name || "Unknown",
        status: taskStatus,
        title: backendTask.subject || "",
        description: backendTask.message || backendTask.task_details || "",
        assign: backendTask.assign || "Unassigned",
        assigned_users: backendTask.assigned_to || [],
        assignedTo: Array.isArray(backendTask.assigned_users) 
          ? backendTask.assigned_users.map(user => ({
              id: user.user_id || user.id,
              name: user.name
            }))
          : [],
        priority: backendTask.priority || "medium",
        dueDate: backendTask.date || backendTask.due_date || "",
        dueDateOption: "custom",
        dueTime: "08:00 AM",
        customDate: null,
        repeatOption: "none",
        repeatCustomDays: [],
        created_by: backendTask.created_by || "",
        comments: [],
        attachments: Array.isArray(backendTask.attachments) 
          ? backendTask.attachments.map(attachment => {
              console.log("Processing backend attachment:", attachment);
              // Use direct file path via media mount point for better compatibility
              let fileUrl = '';
              
              if (attachment.file_path) {
                // Clean up the file path to avoid double media/tasks
                let cleanPath = attachment.file_path;
                
                // Remove any leading slashes to normalize the path
                cleanPath = cleanPath.replace(/^\/+/, '');
                
                // Check if the path already contains media/tasks to avoid duplication
                if (cleanPath.startsWith('media/tasks/')) {
                  // Path already has full media/tasks prefix
                  fileUrl = `${BASE_URL}/${cleanPath}`;
                } else if (cleanPath.startsWith('media/')) {
                  // Path starts with media/ but not full media/tasks/
                  fileUrl = `${BASE_URL}/${cleanPath}`;
                } else {
                  // Path doesn't have media prefix - add full media/tasks/
                  fileUrl = `${BASE_URL}/media/tasks/${cleanPath}`;
                }
              } else if (attachment.url) {
                // Use URL if provided
                if (attachment.url.startsWith('http')) {
                  fileUrl = attachment.url;
                } else {
                  fileUrl = `${BASE_URL}${attachment.url}`;
                }
              } else {
                // Fallback: try attachment download endpoint
                const attachmentId = attachment.attachment_id || attachment.id || attachment._id;
                if (attachmentId && backendTask.id) {
                  fileUrl = `${BASE_URL}/tasks/${backendTask.id}/attachments/${attachmentId}/download`;
                }
              }
              
              console.log("Original file_path:", attachment.file_path);
              console.log("Constructed fileUrl:", fileUrl);

              const processedAttachment = {
                id: attachment.attachment_id || attachment.id || `backend_${Math.random().toString(36).substr(2, 9)}`,
                name: attachment.filename || attachment.name || 'Unknown File',
                url: fileUrl,
                isFromBackend: true,
                size: attachment.file_size || attachment.size,
                mimeType: attachment.mime_type || attachment.type
              };
              
              console.log("Processed attachment:", processedAttachment);
              return processedAttachment;
            })
          : [],
        removedAttachments: [],
        newAttachments: [],
        newComment: "",
        showAttachments: backendTask.attachments && Array.isArray(backendTask.attachments) && backendTask.attachments.length > 0,
        associateWithRecords: [], // Initialize empty associate records
        // Preserve lead association fields
        lead_id: backendTask.lead_id || null,
        loan_type: backendTask.loan_type || null,
        lead_name: backendTask.lead_name || backendTask.customer_name || null
      };
    }

    // Handle raw backend data (original logic)
    // CRITICAL: Check for hidden [SYSTEM_FAILED_TASK] marker in notes/task_details
    let taskStatus = backendTask.status?.toUpperCase() || "PENDING";
    const notes = backendTask.notes || backendTask.task_details || "";
    if (notes.includes('[SYSTEM_FAILED_TASK]')) {
      taskStatus = "FAILED";
    }
    
    return {
      id: backendTask._id || backendTask.id || '',
      createdBy: backendTask.created_by_name || "Unknown",
      status: taskStatus,
      title: backendTask.title || "",
      description: backendTask.description || "",
      assign: Array.isArray(backendTask.assigned_users_details) && backendTask.assigned_users_details.length > 0
        ? backendTask.assigned_users_details.map(user => user.name).join(", ")
        : "Unassigned",
      // For internal use
      assigned_users: backendTask.assigned_users || [],
      assignedTo: Array.isArray(backendTask.assigned_users_details)
        ? backendTask.assigned_users_details.map(user => ({
          id: user.user_id || user._id || user.id,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          designation: user.role || user.designation || '',
          email: user.email || ''
        }))
        : [],
      priority: backendTask.priority || "medium",
      dueDate: backendTask.due_date || "",
      dueDateOption: "custom",
      dueTime: "08:00 AM",
      customDate: null,
      repeatOption: "none",
      repeatCustomDays: [],
      created_by: backendTask.created_by || "",
      // For comments and attachments
      comments: backendTask.comments && Array.isArray(backendTask.comments)
        ? backendTask.comments.map(comment => ({
          id: comment.id,
          user: comment.created_by_name || "Unknown",
          text: comment.content,
          time: new Date(comment.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }))
        : [],
      attachments: backendTask.attachments && Array.isArray(backendTask.attachments)
        ? backendTask.attachments.map(attachment => {
          console.log("Processing attachment in raw backend mode:", attachment);

          // Use direct file path via media mount point for better compatibility
          let fileUrl = '';
          
          try {
            if (attachment.file_path) {
              // Clean up the file path to avoid double media/tasks
              let cleanPath = attachment.file_path;
              
              if (cleanPath.startsWith('/')) {
                // Absolute path - use as is with API base
                fileUrl = `${API_BASE_URL}${cleanPath}`;
              } else if (cleanPath.startsWith('media/')) {
                // Already starts with media/ - just prepend API base and slash
                fileUrl = `${API_BASE_URL}/${cleanPath}`;
              } else {
                // Relative path without media/ prefix - add it
                fileUrl = `${API_BASE_URL}/media/tasks/${cleanPath}`;
              }
            } else if (attachment.url) {
              // Use URL if provided
              if (attachment.url.startsWith('http')) {
                fileUrl = attachment.url;
              } else {
                fileUrl = `${API_BASE_URL}${attachment.url}`;
              }
            } else {
              // Fallback: try attachment download endpoint
              const attachmentId = attachment.attachment_id || attachment.id || attachment._id;
              if (attachmentId && (backendTask._id || backendTask.id)) {
                const taskId = backendTask._id || backendTask.id;
                fileUrl = `${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download`;
              }
            }
            
            console.log("Original file_path:", attachment.file_path);
            console.log("Constructed fileUrl:", fileUrl);
          } catch (urlError) {
            console.warn("Error constructing file URL for attachment:", attachment, urlError);
            fileUrl = ''; // Set empty URL on error
          }

          console.log("Constructed file URL:", fileUrl);

          const processedAttachment = {
            id: attachment.attachment_id || attachment.id || `backend_${Math.random().toString(36).substr(2, 9)}`,
            name: attachment.filename || attachment.name || 'Unknown File',
            url: fileUrl,
            isFromBackend: true,
            size: attachment.file_size || attachment.size,
            mimeType: attachment.mime_type || attachment.type,
            uploadedBy: attachment.uploaded_by,
            uploadedAt: attachment.uploaded_at,
            hasError: !fileUrl // Mark if URL construction failed
          };
          
          console.log("Processed attachment in raw backend mode:", processedAttachment);
          return processedAttachment;
        }).filter(attachment => attachment.name && attachment.name !== 'Unknown File') // Filter out invalid attachments
        : [],
      removedAttachments: [],
      newAttachments: [],
      newComment: "",
      showAttachments: backendTask.attachments && Array.isArray(backendTask.attachments) && backendTask.attachments.length > 0,
      associateWithRecords: [], // Initialize empty associate records
      // Preserve lead association fields
      lead_id: backendTask.lead_id || null,
      loan_type: backendTask.loan_type || null,
      lead_name: backendTask.lead_name || backendTask.lead_info?.customer_name || null
    };
  };

  const [task, setTask] = useState(() => {
    // Add safety check for initialTask
    console.log("EditTask - Received initialTask:", initialTask);
    if (!initialTask) {
      console.warn("No initial task provided to EditTask component");
      return formatTaskForUI(null);
    }
    const formattedTask = formatTaskForUI(initialTask);
    console.log("EditTask - Formatted task:", formattedTask);
    console.log("EditTask - Task ID:", formattedTask.id);
    console.log("EditTask - Task attachments:", formattedTask.attachments);
    console.log("EditTask - Backend attachments count:", formattedTask.attachments?.filter(a => a.isFromBackend)?.length || 0);
    return formattedTask;
  });
  const [isOpen, setIsOpen] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState(getCurrentDateTimeString());
  const [showComments, setShowComments] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activityFilter, setActivityFilter] = useState('all'); // Filter for history activities

  // Remark modal state (for Complete / Failed / Reopen actions)
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [remarkType, setRemarkType] = useState(''); // 'complete' | 'fail' | 'reopen'
  const [remarkText, setRemarkText] = useState('');
  const [remarkError, setRemarkError] = useState(false);

  // State for API data (similar to CreateTask)
  const [users, setUsers] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showAssociatePopup, setShowAssociatePopup] = useState(false);

  // Inline lead search dropdown state
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState([]);
  const [loadingLeadSearch, setLoadingLeadSearch] = useState(false);
  const leadDropdownRef = useRef(null);
  const leadSearchTimerRef = useRef(null);

  // Date picker related state (similar to CreateTask)
  const [showCalendar, setShowCalendar] = useState(false);
  const [showClockTimePicker, setShowClockTimePicker] = useState(false);
  const [showDaysSelector, setShowDaysSelector] = useState(false);
  const [calendarPosition, setCalendarPosition] = useState('below'); // 'below' or 'above'
  
  // Ref for the due date select element to calculate positioning
  const dueDateSelectRef = useRef(null);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored");
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Connection lost. Please check your internet.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const messageRef = useRef(null);
  const lastSavedRef = useRef(null); // Track last saved state for auto-save change detection
  const autoSaveTimerRef = useRef(null);
  const modalRef = useRef(null);
  
  // Calculate calendar position when it's shown
  useEffect(() => {
    if (showCalendar && dueDateSelectRef.current) {
      const selectElement = dueDateSelectRef.current;
      const rect = selectElement.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If there's less than 400px below and more space above, show calendar above
      if (spaceBelow < 400 && spaceAbove > spaceBelow) {
        setCalendarPosition('above');
      } else {
        setCalendarPosition('below');
      }
    }
  }, [showCalendar]);

  // Get userId from localStorage (similar to CreateTask)
  const getUserId = () => {
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
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  // Fetch users for assignment (similar to CreateTask)
  const fetchUsers = async () => {
    const userId = getUserId();
    if (!userId) {
      console.warn('No user ID available for fetching users');
      return;
    }
    
    setLoadingUsers(true);
    try {
      console.log('Fetching users for task assignment in EditTask...');
      const response = await fetch(`${BASE_URL}/tasks/users-for-assignment?user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Users API response in EditTask:', data);
      
      // Handle the response structure: { users: [...] }
      if (data && data.users && Array.isArray(data.users)) {
        const usersList = data.users.map(user => ({
          id: user.user_id || user._id || user.id,
          name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email || '',
          role: user.role || ''
        }));
        
        const validUsers = usersList.filter(user => user.name && user.id);
        console.log('Processed users for assignment in EditTask:', validUsers);
        setUsers(validUsers);
      } else if (data && Array.isArray(data)) {
        const usersList = data.map(user => ({
          id: user.user_id || user._id || user.id,
          name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email || '',
          role: user.role || ''
        }));
        
        const validUsers = usersList.filter(user => user.name && user.id);
        setUsers(validUsers);
      } else {
        console.warn('Unexpected API response format in EditTask:', data);
        setUsers([]);
      }
    } catch (error) {
      console.warn('Error fetching users in EditTask (non-critical):', error.message);
      // Set empty array instead of showing error
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch loan types (similar to CreateTask)
  const fetchLoanTypes = async () => {
    const userId = getUserId();
    if (!userId) {
      console.warn('No user ID available for fetching loan types');
      return;
    }
    
    setLoadingLoanTypes(true);
    try {
      console.log('Fetching loan types in EditTask...');
      const response = await fetch(`${BASE_URL}/tasks/loan-types-with-leads?user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Loan types API response in EditTask:', data);
      
      const loanTypesData = data.loan_types || [];
      setLoanTypes(loanTypesData);
      console.log('Loan types set in EditTask:', loanTypesData.length, 'types');
    } catch (error) {
      console.warn('Error fetching loan types in EditTask (non-critical):', error.message);
      // Set empty array instead of showing error
      setLoanTypes([]);
    } finally {
      setLoadingLoanTypes(false);
    }
  };

  // Fetch leads based on loan type (similar to CreateTask)
  const fetchLeads = async (loanType, recordType = 'leads') => {
    const userId = getUserId();
    if (!userId || !loanType) return;
    
    setLoadingLeads(true);
    try {
      console.log(`Fetching ${recordType} for loan type "${loanType}" in EditTask...`);
      // Use the same endpoint as CreateTask that filters by record type (leads or login)
      const response = await fetch(`${BASE_URL}/tasks/leads-logins-by-type?loan_type=${encodeURIComponent(loanType)}&record_type=${encodeURIComponent(recordType)}&user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log(`${recordType} API response in EditTask:`, data);
      
      const leadsData = data.leads || [];
      setLeads(leadsData);
      console.log(`${recordType} set in EditTask:`, leadsData.length, 'records');
    } catch (error) {
      console.error(`Error fetching ${recordType} in EditTask:`, error);
      toast.error(`Failed to load ${recordType}`);
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Effect to update task when initialTask prop changes
  useEffect(() => {
    if (initialTask) {
      console.log("EditTask - initialTask changed, updating task state:", initialTask);
      const formattedTask = formatTaskForUI(initialTask);
      console.log("EditTask - Newly formatted task:", formattedTask);
      console.log("EditTask - Newly formatted task attachments:", formattedTask.attachments);
      
      // Populate assignee details if only IDs are available
      populateAssigneeDetails(formattedTask, initialTask);
      
      // Keep comments open but reset history when new task is loaded
      setShowHistory(false);
    }
  }, [initialTask]);
  
  // Function to populate assignee details from user IDs
  const populateAssigneeDetails = async (formattedTask, backendTask) => {
    try {
      // Check if assignedTo is empty but we have assigned_to IDs
      if ((!formattedTask.assignedTo || formattedTask.assignedTo.length === 0) && 
          backendTask.assigned_to && Array.isArray(backendTask.assigned_to) && 
          backendTask.assigned_to.length > 0) {
        
        console.log("EditTask - Found assigned_to IDs without details, fetching user info:", backendTask.assigned_to);
        
        // Fetch all users to match against the IDs
        const response = await API.tasks.getUsersForAssignment();
        
        if (response && response.users && Array.isArray(response.users)) {
          const allUsers = response.users.map(user => ({
            id: user.user_id || user.id,
            user_id: user.user_id || user.id,
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            designation: user.role || user.designation || ''
          }));
          
          // Match assigned_to IDs with user details
          const assignedUsers = backendTask.assigned_to
            .map(userId => {
              // Find user by matching various ID formats
              const user = allUsers.find(u => 
                u.id === userId || 
                u.user_id === userId || 
                String(u.id) === String(userId) ||
                String(u.user_id) === String(userId)
              );
              return user;
            })
            .filter(user => user !== undefined); // Remove any unmatched IDs
          
          console.log("EditTask - Matched assignees:", assignedUsers);
          
          // Update the task with populated assignee details
          setTask(prev => ({
            ...prev,
            assignedTo: assignedUsers,
            assign: assignedUsers.length > 0 
              ? assignedUsers.map(u => u.name).join(", ")
              : "Unassigned"
          }));
        } else {
          // If fetching users failed, just set the task as is
          setTask(formattedTask);
        }
      } else {
        // Assignees already populated or no assigned_to data
        setTask(formattedTask);
      }
    } catch (error) {
      console.error("EditTask - Error populating assignee details:", error);
      // On error, just use the formatted task as is
      setTask(formattedTask);
    }
  };

  // Debug effect to track task state changes
  useEffect(() => {
    console.log("EditTask - Task state changed:", {
      id: task.id,
      title: task.title,
      attachmentsCount: task.attachments?.length || 0,
      backendAttachmentsCount: task.attachments?.filter(a => a.isFromBackend)?.length || 0,
      newAttachmentsCount: task.newAttachments?.length || 0,
      attachments: task.attachments
    });
  }, [task]);

  // Function to load comments from API
  const loadComments = async () => {
    if (!task.id || isLoadingComments) return;
    
    setIsLoadingComments(true);
    try {
      const response = await API.tasks.getComments(task.id);

      // Update task with fresh comments from API
      setTask(prev => ({
        ...prev,
        comments: response.comments ? response.comments.map(comment => ({
          id: comment.id,
          user: comment.created_by_name || "Unknown",
          text: comment.content,
          time: new Date(comment.created_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour12: true,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        })) : []
      }));
    } catch (error) {
      console.error("Error loading comments:", error);
      
      // Check if it's a 500 error or network issue
      if (error.response?.status === 500) {
        toast.error("Server error while loading comments. Please try again later.");
      } else if (error.response?.status === 404) {
        toast.warning("Comments not found for this task.");
      } else {
        toast.error("Failed to load comments. Please check your connection.");
      }
      
      // Set empty comments on error
      setTask(prev => ({
        ...prev,
        comments: []
      }));
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Function to load history from API
  const loadHistory = async () => {
    if (!task.id || isLoadingHistory) return;
    
    setIsLoadingHistory(true);
    try {
      console.log("Loading history for task:", task.id);
      const response = await API.tasks.getHistory(task.id);
      console.log("History API response:", response);

      // Handle response structure: response should have { success: true, history: [...] }
      const historyArray = response.history || response || [];
      console.log("History array:", historyArray);

      // Update history data with enhanced processing for new response format
      setHistoryData(historyArray.map(item => {
        // Determine a display status for the pill badge
        let displayStatus = 'activity';
        if (item.action_type === 'created') displayStatus = 'created';
        else if (item.action_type === 'status_changed') {
          const ns = (item.details?.new_status || '').replace('TaskStatus.', '').toLowerCase();
          if (ns === 'completed') displayStatus = 'completed';
          else if (ns === 'failed') displayStatus = 'failed';
          else if (ns === 'pending' || ns === 'reopened') displayStatus = 'reopened';
          else displayStatus = 'status';
        }
        else if (item.action_type === 'comment_added') displayStatus = 'comment';
        else if (item.action_type === 'assignment_changed') displayStatus = 'assignment';
        else if (item.action_type === 'updated') displayStatus = 'updated';

        // Build task-note (the original detail/title of the task at that point)
        let taskNote = '';
        if (item.action_type === 'created') {
          taskNote = item.details?.task_title || '';
        } else if (item.action_type === 'status_changed') {
          taskNote = item.details?.task_note || '';
        }

        // Build remark text
        let remark = '';
        if (item.action_type === 'status_changed') {
          const oldS = (item.details?.old_status || '').replace('TaskStatus.', '');
          const newS = (item.details?.new_status || '').replace('TaskStatus.', '');
          remark = item.details?.remark || item.details?.note || `${oldS} → ${newS}`;
        } else if (item.action_type === 'comment_added') {
          remark = item.details?.comment_preview || item.details?.comment || '';
        } else if (item.action_type === 'assignment_changed') {
          const oldA = item.details?.old_assignees?.join(', ') || 'None';
          const newA = item.details?.new_assignees?.join(', ') || 'None';
          remark = `${oldA} → ${newA}`;
        } else if (item.action_type === 'updated') {
          remark = item.details?.change_summary?.replace(/TaskStatus\./g, '') || item.action || '';
        } else if (item.action_type === 'created') {
          // no remark for created
        } else {
          remark = (item.action || '').replace(/TaskStatus\./g, '');
        }

        return {
          id: item.id,
          date: item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric"
          }).toUpperCase() : "UNKNOWN DATE",
          time: item.created_at ? new Date(item.created_at).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }).toUpperCase() : "",
          createdBy: (item.created_by_name || "Unknown").toUpperCase(),
          displayStatus,
          taskNote,
          remark,
          actionType: item.action_type || 'unknown'
        };
      }));
    } catch (error) {
      console.error("Error loading history:", error);
      
      // Check if it's a 500 error or network issue
      if (error.response?.status === 500) {
        toast.error("Server error while loading history. Using fallback data.");
      } else if (error.response?.status === 404) {
        toast.warning("History not found for this task. Using fallback data.");
      } else {
        toast.error("Failed to load history. Using fallback data.");
      }
      
      // Use fallback dummy data if API fails
      setHistoryData([
        { id: 1, date: "24 JUN 2025", createdBy: "ADMIN", displayStatus: 'reopened', taskNote: '', remark: 'Task reopened', actionType: 'status_changed' },
        { id: 2, date: "24 JUN 2025", createdBy: "ADMIN", displayStatus: 'completed', taskNote: '', remark: 'Task closed', actionType: 'status_changed' },
        { id: 3, date: "11 JUN 2025", createdBy: "ADMIN", displayStatus: 'reopened', taskNote: '', remark: 'Task reopened', actionType: 'status_changed' },
        { id: 4, date: "11 JUN 2025", createdBy: "ADMIN", displayStatus: 'completed', taskNote: '', remark: 'Task closed', actionType: 'status_changed' },
        { id: 5, date: "11 JUN 2025", createdBy: "ADMIN", displayStatus: 'created', taskNote: 'New Task', remark: '', actionType: 'created' },
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load comments when comments section is shown
  useEffect(() => {
    if (showComments && task.id) {
      loadComments();
    }
  }, [showComments, task.id]);

  // Load history when history section is shown
  useEffect(() => {
    if (showHistory && task.id) {
      loadHistory();
    }
  }, [showHistory, task.id]);

  // Effect for auto-resizing the message textarea
  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = messageRef.current.scrollHeight + "px";
    }
  }, [task.description]);

  // Fetch initial data when component mounts - only when needed
  useEffect(() => {
    // We'll fetch users and loan types only when associate popup is opened
    // This prevents unnecessary API calls on component mount
  }, []);

  // Parse existing associated records from task data
  useEffect(() => {
    if (task && task.lead_id) {
      // If task has a lead_id, find the associated lead information
      const associatedLead = {
        id: task.lead_id,
        lead_id: task.lead_id,
        name: task.lead_name || task.customer_name || 'Associated Lead',
        lead_number: task.lead_number || '',
        loan_type: task.loan_type || ''
      };
      
      // Add associated record to task if not already present
      if (!task.associateWithRecords || task.associateWithRecords.length === 0) {
        setTask(prev => ({
          ...prev,
          associateWithRecords: [associatedLead]
        }));
      }
    }
  }, [task?.lead_id, task?.lead_name, task?.customer_name, task?.loan_type]);

  // Handle associate with records selection (similar to CreateTask)
  const handleAssociateSelect = (selectedRecords) => {
    console.log('Selected records in EditTask:', selectedRecords);
    setTask(prev => {
      const updated = { ...prev, associateWithRecords: selectedRecords };
      debouncedAutoSave(updated);
      return updated;
    });
    setShowAssociatePopup(false);
  };

  // ── Inline lead search ──
  const searchLeadsAPI = async (searchVal) => {
    const userId = currentUserId || localStorage.getItem('userId');
    if (!userId) return;
    setLoadingLeadSearch(true);
    try {
      const res = await fetch(`${BASE_URL}/tasks/search-leads?user_id=${userId}&search=${encodeURIComponent(searchVal)}&limit=20`);
      const data = await res.json();
      setLeadSearchResults(data.leads || []);
    } catch (err) {
      console.error("Lead search error:", err);
      setLeadSearchResults([]);
    } finally {
      setLoadingLeadSearch(false);
    }
  };

  const handleLeadSearchChange = (val) => {
    setLeadSearchTerm(val);
    if (leadSearchTimerRef.current) clearTimeout(leadSearchTimerRef.current);
    leadSearchTimerRef.current = setTimeout(() => searchLeadsAPI(val), 300);
  };

  const handleSelectLead = (lead) => {
    const selected = [{
      id: lead.id || lead.lead_id,
      lead_id: lead.id || lead.lead_id,
      name: lead.customer_name || lead.name,
      customer_name: lead.customer_name || lead.name,
      phone: lead.phone,
      email: lead.email,
      loan_type: lead.loan_type,
      lead_login: lead.lead_login || 'Lead',
      lead_number: lead.lead_number || '',
    }];
    setTask(prev => {
      const updated = { ...prev, associateWithRecords: selected };
      debouncedAutoSave(updated);
      return updated;
    });
    setShowLeadDropdown(false);
    setLeadSearchTerm('');
    setLeadSearchResults([]);
  };

  const clearSelectedRecord = (e) => {
    e.stopPropagation();
    setTask(prev => {
      const updated = { ...prev, associateWithRecords: [] };
      debouncedAutoSave(updated);
      return updated;
    });
  };

  // Close lead dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target)) {
        setShowLeadDropdown(false);
      }
    };
    if (showLeadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLeadDropdown]);

  // Handle time selection from ClockTimePicker
  const handleTimeSelect = (time) => {
    setTask(prev => {
      const updated = { ...prev, dueTime: time };
      debouncedAutoSave(updated);
      return updated;
    });
    setShowClockTimePicker(false);
  };

  // Function to handle form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("Submitting updated task with data:", {
        newAttachments: task.newAttachments,
        attachmentsToRemove: task.removedAttachments
      });

      // Map internal status to backend expected format
      const statusMapping = {
        "PENDING": "Pending",
        "IN_PROGRESS": "In Progress", 
        "COMPLETED": "Completed",
        "CANCELLED": "Cancelled"
      };

      // **IMMEDIATE UI UPDATE FIRST**
      // Update local EditTask UI state immediately for instant visual feedback
      console.log(`✅ EditTask form submitted - updating UI immediately`);

      // Prepare data for the API - use backend expected field names
      const taskData = {
        subject: task.title, // Backend expects 'subject', not 'title'
        task_details: task.description, // Backend expects 'task_details', not 'description'
        priority: task.priority || "medium",
        status: statusMapping[task.status] || "Pending",
        assigned_to: task.assigned_users || [], // Backend expects 'assigned_to', not 'assigned_users'
        due_date: task.dueDate || null,
        due_time: task.dueTime || "08:00 AM",
        repeat_option: task.repeatOption || "none",
        repeat_custom_days: task.repeatCustomDays || [],
      };

      // Handle associated records - extract lead ID and loan type from first selected record (similar to CreateTask)
      if (task.associateWithRecords && task.associateWithRecords.length > 0) {
        const firstRecord = task.associateWithRecords[0];
        console.log('First associated record in EditTask:', firstRecord);
        
        // Add lead information to task data
        if (firstRecord.id || firstRecord.lead_id) {
          taskData.lead_id = firstRecord.id || firstRecord.lead_id;
          taskData.lead_name = firstRecord.name || firstRecord.customer_name;
          taskData.loan_type = firstRecord.loan_type || firstRecord.loanType;
          
          console.log('Added lead association to task data in EditTask:', {
            lead_id: taskData.lead_id,
            lead_name: taskData.lead_name,
            loan_type: taskData.loan_type
          });
        }
      }

      // Validate required fields
      if (!taskData.subject.trim()) {
        setError("Title is required");
        return;
      }
      if (!taskData.task_details.trim()) {
        setError("Description is required");
        return;
      }

      // Handle attachments if there are new ones or removed ones
      if (task.newAttachments?.length > 0) {
        console.log("Found new attachments to upload:", task.newAttachments.map(a => a.name));
      }

      // Try to use API directly first, then fall back to onSave callback
      let updateSuccess = false;
      
      try {
        // Skip API.tasks.updateTask as the endpoint returns 404 error
        // The backend doesn't seem to have the PUT /tasks/{id} endpoint implemented
        console.log("Skipping API.tasks.updateTask due to 404 endpoint error");
        console.log("Task data to be updated via onSave callback:", taskData);
        updateSuccess = false; // Force fallback to onSave
      } catch (apiError) {
        console.error("API update failed, trying onSave callback:", apiError);
        updateSuccess = false;
      }

      // Fallback to onSave callback if API method failed or doesn't exist
      if (!updateSuccess && onSave) {
        console.log("Calling onSave with task data:", taskData);
        console.log("New attachments:", task.newAttachments);
        console.log("Removed attachments:", task.removedAttachments);
        
        const updatePayload = {
          ...taskData, // Use the properly formatted taskData
          _id: task.id, // Ensure we have _id for the API
          id: task.id, // Also include id for compatibility
          // Include fields that parent Task component expects for immediate updates
          subject: task.title,
          message: task.description,
          title: task.title,
          description: task.description,
          // Include attachment info for API handling
          attachmentsToRemove: task.removedAttachments.filter(att => att.id).map(att => att.id),
          newAttachments: task.newAttachments || [],
          // Include comment data
          newComment: task.newComment,
          comments: task.comments || []
        };
        
        console.log("Final update payload:", updatePayload);
        const updatedTask = await onSave(updatePayload);
        
        // Update local task state with the response from the backend
        if (updatedTask) {
          console.log("Received updated task from backend:", updatedTask);
          setTask(prev => ({
            ...prev,
            ...formatTaskForUI(updatedTask),
            // Clear the arrays for new/removed attachments since they've been processed
            newAttachments: [],
            removedAttachments: []
          }));
        } else {
          // If no response data, at least update the current state
          setTask(prev => ({
            ...prev,
            title: taskData.subject, // Map back to UI field names
            description: taskData.task_details,
            priority: taskData.priority,
            status: task.status, // Keep internal status format
            assigned_users: taskData.assigned_to,
            dueDate: taskData.due_date,
            // Clear the arrays for new/removed attachments
            newAttachments: [],
            removedAttachments: []
          }));
        }

      }

      // Auto-save completed
    } catch (err) {
      console.error("Error updating task:", err);
      
      // Show error inside modal only (no popup toast)
      if (err.response?.status === 500) {
        setError("Server error occurred. Please try again later.");
      } else if (err.response?.status === 404) {
        setError("Task not found. It may have been deleted.");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to update this task.");
      } else if (err.response?.status === 400) {
        setError("Invalid task data. Please check your inputs.");
      } else if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
      } else {
        setError("Failed to update task. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Remark modal helpers ──
  const openRemarkModal = (type) => {
    setRemarkType(type);
    setRemarkText('');
    setRemarkError(false);
    setRemarkModalOpen(true);
  };

  const closeRemarkModal = () => {
    setRemarkModalOpen(false);
    setRemarkType('');
    setRemarkText('');
    setRemarkError(false);
  };

  const confirmRemark = () => {
    if (!remarkText.trim()) {
      setRemarkError(true);
      return;
    }
    // Close modal and dispatch the right action
    setRemarkModalOpen(false);
    if (remarkType === 'complete') {
      handleCompleteReopenTask(remarkText.trim());
    } else if (remarkType === 'fail') {
      handleFailedTask(remarkText.trim());
    } else if (remarkType === 'reopen') {
      handleCompleteReopenTask(remarkText.trim()); // reopen also uses handleCompleteReopenTask
    }
  };

  // Function to handle completing/reopening task
  const handleCompleteReopenTask = async (remark = '') => {
    setIsLoading(true);
    setError(null);

    try {
      // Handle reopening from COMPLETED or FAILED status
      const newStatus = (task.status === "COMPLETED" || task.status === "FAILED") ? "PENDING" : "COMPLETED";

      // Map internal status to backend expected format
      const statusMapping = {
        "PENDING": "Pending",
        "IN_PROGRESS": "In Progress", 
        "COMPLETED": "Completed",
        "FAILED": "Failed",
        "CANCELLED": "Cancelled"
      };

      const backendStatus = statusMapping[newStatus] || "Pending";

      // **IMMEDIATE UI UPDATE FIRST**
      // Update local EditTask state immediately for instant visual feedback
      const previousStatus = task.status;
      
      // If reopening from FAILED, also remove the [SYSTEM_FAILED_TASK] marker
      const updatedNotes = (previousStatus === "FAILED" && newStatus === "PENDING")
        ? (task.notes || "").replace('[SYSTEM_FAILED_TASK]', '').trim()
        : task.notes;
      
      const updatedDescription = (previousStatus === "FAILED" && newStatus === "PENDING")
        ? (task.description || "").replace('[SYSTEM_FAILED_TASK]', '').trim()
        : task.description;
      
      setTask(prev => ({
        ...prev,
        status: newStatus,
        notes: updatedNotes,
        description: updatedDescription
      }));
      
      console.log(`✅ EditTask status updated immediately: ${previousStatus} → ${newStatus}`);

      // **IMMEDIATE TAB SWITCHING** - Call onStatusChange for instant tab switch to Complete
      if (onStatusChange && newStatus === "COMPLETED") {
        console.log('🚀 Triggering immediate tab switch to Complete tab');
        onStatusChange({
          taskId: task.id,
          newStatus: backendStatus,
          previousStatus: previousStatus,
          shouldSwitchToCompleteTab: true,
          immediate: true
        });
      }

      // **IMMEDIATELY call onSave for parent Task component to update**
      if (onSave) {
        // Ensure assigned_to is an array of user IDs (strings)
        let assignedUserIds = [];
        if (Array.isArray(task.assigned_users)) {
          assignedUserIds = task.assigned_users.map(user => {
            // If it's already a string (user ID), use it
            if (typeof user === 'string') return user;
            // If it's an object, extract the ID
            return user.user_id || user.id || user._id;
          }).filter(Boolean); // Remove any null/undefined values
        }

        const updatePayload = {
          // Backend expected fields (matching the taskUpdate structure in Task.jsx)
          subject: task.title || "",
          task_details: (previousStatus === "FAILED" && newStatus === "PENDING")
            ? (task.description || "").replace('[SYSTEM_FAILED_TASK]', '').trim()
            : task.description || "",
          priority: task.priority || "Medium",
          status: backendStatus,
          assigned_to: assignedUserIds,
          due_date: task.dueDate || null,
          due_time: task.dueTime || "08:00 AM",
          task_type: task.taskType || task.typeTask || "To-Do",
          is_urgent: task.isUrgent || task.is_urgent || false,
          // Remove failed task marker when reopening from FAILED status
          notes: (previousStatus === "FAILED" && newStatus === "PENDING") 
            ? (task.notes || "").replace('[SYSTEM_FAILED_TASK]', '').trim()
            : task.notes || "",
          // Include repeat options if present
          repeat_option: task.repeatOption || "none",
          repeat_custom_days: task.repeatCustomDays || [],
          // Include lead association fields if present
          ...(task.lead_id && { lead_id: task.lead_id }),
          ...(task.loan_type && { loan_type: task.loan_type }),
          // ID fields
          _id: task.id,
          id: task.id,
          // Additional fields for UI updates (matching Task.jsx immediate update)
          title: task.title,
          description: (previousStatus === "FAILED" && newStatus === "PENDING")
            ? (task.description || "").replace('[SYSTEM_FAILED_TASK]', '').trim()
            : task.description,
          message: (previousStatus === "FAILED" && newStatus === "PENDING")
            ? (task.description || "").replace('[SYSTEM_FAILED_TASK]', '').trim()
            : task.description,
          date: task.dueDate,
          time: task.dueTime,
          typeTask: task.taskType || task.typeTask,
          // Flag to keep modal open for status-only changes
          keepModalOpen: true,
          // Remark for history tracking
          remark: remark || "",
        };
        
        console.log(`🚀 Triggering immediate parent update for status change`);
        console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));
        
        // Call onSave immediately to trigger parent's immediate update logic
        await onSave(updatePayload);
      }
    } catch (err) {
      console.error("Error updating task status:", err);
      
      // Revert local state on error
      setTask(prev => ({
        ...prev,
        status: task.status // Revert to original status
      }));
      
      // Show error inside modal only (no popup toast)
      if (err.response?.status === 500) {
        setError("Server error while updating status. Please try again later.");
      } else if (err.response?.status === 404) {
        setError("Task not found. It may have been deleted.");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to update this task status.");
      } else if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
      } else {
        setError("Failed to update task status. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFailedTask = async (remark = '') => {
    setIsLoading(true);
    setError(null);

    try {
      const newStatus = task.status === "FAILED" ? "PENDING" : "FAILED";

      // Map internal status to backend expected format
      // NOTE: Backend only accepts 4 statuses, so we map FAILED to Cancelled
      // But UI will still show and track tasks as "Failed"
      const statusMapping = {
        "PENDING": "Pending",
        "IN_PROGRESS": "In Progress", 
        "COMPLETED": "Completed",
        "FAILED": "Cancelled",  // Backend doesn't support "Failed", use "Cancelled"
        "CANCELLED": "Cancelled"
      };

      const backendStatus = statusMapping[newStatus] || "Pending";

      // **IMMEDIATE UI UPDATE FIRST**
      const previousStatus = task.status;
      setTask(prev => ({
        ...prev,
        status: newStatus
      }));
      
      console.log(`✅ EditTask status updated immediately: ${previousStatus} → ${newStatus}`);
      console.log('📦 Current task object:', task);

      // **IMMEDIATE TAB SWITCHING** - Call onStatusChange for instant tab switch to Failed tab
      if (onStatusChange && newStatus === "FAILED") {
        console.log('🚀 Triggering immediate tab switch to Failed tab');
        onStatusChange({
          taskId: task.id,
          newStatus: backendStatus,
          previousStatus: previousStatus,
          shouldSwitchToFailedTab: true,
          immediate: true
        });
      }

      // **IMMEDIATELY call onSave for parent Task component to update**
      if (onSave) {
        // Ensure assigned_to is an array of user IDs (strings)
        let assignedUserIds = [];
        if (Array.isArray(task.assigned_users)) {
          assignedUserIds = task.assigned_users.map(user => {
            // If it's already a string (user ID), use it
            if (typeof user === 'string') return user;
            // If it's an object, extract the ID
            return user.user_id || user.id || user._id;
          }).filter(Boolean); // Remove any null/undefined values
        }

        const updatePayload = {
          // Backend expected fields (matching the taskUpdate structure in Task.jsx)
          subject: task.title || "",
          task_details: task.description || "",
          priority: task.priority || "Medium",
          status: backendStatus,
          assigned_to: assignedUserIds,
          due_date: task.dueDate || null,
          due_time: task.dueTime || "08:00 AM",
          task_type: task.taskType || task.typeTask || "To-Do",
          is_urgent: task.isUrgent || task.is_urgent || false,
          // Add marker to notes if marking as failed
          notes: newStatus === "FAILED" 
            ? `${task.notes || ""}\n[SYSTEM_FAILED_TASK]`.trim()
            : task.notes || "",
          // Include repeat options if present
          repeat_option: task.repeatOption || "none",
          repeat_custom_days: task.repeatCustomDays || [],
          // Include lead association fields if present
          ...(task.lead_id && { lead_id: task.lead_id }),
          ...(task.loan_type && { loan_type: task.loan_type }),
          // ID fields
          _id: task.id,
          id: task.id,
          // Additional fields for UI updates (matching Task.jsx immediate update)
          title: task.title,
          description: task.description,
          message: task.description,
          date: task.dueDate,
          time: task.dueTime,
          typeTask: task.taskType || task.typeTask,
          // IMPORTANT: Mark this as a "failed" task for UI tracking
          // Since backend stores as "Cancelled", we need to track UI state
          uiStatus: newStatus,  // "FAILED" for UI display
          isFailedTask: newStatus === "FAILED",  // Flag for backend
          // Flag to keep modal open for status-only changes
          keepModalOpen: true,
          // Remark for history tracking
          remark: remark || "",
        };
        
        console.log(`🚀 Triggering immediate parent update for status change: ${previousStatus} → ${backendStatus} (UI: ${newStatus})`);
        console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));
        
        // Call onSave immediately to trigger parent's immediate update logic
        await onSave(updatePayload);
      }
    } catch (err) {
      console.error("Error updating task status:", err);
      
      // Revert local state on error
      setTask(prev => ({
        ...prev,
        status: task.status // Revert to original status
      }));
      
      // Show error inside modal only (no popup toast)
      if (err.response?.status === 500) {
        setError("Server error while updating status. Please try again later.");
      } else if (err.response?.status === 404) {
        setError("Task not found. It may have been deleted.");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to update this task status.");
      } else if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
      } else {
        setError("Failed to update task status. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Shared file validation and processing for EditTask
  const processAttachmentFiles = (files) => {
    if (!files || files.length === 0) return;

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      'application/pdf',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'
    ];
    const maxSize = 25 * 1024 * 1024; // 25MB

    const validFiles = [];
    const rejectedFiles = [];

    files.forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        rejectedFiles.push({ file, reason: 'Invalid file type. Allowed: images, PDF, and videos.' });
        return;
      }
      if (file.size > maxSize) {
        rejectedFiles.push({ file, reason: 'File size exceeds 25MB limit.' });
        return;
      }
      validFiles.push(file);
    });

    if (rejectedFiles.length > 0) {
      const errorMessages = rejectedFiles.map(({ file, reason }) => `${file.name}: ${reason}`);
      alert('Some files were rejected:\n\n' + errorMessages.join('\n'));
    }

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map((file) => ({
        id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        isNew: true,
        isFromBackend: false
      }));

      setTask((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
        newAttachments: [...prev.newAttachments, ...newAttachments],
        showAttachments: true,
      }));
    }
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    processAttachmentFiles(files);
    e.target.value = '';
  };

  // Native paste listener — mirrors task_creation.html's addEventListener('paste', ...) approach.
  // More reliable than React's synthetic onPaste when child inputs/textareas hold focus.
  useEffect(() => {
    const modalEl = modalRef.current;
    if (!modalEl) return;
    const handler = (e) => {
      const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
      const files = items.filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(Boolean);
      if (files.length > 0) {
        e.preventDefault();
        processAttachmentFiles(files);
      }
    };
    modalEl.addEventListener('paste', handler);
    // Auto-focus the overlay so paste works immediately without clicking
    modalEl.focus();
    return () => modalEl.removeEventListener('paste', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field, value) => {
    setTask((prev) => ({ ...prev, [field]: value }));
  };

  // Change a field and immediately auto-save (for dropdowns, selects, pickers)
  const handleChangeAndSave = (field, value) => {
    setTask((prev) => {
      const updated = { ...prev, [field]: value };
      debouncedAutoSave(updated);
      return updated;
    });
  };

  // ── Auto-save helper ──
  // Builds the update payload from current task state and calls onSave
  const triggerAutoSave = async (updatedTask) => {
    if (!onSave || !updatedTask?.id) return;

    // Build a save-key fingerprint of the fields we care about
    const saveKey = JSON.stringify({
      title: updatedTask.title,
      description: updatedTask.description,
      priority: updatedTask.priority,
      dueDate: updatedTask.dueDate,
      dueTime: updatedTask.dueTime,
      dueDateOption: updatedTask.dueDateOption,
      repeatOption: updatedTask.repeatOption,
      repeatCustomDays: updatedTask.repeatCustomDays,
      assigned_users: updatedTask.assigned_users,
    });

    // Skip if nothing changed since last save
    if (lastSavedRef.current === saveKey) return;
    lastSavedRef.current = saveKey;

    const statusMapping = {
      "PENDING": "Pending",
      "IN_PROGRESS": "In Progress",
      "COMPLETED": "Completed",
      "CANCELLED": "Cancelled"
    };

    const taskData = {
      subject: updatedTask.title,
      task_details: updatedTask.description,
      priority: updatedTask.priority || "medium",
      status: statusMapping[updatedTask.status] || "Pending",
      assigned_to: updatedTask.assigned_users || [],
      due_date: updatedTask.dueDate || null,
      due_time: updatedTask.dueTime || "08:00 AM",
      repeat_option: updatedTask.repeatOption || "none",
      repeat_custom_days: updatedTask.repeatCustomDays || [],
    };

    // Handle associated records
    if (updatedTask.associateWithRecords?.length > 0) {
      const firstRecord = updatedTask.associateWithRecords[0];
      if (firstRecord.id || firstRecord.lead_id) {
        taskData.lead_id = firstRecord.id || firstRecord.lead_id;
        taskData.lead_name = firstRecord.name || firstRecord.customer_name;
        taskData.loan_type = firstRecord.loan_type || firstRecord.loanType;
      }
    }

    if (!taskData.subject?.trim() || !taskData.task_details?.trim()) return;

    try {
      const updatePayload = {
        ...taskData,
        _id: updatedTask.id,
        id: updatedTask.id,
        subject: updatedTask.title,
        message: updatedTask.description,
        title: updatedTask.title,
        description: updatedTask.description,
        keepModalOpen: true, // Don't close modal on auto-save
      };
      await onSave(updatePayload);
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  };

  // Debounced version for text field blurs
  const debouncedAutoSave = (taskState) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      triggerAutoSave(taskState);
    }, 300);
  };

  // Handle blur - apply uppercase when user leaves the field, then auto-save
  const handleBlur = (field) => {
    const excludeFromUppercase = ['id', 'assignTo', 'priority', 'status', 'type', 'dueDate', 'dueTime'];
    setTask((prev) => {
      const updated = { ...prev };
      if (!excludeFromUppercase.includes(field) && typeof updated[field] === 'string') {
        updated[field] = updated[field].toUpperCase();
      }
      // Trigger auto-save with the latest state
      debouncedAutoSave(updated);
      return updated;
    });
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!task.newComment.trim()) return;
    
    const commentText = task.newComment.trim(); // Store the comment text before clearing
    setIsLoading(true);
    try {
      console.log("Submitting comment:", commentText, "for task:", task.id);
      
      // Call API to add comment
      const response = await API.tasks.addComment(task.id, commentText);
      console.log("Comment API response:", response);

      // Clear the input immediately for better UX
      setTask((prev) => ({
        ...prev,
        newComment: "",
      }));

      // Add comment to local state for immediate display with server response data
      const now = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const newComment = {
        id: response.id || Date.now(),
        user: response.created_by_name || "You",
        text: commentText, // Use the stored comment text
        time: response.created_at ? new Date(response.created_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }) : now
      };

      setTask((prev) => ({
        ...prev,
        comments: [newComment, ...prev.comments]
      }));

      toast.success("Comment added successfully");
      
    } catch (error) {
      console.error("Error adding comment:", error);
      
      // Restore the comment text on error
      setTask((prev) => ({
        ...prev,
        newComment: commentText,
      }));
      
      // Provide specific error messages for comment submission
      if (error.response?.status === 500) {
        toast.error("Server error: Unable to add comment. Please try again later.");
      } else if (error.response?.status === 404) {
        toast.error("Task not found. Comment could not be added.");
      } else if (error.response?.status === 403) {
        toast.error("Permission denied: You cannot add comments to this task.");
      } else if (!navigator.onLine) {
        toast.error("Network error: Please check your internet connection.");
      } else {
        toast.error("Failed to add comment. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false); // Close the modal locally
    // Reset history but keep comments open for next use
    setShowHistory(false);
    if (onClose) onClose(); // Call the parent onClose if provided
  };

  // Function to remove a backend attachment (marks for removal)
  const handleRemoveBackendAttachment = (attachmentToRemove) => {
    console.log("Removing backend attachment:", attachmentToRemove);
    
    setTask((prev) => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentToRemove.id),
      removedAttachments: [...prev.removedAttachments, attachmentToRemove]
    }));
  };

  // Function to remove a new attachment (removes from newAttachments)
  const handleRemoveNewAttachment = (attachmentToRemove) => {
    console.log("Removing new attachment:", attachmentToRemove);
    
    // Revoke the object URL to free up memory
    if (attachmentToRemove.url && attachmentToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(attachmentToRemove.url);
    }
    
    setTask((prev) => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentToRemove.id),
      newAttachments: prev.newAttachments.filter(att => att.id !== attachmentToRemove.id)
    }));
  };

  const toggleComments = () => {
    setShowComments(!showComments);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    setShowHistory(true);
    setShowComments(false);
  };

  // Function to remove an assignee
  const handleRemoveAssignee = (nameToRemove) => {
    setTask((prevTask) => {
      // Filter out the removed assignee from assignedTo
      const updatedAssignedTo = prevTask.assignedTo.filter(assignee => {
        if (typeof assignee === 'string') {
          return assignee !== nameToRemove;
        } else {
          return assignee.name !== nameToRemove;
        }
      });

      // Filter out the corresponding assigned_users entry
      const updatedAssignedUserIds = prevTask.assigned_users.filter((id, index) => {
        const assignee = prevTask.assignedTo[index];
        if (typeof assignee === 'string') {
          return assignee !== nameToRemove;
        } else {
          return assignee.name !== nameToRemove;
        }
      });

      // Get names for display
      const assigneeNames = updatedAssignedTo.map(a =>
        typeof a === 'string' ? a : a.name
      );

      const updated = {
        ...prevTask,
        assignedTo: updatedAssignedTo,
        assign: assigneeNames.join(", "),
        assigned_users: updatedAssignedUserIds
      };
      debouncedAutoSave(updated);
      return updated;
    });
  };

  // Function to add an assignee from the popup
  const handleAddAssignee = (newAssignee) => {
    setTask((prevTask) => {
      // Get name from string or object
      const assigneeName = typeof newAssignee === 'string' ? newAssignee : newAssignee.name;
      const assigneeId = typeof newAssignee === 'string' ? null : newAssignee.id;

      // Check if name already exists in assignedTo
      const nameExists = prevTask.assignedTo.some(existing => {
        if (typeof existing === 'string') {
          return existing === assigneeName;
        } else {
          return existing.name === assigneeName;
        }
      });

      // Only add if not already present
      if (!nameExists) {
        const updatedAssignedTo = [...prevTask.assignedTo, newAssignee];
        const updatedAssignedUserIds = assigneeId
          ? [...(prevTask.assigned_users || []), assigneeId]
          : prevTask.assigned_users || [];

        // Get names for display
        const assigneeNames = updatedAssignedTo.map(a =>
          typeof a === 'string' ? a : a.name
        );

        const updated = {
          ...prevTask,
          assignedTo: updatedAssignedTo,
          assign: assigneeNames.join(", "),
          assigned_users: updatedAssignedUserIds
        };
        debouncedAutoSave(updated);
        return updated;
      }
      return prevTask;
    });
  };

  // If there's no valid task data, show a comprehensive error message with retry option
  console.log("EditTask - Validation check - task:", task);
  console.log("EditTask - Validation check - task.id:", task?.id);
  console.log("EditTask - Validation check - initialTask:", initialTask);
  console.log("EditTask - Validation check - typeof task:", typeof task);
  console.log("EditTask - Validation check - task keys:", task ? Object.keys(task) : 'N/A');
  
  if (!task || !task.id) {
    console.error("EditTask - Invalid task data:", { 
      task, 
      initialTask, 
      taskId: task?.id,
      taskExists: !!task,
      taskIdExists: !!(task?.id)
    });
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
        <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-md mx-auto text-center">
          <button
            className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
            onClick={handleClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-600 mb-4">Task Loading Error</h2>
          <div className="text-gray-700 mb-6 space-y-2">
            <p>Unable to load task data. This could be due to:</p>
            <ul className="text-left text-sm space-y-1 mt-3">
              <li>• Server error (500 Internal Server Error)</li>
              <li>• Task not found or deleted</li>
              <li>• Network connectivity issues</li>
              <li>• Permission restrictions</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine task type label and color for the pill badge
  const getTaskTypePill = () => {
    const typeKey = (task.typeTask || task.taskType || 'todo').toLowerCase();
    if (typeKey.includes('call') || typeKey.includes('callback')) return { label: '📞 Callback', cls: 'callback' };
    if (typeKey.includes('pend')) return { label: '⏳ Pendency', cls: 'pendency' };
    return { label: '📝 To-Do', cls: 'todo' };
  };
  const typePill = getTaskTypePill();
  const pillColors = {
    callback: { bg: 'rgba(46,204,113,0.12)', color: '#16a34a', border: '1px solid rgba(46,204,113,0.3)' },
    pendency: { bg: 'rgba(243,156,18,0.12)', color: '#b45309', border: '1px solid rgba(243,156,18,0.3)' },
    todo: { bg: 'rgba(0,170,255,0.12)', color: '#0077bb', border: '1px solid rgba(0,170,255,0.3)' },
  };
  const pc = pillColors[typePill.cls] || pillColors.todo;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', justifyContent:'center', alignItems:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', outline:'none' }} ref={modalRef} tabIndex={-1}>
      <div style={{ background:'#fff', width:'100%', maxWidth:700, maxHeight:'96vh', borderRadius:12, position:'relative', boxShadow:'0 15px 50px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', border:'1px solid rgba(0,0,0,0.1)', overflow:'hidden' }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          type="button"
          style={{ position:'absolute', top:20, right:20, background:'#f1f5f9', width:28, height:28, borderRadius:'50%', border:'none', fontSize:16, color:'#64748b', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}
        >×</button>

        {/* Scrollable body */}
        <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'14px 18px 14px' }}>
          {/* Title row with type pill */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
            <span style={{ fontSize:18, fontWeight:800, color:'#333' }}>View / Edit Task</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:pc.bg, color:pc.color, border:pc.border }}>{typePill.label}</span>
          </div>

        {/* Network Status Indicator */}
        {!isOnline && (
          <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', color:'#b91c1c', padding:'8px 12px', borderRadius:6, marginBottom:8, fontSize:12, fontWeight:600 }}>
            No internet connection. Some features may not work properly.
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', color:'#b91c1c', padding:'8px 12px', borderRadius:6, marginBottom:8, fontSize:12, fontWeight:600 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEditSubmit}>
          {/* Created Meta Row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>Created Date & Time</label>
              <input
                type="text"
                style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #cbd5e1', borderRadius:6, fontSize:13, color:'#64748b', fontWeight:600, background:'#f1f5f9', cursor:'not-allowed', outline:'none' }}
                value={currentDateTime}
                readOnly
                disabled
              />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>Created By</label>
              <input
                type="text"
                style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #cbd5e1', borderRadius:6, fontSize:13, color:'#64748b', fontWeight:600, background:'#f1f5f9', cursor:'not-allowed', outline:'none' }}
                value={task.createdBy}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* Title */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              {typePill.cls === 'callback' ? 'Quick Note / Subject' : typePill.cls === 'pendency' ? "What's Pending?" : 'Task Subject'}
            </label>
            <input
              type="text"
              style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #94a3b8', borderRadius:6, fontSize:13, color:'#333', fontWeight:600, outline:'none', background:'#fff', cursor:'text' }}
              value={task.title}
              onChange={(e) => handleChange("title", e.target.value)}
              onBlur={() => handleBlur("title")}
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Description */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              {typePill.cls === 'todo' ? 'Description' : 'Details'}
            </label>
            <textarea
              ref={messageRef}
              style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #94a3b8', borderRadius:6, fontSize:13, color:'#333', fontWeight:500, outline:'none', resize:'vertical', minHeight:70, background:'#fff', cursor:'text', fontFamily:'inherit' }}
              rows={3}
              value={task.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Enter task description..."
              required
            />
          </div>

          {/* Associate with Records Field - Inline Lead Dropdown */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              {typePill.cls === 'callback' ? 'Who to call? (Target Record)' : 'Associate with Record'}
            </label>
            <div ref={leadDropdownRef} style={{ position:'relative' }}>
              {/* Selected or placeholder button */}
              <div
                style={{
                  width:'100%', padding:'10px 14px',
                  border: task.associateWithRecords?.length > 0 ? '1.5px solid #94a3b8' : '1.5px dashed #00aaff',
                  borderRadius:8, fontSize:13, fontWeight:600,
                  background: task.associateWithRecords?.length > 0 ? 'linear-gradient(180deg,#ffffff,#f8fbff)' : 'linear-gradient(180deg,#fbfdff,#f3f9ff)',
                  cursor:'pointer', minHeight:44, display:'flex', alignItems:'center', justifyContent:'space-between',
                  color: task.associateWithRecords?.length > 0 ? '#0f172a' : '#00aaff',
                }}
                onClick={() => {
                  setShowLeadDropdown(prev => !prev);
                  if (!showLeadDropdown) searchLeadsAPI(leadSearchTerm || '');
                }}
              >
                {task.associateWithRecords && task.associateWithRecords.length > 0 ? (
                  <span style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                    <span style={{
                      padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.3px',
                      background: (task.associateWithRecords[0].lead_login || '').toLowerCase() === 'login' ? 'rgba(255,152,0,0.13)' : 'rgba(0,170,255,0.1)',
                      color: (task.associateWithRecords[0].lead_login || '').toLowerCase() === 'login' ? '#e65100' : '#00aaff',
                    }}>
                      {(task.associateWithRecords[0].lead_login || 'Lead')}
                    </span>
                    <strong style={{ fontWeight:700, color:'#0f172a' }}>{task.associateWithRecords[0].name || task.associateWithRecords[0].customer_name || 'Selected'}</strong>
                    {task.associateWithRecords[0].phone && (
                      <span style={{ fontSize:12, color:'#94a3b8', fontWeight:500 }}>{task.associateWithRecords[0].phone}</span>
                    )}
                    <span onClick={clearSelectedRecord} style={{ marginLeft:'auto', cursor:'pointer', color:'#94a3b8', fontWeight:700, fontSize:16, lineHeight:1 }} title="Clear">×</span>
                  </span>
                ) : (
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" stroke="#00aaff" strokeWidth="2"/><path d="M10 6v8M6 10h8" stroke="#00aaff" strokeWidth="2" strokeLinecap="round"/></svg>
                    Click to select Lead / Record...
                  </span>
                )}
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" style={{ flexShrink:0, marginLeft:6, transform: showLeadDropdown ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s' }}>
                  <path d="M2 4l4 4 4-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Dropdown */}
              {showLeadDropdown && (
                <div style={{
                  position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:1000,
                  background:'#fff', border:'1px solid #e2e8f0', borderRadius:10,
                  boxShadow:'0 8px 32px rgba(0,0,0,0.13)', overflow:'hidden',
                }}>
                  {/* Search input */}
                  <div style={{ padding:'10px 12px', borderBottom:'1px solid #f1f5f9' }}>
                    <input
                      type="text"
                      placeholder="Search by name or number..."
                      autoFocus
                      style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:6, fontSize:13, outline:'none', background:'#f8fafc' }}
                      value={leadSearchTerm}
                      onChange={e => handleLeadSearchChange(e.target.value)}
                    />
                  </div>
                  {/* Lead list */}
                  <div style={{ maxHeight:220, overflowY:'auto' }}>
                    {loadingLeadSearch ? (
                      <div style={{ padding:'18px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Searching...</div>
                    ) : leadSearchResults.length === 0 ? (
                      <div style={{ padding:'18px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>No leads found</div>
                    ) : (
                      <ul style={{ listStyle:'none', margin:0, padding:0 }}>
                        {leadSearchResults.map((lead, idx) => {
                          const isLogin = (lead.lead_login || '').toLowerCase() === 'login';
                          return (
                            <li
                              key={lead.id || lead.lead_id || idx}
                              style={{
                                padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                                borderBottom: idx < leadSearchResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                                transition:'background 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
                              onMouseLeave={e => e.currentTarget.style.background='transparent'}
                              onClick={() => handleSelectLead(lead)}
                            >
                              <span style={{
                                padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.3px', flexShrink:0,
                                background: isLogin ? 'rgba(255,152,0,0.13)' : 'rgba(0,170,255,0.1)',
                                color: isLogin ? '#e65100' : '#00aaff',
                              }}>
                                {isLogin ? 'Login' : 'Lead'}
                              </span>
                              <strong style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{lead.customer_name || lead.name}</strong>
                              {lead.phone && <span style={{ fontSize:12, color:'#94a3b8', fontWeight:500, marginLeft:'auto' }}>{lead.phone}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachment Section */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>📎 Attachments</label>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0' }}>
              <label style={{ display:'inline-flex', alignItems:'center', padding:'6px 14px', background:'#00aaff', color:'#fff', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                ＋ Add File
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  style={{ display:'none' }}
                  onChange={handleAttachmentChange}
                  multiple
                />
              </label>
              <span style={{ fontSize:11, color:'#94a3b8' }}>or Ctrl+V to paste</span>
            </div>

            {/* Display existing attachments with a clear heading */}
            <h4 className="font-semibold text-gray-700 mt-4 mb-2 w-full">
              {(() => {
                const backendAttachments = task.attachments.filter(a => a.isFromBackend);
                console.log("Backend attachments filter result:", backendAttachments);
                console.log("All attachments:", task.attachments);
                console.log("All attachments with isFromBackend flag:", task.attachments.map(a => ({name: a.name, isFromBackend: a.isFromBackend})));
                return backendAttachments.length > 0 ? "Previous Attachments" : "";
              })()}
            </h4>

            {/* Show previous attachments from the backend */}
            {task.attachments.filter(a => a.isFromBackend).length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-4 w-full">
                {task.attachments
                  .filter(attachment => attachment.isFromBackend)
                  .map((attachment, index) => (
                    <div key={`backend-${index}`} className="flex items-center bg-gray-100 p-2 rounded-lg relative border-2 border-green-200">
                      {attachment.url && (attachment.url.match(/\.(jpeg|jpg|gif|png)$/i) || (attachment.mimeType && attachment.mimeType.startsWith('image/'))) ? (
                        <img
                          src={attachment.url}
                          alt={`Preview ${index}`}
                          className="w-20 h-20 object-cover rounded-lg mr-2"
                          onError={(e) => {
                            console.error("Image failed to load:", attachment.url);
                            console.error("Full attachment object:", attachment);
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/80x80?text=Error+Loading";
                            // Show better error info for debugging
                            if (attachment.url.includes('/tasks/') && attachment.url.includes('/attachments/')) {
                              console.warn("Task attachment download endpoint failed - attachment may not have proper task_id linkage");
                              // Try direct file path as fallback
                              if (attachment.file_path) {
                                const fallbackUrl = attachment.file_path.startsWith('/') 
                                  ? `${API_BASE_URL}${attachment.file_path}`
                                  : `${API_BASE_URL}/${attachment.file_path}`;
                                console.log("Trying fallback URL:", fallbackUrl);
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded-lg mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="text-sm text-black font-medium truncate">{attachment.name}</span>
                        <div className="flex flex-col">
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View
                          </a>
                          {attachment.uploadedAt && (
                            <span className="text-xs text-gray-500">
                              Uploaded: {new Date(attachment.uploadedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        onClick={() => handleRemoveBackendAttachment(attachment)}
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Show newly added attachments with a separate heading */}
            <h4 className="font-semibold text-gray-700 mt-4 mb-2 w-full">
              {task.attachments.filter(a => !a.isFromBackend).length > 0
                ? "New Attachments"
                : ""}
            </h4>

            {/* Display newly added attachments */}
            {task.attachments.filter(a => !a.isFromBackend).length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-4 w-full">
                {task.attachments
                  .filter(attachment => !attachment.isFromBackend)
                  .map((attachment, index) => (
                    <div key={`new-${index}`} className="flex items-center bg-gray-100 p-2 rounded-lg relative border-2 border-blue-200">
                      {attachment.url && attachment.url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                        <img
                          src={attachment.url}
                          alt={`Preview ${index}`}
                          className="w-20 h-20 object-cover rounded-lg mr-2"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/80x80?text=Error";
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded-lg mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="text-sm text-black font-medium truncate">{attachment.name}</span>
                        <div className="flex flex-col">
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Preview
                          </a>
                          <span className="text-xs text-green-600">
                            New file - not yet uploaded
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        onClick={() => handleRemoveNewAttachment(attachment)}
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            ) : null}

            {/* Show message when no attachments exist */}
            {task.attachments.length === 0 && (
              <div className="mt-2 p-4 bg-gray-100 rounded-lg text-gray-500 text-center w-full">
                No attachments available. Add some using the button above.
              </div>
            )}
          </div>

          {/* Assignee Section */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>Assigned To</label>
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, border:'1.5px solid #94a3b8', borderRadius:6, background:'#fff', padding:'6px 8px', minHeight:42 }}>
              {/* Display all assigned names as pills */}
              {task.assignedTo && task.assignedTo.map((assignee, index) => {
                // Get user details based on whether assignee is a string or object
                const assigneeData = typeof assignee === 'string' 
                  ? { name: assignee, first_name: '', last_name: '', designation: '' }
                  : assignee;

                const displayName = assigneeData.first_name && assigneeData.last_name 
                  ? `${assigneeData.first_name} ${assigneeData.last_name}`.trim()
                  : assigneeData.name || assignee;

                const designation = assigneeData.designation || '';

                return (
                  <div
                    key={index}
                    style={{ display:'flex', alignItems:'center', background:'#e0f2fe', padding:'4px 10px', borderRadius:20, gap:6 }}
                  >
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'#00aaff', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                      {displayName.split(' ')
                        .map(part => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <span style={{ fontWeight:600, fontSize:12, color:'#0f172a' }}>{displayName}</span>
                    <button
                      type="button"
                      style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontWeight:700, fontSize:14, padding:0, marginLeft:2 }}
                      onClick={() => handleRemoveAssignee(displayName)}
                    >×</button>
                  </div>
                );
              })}
              <button
                type="button"
                style={{ background:'none', border:'none', color:'#00aaff', fontSize:12, fontWeight:700, cursor:'pointer', marginLeft:'auto' }}
                onClick={() => setShowAssignPopup(true)}
              >
                + Add more
              </button>
            </div>
          </div>

          {/* Schedule Section */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              📅 Schedule Date & ⏰ Time
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ position:'relative' }}>
                <select
                  ref={dueDateSelectRef}
                  style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #94a3b8', borderRadius:6, fontSize:13, color:'#333', fontWeight:600, outline:'none', background:'#fff', cursor:'pointer', appearance:'none', paddingRight:30, backgroundImage:"url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%2300aaff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 12 15 18 9\"></polyline></svg>')", backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center' }}
                  value={task.dueDateOption || "today"}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "today") {
                      setTask(prev => {
                        const updated = { ...prev, dueDateOption: "today", dueDate: getTodayDate(), customDate: null };
                        debouncedAutoSave(updated);
                        return updated;
                      });
                      setShowCalendar(false);
                    } else if (value === "tomorrow") {
                      setTask(prev => {
                        const updated = { ...prev, dueDateOption: "tomorrow", dueDate: getTomorrowDate(), customDate: null };
                        debouncedAutoSave(updated);
                        return updated;
                      });
                      setShowCalendar(false);
                    } else if (value === "custom") {
                      handleChange("dueDateOption", "custom");
                      handleChange(
                        "dueDate",
                        task.customDate ? formatDateToDDMonYYYY(task.customDate) : ""
                      );
                      setShowCalendar(true);
                    }
                  }}
                  onFocus={(e) => {
                    if (task.dueDateOption === "custom") {
                      setShowCalendar(true);
                    }
                  }}
                  required
                >
                  <option value="today">Today ({getTodayDate()})</option>
                  <option value="tomorrow">Tomorrow ({getTomorrowDate()})</option>
                  <option value="custom">
                    Custom Date
                  </option>
                </select>

                {task.dueDateOption === "custom" && showCalendar && (
                  <div 
                    className={`absolute bg-white border border-cyan-400 rounded shadow-lg z-[9999] ${
                      calendarPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
                    }`}
                  >
                    <DatePicker
                      selected={task.customDate || new Date()}
                      onChange={(date) => {
                        setTask(prev => {
                          const updated = { ...prev, customDate: date, dueDate: formatDateToDDMonYYYY(date) };
                          debouncedAutoSave(updated);
                          return updated;
                        });
                        setShowCalendar(false);
                      }}
                      inline
                      showYearDropdown
                      scrollableYearDropdown
                      yearDropdownItemNumber={100}
                      dateFormat="dd MMM yyyy"
                      className="border border-cyan-400 rounded p-2"
                    />
                  </div>
                )}
              </div>

              <div style={{ position:'relative' }}>
                <input
                  type="text"
                  style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #94a3b8', borderRadius:6, fontSize:13, color:'#333', fontWeight:600, outline:'none', background:'#fff', cursor:'pointer' }}
                  value={task.dueTime || "08:00 AM"}
                  readOnly
                  onClick={() => setShowClockTimePicker(true)}
                  placeholder="HH:MM AM/PM"
                  required
                />
              </div>
            </div>
          </div>

          {/* Repeat Section - only for Todo */}
          {typePill.cls === 'todo' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px' }}>Repeat Task</label>
            <div style={{ position:'relative' }}>
              <select
                style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #94a3b8', borderRadius:6, fontSize:13, color:'#333', fontWeight:600, outline:'none', background:'#fff', cursor:'pointer', appearance:'none', paddingRight:30, backgroundImage:"url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%2300aaff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 12 15 18 9\"></polyline></svg>')", backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center' }}
                value={task.repeatOption || "none"}
                onChange={(e) => {
                  const value = e.target.value;
                  setTask(prev => {
                    const updated = { ...prev, repeatOption: value };
                    if (value !== "custom") debouncedAutoSave(updated);
                    return updated;
                  });
                  if (value === "custom") {
                    setShowDaysSelector(true);
                  } else {
                    setShowDaysSelector(false);
                  }
                }}
              >
                <option value="none">Don't repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Repeat</option>
              </select>

              {task.repeatOption === "custom" && showDaysSelector && (
                <div style={{ marginTop:8, padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff' }}>
                  <div style={{ marginBottom:6, fontWeight:600, color:'#475569', fontSize:12 }}>Select days:</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <label key={day} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:12 }}>
                          <input
                            type="checkbox"
                            checked={task.repeatCustomDays?.includes(day) || false}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setTask((prev) => {
                                const currentDays = prev.repeatCustomDays || [];
                                let updated;
                                if (isChecked && !currentDays.includes(day)) {
                                  updated = { ...prev, repeatCustomDays: [...currentDays, day] };
                                } else if (!isChecked && currentDays.includes(day)) {
                                  updated = { ...prev, repeatCustomDays: currentDays.filter((d) => d !== day) };
                                } else {
                                  return prev;
                                }
                                debouncedAutoSave(updated);
                                return updated;
                              });
                            }}
                            style={{ accentColor:'#00aaff' }}
                          />
                          <span style={{ color:'#333' }}>{day}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Action Buttons — matching HTML design */}
          <div style={{ marginTop:16 }}>
            {(task.status === "COMPLETED" || task.status === "FAILED") ? (
              /* Completed/Failed → Reopen button */
              <div style={{ display:'flex', gap:12 }}>
                <button
                  type="button"
                  onClick={() => openRemarkModal('reopen')}
                  disabled={isLoading}
                  style={{ flex:1, background:'linear-gradient(135deg, #f59e0b, #d97706)', color:'#fff', border:'none', padding:13, borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(245,158,11,0.25)' }}
                >
                  {isLoading ? "Updating..." : "🔄 Reopen Task"}
                </button>
              </div>
            ) : (
              /* Active task → Complete + Schedule Next (callback/pendency) or Complete + Failed (todo) */
              <>
                {typePill.cls !== 'todo' ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <button
                      type="button"
                      onClick={() => openRemarkModal('complete')}
                      disabled={isLoading}
                      style={{ background:'#2ecc71', color:'#fff', border:'none', padding:14, borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' }}
                    >
                      {isLoading ? "Updating..." : "Mark Complete ✔"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openRemarkModal('fail')}
                      disabled={isLoading}
                      style={{ background:'#3498db', color:'#fff', border:'none', padding:14, borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 10px rgba(52,152,219,0.3)' }}
                    >
                      {isLoading ? "Updating..." : "Schedule Next ➡️"}
                    </button>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <button
                      type="button"
                      onClick={() => openRemarkModal('complete')}
                      disabled={isLoading}
                      style={{ background:'#2ecc71', color:'#fff', border:'none', padding:14, borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' }}
                    >
                      {isLoading ? "Updating..." : "Mark Complete ✔"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openRemarkModal('fail')}
                      disabled={isLoading}
                      style={{ background:'#fff', color:'#ff4757', border:'2px solid #ff4757', padding:14, borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' }}
                    >
                      {isLoading ? "Updating..." : "Mark as Failed ❌"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </form>

        {/* Comments and History Section - OUTSIDE the main form */}
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, marginTop:24, overflow:'hidden' }}>
          {/* Tab Header */}
          <div style={{ display:'flex', gap:0, background:'#fff', borderBottom:'1px solid #e2e8f0', borderRadius:'10px 10px 0 0' }}>
            <button
              type="button"
              onClick={toggleHistory}
              style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color: showHistory ? '#00aaff' : '#94a3b8', borderBottom: showHistory ? '3px solid #00aaff' : '3px solid transparent', marginBottom:-1, display:'flex', alignItems:'center', gap:6 }}
            >
              � History
              {historyData.length > 0 && <span style={{ background:'#e2e8f0', color:'#64748b', padding:'1px 7px', borderRadius:20, fontSize:11, marginLeft:4 }}>{historyData.filter(h => h.displayStatus !== 'comment').length}</span>}
            </button>
            <button
              type="button"
              onClick={toggleComments}
              style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color: showComments ? '#00aaff' : '#94a3b8', borderBottom: showComments ? '3px solid #00aaff' : '3px solid transparent', marginBottom:-1, display:'flex', alignItems:'center', gap:6 }}
            >
              💬 Comments
              {task.comments && task.comments.length > 0 && <span style={{ background:'#e2e8f0', color:'#64748b', padding:'1px 7px', borderRadius:20, fontSize:11, marginLeft:4 }}>{task.comments.length}</span>}
            </button>
          </div>

          {showComments && (
            <>
              <form onSubmit={handleCommentSubmit} style={{ padding:14 }}>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:12, marginBottom:12 }}>
                  <label style={{ fontSize:11, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>💬 Add Comment</label>
                  <textarea
                    value={task.newComment}
                    onChange={(e) => handleChange("newComment", e.target.value)}
                    onBlur={() => handleBlur("newComment")}
                    placeholder="Type your comment here..."
                    disabled={isLoading}
                    rows={3}
                    style={{ width:'100%', border:'1.5px solid #94a3b8', borderRadius:6, padding:'8px 12px', fontSize:13, color:'#334155', fontFamily:'inherit', resize:'none', minHeight:60, outline:'none', boxSizing:'border-box' }}
                    onKeyDown={(e) => {
                      if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        handleCommentSubmit(e);
                      }
                    }}
                  />
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                    <span style={{ fontSize:11, color:'#94a3b8', display:'flex', alignItems:'center', gap:4 }}>Press <kbd style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:3, padding:'1px 5px', fontSize:10, fontFamily:'monospace' }}>Ctrl+Enter</kbd> to submit</span>
                    <button
                      type="submit"
                      disabled={!task.newComment.trim() || isLoading}
                      style={{ background: (!task.newComment.trim() || isLoading) ? '#cbd5e1' : '#334155', color:'#fff', border:'none', padding:'7px 16px', borderRadius:6, fontSize:12, fontWeight:700, cursor: (!task.newComment.trim() || isLoading) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:5 }}
                    >
                      {isLoading ? "Adding..." : "➤ Add Comment"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Comments List */}
              <div style={{ padding:'0 14px 14px', display:'flex', flexDirection:'column', gap:10, maxHeight:400, overflowY:'auto' }}>
                {isLoadingComments ? (
                  <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>Loading comments...</div>
                ) : task.comments && task.comments.length > 0 ? (
                  task.comments.map((comment, idx) => (
                    <div key={comment.id || idx} style={{ background:'#fff', border:'1px solid #e2e8f0', borderLeft:'3px solid #00aaff', borderRadius:6, padding:'10px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#334155', display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ background:'#00aaff', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>{(comment.user || 'U').charAt(0).toUpperCase()}</span>
                          {(comment.user || 'Unknown').toUpperCase()}
                        </span>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>{comment.time}</span>
                      </div>
                      <div style={{ fontSize:13, color:'#475569', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{comment.text}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:13 }}>No comments yet</div>
                )}
              </div>
            </>
          )}

          {/* History Section — matching HTML reference exactly */}
          {showHistory && (
            <div style={{ padding:14 }}>
              {isLoadingHistory ? (
                <div style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:13 }}>Loading history...</div>
              ) : historyData && historyData.length > 0 ? (
                <div style={{ borderRadius:12, border:'1px solid #dbeafe', overflow:'hidden', background:'#fff' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'auto' }}>
                    <thead>
                      <tr style={{ background:'linear-gradient(135deg, #e8f4fd, #dbeafe)' }}>
                        <th style={{ padding:'12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:0.4, borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap', width:32 }}>#</th>
                        <th style={{ padding:'12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:0.4, borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap', width:96 }}>Status</th>
                        <th style={{ padding:'12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:0.4, borderBottom:'2px solid #bfdbfe' }}>Details &amp; Remark</th>
                        <th style={{ padding:'12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:0.4, borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap', width:128 }}>User</th>
                        <th style={{ padding:'12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:0.4, borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap', width:116 }}>Date &amp; Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.filter(item => item.displayStatus !== 'comment').slice().reverse().map((item, index) => {
                        // Status pill colors matching HTML
                        const statusStyles = {
                          created:    { bg:'#dbeafe', color:'#2563eb', label:'Created' },
                          completed:  { bg:'#dcfce7', color:'#16a34a', label:'Completed' },
                          failed:     { bg:'#fee2e2', color:'#dc2626', label:'Failed' },
                          reopened:   { bg:'#fef3c7', color:'#d97706', label:'Reopened' },
                          comment:    { bg:'#f3e8ff', color:'#7c3aed', label:'Comment' },
                          assignment: { bg:'#fef3c7', color:'#d97706', label:'Assignment' },
                          updated:    { bg:'#f3e8ff', color:'#7c3aed', label:'Updated' },
                          status:     { bg:'#dcfce7', color:'#16a34a', label:'Status' },
                        };
                        const st = statusStyles[item.displayStatus] || { bg:'#f1f5f9', color:'#64748b', label: item.displayStatus || 'Activity' };

                        return (
                          <tr key={item.id || index} style={{ borderBottom:'1px solid #f1f5f9' }}>
                            {/* # */}
                            <td style={{ padding:12, textAlign:'center', color:'#94a3b8', fontWeight:700, fontSize:12, width:32, verticalAlign:'top' }}>{index + 1}</td>
                            {/* Status pill */}
                            <td style={{ padding:12, verticalAlign:'top' }}>
                              <span style={{ display:'inline-block', background:st.bg, color:st.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:800, textTransform:'uppercase' }}>{st.label}</span>
                            </td>
                            {/* Details & Remark */}
                            <td style={{ padding:12, color:'#0f172a', lineHeight:1.7, fontWeight:500, overflowWrap:'anywhere', minWidth:0, verticalAlign:'top' }}>
                              {item.taskNote ? (
                                <div style={{ fontSize:13, color:'#334155', marginBottom:8, fontWeight:600, lineHeight:1.65, background:'#f8fafc', borderLeft:'3px solid #cbd5e1', padding:'8px 12px', borderRadius:4, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
                                  <span style={{ display:'inline-flex', marginRight:8, background:'#e2e8f0', color:'#475569', padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5 }}>Details</span>
                                  {item.taskNote}
                                </div>
                              ) : null}
                              {item.remark ? (
                                <div style={{ display:'inline-flex', flexDirection:'column', gap:4, background:'linear-gradient(135deg, #f0fdf4, #dcfce7)', border:'1px solid #bbf7d0', borderLeft:'3px solid #22c55e', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#166534', fontWeight:700, lineHeight:1.5, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
                                  <span style={{ color:'#15803d', background:'#bbf7d0', padding:'2px 6px', borderRadius:4, textTransform:'uppercase', fontSize:10, fontWeight:800, letterSpacing:0.4, flexShrink:0, alignSelf:'flex-start', marginBottom:4 }}>Remark</span>
                                  <span>{item.remark}</span>
                                </div>
                              ) : null}
                              {!item.taskNote && !item.remark && (
                                <span style={{ color:'#cbd5e1' }}>—</span>
                              )}
                            </td>
                            {/* User */}
                            <td style={{ padding:12, verticalAlign:'top' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                                <span style={{ background:'#00aaff', color:'#fff', width:24, height:24, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>{(item.createdBy || 'S').charAt(0)}</span>
                                <span style={{ fontSize:12, fontWeight:600, color:'#334155' }}>{item.createdBy || 'System'}</span>
                              </div>
                            </td>
                            {/* Date & Time */}
                            <td style={{ padding:12, fontSize:11, color:'#64748b', whiteSpace:'nowrap', verticalAlign:'top' }}>
                              <div>{item.date}</div>
                              {item.time && <div>{item.time}</div>}
                            </td>
                          </tr>
                        );
                      })}
                      {historyData.filter(item => item.displayStatus !== 'comment').length === 0 && (
                        <tr><td colSpan="5" style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:13 }}>📭 No history yet for this task.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:13 }}>📭 No history yet for this task.</div>
              )}
            </div>
          )}
        </div>
        {/* end scrollable body */}
        </div>
      </div>

      {/* Assign Popup */}
      {showAssignPopup && (
        <AssignPopup
          onClose={() => setShowAssignPopup(false)}
          onSelect={(user) => {
            handleAddAssignee(user);
            setShowAssignPopup(false);
          }}
        />
      )}

      {/* Clock Time Picker */}
      {showClockTimePicker && (
        <ClockTimePicker
          onClose={() => setShowClockTimePicker(false)}
          onTimeSelect={handleTimeSelect}
          initialTime={task.dueTime}
        />
      )}

      {/* Remark Modal */}
      {remarkModalOpen && (
        <div
          onClick={closeRemarkModal}
          style={{ position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:14, padding:'30px 32px', width:'100%', maxWidth:520, boxShadow:'0 20px 50px rgba(0,0,0,0.4)' }}
          >
            {/* Icon */}
            <div style={{
              width:52, height:52, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22, margin:'0 auto 16px',
              background: remarkType === 'complete' ? '#dcfce7' : remarkType === 'fail' ? '#fee2e2' : '#fef3c7'
            }}>
              {remarkType === 'complete' ? '✅' : remarkType === 'fail' ? '❌' : '🔄'}
            </div>

            {/* Title */}
            <div style={{ textAlign:'center', fontSize:17, fontWeight:800, color:'#1e293b', marginBottom:5 }}>
              {remarkType === 'complete' ? 'Mark as Complete' : remarkType === 'fail' ? 'Mark as Failed' : 'Reopen Task'}
            </div>

            {/* Subtitle */}
            <div style={{ textAlign:'center', fontSize:12, color:'#64748b', marginBottom:16 }}>
              {remarkType === 'complete'
                ? 'Please add a remark before marking this complete.'
                : remarkType === 'fail'
                ? 'Please add a reason before marking this as failed.'
                : 'Please add a reason for reopening this task.'}
            </div>

            {/* Textarea */}
            <textarea
              value={remarkText}
              onChange={e => { setRemarkText(e.target.value); if (remarkError) setRemarkError(false); }}
              placeholder={
                remarkType === 'complete'
                  ? 'What was done? Add completion note... (required)'
                  : remarkType === 'fail'
                  ? 'Why did this task fail? Add reason... (required)'
                  : 'Why are you reopening this task? (required)'
              }
              style={{
                width:'100%', padding:'10px 12px', border: remarkError ? '1.5px solid #ef4444' : '1.5px solid #94a3b8',
                borderRadius:6, fontSize:13, color:'#334155', resize:'none', minHeight:80, outline:'none',
                fontFamily:'inherit', boxSizing:'border-box',
                boxShadow: remarkError ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none'
              }}
              onFocus={e => { if (!remarkError) { e.target.style.borderColor = '#00aaff'; e.target.style.boxShadow = '0 0 0 3px rgba(0,170,255,0.1)'; } }}
              onBlur={e => { if (!remarkError) { e.target.style.borderColor = '#94a3b8'; e.target.style.boxShadow = 'none'; } }}
            />

            {/* Error message */}
            {remarkError && (
              <div style={{ color:'#ef4444', fontSize:11, fontWeight:600, marginTop:5 }}>
                ⚠️ Remark is mandatory. Please enter a comment.
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:20 }}>
              <button
                type="button"
                onClick={closeRemarkModal}
                style={{ background:'#f1f5f9', color:'#64748b', border:'none', padding:12, borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemark}
                style={{
                  border:'none', padding:12, borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', color:'#fff',
                  background: remarkType === 'complete'
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : remarkType === 'fail'
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #f59e0b, #d97706)'
                }}
              >
                {remarkType === 'complete' ? 'Mark Complete ✔' : remarkType === 'fail' ? 'Mark as Failed ❌' : 'Reopen Task 🔄'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AssociatePopupEditTask component - Similar to CreateTask's AssociatePopup
function AssociatePopupEditTask({ onClose, onSelect, loanTypes, leads, loadingLoanTypes, loadingLeads, onFetchLeads }) {
  const [selectedRecordType, setSelectedRecordType] = useState("");
  const [selectedLoanType, setSelectedLoanType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecords, setSelectedRecords] = useState([]); // Store actual lead objects, not strings (single selection only)

  // Format a lead object into a display string
  const formatLeadDisplay = (lead) => {
    const leadType = lead.lead_login || 'Lead';
    return `${lead.customer_name} - ${lead.phone || lead.email || 'No contact'} (${lead.status}) [${leadType}]`;
  };

  // Get leads filtered by search term
  const getFilteredLeads = () => {
    if (!selectedLoanType || !leads) return [];
    
    // Filter by search term if present
    if (searchTerm.trim() === "") {
      return leads;
    }

    return leads.filter(
      (lead) =>
        lead.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone && lead.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        lead.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredLeads = getFilteredLeads();

  const toggleRecord = (record) => {
    // Single selection - replace any existing selection with the new one
    const recordWithLoanType = {
      ...record,
      name: record.customer_name || record.name, // Ensure 'name' property exists
      loan_type: selectedLoanType, // Add the currently selected loan type
      loanType: selectedLoanType   // Add both formats for compatibility
    };
    setSelectedRecords([recordWithLoanType]); // Always replace with single selection
  };

  // Check if a record is selected
  const isRecordSelected = (record) => {
    return selectedRecords.some(selected => selected.id === record.id);
  };

  // Handle loan type selection
  const handleLoanTypeSelect = (loanType) => {
    setSelectedLoanType(loanType);
    setSearchTerm("");
    // Fetch leads based on the selected record type
    const recordType = selectedRecordType.toLowerCase();
    onFetchLeads(loanType, recordType);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
    >
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[90%] max-w-5xl mx-auto flex max-h-[90vh] overflow-hidden relative">
        <div className="w-1/4 border-r p-4 bg-white bg-opacity-80 rounded-l-2xl">
          <h3 className="font-bold mb-4 text-lg text-black">Record Types</h3>
          <div className="space-y-3">
            {/* Leads record type button */}
            <button
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition ${
                selectedRecordType === "Leads"
                  ? "bg-cyan-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => {
                setSelectedRecordType("Leads");
                setSelectedLoanType(""); // Reset loan type when parent is clicked
                setSearchTerm("");
              }}
            >
              Leads
            </button>
            
            {/* Show loan types only if Leads is selected */}
            {selectedRecordType === "Leads" && (
              <div className="ml-4 space-y-2 mt-2 border-l-2 border-cyan-300 pl-3">
                {loadingLoanTypes ? (
                  <div className="text-gray-500 text-sm">Loading loan types...</div>
                ) : (
                  loanTypes.map((loanType) => (
                    <button
                      key={loanType.id}
                      className={`w-full text-left px-4 py-2 rounded-lg font-medium transition ${
                        selectedLoanType === loanType.name
                          ? "bg-cyan-100 text-cyan-800 shadow-sm"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => handleLoanTypeSelect(loanType.name)}
                    >
                      {loanType.name} ({loanType.lead_count || 0})
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Login record type button */}
            <button
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition ${
                selectedRecordType === "Login"
                  ? "bg-cyan-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => {
                setSelectedRecordType("Login");
                setSelectedLoanType(""); // Reset loan type when parent is clicked
                setSearchTerm("");
              }}
            >
              Login
            </button>
            
            {/* Show loan types only if Login is selected */}
            {selectedRecordType === "Login" && (
              <div className="ml-4 space-y-2 mt-2 border-l-2 border-cyan-300 pl-3">
                {loadingLoanTypes ? (
                  <div className="text-gray-500 text-sm">Loading loan types...</div>
                ) : (
                  loanTypes.map((loanType) => (
                    <button
                      key={loanType.id}
                      className={`w-full text-left px-4 py-2 rounded-lg font-medium transition ${
                        selectedLoanType === loanType.name
                          ? "bg-cyan-100 text-cyan-800 shadow-sm"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => handleLoanTypeSelect(loanType.name)}
                    >
                      {loanType.name} ({loanType.login_count || 0})
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-3/4 p-6 overflow-y-auto bg-white bg-opacity-80 rounded-r-2xl">
          {selectedLoanType ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-xl text-black">
                    {selectedLoanType}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Select a {selectedRecordType.toLowerCase().slice(0, -1)} to associate with this task
                  </p>
                </div>
                <div className="relative w-1/2">
                  <input
                    type="text"
                    placeholder={`Search ${selectedLoanType}`}
                    className="border px-4 py-2 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-cyan-500 text-black"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setSearchTerm("")}
                      type="button"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {loadingLeads ? (
                <div className="text-center text-gray-500 mt-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                  <p>Loading leads...</p>
                </div>
              ) : filteredLeads.length > 0 ? (
                <ul className="space-y-3">
                  {filteredLeads.map((lead) => {
                    const leadDisplay = formatLeadDisplay(lead);
                    const isSelected = isRecordSelected(lead);
                    return (
                      <li
                        key={lead.id}
                        className={`p-4 border rounded-xl cursor-pointer transition text-black ${
                          isSelected
                            ? "bg-cyan-100 border-cyan-500 shadow"
                            : "hover:bg-gray-100"
                        }`}
                        onClick={() => toggleRecord(lead)}
                      >
                        <div className="flex items-center">
                          <div className="flex-1">{leadDisplay}</div>
                          {isSelected && (
                            <div className="text-cyan-500">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-gray-500 text-center mt-20 text-lg">
                  {searchTerm
                    ? `No ${selectedRecordType.toLowerCase()} found matching "${searchTerm}"`
                    : `No ${selectedRecordType.toLowerCase()} available`}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">Please select a record type</p>
              <p className="text-sm">Select a record type from the left panel to view records</p>
            </div>
          )}

          {/* Show buttons only if a loan type is selected */}
          {selectedLoanType && (
            <div className="flex justify-end gap-4 mt-8">
              <button
                className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition"
                onClick={() => onSelect(selectedRecords)}
                disabled={selectedRecords.length === 0}
              >
                Select ({selectedRecords.length > 0 ? `1 lead selected` : 'No lead selected'})
              </button>
              <button
                className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          )}
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
