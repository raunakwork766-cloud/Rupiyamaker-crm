"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ClockTimePicker from "./ClockTimePicker"; // Adjust path as needed
import API from '../services/api';
import { formatDateTime, formatDate } from '../utils/dateUtils';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

function getCurrentDateTimeString() {
  return formatDateTime(new Date());
}

export default function CreateTask({ onClose, onSave, preselectedLead }) {
  // State for API data
  const [users, setUsers] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // State to track if we're in a lead context (preselectedLead was provided)
  const [isLeadPreselected, setIsLeadPreselected] = useState(!!preselectedLead);
  
  // Effect to handle preselectedLead
  useEffect(() => {
    if (preselectedLead && preselectedLead._id) {
      // Format the lead data to match our form needs
      const leadForAssociation = {
        id: preselectedLead._id,
        lead_id: preselectedLead._id,
        name: preselectedLead.full_name || `${preselectedLead.first_name || ''} ${preselectedLead.last_name || ''}`.trim() || 'Customer',
        lead_number: preselectedLead.lead_number || '',
        loan_type: preselectedLead.loan_type || preselectedLead.loanType || ''
      };
      
      // Set the preselected lead in the associateWithRecords array
      setForm(prev => ({
        ...prev,
        associateWithRecords: [leadForAssociation]
      }));
      
      // If we have loan type, no need to fetch leads
      if (leadForAssociation.loan_type) {
        console.log('Lead preselected with loan type:', leadForAssociation.loan_type);
      }
    }
  }, [preselectedLead]);

  // Get userId from localStorage
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

  // Fetch users for assignment
  const fetchUsers = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    
    setLoadingUsers(true);
    try {
      console.log('Fetching users for task assignment in CreateTask...');
      // ⚡ FIX: Use tasks API endpoint that returns ALL users without hierarchical filtering
      // This allows employees to assign tasks to anyone, not just themselves
      const response = await API.tasks.getUsersForAssignment();
      console.log('Users API response in CreateTask:', response);
      
      // Handle the response structure from /tasks/users-for-assignment
      let usersList = [];
      if (response && response.users && Array.isArray(response.users)) {
        usersList = response.users.map(user => ({
          id: user.user_id || user.id,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          role: user.role || '',
          designation: user.role || user.designation || ''
        }));
      }

      // Filter out entries with empty names
      const validUsers = usersList.filter(user => user.name);
      console.log('Processed users for assignment in CreateTask:', validUsers);
      setUsers(validUsers);
    } catch (error) {
      console.error('Error fetching users in CreateTask:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch loan types with lead counts
  const fetchLoanTypes = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    
    setLoadingLoanTypes(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/loan-types-with-leads?user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setLoanTypes(data.loan_types || []);
    } catch (error) {
      console.error('Error fetching loan types:', error);
      setLoanTypes([]);
    } finally {
      setLoadingLoanTypes(false);
    }
  }, []);

  // Fetch leads by loan type and record type with optional search
  const fetchLeadsByLoanType = useCallback(async (loanType, recordType = 'leads', searchTerm = '', searchLimit = 5) => {
    const userId = getUserId();
    if (!userId || !loanType) return;
    
    setLoadingLeads(true);
    try {
      // Build URL with search parameters
      let url = `${API_BASE_URL}/tasks/leads-logins-by-type?loan_type=${encodeURIComponent(loanType)}&record_type=${encodeURIComponent(recordType)}&user_id=${userId}&limit=${searchLimit}`;
      
      // Add search parameter if provided
      if (searchTerm && searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, []); // Empty dependency array since it doesn't depend on any state or props

  // Load users and loan types on mount
  useEffect(() => {
    fetchUsers();
    fetchLoanTypes();
  }, [fetchUsers, fetchLoanTypes]);

  // Function to get the currently logged-in user from localStorage
  const getCurrentLoggedInUser = () => {
    try {
      const userId = getUserId();
      const userName = localStorage.getItem('userName');
      const userFirstName = localStorage.getItem('userFirstName');
      const userLastName = localStorage.getItem('userLastName');
      
      let name = "Current User"; // Default fallback
      
      // Check for userName first as it's likely the most complete format
      if (userName) {
        name = userName;
      } else if (userFirstName && userLastName) {
        name = `${userFirstName} ${userLastName}`;
      } else if (userFirstName) {
        name = userFirstName;
      } else {
        // Check for a full user object (common pattern in many React apps)
        const userData = localStorage.getItem('user');
        if (userData) {
          try {
            const parsedUser = JSON.parse(userData);
            // Return user info in order of most likely to contain a full name
            if (parsedUser.name) name = parsedUser.name;
            else if (parsedUser.fullName) name = parsedUser.fullName;
            else if (parsedUser.firstName && parsedUser.lastName) name = `${parsedUser.firstName} ${parsedUser.lastName}`;
            else if (parsedUser.firstName) name = parsedUser.firstName;
            else if (parsedUser.username) name = parsedUser.username;
            else if (parsedUser.email) name = parsedUser.email;
          } catch (parseError) {
            console.log("Error parsing user data:", parseError);
          }
        }
      }
      
      return {
        user_id: userId,
        name: name
      };
    } catch (error) {
      console.log("Error getting current user:", error);
      return {
        user_id: null,
        name: "Current User"
      };
    }
  };

  // Get the current user when component initializes
  const currentUser = getCurrentLoggedInUser();

  const [form, setForm] = useState({
    createdBy: currentUser, // Use the dynamically retrieved user object with ID and name
    subject: "",
    message: "",
    attachments: [], // Changed to array to support multiple attachments
    taskType: "",
    associateWithRecords: [],
    assignedTo: [], // Changed to an array to hold multiple assignees (user objects with ID and name)
    dueDateOption: "today", // Set initial value to 'today'
    dueDate: formatDate(new Date()), // Set initial due date to today using new format
    dueTime: "08:00 AM", // Initial time, matching the format
    customDate: null,
    repeatOption: "none", // For repeat task: none, daily, weekly, monthly, custom
    repeatCustomDays: [], // For custom repeat, store selected days
  });

  // Effect to set initial assignedTo to createdBy if it's empty
  useEffect(() => {
    // If assignedTo is empty, initialize it with the creator
    if (form.assignedTo.length === 0 && form.createdBy && form.createdBy.user_id) {
      // Set the current logged-in user as the default assignee
      setForm((prev) => ({ ...prev, assignedTo: [prev.createdBy] }));
    }
  }, [form.createdBy, form.assignedTo.length]); // Re-run if createdBy changes or assignedTo becomes empty

  const [isOpen, setIsOpen] = useState(true); // State to control modal visibility
  const [currentDateTime, setCurrentDateTime] = useState(
    getCurrentDateTimeString()
  );
  const [showAssociatePopup, setShowAssociatePopup] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showClockTimePicker, setShowClockTimePicker] = useState(false); // State for the clock picker
  const [showAssignPopup, setShowAssignPopup] = useState(false); // State for the assign popup
  const [showDaysSelector, setShowDaysSelector] = useState(false); // State for custom repeat days selector
  const [calendarPosition, setCalendarPosition] = useState('below'); // 'below' or 'above'
  const messageRef = useRef(null);
  const dueDateSelectRef = useRef(null); // Ref for the due date select element
  
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

  // Watch for changes in form fields
  useEffect(() => {
    console.log("Form changed:", {
      dueDate: form.dueDate,
      dueTime: form.dueTime,
      subject: form.subject,
      assignedTo: form.assignedTo,
    });
  }, [form.dueDate, form.dueTime, form.subject, form.assignedTo]);

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = messageRef.current.scrollHeight + "px";
    }
  }, [form.message]);

  const handleChange = (field, value) => {
    console.log(`📝 CreateTask: Field ${field} changed to: ${value}`);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Handle blur - apply uppercase when user leaves the field
  const handleBlur = (field) => {
    const excludeFromUppercase = [
      'type', 'assignTo', 'priority', 'deadline', 'leadId', 'taskType', 
      'repeatOption', 'repeatCustomDays', 'dueDateOption', 'customDate'
    ];
    if (excludeFromUppercase.includes(field) || typeof form[field] !== 'string') {
      return;
    }
    setForm((prev) => ({ ...prev, [field]: prev[field].toUpperCase() }));
  };

  const handleFileChange = (e) => {
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
          isNew: true
        }));

        console.log('Created new attachment objects:', newAttachments);

        setForm(prev => ({
          ...prev,
          attachments: [...prev.attachments, ...newAttachments]
        }));

        // Clear the input to allow selecting the same file again if needed
        e.target.value = '';
      } else {
        // Clear the input if no valid files
        e.target.value = '';
      }
    }
  };

  // Function to remove an attachment from CreateTask
  const handleRemoveAttachment = (attachmentToRemove) => {
    console.log("Removing attachment:", attachmentToRemove);
    
    // Revoke the object URL to free up memory
    if (attachmentToRemove.url && attachmentToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(attachmentToRemove.url);
    }
    
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentToRemove.id)
    }));
  };

  const getTodayDate = () => {
    const today = new Date();
    return formatDate(today); // Use the new formatter
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow); // Use the new formatter
  };

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    // Basic validation
    if (!form.subject.trim()) {
      alert('Please enter a subject');
      return;
    }
    
    if (!form.message.trim()) {
      alert('Please enter a message');
      return;
    }
    
    if (!form.taskType) {
      alert('Please select a task type');
      return;
    }
    
    let finalDueDate = form.dueDate;
    
    // Create JSON data to match what the API expects
    const taskData = {
      subject: form.subject,
      task_details: form.message,
      task_type: form.taskType || 'To-Do',
      status: 'Pending',
      priority: 'Medium',
      due_date: finalDueDate,
      due_time: form.dueTime,
      is_urgent: form.dueDateOption === 'urgent' || false,
      created_by: form.createdBy?.user_id || getUserId(), // Use user ID instead of name
      assigned_to: form.assignedTo?.map(user => user.user_id || user) || [form.createdBy?.user_id || getUserId()], // Extract user IDs
      notes: '',
      user_id: getUserId() // Add the current user's ID as required by the API
    };

    // Add recurring/repeat configuration if specified
    if (form.repeatOption && form.repeatOption !== 'none') {
      taskData.is_recurring = true;
      
      // Map the repeat options to our backend format
      let pattern = form.repeatOption;
      let interval = 1;
      
      // Handle custom repeat (weekdays selection)
      if (form.repeatOption === 'custom' && form.repeatCustomDays && form.repeatCustomDays.length > 0) {
        // For custom days, we'll use a weekly pattern with specific weekdays
        pattern = 'weekly';
        taskData.recurring_config = {
          pattern: 'weekly',
          interval: 1,
          weekdays: form.repeatCustomDays, // Store selected days
          start_date: finalDueDate // Start from the due date
        };
      } else {
        // For standard patterns (daily, weekly, monthly)
        taskData.recurring_config = {
          pattern: pattern,
          interval: interval,
          start_date: finalDueDate // Start from the due date
        };
      }
      
      console.log('CreateTask: Adding recurring configuration:', taskData.recurring_config);
    }
    
    // Handle associated records - extract lead ID and loan type from first selected record
    if (form.associateWithRecords && form.associateWithRecords.length > 0) {
      const firstRecord = form.associateWithRecords[0];
      console.log('First associated record:', firstRecord);
      
      // Extract lead_id - try different possible field names
      if (firstRecord && (firstRecord.id || firstRecord._id || firstRecord.lead_id)) {
        const leadId = firstRecord.id || firstRecord._id || firstRecord.lead_id;
        taskData.lead_id = leadId;
        console.log('Setting lead_id to:', leadId);
      }
      
      // Extract loan_type - use the loan type from the selected record's context
      if (firstRecord && (firstRecord.loan_type || firstRecord.loanType)) {
        const loanType = firstRecord.loan_type || firstRecord.loanType;
        taskData.loan_type = loanType;
        console.log('Setting loan_type to:', loanType);
      }
    }
    
    console.log('CreateTask: Submitting task with data:', taskData);
    console.log('CreateTask: User data being sent - created_by:', taskData.created_by, 'assigned_to:', taskData.assigned_to);
    console.log('CreateTask: Form assignedTo data:', form.assignedTo);
    console.log('CreateTask: Attachments to upload:', form.attachments?.length ? 
      form.attachments.map(att => ({ name: att.name, size: att.file?.size, type: att.file?.type })) : 
      'No attachments');
    
    // Pass the task data and attachments separately to the parent component
    if (onSave) {
      onSave({
        taskData: taskData,
        attachments: form.attachments || [] // Pass all attachments
      });
    }
    
    if (onClose) {
      onClose();
    }
    
    setIsOpen(false); // Close the modal locally
  }, [form, onSave, onClose]);

  const handleClose = () => {
    setIsOpen(false); // Close the modal locally
    if (onClose) onClose(); // Call the parent onClose if provided
  };

  // Function to remove an assignee
  const handleRemoveAssignee = (userToRemove) => {
    setForm((prevForm) => ({
      ...prevForm,
      assignedTo: prevForm.assignedTo.filter((user) => {
        const userId = user.user_id || user.id || user;
        const removeUserId = userToRemove.user_id || userToRemove.id || userToRemove;
        return userId !== removeUserId;
      }),
    }));
  };

  // Function to add an assignee from the popup
  const handleAddAssignee = (newAssigneeUser) => {
    setForm((prevForm) => {
      // Add only if not already present (check by user_id or id)
      const newUserId = newAssigneeUser.user_id || newAssigneeUser.id || newAssigneeUser;
      const isAlreadyAssigned = prevForm.assignedTo.some(user => {
        const existingUserId = user.user_id || user.id || user;
        return existingUserId === newUserId;
      });
      
      if (!isAlreadyAssigned) {
        return {
          ...prevForm,
          assignedTo: [...prevForm.assignedTo, newAssigneeUser],
        };
      }
      return prevForm; // If already present, don't update
    });
  };

  if (!isOpen) return null;

  return (
    <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
      <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        <form onSubmit={handleSubmit}>
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
              <label
                className="block font-bold text-gray-700 mb-1"
                htmlFor="createdBy"
              >
                Created By
              </label>
              <input
                id="createdBy"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={form.createdBy?.name || "Current User"}
                readOnly
              />
            </div>
          </div>

          <div className="mt-4">
            <label
              className="block font-bold text-gray-700 mb-1"
              htmlFor="subject"
            >
              Subject
            </label>
            <input
              id="subject"
              type="text"
              className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
              value={form.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              onBlur={() => handleBlur("subject")}
              placeholder="Enter subject"
              required
            />
          </div>

          <div className="mt-4">
            <label
              className="block font-bold text-gray-700 mb-1"
              htmlFor="message"
            >
              Message
            </label>
            <textarea
              ref={messageRef}
              id="message"
              className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none overflow-hidden"
              rows={3}
              value={form.message}
              onChange={(e) => handleChange("message", e.target.value)}
              onBlur={() => handleBlur("message")}
              placeholder="Enter message"
              required
              style={{
                minHeight: "3rem",
                maxHeight: "400px",
                transition: "height 0.2s",
              }}
            />
          </div>

          <div className="flex flex-col items-start mt-4">
            <label className="block font-bold text-gray-700 mb-2">
              Attachments
            </label>
            <label className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow cursor-pointer hover:bg-cyan-600 transition">
              📎 Photo/PDF
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                multiple
              />
            </label>
            
            {/* Display selected attachments */}
            {form.attachments && form.attachments.length > 0 && (
              <div className="mt-3 w-full">
                <h4 className="font-semibold text-gray-700 mb-2">Selected Files:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {form.attachments.map((attachment, index) => (
                    <div key={attachment.id} className="flex items-center bg-gray-100 p-2 rounded-lg relative border-2 border-blue-200">
                      {attachment.url && attachment.url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                        <img
                          src={attachment.url}
                          alt={`Preview ${index}`}
                          className="w-16 h-16 object-cover rounded-lg mr-2"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/64x64?text=Error";
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="text-sm text-black font-medium truncate">{attachment.name}</span>
                        <div className="flex flex-col">
                          <span className="text-xs text-green-600">
                            Ready to upload
                          </span>
                          {attachment.file && (
                            <span className="text-xs text-gray-500">
                              {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        onClick={() => handleRemoveAttachment(attachment)}
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label
              className="block font-bold text-gray-700 mb-1"
              htmlFor="taskType"
            >
              Task
            </label>
            <select
              id="taskType"
              className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
              value={form.taskType}
              onChange={(e) => handleChange("taskType", e.target.value)}
              required
            >
              <option value="">Select Task</option>
              <option value="To-Do">To-Do</option>
              <option value="Call">Call</option>
              <option value="Pendency">Pendency</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          

          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Associate with records
            </label>
            <button
              type="button"
              className={`w-full px-3 py-2 border border-cyan-400 rounded bg-gray-100 text-black font-bold text-left transition-opacity ${isLeadPreselected ? 'cursor-not-allowed opacity-75' : 'hover:bg-gray-200 cursor-pointer'}`}
              onClick={() => !isLeadPreselected && setShowAssociatePopup(true)}
              disabled={isLeadPreselected}
            >
              {form.associateWithRecords.length > 0
                ? form.associateWithRecords.length === 1 
                  ? `${form.associateWithRecords[0].name || form.associateWithRecords[0].customer_name || 'Selected Lead'}${isLeadPreselected ? ' (Pre-selected from lead)' : ''}`
                  : `${form.associateWithRecords.length} record(s) selected${isLeadPreselected ? ' (Pre-selected from lead)' : ''}`
                : "Associated with 0 records"}
            </button>
            {isLeadPreselected && (
              <p className="text-sm text-cyan-600 mt-1">Lead is already pre-selected from the current view</p>
            )}
          </div>

          {/* Modified Assignee Section for multiple assignees */}
          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Assignee
            </label>
            <div className="flex flex-wrap items-center gap-2 border border-cyan-400 rounded-md bg-white p-1 pr-2 min-h-[42px]">
              {" "}
              {/* Added min-h and flex-wrap */}
              {/* Display all assigned names as pills */}
              {form.assignedTo.map((assignee, index) => {
                // Properly construct user name from first_name and last_name, fallback to name, then to assignee
                const userName = assignee?.first_name && assignee?.last_name 
                  ? `${assignee.first_name} ${assignee.last_name}`.trim()
                  : assignee?.name || assignee; // Handle both user objects and strings
                const userId = assignee?.user_id || assignee?.id || assignee;
                return (
                  <div
                    key={userId} // Using user ID as key for uniqueness
                    className="bg-blue-100 text-blue-800 py-1 px-3 rounded-md flex items-center"
                  >
                    {/* Profile icon with initials */}
                    <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-2 text-xs flex-shrink-0">
                      {userName.split(' ')
                        .map(part => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <span>{userName}</span>
                    <button
                      type="button"
                      className="ml-2 text-blue-500 hover:text-blue-700"
                      onClick={() => handleRemoveAssignee(assignee)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="text-blue-600 font-medium hover:text-blue-800 ml-auto" // Pushed to the right
                onClick={() => setShowAssignPopup(true)}
              >
                + Add more
              </button>
            </div>
          </div>
          {/* End of Modified Assignee Section */}

          <div className="mt-4">
            <label className="block font-bold text-gray-700 mb-1">
              Due date {form.dueDateOption === "custom" && form.dueDate && (
                <span className="text-sm font-normal text-gray-600">
                  (Selected: {form.dueDate})
                </span>
              )}
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <select
                  ref={dueDateSelectRef}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={form.dueDateOption}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log('Due date option selected:', value);
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
                        form.customDate ? formatDate(form.customDate) : ""
                      );
                      setShowCalendar(true);
                    }
                  }}
                  onFocus={(e) => {
                    // When dropdown opens and custom is already selected, show calendar
                    if (form.dueDateOption === "custom") {
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

                {form.dueDateOption === "custom" && showCalendar && (
                  <div 
                    className={`absolute bg-white border border-cyan-400 rounded shadow-lg z-[9999] ${
                      calendarPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
                    }`}
                  >
                    <DatePicker
                      selected={form.customDate || new Date()}
                      onChange={(date) => {
                        handleChange("customDate", date);
                        handleChange("dueDate", formatDate(date));
                        setShowCalendar(false);
                      }}
                      inline
                      showYearDropdown
                      scrollableYearDropdown
                      yearDropdownItemNumber={100}
                      dateFormat="dd MMM yyyy" // Change DatePicker format
                      className="border border-cyan-400 rounded p-2"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 relative">
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  value={form.dueTime}
                  readOnly
                  onClick={() => setShowClockTimePicker(true)} // Open the clock picker
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
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={form.repeatOption || "none"}
                onChange={(e) => {
                  const value = e.target.value;
                  console.log('🔄 Repeat option selected:', value);
                  console.log('🔄 Current form.repeatOption:', form.repeatOption);
                  
                  // Update form state immediately
                  setForm((prev) => ({
                    ...prev,
                    repeatOption: value,
                    // Clear custom days if not custom
                    ...(value !== "custom" && { repeatCustomDays: [] })
                  }));
                  
                  // Show days selector for custom repeat
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

             

              {form.repeatOption === "custom" && showDaysSelector && (
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
                            checked={form.repeatCustomDays?.includes(day) || false}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setForm((prev) => {
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
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>

      {showAssociatePopup && (
        <AssociatePopup
          onClose={() => setShowAssociatePopup(false)}
          onSelect={(records) => {
            handleChange("associateWithRecords", records);
            setShowAssociatePopup(false);
          }}
          loanTypes={loanTypes}
          leads={leads}
          loadingLoanTypes={loadingLoanTypes}
          loadingLeads={loadingLeads}
          onFetchLeads={fetchLeadsByLoanType}
        />
      )}

      {showClockTimePicker && (
        <ClockTimePicker
          initialTime={form.dueTime}
          onSelectTime={(newTime) => {
            handleChange("dueTime", newTime);
            setShowClockTimePicker(false); // Close after selection
          }}
          onClose={() => setShowClockTimePicker(false)} // Close on CANCEL or X
        />
      )}

      {showAssignPopup && (
        <AssignPopup
          onClose={() => setShowAssignPopup(false)}
          onSelect={(userObject) => {
            handleAddAssignee(userObject); // Call the new handler to add the assignee (user object)
            setShowAssignPopup(false);
          }}
          users={users}
          loadingUsers={loadingUsers}
        />
      )}
    </div>
  );
}

// AssociatePopup component - Modified with API integration
function AssociatePopup({ onClose, onSelect, loanTypes, leads, loadingLoanTypes, loadingLeads, onFetchLeads }) {
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
    
    // Since we're now doing server-side search, just return the leads as-is
    // The filtering is done on the server when searchTerm changes
    return leads;
  };

  // Handle search with debounced server-side search
  const handleSearchChange = (newSearchTerm) => {
    setSearchTerm(newSearchTerm);
  };

  // Debounced search effect
  useEffect(() => {
    if (!selectedLoanType || !selectedRecordType) return;

    const timeoutId = setTimeout(() => {
      const recordType = selectedRecordType.toLowerCase();
      // Use higher limit when searching (50) vs default (5)
      const searchLimit = searchTerm.trim() ? 50 : 5;
      onFetchLeads(selectedLoanType, recordType, searchTerm, searchLimit);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedLoanType, selectedRecordType]); // Removed onFetchLeads from dependency array

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
    // Fetch leads based on the selected record type with default limit
    const recordType = selectedRecordType.toLowerCase();
    onFetchLeads(loanType, recordType, "", 5); // Default: no search, 5 leads
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
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => handleSearchChange("")}
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

// AssignPopup component
function AssignPopup({ onClose, onSelect, users, loadingUsers }) {
  const [assigneeName, setAssigneeName] = useState("");
  const [filteredAssignees, setFilteredAssignees] = useState([]);

  // Debug: Log users data structure
  useEffect(() => {
    if (users && users.length > 0) {
      console.log('Users data structure sample:', users[0]);
    }
  }, [users]);

  useEffect(() => {
    // If assigneeName is empty, show all users
    if (assigneeName.trim() === "") {
      setFilteredAssignees(users);
    } else {
      // Otherwise, filter based on input
      setFilteredAssignees(
        users.filter((user) => {
          const fullName = user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`.trim()
            : user.name || '';
          
          const searchTerm = assigneeName.toLowerCase();
          
          return (
            fullName.toLowerCase().includes(searchTerm) ||
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.first_name && user.first_name.toLowerCase().includes(searchTerm)) ||
            (user.last_name && user.last_name.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.role && user.role.toLowerCase().includes(searchTerm)) ||
            (user.designation && user.designation.toLowerCase().includes(searchTerm))
          );
        })
      );
    }
  }, [assigneeName, users]); // Depend on assigneeName and users to re-filter

  const handleAssign = () => {
    if (assigneeName) {
      // Find the user object from the list based on the entered name
      const selectedUser = users.find(user => {
        const fullName = user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`.trim()
          : user.name || '';
        
        return fullName.toLowerCase() === assigneeName.toLowerCase() ||
               (user.name && user.name.toLowerCase() === assigneeName.toLowerCase()) ||
               (user.first_name && user.first_name.toLowerCase() === assigneeName.toLowerCase()) ||
               (user.last_name && user.last_name.toLowerCase() === assigneeName.toLowerCase());
      });
      
      if (selectedUser) {
        onSelect({
          user_id: selectedUser.id,
          name: selectedUser.first_name && selectedUser.last_name 
            ? `${selectedUser.first_name} ${selectedUser.last_name}`.trim()
            : selectedUser.name,
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          designation: selectedUser.designation,
          email: selectedUser.email
        }); // Pass the full user object with designation
      } else {
        // If not found in the list, create a basic user object
        onSelect({
          user_id: null,
          name: assigneeName,
          designation: ''
        });
      }
    }
    // Clear the input after assigning
    setAssigneeName("");
    onClose(); // Close the popup after assigning
  };

  const selectAssignee = (selectedUser) => {
    // Pass the full user object to the parent with designation
    // Include both id and user_id for compatibility
    onSelect({
      id: selectedUser.id,
      user_id: selectedUser.id,
      name: selectedUser.name,
      first_name: selectedUser.first_name,
      last_name: selectedUser.last_name,
      designation: selectedUser.designation,
      email: selectedUser.email
    });
    onClose(); // Close the popup
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent"
    >
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[90%] max-w-2xl mx-auto relative">
        <div className="flex items-center mb-4 bg-white bg-opacity-90 p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

        {/* Always show the list, filtered or full */}
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90">
          {loadingUsers ? (
            <div className="p-6 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-2"></div>
              <p>Loading users...</p>
            </div>
          ) : filteredAssignees.length > 0 ? (
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
                <div
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
                </div>
              );
            })
          ) : (
            assigneeName.trim() !== "" && ( // Only show "No results" if user typed something and no results
              <div className="p-3 text-gray-500 text-center">No matching assignees found.</div>
            )
          )}
        </div>

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