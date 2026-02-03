import { api, apiCall } from './api';

// Helper function to safely get user ID from localStorage
const getUserId = () => {
    // Try multiple localStorage keys to ensure compatibility
    const userId = localStorage.getItem('userId') || 
                   localStorage.getItem('user_id') || 
                   (() => {
                       try {
                           const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                           return userData.user_id;
                       } catch {
                           return null;
                       }
                   })();
    
    if (!userId) {
        throw new Error('User not authenticated');
    }
    return userId;
};

export const leadsService = {
    // Get all leads with optional filters
    getAllLeads: async (filters = {}) => {
        const userId = getUserId();
        try {
            // Build query parameters
            const params = new URLSearchParams();
            params.append('user_id', userId);
            
            // Add filters if provided
            if (filters.status) params.append('status', filters.status);
            if (filters.department_id) params.append('department_id', filters.department_id);
            if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
            if (filters.loan_type_id) params.append('loan_type_id', filters.loan_type_id);
            if (filters.priority) params.append('priority', filters.priority);
            if (filters.date_from) params.append('date_from', filters.date_from);
            if (filters.date_to) params.append('date_to', filters.date_to);
            
            const response = await apiCall(`/leads?${params.toString()}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching all leads:', error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Get a specific lead by ID
    getLead: async (leadId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching lead:', error);
            throw error;
        }
    },

    // Get lead by ID (alias for getLead - used by Reports component)
    getLeadById: async (leadId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching lead by ID:', error);
            return { data: null, success: false, error: error.message };
        }
    },

    // Create a new lead
    createLead: async (leadData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads?user_id=${userId}`, {
                method: 'POST',
                data: leadData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating lead:', error);
            throw error;
        }
    },

    // Update an existing lead
    updateLead: async (leadId, leadData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}?user_id=${userId}`, {
                method: 'PUT',
                data: leadData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating lead:', error);
            throw error;
        }
    },

    // Delete a lead
    deleteLead: async (leadId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}?user_id=${userId}`, { method: 'DELETE' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error deleting lead:', error);
            throw error;
        }
    },

    // Get loan types
    getLoanTypes: async () => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/loan-types?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching loan types:', error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Get lead statistics
    getLeadStatistics: async (filters = {}) => {
        const userId = getUserId();
        try {
            const params = new URLSearchParams();
            params.append('user_id', userId);
            
            // Add filter parameters
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params.append(key, filters[key]);
                }
            });
            
            const response = await apiCall(`/leads/statistics?${params.toString()}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching lead statistics:', error);
            return { data: {}, success: false, error: error.message };
        }
    },

    // Reassign lead to different user/department
    reassignLead: async (leadId, assignData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/reassign?user_id=${userId}`, {
                method: 'POST',
                data: assignData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error reassigning lead:', error);
            throw error;
        }
    },

    // Update lead status
    updateLeadStatus: async (leadId, statusData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/status?user_id=${userId}`, {
                method: 'PATCH',
                data: statusData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating lead status:', error);
            throw error;
        }
    },

    // Send lead to login department
    sendToLoginDepartment: async (leadId, loginData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/send-to-login?user_id=${userId}`, {
                method: 'POST',
                data: loginData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error sending to login department:', error);
            throw error;
        }
    },

    // Update operations data
    updateOperationsData: async (leadId, operationsData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/operations?user_id=${userId}`, {
                method: 'PATCH',
                data: operationsData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating operations data:', error);
            throw error;
        }
    },

    // Get lead comments/remarks
    getLeadComments: async (leadId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/comments?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching lead comments:', error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Add comment to lead
    addLeadComment: async (leadId, commentData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/comments?user_id=${userId}`, {
                method: 'POST',
                data: commentData
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error adding lead comment:', error);
            throw error;
        }
    },

    // Get lead attachments
    getLeadAttachments: async (leadId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/attachments?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching lead attachments:', error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Upload lead attachment
    uploadLeadAttachment: async (leadId, formData) => {
        const userId = getUserId();
        try {
            formData.append('user_id', userId);
            const response = await api.post(`/leads/${leadId}/attachments`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error uploading lead attachment:', error);
            throw error;
        }
    },

    // Search leads
    searchLeads: async (searchQuery, filters = {}) => {
        const userId = getUserId();
        try {
            const params = new URLSearchParams();
            params.append('user_id', userId);
            params.append('search', searchQuery);
            
            // Add filter parameters
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params.append(key, filters[key]);
                }
            });
            
            const response = await apiCall(`/leads/search?${params.toString()}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error searching leads:', error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Bulk operations
    bulkUpdateLeads: async (leadIds, updateData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/bulk-update?user_id=${userId}`, {
                method: 'POST',
                data: {
                    lead_ids: leadIds,
                    update_data: updateData
                }
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error bulk updating leads:', error);
            throw error;
        }
    },

    // Get lead assignment history
    getLeadAssignmentHistory: async (leadId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/${leadId}/assignment-history?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching assignment history:', error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Get statuses and sub-statuses for a specific department
    getStatusesForDepartment: async (department) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/statuses/${department}?user_id=${userId}`, { 
                method: 'GET' 
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error fetching statuses for department ${department}:`, error);
            return { data: [], success: false, error: error.message };
        }
    },

    // Get all admin statuses (same as LeadCRM uses)
    getAdminStatuses: async () => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/leads/admin/statuses?user_id=${userId}`, { 
                method: 'GET' 
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching admin statuses:', error);
            return { data: [], success: false, error: error.message };
        }
    }
};

export default leadsService;
