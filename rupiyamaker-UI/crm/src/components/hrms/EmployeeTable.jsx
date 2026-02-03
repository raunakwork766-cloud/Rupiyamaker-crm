import React from 'react';
import {
    Table,
    Badge,
    Button,
    Dropdown,
    Menu,
    Space,
    Avatar,
    Tooltip,
    Typography,
    Tag
} from 'antd';
import {
    MoreOutlined,
    EditOutlined,
    UserOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    KeyOutlined
} from '@ant-design/icons';
import { hasPermission, getUserPermissions } from '../../utils/permissions';
import { formatDate } from '../../utils/dateUtils'; // You may need to create this utility
import { getProfilePictureUrlWithCacheBusting } from '../../utils/mediaUtils';
import './EmployeeTable.css'; // Import custom CSS for table styling

const { Text } = Typography;

const EmployeeTable = ({
    employees,
    loading,
    onEdit,
    onStatusChange,
    onOnboardingStatusChange,
    onCrmAccessChange,
    onLoginStatusChange,
    onPasswordManagement,
    onRowClick
}) => {
    // Get permissions from both possible sources
    const userPermissions = getUserPermissions();
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userDataPermissions = userData.permissions || {};

    // Check if user has permission to edit employees using BOTH permission sources:
    // 1. Super admin (pages=* and actions=*) OR
    // 2. User with specific user edit permissions OR
    // 3. User with specific hrms permissions and any action
    const canEditEmployees =
        // Try with permissions from userPermissions
        (userPermissions.pages === '*' && userPermissions.actions === '*') ||
        hasPermission(userPermissions, 'users', 'edit') ||
        (userPermissions.pages === 'hrms' && userPermissions.actions === '*') ||
        // Try with permissions from userData.permissions as backup
        (userDataPermissions.pages === '*' && userDataPermissions.actions === '*') ||
        hasPermission(userDataPermissions, 'users', 'edit') ||
        (userDataPermissions.pages === 'hrms' && userDataPermissions.actions === '*');

    const getStatusBadge = (status) => {
        if (status === 'active') {
            return <Badge status="success" text={<span style={{ color: 'white' }}>Active</span>} />;
        }
        return <Badge status="error" text={<span style={{ color: 'white' }}>Inactive</span>} />;
    };

    const getOnboardingTag = (status) => {
        switch (status) {
            case 'completed':
                return <Tag color="success" icon={<CheckCircleOutlined />}><span style={{ color: 'white' }}>Completed</span></Tag>;
            case 'in_progress':
                return <Tag color="processing" icon={<ExclamationCircleOutlined />}><span style={{ color: 'white' }}>In Progress</span></Tag>;
            default:
                return <Tag color="warning" icon={<CloseCircleOutlined />}><span style={{ color: 'white' }}>Pending</span></Tag>;
        }
    };

    const renderActionMenu = (record) => {
        return (
            <Menu>
                {canEditEmployees && (
                    <>
                        <Menu.Item
                            key="edit"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(record)}
                        >
                            Edit Details
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            key="status"
                            onClick={() => onStatusChange(record)}
                        >
                            {record.employee_status === 'active' ? 'Deactivate Employee' : 'Activate Employee'}
                        </Menu.Item>
                        <Menu.Item
                            key="onboarding"
                            onClick={() => onOnboardingStatusChange(record)}
                        >
                            Update Onboarding Status
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            key="crm"
                            onClick={() => onCrmAccessChange(record, !record.crm_access)}
                        >
                            {record.crm_access ? 'Remove CRM Access' : 'Grant CRM Access'}
                        </Menu.Item>
                        <Menu.Item
                            key="login"
                            onClick={() => onLoginStatusChange(record, !record.login_enabled)}
                        >
                            {record.login_enabled ? 'Disable Login' : 'Enable Login'}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            key="password"
                            icon={<KeyOutlined />}
                            onClick={() => onPasswordManagement && onPasswordManagement(record)}
                        >
                            Manage Password
                        </Menu.Item>
                    </>
                )}
            </Menu>
        );
    };

    const columns = [
        {
            title: 'Employee',
            key: 'employee',
            fixed: 'left',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Avatar
                        src={getProfilePictureUrlWithCacheBusting(record.profile_photo)}
                        icon={!record.profile_photo && <UserOutlined />}
                    />
                    <div>
                        <Text strong style={{ color: 'white' }}>{`${record.first_name} ${record.last_name}`}</Text>
                        <div style={{ fontSize: '12px', color: '#a9a9a9' }}>
                            {record.employee_id ? `RM${record.employee_id}` : 'No ID'}
                        </div>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Designation',
            dataIndex: 'role_name',   // Changed from designation to role_name
            key: 'designation',
            render: (text) => <span style={{ color: 'white' }}>{text || '-'}</span>
        },
        {
            title: 'Department',
            dataIndex: 'department_name', // This will need to be populated when fetching the data
            key: 'department',
            render: (text) => <span style={{ color: 'white' }}>{text || '-'}</span>
        },
        {
            title: 'Email/Phone',
            key: 'contact',
            render: (_, record) => (
                <div>
                    <div style={{ color: 'white' }}>{record.email}</div>
                    <div style={{ fontSize: '12px', color: '#a9a9a9' }}>{record.phone || '-'}</div>
                </div>
            ),
        },
        {
            title: 'Joining Date',
            dataIndex: 'joining_date',
            key: 'joining_date',
            render: (date) => <span style={{ color: 'white' }}>{date ? formatDate(date) : '-'}</span>
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => getStatusBadge(record.employee_status),
        },
        {
            title: 'Onboarding',
            key: 'onboarding',
            render: (_, record) => getOnboardingTag(record.onboarding_status),
        },
        {
            title: 'Access',
            key: 'access',
            render: (_, record) => (
                <div>
                    <div style={{ color: 'white' }}>
                        CRM: {record.crm_access ?
                            <Badge status="success" text={<span style={{ color: 'white' }}>Yes</span>} /> :
                            <Badge status="default" text={<span style={{ color: '#a9a9a9' }}>No</span>} />}
                    </div>
                    <div style={{ color: 'white' }}>
                        Login: {record.login_enabled ?
                            <Badge status="success" text={<span style={{ color: 'white' }}>Enabled</span>} /> :
                            <Badge status="default" text={<span style={{ color: '#a9a9a9' }}>Disabled</span>} />}
                    </div>
                </div>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 80,
            render: (_, record) => (
                <Dropdown overlay={renderActionMenu(record)} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined style={{ color: 'white' }} />} />
                </Dropdown>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={employees.map(e => ({ ...e, key: e._id }))}
            loading={loading}
            pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50']
            }}
            scroll={{ x: 'max-content' }}
            className="employee-table-dark"
            style={{ 
                backgroundColor: '#000',
                color: 'white'
            }}
            onRow={(record) => ({
                onClick: () => {
                    if (onRowClick) {
                        onRowClick(record);
                    }
                },
                style: { cursor: 'pointer' }
            })}
        />
    );
};

export default EmployeeTable;
