import React, { useState, useEffect } from 'react';
import { Activity, Calendar, User, Filter, Clock, Edit, FileText, ChevronRight, CheckCircle } from 'lucide-react';
import hrmsService from '../../services/hrmsService';
import { formatDateTime, getRelativeTime } from '../../utils/dateUtils';

// Helper function to group activities by date and time
const groupActivitiesByDateAndTime = (activities) => {
  const groupedByDate = activities.reduce((acc, activity) => {
    const date = new Date(activity.timestamp || activity.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = {};
    }
    const time = new Date(activity.timestamp || activity.created_at).toLocaleTimeString('en-IN', {
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

// Enhanced activity description function with detailed change information
const formatActivityDescription = (activity) => {
    const action = activity.action || activity.activity_type;
    const details = activity.details || {};
    
    // Get the actual user name with multiple fallbacks
    const getUserName = () => {
        if (activity.performed_by_name && activity.performed_by_name !== 'System' && activity.performed_by_name !== 'Unknown User') {
            return activity.performed_by_name;
        }
        if (activity.user_name && activity.user_name !== 'System') {
            return activity.user_name;
        }
        if (activity.created_by_name) {
            return activity.created_by_name;
        }
        if (activity.updated_by_name) {
            return activity.updated_by_name;
        }
        // Try to get from details
        if (details.performed_by_name) {
            return details.performed_by_name;
        }
        if (details.user_name) {
            return details.user_name;
        }
        // Last resort - get current user from localStorage
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.first_name || userData.last_name) {
                return `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
            }
            if (userData.name) {
                return userData.name;
            }
        } catch (e) {
            console.warn('Could not get user data from localStorage');
        }
        return 'Unknown User';
    };
    
    const performer = getUserName();
    
    switch (action) {
        case 'profile_updated':
        case 'update':
        case 'updated':
            // Show specific fields that were changed
            if (details.field_changes && Object.keys(details.field_changes).length > 0) {
                const changedFields = Object.keys(details.field_changes);
                const fieldLabels = {
                    'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                    'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                    'department_id': 'Department', 'department': 'Department', 'designation': 'Designation',
                    'role': 'Role', 'role_id': 'Role', 'gender': 'Gender', 'status': 'Status',
                    'marital_status': 'Marital Status', 'date_of_birth': 'Date of Birth',
                    'date_of_joining': 'Date of Joining', 'employee_id': 'Employee ID',
                    'emergency_contact_name': 'Emergency Contact', 'emergency_contact_phone': 'Emergency Phone',
                    'qualification': 'Qualification', 'experience': 'Experience',
                    'reporting_manager': 'Reporting Manager', 'security_fields': 'Password/Security Fields'
                };
                const fieldNames = changedFields.map(field => 
                    fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                ).join(', ');
                return `${performer} updated ${fieldNames}`;
            }
            if (details.updated_fields && Array.isArray(details.updated_fields)) {
                const fieldLabels = {
                    'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                    'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                    'department_id': 'Department', 'designation': 'Designation',
                    'emergency_contact_name': 'Emergency Contact', 'emergency_contact_phone': 'Emergency Phone'
                };
                const fieldNames = details.updated_fields.map(field => 
                    fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                ).join(', ');
                return `${performer} updated ${details.updated_fields.length} field${details.updated_fields.length > 1 ? 's' : ''}: ${fieldNames}`;
            }
            // Check for changes array
            if (details.changes && Array.isArray(details.changes)) {
                return `${performer} applied ${details.changes.length} change${details.changes.length > 1 ? 's' : ''}: ${details.changes.join(', ')}`;
            }
            // Check for raw_changes
            if (details.raw_changes && typeof details.raw_changes === 'object') {
                const changedFields = Object.keys(details.raw_changes).filter(key => 
                    !['updated_at', 'password', 'hashed_password', '_id', 'createdAt', 'updatedAt'].includes(key)
                );
                if (changedFields.length > 0) {
                    const fieldLabels = {
                        'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                        'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                        'department_id': 'Department', 'designation': 'Designation'
                    };
                    const fieldNames = changedFields.map(field => 
                        fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                    ).join(', ');
                    return `${performer} modified ${changedFields.length} field${changedFields.length > 1 ? 's' : ''}: ${fieldNames}`;
                }
            }
            return `${performer} updated employee profile`;
        
        case 'status_changed':
        case 'status_change':
            const fromStatus = details.status_change?.from || details.old_status || 'N/A';
            const toStatus = details.status_change?.to || details.new_status || 'N/A';
            return `${performer} changed status: "${fromStatus}" → "${toStatus}"`;
        
        case 'employee_created':
        case 'created':
        case 'create':
            return `${performer} created employee record`;
        
        case 'employee_creation_date':
            return `${performer} recorded employee creation date`;
        
        case 'remark_added':
        case 'note':
            return `${performer} added a note`;
        
        case 'attachment_uploaded':
        case 'document':
            let documentName = 'document';
            if (details.file_info?.file_name) {
                documentName = details.file_info.file_name;
            } else if (details.document_name) {
                documentName = details.document_name;
            } else if (activity.description && activity.description !== 'No description available') {
                documentName = activity.description.replace('Document uploaded:', '').trim() || 'document';
            }
            return `${performer} uploaded: "${documentName}"`;
        
        case 'attachment_deleted':
            return `${performer} deleted a document`;
        
        case 'password_changed':
            return `${performer} changed password`;
        
        case 'login_status_changed':
            return `${performer} modified login access`;
        
        case 'photo_uploaded':
            return `${performer} updated profile photo`;
        
        case 'assignment':
        case 'assigned':
            return `${performer} assigned employee`;
        
        case 'transfer':
        case 'transferred':
            return `${performer} transferred employee`;
        
        default:
            if (activity.description && activity.description !== 'No description available') {
                return `${performer}: ${activity.description}`;
            }
            return `${performer} performed ${(action || 'action').replace(/_/g, ' ')}`;
    }
};

const EmployeeActivity = ({ employeeId, employeeData, refreshTrigger }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all, profile, status, remarks, attachments
    const [localEmployeeData, setLocalEmployeeData] = useState(null);

    // Helper function to get proper user name
    const getUserName = (activity) => {
        if (activity.performed_by_name && activity.performed_by_name !== 'System' && activity.performed_by_name !== 'Unknown User') {
            return activity.performed_by_name;
        }
        if (activity.user_name && activity.user_name !== 'System') {
            return activity.user_name;
        }
        if (activity.created_by_name) {
            return activity.created_by_name;
        }
        if (activity.updated_by_name) {
            return activity.updated_by_name;
        }
        // Try to get from details
        if (activity.details?.performed_by_name) {
            return activity.details.performed_by_name;
        }
        if (activity.details?.user_name) {
            return activity.details.user_name;
        }
        // Get current user from localStorage as fallback
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.first_name || userData.last_name) {
                return `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
            }
            if (userData.name) {
                return userData.name;
            }
        } catch (e) {
            console.warn('Could not get user data from localStorage');
        }
        return 'Unknown User';
    };

    // Helper function to get proper user name
    const getProperUserName = (activity) => {
        if (activity.performed_by_name && activity.performed_by_name !== 'System' && activity.performed_by_name !== 'Unknown User') {
            return activity.performed_by_name;
        }
        if (activity.user_name && activity.user_name !== 'System') {
            return activity.user_name;
        }
        if (activity.created_by_name) {
            return activity.created_by_name;
        }
        if (activity.updated_by_name) {
            return activity.updated_by_name;
        }
        // Try to get from details
        if (activity.details?.performed_by_name) {
            return activity.details.performed_by_name;
        }
        if (activity.details?.user_name) {
            return activity.details.user_name;
        }
        // Get current user from localStorage as fallback
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.first_name || userData.last_name) {
                return `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
            }
            if (userData.name) {
                return userData.name;
            }
        } catch (e) {
            console.warn('Could not get user data from localStorage');
        }
        return 'Unknown User';
    };

    useEffect(() => {
        if (employeeId) {
            fetchEmployeeDataAndActivities();
        }
    }, [employeeId, refreshTrigger]);

    // Update local employee data when prop changes
    useEffect(() => {
        if (employeeData) {
            setLocalEmployeeData(employeeData);
        }
    }, [employeeData]);

    const fetchEmployeeDataAndActivities = async () => {
        try {
            setLoading(true);
            
            // Fetch employee data and activities in parallel
            const [employeeResponse, activitiesResponse] = await Promise.all([
                hrmsService.getEmployee(employeeId),
                hrmsService.getEmployeeActivities(employeeId)
            ]);
            
            // Set employee data - prefer prop data if available, otherwise use fetched data
            if (employeeData) {
                setLocalEmployeeData(employeeData);
            } else if (employeeResponse && employeeResponse.success && employeeResponse.data) {
                setLocalEmployeeData(employeeResponse.data);
            }
            
            // Process activities
            if (activitiesResponse.success && activitiesResponse.data && Array.isArray(activitiesResponse.data)) {
                // Ensure we have valid activity data with proper default values
                const activitiesData = activitiesResponse.data.map(activity => ({
                    _id: activity._id || `temp-${Date.now()}-${Math.random()}`,
                    action: activity.action || activity.activity_type || 'unknown_action',
                    description: activity.description || 'No description available',
                    performed_by: activity.performed_by || activity.created_by || 'unknown',
                    performed_by_name: activity.performed_by_name || 'Unknown User',
                    timestamp: activity.timestamp || activity.created_at || new Date().toISOString(),
                    details: activity.details || null,
                    activity_type: activity.activity_type || activity.action || 'unknown'
                }));
                
                // Add employee creation date as a special activity if employee data exists
                if (employeeResponse && employeeResponse.data && (employeeResponse.data.created_at || employeeResponse.data.date_created)) {
                    const createdDate = employeeResponse.data.created_at || employeeResponse.data.date_created;
                    const creationActivity = {
                        _id: `creation-${employeeId}`,
                        action: 'employee_creation_date',
                        activity_type: 'employee_creation_date',
                        description: 'Employee Created Date',
                        performed_by: 'system',
                        performed_by_name: 'System',
                        timestamp: createdDate,
                        details: {
                            creation_info: {
                                employee_name: `${employeeResponse.data.first_name || ''} ${employeeResponse.data.last_name || ''}`.trim(),
                                employee_id: employeeResponse.data.employee_id || employeeResponse.data._id,
                                creation_date: createdDate
                            }
                        }
                    };
                    activitiesData.push(creationActivity);
                }
                
                // Sort activities by timestamp (newest first)
                activitiesData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                setActivities(activitiesData);
            } else {
                // Create just the creation date activity if we have employee data but no activities
                if (employeeResponse && employeeResponse.data && (employeeResponse.data.created_at || employeeResponse.data.date_created)) {
                    const createdDate = employeeResponse.data.created_at || employeeResponse.data.date_created;
                    const creationActivity = {
                        _id: `creation-${employeeId}`,
                        action: 'employee_creation_date',
                        activity_type: 'employee_creation_date',
                        description: 'Employee Created Date',
                        performed_by: 'system',
                        performed_by_name: 'System',
                        timestamp: createdDate,
                        details: {
                            creation_info: {
                                employee_name: `${employeeResponse.data.first_name || ''} ${employeeResponse.data.last_name || ''}`.trim(),
                                employee_id: employeeResponse.data.employee_id || employeeResponse.data._id,
                                creation_date: createdDate
                            }
                        }
                    };
                    setActivities([creationActivity]);
                } else {
                    setActivities(generateSampleActivities());
                }
            }
        } catch (error) {
            console.error('Error fetching employee data and activities:', error);
            setActivities(generateSampleActivities());
        } finally {
            setLoading(false);
        }
    };

    const fetchActivities = async () => {
        try {
            setLoading(true);
            const response = await hrmsService.getEmployeeActivities(employeeId);
            
            // Check if API call was successful and has data
            if (response.success && response.data && Array.isArray(response.data)) {
                // Ensure we have valid activity data with proper default values
                const activitiesData = response.data.map(activity => ({
                    _id: activity._id || `temp-${Date.now()}-${Math.random()}`,
                    action: activity.action || activity.activity_type || 'unknown_action',
                    description: activity.description || 'No description available',
                    performed_by: activity.performed_by || activity.created_by || 'unknown',
                    performed_by_name: activity.performed_by_name || 'Unknown User',
                    timestamp: activity.timestamp || activity.created_at || new Date().toISOString(),
                    details: activity.details || null,
                    activity_type: activity.activity_type || activity.action || 'unknown'
                }));
                setActivities(activitiesData);
            } else {
                // Only use sample activities if there's actually no data from API
                if (response.success && Array.isArray(response.data) && response.data.length === 0) {
                    setActivities([]);
                } else {
                    setActivities(generateSampleActivities());
                }
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
            setActivities(generateSampleActivities());
        } finally {
            setLoading(false);
        }
    };

    const generateSampleActivities = () => {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'System';
        
        return [
            {
                _id: '1',
                action: 'profile_updated',
                activity_type: 'profile_updated',
                description: 'Updated contact information',
                performed_by: userData._id || userData.id,
                performed_by_name: userName,
                timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                details: {
                    field_changes: {
                        phone: {
                            label: 'Phone Number',
                            from: '+91-9876543210',
                            to: '+91-9876543211'
                        },
                        emergency_contact_phone: {
                            label: 'Emergency Contact Phone',
                            from: '+91-9876543212',
                            to: '+91-9876543213'
                        }
                    },
                    total_fields_changed: 2
                }
            },
            {
                _id: '2',
                action: 'status_changed',
                activity_type: 'status_changed',
                description: 'Status changed from Inactive to Active',
                performed_by: userData._id || userData.id,
                performed_by_name: userName,
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                details: {
                    status_change: {
                        from: 'Inactive',
                        to: 'Active',
                        remark: 'Employee completed onboarding process'
                    }
                }
            },
            {
                _id: '3',
                action: 'employee_created',
                activity_type: 'employee_created',
                description: 'Employee record created',
                performed_by: userData._id || userData.id,
                performed_by_name: userName,
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                details: {
                    employee_info: {
                        name: 'John Doe',
                        employee_id: 'EMP001',
                        email: 'john.doe@company.com',
                        department: 'Engineering',
                        designation: 'Software Developer'
                    },
                    created_fields: ['first_name', 'last_name', 'email', 'phone', 'department_id', 'designation']
                }
            },
            {
                _id: '4',
                action: 'attachment_uploaded',
                activity_type: 'attachment_uploaded',
                description: 'Uploaded resume.pdf',
                performed_by: userData._id || userData.id,
                performed_by_name: userName,
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
                details: {
                    file_info: {
                        file_name: 'resume.pdf',
                        file_type: 'application/pdf',
                        attachment_type: 'Resume',
                        file_size: '2.5 MB'
                    }
                }
            },
            {
                _id: '5',
                action: 'password_changed',
                activity_type: 'password_changed',
                description: 'Password changed',
                performed_by: userData._id || userData.id,
                performed_by_name: userName,
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
                details: {
                    security_action: 'password_update'
                }
            }
        ];
    };

    const getActivityIcon = (action) => {
        const activityType = action || '';
        switch (activityType) {
            case 'profile_updated':
            case 'update':
            case 'updated':
                return '✏️';
            case 'status_changed':
            case 'status_change':
                return '🔄';
            case 'remark_added':
            case 'note':
                return '💬';
            case 'attachment_uploaded':
            case 'document':
                return '📎';
            case 'attachment_deleted':
                return '🗑️';
            case 'employee_created':
            case 'created':
            case 'create':
                return '🎯';
            case 'employee_creation_date':
                return '📅';
            case 'password_changed':
                return '🔐';
            case 'login_status_changed':
                return '🔑';
            case 'photo_uploaded':
                return '📷';
            case 'assignment':
            case 'assigned':
                return '👤';
            case 'transfer':
            case 'transferred':
                return '🔀';
            default:
                return '📋';
        }
    };

    const getActivityColor = (action) => {
        const activityType = action || '';
        switch (activityType) {
            case 'profile_updated':
            case 'update':
            case 'updated':
                return 'border-blue-500 bg-blue-900/20';
            case 'status_changed':
            case 'status_change':
                return 'border-purple-500 bg-purple-900/20';
            case 'remark_added':
            case 'note':
                return 'border-cyan-500 bg-cyan-900/20';
            case 'attachment_uploaded':
            case 'document':
                return 'border-indigo-500 bg-indigo-900/20';
            case 'attachment_deleted':
                return 'border-red-500 bg-red-900/20';
            case 'employee_created':
            case 'created':
            case 'create':
                return 'border-green-500 bg-green-900/20';
            case 'employee_creation_date':
                return 'border-emerald-500 bg-emerald-900/20';
            case 'password_changed':
                return 'border-red-500 bg-red-900/20';
            case 'login_status_changed':
                return 'border-amber-500 bg-amber-900/20';
            case 'photo_uploaded':
                return 'border-cyan-500 bg-cyan-900/20';
            case 'assignment':
            case 'assigned':
                return 'border-yellow-500 bg-yellow-900/20';
            case 'transfer':
            case 'transferred':
                return 'border-orange-500 bg-orange-900/20';
            default:
                return 'border-gray-500 bg-gray-900/20';
        }
    };

    const formatTimeAgo = (timestamp) => {
        try {
            if (!timestamp) return 'Unknown time';
            return getRelativeTime(timestamp);
        } catch (error) {
            console.error('Error formatting time:', error);
            return 'Unknown time';
        }
    };

    const filteredActivities = (activities || []).filter(activity => {
        if (filter === 'all') return true;
        
        const activityType = activity.action || activity.activity_type;
        
        // Handle exact matches first
        if (filter === activityType) return true;
        
        // Handle category-based filtering
        switch (filter) {
            case 'profile':
                return activityType === 'profile_updated' || activityType === 'updated' || activityType === 'update';
            case 'status':
                return activityType === 'status_changed' || activityType === 'status_change';
            case 'created':
                return activityType === 'employee_created' || activityType === 'created' || activityType === 'create' || activityType === 'employee_creation_date';
            case 'attachment':
                return activityType === 'attachment_uploaded' || activityType === 'attachment_deleted' || activityType === 'document';
            case 'remark':
                return activityType === 'remark_added' || activityType === 'note';
            case 'security':
                return activityType === 'password_changed' || activityType === 'login_status_changed' || activityType === 'photo_uploaded';
            default:
                return false;
        }
    });

    const activityTypes = [
        { value: 'all', label: 'All Activities' },
        { value: 'profile', label: 'Profile Updates' },
        { value: 'status', label: 'Status Changes' },
        { value: 'created', label: 'Creation Events' },
        { value: 'remark', label: 'Notes & Remarks' },
        { value: 'attachment', label: 'Documents' },
        { value: 'security', label: 'Security Changes' }
    ];

    const groupedActivities = groupActivitiesByDateAndTime(filteredActivities);

    if (loading) {
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
                    Employee Activities Timeline
                </h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={fetchEmployeeDataAndActivities}
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                        🔄 Refresh
                    </button>
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
                                        .sort((a, b) => new Date(b[1][0].timestamp || b[1][0].created_at) - new Date(a[1][0].timestamp || a[1][0].created_at)) // Sort times in descending order
                                        .map(([time, timeActivities], timeIndex, timeArray) => {
                                            const action = timeActivities[0].action || timeActivities[0].activity_type;
                                            return (
                                                <div key={time} className="relative flex items-start space-x-4 pb-4">
                                                    {/* Time and Timeline dot */}
                                                    <div className="w-24 flex-shrink-0 text-right">
                                                        <div className="text-sm text-gray-600">{time}</div>
                                                        <div className="relative flex justify-end">
                                                            <div
                                                                className={`z-10 w-6 h-6 rounded-full border-2 ${getActivityColor(action)} flex items-center justify-center mt-2`}
                                                            >
                                                                <span className="text-sm">{getActivityIcon(action)}</span>
                                                            </div>
                                                            {timeIndex !== timeArray.length - 1 && (
                                                                <div className="absolute top-8 right-2.5 w-0.5 h-full bg-gray-300"></div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Activity content */}
                                                    <div className="flex-1 space-y-2">
                                                        {timeActivities.map((activity, activityIndex) => (
                                                            <div key={activity._id || activityIndex} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-sm font-medium text-black">
                                                                        {formatActivityDescription(activity)}
                                                                    </span>
                                                                    <div className="text-sm text-gray-600 flex items-center">
                                                                        <User className="w-3 h-3 mr-1" />
                                                                        {activity.performed_by_name || 'System'}
                                                                    </div>
                                                                </div>
                                                {activity.details && Object.keys(activity.details).length > 0 && (
                                                    <div className="text-sm text-gray-600">

                                                        
                                                        {/* Show Changes Section for Profile Updates */}
                                                        {(activity.action === 'profile_updated' || activity.action === 'updated' || activity.action === 'update' || 
                                                          activity.activity_type === 'profile_updated' || activity.activity_type === 'updated' || activity.activity_type === 'update') && (
                                                            <div className="mt-3">
                                                                {/* Detailed Field Changes with Before/After Values */}
                                                                {activity.details && activity.details.field_changes && Object.keys(activity.details.field_changes).length > 0 && (
                                                                    <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded-r-md mb-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Edit className="w-5 h-5 text-blue-600" />
                                                                            <strong className="text-blue-800 text-base">📝 Field Changes Applied</strong>
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                            {Object.entries(activity.details.field_changes).map(([field, change]) => {
                                                                                // Enhanced field labels with more comprehensive mapping
                                                                                const fieldLabels = {
                                                                                    'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                                                                                    'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                                                                                    'department_id': 'Department', 'department': 'Department', 'designation': 'Designation',
                                                                                    'role': 'Role', 'role_id': 'Role', 'gender': 'Gender', 'status': 'Status',
                                                                                    'marital_status': 'Marital Status', 'date_of_birth': 'Date of Birth',
                                                                                    'date_of_joining': 'Date of Joining', 'employee_id': 'Employee ID',
                                                                                    'emergency_contact_name': 'Emergency Contact', 'emergency_contact_phone': 'Emergency Phone',
                                                                                    'qualification': 'Qualification', 'experience': 'Experience',
                                                                                    'reporting_manager': 'Reporting Manager', 'security_fields': 'Password/Security Fields',
                                                                                    'username': 'Username', 'password': 'Password'
                                                                                };
                                                                                
                                                                                const fieldLabel = fieldLabels[field] || change.label || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                                                                
                                                                                return (
                                                                                    <div key={field} className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                                                                                        <div className="flex items-center gap-2 mb-2">
                                                                                            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                                                                                            <span className="font-semibold text-gray-800 text-sm">
                                                                                                {fieldLabel}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="ml-5">
                                                                                            <div className="flex items-center gap-3 text-sm">
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs text-gray-500 font-medium">FROM:</span>
                                                                                                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-md font-medium">
                                                                                                        {typeof change.from === 'object' 
                                                                                                            ? JSON.stringify(change.from) 
                                                                                                            : (change.from || 'Not set')
                                                                                                        }
                                                                                                    </span>
                                                                                                </div>
                                                                                                <span className="text-gray-400 text-lg">→</span>
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs text-gray-500 font-medium">TO:</span>
                                                                                                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-md font-medium">
                                                                                                        {typeof change.to === 'object' 
                                                                                                            ? JSON.stringify(change.to) 
                                                                                                            : (change.to || 'Cleared')
                                                                                                        }
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="mt-3 p-2 bg-blue-100 rounded-md">
                                                                            <div className="text-xs text-blue-700 flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                <span>Changes made by: <strong>{getUserName(activity)}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Fallback: Display changes if description contains them */}
                                                                {(!activity.details.field_changes || Object.keys(activity.details.field_changes).length === 0) && 
                                                                 activity.details.changes && Array.isArray(activity.details.changes) && activity.details.changes.length > 0 && (
                                                                    <div className="border-l-4 border-orange-500 bg-orange-50 p-3 rounded-r-md mb-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Edit className="w-5 h-5 text-orange-600" />
                                                                            <strong className="text-orange-800 text-base">📋 Changes Made</strong>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {activity.details.changes.map((change, index) => (
                                                                                <div key={index} className="bg-white p-3 rounded-lg border border-orange-200 flex items-center gap-2">
                                                                                    <span className="w-6 h-6 bg-orange-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <span className="text-sm text-gray-800">{change}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="mt-3 p-2 bg-orange-100 rounded-md">
                                                                            <div className="text-xs text-orange-700 flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                <span>Changes made by: <strong>{getUserName(activity)}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Updated Fields List when detailed changes not available */}
                                                                {(!activity.details.field_changes || Object.keys(activity.details.field_changes).length === 0) && 
                                                                 (!activity.details.changes || activity.details.changes.length === 0) &&
                                                                 activity.details.updated_fields && Array.isArray(activity.details.updated_fields) && (
                                                                    <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded-r-md mb-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Edit className="w-5 h-5 text-green-600" />
                                                                            <strong className="text-green-800 text-base">✅ FIELDS MODIFIED</strong>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                            {activity.details.updated_fields.map((field, index) => {
                                                                                const fieldLabels = {
                                                                                    'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                                                                                    'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                                                                                    'department_id': 'Department', 'designation': 'Designation',
                                                                                    'emergency_contact_name': 'Emergency Contact Name', 
                                                                                    'emergency_contact_phone': 'Emergency Contact Phone'
                                                                                };
                                                                                const fieldLabel = fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                                                                
                                                                                return (
                                                                                    <div key={field} className="bg-white p-3 rounded-lg border border-green-200 flex items-center gap-2">
                                                                                        <span className="w-6 h-6 bg-green-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                                                                                            {index + 1}
                                                                                        </span>
                                                                                        <span className="font-medium text-gray-800">{fieldLabel}</span>
                                                                                        <span className="text-green-600 ml-auto">✓</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="mt-3 p-2 bg-green-100 rounded-md">
                                                                            <div className="text-xs text-green-700 flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                <span>Modified by: <strong>{getUserName(activity)}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Raw Changes Detection */}
                                                                {!activity.details.field_changes && !activity.details.updated_fields && 
                                                                 activity.details.raw_changes && typeof activity.details.raw_changes === 'object' && (
                                                                    <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3 rounded-r-md mb-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Edit className="w-5 h-5 text-yellow-600" />
                                                                            <strong className="text-yellow-800 text-base">🔍 PROFILE CHANGES DETECTED</strong>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                            {Object.keys(activity.details.raw_changes)
                                                                                .filter(key => !['updated_at', 'password', 'hashed_password', '_id', 'createdAt', 'updatedAt'].includes(key))
                                                                                .map((field, index) => {
                                                                                    const fieldLabels = {
                                                                                        'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                                                                                        'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                                                                                        'department_id': 'Department', 'designation': 'Designation',
                                                                                        'emergency_contact_name': 'Emergency Contact', 'emergency_contact_phone': 'Emergency Phone'
                                                                                    };
                                                                                    const fieldLabel = fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                                                                    
                                                                                    return (
                                                                                        <div key={field} className="bg-white p-3 rounded-lg border border-yellow-200 flex items-center gap-2">
                                                                                            <span className="w-6 h-6 bg-yellow-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                                                                                                {index + 1}
                                                                                            </span>
                                                                                            <span className="font-medium text-gray-800">{fieldLabel}</span>
                                                                                            <span className="text-yellow-600 ml-auto">📝</span>
                                                                                        </div>
                                                                                    );
                                                                                })
                                                                            }
                                                                        </div>
                                                                        <div className="mt-3 p-2 bg-yellow-100 rounded-md">
                                                                            <div className="text-xs text-yellow-700 flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                <span>Changed by: <strong>{getUserName(activity)}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Changes Array Display */}
                                                                {!activity.details.field_changes && !activity.details.updated_fields && 
                                                                 !activity.details.raw_changes && activity.details.changes && Array.isArray(activity.details.changes) && (
                                                                    <div className="border-l-4 border-purple-500 bg-purple-50 p-3 rounded-r-md mb-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Edit className="w-5 h-5 text-purple-600" />
                                                                            <strong className="text-purple-800 text-base">📋 CHANGES APPLIED</strong>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {activity.details.changes.map((change, index) => (
                                                                                <div key={index} className="bg-white p-3 rounded-lg border border-purple-200 flex items-center gap-3">
                                                                                    <span className="w-6 h-6 bg-purple-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <span className="font-medium text-gray-800">{change}</span>
                                                                                    <span className="text-purple-600 ml-auto">✓</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="mt-3 p-2 bg-purple-100 rounded-md">
                                                                            <div className="text-xs text-purple-700 flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                <span>Applied by: <strong>{getUserName(activity)}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Fallback: Show any available details */}
                                                                {!activity.details.field_changes && !activity.details.updated_fields && 
                                                                 !activity.details.raw_changes && !activity.details.changes && (
                                                                    <div className="border-l-4 border-gray-500 bg-gray-50 p-3 rounded-r-md mb-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Activity className="w-5 h-5 text-gray-600" />
                                                                            <strong className="text-gray-800 text-base">📄 ACTIVITY DETAILS</strong>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                                            <div className="text-gray-700">
                                                                                Profile was updated but specific change details are not available in the expected format.
                                                                            </div>
                                                                            {Object.keys(activity.details).length > 0 && (
                                                                                <div className="mt-2 text-xs text-gray-600">
                                                                                    <strong>Raw data available:</strong> {Object.keys(activity.details).join(', ')}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="mt-3 p-2 bg-gray-100 rounded-md">
                                                                            <div className="text-xs text-gray-700 flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                <span>Action by: <strong>{getUserName(activity)}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Profile Updates with updated_fields list */}
                                                        {(activity.action === 'profile_updated' || activity.action === 'updated') && !activity.details.field_changes && activity.details.updated_fields && Array.isArray(activity.details.updated_fields) && (
                                                            <div className="mt-3 border-l-4 border-green-500 bg-green-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Edit className="w-4 h-4 text-green-600" />
                                                                    <strong className="text-green-800">✅ Fields Modified:</strong>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                    {activity.details.updated_fields.map(field => {
                                                                        const fieldLabels = {
                                                                            'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                                                                            'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                                                                            'department_id': 'Department', 'designation': 'Designation',
                                                                            'emergency_contact_name': 'Emergency Contact Name', 
                                                                            'emergency_contact_phone': 'Emergency Contact Phone'
                                                                        };
                                                                        const fieldLabel = fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                                                        return (
                                                                            <div key={field} className="bg-white p-2 rounded border flex items-center gap-2">
                                                                                <span className="text-green-600">✓</span>
                                                                                <span className="font-medium">{fieldLabel}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>Modified by: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}



                                                        {/* Enhanced Status Changes */}
                                                        {activity.details.status_change && (
                                                            <div className="mt-3 border-l-4 border-purple-500 bg-purple-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Activity className="w-4 h-4 text-purple-600" />
                                                                    <strong className="text-purple-800">🔄 Status Change:</strong>
                                                                </div>
                                                                <div className="bg-white p-3 rounded border">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                                                                From: {activity.details.status_change.from || 'N/A'}
                                                                            </span>
                                                                            <span className="text-gray-400 text-lg">→</span>
                                                                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                                                                To: {activity.details.status_change.to || 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {activity.details.status_change.remark && (
                                                                        <div className="mt-2 p-2 bg-gray-50 rounded">
                                                                            <span className="font-medium text-gray-700">Reason: </span>
                                                                            <span className="text-gray-800">{activity.details.status_change.remark}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 text-xs text-purple-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>Changed by: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Enhanced File Information */}
                                                        {activity.details.file_info && (
                                                            <div className="mt-3 border-l-4 border-indigo-500 bg-indigo-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <FileText className="w-4 h-4 text-indigo-600" />
                                                                    <strong className="text-indigo-800">📎 File Upload:</strong>
                                                                </div>
                                                                <div className="bg-white p-3 rounded border">
                                                                    <div className="font-medium text-gray-800 mb-1">
                                                                        {activity.details.file_info.file_name}
                                                                    </div>
                                                                    {activity.details.file_info.file_size && (
                                                                        <div className="text-sm text-gray-600">
                                                                            Size: {activity.details.file_info.file_size}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 text-xs text-indigo-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>Uploaded by: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Enhanced Comments/Notes */}
                                                        {(activity.details.comment || (activity.details.remark && typeof activity.details.remark === 'string')) && (
                                                            <div className="mt-3 border-l-4 border-cyan-500 bg-cyan-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Edit className="w-4 h-4 text-cyan-600" />
                                                                    <strong className="text-cyan-800">💬 Note/Comment:</strong>
                                                                </div>
                                                                <div className="bg-white p-3 rounded border italic text-gray-800">
                                                                    "{activity.details.comment || activity.details.remark}"
                                                                </div>
                                                                <div className="mt-2 text-xs text-cyan-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>Added by: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Enhanced Employee Creation Info */}
                                                        {activity.details.creation_info && (
                                                            <div className="mt-3 border-l-4 border-green-500 bg-green-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <User className="w-4 h-4 text-green-600" />
                                                                    <strong className="text-green-800">👤 Employee Creation:</strong>
                                                                </div>
                                                                <div className="bg-white p-3 rounded border">
                                                                    {activity.details.creation_info.employee_name && (
                                                                        <div className="font-medium text-gray-800 mb-2">
                                                                            Employee: {activity.details.creation_info.employee_name}
                                                                        </div>
                                                                    )}
                                                                    <div className="text-sm text-gray-600">
                                                                        Created on: {formatDateTime(activity.details.creation_info.creation_date)}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>Created by: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Raw Changes Display */}
                                                        {(activity.action === 'profile_updated' || activity.action === 'updated') && 
                                                         !activity.details.field_changes && !activity.details.updated_fields && 
                                                         activity.details.raw_changes && typeof activity.details.raw_changes === 'object' && (
                                                            <div className="mt-3 border-l-4 border-yellow-500 bg-yellow-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Edit className="w-4 h-4 text-yellow-600" />
                                                                    <strong className="text-yellow-800">🔍 Profile Changes:</strong>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                    {Object.keys(activity.details.raw_changes)
                                                                        .filter(key => !['updated_at', 'password', 'hashed_password', '_id', 'createdAt', 'updatedAt'].includes(key))
                                                                        .map(field => {
                                                                            const fieldLabels = {
                                                                                'first_name': 'First Name', 'last_name': 'Last Name', 'email': 'Email Address',
                                                                                'phone': 'Phone Number', 'address': 'Address', 'salary': 'Salary', 
                                                                                'department_id': 'Department', 'designation': 'Designation',
                                                                                'emergency_contact_name': 'Emergency Contact', 'emergency_contact_phone': 'Emergency Phone'
                                                                            };
                                                                            const fieldLabel = fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                                                            return (
                                                                                <div key={field} className="bg-white p-2 rounded border flex items-center gap-2">
                                                                                    <span className="text-yellow-600">📝</span>
                                                                                    <span className="font-medium">{fieldLabel}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                                <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>Modified by: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Generic details fallback */}
                                                        {!activity.details.field_changes && !activity.details.updated_fields && !activity.details.status_change && 
                                                         !activity.details.file_info && !activity.details.comment && !activity.details.remark && 
                                                         !activity.details.creation_info && !activity.details.raw_changes && Object.keys(activity.details).length > 0 && (
                                                            <div className="mt-3 border-l-4 border-gray-500 bg-gray-50 p-3 rounded-r-md">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Activity className="w-4 h-4 text-gray-600" />
                                                                    <strong className="text-gray-800">📋 Additional Details:</strong>
                                                                </div>
                                                                <div className="bg-white p-2 rounded border">
                                                                    <ul className="space-y-1">
                                                                        {Object.entries(activity.details).map(([key, value], idx) => {
                                                                            if (value === null || value === undefined || 
                                                                                (typeof value === 'object' && Object.keys(value).length === 0)) {
                                                                                return null;
                                                                            }
                                                                            
                                                                            // Skip ID fields to avoid showing object IDs
                                                                            if (key.toLowerCase().includes('_id') || key.toLowerCase().includes('id')) {
                                                                                return null;
                                                                            }
                                                                            
                                                                            const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();
                                                                            
                                                                            let formattedValue = value;
                                                                            if (typeof value === 'object' && !Array.isArray(value)) {
                                                                                formattedValue = JSON.stringify(value).replace(/[{}"]/g, '').replace(/,/g, ', ');
                                                                            } else if (Array.isArray(value)) {
                                                                                formattedValue = value.join(', ');
                                                                            }
                                                                            
                                                                            return (
                                                                                <li key={idx} className="flex items-start gap-2">
                                                                                    <span className="text-gray-600">•</span>
                                                                                    <div>
                                                                                        <span className="capitalize font-medium">{formattedKey}:</span>&nbsp;
                                                                                        <span className="text-gray-700">{String(formattedValue)}</span>
                                                                                    </div>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                                <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>By: <strong>{getProperUserName(activity)}</strong></span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                                {/* User Attribution and Timestamp */}
                                                                <div className="mt-3 pt-3 border-t border-gray-200 bg-gray-50 -mx-3 -mb-3 px-3 pb-3 rounded-b-lg">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                                <User className="w-4 h-4 text-blue-600" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-medium text-gray-900">
                                                                                    {getProperUserName(activity)}
                                                                                </div>
                                                                                <div className="text-xs text-gray-500">
                                                                                    Performed this action
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-sm text-gray-600 flex items-center gap-1">
                                                                                <Clock className="w-3 h-3" />
                                                                                {formatDateTime(activity.timestamp || activity.created_at)}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500">
                                                                                {getRelativeTime(activity.timestamp || activity.created_at)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
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

            {/* Activity Summary */}
            {filteredActivities.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-6">
                    <h4 className="font-medium text-gray-700 mb-3">Activity Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">
                                {filteredActivities.filter(a => (a.action === 'profile_updated' || a.action === 'updated')).length}
                            </div>
                            <div className="text-gray-600">Profile Updates</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-green-600">
                                {filteredActivities.filter(a => (a.action === 'employee_created' || a.action === 'created' || a.action === 'employee_creation_date')).length}
                            </div>
                            <div className="text-gray-600">Creation Events</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-purple-600">
                                {filteredActivities.filter(a => (a.action === 'status_changed' || a.action === 'status_change')).length}
                            </div>
                            <div className="text-gray-600">Status Changes</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">
                                {filteredActivities.filter(a => (a.action === 'attachment_uploaded' || a.action === 'document')).length}
                            </div>
                            <div className="text-gray-600">Documents</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeActivity;
