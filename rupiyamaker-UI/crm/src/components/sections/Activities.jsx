import React, { useState, useEffect } from 'react';
import { Activity, Calendar, User, Filter } from 'lucide-react';
import { buildApiUrl } from '../../config/api';

// Updated: 2025-12-10 - Improved field update display format
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

export default function Activities({ leadId, userId, formatDate }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    console.log('🔄 Activities useEffect triggered:', { leadId, userId });
    if (leadId && userId) {
      loadActivities();
    } else {
      console.warn('⚠️ Missing leadId or userId:', { leadId, userId });
    }
  }, [leadId, userId]);

  const loadActivities = async () => {
    if (!leadId || !userId) {
      console.error('❌ Cannot load activities - missing parameters:', { leadId, userId });
      setError('Missing lead ID or user ID');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const apiUrl = buildApiUrl(`leads/${leadId}/activities?user_id=${userId}`);
      console.log('🚀 Fetching activities from:', apiUrl);
      
      const token = localStorage.getItem('token');
      console.log('🔐 Token status:', token ? `Present (${token.length} chars)` : 'Missing');
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && {
            'Authorization': `Bearer ${token}`
          })
        }
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Activities loaded successfully:', data?.length || 0, 'activities');
        console.log('📊 Sample activity data:', data?.[0]);
        if (data?.[0]) {
          console.log('🔍 Activity fields:', {
            action: data[0].action,
            activity_type: data[0].activity_type,
            details: data[0].details
          });
        }
        setActivities(Array.isArray(data) ? data : []);
      } else {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, response.statusText, errorText);
        setError(`Failed to load activities: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Network error loading activities:', error);
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
      case 'field_update':
        return '✏️';
      case 'status_changed':
        return '🔄';
      case 'assigned':
        return '👤';
      case 'remark_added':
      case 'note':
        return '💬';
      case 'attachment_uploaded':
      case 'document':
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
      case 'field_update':
        return 'border-blue-500 bg-blue-900/20';
      case 'status_changed':
        return 'border-purple-500 bg-purple-900/20';
      case 'assigned':
        return 'border-yellow-500 bg-yellow-900/20';
      case 'transferred':
        return 'border-orange-500 bg-orange-900/20';
      case 'note':
      case 'remark_added':
        return 'border-cyan-500 bg-cyan-900/20';
      case 'document':
      case 'attachment_uploaded':
        return 'border-indigo-500 bg-indigo-900/20';
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
        // Return object with field name for custom rendering
        return {
          isFieldUpdate: true,
          fieldName: activity.details?.field_display_name || 'Field updated',
          oldValue: activity.details?.old_value || '',
          newValue: activity.details?.new_value || ''
        };
      case 'status_changed':
        return `Status: "${activity.details?.old_status || 'N/A'}" → "${activity.details?.new_status || 'N/A'}"`;
      case 'assigned':
        return `Lead assigned to ${activity.details?.assigned_to_name || 'Unknown'}`;
      case 'note':
      case 'remark_added':
        return 'Note added';
      case 'document':
      case 'attachment_uploaded':
        return `Document "${activity.details?.filename || activity.description || 'Unknown'}" uploaded`;
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
    const activityType = activity.action || activity.activity_type;
    return activityType === filter;
  });

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'status_changed', label: 'Status Changes' },
    { value: 'assigned', label: 'Assignments' },
    { value: 'note', label: 'Notes' },
    { value: 'document', label: 'Documents' },
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

  console.log('🎯 Rendering Activities component:', { 
    leadId, 
    userId, 
    activitiesCount: activities.length, 
    isLoading, 
    error 
  });

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg">
      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 p-2 rounded text-xs">
        <strong>Debug:</strong> LeadId: {leadId || 'MISSING'} | UserId: {userId || 'MISSING'} | 
        Activities: {activities.length} | Loading: {isLoading ? 'YES' : 'NO'} | 
        Error: {error || 'NONE'}
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-black flex items-center">
          <Activity className="w-6 h-6 mr-2" />
          Activities Timeline ({activities.length})
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
                : `No ${activityTypes.find(t => t.value === filter)?.label.toLowerCase() || filter} activities.`}
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
                    .map(([time, activities], timeIndex, timeArray) => {
                      const activityType = activities[0].action || activities[0].activity_type;
                      return (
                        <div key={time} className="relative flex items-start space-x-4 pb-4">
                          {/* Time and Timeline dot */}
                          <div className="w-24 flex-shrink-0 text-right">
                            <div className="text-sm text-gray-600">{time}</div>
                            <div className="relative flex justify-end">
                              <div
                                className={`z-10 w-6 h-6 rounded-full border-2 ${getActivityColor(activityType)} flex items-center justify-center mt-2`}
                              >
                                <span className="text-sm">{getActivityIcon(activityType)}</span>
                              </div>
                              {timeIndex !== timeArray.length - 1 && (
                                <div className="absolute top-8 right-2.5 w-0.5 h-full bg-gray-300"></div>
                              )}
                            </div>
                          </div>

                          {/* Activity content */}
                          <div className="flex-1 space-y-2">
                            {activities.map((activity, activityIndex) => {
                              const description = formatActivityDescription(activity);
                              const isFieldUpdate = description && typeof description === 'object' && description.isFieldUpdate;
                              
                              // Debug logging for first activity
                              if (activityIndex === 0) {
                                console.log('🎯 Processing activity:', {
                                  action: activity.action,
                                  activity_type: activity.activity_type,
                                  description: description,
                                  isFieldUpdate: isFieldUpdate,
                                  details: activity.details
                                });
                              }
                              
                              return (
                                <div key={activity._id || activityIndex} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                  {/* Header with field name and user */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-black">
                                      {isFieldUpdate ? description.fieldName : description}
                                    </span>
                                    <div className="text-sm text-gray-600 flex items-center">
                                      <User className="w-3 h-3 mr-1" />
                                      {activity.user_name || 'System'}
                                    </div>
                                  </div>
                                  
                                  {/* FROM and TO section for field updates */}
                                  {isFieldUpdate && (
                                    <div className="text-sm">
                                      <span className="font-medium text-blue-600">FROM:</span>
                                      <span className={`ml-2 ${description.oldValue ? 'text-red-600' : 'text-gray-400'}`}>
                                        {description.oldValue || 'Empty'}
                                      </span>
                                      <span className="mx-2">→</span>
                                      <span className="font-medium text-blue-600">TO:</span>
                                      <span className="ml-2 text-green-600">
                                        {description.newValue}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Comments for non-field-update activities */}
                                  {!isFieldUpdate && activity.details?.comment && (
                                    <div className="text-sm text-gray-600">
                                      <p className="italic">"{activity.details.comment}"</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
