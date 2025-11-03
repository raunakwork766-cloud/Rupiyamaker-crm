import React, { useState } from 'react';
import {
    Modal,
    Form,
    Input,
    Button,
    message,
    Space,
    Typography,
    Divider
} from 'antd';
import { KeyOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService';

const { Text } = Typography;
const { Password } = Input;

const PasswordManagementModal = ({ 
    visible, 
    onCancel, 
    employee, 
    onSuccess 
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);

    const handleChangePassword = async (values) => {
        setLoading(true);
        try {
            await hrmsService.changeEmployeePassword(employee.id, {
                new_password: values.new_password
            });
            
            message.success('Password changed successfully');
            form.resetFields();
            onSuccess && onSuccess();
            onCancel();
        } catch (error) {
            console.error('Error changing password:', error);
            message.error('Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setResetLoading(true);
        try {
            const response = await hrmsService.resetEmployeePassword(employee.id);
            
            message.success(
                `Password reset successfully. Temporary password: ${response.temporary_password}`,
                10 // Show for 10 seconds
            );
            
            onSuccess && onSuccess();
            onCancel();
        } catch (error) {
            console.error('Error resetting password:', error);
            message.error('Failed to reset password');
        } finally {
            setResetLoading(false);
        }
    };

    const validatePassword = (_, value) => {
        if (!value) {
            return Promise.reject(new Error('Please enter a password'));
        }
        if (value.length < 8) {
            return Promise.reject(new Error('Password must be at least 8 characters'));
        }
        return Promise.resolve();
    };

    const validateConfirmPassword = (_, value) => {
        const newPassword = form.getFieldValue('new_password');
        if (value && value !== newPassword) {
            return Promise.reject(new Error('Passwords do not match'));
        }
        return Promise.resolve();
    };

    return (
        <Modal
            title={
                <Space>
                    <KeyOutlined />
                    Password Management - {employee?.first_name} {employee?.last_name}
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            footer={null}
            width={500}
        >
            <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                    Employee ID: {employee?.employee_id ? `RM${employee.employee_id}` : 'No ID'} | Email: {employee?.email}
                </Text>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleChangePassword}
            >
                <Form.Item
                    name="new_password"
                    label="New Password"
                    rules={[
                        { validator: validatePassword }
                    ]}
                >
                    <Password
                        placeholder="Enter new password"
                        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    />
                </Form.Item>

                <Form.Item
                    name="confirm_password"
                    label="Confirm Password"
                    dependencies={['new_password']}
                    rules={[
                        { required: true, message: 'Please confirm the password' },
                        { validator: validateConfirmPassword }
                    ]}
                >
                    <Password
                        placeholder="Confirm new password"
                        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    />
                </Form.Item>

                <Form.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            Change Password
                        </Button>
                    </Space>
                </Form.Item>
            </Form>

            <Divider>OR</Divider>

            <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Reset to a temporary password that the employee must change on first login
                </Text>
                <Button 
                    danger 
                    onClick={handleResetPassword} 
                    loading={resetLoading}
                    style={{ width: '100%' }}
                >
                    Reset to Temporary Password
                </Button>
            </div>
        </Modal>
    );
};

export default PasswordManagementModal;
