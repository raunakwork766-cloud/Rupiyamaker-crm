import React, { useState } from 'react';
import { Modal, Button, Table, Badge, message, Input, Space, Tooltip } from 'antd';
import { ExclamationCircleOutlined, UserOutlined, PhoneOutlined, EnvironmentOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';
import API from '../services/api';

const { TextArea } = Input;

const DuplicateInterviewModal = ({ 
    visible, 
    onClose, 
    duplicateInterviews, 
    phoneNumber, 
    onProceed,
    onCloseCreateModal
}) => {
    const [reassignmentVisible, setReassignmentVisible] = useState(false);
    const [selectedInterview, setSelectedInterview] = useState(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Get current user info from localStorage
    const getCurrentUser = () => {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    };
    
    const getCurrentUserId = () => {
        const user = getCurrentUser();
        return user?.user_id || null;
    };
    
    const getCurrentUserName = () => {
        const user = getCurrentUser();
        if (!user) return 'Unknown User';
        
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

    const getStatusColor = (status) => {
        const statusColors = {
            'new_interview': '#108ee9',
            'scheduled': '#87d068',
            'completed': '#2db7f5',
            'selected': '#52c41a',
            'rejected': '#f50',
            'no_show': '#fa8c16',
            'rescheduled': '#722ed1',
            'on_hold': '#faad14',
            'cancelled': '#ff4d4f'
        };
        return statusColors[status] || '#d9d9d9';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        try {
            return new Date(dateString).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return 'Invalid date';
        }
    };

    const handleRequestReassignment = async (interview) => {
        setSelectedInterview(interview);
        setReason('');
        setReassignmentVisible(true);
    };

    const handleSubmitReassignment = async () => {
        const currentUserId = getCurrentUserId();
        
        if (!currentUserId || !reason.trim()) {
            message.error('Please provide a reason for reassignment');
            return;
        }

        setLoading(true);
        try {
            const response = await API.interviews.requestReassignment(
                selectedInterview._id || selectedInterview.id,
                currentUserId, // Always reassign to current user
                reason
            );

            if (response.success) {
                message.success('Reassignment request submitted successfully. Awaiting admin approval.');
                setReassignmentVisible(false);
                setReason('');
                setSelectedInterview(null);
                // Close the main duplicate modal as well
                onClose();
                // Also close the create interview modal
                if (onCloseCreateModal) {
                    onCloseCreateModal();
                }
            } else {
                message.error(response.message || 'Failed to submit reassignment request');
            }
        } catch (error) {
            console.error('Error requesting reassignment:', error);
            message.error('Failed to submit reassignment request');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '#',
            dataIndex: 'index',
            key: 'index',
            width: 50,
            render: (_, __, index) => index + 1,
        },
        {
            title: 'Candidate Details',
            key: 'candidate',
            render: (_, record) => (
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                        {record.candidate_name}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                        <PhoneOutlined style={{ marginRight: 6 }} />
                        <span style={{ fontWeight: record.mobile_number === phoneNumber ? 'bold' : 'normal' }}>
                            Mobile: {record.mobile_number}
                        </span>
                        {record.alternate_number && (
                            <span style={{ 
                                marginLeft: 8, 
                                fontWeight: record.alternate_number === phoneNumber ? 'bold' : 'normal' 
                            }}>
                                Alt: {record.alternate_number}
                            </span>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'Location & Job',
            key: 'location',
            render: (_, record) => (
                <div>
                    <div style={{ marginBottom: 4 }}>
                        <EnvironmentOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                        {record.city}, {record.state}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                        <TeamOutlined style={{ marginRight: 6 }} />
                        {record.job_opening}
                    </div>
                </div>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Badge 
                    color={getStatusColor(status)} 
                    text={status?.replace(/_/g, ' ').toUpperCase() || 'Unknown'}
                />
            ),
        },
        {
            title: 'Interview Date',
            key: 'interview_date',
            render: (_, record) => (
                <div style={{ textAlign: 'center' }}>
                    <CalendarOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
                    {formatDate(record.interview_date)}
                </div>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space direction="vertical" size="small">
                    <Tooltip title="Request reassignment to another user">
                        <Button 
                            size="small" 
                            type="primary" 
                            ghost
                            onClick={() => handleRequestReassignment(record)}
                        >
                            Request Reassignment
                        </Button>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <>
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ExclamationCircleOutlined style={{ color: '#fa8c16', marginRight: 8, fontSize: '20px' }} />
                        <span>Duplicate Phone Number Detected</span>
                    </div>
                }
                visible={visible}
                onCancel={onClose}
                width={1000}
                footer={[
                    <Button key="cancel" onClick={onClose}>
                        Cancel Creation
                    </Button>,
                    <Button key="proceed" type="primary" danger onClick={onProceed}>
                        Proceed Anyway
                    </Button>
                ]}
            >
                <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                        The phone number <strong>{phoneNumber}</strong> already exists in the following interview(s):
                    </p>
                </div>

                <Table
                    columns={columns}
                    dataSource={duplicateInterviews?.map((interview, index) => ({ ...interview, key: interview.id || index }))}
                    pagination={false}
                    size="middle"
                    scroll={{ x: 800 }}
                    style={{ marginBottom: 16 }}
                />

                <div style={{ 
                    background: '#fff7e6', 
                    border: '1px solid #ffd591', 
                    borderRadius: '6px', 
                    padding: '12px',
                    marginTop: 16
                }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#d46b08' }}>
                        <strong>Note:</strong> You can proceed with creating a new interview or request reassignment of existing interviews. 
                        Reassignment requests require super admin approval.
                    </p>
                </div>
            </Modal>

            {/* Reassignment Request Modal */}
            <Modal
                title="Request Interview Reassignment"
                visible={reassignmentVisible}
                onCancel={() => {
                    setReassignmentVisible(false);
                    setReason('');
                    setSelectedInterview(null);
                }}
                onOk={handleSubmitReassignment}
                confirmLoading={loading}
                okText="Submit Request"
                cancelText="Cancel"
            >
                {selectedInterview && (
                    <div style={{ marginBottom: 16 }}>
                        <h4>Interview Details:</h4>
                        <p><strong>Candidate:</strong> {selectedInterview.candidate_name}</p>
                        <p><strong>Phone:</strong> {selectedInterview.mobile_number}</p>
                        <p><strong>Status:</strong> {selectedInterview.status}</p>
                    </div>
                )}

                <div style={{ 
                    background: '#e6f7ff', 
                    border: '1px solid #91d5ff', 
                    borderRadius: '6px', 
                    padding: '12px',
                    marginBottom: 16
                }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#096dd9' }}>
                        <strong>Note:</strong> This interview will be reassigned to you after admin approval.
                    </p>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        Reason for Reassignment: *
                    </label>
                    <TextArea
                        rows={4}
                        placeholder="Please provide a detailed reason for requesting this reassignment..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={500}
                        showCount
                    />
                </div>
            </Modal>
        </>
    );
};

export default DuplicateInterviewModal;
