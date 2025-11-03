import React from 'react';
import { X, AlertCircle, Calendar, Clock } from 'lucide-react';

/**
 * OverdueTaskPopup - A full-screen popup that appears when a task is overdue
 * 
 * @param {Object} props
 * @param {Object} props.task - The overdue task details
 * @param {Function} props.onClose - Function to call when closing the popup
 * @param {Function} props.onViewTask - Function to call to navigate to the task
 * @returns {JSX.Element} The popup component
 */
const OverdueTaskPopup = ({ task, onClose, onViewTask }) => {
  console.log("OverdueTaskPopup rendering with task:", task);
  if (!task) {
    console.log("OverdueTaskPopup: No task data provided");
    return null;
  }

  const {
    id,
    title,
    due_date,
    priority,
    status,
    description,
    type
  } = task;

  // Format due date
  const formattedDueDate = due_date ? new Date(due_date).toLocaleString() : 'Not specified';

  // Get priority color
  const getPriorityColor = (priority) => {
    if (!priority) return 'bg-gray-500';
    
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('urgent')) return 'bg-red-600';
    if (priorityLower.includes('high')) return 'bg-orange-500';
    if (priorityLower.includes('medium')) return 'bg-yellow-500';
    if (priorityLower.includes('low')) return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{zIndex: 9999}}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-white w-8 h-8" />
            <h2 className="text-white text-xl font-bold">Overdue Task - Urgent Action Required</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-white hover:text-red-100 transition-colors"
            aria-label="Close popup"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Task content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Calendar className="text-gray-500 w-5 h-5" />
                <span className="text-red-600 font-medium">{formattedDueDate}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`}></span>
                <span className="font-medium">{priority || 'No Priority'}</span>
              </div>
              
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm font-medium">
                {status || 'No Status'}
              </div>

              {type && (
                <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
                  {type}
                </div>
              )}
            </div>
          </div>

          {description && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2 text-gray-700">Description</h4>
              <p className="text-gray-600 whitespace-pre-line">{description}</p>
            </div>
          )}

          <div className="border-t pt-6 mt-6 flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => onViewTask(id)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
            >
              View Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverdueTaskPopup;
