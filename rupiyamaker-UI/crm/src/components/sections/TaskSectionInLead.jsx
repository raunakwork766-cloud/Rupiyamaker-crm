import React, { useState, useEffect, lazy, Suspense } from "react";
import { Plus } from 'lucide-react';
import { message } from "antd";
import { getISTDateYMD, toISTDateYMD, getISTTimestamp, getISTToday } from '../../utils/dateUtils';

const taskPageStyles = `
  .tsl-container { padding: 20px 30px; }
  .tsl-top-bar { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 20px; }
  .tsl-btn-create { background-color: #00aaff; color: white; border: none; padding: 10px 24px; border-radius: 30px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(0,170,255,0.3); transition: transform 0.2s, background-color 0.2s; }
  .tsl-btn-create:hover { transform: translateY(-1px); background-color: #0088cc; }
  .tsl-table-header { background-color: #ffffff; border-radius: 4px; display: flex; padding: 12px 15px; align-items: center; margin-bottom: 10px; }
  .tsl-th { color: #00aaff; font-weight: 800; font-size: 13px; text-transform: uppercase; text-align: left; flex: 1; }
  .tsl-th.number { flex: 0 0 40px; }
  .tsl-th.type { flex: 0 0 110px; }
  .tsl-th.created { flex: 1.2; }
  .tsl-th.subject { flex: 2; }
  .tsl-th.record { flex: 1.5; }
  .tsl-th.assigned { flex: 1.5; }
  .tsl-th.status { flex: 0 0 90px; }
  .tsl-th.date { flex: 1.2; }
  .tsl-table-body { display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
  .tsl-row { background-color: #1a1a1a; border: 1px solid #333; border-radius: 6px; display: flex; padding: 12px 15px; align-items: center; transition: background-color 0.2s, border-color 0.2s; cursor: pointer; animation: tslSlideIn 0.3s ease-out; }
  .tsl-row:hover { background-color: #222; border-color: #444; }
  .tsl-td { font-size: 13px; color: #ececec; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 10px; }
  .tsl-td.number { flex: 0 0 40px; color: #888; font-weight: bold; }
  .tsl-td.type { flex: 0 0 110px; }
  .tsl-td.created { flex: 1.2; }
  .tsl-td.subject { flex: 2; font-weight: 600; color: #fff; }
  .tsl-td.record { flex: 1.5; font-weight: 600; }
  .tsl-td.assigned { flex: 1.5; }
  .tsl-td.status { flex: 0 0 90px; }
  .tsl-td.date { flex: 1.2; }
  .tsl-type-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .tsl-badge-callback { background-color: rgba(46,204,113,0.15); color: #2ecc71; border: 1px solid rgba(46,204,113,0.3); }
  .tsl-badge-pendency { background-color: rgba(243,156,18,0.15); color: #f39c12; border: 1px solid rgba(243,156,18,0.3); }
  .tsl-badge-todo { background-color: rgba(0,170,255,0.15); color: #00aaff; border: 1px solid rgba(0,170,255,0.3); }
  .tsl-status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: #fff; }
  .tsl-sts-pending { background-color: #555; }
  .tsl-sts-complete { background-color: #2ecc71; }
  .tsl-sts-inprogress { background-color: #f39c12; }
  .tsl-sts-cancelled { background-color: #e74c3c; }
  .tsl-sts-failed { background-color: #ff4757; }
  .tsl-created-meta-col, .tsl-due-meta-col { display: flex; flex-direction: column; gap: 2px; }
  .tsl-created-meta-name { font-weight: 600; color: #00aaff; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
  .tsl-due-meta-date { font-weight: 700; color: #fff; font-size: 12px; }
  .tsl-due-meta-time { font-size: 11px; color: #aaa; }
  .tsl-due-overdue { color: #ff6b81; }
  .tsl-tag-lead { background: rgba(0,170,255,0.1); color: #00aaff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-right: 6px; }
  .tsl-record-name { color: #00aaff; font-weight: 700; }
  .tsl-record-number { color: #94a3b8; font-size: 11px; margin-left: 6px; }
  .tsl-empty { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px 20px; text-align: center; }
  .tsl-empty p { color: #00aaff; font-size: 16px; font-weight: 700; }
  .tsl-spinner-wrap { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px 20px; }
  .tsl-spinner { width: 36px; height: 36px; border: 3px solid transparent; border-top-color: #00aaff; border-radius: 50%; animation: tslSpin 0.8s linear infinite; margin-bottom: 10px; }
  @keyframes tslSpin { to { transform: rotate(360deg); } }
  @keyframes tslSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
`;

function getTaskTypeBadge(typeTask) {
  const t = (typeTask || '').toLowerCase();
  if (t === 'call' || t === 'callback') return { cls: 'tsl-type-badge tsl-badge-callback', label: '📞 Callback' };
  if (t === 'pendency') return { cls: 'tsl-type-badge tsl-badge-pendency', label: '⏳ Pendency' };
  if (t === 'to-do' || t === 'todo') return { cls: 'tsl-type-badge tsl-badge-todo', label: '📝 To-Do' };
  if (t === 'processing') return { cls: 'tsl-type-badge tsl-badge-pendency', label: '⚙️ Processing' };
  return { cls: 'tsl-type-badge tsl-badge-todo', label: typeTask || 'Task' };
}

function getStatusBadgeCls(status) {
  switch (status) {
    case 'Completed': return 'tsl-sts-complete';
    case 'In Progress': return 'tsl-sts-inprogress';
    case 'Cancelled': return 'tsl-sts-cancelled';
    case 'Failed': case 'FAILED': return 'tsl-sts-failed';
    default: return 'tsl-sts-pending';
  }
}

function formatDueDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const _ist = getISTToday();
    const today = new Date(_ist.year, _ist.month - 1, _ist.day);
    today.setHours(0, 0, 0, 0);
    const td = new Date(d);
    td.setHours(0, 0, 0, 0);
    if (td.getTime() === today.getTime()) return 'Today';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return dateStr; }
}

function isTaskOverdue(task) {
  if (['Completed', 'Cancelled', 'Failed', 'FAILED'].includes(task.status)) return false;
  try {
    const _ist = getISTToday();
    const today = new Date(_ist.year, _ist.month - 1, _ist.day);
    today.setHours(0, 0, 0, 0);
    const td = new Date(task.date);
    td.setHours(0, 0, 0, 0);
    return td.getTime() < today.getTime();
  } catch { return false; }
}

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
            notes: task.task_details || task.notes || task.details || task.message || '', // task_details is the primary backend field
            message: task.task_details || task.notes || task.details || task.message || '', // Keep message field for backward compatibility
            task_details: task.task_details || '', // Pass through raw backend field for EditTask
            typeTask: task.task_type || task.type || 'TO DO',
            leadLogin: leadData.lead_number || '',
            customerName: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
            date: toISTDateYMD(task.due_date || task.created_at),
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
          notes: task.task_details || task.notes || task.details || task.message || '', // task_details is the primary backend field
          message: task.task_details || task.notes || task.details || task.message || '', // Keep message field for backward compatibility
          task_details: task.task_details || '', // Pass through raw backend field for EditTask
          typeTask: task.task_type || task.type || 'TO DO',
          leadLogin: leadData.lead_number || '',
          customerName: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
          date: toISTDateYMD(task.due_date || task.created_at),
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
        notes: task.task_details || task.notes || task.message || '',
        message: task.task_details || task.notes || task.message || '',
        task_details: task.task_details || task.notes || task.message || '',
        // Build a proper lead association object (not a plain string)
        associateWithRecords: leadData ? [{
          id: leadData._id,
          lead_id: leadData._id,
          name: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
          customer_name: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
          phone: leadData.phone || '',
          lead_number: leadData.lead_number || '',
          lead_login: 'Lead',
          loan_type: leadData.loan_type || ''
        }] : []
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
            notes: fullTaskData.task_details || fullTaskData.notes || fullTaskData.details || enhancedTask.notes || '',
            message: fullTaskData.task_details || fullTaskData.notes || fullTaskData.details || enhancedTask.message || '',
            task_details: fullTaskData.task_details || enhancedTask.task_details || '',
            // Merge attachments from full fetch if available
            attachments: fullTaskData.attachments && fullTaskData.attachments.length > 0 ? fullTaskData.attachments : enhancedTask.attachments,
            // Preserve the lead association object
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
        notes: task.task_details || task.notes || task.message || '',
        message: task.task_details || task.notes || task.message || '',
        task_details: task.task_details || task.notes || task.message || '',
        attachments: task.attachments || [],
        // Build a proper lead association object even in error case
        associateWithRecords: leadData ? [{
          id: leadData._id,
          lead_id: leadData._id,
          name: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
          customer_name: leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Customer',
          phone: leadData.phone || '',
          lead_number: leadData.lead_number || '',
          lead_login: 'Lead',
          loan_type: leadData.loan_type || ''
        }] : []
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
      
      // Respect keepModalOpen flag (used for status-change saves that must keep modal open)
      const keepModalOpen = updatedTask.keepModalOpen === true;

      // Look for attachment in different possible locations
      const attachment = updatedTask.attachment || 
                        updatedTask.newAttachment || 
                        data.attachment ||
                        null;
      
      console.log('Handle save task with:', { updatedTask, attachment, keepModalOpen });
      
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
      
      // Only close the modal if keepModalOpen is NOT set
      // (status-change remark saves keep the modal open for review)
      if (!keepModalOpen) {
        setEditTask(null);
      } else {
        // Update editTask state with latest status/message for in-modal refresh
        setEditTask(prev => prev ? ({
          ...prev,
          status: updatedTask.uiStatus || updatedTask.status || prev.status,
          message: mappedTask.message || prev.message,
          subject: mappedTask.subject || prev.subject,
        }) : null);
      }
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
      date: taskData.due_date || taskData.date || getISTDateYMD(),
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
    <div style={{ backgroundColor: '#000', color: '#fff' }}>
      <style>{taskPageStyles}</style>
      <div className="tsl-container">

        {/* Top Bar — Create Task button only (no heading) */}
        <div className="tsl-top-bar">
          <button className="tsl-btn-create" onClick={openCreateModal}>
            <Plus size={18} />
            Create Task
          </button>
        </div>

        {/* Loading */}
        {isLoading && tasks.length === 0 && (
          <div className="tsl-spinner-wrap">
            <div className="tsl-spinner" />
            <p style={{ color: '#00aaff', fontSize: 15, fontWeight: 700 }}>Loading tasks...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ margin: '0 0 16px', padding: '14px 18px', background: '#1a0000', border: '1px solid #ff4757', borderRadius: 8 }}>
            <p style={{ color: '#ff6b6b', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Table */}
        {(!isLoading || tasks.length > 0) && (
          <div>
            {/* Header row */}
            <div className="tsl-table-header">
              <div className="tsl-th number">#</div>
              <div className="tsl-th type">TYPE</div>
              <div className="tsl-th created">CREATED BY</div>
              <div className="tsl-th subject">SUBJECT</div>
              <div className="tsl-th record">RECORD / LEAD</div>
              <div className="tsl-th assigned">ASSIGNED TO</div>
              <div className="tsl-th status">STATUS</div>
              <div className="tsl-th date">DUE DATE &amp; TIME</div>
            </div>

            {/* Body */}
            <div className="tsl-table-body">
              {tasks.length === 0 ? (
                <div className="tsl-empty">
                  <p>No Tasks Found</p>
                </div>
              ) : (
                tasks.map((task, idx) => {
                  const badge = getTaskTypeBadge(task.typeTask);
                  const overdue = isTaskOverdue(task);
                  const hasRecord = task.leadLogin && task.leadLogin !== 'N/A';

                  return (
                    <div
                      key={task.id}
                      className="tsl-row"
                      onClick={() => handleRowClick(task)}
                    >
                      <div className="tsl-td number">{idx + 1}</div>

                      <div className="tsl-td type">
                        <span className={badge.cls}>{badge.label}</span>
                      </div>

                      <div className="tsl-td created">
                        <div className="tsl-created-meta-col">
                          <span className="tsl-created-meta-name">{task.createdBy}</span>
                        </div>
                      </div>

                      <div className="tsl-td subject">{task.subject}</div>

                      <div className="tsl-td record">
                        {hasRecord ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                            <span className="tsl-tag-lead">Lead</span>
                            <span className="tsl-record-name">{task.customerName || 'Unknown'}</span>
                            <span className="tsl-record-number">{task.leadLogin}</span>
                          </span>
                        ) : '-'}
                      </div>

                      <div className="tsl-td assigned" style={{ whiteSpace: 'normal', lineHeight: 1.6 }}>
                        {(task.assign || 'Unassigned').split(',').map((name, i) => (
                          <span key={i} style={{ display: 'block', fontSize: 11 }}>👤 {name.trim()}</span>
                        ))}
                      </div>

                      <div className="tsl-td status">
                        <span className={`tsl-status-badge ${getStatusBadgeCls(task.status)}`}>
                          {task.status}
                        </span>
                      </div>

                      <div className="tsl-td date">
                        <div className="tsl-due-meta-col">
                          <span className={`tsl-due-meta-date${overdue ? ' tsl-due-overdue' : ''}`}>
                            {formatDueDisplay(task.date)}
                          </span>
                          <span className="tsl-due-meta-time">{task.time}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {editTask && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent" style={{ backdropFilter: 'blur(3px)' }}>
            <div className="w-full max-w-2xl mx-auto relative z-[9999]">
              <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
                <EditTask
                  taskData={editTask}
                  onClose={handleCancelEdit}
                  onSave={handleSaveTask}
                  preselectedLead={leadData}
                  isInsideLeadContext={true}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent" style={{ backdropFilter: 'blur(3px)' }}>
            <div className="w-full max-w-2xl mx-auto relative z-[9999]">
              <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
                <CreateTask
                  onClose={closeCreateModal}
                  onSave={handleCreateTaskSave}
                  preselectedLead={leadData}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}