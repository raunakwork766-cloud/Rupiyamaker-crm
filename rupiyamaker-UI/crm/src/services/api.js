// API configuration with CORS handling
// ALWAYS use /api - nginx/server will proxy to backend
const API_BASE_URL = '/api';

console.log('🌐 API Configuration:', {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  baseURL: API_BASE_URL
});

// Request throttling to prevent ERR_INSUFFICIENT_RESOURCES
const MAX_CONCURRENT_REQUESTS = 6;
const REQUEST_DELAY = 100; // 100ms between requests
let activeRequests = new Set();
let requestQueue = [];

const throttledFetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const executeRequest = async () => {
            if (activeRequests.size >= MAX_CONCURRENT_REQUESTS) {
                // Queue the request if we're at capacity
                setTimeout(() => requestQueue.push(executeRequest), REQUEST_DELAY);
                return;
            }

            const requestId = Date.now() + Math.random();
            activeRequests.add(requestId);

            try {
                const response = await fetch(url, options);
                resolve(response);
            } catch (error) {
                reject(error);
            } finally {
                activeRequests.delete(requestId);
                // Process next request in queue
                if (requestQueue.length > 0) {
                    const nextRequest = requestQueue.shift();
                    setTimeout(nextRequest, REQUEST_DELAY);
                }
            }
        };

        executeRequest();
    });
};

// Get user data from localStorage
const getUserData = () => {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
};

// Get user ID for API calls
const getUserId = () => {
    const user = getUserData();
    return user?.user_id || null;
};

// Get user name for API calls
const getUserName = () => {
    const user = getUserData();
    if (!user) return 'Unknown User';
    
    // Try different combinations to get user name
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    } else if (user.name) {
        return user.name;
    } else if (user.full_name) {
        return user.full_name;
    } else if (user.username) {
        return user.username;
    } else {
        return 'Unknown User';
    }
};

// Generic API call function - exported for special cases like file uploads
export const apiCall = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const user = getUserData();
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': user?.access_token || user?.token || localStorage.getItem('token') 
                ? `Bearer ${user?.access_token || user?.token || localStorage.getItem('token')}` 
                : 'Bearer test-token', // Fallback token
            ...options.headers,
        },
    };

    const response = await throttledFetch(url, { ...defaultOptions, ...options });

    // 🔥 NEW: Check for 403 errors which indicate session invalidation
    if (response.status === 403) {
        const error = await response.json().catch(() => ({ detail: 'Session invalidated' }));
        console.error('⚠️ 403 FORBIDDEN - Session invalidated:', error.detail);
        
        // Import forceLogout dynamically to avoid circular dependency
        import('../utils/auth.js').then(({ forceLogout }) => {
            forceLogout(error.detail || 'Your session is no longer valid');
        });
        
        // Throw error to stop the API call
        const apiError = new Error(error.detail || 'Session invalidated');
        apiError.response = { status: 403, data: error };
        throw apiError;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Network error' }));
        
        console.error('🔍 API Error Details:');
        console.error('Status:', response.status);
        console.error('URL:', response.url);
        console.error('Error Detail:', error.detail);
        console.error('Full Error JSON:', JSON.stringify(error, null, 2));
        
        // Handle specific error types
        if (response.status === 500) {
            console.error('🔥 500 Internal Server Error - Backend issue detected');
            console.error('🔧 Possible causes:');
            console.error('   - Backend server is down or misconfigured');
            console.error('   - Database connection issues');
            console.error('   - Invalid request parameters');
            console.error('   - Backend code errors');
        }
        
        // Parse and display detailed validation errors
        if (error.detail && Array.isArray(error.detail)) {
            console.error('🔍 DETAILED VALIDATION ERRORS:');
            error.detail.forEach((validationError, index) => {
                console.error(`Validation Error ${index + 1}:`);
                console.error('  Type:', validationError.type);
                console.error('  Location:', validationError.loc);
                console.error('  Message:', validationError.msg);
                console.error('  Input:', validationError.input);
                console.error('  Full Error:', JSON.stringify(validationError, null, 2));
            });
        }
        
        // Create a proper Error object with response data attached
        const apiError = new Error(error.detail || `HTTP error! status: ${response.status}`);
        apiError.response = { status: response.status, data: error };
        throw apiError;
    }

    return response.json();
};

// Authentication APIs
export const authAPI = {
    login: async (identifier, password) => {
        return apiCall('/users/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
        });
    },

    logout: async () => {
        // If you have a logout endpoint
        try {
            return apiCall('/users/logout', { method: 'POST' });
        } catch (error) {
            // Handle logout locally if no endpoint
            console.log('Logout:', error.message);
        }
    }
};

// Feeds APIs
export const feedsAPI = {
    getFeeds: async (page = 1, limit = 10) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/feeds?user_id=${userId}&page=${page}&limit=${limit}`);
    },

    createFeed: async (feedData) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/feeds?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(feedData),
        });
    },

    updateFeed: async (feedId, feedData) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/feeds/${feedId}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(feedData),
        });
    },

    deleteFeed: async (feedId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/feeds/${feedId}?user_id=${userId}`, {
            method: 'DELETE',
        });
    },

    addComment: async (feedId, content) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/feeds/${feedId}/comments?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    }
};

// Leads APIs
export const leadsAPI = {
    getLeads: async (page = 1, limit = 10, filters = {}) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        const queryParams = new URLSearchParams({
            user_id: userId,
            page: page.toString(),
            limit: limit.toString(),
            ...filters
        });

        return apiCall(`/leads?${queryParams}`);
    },

    createLead: async (leadData) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/leads?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(leadData),
        });
    },

    updateLead: async (leadId, leadData) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/leads/${leadId}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(leadData),
        });
    },

    deleteLead: async (leadId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/leads/${leadId}?user_id=${userId}`, {
            method: 'DELETE',
        });
    }
};

// Users APIs
export const usersAPI = {
    getUsers: async () => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/users?user_id=${userId}`);
    },

    getUserById: async (targetUserId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/users/${targetUserId}?user_id=${userId}`);
    }
};

// Roles APIs
export const rolesAPI = {
    getRoles: async () => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/roles?user_id=${userId}`);
    }
};

// Departments APIs
export const departmentsAPI = {
    getDepartments: async () => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/departments?user_id=${userId}`);
    }
};

// Tickets APIs
export const ticketsAPI = {
    getTickets: async (page = 1, perPage = 20, filters = {}) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        // Build query params
        // IMPORTANT: Backend requires user_id for authentication, but handles filtering based on role permissions
        // The backend will decide what tickets to return based on the user's role permissions in the database
        const queryParams = new URLSearchParams({
            user_id: userId,  // Required by backend for user identification
            page: page.toString(),
            per_page: perPage.toString(),
            ...filters  // Additional filters like status, etc.
        });

        return apiCall(`/tickets/?${queryParams}`);
    },

    getTicketById: async (ticketId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/?user_id=${userId}`);
    },

    getAssignableUsers: async () => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        // Fetch all users who can be assigned to tickets using the tasks assignment endpoint
        return apiCall(`/tasks/users-for-assignment/?user_id=${userId}`);
    },

    createTicket: async (ticketData) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(ticketData),
        });
    },

    updateTicket: async (ticketId, ticketData) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(ticketData),
        });
    },

    deleteTicket: async (ticketId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/?user_id=${userId}`, {
            method: 'DELETE',
        });
    },

    uploadAttachments: async (ticketId, files) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');
        
        console.log(`Uploading ${files.length} attachments for ticket ${ticketId}`);
        
        // Get user data for authorization
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const uploadResults = [];
        
        // Upload files one by one since backend expects single file uploads
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`Uploading file ${i + 1}/${files.length}: ${file.name} (${file.type})`);
            
            try {
                // Create FormData for single file upload
                const formData = new FormData();
                formData.append('file', file);  // Backend expects 'file' not 'files'
                
                const url = `${API_BASE_URL}/tickets/${ticketId}/attachments/?user_id=${userId}`;
                console.log(`Making upload request to: ${url}`);
                
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Authorization': `Bearer ${userData.token || ''}`
                    }
                });
                
                console.log(`Upload response status for ${file.name}: ${response.status}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Upload failed for ${file.name} with error: ${errorText}`);
                    throw new Error(`Failed to upload ${file.name}: ${errorText}`);
                }
                
                const result = await response.json();
                console.log(`Upload successful for ${file.name}:`, result);
                uploadResults.push({
                    filename: file.name,
                    result: result
                });
                
            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                throw new Error(`Failed to upload ${file.name}: ${error.message}`);
            }
        }
        
        console.log('All uploads completed successfully:', uploadResults);
        return {
            message: `Successfully uploaded ${uploadResults.length} file(s)`,
            uploads: uploadResults
        };
    },

    addComment: async (ticketId, content) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/comments/?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    },

    // Note: Comments are embedded in ticket data, get them via getTicketById
    // Note: No separate history endpoint available, activities are tracked differently

    assignTicket: async (ticketId, assignedUsers) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/assign/?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ assigned_users: assignedUsers }),
        });
    },

    closeTicket: async (ticketId, reason) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/close/?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    },

    failTicket: async (ticketId, reason) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/fail/?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    },

    reopenTicket: async (ticketId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/reopen/?user_id=${userId}`, {
            method: 'POST',
        });
    },

    getHistory: async (ticketId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/tickets/${ticketId}/history/?user_id=${userId}`);
    }
};

export const tasksAPI = {
    createTask: async (taskData) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
        return response;
    },

    getHistory: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/history?user_id=${userId}`);
        return response;
    },
    
    getComments: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/comments?user_id=${userId}`);
        return response;
    },
    
    addComment: async (taskId, comment) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/comments?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ content: comment })
        });
        return response;
    },
    
    getTask: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}?user_id=${userId}&include_attachments=true`);
        return response;
    },
    
    updateTask: async (taskId, taskData) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
        return response;
    },
    
    deleteTask: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}?user_id=${userId}`, {
            method: 'DELETE'
        });
        return response;
    },
    
    uploadAttachment: async (taskId, formData) => {
        const userId = getCurrentUserId();
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments?user_id=${userId}`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        return response.json();
    },

    getAttachments: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/attachments?user_id=${userId}`);
        return response;
    },

    downloadAttachment: async (taskId, attachmentId) => {
        const userId = getCurrentUserId();
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download?user_id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        return response;
    },

    deleteAttachment: async (taskId, attachmentId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/attachments/${attachmentId}?user_id=${userId}`, {
            method: 'DELETE'
        });
        return response;
    },

    repeatTask: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/repeat?user_id=${userId}`, {
            method: 'POST'
        });
        return response;
    },

    // Recurring task methods
    createRecurringTask: async (taskId, recurringConfig) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/recurring?user_id=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recurringConfig)
        });
        return response;
    },

    updateRecurringTask: async (taskId, recurringConfig) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/recurring?user_id=${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recurringConfig)
        });
        return response;
    },

    stopRecurringTask: async (taskId) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/recurring?user_id=${userId}`, {
            method: 'DELETE'
        });
        return response;
    },

    getRecurringInstances: async (taskId, skip = 0, limit = 50) => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/${taskId}/recurring/instances?user_id=${userId}&skip=${skip}&limit=${limit}`, {
            method: 'GET'
        });
        return response;
    },

    getSchedulerStatus: async () => {
        const userId = getCurrentUserId();
        const response = await apiCall(`/tasks/recurring/scheduler/status?user_id=${userId}`, {
            method: 'GET'
        });
        return response;
    },

    // Recurring task methods
    createRecurringTask: async (taskId, recurringConfig) => {
        const response = await apiCall(`/tasks/${taskId}/recurring`, {
            method: 'POST',
            body: JSON.stringify(recurringConfig)
        });
        return response;
    },

    updateRecurringTask: async (taskId, recurringConfig) => {
        const response = await apiCall(`/tasks/${taskId}/recurring`, {
            method: 'PUT',
            body: JSON.stringify(recurringConfig)
        });
        return response;
    },

    stopRecurringTask: async (taskId) => {
        const response = await apiCall(`/tasks/${taskId}/recurring`, {
            method: 'DELETE'
        });
        return response;
    },

    getRecurringInstances: async (taskId, skip = 0, limit = 50) => {
        const response = await apiCall(`/tasks/${taskId}/recurring/instances?skip=${skip}&limit=${limit}`);
        return response;
    },

    getSchedulerStatus: async () => {
        const response = await apiCall('/tasks/recurring/scheduler/status');
        return response;
    },

    // Get all users available for task assignment (no hierarchical filtering)
    getUsersForAssignment: async (search = null) => {
        const userId = getCurrentUserId();
        let url = `/tasks/users-for-assignment?user_id=${userId}`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }
        const response = await apiCall(url);
        return response;
    }
};

// Interviews APIs
export const interviewsAPI = {
    getInterviews: async (page = 1, limit = 20, filters = {}) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        const queryParams = new URLSearchParams({
            user_id: userId,
            limit: limit.toString(),
            ...filters
        });

        const result = await apiCall(`/interviews?${queryParams}`);
        return result;
    },

    getInterviewById: async (interviewId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}?user_id=${userId}`);
    },

    createInterview: async (interviewData) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        const result = await apiCall(`/interviews?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(interviewData),
        });

        // Add creation history entry
        if (result && (result.id || result._id)) {
            try {
                const interviewId = result.id || result._id;
                await apiCall(`/interviews/${interviewId}/history?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        action_type: 'created',
                        action: 'Interview Created',
                        description: `Interview created for ${interviewData.candidate_name || 'candidate'} for ${interviewData.job_opening || 'position'}`,
                        details: {
                            candidate_name: interviewData.candidate_name,
                            job_opening: interviewData.job_opening,
                            interview_type: interviewData.interview_type,
                            status: interviewData.status || 'pending',
                            interview_date: interviewData.interview_date,
                            city: interviewData.city,
                            created_fields: Object.keys(interviewData).length
                        }
                    }),
                });
            } catch (historyError) {
                console.warn('Failed to add creation history entry:', historyError);
                // Don't fail the whole operation if history fails
            }
        }

        return result;
    },

    updateInterview: async (interviewId, interviewData, originalData = null) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        const result = await apiCall(`/interviews/${interviewId}?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
            method: 'PUT',
            body: JSON.stringify(interviewData),
        });

        // If we have original data, track what changed
        if (originalData && result) {
            try {
                const changes = {};
                const fieldsToTrack = [
                    'candidate_name', 'mobile_number', 'alternate_number',
                    'job_opening', 'interview_type', 'status', 'interview_date',
                    'interview_time', 'city', 'state', 'gender',
                    'experience_type', 'total_experience', 'old_salary',
                    'offer_salary', 'source_portal'
                ];

                fieldsToTrack.forEach(field => {
                    if (originalData[field] !== interviewData[field]) {
                        changes[field] = {
                            old: originalData[field],
                            new: interviewData[field]
                        };
                    }
                });

                // Only create history entry if there are actual changes
                if (Object.keys(changes).length > 0) {
                    const changedFields = Object.keys(changes).join(', ').replace(/_/g, ' ');
                    await apiCall(`/interviews/${interviewId}/history?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
                        method: 'POST',
                        body: JSON.stringify({
                            action_type: 'field_changed',
                            action: 'Interview Updated',
                            description: `Updated interview fields: ${changedFields}`,
                            details: {
                                changes,
                                total_fields_changed: Object.keys(changes).length
                            }
                        }),
                    });
                }
            } catch (historyError) {
                console.warn('Failed to add history entry for interview update:', historyError);
                // Don't fail the whole operation if history fails
            }
        }

        return result;
    },

    deleteInterview: async (interviewId) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}?user_id=${userId}`, {
            method: 'DELETE',
        });
    },

    // Get interview comments
    getComments: async (interviewId) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}/comments?user_id=${userId}&user_name=${encodeURIComponent(userName)}`);
    },

    // Add comment to interview
    addComment: async (interviewId, commentData) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        // If commentData is a string, convert it to an object
        const requestBody = typeof commentData === 'string' 
            ? { content: commentData, comment: commentData }
            : commentData;

        return apiCall(`/interviews/${interviewId}/comments?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    },

    // Update interview comment
    updateComment: async (interviewId, commentId, commentData) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        // If commentData is a string, convert it to an object
        const requestBody = typeof commentData === 'string' 
            ? { content: commentData, comment: commentData }
            : commentData;

        return apiCall(`/interviews/${interviewId}/comments/${commentId}?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
            method: 'PUT',
            body: JSON.stringify(requestBody),
        });
    },

    // Delete interview comment
    deleteComment: async (interviewId, commentId) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}/comments/${commentId}?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
            method: 'DELETE',
        });
    },

    // Get interview history
    getHistory: async (interviewId) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}/history?user_id=${userId}&user_name=${encodeURIComponent(userName)}`);
    },

    // Add history entry for an interview
    addHistoryEntry: async (interviewId, historyData) => {
        const userId = getUserId();
        const userName = getUserName();
        if (!userId) throw new Error('User not authenticated');

        const requestBody = {
            action_type: historyData.action_type || 'updated',
            action: historyData.action || historyData.description,
            description: historyData.description || historyData.action,
            details: historyData.details || {},
            ...historyData
        };

        return apiCall(`/interviews/${interviewId}/history?user_id=${userId}&user_name=${encodeURIComponent(userName)}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    },

    // Check for duplicate phone numbers
    checkDuplicatePhone: async (phoneNumber) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/check-duplicate/${encodeURIComponent(phoneNumber)}?user_id=${userId}`);
    },

    // Request interview reassignment
    requestReassignment: async (interviewId, newUserId, reason) => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}/request-reassignment?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({
                interview_id: interviewId,
                new_user_id: newUserId,
                reason: reason
            }),
        });
    },

    // Approve interview reassignment
    approveReassignment: async (interviewId, approved, remarks = '') => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/${interviewId}/approve-reassignment?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({
                approved: approved,
                remarks: remarks
            }),
        });
    },

    // Get pending interview reassignment requests
    getPendingReassignments: async () => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/pending-reassignments?user_id=${userId}`, {
            method: 'GET'
        });
    },

    getAllReassignments: async () => {
        const userId = getUserId();
        if (!userId) throw new Error('User not authenticated');

        return apiCall(`/interviews/all-reassignments?user_id=${userId}`, {
            method: 'GET'
        });
    }
};

// Interview Settings APIs
export const interviewSettingsAPI = {
    // Job Openings CRUD
    getJobOpenings: async () => {
        const userId = getUserId() || 'test'; // Fallback to test user
        
        return apiCall(`/interview-settings/job-openings?user_id=${userId}`);
    },

    createJobOpening: async (jobOpeningData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/job-openings?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(jobOpeningData),
        });
    },

    updateJobOpening: async (id, jobOpeningData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/job-openings/${id}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(jobOpeningData),
        });
    },

    deleteJobOpening: async (id) => {
        const userId = getUserId() || 'test'; // Fallback to test user
        
        // TEMPORARY: Direct backend URL for debugging
        const directURL = `/api/interview-settings/job-openings/${id}?user_id=${userId}`;
        
        console.log('🔄 DIRECT DELETE REQUEST:', directURL);
        
        try {
            const response = await fetch(directURL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            });
            
            console.log('🔄 DIRECT DELETE RESPONSE:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url
            });
            
            const result = await response.json();
            console.log('🔄 DIRECT DELETE RESULT:', result);
            
            return result;
        } catch (error) {
            console.error('💥 DIRECT DELETE ERROR:', error);
            throw error;
        }
    },

    // Interview Types CRUD
    getInterviewTypes: async () => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/interview-types?user_id=${userId}`);
    },

    createInterviewType: async (interviewTypeData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/interview-types?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(interviewTypeData),
        });
    },

    updateInterviewType: async (id, interviewTypeData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/interview-types/${id}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(interviewTypeData),
        });
    },

    deleteInterviewType: async (id) => {
        const userId = getUserId() || 'test'; // Fallback to test user
        
        // ENHANCED: Check if item exists before attempting deletion
        console.log('🔍 PRE-DELETE CHECK: Verifying interview type exists...');
        
        try {
            // First, get all interview types to verify the item exists
            const verifyResponse = await fetch(`${API_BASE_URL}/interview-settings/interview-types?user_id=${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            });
            
            const verifyResult = await verifyResponse.json();
            console.log('🔍 VERIFICATION: Current interview types:', verifyResult);
            
            if (verifyResult.success && verifyResult.data) {
                const itemExists = verifyResult.data.find(item => item._id === id);
                
                if (!itemExists) {
                    console.log('⚠️ ITEM NOT FOUND: Interview type does not exist, skipping deletion');
                    return {
                        success: true,
                        message: 'Interview type was already deleted',
                        alreadyDeleted: true
                    };
                }
                
                console.log('✅ ITEM VERIFIED: Interview type exists, proceeding with deletion');
            }
        } catch (verifyError) {
            console.warn('⚠️ VERIFICATION FAILED: Could not verify item existence, proceeding anyway:', verifyError);
        }
        
        // Proceed with deletion
        const directURL = `/api/interview-settings/interview-types/${id}?user_id=${userId}`;
        
        console.log('🔄 DIRECT DELETE INTERVIEW TYPE REQUEST:', directURL);
        
        try {
            const response = await fetch(directURL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            });
            
            console.log('🔄 DIRECT DELETE INTERVIEW TYPE RESPONSE:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url
            });
            
            if (response.status === 404) {
                console.log('⚠️ 404 HANDLED: Item was already deleted');
                return {
                    success: true,
                    message: 'Interview type was already deleted',
                    alreadyDeleted: true
                };
            }
            
            const result = await response.json();
            console.log('🔄 DIRECT DELETE INTERVIEW TYPE RESULT:', result);
            
            return result;
        } catch (error) {
            console.error('💥 DIRECT DELETE INTERVIEW TYPE ERROR:', error);
            
            // Handle 404 errors gracefully
            if (error.message && error.message.includes('404')) {
                return {
                    success: true,
                    message: 'Interview type was already deleted',
                    alreadyDeleted: true
                };
            }
            
            throw error;
        }
    },

    // Status CRUD
    getStatuses: async () => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/statuses?user_id=${userId}`);
    },

    createStatus: async (statusData) => {
        const userId = getUserId() || 'test'; // Fallback to test user
        
        console.log('🔧 API Service: createStatus called with:', statusData);
        console.log('🔧 API Service: userId:', userId);

        const result = await apiCall(`/interview-settings/statuses?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(statusData),
        });
        
        console.log('🔧 API Service: createStatus result:', result);
        return result;
    },

    updateStatus: async (id, statusData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/statuses/${id}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(statusData),
        });
    },

    deleteStatus: async (id) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/statuses/${id}?user_id=${userId}`, {
            method: 'DELETE',
        });
    },

    // Sub-Status CRUD
    getSubStatuses: async (parentStatusId = null) => {
        const userId = getUserId() || 'test'; // Fallback to test user
        let url = `/interview-settings/sub-statuses?user_id=${userId}`;
        if (parentStatusId) {
            url += `&parent_status_id=${parentStatusId}`;
        }

        return apiCall(url);
    },

    createSubStatus: async (subStatusData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/sub-statuses?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(subStatusData),
        });
    },

    updateSubStatus: async (id, subStatusData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/sub-statuses/${id}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(subStatusData),
        });
    },

    deleteSubStatus: async (id) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/sub-statuses/${id}?user_id=${userId}`, {
            method: 'DELETE',
        });
    },

    // Source/Portal CRUD
    getSourcePortals: async () => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/source-portals?user_id=${userId}`);
    },

    createSourcePortal: async (sourcePortalData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/source-portals?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify(sourcePortalData),
        });
    },

    updateSourcePortal: async (id, sourcePortalData) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/source-portals/${id}?user_id=${userId}`, {
            method: 'PUT',
            body: JSON.stringify(sourcePortalData),
        });
    },

    deleteSourcePortal: async (id) => {
        const userId = getUserId() || 'test'; // Fallback to test user

        return apiCall(`/interview-settings/source-portals/${id}?user_id=${userId}`, {
            method: 'DELETE',
        });
    }
};

// Helper function to get current user ID
function getCurrentUserId() {
    try {
        const userId = localStorage.getItem('userId');
        if (userId) return userId;
        
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return userData.id || userData._id || userData.user_id;
        }
        return null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}

// Helper function to get auth token
function getAuthToken() {
    return localStorage.getItem('token') || '';
}

// Generic HTTP methods for use in services
export const api = {
    get: (endpoint) => apiCall(endpoint, { method: 'GET' }),
    post: (endpoint, data) => apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    put: (endpoint, data) => apiCall(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    patch: (endpoint, data) => apiCall(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
};

// Export default API object
const API = {
    auth: authAPI,
    feeds: feedsAPI,
    leads: leadsAPI,
    users: usersAPI,
    roles: rolesAPI,
    departments: departmentsAPI,
    tickets: ticketsAPI,
    tasks: tasksAPI,
    interviews: interviewsAPI,
};

export default API;
