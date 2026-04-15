"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import TaskSchedulePicker, { getNearestTimeSlot } from "./TaskSchedulePicker";
import API from '../services/api';
import { formatDateTime, formatDate } from '../utils/dateUtils';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

function getCurrentDateTimeString() {
  return formatDateTime(new Date());
}

export default function CreateTask({ onClose, onSave, preselectedLead, defaultTaskType }) {
  // State for API data
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
          designation: user.role || user.designation || '',
          employee_status: user.employee_status,
          is_active: user.is_active
        }));
      }

      // Filter out entries with empty names and inactive employees
      const validUsers = usersList.filter(user => 
        user.name && 
        (user.employee_status === 'active' || user.is_active === true || user.employee_status === undefined)
      );
      console.log('Processed users for assignment in CreateTask:', validUsers);
      setUsers(validUsers);
    } catch (error) {
      console.error('Error fetching users in CreateTask:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  // Map taskTypeFilter values to CreateTask taskType values
  const resolveDefaultTaskType = () => {
    if (!defaultTaskType || defaultTaskType === 'all') return 'Call';
    if (defaultTaskType === 'callback') return 'Call';
    if (defaultTaskType === 'pendency') return 'Pendency';
    if (defaultTaskType === 'todo') return 'To-Do';
    return 'Call';
  };

  const [form, setForm] = useState({
    createdBy: currentUser, // Use the dynamically retrieved user object with ID and name
    subject: "",
    message: "",
    attachments: [], // Changed to array to support multiple attachments
    taskType: resolveDefaultTaskType(),
    associateWithRecords: [],
    assignedTo: [], // Changed to an array to hold multiple assignees (user objects with ID and name)
    dueDateOption: "today", // Set initial value to 'today'
    dueDate: formatDate(new Date()), // Set initial due date to today using new format
    dueTime: getNearestTimeSlot(new Date()), // Auto-set to nearest 30-min slot
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

  const [isOpen, setIsOpen] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState(
    getCurrentDateTimeString()
  );
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const assignDropdownRef = useRef(null);
  const assignTriggerRef = useRef(null);
  const [assignDropdownPos, setAssignDropdownPos] = useState({});
  const [showDaysSelector, setShowDaysSelector] = useState(false);
  const messageRef = useRef(null);
  const modalRef = useRef(null);

  // Inline record dropdown states
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [recordSearchTerm, setRecordSearchTerm] = useState('');
  const [recordSearchResults, setRecordSearchResults] = useState([]);
  const [loadingRecordSearch, setLoadingRecordSearch] = useState(false);
  const recordDropdownRef = useRef(null);
  const recordTriggerRef = useRef(null);
  const [recordDropdownPos, setRecordDropdownPos] = useState({});

  // Helper: compute fixed dropdown position based on trigger rect
  const calcDropdownPos = (triggerEl, dropdownHeight = 280) => {
    const rect = triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropdownHeight && rect.top > spaceBelow;
    return openUp
      ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, zIndex: 9999 }
      : { position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 };
  };

  // Close dropdowns on outside click — portals render in body so use data-attributes
  useEffect(() => {
    const handleClickOutside = (e) => {
      const inRecordTrigger = recordTriggerRef.current && recordTriggerRef.current.contains(e.target);
      const inRecordPortal = e.target.closest('[data-portal="record-dropdown"]');
      if (!inRecordTrigger && !inRecordPortal) setShowRecordDropdown(false);

      const inAssignTrigger = assignTriggerRef.current && assignTriggerRef.current.contains(e.target);
      const inAssignPortal = e.target.closest('[data-portal="assign-dropdown"]');
      if (!inAssignTrigger && !inAssignPortal) setShowAssignDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [])

  // Search leads when search term changes (debounced)
  useEffect(() => {
    if (!showRecordDropdown) return;
    const timeoutId = setTimeout(async () => {
      const userId = getUserId();
      if (!userId) return;
      setLoadingRecordSearch(true);
      try {
        const url = `${API_BASE_URL}/tasks/search-leads?user_id=${userId}&search=${encodeURIComponent(recordSearchTerm)}&limit=20`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setRecordSearchResults(data.leads || []);
        }
      } catch (err) {
        console.error('Error searching leads:', err);
      } finally {
        setLoadingRecordSearch(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [recordSearchTerm, showRecordDropdown]);

  // Load initial leads when dropdown opens
  useEffect(() => {
    if (showRecordDropdown && recordSearchResults.length === 0 && !loadingRecordSearch) {
      setRecordSearchTerm('');
    }
  }, [showRecordDropdown]);
  
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
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Clear attachments when switching task type tabs — attachments belong to the tab they were added on
      if (field === 'taskType' && value !== prev.taskType) {
        prev.attachments.forEach(att => {
          if (att.url && att.url.startsWith('blob:')) URL.revokeObjectURL(att.url);
        });
        updated.attachments = [];
      }
      return updated;
    });
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

  // Shared file validation and processing
  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      'application/pdf',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'
    ];
    const maxSize = 25 * 1024 * 1024; // 25MB limit (higher for videos)
    
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
        isNew: true
      }));

      setForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = '';
  };

  // Native paste listener — mirrors task_creation.html's addEventListener('paste', ...) approach.
  // React's synthetic onPaste on a div is unreliable when child inputs/textareas have focus;
  // a native DOM listener on the modal element fires reliably regardless of focus.
  const taskTypeRef = useRef(form.taskType);
  useEffect(() => { taskTypeRef.current = form.taskType; }, [form.taskType]);
  useEffect(() => {
    const modalEl = modalRef.current;
    if (!modalEl) return;
    const handler = (e) => {
      if (taskTypeRef.current !== 'Pendency' && taskTypeRef.current !== 'To-Do') return;
      const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
      const files = items.filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(Boolean);
      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };
    modalEl.addEventListener('paste', handler);
    // Auto-focus the overlay so paste works immediately without clicking
    modalEl.focus();
    return () => modalEl.removeEventListener('paste', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    
    // For Callback/Pendency, auto-set subject from message if empty
    let effectiveSubject = form.subject.trim();
    if (!effectiveSubject && (form.taskType === 'Call' || form.taskType === 'Pendency')) {
      effectiveSubject = form.message.trim().substring(0, 100) || (form.taskType === 'Call' ? 'Callback' : 'Pendency');
    }
    
    // Basic validation
    if (!effectiveSubject) {
      alert('Please enter a subject');
      return;
    }
    
    if (!form.message.trim()) {
      alert(form.taskType === 'Call' ? 'Please enter a quick note' : form.taskType === 'Pendency' ? 'Please describe what is pending' : 'Please enter a description');
      return;
    }
    
    if (!form.taskType) {
      alert('Please select a task type');
      return;
    }
    
    let finalDueDate = form.dueDate;
    
    // Create JSON data to match what the API expects
    const taskData = {
      subject: effectiveSubject,
      task_details: form.message,
      task_type: form.taskType || 'To-Do',
      status: 'Pending',
      priority: 'Medium',
      due_date: finalDueDate,
      due_time: form.dueTime,
      is_urgent: form.dueDateOption === 'urgent' || false,
      created_by: form.createdBy?.user_id || getUserId(), // Use user ID instead of name
      assigned_to: form.assignedTo?.map(user => {
        if (typeof user === 'string') return user;
        return user.user_id || user.id || null;
      }).filter(Boolean) || [form.createdBy?.user_id || getUserId()], // Extract user IDs
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

  const taskTypeTabStyle = (type) => ({
    flex: 1,
    padding: '8px 0',
    textAlign: 'center',
    background: form.taskType === type ? 'white' : 'transparent',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    color: form.taskType === type ? '#00aaff' : '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: form.taskType === type ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
  });

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', outline: 'none' }} ref={modalRef} tabIndex={-1}>
      <div className="relative bg-white w-full max-w-[700px] max-h-[96vh] flex flex-col overflow-hidden" style={{ borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <button
          className="absolute right-5 top-5 flex items-center justify-center z-10 cursor-pointer transition hover:text-[#334155]"
          style={{ background: '#f1f5f9', width: '28px', height: '28px', borderRadius: '50%', border: 'none', fontSize: '16px', color: '#64748b' }}
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>

        <div className="flex-1 overflow-y-auto" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '5px' }}>Create New Task</div>

        {/* Task Type Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '3px', marginTop: '8px', marginBottom: '12px' }}>
          <button type="button" style={taskTypeTabStyle('Call')} onClick={() => handleChange('taskType', 'Call')}>📞 Callback</button>
          <button type="button" style={taskTypeTabStyle('Pendency')} onClick={() => handleChange('taskType', 'Pendency')}>⏳ Pendency</button>
          <button type="button" style={taskTypeTabStyle('To-Do')} onClick={() => handleChange('taskType', 'To-Do')}>📝 To-Do</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Row 1: Created Date & Created By */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">
                Created Date & Time
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-md text-[13px] font-semibold outline-none"
                style={{ border: '1.5px solid #cbd5e1', background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                value={currentDateTime}
                readOnly
                disabled
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">
                Created By
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-md text-[13px] font-semibold outline-none"
                style={{ border: '1.5px solid #cbd5e1', background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                value={form.createdBy?.name || "Current User"}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* Row 2: Associate / Target Record — Inline Dropdown */}
          <div className="mb-2.5">
            <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
              {form.taskType === 'Call' ? 'Who to call? (Target Record)' : form.taskType === 'Pendency' ? 'Related Record' : 'Associate with Record'}
            </label>
            <div style={{ position: 'relative' }} ref={recordDropdownRef}>
              {/* Selector Button */}
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: form.associateWithRecords.length > 0 ? '1.5px solid #94a3b8' : '1.5px dashed #94a3b8',
                  background: form.associateWithRecords.length > 0 ? 'linear-gradient(180deg, #ffffff, #f8fbff)' : 'linear-gradient(180deg, #fbfdff, #f3f9ff)',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: isLeadPreselected ? 'not-allowed' : 'pointer',
                  color: form.associateWithRecords.length > 0 ? '#0f172a' : '#00aaff',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  minHeight: '44px',
                  boxShadow: form.associateWithRecords.length > 0 ? '0 4px 10px rgba(15,23,42,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.7)',
                  transition: 'all 0.2s',
                  opacity: isLeadPreselected ? 0.75 : 1,
                }}
                onClick={() => {
                  if (isLeadPreselected) return;
                  if (showRecordDropdown) { setShowRecordDropdown(false); return; }
                  if (recordTriggerRef.current) setRecordDropdownPos(calcDropdownPos(recordTriggerRef.current, 260));
                  setShowRecordDropdown(true);
                }}
                ref={recordTriggerRef}
                disabled={isLeadPreselected}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  {form.associateWithRecords.length > 0 ? (
                    <>
                      <span style={{ background: (form.associateWithRecords[0].lead_login || 'Lead') === 'Lead' ? 'rgba(0,170,255,0.1)' : 'rgba(243,156,18,0.1)', color: (form.associateWithRecords[0].lead_login || 'Lead') === 'Lead' ? '#00aaff' : '#f39c12', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {form.associateWithRecords[0].lead_login || 'Lead'}
                      </span>
                      <strong style={{ fontWeight: 700, color: '#0f172a' }}>{form.associateWithRecords[0].name || form.associateWithRecords[0].customer_name || 'Selected'}</strong>
                      {form.associateWithRecords[0].phone && (
                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>{form.associateWithRecords[0].phone}</span>
                      )}
                    </>
                  ) : (
                    'Click to select Lead/Record...'
                  )}
                </span>
                {/* Clear button when selected */}
                {form.associateWithRecords.length > 0 && !isLeadPreselected && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChange('associateWithRecords', []);
                      setShowRecordDropdown(false);
                    }}
                    style={{ background: '#e2e8f0', color: '#475569', width: '22px', height: '22px', borderRadius: '50%', fontSize: '14px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                  >×</span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>

              {/* Dropdown Menu — rendered in body via portal to escape backdrop-filter stacking context */}
              {showRecordDropdown && createPortal(
                <div data-portal="record-dropdown" style={{
                  ...recordDropdownPos,
                  background: '#fff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 15px 30px rgba(15,23,42,0.12)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Search Input */}
                  <input
                    type="text"
                    style={{ border: 'none', borderBottom: '1.5px solid #e2e8f0', borderRadius: 0, padding: '12px 14px', fontSize: '13px', outline: 'none', fontWeight: 600, color: '#0f172a' }}
                    placeholder="Search by name or number..."
                    value={recordSearchTerm}
                    onChange={(e) => setRecordSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {/* Results List */}
                  <ul style={{ maxHeight: '180px', overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
                    {loadingRecordSearch ? (
                      <li style={{ padding: '15px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        Searching...
                      </li>
                    ) : recordSearchResults.length > 0 ? (
                      recordSearchResults.map((lead) => (
                        <li
                          key={lead.id}
                          style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s', color: '#0f172a', flexWrap: 'wrap' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          onClick={() => {
                            handleChange('associateWithRecords', [{
                              id: lead.id,
                              lead_id: lead.lead_id || lead.id,
                              name: lead.name || lead.customer_name,
                              customer_name: lead.customer_name,
                              phone: lead.phone,
                              loan_type: lead.loan_type,
                              lead_login: lead.lead_login || 'Lead',
                              lead_number: lead.lead_number,
                            }]);
                            setShowRecordDropdown(false);
                            setRecordSearchTerm('');
                          }}
                        >
                          <span style={{ background: (lead.lead_login || 'Lead') === 'Lead' ? 'rgba(0,170,255,0.1)' : 'rgba(243,156,18,0.1)', color: (lead.lead_login || 'Lead') === 'Lead' ? '#00aaff' : '#f39c12', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                            {lead.lead_login || 'Lead'}
                          </span>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{lead.name || lead.customer_name}</span>
                          {lead.phone && <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>{lead.phone}</span>}
                        </li>
                      ))
                    ) : (
                      <li style={{ padding: '15px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        {recordSearchTerm ? `No records found for "${recordSearchTerm}"` : 'Type to search leads...'}
                      </li>
                    )}
                  </ul>
                </div>,
                document.body
              )}
            </div>
            {isLeadPreselected && (
              <p style={{ fontSize: '11px', color: '#00aaff', marginTop: '4px', fontWeight: 600 }}>Lead is already pre-selected from the current view</p>
            )}
          </div>

          {/* Row 3: Conditional Fields per Task Type */}
          {form.taskType === 'Call' && (
            <div className="mb-2.5">
              <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
                Quick Note
              </label>
              <textarea
                ref={messageRef}
                className="w-full px-3 py-2 rounded-md text-[13px] text-[#0f172a] font-medium outline-none bg-white resize-vertical transition"
                style={{ border: '1.5px solid #94a3b8', minHeight: '70px', maxHeight: '400px' }}
                onFocus={(e) => e.target.style.borderColor = '#00aaff'}
                onBlur={(e) => e.target.style.borderColor = '#94a3b8'}
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                placeholder="Enter notes or callback details..."
              />
            </div>
          )}

          {form.taskType === 'Pendency' && (
            <div className="mb-2.5">
              <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
                What is Pending? (Document/Details)
              </label>
              <textarea
                ref={messageRef}
                className="w-full px-3 py-2 rounded-md text-[13px] text-[#0f172a] font-medium outline-none bg-white resize-vertical transition"
                style={{ border: '1.5px solid #94a3b8', minHeight: '70px', maxHeight: '400px' }}
                onFocus={(e) => e.target.style.borderColor = '#00aaff'}
                onBlur={(e) => e.target.style.borderColor = '#94a3b8'}
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                placeholder="Describe the pending items..."
              />
            </div>
          )}

          {form.taskType === 'To-Do' && (
            <>
              <div className="mb-2.5">
                <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
                  Task Subject
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-md text-[13px] text-[#0f172a] font-semibold outline-none bg-white transition"
                  style={{ border: '1.5px solid #94a3b8' }}
                  onFocus={(e) => e.target.style.borderColor = '#00aaff'}
                  onBlur={(e) => e.target.style.borderColor = '#94a3b8'}
                  value={form.subject}
                  onChange={(e) => handleChange("subject", e.target.value)}
                  placeholder="Enter task title"
                />
              </div>
              <div className="mb-2.5">
                <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
                  Description
                </label>
                <textarea
                  ref={messageRef}
                  className="w-full px-3 py-2 rounded-md text-[13px] text-[#0f172a] font-medium outline-none bg-white resize-vertical transition"
                  style={{ border: '1.5px solid #94a3b8', minHeight: '70px', maxHeight: '400px' }}
                  onFocus={(e) => e.target.style.borderColor = '#00aaff'}
                  onBlur={(e) => e.target.style.borderColor = '#94a3b8'}
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  placeholder="Details about the task..."
                />
              </div>
            </>
          )}

          {/* Row 4: Attachments — only for Pendency & To-Do */}
          {(form.taskType === 'Pendency' || form.taskType === 'To-Do') && (
          <div className="mb-2.5">
            <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
              📎 Attachments
            </label>
            <div style={{ border: '1.5px dashed #bfdbfe', borderRadius: '8px', padding: '7px 10px', background: 'linear-gradient(180deg, #fbfdff, #f4f9ff)' }}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Attach files (or Ctrl+V to paste)</span>
                <label className="cursor-pointer" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                  ＋ Add
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                  />
                </label>
              </div>
              {form.attachments && form.attachments.length > 0 && (
                <div className="flex flex-col gap-1">
                  {form.attachments.map((attachment, index) => (
                    <div key={attachment.id} className="flex items-center justify-between gap-2 bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span style={{ background: '#eff6ff', color: '#0284c7', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', flexShrink: 0 }}>
                          {attachment.name?.split('.').pop() || 'FILE'}
                        </span>
                        <span className="truncate" style={{ fontSize: '12px', color: '#334155', fontWeight: 700, maxWidth: '140px' }}>{attachment.name}</span>
                        {attachment.file && (
                          <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
                            {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                        {attachment.url && (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: '#0ea5e9', color: '#fff', padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, textDecoration: 'none', lineHeight: '1.4' }}
                          >
                            View
                          </a>
                        )}
                        {attachment.url && (
                          <a
                            href={attachment.url}
                            download={attachment.name}
                            style={{ background: '#0284c7', color: '#fff', padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, textDecoration: 'none', lineHeight: '1.4' }}
                          >
                            Download
                          </a>
                        )}
                        <button
                          type="button"
                          className="flex items-center justify-center"
                          style={{ width: '22px', height: '22px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '12px', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => handleRemoveAttachment(attachment)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Row 5: Schedule Date + Time */}
          <div className="mb-2.5">
            <TaskSchedulePicker
              date={form.dueDate}
              time={form.dueTime}
              dateOption={form.dueDateOption}
              onDateChange={(date, option) => {
                handleChange("dueDate", date);
                handleChange("dueDateOption", option);
              }}
              onTimeChange={(time) => handleChange("dueTime", time)}
            />
          </div>

          {/* Row 6: Assigned To */}
          <div className="mb-2.5">
            <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wide mb-1.5 block">
              Assigned To
            </label>
            <div ref={assignDropdownRef} className="relative w-full">
              {/* Trigger */}
              <div
                ref={assignTriggerRef}
                className="w-full p-2 border-2 border-[#00bcd4] rounded-md bg-white min-h-[44px] flex flex-wrap gap-2 items-center cursor-pointer hover:border-[#0097a7] transition-all duration-300"
                onClick={() => {
                  if (showAssignDropdown) return;
                  if (assignTriggerRef.current) setAssignDropdownPos(calcDropdownPos(assignTriggerRef.current, 300));
                  setShowAssignDropdown(true);
                }}
              >
                {form.assignedTo.length === 0 && (
                  <span className="text-gray-400 font-normal text-sm">Click to select assignee(s)</span>
                )}
                {form.assignedTo.map((assignee) => {
                  const userName = assignee?.first_name && assignee?.last_name
                    ? `${assignee.first_name} ${assignee.last_name}`.trim()
                    : assignee?.name || assignee;
                  const userId = assignee?.user_id || assignee?.id || assignee;
                  return (
                    <div key={userId} className="flex items-center gap-2 bg-[#03B0F5] text-white pl-2 pr-1 py-1 rounded-md text-sm">
                      <div className="w-5 h-5 rounded-full bg-white text-[#03B0F5] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        {userName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span className="text-xs font-bold">{userName}</span>
                      <button
                        type="button"
                        className="text-white hover:text-red-200 ml-1 text-sm"
                        onClick={(e) => { e.stopPropagation(); handleRemoveAssignee(assignee); }}
                      >×</button>
                    </div>
                  );
                })}
                <div className="ml-auto flex-shrink-0">
                  <svg className={`w-4 h-4 text-[#00bcd4] transition-transform duration-200 ${showAssignDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {showAssignDropdown && createPortal(
                <div
                  data-portal="assign-dropdown"
                  style={{ ...assignDropdownPos, background: '#fff', border: '2px solid #00bcd4', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}
                >
                  {/* Search */}
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        autoFocus
                        type="text"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#03B0F5] text-black"
                        placeholder="Search by name or designation..."
                        value={assignSearchTerm}
                        onChange={e => setAssignSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {/* List */}
                  <div className="max-h-52 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="text-center py-5 text-gray-400 text-sm">Loading users...</div>
                    ) : (() => {
                      const alreadySelected = new Set(form.assignedTo.map(a => String(a?.user_id || a?.id || a?.name || a)));
                      const filtered = users.filter(u => {
                        const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim();
                        const uid = String(u.id || u.user_id || '');
                        if (alreadySelected.has(uid) || alreadySelected.has(name)) return false;
                        if (!assignSearchTerm.trim()) return true;
                        return (
                          name.toLowerCase().includes(assignSearchTerm.toLowerCase()) ||
                          (u.designation || '').toLowerCase().includes(assignSearchTerm.toLowerCase())
                        );
                      });
                      return filtered.length === 0 ? (
                        <div className="text-center py-5 text-gray-400 text-sm">
                          {assignSearchTerm ? 'No matching users found' : 'No users available'}
                        </div>
                      ) : filtered.map(user => {
                        const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim();
                        return (
                          <div
                            key={user.id || user.user_id}
                            className="group flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#e0f7fa] transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { handleAddAssignee(user); setAssignSearchTerm(''); }}
                          >
                            <div className="w-8 h-8 rounded-full bg-[#03B0F5] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">
                              {name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'}
                            </div>
                            <div className="flex flex-col flex-grow min-w-0">
                              <span className="text-sm font-medium text-black truncate">{name}</span>
                              {user.designation && (
                                <span className="text-xs text-gray-500 truncate">{user.designation}</span>
                              )}
                            </div>
                            <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">+</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Row 7: Submit */}
          <div style={{ marginTop: '10px', marginBottom: '10px' }}>
            <button
              type="submit"
              style={{ backgroundColor: '#00aaff', color: 'white', border: 'none', padding: '14px', width: '100%', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,170,255,0.2)', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 15px rgba(0,170,255,0.3)'; e.target.style.backgroundColor = '#0099e6'; }}
              onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(0,170,255,0.2)'; e.target.style.backgroundColor = '#00aaff'; }}
            >
              Create Task
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}


// AssignPopup component (kept for reference but no longer used)
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