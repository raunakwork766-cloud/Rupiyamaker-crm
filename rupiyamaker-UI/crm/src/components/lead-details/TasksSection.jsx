import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Trash2, Calendar, Clock, User, Edit3, Upload, AlertTriangle, Target, X, Save } from 'lucide-react';

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
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(status)}`}>
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
    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getPriorityColor(priority)}`}>
      {priority}
    </span>
  );
}

// Task creation/edit form component
function TaskForm({ task, onSave, onCancel, users }) {
  const [formData, setFormData] = useState({
    subject: '',
    task_details: '',
    task_type: 'To-Do',
    status: 'Pending',
    priority: 'Medium',
    due_date: '',
    due_time: '',
    assigned_to: [],
    notes: '',
    is_urgent: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        subject: task.subject || '',
        task_details: task.task_details || '',
        task_type: task.task_type || 'To-Do',
        status: task.status || 'Pending',
        priority: task.priority || 'Medium',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        due_time: task.due_time || '',
        assigned_to: task.assigned_to || [],
        notes: task.notes || '',
        is_urgent: task.is_urgent || false
      });
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-medium text-lg">
          {task ? 'Edit Task' : 'Add New Task'}
        </h4>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subject */}
          <div className="md:col-span-2">
            <label className="block text-white font-medium mb-2">
              Subject *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Task subject"
              required
            />
          </div>

          {/* Task Details */}
          <div className="md:col-span-2">
            <label className="block text-white font-medium mb-2">
              Task Details
            </label>
            <textarea
              value={formData.task_details}
              onChange={(e) => setFormData({...formData, task_details: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Detailed task description"
              rows="3"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-white font-medium mb-2">
              Task Type
            </label>
            <select
              value={formData.task_type}
              onChange={(e) => setFormData({...formData, task_type: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="To-Do">To-Do</option>
              <option value="Call">Call</option>
              <option value="Pendency">Pendency</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-white font-medium mb-2">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-white font-medium mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Due Time */}
          <div>
            <label className="block text-white font-medium mb-2">
              Due Time
            </label>
            <input
              type="time"
              value={formData.due_time}
              onChange={(e) => setFormData({...formData, due_time: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Assigned To */}
          {users && users.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-white font-medium mb-2">
                Assign To
              </label>
              <select
                multiple
                value={formData.assigned_to}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData({...formData, assigned_to: values});
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                size="4"
              >
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple users</p>
            </div>
          )}

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-white font-medium mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Additional notes"
              rows="2"
            />
          </div>

          {/* Urgent Flag */}
          <div className="md:col-span-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_urgent}
                onChange={(e) => setFormData({...formData, is_urgent: e.target.checked})}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-white font-medium">Mark as Urgent</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.subject.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : (task ? 'Update Task' : 'Add Task')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TasksSection({ leadId, userId }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [leadId]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/tasks/lead/${leadId}?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      } else {
        throw new Error('Failed to load tasks');
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/filter-options/users?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

    const handleCreateTask = async (taskData) => {
    try {
      setError('');
      
      // Validate and filter assigned_to array to ensure only valid ObjectIds
      if (taskData.assigned_to && Array.isArray(taskData.assigned_to)) {
        taskData.assigned_to = taskData.assigned_to.filter(userId => {
          // Check if it's a valid ObjectId format (24 character hex string)
          return userId && typeof userId === 'string' && userId.length >= 12 && /^[0-9a-fA-F]+$/.test(userId);
        });
        console.log('Filtered assigned_to for create:', taskData.assigned_to);
      }
      
      console.log('Creating task with data:', taskData);
      
      const response = await fetch(`${API_BASE_URL}/tasks/?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...taskData,
          lead_id: leadId,
          created_by: userId,
        })
      });

      if (response.ok) {
        setSuccess('Task created successfully');
        setTimeout(() => setSuccess(''), 3000);
        setShowForm(false);
        loadTasks();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create task error:', errorData);
        throw new Error(errorData.detail || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Failed to create task: ' + error.message);
      throw error;
    }
  };

  const handleUpdateTask = async (taskData) => {
    try {
      setError('');
      
      // Validate and filter assigned_to array to ensure only valid ObjectIds
      if (taskData.assigned_to && Array.isArray(taskData.assigned_to)) {
        taskData.assigned_to = taskData.assigned_to.filter(userId => {
          // Check if it's a valid ObjectId format (24 character hex string)
          return userId && typeof userId === 'string' && userId.length >= 12 && /^[0-9a-fA-F]+$/.test(userId);
        });
        console.log('Filtered assigned_to:', taskData.assigned_to);
      }
      
      console.log('Sending task update:', taskData);
      
      const response = await fetch(`${API_BASE_URL}/tasks/${editingTask._id}?user_id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        setSuccess('Task updated successfully');
        setTimeout(() => setSuccess(''), 3000);
        setEditingTask(null);
        loadTasks();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Update task error:', errorData);
        throw new Error(errorData.detail || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task: ' + error.message);
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
        setSuccess('Task deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
        loadTasks();
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white flex items-center">
          <CheckSquare className="w-6 h-6 mr-2" />
          Tasks ({tasks.length})
        </h3>
        <button
          onClick={() => setIsAddingTask(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Add/Edit Task Form */}
      {(isAddingTask || editingTask) && (
        <TaskForm
          task={editingTask}
          onSave={editingTask ? handleUpdateTask : handleCreateTask}
          onCancel={() => {
            setIsAddingTask(false);
            setEditingTask(null);
          }}
          users={users}
        />
      )}

      {/* Tasks Table */}
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No tasks yet for this lead.</p>
          <p className="text-sm">Add your first task above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-[#000] border border-gray-700 rounded-lg">
            <thead>
              <tr className="bg-white text-[#03b0f5] text-left text-xl font-extrabold">
                <th className="px-4 py-3 font-bold whitespace-nowrap">Subject</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Urgent</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Created By</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Assigned To</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Due Date</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Created At</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Task Type</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Details</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Notes</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task._id} className="border-b-[3px] border-white text-white text-md font-semibold">
                  <td className="px-4 py-3">{task.subject}</td>
                  <td className="px-4 py-3"><StatusPill status={task.status} /></td>
                  <td className="px-4 py-3"><PriorityPill priority={task.priority} /></td>
                  <td className="px-4 py-3">
                    {task.is_urgent && (
                      <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        URGENT
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{task.created_by_name || 'Unknown'}</td>
                  <td className="px-4 py-3">
                    {task.assigned_users && task.assigned_users.length > 0
                      ? task.assigned_users.map(u => u.name).join(', ')
                      : 'None'}
                  </td>
                  <td className="px-4 py-3">
                    {task.due_date ? `${formatDate(task.due_date)} ${task.due_time ? `at ${task.due_time}` : ''}` : 'N/A'}
                  </td>
                  <td className="px-4 py-3">{formatDateTime(task.created_at)}</td>
                  <td className="px-4 py-3">{task.task_type}</td>
                  <td className="px-4 py-3">{task.task_details || 'N/A'}</td>
                  <td className="px-4 py-3">{task.notes || 'N/A'}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button
                      onClick={() => setEditingTask(task)}
                      disabled={task.created_by !== userId}
                      className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={task.created_by !== userId ? "You can only edit tasks you created" : "Edit task"}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}