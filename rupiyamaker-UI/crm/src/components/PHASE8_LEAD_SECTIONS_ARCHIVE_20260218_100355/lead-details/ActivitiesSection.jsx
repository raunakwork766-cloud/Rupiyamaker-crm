import React, { useState, useEffect } from 'react';
import { Activity, Calendar, User, Filter } from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Helper function to group activities by date and time
const groupActivitiesByDateAndTime = (activities) => {
  const groupedByDate = activities.reduce((acc, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = {};
    }
    const time = new Date(activity.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    if (!acc[date][time]) {
      acc[date][time] = [];
    }
    acc[date][time].push(activity);
    return acc;
  }, {});
  return groupedByDate;
};

export default function ActivitiesSection({ leadId, userId, formatDate }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadActivities();
  }, [leadId]);

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/activities?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data || []);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      setError('Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case 'created':
        return '🎯';
      case 'updated':
        return '✏️';
      case 'status_changed':
        return '🔄';
      case 'assigned':
        return '👤';
      case 'remark_added':
        return '💬';
      case 'attachment_uploaded':
        return '📎';
      case 'task_added':
        return '✅';
      case 'task_completed':
        return '🎉';
      case 'login_form_updated':
        return '📝';
      case 'transferred':
        return '🔀';
      default:
        return '📋';
    }
  };

  const getActivityColor = (action) => {
    switch (action) {
      case 'created':
        return 'border-green-500 bg-green-900/20';
      case 'updated':
        return 'border-blue-500 bg-blue-900/20';
      case 'status_changed':
        return 'border-purple-500 bg-purple-900/20';
      case 'assigned':
        return 'border-yellow-500 bg-yellow-900/20';
      case 'transferred':
        return 'border-orange-500 bg-orange-900/20';
      default:
        return 'border-gray-500 bg-gray-900/20';
    }
  };

  const formatActivityDescription = (activity) => {
    const action = activity.action || activity.activity_type;
    switch (action) {
      case 'created':
        return 'Lead created';
      case 'updated':
        return 'Lead details updated';
      case 'field_update':
        // Simple format: Just the field display name
        return activity.details?.field_display_name || 'Field updated';
      case 'status_changed':
        return `Status: "${activity.details?.old_status || 'N/A'}" → "${activity.details?.new_status || 'N/A'}"`;
      case 'assigned':
        return `Lead assigned to ${activity.details?.assigned_to_name || 'Unknown'}`;
      case 'remark_added':
        return 'Remark added';
      case 'attachment_uploaded':
        return `Attachment "${activity.details?.filename || 'Unknown'}" uploaded`;
      case 'task_added':
        return `Task "${activity.details?.task_title || 'Unknown'}" added`;
      case 'task_completed':
        return `Task "${activity.details?.task_title || 'Unknown'}" completed`;
      case 'login_form_updated':
        return 'Login form updated';
      case 'transferred':
        return `Lead transferred to ${activity.details?.department || 'Unknown Department'}`;
      default:
        return activity.description || action;
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.action === filter;
  });

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'status_changed', label: 'Status Changes' },
    { value: 'assigned', label: 'Assignments' },
    { value: 'remark_added', label: 'Remarks' },
    { value: 'attachment_uploaded', label: 'Attachments' },
    { value: 'task_added', label: 'Tasks' },
    { value: 'transferred', label: 'Transfers' },
  ];

  const groupedActivities = groupActivitiesByDateAndTime(filteredActivities);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-black flex items-center">
          <Activity className="w-6 h-6 mr-2" />
          Activities
        </h3>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-1 text-black text-sm focus:outline-none focus:border-blue-500"
          >
            {activityTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Activities Timeline */}
      <div className="space-y-6">
        {Object.keys(groupedActivities).length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>
              {filter === 'all'
                ? 'No activities yet.'
                : `No ${activityTypes.find(t => t.value === filter)?.label.toLowerCase()} activities.`}
            </p>
          </div>
        ) : (
          Object.entries(groupedActivities)
            .sort((a, b) => new Date(b[0]) - new Date(a[0])) // Sort dates in descending order
            .map(([date, timeGroups]) => (
              <div key={date} className="space-y-4">
                <h4 className="text-lg font-medium text-black border-b border-gray-300 pb-2">
                  {date}
                </h4>
                <div className="relative">
                  {Object.entries(timeGroups)
                    .sort((a, b) => new Date(b[1][0].created_at) - new Date(a[1][0].created_at)) // Sort times in descending order
                    .map(([time, activities], timeIndex, timeArray) => (
                      <div key={time} className="relative flex items-start space-x-4 pb-4">
                        {/* Time and Timeline dot */}
                        <div className="w-24 flex-shrink-0 text-right">
                          <div className="text-sm text-gray-600">{time}</div>
                          <div className="relative flex justify-end">
                            <div
                              className={`z-10 w-6 h-6 rounded-full border-2 ${getActivityColor(activities[0].action)} flex items-center justify-center mt-2`}
                            >
                              <span className="text-sm">{getActivityIcon(activities[0].action)}</span>
                            </div>
                            {timeIndex !== timeArray.length - 1 && (
                              <div className="absolute top-8 right-2.5 w-0.5 h-full bg-gray-300"></div>
                            )}
                          </div>
                        </div>

                        {/* Activity content */}
                        <div className="flex-1 space-y-2">
                          {activities.map((activity, activityIndex) => (
                            <div key={activity._id || activityIndex}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-black">
                                  {formatActivityDescription(activity)}
                                </span>
                                <div className="text-sm text-gray-600 flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  {activity.user_name || 'System'}
                                </div>
                              </div>
                              {activity.details && Object.keys(activity.details).length > 0 && (
                                <div className="text-sm text-gray-600">
                                  {activity.details.comment && (
                                    <p className="italic">"{activity.details.comment}"</p>
                                  )}
                                  {activity.details.changes && (
                                    <div className="mt-1">
                                      <strong>Changes:</strong>
                                      <ul className="list-disc list-inside ml-2">
                                        {Object.entries(activity.details.changes).map(([field, change]) => (
                                          <li key={field}>
                                            <span className="capitalize">{field.replace('_', ' ')}</span>:
                                            <span className="text-red-600"> {change.from || 'None'}</span> →
                                            <span className="text-green-600"> {change.to || 'None'}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}