import React from 'react';
import { X, Calendar, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * DailyTasksSummary - A component to show today's tasks summary
 * 
 * @param {Object} props
 * @param {Object} props.summaryData - The daily summary data with tasks
 * @param {Function} props.onClose - Function to call when closing the summary
 * @param {Function} props.onViewTask - Function to call to navigate to a task
 * @param {Function} props.onViewAllTasks - Function to call to view all of today's tasks
 * @returns {JSX.Element} The summary component
 */
const DailyTasksSummary = ({ summaryData, onClose, onViewTask, onViewAllTasks }) => {
  if (!summaryData?.details?.tasks?.length) return null;

  const { date, task_count, high_priority_count, tasks } = summaryData.details;

  // Format date
  const formattedDate = date ? new Date(date).toLocaleDateString() : 'Today';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-white w-6 h-6" />
            <h2 className="text-white text-xl font-bold">Today's Tasks - {formattedDate}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-white hover:text-blue-100 transition-colors"
            aria-label="Close summary"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Summary content */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
                {task_count} {task_count === 1 ? 'Task' : 'Tasks'} Today
              </div>
              
              {high_priority_count > 0 && (
                <div className="px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {high_priority_count} High Priority
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">Task List:</h3>
            
            <div className="divide-y">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className="py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onViewTask(task.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-start">
                      <div className={`w-3 h-3 rounded-full mt-1.5 ${getPriorityColor(task.priority)}`} />
                      <div>
                        <h4 className="font-medium text-gray-800">{task.title}</h4>
                        <p className="text-sm text-gray-500">
                          {task.status} • Due: {task.due_date ? new Date(task.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-6 mt-6 flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={onViewAllTasks}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
            >
              View All Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyTasksSummary;
