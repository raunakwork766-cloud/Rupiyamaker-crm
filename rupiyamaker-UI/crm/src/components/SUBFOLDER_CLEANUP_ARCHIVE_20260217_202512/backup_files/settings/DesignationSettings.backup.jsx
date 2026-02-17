import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService';

const DesignationSettings = () => {
    const [designations, setDesignations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingDesignation, setEditingDesignation] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchDesignations();
    }, []);

    const fetchDesignations = async () => {
        setLoading(true);
        try {
            const response = await hrmsService.getDesignations();
            console.log('Fetched designations:', response);
            
            if (response && response.data) {
                // Ensure we have proper data structure
                const designationData = Array.isArray(response.data) 
                    ? response.data 
                    : (response.data.designations || []);
                
                setDesignations(designationData);
            } else {
                setDesignations([]);
            }
        } catch (error) {
            console.error('Error fetching designations:', error);
            message.error('Failed to fetch designations');
        } finally {
            setLoading(false);
        }
    };

    const showModal = (designation = null) => {
        setEditingDesignation(designation);
        form.resetFields();
        
        if (designation) {
            form.setFieldsValue({
                name: designation.name,
                reporting_designation_id: designation.reporting_designation_id || undefined,
                description: designation.description || '',
                is_active: designation.is_active
            });
        }
        
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setEditingDesignation(null);
    };

    const handleSubmit = async (values) => {
        try {
            if (editingDesignation) {
                // Update existing designation
                await hrmsService.updateDesignation(editingDesignation._id, values);
                message.success('Designation updated successfully');
            } else {
                // Create new designation
                await hrmsService.createDesignation(values);
                message.success('Designation created successfully');
            }
            
            setIsModalVisible(false);
            setEditingDesignation(null);
            fetchDesignations();
        } catch (error) {
            console.error('Error saving designation:', error);
            message.error('Failed to save designation');
        }
    };

    const handleDelete = async (designationId) => {
        try {
            await hrmsService.deleteDesignation(designationId);
            message.success('Designation deleted successfully');
            fetchDesignations();
        } catch (error) {
            console.error('Error deleting designation:', error);
            message.error('Failed to delete designation');
        }
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name)
        },
        {
            title: 'Reports To',
            dataIndex: 'reporting_designation_name',
            key: 'reporting_designation_name',
            render: (text, record) => text || 'None'
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            render: text => text || '-'
        },
        {
            title: 'Status',
            dataIndex: 'is_active',
            key: 'is_active',
            render: isActive => (
                <span className={`px-2 py-1 rounded-full text-xs ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isActive ? 'Active' : 'Inactive'}
                </span>
            ),
            filters: [
                { text: 'Active', value: true },
                { text: 'Inactive', value: false }
            ],
            onFilter: (value, record) => record.is_active === value
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <div className="flex space-x-2">
                    <Button
                        type="primary"
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => showModal(record)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Are you sure you want to delete this designation?"
                        onConfirm={() => handleDelete(record._id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button
                            type="danger"
                            icon={<DeleteOutlined />}
                            size="small"
                        >
                            Delete
                        </Button>
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#03b0f5]">Designation Management</h2>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => showModal()}
                    className="bg-[#03b0f5] hover:bg-[#0291cc]"
                >
                    Add Designation
                </Button>
            </div>
            
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spin size="large" />
                </div>
            ) : (
                <Table
                    dataSource={designations}
                    columns={columns}
                    rowKey={record => record._id || record.id}
                    pagination={{ pageSize: 10 }}
                />
            )}
            
            <Modal
                title={editingDesignation ? 'Edit Designation' : 'Add New Designation'}
                visible={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ is_active: true }}
                >
                    <Form.Item
                        name="name"
                        label="Designation Name"
                        rules={[{ required: true, message: 'Please enter designation name' }]}
                    >
                        <Input placeholder="Enter designation name" />
                    </Form.Item>
                    
                    <Form.Item
                        name="reporting_designation_id"
                        label="Reports To"
                    >
                        <Select
                            placeholder="Select reporting designation"
                            allowClear
                        >
                            {designations
                                .filter(d => !editingDesignation || d._id !== editingDesignation._id)
                                .map(designation => (
                                    <Select.Option key={designation._id} value={designation._id}>
                                        {designation.name}
                                    </Select.Option>
                                ))
                            }
                        </Select>
                    </Form.Item>
                    
                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea rows={3} placeholder="Enter description" />
                    </Form.Item>
                    
                    <Form.Item
                        name="is_active"
                        label="Status"
                        valuePropName="checked"
                    >
                        <Select>
                            <Select.Option value={true}>Active</Select.Option>
                            <Select.Option value={false}>Inactive</Select.Option>
                        </Select>
                    </Form.Item>
                    
                    <div className="flex justify-end">
                        <Button
                            key="cancel"
                            onClick={handleCancel}
                            className="mr-2"
                        >
                            Cancel
                        </Button>
                        <Button
                            key="submit"
                            type="primary"
                            htmlType="submit"
                            className="bg-[#03b0f5] hover:bg-[#0291cc]"
                        >
                            {editingDesignation ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default DesignationSettings;
