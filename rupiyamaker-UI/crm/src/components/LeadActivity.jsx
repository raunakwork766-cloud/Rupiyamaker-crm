import React, { useState, useEffect } from 'react';
import { Activity, Calendar, User, Filter, Search } from 'lucide-react';

// Helper function to group activities by date and time
const groupActivitiesByDateAndTime = (activities) => {
  if (!activities || activities.length === 0) {
    return {};
  }
  
  const groupedByDate = activities.reduce((acc, activity) => {
    try {
      // Handle different date formats
      const createdAt = activity.created_at || activity.createdAt || activity.timestamp;
      
      if (!createdAt) {
        return acc;
      }
      
      const dateObj = new Date(createdAt);
      
      if (isNaN(dateObj.getTime())) {
        return acc;
      }
      
      const date = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      
      if (!acc[date]) {
        acc[date] = {};
      }
      
      const time = dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      
      if (!acc[date][time]) {
        acc[date][time] = [];
      }
      
      acc[date][time].push(activity);
    } catch (error) {
      // Silently skip invalid activities
    }
    
    return acc;
  }, {});
  
  return groupedByDate;
};

export default function Activities({ leadId, userId, leadData, formatDate }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get userId with multiple fallback options
  const getUserId = () => {
    // Priority order: passed userId, localStorage userId, localStorage user_id
    if (userId) return String(userId);
    
    const storageUserId = localStorage.getItem('userId') || 
                         localStorage.getItem('user_id');
    if (storageUserId) return String(storageUserId);
    
    // Try to parse user object from localStorage
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user._id) return String(user._id);
        if (user.id) return String(user.id);
      }
    } catch (e) {
      console.warn('Failed to parse user from localStorage:', e);
    }
    
    return null;
  };

  // Get leadId with fallback
  const getLeadId = () => {
    if (leadId) return String(leadId);
    if (leadData?._id) return String(leadData._id);
    if (leadData?.id) return String(leadData.id);
    return null;
  };

  const resolvedLeadId = getLeadId();
  const resolvedUserId = getUserId();

  useEffect(() => {
    console.log('🔍 LeadActivity mounted with props:', { 
      leadId, 
      userId, 
      resolvedLeadId, 
      resolvedUserId,
      leadData: leadData ? 'present' : 'missing'
    });

    if (!resolvedLeadId) {
      setError('Lead ID is missing');
      console.error('❌ Lead ID is missing. Props received:', { leadId, leadData });
      return;
    }

    if (!resolvedUserId) {
      setError('User ID is missing');
      console.error('❌ User ID is missing. Props received:', { userId });
      console.log('💡 Available in localStorage:', {
        userId: localStorage.getItem('userId'),
        user_id: localStorage.getItem('user_id'),
        user: localStorage.getItem('user')
      });
      return;
    }
    
    loadActivities();
  }, [resolvedLeadId, resolvedUserId]);

  const loadActivities = async () => {
    const currentLeadId = getLeadId();
    const currentUserId = getUserId();

    if (!currentLeadId) {
      setError('Lead ID is missing');
      console.error('❌ Cannot load activities: Lead ID is missing');
      return;
    }

    if (!currentUserId) {
      setError('User ID is missing');
      console.error('❌ Cannot load activities: User ID is missing');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      // Detect if this is a login lead or regular lead
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const apiUrl = isLoginLead
        ? `/api/lead-login/login-leads/${currentLeadId}/activities?user_id=${currentUserId}`
        : `/api/leads/${currentLeadId}/activities?user_id=${currentUserId}`;
      
      console.log('📡 Fetching activities from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && {
            'Authorization': `Bearer ${token}`
          })
        }
      });
      
      if (response.ok) {
        let data = await response.json();
        
        console.log('✅ Activities loaded successfully:', data?.length || 0, 'activities');
        
        // Always ensure there's a "Lead Created" activity
        if (leadData) {
          // Check if there's already a create activity
          const hasCreateActivity = data && data.some(activity => 
            activity.activity_type === 'create' || 
            activity.activity_type === 'created' ||
            activity.action === 'create' ||
            activity.action === 'created'
          );
          
          // If no create activity exists, add a synthetic one
          if (!hasCreateActivity) {
            const createdActivity = {
              _id: `synthetic_${currentLeadId}_created`,
              activity_type: 'create',
              user_name: leadData.created_by_name || leadData.createdByName || 'System',
              created_at: leadData.created_at || leadData.createdAt || leadData.lead_date || new Date().toISOString(),
              description: `Lead created by ${leadData.created_by_name || leadData.createdByName || 'System'}`,
              details: {
                customer_name: leadData.customer_name || leadData.customerName,
                mobile_number: leadData.mobile_number || leadData.mobileNumber
              }
            };
            
            // Add the create activity at the end (it will be oldest)
            data = [...(data || []), createdActivity];
          }
        }
        
        setActivities(data || []);
      } else {
        const errorMsg = `Failed to load activities (Status: ${response.status})`;
        setError(errorMsg);
        console.error('❌ API Error:', errorMsg, {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl
        });
      }
    } catch (error) {
      const errorMsg = `Failed to load activities: ${error.message}`;
      setError(errorMsg);
      console.error('❌ Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case 'create':
      case 'created':
        return '🎯';
      case 'update':
      case 'updated':
        return '✏️';
      case 'field_update':
        return '📝';
      case 'status_changed':
      case 'status_change':
        return '🔄';
      case 'sub_status_change':
        return '🔀';
      case 'assignment':
      case 'assigned':
        return '👤';
      case 'remark_added':
      case 'note':
        return '💬';
      case 'attachment_uploaded':
      case 'document':
        return '📎';
      case 'question_validation':
        return '❓';
      case 'task_added':
        return '✅';
      case 'task_updated':
        return '📋';
      case 'task_completed':
        return '🎉';
      case 'login_form_updated':
      case 'file_sent_to_login':
        return '📝';
      case 'transfer':
      case 'transferred':
        return '🔀';
      default:
        return '📋';
    }
  };

  const getActivityColor = (action) => {
    switch (action) {
      case 'create':
      case 'created':
        return 'border-green-500 bg-green-900/20';
      case 'update':
      case 'updated':
        return 'border-blue-500 bg-blue-900/20';
      case 'field_update':
        return 'border-indigo-500 bg-indigo-900/20';
      case 'status_changed':
      case 'status_change':
        return 'border-purple-500 bg-purple-900/20';
      case 'sub_status_change':
        return 'border-violet-500 bg-violet-900/20';
      case 'assignment':
      case 'assigned':
        return 'border-yellow-500 bg-yellow-900/20';
      case 'transfer':
      case 'transferred':
        return 'border-orange-500 bg-orange-900/20';
      case 'note':
      case 'remark_added':
        return 'border-cyan-500 bg-cyan-900/20';
      case 'document':
      case 'attachment_uploaded':
        return 'border-indigo-500 bg-indigo-900/20';
      case 'question_validation':
        return 'border-rose-500 bg-rose-900/20';
      case 'task_added':
      case 'task_updated':
        return 'border-emerald-500 bg-emerald-900/20';
      case 'task_completed':
        return 'border-pink-500 bg-pink-900/20';
      case 'login_form_updated':
      case 'file_sent_to_login':
        return 'border-amber-500 bg-amber-900/20';
      default:
        return 'border-gray-500 bg-gray-900/20';
    }
  };

  const formatActivityDescription = (activity) => {
    const action = activity.action || activity.activity_type;
    
    switch (action) {
      case 'create':
      case 'created':
        return `Lead created by ${activity.user_name || 'System'}`;
      case 'update':
      case 'updated':
        return `Lead details updated by ${activity.user_name || 'System'}`;
      case 'field_update':
        // Return just the field name
        return activity.details?.field_display_name || activity.details?.field_name || 'Field updated';
      case 'status_changed':
      case 'status_change':
        const fromStatus = activity.details?.from_status || activity.details?.old_status || 'N/A';
        const toStatus = activity.details?.to_status || activity.details?.new_status || 'N/A';
        return `Status changed from "${fromStatus}" to "${toStatus}" by ${activity.user_name || 'System'}`;
      case 'sub_status_change':
        const fromSubStatus = activity.details?.from_sub_status || 'N/A';
        const toSubStatus = activity.details?.to_sub_status || 'N/A';
        return `Sub-status changed from "${fromSubStatus}" to "${toSubStatus}" by ${activity.user_name || 'System'}`;
      case 'assignment':
      case 'assigned':
        if (activity.details?.from_user_name && activity.details?.to_user_name) {
          return `Lead assigned from ${activity.details.from_user_name} to ${activity.details.to_user_name}`;
        }
        return `Lead assigned to ${activity.details?.assigned_to_name || activity.details?.to_user_name || 'Unknown'} by ${activity.user_name || 'System'}`;
      case 'note':
      case 'remark_added':
        return `Note added by ${activity.user_name || 'System'}`;
      case 'document':
      case 'attachment_uploaded':
        let documentName = 'Unknown';
        if (activity.details?.filename) {
          documentName = activity.details.filename;
        } else if (activity.details?.document_name) {
          documentName = activity.details.document_name;
        } else if (activity.description && activity.description.includes('Document uploaded:')) {
          documentName = activity.description.replace('Document uploaded:', '').trim();
        } else if (activity.description) {
          documentName = activity.description;
        }
        return `Document "${documentName}" uploaded by ${activity.user_name || 'System'}`;
      case 'question_validation':
        const questionsCount = activity.details?.questions_validated || 1;
        return `${questionsCount} important question${questionsCount > 1 ? 's' : ''} validated by ${activity.user_name || 'System'}`;
      case 'task_added':
        return `Task "${activity.details?.task_title || activity.details?.title || 'Unknown'}" added by ${activity.user_name || 'System'}`;
      case 'task_completed':
        return `Task "${activity.details?.task_title || activity.details?.title || 'Unknown'}" completed by ${activity.user_name || 'System'}`;
      case 'task_updated':
        return `Task "${activity.details?.task_title || activity.details?.title || 'Unknown'}" updated by ${activity.user_name || 'System'}`;
      case 'login_form_updated':
      case 'file_sent_to_login':
        return `File sent to login by ${activity.user_name || 'System'}`;
      case 'transfer':
      case 'transferred':
        return `Lead transferred to ${activity.details?.department || activity.details?.to_department_name || 'Unknown Department'} by ${activity.user_name || 'System'}`;
      default:
        return activity.description || `${action} by ${activity.user_name || 'System'}`;
    }
  };

  const filteredActivities = activities.filter(activity => {
    // Filter by activity type
    if (filter !== 'all') {
      const activityType = activity.action || activity.activity_type;
      
      // Handle exact matches first
      if (filter !== activityType) {
        // Handle legacy and alternative mappings
        let matchesFilter = false;
        switch (filter) {
          case 'created':
            matchesFilter = activityType === 'created' || activityType === 'create';
            break;
          
          case 'updated':
            matchesFilter = activityType === 'updated' || activityType === 'update';
            break;
          
          case 'field_update':
            matchesFilter = activityType === 'field_update';
            break;
          
          case 'assigned':
            matchesFilter = activityType === 'assigned' || activityType === 'assignment';
            break;
          
          case 'transferred':
            matchesFilter = activityType === 'transferred' || activityType === 'transfer';
            break;
          
          case 'status_changed':
            matchesFilter = activityType === 'status_changed' || activityType === 'status_change' || activityType === 'sub_status_change';
            break;
          
          case 'document':
            matchesFilter = activityType === 'document' || 
                   activityType === 'attachment_uploaded' || 
                   (activity.description && activity.description.toLowerCase().includes('document uploaded'));
            break;
          
          case 'note':
            matchesFilter = activityType === 'note' || 
                   activityType === 'remark_added' ||
                   (activity.details && activity.details.note_text);
            break;
          
          case 'task_added':
            matchesFilter = activityType === 'task_added' || 
                   (activityType === 'task' && activity.description && activity.description.includes('added'));
            break;
          
          case 'task_completed':
            matchesFilter = activityType === 'task_completed' || 
                   (activityType === 'task' && activity.description && activity.description.includes('completed'));
            break;
          
          case 'task_updated':
            matchesFilter = activityType === 'task_updated' || 
                   (activityType === 'task' && activity.description && activity.description.includes('updated'));
            break;
          
          case 'file_sent_to_login':
            matchesFilter = activityType === 'file_sent_to_login' || 
                   activityType === 'login_form_updated';
            break;
          
          case 'question_validation':
            matchesFilter = activityType === 'question_validation';
            break;
          
          case 'sub_status_change':
            matchesFilter = activityType === 'sub_status_change';
            break;
          
          default:
            matchesFilter = false;
        }
        
        if (!matchesFilter) return false;
      }
    }
    
    // Filter by search query (field name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const fieldName = (activity.details?.field_display_name || activity.details?.field_name || activity.description || '').toLowerCase();
      return fieldName.includes(query);
    }
    
    return true;
  });

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'field_update', label: 'Field Changes' },
    { value: 'status_changed', label: 'Status Changes' },
    { value: 'sub_status_change', label: 'Sub-Status Changes' },
    { value: 'assigned', label: 'Assignments' },
    { value: 'note', label: 'Notes' },
    { value: 'document', label: 'Documents' },
    { value: 'question_validation', label: 'Question Validation' },
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
    <div className="space-y-4 bg-white p-4 rounded-lg overflow-x-hidden break-words">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-xl font-semibold text-black flex items-center">
          <Activity className="w-6 h-6 mr-2" />
          Activities Timeline
        </h3>
        <div className="flex items-center space-x-2 flex-wrap gap-2">
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
      
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by field name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          <div className="font-bold mb-2">⚠️ Error Loading Activities</div>
          <div className="mb-2">{error}</div>
          <div className="text-sm mt-3 bg-red-50 p-3 rounded border-l-4 border-red-600">
            <div className="font-semibold mb-1">Debug Information:</div>
            <div className="space-y-1 font-mono text-xs">
              <div>Lead ID (prop): {leadId || 'undefined'}</div>
              <div>User ID (prop): {userId || 'undefined'}</div>
              <div>Resolved Lead ID: {resolvedLeadId || 'undefined'}</div>
              <div>Resolved User ID: {resolvedUserId || 'undefined'}</div>
              <div>Lead Data: {leadData ? 'Present' : 'Missing'}</div>
              <div className="mt-2 pt-2 border-t border-red-300">
                <div>localStorage.userId: {localStorage.getItem('userId') || 'undefined'}</div>
                <div>localStorage.user_id: {localStorage.getItem('user_id') || 'undefined'}</div>
              </div>
            </div>
            <button 
              onClick={() => {
                console.log('🔍 Full Debug Info:', {
                  props: { leadId, userId, leadData },
                  resolved: { resolvedLeadId, resolvedUserId },
                  localStorage: {
                    userId: localStorage.getItem('userId'),
                    user_id: localStorage.getItem('user_id'),
                    user: localStorage.getItem('user'),
                    token: localStorage.getItem('token') ? 'present' : 'missing'
                  }
                });
                loadActivities();
              }}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              Retry Loading Activities
            </button>
          </div>
        </div>
      )}

      {/* Activities Timeline */}
      <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto overflow-x-hidden pr-2 break-words">
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
                      const action = activities[0].action || activities[0].activity_type;
                      return (
                        <div key={time} className="relative flex items-start space-x-4 pb-4">
                          {/* Time and Timeline dot */}
                          <div className="w-24 flex-shrink-0 text-right">
                            <div className="text-sm text-gray-600">{time}</div>
                            <div className="relative flex justify-end">
                              {(() => {
                                const action = activities[0].action || activities[0].activity_type;
                                return (
                                  <div
                                    className={`z-10 w-6 h-6 rounded-full border-2 ${getActivityColor(action)} flex items-center justify-center mt-2`}
                                  >
                                    <span className="text-sm">{getActivityIcon(action)}</span>
                                  </div>
                                );
                              })()}
                              {timeIndex !== timeArray.length - 1 && (
                                <div className="absolute top-8 right-2.5 w-0.5 h-full bg-gray-300"></div>
                              )}
                            </div>
                          </div>

                          {/* Activity content */}
                          <div className="flex-1 space-y-2">
                            {activities.map((activity, activityIndex) => (
                              <div key={activity._id || activityIndex} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-black">
                                    {formatActivityDescription(activity)}
                                  </span>
                                  <div className="text-sm text-gray-600 flex items-center">
                                    <User className="w-3 h-3 mr-1" />
                                    {activity.user_name || 'System'}
                                  </div>
                                </div>
                                {/* Simple FROM/TO format for field updates */}
                                {(activity.action === 'field_update' || activity.activity_type === 'field_update') && activity.details && (
                                  <div className="text-sm mt-2">
                                    {/* Check if it's check_eligibility with multiple fields */}
                                    {(activity.details.field_name === 'check_eligibility' || activity.description === 'Check Eligibility') && 
                                     (activity.details.old_value?.includes('\n') || activity.details.new_value?.includes('\n')) ? (
                                      <div className="space-y-2">
                                        {/* Split fields and display each on separate row */}
                                        {(() => {
                                          const oldFields = activity.details.old_value?.split('\n') || [];
                                          const newFields = activity.details.new_value?.split('\n') || [];
                                          const maxLength = Math.max(oldFields.length, newFields.length);
                                          
                                          return Array.from({ length: maxLength }).map((_, idx) => {
                                            const oldField = oldFields[idx] || '';
                                            const newField = newFields[idx] || '';
                                            
                                            // Extract field name from "Field Name: Value" format
                                            const getFieldLabel = (field) => field.split(':')[0]?.trim() || '';
                                            const fieldLabel = getFieldLabel(newField) || getFieldLabel(oldField);
                                            
                                            if (!oldField && !newField) return null;
                                            
                                            return (
                                              <div key={idx} className="border-l-2 border-blue-300 pl-3 py-1">
                                                <div className="font-medium text-gray-700 text-xs mb-1">{fieldLabel}</div>
                                                <div className="flex items-center flex-wrap gap-2">
                                                  <span className="font-medium text-blue-600">FROM:</span>
                                                  <span className={`${oldField ? 'text-red-600' : 'text-gray-400'}`}>
                                                    {oldField.split(':')[1]?.trim() || 'Empty'}
                                                  </span>
                                                  <span>→</span>
                                                  <span className="font-medium text-blue-600">TO:</span>
                                                  <span className="text-green-600">
                                                    {newField.split(':')[1]?.trim() || 'Empty'}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    ) : (
                                      /* Single line format for other field updates */
                                      <div>
                                        <span className="font-medium text-blue-600">FROM:</span>
                                        <span className={`ml-2 ${activity.details.old_value ? 'text-red-600' : 'text-gray-400'}`}>
                                          {activity.details.old_value || 'Empty'}
                                        </span>
                                        <span className="mx-2">→</span>
                                        <span className="font-medium text-blue-600">TO:</span>
                                        <span className="ml-2 text-green-600">
                                          {activity.details.new_value}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Original details for non-field-update activities */}
                                {!(activity.action === 'field_update' || activity.activity_type === 'field_update') && activity.details && Object.keys(activity.details).length > 0 && (
                                  <div className="text-sm text-gray-600 mt-2">
                                    {/* Show comments/notes */}
                                    {activity.details.comment && (
                                      <p className="italic">"{activity.details.comment}"</p>
                                    )}
                                    {activity.details.note_text && (
                                      <p className="italic">"{activity.details.note_text}"</p>
                                    )}
                                    
                                    {/* For document uploads */}
                                    {(activity.action === 'document' || activity.activity_type === 'document' || 
                                     activity.action === 'attachment_uploaded' || activity.activity_type === 'attachment_uploaded') && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {/* Extract filename from description if available */}
                                          {activity.description && activity.description.includes('Document uploaded:') && (
                                            <li className="py-1">
                                              <span className="font-medium">File:</span> {activity.description.replace('Document uploaded:', '').trim()}
                                            </li>
                                          )}
                                          {activity.details.filename && (
                                            <li className="py-1">
                                              <span className="font-medium">File:</span> {activity.details.filename}
                                            </li>
                                          )}
                                          {activity.details.document_name && (
                                            <li className="py-1">
                                              <span className="font-medium">Document:</span> {activity.details.document_name}
                                            </li>
                                          )}
                                          {activity.details.document_id && (
                                            <li className="py-1">
                                              <span className="font-medium">Document ID:</span> {activity.details.document_id}
                                            </li>
                                          )}
                                          {activity.details.document_type && (
                                            <li className="py-1">
                                              <span className="font-medium">Type:</span> {activity.details.document_type}
                                            </li>
                                          )}
                                          {activity.details.category && (
                                            <li className="py-1">
                                              <span className="font-medium">Category:</span> {activity.details.category}
                                            </li>
                                          )}
                                          {activity.details.file_size && (
                                            <li className="py-1">
                                              <span className="font-medium">Size:</span> {activity.details.file_size}
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* For task-related activities */}
                                    {(activity.action === 'task_added' || activity.activity_type === 'task_added' ||
                                      activity.action === 'task_updated' || activity.activity_type === 'task_updated' ||
                                      activity.action === 'task_completed' || activity.activity_type === 'task_completed') && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {activity.details.task_title && (
                                            <li className="py-1">
                                              <span className="font-medium">Task:</span> {activity.details.task_title}
                                            </li>
                                          )}
                                          {activity.details.title && (
                                            <li className="py-1">
                                              <span className="font-medium">Task:</span> {activity.details.title}
                                            </li>
                                          )}
                                          {activity.details.description && (
                                            <li className="py-1">
                                              <span className="font-medium">Description:</span> {activity.details.description}
                                            </li>
                                          )}
                                          {activity.details.due_date && (
                                            <li className="py-1">
                                              <span className="font-medium">Due Date:</span> {new Date(activity.details.due_date).toLocaleDateString()}
                                            </li>
                                          )}
                                          {activity.details.priority && (
                                            <li className="py-1">
                                              <span className="font-medium">Priority:</span> {activity.details.priority}
                                            </li>
                                          )}
                                          {activity.details.status && (
                                            <li className="py-1">
                                              <span className="font-medium">Status:</span> {activity.details.status}
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* For assignments */}
                                    {(activity.action === 'assigned' || activity.activity_type === 'assigned' || 
                                     activity.action === 'assignment' || activity.activity_type === 'assignment') && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {activity.details.assigned_to_name && (
                                            <li className="py-1">
                                              <span className="font-medium">Assigned To:</span> {activity.details.assigned_to_name}
                                            </li>
                                          )}
                                          {activity.details.from_user_name && activity.details.to_user_name && (
                                            <li className="py-1">
                                              <span className="font-medium">Reassigned:</span> From {activity.details.from_user_name} to {activity.details.to_user_name}
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* For transfers */}
                                    {(activity.action === 'transferred' || activity.activity_type === 'transferred' ||
                                     activity.action === 'transfer' || activity.activity_type === 'transfer') && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {activity.details.to_department_name && (
                                            <li className="py-1">
                                              <span className="font-medium">Department:</span> {activity.details.to_department_name}
                                            </li>
                                          )}
                                          {activity.details.from_department_name && activity.details.to_department_name && (
                                            <li className="py-1">
                                              <span className="font-medium">Transferred:</span> From {activity.details.from_department_name} to {activity.details.to_department_name}
                                            </li>
                                          )}
                                          {activity.details.reason && (
                                            <li className="py-1">
                                              <span className="font-medium">Reason:</span> {activity.details.reason}
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* For login forms */}
                                    {(activity.action === 'login_form_updated' || activity.activity_type === 'login_form_updated' ||
                                     activity.action === 'file_sent_to_login' || activity.activity_type === 'file_sent_to_login') && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {activity.details.form_type && (
                                            <li className="py-1">
                                              <span className="font-medium">Form Type:</span> {activity.details.form_type}
                                            </li>
                                          )}
                                          {activity.details.login_status && (
                                            <li className="py-1">
                                              <span className="font-medium">Status:</span> {activity.details.login_status}
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* For status changes and sub-status changes */}
                                    {(activity.action === 'status_changed' || activity.activity_type === 'status_change' ||
                                     activity.activity_type === 'sub_status_change') && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {activity.activity_type === 'status_change' && (
                                            <li className="py-1">
                                              <span className="font-medium">Status:</span> 
                                              <span className="text-red-600 mx-1">{activity.details?.from_status || 'N/A'}</span>
                                              <span className="mx-1">→</span>
                                              <span className="text-green-600">{activity.details?.to_status || 'N/A'}</span>
                                            </li>
                                          )}
                                          {activity.activity_type === 'sub_status_change' && (
                                            <li className="py-1">
                                              <span className="font-medium">Sub-Status:</span> 
                                              <span className="text-red-600 mx-1">{activity.details?.from_sub_status || 'N/A'}</span>
                                              <span className="mx-1">→</span>
                                              <span className="text-green-600">{activity.details?.to_sub_status || 'N/A'}</span>
                                            </li>
                                          )}
                                          {activity.details?.reason && (
                                            <li className="py-1">
                                              <span className="font-medium">Reason:</span> {activity.details.reason}
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* For question validation */}
                                    {activity.activity_type === 'question_validation' && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {activity.details?.questions_validated && (
                                            <li className="py-1">
                                              <span className="font-medium">Questions Validated:</span> {activity.details.questions_validated}
                                            </li>
                                          )}
                                          {activity.details?.auto_validated && (
                                            <li className="py-1">
                                              <span className="font-medium">Auto Validated:</span> {activity.details.auto_validated ? 'Yes' : 'No'}
                                            </li>
                                          )}
                                          {activity.details?.question_ids && Array.isArray(activity.details.question_ids) && (
                                            <li className="py-1">
                                              <span className="font-medium">Question IDs:</span> {activity.details.question_ids.length} question(s)
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* Generic details section for other activity types */}
                                    {!['document', 'attachment_uploaded', 'task_added', 'task_updated', 'task_completed', 
                                       'assigned', 'assignment', 'transferred', 'transfer', 'login_form_updated',
                                       'file_sent_to_login', 'status_changed', 'status_change', 'sub_status_change',
                                       'question_validation', 'updated', 'update', 'note', 'remark_added'].includes(activity.action || activity.activity_type) &&
                                     activity.details && Object.keys(activity.details).length > 0 && 
                                     !activity.details.changes && !activity.details.comment && !activity.details.note_text && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {Object.entries(activity.details).map(([key, value], idx) => {
                                            if (value === null || value === undefined || 
                                                (typeof value === 'object' && Object.keys(value).length === 0)) {
                                              return null;
                                            }
                                            
                                            // Skip ID fields to avoid showing object IDs
                                            if (key.toLowerCase().includes('_id') || key.toLowerCase().includes('id') || 
                                                key === 'assigned_to' || key === 'department' || key === 'note_id') {
                                              return null;
                                            }
                                            
                                            const formattedKey = key
                                              .replace(/_/g, ' ')
                                              .replace(/([A-Z])/g, ' $1')
                                              .replace(/\s+/g, ' ')
                                              .trim();
                                            
                                            let formattedValue = value;
                                            if (typeof value === 'object' && !Array.isArray(value)) {
                                              formattedValue = JSON.stringify(value).replace(/[{}"]/g, '').replace(/,/g, ', ');
                                            } else if (Array.isArray(value)) {
                                              formattedValue = value.join(', ');
                                            }
                                            
                                            return (
                                              <li key={idx} className="py-1">
                                                <span className="capitalize font-medium">{formattedKey}</span>:&nbsp;
                                                <span>{String(formattedValue)}</span>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}

                                    {/* For updates with changes */}
                                    {(activity.action === 'updated' || activity.activity_type === 'update') && 
                                     activity.details.changes && Object.keys(activity.details.changes).length > 0 && (
                                      <div className="mt-2 bg-gray-100 p-2 rounded-md">
                                        <strong className="block mb-1 text-gray-700">Changes:</strong>
                                        <ul className="list-disc list-inside ml-1 space-y-1">
                                          {(() => {
                                            // Process nested changes
                                            const processedChanges = [];
                                            
                                            // Helper to recursively process nested changes 
                                            const processChanges = (changes, path = []) => {
                                              if (!changes || typeof changes !== 'object') return;
                                              
                                              Object.entries(changes).forEach(([field, value]) => {
                                                const currentPath = [...path, field];
                                                
                                                // If from/to structure detected
                                                if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
                                                  const fromVal = value.from;
                                                  const toVal = value.to;
                                                  
                                                  // Skip if values are identical
                                                  if (JSON.stringify(fromVal) === JSON.stringify(toVal)) {
                                                    return;
                                                  }
                                                  
                                                  // Format values for display - improved to ensure cleaner display
                                                  const formatValue = (val) => {
                                                    if (val === null || val === undefined) return 'None';
                                                    if (Array.isArray(val)) {
                                                      if (val.length === 0) return 'None';
                                                      // For simple arrays of primitive values
                                                      if (val.every(item => typeof item !== 'object' || item === null)) {
                                                        return val.join(', ');
                                                      }
                                                      return `${val.length} items`;
                                                    }
                                                    if (typeof val === 'object') {
                                                      if (Object.keys(val).length === 0) return 'None';
                                                      // Just show the value directly, not as an object representation
                                                      return JSON.stringify(val).replace(/[{}"]/g, '').replace(/,/g, ', ');
                                                    }
                                                    return String(val);
                                                  };
                                                  
                                                  const fromFormatted = formatValue(fromVal);
                                                  const toFormatted = formatValue(toVal);
                                                  
                                                  // Only add if values actually changed when formatted
                                                  if (fromFormatted !== toFormatted) {
                                                    // Format the field name - use just the last part of the path
                                                    const fieldName = currentPath[currentPath.length - 1]
                                                      .replace(/_/g, ' ')
                                                      .replace(/([A-Z])/g, ' $1') 
                                                      .replace(/\s+/g, ' ')
                                                      .trim();
                                                    
                                                    // Fields related to status or eligibility should show from → to
                                                    const isStatusField = 
                                                      fieldName.toLowerCase().includes('status') || 
                                                      fieldName.toLowerCase().includes('eligibility');
                                                    
                                                    processedChanges.push({
                                                      field: fieldName,
                                                      from: fromFormatted,
                                                      to: toFormatted,
                                                      isStatusField,
                                                      fullPath: currentPath.join('.')
                                                    });
                                                  }
                                                }
                                                // Handle nested objects (but not arrays)
                                                else if (value && typeof value === 'object' && !Array.isArray(value)) {
                                                  processChanges(value, currentPath);
                                                }
                                              });
                                            };
                                            
                                            // Start processing from root
                                            processChanges(activity.details.changes);
                                            
                                            // Sort changes logically
                                            const sortedChanges = [...processedChanges].sort((a, b) => {
                                              // First by top-level object
                                              const aTopLevel = a.fullPath.split('.')[0];
                                              const bTopLevel = b.fullPath.split('.')[0];
                                              
                                              if (aTopLevel !== bTopLevel) {
                                                return aTopLevel.localeCompare(bTopLevel);
                                              }
                                              
                                              // Status fields first within their section
                                              if (a.isStatusField && !b.isStatusField) return -1;
                                              if (!a.isStatusField && b.isStatusField) return 1;
                                              
                                              // Then alphabetically by field name
                                              return a.field.localeCompare(b.field);
                                            });
                                            
                                            // If no changes were processed, don't show anything
                                            if (sortedChanges.length === 0) {
                                              return null;
                                            }
                                            
                                            // Return the mapped JSX elements
                                            return sortedChanges.map((change, idx) => (
                                              <li key={idx} className="py-1">
                                                <span className="capitalize font-medium">{change.field}</span>:&nbsp;
                                                {change.isStatusField ? (
                                                  <>
                                                    <span className="text-red-600">{change.from}</span>
                                                    <span className="mx-1">→</span>
                                                    <span className="text-green-600">{change.to}</span>
                                                  </>
                                                ) : (
                                                  <span className="text-green-600">{change.to}</span>
                                                )}
                                              </li>
                                            ));
                                          })()}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
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
