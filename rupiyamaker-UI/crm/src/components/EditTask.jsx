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
            designation: user.role || user.designation || ''
          }));
        }

        // Filter out entries with empty names
        setUsers(usersList.filter(user => user.name));
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
  const [isEditing, setIsEditing] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // State for API data (similar to CreateTask)
  const [users, setUsers] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showAssociatePopup, setShowAssociatePopup] = useState(false);

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
    };
  }, []);

  const messageRef = useRef(null);
  
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
        console.log("Processing history item:", item);
        
        // Use the action field as the main display text
        let changes = item.action || "Activity recorded";
        
        // Clean up status values by removing "TaskStatus." prefix
        changes = changes.replace(/TaskStatus\./g, '');
        
        // Format different action types for better readability
        if (item.action_type === 'created') {
          changes = `TASK CREATED - ${item.details?.task_title || 'New Task'}`;
        } else if (item.action_type === 'status_changed') {
          const oldStatus = item.details?.old_status?.replace('TaskStatus.', '') || 'Unknown';
          const newStatus = item.details?.new_status?.replace('TaskStatus.', '') || 'Unknown';
          changes = `STATUS CHANGED: ${oldStatus.toUpperCase()} → ${newStatus.toUpperCase()}`;
        } else if (item.action_type === 'comment_added') {
          const commentPreview = item.details?.comment_preview || 'Comment';
          changes = `COMMENT ADDED: "${commentPreview}"`;
        } else if (item.action_type === 'assignment_changed') {
          const oldAssignees = item.details?.old_assignees?.join(', ') || 'None';
          const newAssignees = item.details?.new_assignees?.join(', ') || 'None';
          changes = `ASSIGNMENT CHANGED: ${oldAssignees} → ${newAssignees}`;
        } else if (item.action_type === 'updated') {
          // For general updates, use the change summary if available
          changes = item.details?.change_summary?.replace(/TaskStatus\./g, '').toUpperCase() || changes.toUpperCase();
        }
        
        return {
          id: item.id,
          date: item.created_at ? new Date(item.created_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }).toUpperCase() : "UNKNOWN DATE",
          time: item.created_at ? new Date(item.created_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }).toUpperCase() : "",
          createdBy: (item.created_by_name || "Unknown").toUpperCase(),
          changes: changes.toUpperCase(),
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
      
      // Use fallback dummy data if API fails - based on the example image
      setHistoryData([
        { id: 1, date: "24 JUN 2025", createdBy: "ADMIN", changes: "REOPEN" },
        { id: 2, date: "24 JUN 2025", createdBy: "ADMIN", changes: "TASK CLOSED" },
        { id: 3, date: "11 JUN 2025", createdBy: "ADMIN", changes: "REOPEN" },
        { id: 4, date: "11 JUN 2025", createdBy: "ADMIN", changes: "TASK CLOSED" },
        { id: 5, date: "11 JUN 2025", createdBy: "ADMIN", changes: "OPEN TASK" },
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
    setTask(prev => ({
      ...prev,
      associateWithRecords: selectedRecords
    }));
    setShowAssociatePopup(false);
  };

  // Handle time selection from ClockTimePicker
  const handleTimeSelect = (time) => {
    setTask(prev => ({
      ...prev,
      dueTime: time
    }));
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

        toast.success("Task updated successfully");
      }

      // Exit edit mode after successful update
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating task:", err);
      
      // Provide specific error messages based on error type
      if (err.response?.status === 500) {
        setError("Server error occurred. Please try again later.");
        toast.error("Server error: Unable to update task. Please try again later.");
      } else if (err.response?.status === 404) {
        setError("Task not found. It may have been deleted.");
        toast.error("Task not found. It may have been deleted by another user.");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to update this task.");
        toast.error("Permission denied: You cannot update this task.");
      } else if (err.response?.status === 400) {
        setError("Invalid task data. Please check your inputs.");
        toast.error("Invalid data: Please check all required fields.");
      } else if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
        toast.error("Network error: Please check your internet connection.");
      } else {
        setError("Failed to update task. Please try again.");
        toast.error("Failed to update task. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle completing/reopening task
  const handleCompleteReopenTask = async () => {
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
        };
        
        console.log(`🚀 Triggering immediate parent update for status change`);
        console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));
        
        // Call onSave immediately to trigger parent's immediate update logic
        await onSave(updatePayload);
        
        toast.success(`Task ${backendStatus.toLowerCase()} successfully`);
      }
    } catch (err) {
      console.error("Error updating task status:", err);
      
      // Revert local state on error
      setTask(prev => ({
        ...prev,
        status: task.status // Revert to original status
      }));
      
      // Provide specific error messages for status update
      if (err.response?.status === 500) {
        setError("Server error while updating status. Please try again later.");
        toast.error("Server error: Unable to update task status. Please try again later.");
      } else if (err.response?.status === 404) {
        setError("Task not found. It may have been deleted.");
        toast.error("Task not found. It may have been deleted by another user.");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to update this task status.");
        toast.error("Permission denied: You cannot update this task status.");
      } else if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
        toast.error("Network error: Please check your internet connection.");
      } else {
        setError("Failed to update task status. Please try again.");
        toast.error("Failed to update task status. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFailedTask = async () => {
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
        };
        
        console.log(`🚀 Triggering immediate parent update for status change: ${previousStatus} → ${backendStatus} (UI: ${newStatus})`);
        console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));
        
        // Call onSave immediately to trigger parent's immediate update logic
        await onSave(updatePayload);
        
        toast.success(`Task ${backendStatus.toLowerCase()} successfully`);
      }
    } catch (err) {
      console.error("Error updating task status:", err);
      
      // Revert local state on error
      setTask(prev => ({
        ...prev,
        status: task.status // Revert to original status
      }));
      
      // Provide specific error messages for status update
      if (err.response?.status === 500) {
        setError("Server error while updating status. Please try again later.");
        toast.error("Server error: Unable to update task status. Please try again later.");
      } else if (err.response?.status === 404) {
        setError("Task not found. It may have been deleted.");
        toast.error("Task not found. It may have been deleted by another user.");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to update this task status.");
        toast.error("Permission denied: You cannot update this task status.");
      } else if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
        toast.error("Network error: Please check your internet connection.");
      } else {
        setError("Failed to update task status. Please try again.");
        toast.error("Failed to update task status. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    console.log("Selected files for attachment:", files.map(f => ({ name: f.name, type: f.type, size: f.size })));

    if (files.length > 0) {
      // Validate file types - must match backend validation exactly
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      
      const validFiles = [];
      const rejectedFiles = [];

      files.forEach(file => {
        // Check file type
        if (!allowedTypes.includes(file.type)) {
          rejectedFiles.push({ file, reason: 'Invalid file type. Only JPEG, PNG, GIF images and PDF files are allowed.' });
          return;
        }
        
        // Check file size
        if (file.size > maxSize) {
          rejectedFiles.push({ file, reason: 'File size exceeds 10MB limit.' });
          return;
        }
        
        validFiles.push(file);
      });

      // Show errors for rejected files
      if (rejectedFiles.length > 0) {
        const errorMessages = rejectedFiles.map(({ file, reason }) => `${file.name}: ${reason}`);
        alert('Some files were rejected:\n\n' + errorMessages.join('\n'));
      }

      // Process valid files
      if (validFiles.length > 0) {
        const newAttachments = validFiles.map((file) => ({
          id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique ID for tracking
          file,
          name: file.name,
          url: URL.createObjectURL(file),
          isNew: true,
          isFromBackend: false  // Explicitly mark as not from backend
        }));

        console.log("Created new attachment objects:", newAttachments);

        setTask((prev) => {
          const updatedTask = {
            ...prev,
            attachments: [...prev.attachments, ...newAttachments],
            newAttachments: [...prev.newAttachments, ...newAttachments],
            showAttachments: true,
          };
          console.log("Updated task with new attachments:", updatedTask.newAttachments);
          return updatedTask;
        });

        // Clear the input to allow selecting the same file again if needed
        e.target.value = '';
      } else {
        // Clear the input if no valid files
        e.target.value = '';
      }
    }
  };

  const handleChange = (field, value) => {
    setTask((prev) => ({ ...prev, [field]: value }));
  };

  // Handle blur - apply uppercase when user leaves the field
  const handleBlur = (field) => {
    const excludeFromUppercase = ['id', 'assignTo', 'priority', 'status', 'type', 'dueDate', 'dueTime'];
    if (excludeFromUppercase.includes(field) || typeof task[field] !== 'string') {
      return;
    }
    setTask((prev) => ({ ...prev, [field]: prev[field].toUpperCase() }));
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

      return {
        ...prevTask,
        assignedTo: updatedAssignedTo,
        assign: assigneeNames.join(", "),
        assigned_users: updatedAssignedUserIds
      };
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

        return {
          ...prevTask,
          assignedTo: updatedAssignedTo,
          assign: assigneeNames.join(", "),
          assigned_users: updatedAssignedUserIds
        };
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

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
      <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-5xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        <h2 className="text-xl font-bold text-green-600 mb-4">EDIT TASK</h2>

        {/* Network Status Indicator */}
        {!isOnline && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>No internet connection. Some features may not work properly.</span>
          </div>
        )}

        {/* Show error message if any */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEditSubmit}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1">
                Date & Time
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={currentDateTime}
                readOnly
              />
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="createdBy">
                Created By
              </label>
              <input
                id="createdBy"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={task.createdBy}
                onChange={(e) => handleChange("createdBy", e.target.value)}
                required
                readOnly
              />
            </div>
          </div>

          <div className="mt-4">
            <label
              className="block font-bold text-gray-700 mb-1"
              htmlFor="title"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold ${!isEditing ? 'bg-gray-100' : ''}`}
              value={task.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Enter task title"
              required
              readOnly={!isEditing}
            />
          </div>

          <div className="mt-4">
            <label
              className="block font-bold text-gray-700 mb-1"
              htmlFor="description"
            >
              Task Description
            </label>
            <textarea
              ref={messageRef}
              id="description"
              className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none overflow-hidden ${!isEditing ? 'bg-gray-100' : ''}`}
              rows={3}
              value={task.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Enter task description..."
              required
              readOnly={!isEditing}
              style={{
                minHeight: "3rem",
                maxHeight: "400px",
                transition: "height 0.2s",
              }}
            />
          </div>

          {/* Associate with Records Field */}
          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Associate with records
            </label>
            <div
              className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold min-h-[42px] flex items-center ${!isEditing ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
              onClick={() => {
                if (isEditing) {
                  // Fetch data when popup is opened
                  fetchUsers();
                  fetchLoanTypes();
                  setShowAssociatePopup(true);
                }
              }}
            >
              {task.associateWithRecords && task.associateWithRecords.length > 0
                ? task.associateWithRecords.length === 1 
                  ? `${task.associateWithRecords[0].name || task.associateWithRecords[0].customer_name || 'Selected Lead'}`
                  : `${task.associateWithRecords.length} record(s) selected`
                : "Associated with 0 records"}
            </div>
          </div>

          <div className="flex flex-col items-start mt-4">
            <label className="block font-bold text-gray-700 mb-2">
              Attachment
            </label>
            <label className={`inline-flex items-center px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow cursor-pointer hover:bg-cyan-600 transition ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
              Photo/PDF
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleAttachmentChange}
                multiple
                disabled={!isEditing}
              />
            </label>

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
                      {isEditing && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          onClick={() => handleRemoveBackendAttachment(attachment)}
                          title="Remove attachment"
                        >
                          ×
                        </button>
                      )}
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
                      {isEditing && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          onClick={() => handleRemoveNewAttachment(attachment)}
                          title="Remove attachment"
                        >
                          ×
                        </button>
                      )}
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

          {/* Modified Assignee Section for multiple assignees */}
          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Assignee
            </label>
            <div className="flex flex-wrap items-center gap-2 border border-cyan-400 rounded-md bg-white p-1 pr-2 min-h-[42px]">
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
                    key={index} // Using index as key since we might have duplicate names
                    className="bg-green-100 text-green-800 py-2 px-3 rounded-md flex items-center"
                  >
                    {/* Profile icon with initials */}
                    <div className="w-8 h-8 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3 text-xs flex-shrink-0 font-medium">
                      {displayName.split(' ')
                        .map(part => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{displayName}</span>
                      {designation && (
                        <span className="text-xs text-green-600 opacity-80">{designation}</span>
                      )}
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="ml-3 text-green-500 hover:text-green-700 font-bold text-lg"
                        onClick={() => handleRemoveAssignee(displayName)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              {isEditing && (
                <button
                  type="button"
                  className="text-green-600 font-medium hover:text-green-800 ml-auto" // Pushed to the right
                  onClick={() => setShowAssignPopup(true)}
                >
                  + Add more
                </button>
              )}
            </div>
          </div>
          {/* End of Modified Assignee Section */}

          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Due date {task.dueDateOption === "custom" && task.dueDate && (
                <span className="text-sm font-normal text-gray-600">
                  (Selected: {task.dueDate})
                </span>
              )}
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <select
                  ref={dueDateSelectRef}
                  className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold ${!isEditing ? 'bg-gray-100' : 'bg-gray-100'}`}
                  value={task.dueDateOption || "today"}
                  onChange={(e) => {
                    if (!isEditing) return;
                    const value = e.target.value;
                    if (value === "today") {
                      handleChange("dueDateOption", "today");
                      handleChange("dueDate", getTodayDate());
                      handleChange("customDate", null);
                      setShowCalendar(false);
                    } else if (value === "tomorrow") {
                      handleChange("dueDateOption", "tomorrow");
                      handleChange("dueDate", getTomorrowDate());
                      handleChange("customDate", null);
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
                    // When dropdown opens and custom is already selected, show calendar
                    if (isEditing && task.dueDateOption === "custom") {
                      setShowCalendar(true);
                    }
                  }}
                  disabled={!isEditing}
                  required
                >
                  <option value="today">Today ({getTodayDate()})</option>
                  <option value="tomorrow">Tomorrow ({getTomorrowDate()})</option>
                  <option value="custom">
                    Custom Date
                  </option>
                </select>

                {task.dueDateOption === "custom" && showCalendar && isEditing && (
                  <div 
                    className={`absolute bg-white border border-cyan-400 rounded shadow-lg z-[9999] ${
                      calendarPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
                    }`}
                  >
                    <DatePicker
                      selected={task.customDate || new Date()}
                      onChange={(date) => {
                        handleChange("customDate", date);
                        handleChange("dueDate", formatDateToDDMonYYYY(date));
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

              <div className="flex-1 relative">
                <input
                  type="text"
                  className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${!isEditing ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-100 cursor-pointer'}`}
                  value={task.dueTime || "08:00 AM"}
                  readOnly
                  onClick={() => isEditing && setShowClockTimePicker(true)}
                  placeholder="HH:MM AM/PM"
                  required
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Repeat Task
            </label>
            <div className="relative">
              <select
                className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold ${!isEditing ? 'bg-gray-100' : 'bg-gray-100'}`}
                value={task.repeatOption || "none"}
                onChange={(e) => {
                  if (!isEditing) return;
                  const value = e.target.value;
                  handleChange("repeatOption", value);
                  if (value === "custom") {
                    setShowDaysSelector(true);
                  } else {
                    setShowDaysSelector(false);
                  }
                }}
                disabled={!isEditing}
              >
                <option value="none">Don't repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Repeat</option>
              </select>

              {task.repeatOption === "custom" && showDaysSelector && isEditing && (
                <div className="mt-2 p-4 border border-cyan-400 rounded bg-white">
                  <div className="mb-2 font-medium text-gray-700">
                    Select days:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <label key={day} className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-1 w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                            checked={task.repeatCustomDays?.includes(day) || false}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setTask((prev) => {
                                const currentDays = prev.repeatCustomDays || [];
                                if (isChecked && !currentDays.includes(day)) {
                                  return {
                                    ...prev,
                                    repeatCustomDays: [...currentDays, day],
                                  };
                                } else if (!isChecked && currentDays.includes(day)) {
                                  return {
                                    ...prev,
                                    repeatCustomDays: currentDays.filter(
                                      (d) => d !== day
                                    ),
                                  };
                                }
                                return prev;
                              });
                            }}
                          />
                          <span className="text-sm text-black">{day}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            {/* Show Reopen button for Completed or Failed tasks */}
            {console.log('🔍 Button rendering - task.status:', task.status, 'Type:', typeof task.status)}
            {(task.status === "COMPLETED" || task.status === "FAILED") ? (
              <>
                {console.log('✅ Showing Reopen + Edit buttons (Completed/Failed state)')}
                <button
                  type="button"
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition text-lg"
                  onClick={handleCompleteReopenTask}
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Reopen Task"}
                </button>

                {!isEditing && (
                  <button
                    type="button"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded-lg shadow hover:bg-orange-700 transition text-lg"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Task
                  </button>
                )}
              </>
            ) : (
              <>
                {console.log('✅ Showing Complete + Failed + Edit buttons (Active task state)')}
                {/* Show Complete, Failed, and Edit buttons for active tasks */}
                <button
                  type="button"
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition text-lg"
                  onClick={handleCompleteReopenTask}
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Complete Task"}
                </button>

                <button
                  type="button"
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700 transition text-lg"
                  onClick={handleFailedTask}
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Failed Task"}
                </button>

                {!isEditing && (
                  <button
                    type="button"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded-lg shadow hover:bg-orange-700 transition text-lg"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Task
                  </button>
                )}
              </>
            )}

            {/* Update Button - Only show when in edit mode */}
            {isEditing && (
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Task"}
              </button>
            )}
          </div>
        </form>

        {/* Comments and History Section - OUTSIDE the main form */}
        <div className="mt-6 border-t pt-4">
          <div className="flex space-x-2">
            <button
              type="button"
              className={`px-4 py-2 font-semibold rounded-lg shadow ${showComments ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              onClick={toggleComments}
            >
              ➕ Comments
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-semibold rounded-lg shadow ${showHistory ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              onClick={toggleHistory}
            >
              📜 History
            </button>
          </div>

          {/* Comments Section */}
          {showComments && (
            <>
              <form onSubmit={handleCommentSubmit} className="mt-4">
                <div className="bg-white border-2 border-green-200 rounded-lg p-3 shadow-sm">
                  <label className="block text-sm font-bold text-gray-700 mb-2">💬 ADD COMMENT</label>
                  <textarea
                    value={task.newComment}
                    onChange={(e) => handleChange("newComment", e.target.value)}
                    onBlur={() => handleBlur("newComment")}
                    placeholder="Type your comment here... (Press Enter for new line, Ctrl+Enter to submit)"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    disabled={isLoading}
                    rows={3}
                    style={{ minHeight: '80px' }}
                    onKeyDown={(e) => {
                      // Submit on Ctrl+Enter
                      if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        handleCommentSubmit(e);
                      }
                    }}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">Press <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Enter</kbd> to submit</span>
                    <button
                      type="submit"
                      disabled={!task.newComment.trim() || isLoading}
                      className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        !task.newComment.trim() || isLoading
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700 hover:shadow-md"
                      }`}
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>ADDING...</span>
                        </div>
                      ) : (
                        "➤ ADD COMMENT"
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Comments Display - Modern Chat Style */}
              <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {isLoadingComments ? (
                  <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2 font-bold">LOADING COMMENTS...</p>
                  </div>
                ) : task.comments && task.comments.length > 0 ? (
                  <>
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                      💬 {task.comments.length} {task.comments.length === 1 ? 'Comment' : 'Comments'}
                    </div>
                    {task.comments.map((comment, idx) => (
                      <div key={comment.id || idx} className="bg-gradient-to-r from-white to-green-50 border-2 border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                        {/* Comment Header */}
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-green-200">
                          <div className="flex items-center gap-2">
                            {/* User Avatar */}
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                              {(comment.user || 'U').charAt(0).toUpperCase()}
                            </div>
                            {/* User Name */}
                            <span className="font-bold text-gray-800 text-sm">
                              {(comment.user || 'UNKNOWN USER').toUpperCase()}
                            </span>
                            {/* Comment Number Badge */}
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              #{idx + 1}
                            </span>
                          </div>
                          {/* Timestamp */}
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                            </svg>
                            <span className="font-semibold">{comment.time}</span>
                          </div>
                        </div>
                        
                        {/* Comment Content */}
                        <div className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                          {comment.text}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-green-50 rounded-lg border-2 border-dashed border-green-300">
                    <div className="text-5xl mb-3">💬</div>
                    <p className="text-gray-600 font-bold text-lg">NO COMMENTS YET</p>
                    <p className="text-sm text-gray-500 mt-1">Be the first to share your thoughts!</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* History Section - Modern Table Design */}
          {showHistory && (
            <div className="mt-4">
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto"></div>
                  <p className="text-gray-500 mt-3 font-medium">Loading history...</p>
                </div>
              ) : historyData && historyData.length > 0 ? (
                <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      {/* Table Header - Sticky */}
                      <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">#</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">TYPE</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">DETAILS</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">USER</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">DATE & TIME</th>
                        </tr>
                      </thead>
                      
                      {/* Table Body */}
                      <tbody className="divide-y divide-gray-200">
                        {historyData.map((item, index) => {
                          const rowBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-white';
                          
                          // Determine activity type and styling
                          let activityIcon = '📌';
                          let activityLabel = 'ACTIVITY';
                          let badgeColor = 'bg-gray-100 text-gray-800';

                          if (item.actionType === 'created') {
                            activityIcon = '📝';
                            activityLabel = 'CREATED';
                            badgeColor = 'bg-blue-100 text-blue-800';
                          } else if (item.actionType === 'status_changed') {
                            activityIcon = '🔄';
                            activityLabel = 'STATUS';
                            badgeColor = 'bg-green-100 text-green-800';
                          } else if (item.actionType === 'comment_added') {
                            activityIcon = '💬';
                            activityLabel = 'COMMENT';
                            badgeColor = 'bg-purple-100 text-purple-800';
                          } else if (item.actionType === 'assignment_changed') {
                            activityIcon = '👤';
                            activityLabel = 'ASSIGNMENT';
                            badgeColor = 'bg-orange-100 text-orange-800';
                          } else if (item.actionType === 'updated') {
                            activityIcon = '✏️';
                            activityLabel = 'UPDATED';
                            badgeColor = 'bg-yellow-100 text-yellow-800';
                          }

                          return (
                            <tr key={item.id || index} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                              {/* Serial Number */}
                              <td className="px-4 py-3 text-sm font-bold text-gray-700 border-r border-gray-200">
                                {index + 1}
                              </td>
                              
                              {/* Activity Type Badge */}
                              <td className="px-4 py-3 border-r border-gray-200">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                                  {activityIcon} {activityLabel}
                                </span>
                              </td>
                              
                              {/* Details */}
                              <td className="px-4 py-3 text-sm font-semibold text-gray-800 border-r border-gray-200">
                                {item.changes}
                              </td>
                              
                              {/* User */}
                              <td className="px-4 py-3 text-sm font-bold text-gray-700 border-r border-gray-200">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                                    {(item.createdBy || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  {(item.createdBy || 'UNKNOWN').toUpperCase()}
                                </div>
                              </td>
                              
                              {/* Date & Time */}
                              <td className="px-4 py-3 text-sm">
                                <div className="font-bold text-gray-700">{item.date}</div>
                                <div className="font-semibold text-gray-500 text-xs">{item.time}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
                  <div className="text-5xl mb-3">📋</div>
                  <p className="text-gray-600 font-bold text-lg">NO HISTORY AVAILABLE</p>
                  <p className="text-sm text-gray-400 mt-2">Activity will appear here as actions are performed</p>
                </div>
              )}
            </div>
          )}
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

      {/* Associate Popup */}
      {showAssociatePopup && (
        <AssociatePopupEditTask
          onClose={() => setShowAssociatePopup(false)}
          onSelect={handleAssociateSelect}
          loanTypes={loanTypes}
          leads={leads}
          loadingLoanTypes={loadingLoanTypes}
          loadingLeads={loadingLeads}
          onFetchLeads={fetchLeads}
        />
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
