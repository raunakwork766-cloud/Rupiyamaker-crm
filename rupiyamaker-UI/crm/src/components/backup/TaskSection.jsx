import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Plus, Trash2, Calendar, Clock, User, Edit3, 
  AlertTriangle, Target, X, Save, ChevronDown, ChevronUp 
} from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Status pill component
function StatusPill({ status }) {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-900 text-green-300 border-green-600';
      case 'in progress':
        return 'bg-yellow-900 text-yellow-300 border-yellow-600';
      case 'pending':
        return 'bg-blue-900 text-blue-300 border-blue-600';
      case 'cancelled':
        return 'bg-red-900 text-red-300 border-red-600';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-600';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}

// Priority pill component
function PriorityPill({ priority }) {
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-900 text-red-300 border-red-600';
      case 'high':
        return 'bg-orange-900 text-orange-300 border-orange-600';
      case 'medium':
        return 'bg-yellow-900 text-yellow-300 border-yellow-600';
      case 'low':
        return 'bg-green-900 text-green-300 border-green-600';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-600';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(priority)}`}>
      {priority}
    </span>
  );
}

// Quick task creation form
function QuickTaskForm({ onSave, onCancel, leadId }) {
  const [formData, setFormData] = useState({
    subject: '',
    task_details: '',
    priority: 'Medium',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '',
    is_urgent: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim()) return;

    setLoading(true);
    try {
      await onSave(formData);
      setFormData({
        subject: '',
        task_details: '',
        priority: 'Medium',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '',
        is_urgent: false
      });
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-medium">Quick Add Task</h4>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={formData.subject}
          onChange={(e) => setFormData({...formData, subject: e.target.value})}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          placeholder="Task subject (required)"
          required
        />

        <textarea
          value={formData.task_details}
          onChange={(e) => setFormData({...formData, task_details: e.target.value})}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="Task details"
          rows="2"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <select
            value={formData.priority}
            onChange={(e) => setFormData({...formData, priority: e.target.value})}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>

          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({...formData, due_date: e.target.value})}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          />

          <input
            type="time"
            value={formData.due_time}
            onChange={(e) => setFormData({...formData, due_time: e.target.value})}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.is_urgent}
              onChange={(e) => setFormData({...formData, is_urgent: e.target.checked})}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-white text-sm">Mark as urgent</span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.subject.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-1 text-sm"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * TaskSection Component for Lead Details
 * 
 * This component displays and manages tasks related to a specific lead.
 * It can be used within the Lead Details page or any other component
 * that needs to show lead-specific tasks.
 * 
 * Props:
 * - leadId: Required. The ID of the lead to show tasks for
 * - userId: Required. The current user's ID
 * - compact: Optional. If true, shows a more compact view
 * - maxItems: Optional. Maximum number of tasks to show initially
 * - showAddButton: Optional. Whether to show the "Add Task" button
 */
export default function TaskSection({ 
  leadId, 
  userId, 
  compact = false, 
  maxItems = null, 
  showAddButton = true 
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  useEffect(() => {
    if (leadId && userId) {
      loadTasks();
    }
  }, [leadId, userId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Use the general tasks endpoint with lead filter instead of lead-specific endpoint
      // This ensures we get all tasks for this lead, including ones created from main task page
      const params = new URLSearchParams({
        user_id: userId,
        lead_id: leadId, // Filter by lead ID
        page_size: 100 // Get more tasks for lead-specific view
      });
      
      const response = await fetch(`${API_BASE_URL}/tasks/?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Handle both array response and object with tasks property
        const tasksData = Array.isArray(data) ? data : (data.tasks || []);
        setTasks(tasksData);
        console.log(`Loaded ${tasksData.length} tasks for lead ${leadId}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load tasks');
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError(error.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      setError('');
      // Use the general tasks endpoint instead of lead-specific endpoint
      // This ensures consistency with tasks created from main task page
      const response = await fetch(`${API_BASE_URL}/tasks/?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...taskData,
          created_by: userId,
          lead_id: leadId, // Associate with the lead
          task_type: 'To-Do',
          status: 'Pending',
          assigned_to: [userId] // Default assign to creator
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || 'Task added successfully');
        setTimeout(() => setSuccess(''), 3000);
        setShowAddForm(false);
        // Reload tasks immediately to show the new task
        await loadTasks();
        console.log('Task created and list refreshed');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setError(error.message || 'Failed to create task');
      throw error;
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}?user_id=${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || 'Task deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
        loadTasks();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError(error.message || 'Failed to delete task');
    }
  };

  const toggleTaskExpansion = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const displayTasks = maxItems && !showAll ? tasks.slice(0, maxItems) : tasks;
  const hasMoreTasks = maxItems && tasks.length > maxItems && !showAll;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white flex items-center ${compact ? 'text-lg' : 'text-xl'}`}>
          <CheckSquare className={`mr-2 ${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
          Tasks {tasks.length > 0 && `(${tasks.length})`}
        </h3>
        {showAddButton && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 px-3 py-2 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Quick Add Form */}
      {showAddForm && (
        <QuickTaskForm
          onSave={handleCreateTask}
          onCancel={() => setShowAddForm(false)}
          leadId={leadId}
        />
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {displayTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks for this lead yet.</p>
            {showAddButton && (
              <button
                onClick={() => setShowAddForm(true)}
                className="text-blue-400 hover:text-blue-300 text-sm mt-1"
              >
                Add the first task
              </button>
            )}
          </div>
        ) : (
          displayTasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id || task._id);
            const taskId = task.id || task._id;
            return (
              <div 
                key={taskId} 
                className={`bg-gray-800 rounded-lg border border-gray-700 ${compact ? 'p-3' : 'p-4'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className={`font-medium text-white ${compact ? 'text-sm' : 'text-base'}`}>
                        {task.subject}
                      </h4>
                      <StatusPill status={task.status} />
                      <PriorityPill priority={task.priority} />
                      {task.is_urgent && (
                        <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          URGENT
                        </span>
                      )}
                    </div>

                    {task.task_details && (
                      <div className="text-gray-300 mb-2">
                        <p className={`text-sm ${!isExpanded && task.task_details.length > 100 ? 'line-clamp-2' : ''}`}>
                          {task.task_details}
                        </p>
                        {task.task_details.length > 100 && (
                          <button
                            onClick={() => toggleTaskExpansion(taskId)}
                            className="text-blue-400 hover:text-blue-300 text-xs mt-1"
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}

                    <div className={`grid gap-2 text-xs text-gray-400 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>By: {task.creator_name || task.created_by_name || 'Unknown'}</span>
                      </div>

                      {task.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Due: {formatDate(task.due_date)} {task.due_time && `at ${task.due_time}`}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Created: {formatDateTime(task.created_at)}</span>
                      </div>

                      {task.assigned_users && task.assigned_users.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span>Assigned: {task.assigned_users.map(u => u.name).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => handleDeleteTask(taskId)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Show More/Less Button */}
        {hasMoreTasks && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-center text-blue-400 hover:text-blue-300 py-2 text-sm flex items-center justify-center gap-1"
          >
            <ChevronDown className="w-4 h-4" />
            Show {tasks.length - maxItems} more tasks
          </button>
        )}

        {maxItems && showAll && tasks.length > maxItems && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full text-center text-blue-400 hover:text-blue-300 py-2 text-sm flex items-center justify-center gap-1"
          >
            <ChevronUp className="w-4 h-4" />
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
