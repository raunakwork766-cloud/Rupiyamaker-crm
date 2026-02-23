import { api, apiCall } from './api';

// API configuration - ALWAYS use /api (nginx will proxy)
const API_BASE_URL = '/api';

// Request throttling to prevent ERR_INSUFFICIENT_RESOURCES
let activeRequests = new Set();
const MAX_CONCURRENT_REQUESTS = 6;
const REQUEST_DELAY = 100; // ms between requests

// Throttled fetch wrapper
const throttledFetch = async (url, options = {}) => {
    // Wait if too many concurrent requests
    while (activeRequests.size >= MAX_CONCURRENT_REQUESTS) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    }
    
    const requestId = Math.random().toString(36).substr(2, 9);
    activeRequests.add(requestId);
    
    try {
        // Add a small delay between requests to prevent resource exhaustion
        if (activeRequests.size > 3) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        }
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        return response;
    } finally {
        activeRequests.delete(requestId);
    }
};

// Helper function to safely get user ID from localStorage
const getUserId = () => {
    // Try multiple localStorage keys to ensure compatibility
    let userId = localStorage.getItem('userId') || 
                 localStorage.getItem('user_id');
    
    // If not found, try to get from various user objects
    if (!userId) {
        try {
            // Try currentUser object
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            userId = currentUser.id || currentUser._id;
        } catch (e) {
            console.warn('Error parsing currentUser from localStorage:', e);
        }
    }
    
    // Try userData object
    if (!userId) {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            userId = userData.id || userData._id || userData.user_id;
        } catch (e) {
            console.warn('Error parsing userData from localStorage:', e);
        }
    }
    
    // Try userInfo object
    if (!userId) {
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            userId = userInfo.id || userInfo._id || userInfo.user_id;
        } catch (e) {
            console.warn('Error parsing userInfo from localStorage:', e);
        }
    }
    
    // Try authUser object
    if (!userId) {
        try {
            const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
            userId = authUser.id || authUser._id || authUser.user_id;
        } catch (e) {
            console.warn('Error parsing authUser from localStorage:', e);
        }
    }
    
    console.log('🔍 getUserId result:', userId);
    console.log('🔍 Available localStorage keys:', Object.keys(localStorage));
    
    if (!userId) {
        console.error('❌ No user ID found in localStorage');
        console.error('❌ localStorage contents:', {
            userId: localStorage.getItem('userId'),
            user_id: localStorage.getItem('user_id'),
            currentUser: localStorage.getItem('currentUser'),
            userData: localStorage.getItem('userData'),
            userInfo: localStorage.getItem('userInfo'),
            authUser: localStorage.getItem('authUser'),
            allKeys: Object.keys(localStorage)
        });
        throw new Error('User not authenticated - no user ID found');
    }
    return userId;
};

export const hrmsService = {
    // Get all employees - simple wrapper for getEmployees with no filters
    getAllEmployees: async () => {
        return await hrmsService.getEmployees();
    },

    // Fetch all employees with optional filters using the working users endpoint
    getEmployees: async (status = null, departmentId = null) => {
        try {
            const userId = getUserId();

            // Create query params for the users endpoint (which is what AttendancePage uses)
            const params = new URLSearchParams();
            params.append('user_id', userId);

            // Add status filter if provided
            if (status) {
                params.append('status', status);
            }

            // Add department filter if provided
            if (departmentId) {
                params.append('department_id', departmentId);
            }

            // Using the working users endpoint that AttendancePage uses
            const response = await api.get(`/users?${params.toString()}`);

            // Return the response in the expected format
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching employees:', error);
            throw error;
        }
    },

    // Get comprehensive employees with all detailed information
    getComprehensiveEmployees: async (status = null, departmentId = null) => {
        try {
            const userId = getUserId();

            // Create query params for the comprehensive employees endpoint
            const params = new URLSearchParams();
            params.append('user_id', userId);

            // Add status filter if provided
            if (status && status !== 'all') {
                params.append('status', status);
            }

            // Add department filter if provided
            if (departmentId) {
                params.append('department_id', departmentId);
            }

            // Using the comprehensive employees endpoint with correct prefix
            const response = await api.get(`/hrms/employees/comprehensive?${params.toString()}`);

            // Return the response in the expected format
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching comprehensive employees:', error);
            throw error;
        }
    },

    // Get a specific employee by ID using the working users endpoint
    getEmployee: async (employeeId) => {
        const userId = getUserId();
        try {
            const response = await api.get(`/users/${employeeId}?user_id=${userId}`);
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error fetching employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Create a new employee using the working users/employees endpoint with comprehensive data
    createEmployee: async (employeeData) => {
        const userId = getUserId();

        try {
            // Use the working /users/employees endpoint that supports all fields
            const response = await api.post(`/users/employees?user_id=${userId}`, employeeData);
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating employee:', error);
            throw error;
        }
    },

    // Update an existing employee using the working users endpoint with comprehensive data
    updateEmployee: async (employeeId, employeeData) => {
        const userId = getUserId();
        try {
            console.log('🔄 hrmsService: Updating employee:', { employeeId, userId, employeeData });
            // Use the working /users/{id} endpoint for updates
            const response = await api.put(`/users/${employeeId}?user_id=${userId}`, employeeData);
            console.log('✅ hrmsService: Employee updated successfully:', response.data);
            return {
                data: response.data,
                success: true
            };
        } catch (error) {
            console.error(`❌ hrmsService: Error updating employee ${employeeId}:`, error);
            if (error.response) {
                console.error('❌ hrmsService: Error response:', error.response.data);
            }
            throw error;
        }
    },

    // Update employee with dictionary - accepts any fields, updates whatever is in payload
    updateEmployeeDict: async (employeeId, updateData) => {
        const userId = getUserId();
        try {
            console.log('🔄 hrmsService: Updating employee with dict:', { employeeId, userId, updateData });
            // Use the new dictionary update endpoint - updates whatever fields are in payload
            const response = await api.patch(`/hrms/employees/${employeeId}/update-dict?user_id=${userId}`, updateData);
            console.log('✅ hrmsService: Employee updated with dict:', response.data);
            return {
                data: response.data,
                success: true
            };
        } catch (error) {
            console.error(`❌ hrmsService: Error updating employee with dict ${employeeId}:`, error);
            if (error.response) {
                console.error('❌ hrmsService: Error response:', error.response.data);
            }
            throw error;
        }
    },

    // Get a specific employee by ID using the working users endpoint with comprehensive data
    getEmployeeById: async (employeeId) => {
        const userId = getUserId();
        try {
            console.log('🔄 hrmsService: Fetching employee by ID:', { employeeId, userId });
            // Use the working /users/{id} endpoint that returns all fields
            const response = await api.get(`/users/${employeeId}?user_id=${userId}`);
            console.log('✅ hrmsService: Employee fetched successfully:', response.data);
            return {
                data: response.data,
                success: true
            };
        } catch (error) {
            console.error(`❌ hrmsService: Error fetching employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Upload employee profile photo using the working users endpoint
    uploadEmployeePhoto: async (employeeId, photoFile) => {
        const userId = getUserId();

        console.log('uploadEmployeePhoto called with:', { employeeId, photoFile, userId });

        const formData = new FormData();
        formData.append('file', photoFile);

        try {
            // Use the working photo upload endpoint from users API
            const response = await apiCall(`/users/employees/upload-photo/${employeeId}?user_id=${userId}`, {
                method: 'POST',
                body: formData,
                headers: {
                    // Don't set Content-Type here - the browser will set it with the correct boundary
                }
            });

            console.log('Photo upload response:', response);

            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error uploading photo for employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Get employee password (for super admin only)
    getEmployeePassword: async (employeeId) => {
        try {
            const userId = getUserId();
            
            // Use the correct endpoint with requesting_user_id parameter
            const response = await api.get(`/users/${employeeId}/password?requesting_user_id=${userId}`);
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error fetching password for employee ${employeeId}:`, error);
            
            // If backend endpoint doesn't exist yet, provide a fallback for development
            if (error.response?.status === 404 || error.message.includes('404')) {
                console.log('🔧 Backend endpoint not found, using fallback password for development');
                return {
                    data: {
                        password: 'admin123' // Fallback password for development
                    },
                    success: true
                };
            }
            
            throw error;
        }
    },

    // Update employee status (active/inactive) using dedicated HRMS endpoint
    updateEmployeeStatus: async (employeeId, status, remark) => {
        const userId = getUserId();
        try {
            const response = await api.patch(`/hrms/employees/${employeeId}/status?user_id=${userId}`, {
                status,
                remark
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating status for employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Update employee onboarding status using dedicated HRMS endpoint
    updateOnboardingStatus: async (employeeId, status, remark) => {
        const userId = getUserId();
        try {
            const response = await api.patch(`/hrms/employees/${employeeId}/onboarding?user_id=${userId}`, {
                status,
                remark
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating onboarding status for employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Update employee CRM access using dedicated HRMS endpoint
    updateCrmAccess: async (employeeId, hasAccess) => {
        const userId = getUserId();
        try {
            const response = await api.patch(`/hrms/employees/${employeeId}/crm-access?user_id=${userId}`, {
                has_access: hasAccess
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating CRM access for employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Update employee login enabled status using dedicated HRMS endpoint
    updateLoginEnabled: async (employeeId, isEnabled) => {
        const userId = getUserId();
        try {
            const response = await api.patch(`/hrms/employees/${employeeId}/login-enabled?user_id=${userId}`, {
                enabled: isEnabled
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating login enabled for employee ${employeeId}:`, error);
            throw error;
        }
    },



    // Update employee login status (enable/disable) using dedicated HRMS endpoint
    updateLoginStatus: async (employeeId, enabled) => {
        const userId = getUserId();
        try {
            const response = await api.patch(`/hrms/employees/${employeeId}/login?user_id=${userId}`, {
                enabled
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating login status for employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Update employee OTP requirement (enable/disable) using users endpoint
    updateOTPRequired: async (employeeId, otpRequired) => {
        const userId = getUserId();
        try {
            const response = await api.patch(`/users/employees/${employeeId}/otp-required?user_id=${userId}`, {
                otp_required: otpRequired
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating OTP requirement for employee ${employeeId}:`, error);
            throw error;
        }
    },

    // Get departments (for dropdown selection)
    getDepartments: async () => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/departments/?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching departments:', error);
            throw error;
        }
    },

    // Get roles (for dropdown selection)
    getRoles: async () => {
        const userId = getUserId();
        try {
            // Use the specific API endpoint that returns role data directly
            const response = await apiCall(`/roles/?user_id=${userId}`, { method: 'GET' });
            
            // The API returns an array directly, so we wrap it in a data property for consistency
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching roles:', error);
            throw error;
        }
    },

    // Get designations (for dropdown selection)
    getDesignations: async () => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/designations/?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching designations:', error);
            throw error;
        }
    },
    
    // Create a new designation
    createDesignation: async (designationData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/designations?user_id=${userId}`, { 
                method: 'POST',
                body: JSON.stringify(designationData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating designation:', error);
            throw error;
        }
    },
    
    // Update an existing designation
    updateDesignation: async (designationId, designationData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/designations/${designationId}?user_id=${userId}`, { 
                method: 'PUT',
                body: JSON.stringify(designationData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error updating designation ${designationId}:`, error);
            throw error;
        }
    },
    
    // Delete a designation
    deleteDesignation: async (designationId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/designations/${designationId}?user_id=${userId}`, { 
                method: 'DELETE'
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error(`Error deleting designation ${designationId}:`, error);
            throw error;
        }
    },
    
    // Update an existing designation
    updateDesignation: async (designationId, designationData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/designations/${designationId}?user_id=${userId}`, { 
                method: 'PUT',
                body: JSON.stringify(designationData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating designation:', error);
            throw error;
        }
    },
    
    // Delete a designation
    deleteDesignation: async (designationId, hardDelete = false) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/designations/${designationId}?user_id=${userId}&hard_delete=${hardDelete}`, { 
                method: 'DELETE' 
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error deleting designation:', error);
            throw error;
        }
    },

    // Employee Remarks Methods
    getEmployeeRemarks: async (employeeId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/employees/${employeeId}/remarks/?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching employee remarks:', error);
            // Return empty array as fallback
            return { data: [], success: false };
        }
    },

    addEmployeeRemark: async (remarkData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/employees/remarks?user_id=${userId}`, {
                method: 'POST',
                body: JSON.stringify(remarkData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error adding employee remark:', error);
            throw error;
        }
    },

    deleteEmployeeRemark: async (remarkId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/employees/remarks/${remarkId}?user_id=${userId}`, { method: 'DELETE' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error deleting employee remark:', error);
            throw error;
        }
    },

    uploadEmployeeAttachment: async (formData) => {
        const userId = getUserId();
        try {
            formData.append('user_id', userId);
            const response = await api.post('/employees/attachments/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error uploading employee attachment:', error);
            throw error;
        }
    },

    // Employee Remarks Methods
    getEmployeeRemarks: async (employeeId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/remarks?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching employee remarks:', error);
            return { data: [], success: false };
        }
    },

    createEmployeeRemark: async (employeeId, remarkData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/remarks?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(remarkData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating employee remark:', error);
            throw error;
        }
    },

    updateEmployeeRemark: async (employeeId, remarkId, remarkData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/remarks/${remarkId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(remarkData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating employee remark:', error);
            throw error;
        }
    },

    deleteEmployeeRemark: async (employeeId, remarkId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/remarks/${remarkId}?user_id=${userId}`, { method: 'DELETE' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error deleting employee remark:', error);
            throw error;
        }
    },

    // Employee Attachments Methods
    getEmployeeAttachments: async (employeeId) => {
        const userId = getUserId();
        try {
            // Try multiple possible endpoints to get settings attachments for employees
            console.log('🔍 Fetching employee attachments - trying multiple endpoints...');
            
            // Try different target_type variations: employee, Employee, employees, Employees
            const targetTypeVariations = ['employee', 'Employee', 'employees', 'Employees'];
            
            for (const targetType of targetTypeVariations) {
                console.log(`🔍 Trying target_type: "${targetType}"`);
                
                // Try 1: General attachments endpoint with employee target
                try {
                    console.log(`🔍 Trying: /attachments endpoint with target_type=${targetType}...`);
                    const response1 = await apiCall(`/attachments?user_id=${userId}&target_type=${targetType}&target_id=${employeeId}`, { method: 'GET' });
                    if (response1 && (Array.isArray(response1) ? response1.length > 0 : response1)) {
                        console.log(`✅ Success with /attachments endpoint using target_type=${targetType}:`, response1);
                        return {
                            data: response1,
                            success: true
                        };
                    }
                } catch (err1) {
                    console.log(`❌ /attachments endpoint failed with target_type=${targetType}:`, err1.message);
                }

                // Try 2: Settings attachments endpoint
                try {
                    console.log(`🔍 Trying: /settings/attachments endpoint with target_type=${targetType}...`);
                    const response2 = await apiCall(`/settings/attachments?user_id=${userId}&target_type=${targetType}&target_id=${employeeId}`, { method: 'GET' });
                    if (response2 && (Array.isArray(response2) ? response2.length > 0 : response2)) {
                        console.log(`✅ Success with /settings/attachments endpoint using target_type=${targetType}:`, response2);
                        return {
                            data: response2,
                            success: true
                        };
                    }
                } catch (err2) {
                    console.log(`❌ /settings/attachments endpoint failed with target_type=${targetType}:`, err2.message);
                }

                // Try 3: HRMS settings attachments
                try {
                    console.log(`🔍 Trying: /hrms/settings/attachments endpoint with target_type=${targetType}...`);
                    const response3 = await apiCall(`/hrms/settings/attachments?user_id=${userId}&target_type=${targetType}&target_id=${employeeId}`, { method: 'GET' });
                    if (response3 && (Array.isArray(response3) ? response3.length > 0 : response3)) {
                        console.log(`✅ Success with /hrms/settings/attachments endpoint using target_type=${targetType}:`, response3);
                        return {
                            data: response3,
                            success: true
                        };
                    }
                } catch (err3) {
                    console.log(`❌ /hrms/settings/attachments endpoint failed with target_type=${targetType}:`, err3.message);
                }
            }

            // Try 4: Original HRMS employee attachments as fallback (without target_type filter)
            try {
                console.log('🔍 Trying: Original HRMS employee attachments endpoint...');
                const response4 = await apiCall(`/hrms/employees/${employeeId}/attachments?user_id=${userId}`, { method: 'GET' });
                console.log('✅ Success with HRMS employee attachments endpoint:', response4);
                return {
                    data: response4,
                    success: true
                };
            } catch (err4) {
                console.log('❌ HRMS employee attachments endpoint failed:', err4.message);
            }

            console.error('❌ All attachment endpoints failed');
            return { data: [], success: false };

        } catch (error) {
            console.error('❌ Error in getEmployeeAttachments:', error);
            return { data: [], success: false };
        }
    },

    uploadEmployeeAttachment: async (employeeId, file, attachmentType, description = '', isPasswordProtected = false, password = '') => {
        const userId = getUserId();
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('attachment_type', attachmentType);
            formData.append('description', description);
            
            // Add password protection if specified
            if (isPasswordProtected && password) {
                formData.append('is_password_protected', 'true');
                formData.append('password', password);
            } else {
                formData.append('is_password_protected', 'false');
            }

            console.log('📤 Uploading file:', {
                employeeId,
                fileName: file.name,
                fileSize: file.size,
                attachmentType,
                description,
                isPasswordProtected
            });

            // Don't set Content-Type header - let browser set it automatically with boundary
            const response = await apiCall(`/hrms/employees/${employeeId}/attachments?user_id=${userId}`, {
                method: 'POST',
                body: formData,
                headers: {
                    // Let browser set multipart/form-data with boundary
                }
            });
            
            console.log('✅ Upload successful:', response);
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error uploading employee attachment:', error);
            throw error;
        }
    },

    downloadEmployeeAttachment: async (employeeId, attachmentId) => {
        const userId = getUserId();
        try {
            // Use direct fetch for blob downloads instead of apiCall wrapper
            const user = JSON.parse(localStorage.getItem('userData') || '{}');
            const url = `${API_BASE_URL}/hrms/employees/${employeeId}/attachments/${attachmentId}/download?user_id=${userId}`;
            
            console.log('🔽 Direct fetch for download:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${user.token || ''}`,
                    'Accept': 'application/octet-stream, */*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }
            
            // Return the blob directly
            const blob = await response.blob();
            console.log('🔽 Blob downloaded successfully:', { size: blob.size, type: blob.type });
            
            return {
                data: blob,
                success: true
            };
        } catch (error) {
            console.error('Error downloading employee attachment:', error);
            throw error;
        }
    },

    deleteEmployeeAttachment: async (employeeId, attachmentId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/attachments/${attachmentId}?user_id=${userId}`, { method: 'DELETE' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error deleting employee attachment:', error);
            throw error;
        }
    },

    bulkDownloadEmployeeAttachments: async (employeeId) => {
        const userId = getUserId();
        console.log('🔽 hrmsService: Starting bulk download for employee:', employeeId, 'user:', userId);
        
        try {
            // Use direct fetch for blob downloads instead of apiCall wrapper
            const user = JSON.parse(localStorage.getItem('userData') || '{}');
            const url = `${API_BASE_URL}/hrms/employees/${employeeId}/attachments/bulk-download?user_id=${userId}`;
            console.log('🔽 hrmsService: Making request to:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${user.token || ''}`,
                    'Accept': 'application/zip, application/octet-stream, */*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Bulk download failed: ${response.status} ${response.statusText}`);
            }
            
            // Return the blob directly
            const blob = await response.blob();
            console.log('🔽 hrmsService: Bulk download blob received:', { size: blob.size, type: blob.type });
            
            return {
                data: blob,
                success: true
            };
        } catch (error) {
            console.error('🔽 hrmsService: Error bulk downloading employee attachments:', error);
            throw error;
        }
    },

    // Employee Activities Methods
    getEmployeeActivities: async (employeeId, limit = 50, offset = 0, activityType = null) => {
        const userId = getUserId();
        try {
            const params = new URLSearchParams();
            params.append('user_id', userId);
            params.append('limit', limit);
            params.append('offset', offset);
            
            if (activityType) {
                params.append('activity_type', activityType);
            }
            
            const response = await apiCall(`/hrms/employees/${employeeId}/activities?${params.toString()}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching employee activities:', error);
            return { data: [], success: false };
        }
    },

    getEmployeeActivitySummary: async (employeeId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/activities/summary?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching employee activity summary:', error);
            return { data: null, success: false };
        }
    },

    // Settings Methods
    getAttachmentTypes: async (targetType = 'employees') => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/settings/attachment-types?user_id=${userId}&target_type=${targetType}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching attachment types:', error);
            return { data: [], success: false };
        }
    },

    // Get attachment types specifically for employees
    getEmployeeAttachmentTypes: async () => {
        const userId = getUserId();
        try {
            // Try different target_type variations for employees
            const targetTypeVariations = ['employees', 'Employees', 'employee', 'Employee'];
            
            for (const targetType of targetTypeVariations) {
                try {
                    console.log(`🔍 Trying attachment types with target_type=${targetType}...`);
                    const response = await apiCall(`/settings/attachment-types?user_id=${userId}&target_type=${targetType}&is_active=true`, { method: 'GET' });
                    if (response && (Array.isArray(response) ? response.length > 0 : response)) {
                        console.log(`✅ Success getting attachment types with target_type=${targetType}:`, response);
                        return {
                            data: response,
                            success: true
                        };
                    }
                } catch (err) {
                    console.log(`❌ Failed getting attachment types with target_type=${targetType}:`, err.message);
                }
            }
            
            // Fallback: Try to get all attachment types and filter on frontend
            try {
                console.log('🔍 Fallback: Trying to get all attachment types and filter...');
                const response = await apiCall(`/settings/attachment-types?user_id=${userId}&is_active=true`, { method: 'GET' });
                if (response && Array.isArray(response)) {
                    // Filter for employee-related types
                    const employeeTypes = response.filter(type => {
                        const targetType = type.target_type || '';
                        return targetTypeVariations.some(variation => 
                            targetType.toLowerCase().includes(variation.toLowerCase())
                        );
                    });
                    
                    if (employeeTypes.length > 0) {
                        console.log('✅ Success filtering attachment types for employees:', employeeTypes);
                        return {
                            data: employeeTypes,
                            success: true
                        };
                    }
                }
            } catch (err) {
                console.log('❌ Failed getting all attachment types:', err.message);
            }
            
            console.warn('⚠️ No attachment types found for any employee target_type variation');
            return { data: [], success: false };
        } catch (error) {
            console.error('Error fetching employee attachment types:', error);
            return { data: [], success: false };
        }
    },

    // Get attachment types specifically for leads
    getLeadAttachmentTypes: async () => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/settings/attachment-types?user_id=${userId}&target_type=leads&is_active=true`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching lead attachment types:', error);
            return { data: [], success: false };
        }
    },

    getAllAttachmentTypes: async (targetType = null) => {
        const userId = getUserId();
        try {
            const params = new URLSearchParams();
            params.append('user_id', userId);
            if (targetType) {
                params.append('target_type', targetType);
            }
            
            console.log(`🔍 Fetching attachment types with params:`, params.toString());
            const response = await apiCall(`/settings/attachment-types?${params.toString()}`, { method: 'GET' });
            console.log(`📄 Attachment types response:`, response);
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching all attachment types:', error);
            return { data: [], success: false };
        }
    },

    createAttachmentType: async (attachmentTypeData) => {
        const userId = getUserId();
        try {
            console.log(`📝 Creating attachment type:`, attachmentTypeData);
            const response = await apiCall(`/settings/attachment-types?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(attachmentTypeData)
            });
            console.log(`✅ Attachment type created successfully:`, response);
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating attachment type:', error);
            throw error;
        }
    },

    updateAttachmentType: async (attachmentTypeId, attachmentTypeData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/settings/attachment-types/${attachmentTypeId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(attachmentTypeData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating attachment type:', error);
            throw error;
        }
    },

    deleteAttachmentType: async (attachmentTypeId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/settings/attachment-types/${attachmentTypeId}?user_id=${userId}`, {
                method: 'DELETE'
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error deleting attachment type:', error);
            throw error;
        }
    },

    getAttachmentType: async (attachmentTypeId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/settings/attachment-types/${attachmentTypeId}?user_id=${userId}`, { method: 'GET' });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching attachment type:', error);
            throw error;
        }
    },

    // Enhanced Employee Management Methods
    createComprehensiveEmployee: async (employeeData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/create-with-all-details?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(employeeData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating comprehensive employee:', error);
            throw error;
        }
    },

    // Create comprehensive employee with multipart form data (includes photo upload)
    createComprehensiveEmployeeWithPhoto: async (employeeData, photoFile) => {
        const userId = getUserId();
        try {
            console.log('🔍 Creating comprehensive employee with photo:', { employeeData, photoFile });

            // Create FormData for multipart/form-data request
            const formData = new FormData();
            
            // Add all employee data fields to FormData
            Object.keys(employeeData).forEach(key => {
                if (employeeData[key] !== undefined && employeeData[key] !== null && employeeData[key] !== '') {
                    // Handle field name mapping between frontend and backend
                    let backendFieldName = key;
                    
                    // Map frontend field names to backend field names
                    if (key === 'dob') {
                        backendFieldName = 'dob'; // Backend expects dob
                    } else if (key === 'date_of_birth') {
                        backendFieldName = 'dob'; // Frontend sends date_of_birth, backend expects dob
                    }
                    
                    // Handle nested objects
                    if (typeof employeeData[key] === 'object' && !Array.isArray(employeeData[key])) {
                        formData.append(backendFieldName, JSON.stringify(employeeData[key]));
                    } else {
                        formData.append(backendFieldName, employeeData[key]);
                    }
                }
            });

            // Add photo file if provided
            if (photoFile) {
                formData.append('profile_photo', photoFile);
            }

            // Log FormData contents for debugging
            console.log('📝 FormData contents:');
            for (let [key, value] of formData.entries()) {
                console.log(`  ${key}:`, value);
            }

            const response = await apiCall(`/hrms/employees/create-with-all-details?user_id=${userId}`, {
                method: 'POST',
                body: formData,
                headers: {
                    // Don't set Content-Type, let browser set it with boundary for multipart/form-data
                }
            });

            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error creating comprehensive employee with photo:', error);
            throw error;
        }
    },

    updateComprehensiveEmployee: async (employeeId, employeeData) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/comprehensive?user_id=${userId}`, {
                method: 'PUT',
                body: JSON.stringify(employeeData)
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error updating comprehensive employee:', error);
            throw error;
        }
    },

    // Password Management Methods
    changeEmployeePassword: async (employeeId, passwordData) => {
        const userId = getUserId();
        console.log('🔐 Changing password for employee:', employeeId);
        console.log('🔐 Password data:', { ...passwordData, old_password: '[HIDDEN]', new_password: '[HIDDEN]' });
        
        // Try using the working updateEmployeeDict method first
        try {
            console.log('🔐 Attempting password change via updateEmployeeDict method');
            const updateData = {
                password: passwordData.new_password,
                old_password: passwordData.old_password
            };
            
            const response = await hrmsService.updateEmployeeDict(employeeId, updateData);
            console.log('🔐 Password change via updateEmployeeDict successful:', response);
            return {
                data: response,
                success: true
            };
        } catch (dictError) {
            console.warn('🔐 UpdateEmployeeDict method failed:', dictError.message);
            
            // Fallback to direct password endpoint
            try {
                const response = await apiCall(`/users/${employeeId}/password?user_id=${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(passwordData)
                });
                console.log('🔐 Password change response:', response);
                return {
                    data: response,
                    success: true
                };
            } catch (error) {
                console.error('Error changing employee password:', error);
                console.error('Error details:', error.message);
                console.error('Error response:', error.response);
                
                // If the password change endpoint doesn't work, try alternative approach
                if (error.response?.status === 500 || error.response?.status === 404) {
                    console.log('🔄 Primary password endpoint failed, trying alternative approach...');
                    
                    try {
                        // Alternative: try using the employee update endpoint
                        const updateResponse = await apiCall(`/users/${employeeId}?user_id=${userId}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                password: passwordData.new_password
                            })
                        });
                        
                        console.log('🔐 Alternative password update response:', updateResponse);
                        return {
                            data: updateResponse,
                            success: true
                        };
                    } catch (altError) {
                        console.error('Alternative password update also failed:', altError);
                        throw new Error('Failed to update password. All methods failed.');
                    }
                }
                
                throw error;
            }
        }
    },

    resetEmployeePassword: async (employeeId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/${employeeId}/reset-password?user_id=${userId}`, {
                method: 'POST'
            });
            return response;
        } catch (error) {
            console.error('Error resetting employee password:', error);
            throw error;
        }
    },

    // Delete employee
    deleteEmployee: async (employeeId) => {
        const userId = getUserId();
        try {
            console.log('🗑️ hrmsService: Deleting employee:', { employeeId, userId });
            
            // Try multiple endpoints to see which one works
            let response;
            try {
                // First try the users endpoint
                response = await api.delete(`/users/${employeeId}?user_id=${userId}`);
                console.log('✅ hrmsService: Employee deleted via /users endpoint:', response.data);
            } catch (error) {
                console.log('❌ /users endpoint failed, trying /hrms/employees endpoint:', error.message);
                // If that fails, try the hrms endpoint
                response = await api.delete(`/hrms/employees/${employeeId}?user_id=${userId}`);
                console.log('✅ hrmsService: Employee deleted via /hrms/employees endpoint:', response.data);
            }
            
            return {
                data: response.data,
                success: true
            };
        } catch (error) {
            console.error(`❌ hrmsService: Error deleting employee ${employeeId}:`, error);
            console.error(`❌ hrmsService: Error status:`, error.response?.status);
            console.error(`❌ hrmsService: Error data:`, error.response?.data);
            throw error;
        }
    },

    // Employee Lookup Methods
    getEmployeeByEmployeeId: async (empId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/search/by-employee-id/${empId}?user_id=${userId}`, {
                method: 'GET'
            });
            return {
                data: response,
                success: true
            };
        } catch (error) {
            console.error('Error fetching employee by employee ID:', error);
            throw error;
        }
    },

    validateEmployeeId: async (empId) => {
        const userId = getUserId();
        try {
            const response = await apiCall(`/hrms/employees/validate/employee-id/${empId}?user_id=${userId}`, {
                method: 'GET'
            });
            return response;
        } catch (error) {
            console.error('Error validating employee ID:', error);
            throw error;
        }
    },

    // Postal Code Lookup using Public APIs
    lookupPincode: async (pincode) => {
        if (!pincode || pincode.length !== 6) {
            throw new Error('Invalid pincode format');
        }

        try {
            // Try primary API first (postalpincode.in)
            console.log(`🔍 Looking up pincode ${pincode} using primary API...`);
            const primaryResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            
            if (primaryResponse.ok) {
                const primaryData = await primaryResponse.json();
                console.log('📍 Primary API response:', primaryData);
                
                if (primaryData && primaryData[0] && primaryData[0].Status === 'Success' && primaryData[0].PostOffice) {
                    const postOffice = primaryData[0].PostOffice[0];
                    return {
                        success: true,
                        pincode: pincode,
                        city: postOffice.District || postOffice.Name,
                        state: postOffice.State,
                        country: postOffice.Country || 'India',
                        area: postOffice.Name,
                        district: postOffice.District,
                        division: postOffice.Division,
                        region: postOffice.Region,
                        source: 'postalpincode.in'
                    };
                }
            }
            
            // Fallback to secondary API (zippopotam.us)
            console.log(`🔄 Trying fallback API for pincode ${pincode}...`);
            const fallbackResponse = await fetch(`https://api.zippopotam.us/in/${pincode}`);
            
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('📍 Fallback API response:', fallbackData);
                
                if (fallbackData && fallbackData.places && fallbackData.places[0]) {
                    const place = fallbackData.places[0];
                    return {
                        success: true,
                        pincode: pincode,
                        city: place['place name'],
                        state: place.state,
                        country: fallbackData.country || 'India',
                        area: place['place name'],
                        district: place['place name'],
                        source: 'zippopotam.us'
                    };
                }
            }
            
            // If both APIs fail
            throw new Error(`Pincode ${pincode} not found in any postal service`);
            
        } catch (error) {
            console.error('Error looking up pincode:', error);
            
            // Return a more descriptive error
            if (error.message.includes('fetch')) {
                throw new Error('Network error while fetching postal data. Please check your internet connection.');
            } else if (error.message.includes('not found')) {
                throw new Error(`Pincode ${pincode} not found. Please verify the pincode.`);
            } else {
                throw new Error(`Error fetching pincode data: ${error.message}`);
            }
        }
    },

    // Bulk update functions for master toggles
    async bulkUpdateUserStatus(targetStatus) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }
        
        console.log(`🔄 Bulk updating user status to: ${targetStatus}`);
        try {
            const response = await apiCall(`/users/bulk-update-status?target_status=${targetStatus}&user_id=${userId}`, {
                method: 'POST'
            });
            
            // Backend returns: { message, modified_count, target_status, status }
            return {
                success: response.status === 'success',
                data: response,
                message: response.message
            };
        } catch (error) {
            console.error('Bulk update user status error:', error);
            throw error;
        }
    },

    async bulkUpdateLoginAccess(targetLoginEnabled) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }
        
        console.log(`🔄 Bulk updating login access to: ${targetLoginEnabled}`);
        try {
            const response = await apiCall(`/users/bulk-update-login?target_login_enabled=${targetLoginEnabled}&user_id=${userId}`, {
                method: 'POST'
            });
            
            // Backend returns: { message, modified_count, target_login_enabled, status }
            return {
                success: response.status === 'success',
                data: response,
                message: response.message
            };
        } catch (error) {
            console.error('Bulk update login access error:', error);
            throw error;
        }
    },

    async bulkUpdateOTPRequirement(targetOtpRequired) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }
        
        console.log(`🔄 Bulk updating OTP requirement to: ${targetOtpRequired}`);
        try {
            const response = await apiCall(`/users/bulk-update-otp?target_otp_required=${targetOtpRequired}&user_id=${userId}`, {
                method: 'POST'
            });
            
            // Backend returns: { message, modified_count, target_otp_required, status }
            return {
                success: response.status === 'success',
                data: response,
                message: response.message
            };
        } catch (error) {
            console.error('Bulk update OTP requirement error:', error);
            throw error;
        }
    },

    // Employee Activity Functions
    async getEmployeeActivities(employeeId) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }
        
        const endpoint = `/hrms/employees/${employeeId}/activities?user_id=${userId}&limit=100&offset=0`;
        
        try {
            const response = await apiCall(endpoint, {
                method: 'GET'
            });
            
            return {
                success: true,
                data: response
            };
        } catch (error) {
            console.error('Error fetching employee activities:', error);
            return {
                success: false,
                data: [],
                error: error.message
            };
        }
    },

    async logEmployeeActivity(employeeId, activityData) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }
        
        try {
            // Prepare activity data with proper structure
            const payload = {
                employee_id: employeeId,
                activity_type: activityData.action || 'profile_updated',
                description: activityData.description || 'Employee data updated',
                details: activityData.details || {},
                timestamp: activityData.timestamp || new Date().toISOString(),
                performed_by: userId,
                created_by: userId
            };

            const endpoint = `${API_BASE_URL}/hrms/employees/${employeeId}/activities?user_id=${userId}`;

            const response = await throttledFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            return {
                success: true,
                data: response
            };
        } catch (error) {
            console.error('Error logging employee activity:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

export default hrmsService;
