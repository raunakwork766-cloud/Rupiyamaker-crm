import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Input, 
  Select, 
  message,
  Typography,
  Spin,
  Row,
  Col
} from 'antd';
import { hrmsService } from '../services/hrmsService';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const EmployeeDesignation = ({ employee, onSave }) => {
  const [form] = Form.useForm();
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
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
      
      console.log('Fetched designations for employee form:', designationsData);
      setDesignations(designationsData || []);
    } catch (error) {
      console.error('Failed to fetch designations:', error);
      message.error('Failed to load designations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize form values when employee or designations change
  useEffect(() => {
    fetchDesignations();
  }, []);
  
  useEffect(() => {
    if (employee && employee.designation_id) {
      form.setFieldsValue({
        designation_id: employee.designation_id
      });
    }
  }, [employee, form]);

  // Handle form submission
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      // Find the selected designation object
      const selectedDesignation = designations.find(d => d._id === values.designation_id);
      
      if (selectedDesignation) {
        // Call the onSave callback with designation data
        await onSave({
          designation_id: selectedDesignation._id,
          designation: selectedDesignation.name
        });
        message.success('Designation updated successfully');
      } else {
        throw new Error('Selected designation not found');
      }
    } catch (error) {
      console.error('Failed to update designation:', error);
      message.error('Failed to update designation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card 
      title={<Title level={5}>Designation Information</Title>}
      className="mb-6"
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="designation_id"
                label="Designation"
                rules={[{ required: true, message: 'Please select designation' }]}
              >
                <Select
                  placeholder="Select designation"
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                  loading={loading}
                >
                  {designations.map(designation => (
                    <Option key={designation._id} value={designation._id}>
                      {designation.name}
                      {designation.reporting_designation_name && 
                        ` (Reports to: ${designation.reporting_designation_name})`
                      }
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row justify="end">
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={saving}
            >
              Save Designation
            </Button>
          </Row>
        </Form>
      </Spin>
    </Card>
  );
};

export default EmployeeDesignation;
