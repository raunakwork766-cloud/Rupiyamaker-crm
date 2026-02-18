import React, { useState, useEffect, lazy, Suspense } from "react";
import { CheckSquare, Plus, Loader2 } from 'lucide-react';
import { message } from "antd";

// Lazy load heavy components for better code splitting
const CreateTask = lazy(() => import("../CreateTask"));
const EditTask = lazy(() => import("../EditTask"));

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

export default function TaskSectionInLead({ leadData }) {
  const [tasks, setTasks] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get current user from localStorage
  const currentUser = localStorage.getItem('userId') || '';

  // Fetch tasks for the current lead from API
  useEffect(() => {
    const fetchTasksForLead = async () => {
      if (!leadData?._id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
          console.warn('No user ID available');
          setError('User authentication required');
          return;
        }
        
        // Detect if this is a login lead or regular lead
        const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
        const apiUrl = isLoginLead 
          ? `/api/lead-login/login-leads/${leadData._id}/tasks?user_id=${userId}`
          : `/api/tasks/lead/${leadData._id}?user_id=${userId}`;
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Tasks loaded from API:', data);
        
        // Format tasks to match the expected structure in the component
        const formattedTasks = data.tasks.map(task => {
          console.log('Processing task:', task.id, 'assigned_users:', task.assigned_users);
          
          return {
            id: task.id,
            createdBy: task.creator_name || task.created_by || 'Unknown',
            status: task.status,
            subject: task.subject,
            notes: task.notes || task.details || task.message || '', // Use notes field first, then fallback to details or message
            message: task.notes || task.details || task.message || '', // Keep message field for backward compatibility
            typeTask: task.task_type || task.type || 'TO DO',
            leadLogin: leadData.lead_number || '',
            customerName: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
            date: new Date(task.due_date || task.created_at).toISOString().split('T')[0],
            time: task.due_time || '12:00 PM',
            assign: task.assigned_users && task.assigned_users.length > 0 ? 
              task.assigned_users.map(user => user.name || user.username || 'Unknown').join(', ') : 
              'Unassigned',
            assigned_to: task.assigned_to || []
          };
        });
        
        setTasks(formattedTasks);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError('Failed to load tasks');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTasksForLead();
  }, [leadData]);

  // Function to save tasks data to backend API
  const saveToAPI = async (taskData) => {
    if (!leadData?._id) {
      console.warn('No lead ID available, cannot save to API');
      return;
    }

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID available');
        return;
      }

      // For updating an existing task
      if (taskData.id) {
        const apiUrl = `/api/tasks/${taskData.id}?user_id=${userId}`;
        
        console.log('Updating task with data:', taskData);
        
        // Map frontend values to backend enum values
        const statusMapping = {
          "PENDING": "Pending",
          "IN_PROGRESS": "In Progress", 
          "COMPLETED": "Completed",
          "CANCELLED": "Cancelled",
          // Also handle direct values
          "Pending": "Pending",
          "In Progress": "In Progress",
          "Completed": "Completed",
          "Cancelled": "Cancelled"
        };
        
        const taskTypeMapping = {
          "TO DO": "To-Do",
          "To-Do": "To-Do",
          "Call": "Call",
          "Pendency": "Pendency",
          "Processing": "Processing",
          "Completed": "Completed"
        };
        
        const updateData = {
          subject: taskData.subject,
          task_details: taskData.message || taskData.notes || taskData.description, // Backend expects task_details, not notes
          status: statusMapping[taskData.status] || "Pending",
          task_type: taskTypeMapping[taskData.typeTask || taskData.task_type] || "To-Do",
          due_date: taskData.date || taskData.due_date,
          due_time: taskData.time || taskData.due_time,
          assigned_to: taskData.assigned_to || [userId]
        };
        
        // Validate and filter assigned_to array to ensure only valid ObjectIds
        if (updateData.assigned_to && Array.isArray(updateData.assigned_to)) {
          updateData.assigned_to = updateData.assigned_to.filter(userId => {
            // Check if it's a valid ObjectId format (24 character hex string)
            return userId && typeof userId === 'string' && userId.length >= 12 && /^[0-9a-fA-F]+$/.test(userId);
          });
          console.log('Filtered assigned_to in TaskSectionInLead:', updateData.assigned_to);
        }

        const token = localStorage.getItem('token');
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        };
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: headers,
          mode: 'cors', // Set CORS mode explicitly
          body: JSON.stringify(updateData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        message.success(`Task Updated: ${taskData.subject || 'Untitled'}`);
        console.log('Task updated successfully');
      } 
      // For creating a new task for the lead
      else {
        // Detect if this is a login lead or regular lead
        const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
        const apiUrl = isLoginLead
          ? `/api/lead-login/login-leads/${leadData._id}/tasks/create?user_id=${userId}`
          : `/api/tasks/lead/${leadData._id}/create?user_id=${userId}`;
        
        // Ensure we're passing valid data to the API
        const createData = {
          subject: taskData.subject,
          task_details: taskData.message || taskData.notes || '', // Backend expects task_details, not notes
          status: 'Pending', // Use 'Pending' as it's one of the acceptable enum values
          task_type: taskData.typeTask || 'To-Do', // Ensure we have a valid task type
          due_date: taskData.date,
          due_time: taskData.time,
          lead_id: leadData._id,
          // Always use userId directly as the API expects user IDs not names
          assigned_to: [userId], 
          created_by: userId
        };
        
        // Handle attachment upload if present
        let attachmentToUpload = taskData.attachment;

        console.log('Creating task with data:', createData);
        
        const token = localStorage.getItem('token');
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        };
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          mode: 'cors', // Set CORS mode explicitly
          body: JSON.stringify(createData)
        });

        if (!response.ok) {
          // Try to get more detailed error message
          let errorText = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            console.error('API Error response:', errorData);
            if (errorData.detail) {
              errorText += ` - ${typeof errorData.detail === 'string' ? 
                errorData.detail : 
                JSON.stringify(errorData.detail)}`;
            }
            
            // Add more context to the error for debugging
            console.log('Task creation failed. Data sent:', {
              url: apiUrl,
              data: createData
            });
          } catch (jsonError) {
            console.error('Could not parse error response:', jsonError);
          }
          throw new Error(errorText);
        }

        console.log('New task created successfully');
        message.success(`Task Created: ${taskData.subject || 'Untitled'}`);
        
        // Get the created task ID from the response if available
        let createdTaskId;
        try {
          const responseData = await response.json();
          createdTaskId = responseData.id || responseData.task_id;
          console.log('Created task ID:', createdTaskId);
          
          // Upload attachment if present and we have a task ID
          if (attachmentToUpload && createdTaskId) {
            await uploadTaskAttachment(createdTaskId, attachmentToUpload, userId);
          }
        } catch (parseError) {
          console.error('Error parsing response or uploading attachment:', parseError);
        }
      }
      
      // Refresh tasks after creating/updating
      // Detect if this is a login lead or regular lead
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const refreshUrl = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/tasks?user_id=${userId}`
        : `${API_BASE_URL}/tasks/lead/${leadData._id}?user_id=${userId}`;
      
      const fetchTasksResponse = await fetch(refreshUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (fetchTasksResponse.ok) {
        const data = await fetchTasksResponse.json();
        
        // Format tasks to match the expected structure
        const formattedTasks = data.tasks.map(task => ({
          id: task.id,
          createdBy: task.creator_name || task.created_by || 'Unknown',
          status: task.status,
          subject: task.subject,
          notes: task.notes || task.details || task.message || '', // Use notes field first, then fallback to details or message
          message: task.notes || task.details || task.message || '', // Keep message field for backward compatibility
          typeTask: task.task_type || task.type || 'TO DO',
          leadLogin: leadData.lead_number || '',
          customerName: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
          date: new Date(task.due_date || task.created_at).toISOString().split('T')[0],
          time: task.due_time || '12:00 PM',
          assign: task.assigned_users && task.assigned_users.length > 0 ? 
            task.assigned_users.map(user => user.name || user.username || 'Unknown').join(', ') : 
            'Unassigned',
          assigned_to: task.assigned_to || []
        }));
        
        setTasks(formattedTasks);
      }
    } catch (error) {
      console.error('Error saving task data to API:', error);
    }
  };

  // Helper function to upload attachment for a task
  const uploadTaskAttachment = async (taskId, attachment, userId) => {
    if (!taskId || !attachment || !userId) {
      console.warn('Missing required data for attachment upload');
      return;
    }
    
    try {
      console.log(`Preparing to upload attachment for task ID: ${taskId}`);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', attachment);
      
      // Upload the attachment
      const uploadUrl = `/api/tasks/${taskId}/attachments?user_id=${userId}`;
      console.log(`Uploading to URL: ${uploadUrl}`);
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
          // Note: Do not set 'Content-Type' header when using FormData, 
          // browser will set it automatically with the correct boundary
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => 'No error details available');
        console.error(`Attachment upload failed with status ${uploadResponse.status}:`, errorText);
        throw new Error(`Attachment upload failed: ${uploadResponse.status}`);
      }
      
      const responseData = await uploadResponse.json().catch(() => null);
      console.log('Task attachment uploaded successfully:', responseData);
      return responseData;
    } catch (error) {
      console.error('Error uploading task attachment:', error);
    }
  };

  // Helper function to fetch attachments for a specific task
  const fetchTaskAttachments = async (taskId, userId) => {
    if (!taskId || !userId) {
      console.warn('Missing required data for fetching attachments');
      return [];
    }
    
    try {
      console.log(`Fetching attachments for task ID: ${taskId}`);
      
      const token = localStorage.getItem('token');
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      // Only add Authorization if we have a token
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Use the dedicated attachments endpoint
      const attachmentUrl = `/api/tasks/${taskId}/attachments?user_id=${userId}`;
      console.log(`Fetching from URL: ${attachmentUrl}`);
      
      const attachmentResponse = await fetch(attachmentUrl, {
        method: 'GET',
        headers,
        mode: 'cors'
      });
      
      if (!attachmentResponse.ok) {
        console.error(`Attachment fetch failed with status ${attachmentResponse.status}`);
        return [];
      }
      
      const attachmentData = await attachmentResponse.json();
      console.log('Task attachments fetched successfully:', attachmentData);
      
      // Normalize the attachment data structure based on API response
      let attachments = [];
      
      // Handle different possible response structures
      if (Array.isArray(attachmentData)) {
        attachments = attachmentData;
      } else if (attachmentData.attachments && Array.isArray(attachmentData.attachments)) {
        attachments = attachmentData.attachments;
      } else if (typeof attachmentData === 'object') {
        // If it's an object but not in expected format, convert to array
        attachments = [attachmentData];
      }
      
      return attachments;
    } catch (error) {
      console.error('Error fetching task attachments:', error);
      return [];
    }
  };

  // All possible statuses for update - these values must match backend enum values
  const STATUS_OPTIONS = [
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];

// Task type options
const TASK_TYPE_OPTIONS = [
  "TO DO",
  "CUSTOMER CALL",
  "TENDENCY"
];

// Helper function for status display in table
function statusPill(status) {
  switch (status) {
    case "Completed":
      return (
        <span className="bg-green-900 text-green-300 px-3 py-1 rounded-full text-xs font-bold">
          Completed
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
    // Keep compatibility with any old status values that might still be in the system
    case "COMPLETED":
      return (
        <span className="bg-green-900 text-green-300 px-3 py-1 rounded-full text-xs font-bold">
          Completed
        </span>
      );
    case "OVERDUE":
      return (
        <span className="bg-red-900 text-red-300 px-3 py-1 rounded-full text-xs font-bold">
          Overdue
        </span>
      );
    case "OPEN":
    case "UPCOMING":
      return (
        <span className="bg-blue-900 text-blue-300 px-3 py-1 rounded-full text-xs font-bold">
          Pending
        </span>
      );
    case "DUE TODAY":
      return (
        <span className="bg-yellow-900 text-yellow-300 px-3 py-1 rounded-full text-xs font-bold">
          Due Today
        </span>
      );
    default:
      return (
        <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-bold">
          {status}
        </span>
      );
  }
}

// Helper to truncate message for table
function truncate(str, length = 30) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
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

  // Handle row click to show EditTask
  const handleRowClick = async (task) => {
    setEditTask(null);
    
    try {
      // Instead of fetching the task details from the API (which might cause CORS issues),
      // we'll use the task data we already have but still try to fetch if possible
      const userId = localStorage.getItem('userId') || '';
      
      // First, prepare the task data we already have
      let enhancedTask = {
        ...task,
        attachments: task.attachments || [],
        notes: task.notes || task.message || '',
        message: task.notes || task.message || '',
        // Add the lead association data explicitly
        associateWithRecords: leadData ? [`${leadData.full_name || ''} - ${leadData.company_name || 'N/A'} (${leadData.status || 'Active'})`] : []
      };
      
      // Try to fetch full task details and attachments (separately for more robustness)
      try {
        // Step 1: Try to get the task details first
        const token = localStorage.getItem('token');
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const taskResponse = await fetch(`${API_BASE_URL}/tasks/${task.id}?user_id=${userId}`, {
          headers,
          mode: 'cors',
          // Increase timeout for slow connections
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        // Step 2: Get task details if available
        if (taskResponse.ok) {
          const fullTaskData = await taskResponse.json();
          console.log('Fetched full task details:', fullTaskData);
          
          enhancedTask = {
            ...enhancedTask,
            notes: fullTaskData.notes || fullTaskData.details || enhancedTask.notes || '',
            message: fullTaskData.notes || fullTaskData.details || enhancedTask.message || '',
            // Make sure lead association data is preserved
            associateWithRecords: enhancedTask.associateWithRecords
          };
        } 
        
        // Step 3: Always try to get attachments separately (more reliable than depending on task details)
        const attachments = await fetchTaskAttachments(task.id, userId);
        console.log('Fetched attachments separately:', attachments);
        
        if (attachments && attachments.length > 0) {
          // Add these attachments to our task data
          enhancedTask.attachments = attachments;
        }
      } catch (fetchError) {
        console.log('Could not fetch task details or attachments, using existing data:', fetchError);
        // Continue using the enhancedTask we prepared above
      }
      
      // Add associated lead info to task data
      if (leadData) {
        enhancedTask.leadData = {
          id: leadData._id,
          name: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim(),
          companyName: leadData.company_name || 'N/A',
          status: leadData.status || 'Active'
        };
        
        // Explicitly set lead association for EditTask
        enhancedTask.associateWithLead = leadData;
      }
      
      // Always set the enhanced task with the data we have
      console.log('Using task data for edit:', enhancedTask);
      setTimeout(() => setEditTask(enhancedTask), 0);
      
    } catch (error) {
      console.error('Error in handleRowClick:', error);
      // Fall back to the original task data if there was an error
      const fallbackTask = {
        ...task,
        notes: task.notes || task.message || '',
        message: task.notes || task.message || '',
        attachments: task.attachments || [],
        // Still include associated records even in error case
        associateWithRecords: leadData ? [`${leadData.full_name || ''} - ${leadData.company_name || 'N/A'} (${leadData.status || 'Active'})`] : []
      };
      
      console.log('Using fallback task data:', fallbackTask);
      setTimeout(() => setEditTask(fallbackTask), 0);
    }
  };

  // Handle save task from EditTask
  const handleSaveTask = async (data) => {
    try {
      // Check if we received the full data object or just the task data
      const updatedTask = data.taskData || data;
      
      // Look for attachment in different possible locations
      const attachment = updatedTask.attachment || 
                        updatedTask.newAttachment || 
                        data.attachment ||
                        null;
      
      console.log('Handle save task with:', { updatedTask, attachment });
      
      // Map EditTask fields to backend expected fields
      const mappedTask = {
        ...updatedTask,
        // Map title/subject fields
        subject: updatedTask.subject || updatedTask.title,
        // Map description/message fields to what backend expects
        message: updatedTask.description || updatedTask.message || updatedTask.task_details,
        // Map task type fields
        typeTask: updatedTask.task_type || updatedTask.typeTask,
        // Map date fields
        date: updatedTask.due_date || updatedTask.date,
        time: updatedTask.due_time || updatedTask.time,
        // Ensure status is properly mapped
        status: updatedTask.status
      };
      
      // Save the task first
      await saveToAPI(mappedTask);
      
      // If we have a new attachment, upload it separately after task is saved
      if (attachment) {
        const userId = localStorage.getItem('userId') || '';
        if (userId && updatedTask.id) {
          console.log('Uploading attachment after task update');
          try {
            await uploadTaskAttachment(updatedTask.id, attachment, userId);
            console.log('Attachment uploaded successfully after task update');
          } catch (attachError) {
            console.error('Error uploading attachment after task update:', attachError);
          }
        }
      }
      
      setEditTask(null); // Close EditTask after saving
    } catch (error) {
      console.error("Error saving task:", error);
      // Keep dialog open on error
    }
  };

  // Handle cancel from EditTask
  const handleCancelEdit = () => {
    setEditTask(null);
  };

  // Create Task Modal controls
  const openCreateModal = () => {
    setShowCreateModal(true);
  };
  
  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  // Create new task from the CreateTask component
  const handleCreateTaskSave = async (data) => {
    // Get the taskData from the CreateTask component
    const { taskData } = data;
    
    console.log('Received task data for new task:', data);
    
    // Look for attachment in different possible locations
    const attachment = data.attachment || 
                     taskData.attachment || 
                     taskData.newAttachment || 
                     null;
    
    // Prepare new task data for API
    const newTask = {
      subject: taskData.subject,
      // Extract message from the correct field based on the form structure
      notes: taskData.message || taskData.notes || taskData.task_details || taskData.details || '',
      // Make sure we use the task_type as expected by the API
      typeTask: taskData.task_type || taskData.typeTask,
      // Associate with current lead
      leadLogin: leadData.lead_number || '',
      customerName: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim(),
      // Use the provided due date or today's date
      date: taskData.due_date || taskData.date || new Date().toISOString().split('T')[0],
      time: taskData.due_time || taskData.time || '12:00 PM',
      // Use the current user ID as the assignee, API expects user IDs not names
      assigned_to: [currentUser], // Always use current user ID as the API needs IDs, not names
      status: "Pending", // Using the correct enum value expected by the API
      // Include attachment for later upload
      attachment: attachment
    };
    
    console.log('Saving new task with data:', newTask);
    
    try {
      await saveToAPI(newTask);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating new task:", error);
      // Keep dialog open on error
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#e4eaf5] py-10 px-4">
      <div className="max-w-9xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl text-[#08B8EA]">
              <CheckSquare size={32} />
            </span>
            <h1 className="text-2xl font-bold">Task Management</h1>
          </div>
          <button
            className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white text-xl font-bold px-7 py-2 rounded-2xl shadow-lg transition transform hover:scale-105 flex items-center gap-2"
            onClick={openCreateModal}
          >
            <Plus size={24} />
            Create Task
          </button>
        </div>

        {/* Table Section */}
        <div className="overflow-auto rounded-xl shadow-2xl">
          <table className="min-w-[1000px] w-full">
            <thead className="bg-white">
              <tr>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  #
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Subject
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Status
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Created By
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Lead/Login
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Customer
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Assigned
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Date
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Time
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Task Type
                </th>
                <th className="py-3 px-4 text-lg font-extrabold text-[#03B0F5] text-center whitespace-nowrap">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="bg-[#181e29] rounded-xl shadow p-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 size={24} className="animate-spin text-[#08B8EA]" />
                      <span className="text-lg font-bold text-[#08B8EA]">Loading tasks...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="bg-[#181e29] rounded-xl shadow p-8 text-center">
                    <div className="text-lg font-bold text-red-400">{error}</div>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="bg-[#181e29] rounded-xl shadow p-8 text-center text-lg font-bold text-[#08B8EA]"
                  >
                    No Tasks Found
                  </td>
                </tr>
              ) : (
                tasks.map((task, idx) => (
                  <tr
                    key={task.id}
                    className="border-b-4 border-white bg-[#181e29] hover:bg-gray-800 transition cursor-pointer"
                    onClick={() => handleRowClick(task)}
                  >
                    <td className="text-lg text-bold py-3 px-4 whitespace-nowrap text-center">
                      {idx + 1}
                    </td>
                    <td className="text-lg py-3 px-4 whitespace-nowrap font-bold uppercase">
                      {task.subject}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center">
                      {statusPill(task.status)}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center uppercase">
                      {task.createdBy}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center uppercase">
                      {task.leadLogin}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap uppercase">
                      {task.customerName}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center uppercase">
                      {task.assign}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center">
                      {task.date}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center">
                      {task.time}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap text-center uppercase">
                      {task.typeTask}
                    </td>
                    <td className="text-lg font-semibold py-3 px-4 whitespace-nowrap uppercase">
                      {truncate(task.notes || task.message || '', 30)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Render EditTask in a modal popup when a task is selected */}
        {editTask && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
            <div className="w-full max-w-2xl mx-auto relative z-[9999]">
              <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
                <EditTask
                  taskData={editTask}
                  onClose={handleCancelEdit}
                  onSave={handleSaveTask}
                  preselectedLead={leadData} // Pass the current lead data to show as preselected
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* Modal Popup for Create Task */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
            <div className="w-full max-w-2xl mx-auto relative z-[9999]">
              <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
                <CreateTask
                  onClose={closeCreateModal}
                  onSave={handleCreateTaskSave}
                  preselectedLead={leadData} // Pass the current lead data to pre-select it
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}