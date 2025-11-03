import { api } from '../services/api';

// Helper function to get user ID
const getUserId = () => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData.user_id || userData.id;
};

// Employee Remarks API
export const getEmployeeRemarks = async (employeeId) => {
    try {
        const userId = getUserId();
        const response = await api.get(`/employees/${employeeId}/remarks?user_id=${userId}`);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching employee remarks:', error);
        return [];
    }
};

export const addEmployeeRemark = async (employeeId, remarkData) => {
    try {
        const userId = getUserId();
        const response = await api.post(`/employees/${employeeId}/remarks`, {
            ...remarkData,
            user_id: userId
        });
        return response.data;
    } catch (error) {
        console.error('Error adding employee remark:', error);
        throw error;
    }
};

export const updateEmployeeRemark = async (employeeId, remarkId, remarkData) => {
    try {
        const userId = getUserId();
        const response = await api.put(`/employees/${employeeId}/remarks/${remarkId}`, {
            ...remarkData,
            user_id: userId
        });
        return response.data;
    } catch (error) {
        console.error('Error updating employee remark:', error);
        throw error;
    }
};

export const deleteEmployeeRemark = async (employeeId, remarkId) => {
    try {
        const userId = getUserId();
        const response = await api.delete(`/employees/${employeeId}/remarks/${remarkId}?user_id=${userId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting employee remark:', error);
        throw error;
    }
};

// Employee Activities API
export const getEmployeeActivities = async (employeeId) => {
    try {
        const userId = getUserId();
        const response = await api.get(`/employees/${employeeId}/activities?user_id=${userId}`);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching employee activities:', error);
        return [];
    }
};

// Employee Attachments API
export const getEmployeeAttachments = async (employeeId) => {
    try {
        const userId = getUserId();
        const response = await api.get(`/employees/${employeeId}/attachments?user_id=${userId}`);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching employee attachments:', error);
        return [];
    }
};

export const uploadEmployeeAttachment = async (employeeId, formData) => {
    try {
        const userId = getUserId();
        formData.append('user_id', userId);
        const response = await api.post(`/employees/${employeeId}/attachments`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading employee attachment:', error);
        throw error;
    }
};

export const downloadEmployeeAttachment = async (employeeId, attachmentId) => {
    try {
        const userId = getUserId();
        const response = await api.get(`/employees/${employeeId}/attachments/${attachmentId}/download?user_id=${userId}`, {
            responseType: 'blob',
        });
        return response;
    } catch (error) {
        console.error('Error downloading employee attachment:', error);
        throw error;
    }
};

export const deleteEmployeeAttachment = async (employeeId, attachmentId) => {
    try {
        const userId = getUserId();
        const response = await api.delete(`/employees/${employeeId}/attachments/${attachmentId}?user_id=${userId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting employee attachment:', error);
        throw error;
    }
};

// Attachment Types API
export const getAttachmentTypes = async () => {
    try {
        const userId = getUserId();
        const response = await api.get(`/attachment-types?user_id=${userId}`);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching attachment types:', error);
        return [
            { id: 'resume', name: 'Resume' },
            { id: 'id_proof', name: 'ID Proof' },
            { id: 'address_proof', name: 'Address Proof' },
            { id: 'education', name: 'Education Certificate' },
            { id: 'experience', name: 'Experience Letter' },
            { id: 'photo', name: 'Photo' },
            { id: 'other', name: 'Other' }
        ];
    }
};
