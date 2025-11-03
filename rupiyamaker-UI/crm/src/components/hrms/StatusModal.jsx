import React from 'react';
import { Modal, Form, Select, Input, Button } from 'antd';
import './hrms-dark-theme.css';

const { Option } = Select;
const { TextArea } = Input;

const StatusModal = ({
    open,
    title,
    confirmLoading,
    onCancel,
    onSubmit,
    type, // 'status' or 'onboarding'
    currentValue,
}) => {
    const [form] = Form.useForm();

    React.useEffect(() => {
        if (open) {
            form.resetFields();
            if (currentValue) {
                form.setFieldsValue({
                    status: currentValue,
                    remark: '',
                });
            }
        }
    }, [open, currentValue, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            onSubmit(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={title}
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button key="submit" type="primary" loading={confirmLoading} onClick={handleOk}>
                    Update
                </Button>,
            ]}
            className="hrms-dark-theme"
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="status"
                    label={type === 'status' ? 'Employee Status' : 'Onboarding Status'}
                    rules={[{ required: true, message: 'Please select status' }]}
                >
                    {type === 'status' ? (
                        <Select>
                            <Option value="active">Active</Option>
                            <Option value="inactive">Inactive</Option>
                        </Select>
                    ) : (
                        <Select>
                            <Option value="pending" className="bg-black">Pending</Option>
                            <Option value="in_progress"  className="bg-black">In Progress</Option>
                            <Option value="completed"  className="bg-black">Completed</Option>
                        </Select>
                    )}
                </Form.Item>

                <Form.Item
                    name="remark"
                    label="Remarks"
                >
                    <TextArea rows={4} placeholder="Add any additional remarks or notes" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default StatusModal;
