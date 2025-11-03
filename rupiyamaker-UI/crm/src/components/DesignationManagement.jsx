import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Input, 
  Select, 
  Table, 
  Space, 
  Popconfirm, 
  message, 
  Tooltip, 
  Modal,
  Typography
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  QuestionCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { hrmsService } from '../services/hrmsService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DesignationManagement = () => {
  const [form] = Form.useForm();
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentDesignation, setCurrentDesignation] = useState(null);
  
  // Fetch all designations
  const fetchDesignations = async () => {
    setLoading(true);
    try {
      const response = await hrmsService.getDesignations();
      
      // Handle different response structures
      let designationsData = [];
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          designationsData = response.data;
        } else if (response.data.designations && Array.isArray(response.data.designations)) {
          designationsData = response.data.designations;
        }
      } else if (Array.isArray(response)) {
        designationsData = response;
      }
      
      console.log('Fetched designations:', designationsData);
      setDesignations(designationsData || []);
    } catch (error) {
      console.error('Failed to fetch designations:', error);
      message.error('Failed to load designations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load designations on component mount
  useEffect(() => {
    fetchDesignations();
  }, []);

  // Handle form submission for creating/updating a designation
  const handleSubmit = async (values) => {
    try {
      if (currentDesignation) {
        // Update existing designation
        await hrmsService.updateDesignation(currentDesignation._id, values);
        message.success('Designation updated successfully!');
      } else {
        // Create new designation
        await hrmsService.createDesignation(values);
        message.success('Designation created successfully!');
      }
      
      // Reset form and state
      form.resetFields();
      setIsModalVisible(false);
      setCurrentDesignation(null);
      
      // Refresh the designations list
      fetchDesignations();
    } catch (error) {
      console.error('Error saving designation:', error);
      message.error('Failed to save designation. Please try again.');
    }
  };

  // Handle edit button click
  const handleEdit = (record) => {
    setCurrentDesignation(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      reporting_designation_id: record.reporting_designation_id
    });
    setIsModalVisible(true);
  };

  // Handle delete button click
  const handleDelete = async (id) => {
    try {
      await hrmsService.deleteDesignation(id);
      message.success('Designation deleted successfully!');
      fetchDesignations();
    } catch (error) {
      console.error('Error deleting designation:', error);
      message.error('Failed to delete designation. Please try again.');
    }
  };

  // Columns configuration for the table
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Reports To',
      dataIndex: 'reporting_designation_name',
      key: 'reporting_designation_name',
      render: (text) => text || '-',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)} 
              type="text" 
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Are you sure you want to delete this designation?"
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            >
              <Button icon={<DeleteOutlined />} type="text" danger />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Show modal for creating a new designation
  const showCreateModal = () => {
    form.resetFields();
    setCurrentDesignation(null);
    setIsModalVisible(true);
  };

  return (
    <div className="p-6">
      <Card 
        title={
          <div className="flex justify-between items-center">
            <Title level={4}>Designation Management</Title>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={showCreateModal}
            >
              Add Designation
            </Button>
          </div>
        }
      >
        <Table 
          columns={columns} 
          dataSource={designations} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={currentDesignation ? 'Edit Designation' : 'Add Designation'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Designation Name"
            rules={[{ required: true, message: 'Please enter designation name!' }]}
          >
            <Input placeholder="Enter designation name" />
          </Form.Item>

          <Form.Item
            name="reporting_designation_id"
            label={
              <span>
                Reporting Designation
                <Tooltip title="Select the designation this position reports to">
                  <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </span>
            }
          >
            <Select
              placeholder="Select reporting designation"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {designations
                .filter(d => !currentDesignation || d._id !== currentDesignation._id)
                .map(designation => (
                  <Option key={designation._id} value={designation._id}>
                    {designation.name}
                  </Option>
                ))
              }
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea 
              placeholder="Enter designation description" 
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {currentDesignation ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DesignationManagement;
