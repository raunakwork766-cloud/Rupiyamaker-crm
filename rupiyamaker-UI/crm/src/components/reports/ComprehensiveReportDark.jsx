import React, { useState, useEffect } from 'react';
import { 
    Card, 
    Table, 
    Button, 
    DatePicker, 
    Select, 
    Space, 
    Statistic, 
    Row, 
    Col, 
    Spin, 
    message,
    Tag,
    Dropdown,
    Menu,
    Modal,
    Tabs,
    Descriptions,
    Tooltip,
    Input
} from 'antd';
import { 
    DownloadOutlined, 
    FileExcelOutlined, 
    ReloadOutlined,
    UserOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileTextOutlined,
    DownOutlined,
    EyeOutlined,
    FilterOutlined,
    SearchOutlined,
    FileProtectOutlined,
    HistoryOutlined,
    SolutionOutlined,
    TeamOutlined,
    CalendarOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { leadsService } from '../../services/leadsService';
import { hrmsService } from '../../services/hrmsService';
import axios from 'axios';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://156.67.111.95:8049';

const ComprehensiveReportDark = () => {
    const REPORT_SECTIONS = [
        { key: 'leads', label: 'PLOD Leads', icon: <UserOutlined /> },
        { key: 'login-leads', label: 'Login Leads', icon: <FileTextOutlined /> },
        { key: 'tasks', label: 'Tasks', icon: <CheckCircleOutlined /> },
        { key: 'tickets', label: 'Tickets', icon: <SolutionOutlined /> },
        { key: 'attendance', label: 'Attendance', icon: <CalendarOutlined /> },
        { key: 'employees', label: 'Employees', icon: <TeamOutlined /> },
        { key: 'leaves', label: 'Leaves', icon: <ClockCircleOutlined /> },
    ];

    const [selectedSection, setSelectedSection] = useState('leads');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [activeDetailTab, setActiveDetailTab] = useState('about');
    const [detailLoading, setDetailLoading] = useState(false);
    
    const [filters, setFilters] = useState({
        dateRange: null,
        searchText: '',
        status: null,
    });

    const [statistics, setStatistics] = useState({
        total: 0,
        active: 0,
        completed: 0,
        pending: 0
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (users.length > 0) {
            fetchData();
        }
    }, [selectedSection, users]);

    useEffect(() => {
        applyFilters();
    }, [filters, data]);

    useEffect(() => {
        calculateStatistics();
    }, [filteredData]);

    const getUserNameById = (userId) => {
        if (!userId || !users || users.length === 0) return 'Unknown';
        
        const user = users.find(u => 
            (u._id && u._id === userId) || 
            (u.id && u.id === userId) ||
            (u._id && u._id.$oid === userId)
        );
        
        if (user) {
            return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.username || 'Unknown';
        }
        return 'Unknown';
    };

    const fetchUsers = async () => {
        try {
            const response = await hrmsService.getAllEmployees();
            if (response.success && response.data) {
                setUsers(Array.isArray(response.data) ? response.data : []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error('Failed to fetch users');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let fetchedData = [];

            switch (selectedSection) {
                case 'leads': {
                    const response = await leadsService.getAllLeads();
                    if (response.success) {
                        fetchedData = Array.isArray(response.data) ? response.data : 
                                     (response.data.items ? response.data.items : []);
                    }
                    break;
                }

                case 'login-leads': {
                    const userId = localStorage.getItem('userId');
                    const token = localStorage.getItem('token');
                    
                    console.log('=== DEBUG: Fetching Login Leads ===');
                    console.log('User ID:', userId);
                    console.log('Token exists:', !!token);
                    
                    try {
                        const loginResponse = await axios.get(`/api/lead-login/login-department-leads`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            params: { user_id: userId }
                        });
                        
                        fetchedData = loginResponse.data?.leads || [];
                        console.log('Fetched data count:', fetchedData.length);
                    } catch (loginError) {
                        console.error('ERROR fetching login leads:', loginError);
                        fetchedData = [];
                    }
                    break;
                }

                case 'employees': {
                    const response = await hrmsService.getAllEmployees();
                    fetchedData = response.success ? (Array.isArray(response.data) ? response.data : []) : [];
                    break;
                }

                case 'tasks': {
                    const tasksResponse = await axios.get(`${API_BASE_URL}/api/tasks`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    fetchedData = tasksResponse.data.data || [];
                    break;
                }

                case 'tickets': {
                    const ticketsResponse = await axios.get(`${API_BASE_URL}/api/tickets`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    fetchedData = ticketsResponse.data.data || [];
                    break;
                }

                case 'attendance': {
                    const attendanceResponse = await axios.get(`${API_BASE_URL}/api/attendance`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    fetchedData = attendanceResponse.data.data || [];
                    break;
                }

                case 'leaves': {
                    const leavesResponse = await axios.get(`${API_BASE_URL}/api/leaves`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    fetchedData = leavesResponse.data.data || [];
                    break;
                }

                default:
                    fetchedData = [];
            }

            setData(fetchedData);
            setFilteredData(fetchedData);
        } catch (error) {
            console.error('Error fetching data:', error);
            message.error(`Failed to fetch ${selectedSection} data`);
            setData([]);
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        if (!Array.isArray(data)) {
            setFilteredData([]);
            return;
        }

        let filtered = [...data];

        if (filters.dateRange && filters.dateRange.length === 2) {
            const [startDate, endDate] = filters.dateRange;
            filtered = filtered.filter(item => {
                const itemDate = dayjs(item.created_date || item.created_at || item.date);
                return itemDate.isAfter(startDate.startOf('day')) && itemDate.isBefore(endDate.endOf('day'));
            });
        }

        if (filters.status) {
            filtered = filtered.filter(item => {
                const status = (item.status || '').toLowerCase();
                return status === filters.status.toLowerCase() || 
                       status.includes(filters.status.toLowerCase());
            });
        }

        if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            filtered = filtered.filter(item => {
                return Object.values(item).some(value => 
                    value && value.toString().toLowerCase().includes(searchLower)
                );
            });
        }

        setFilteredData(filtered);
    };

    const calculateStatistics = () => {
        if (!Array.isArray(filteredData)) {
            setStatistics({ total: 0, active: 0, completed: 0, pending: 0 });
            return;
        }

        const total = filteredData.length;
        let active = 0, completed = 0, pending = 0;

        filteredData.forEach(item => {
            const status = (item.status || '').toLowerCase();
            if (status.includes('active') || status.includes('approved') || status.includes('won')) {
                active++;
            } else if (status.includes('completed') || status.includes('closed') || status.includes('disbursed')) {
                completed++;
            } else if (status.includes('pending') || status.includes('progress')) {
                pending++;
            }
        });

        setStatistics({ total, active, completed, pending });
    };

    const handleRowClick = (record) => {
        if (selectedSection === 'leads' || selectedSection === 'login-leads') {
            setSelectedLead(record);
            setDetailModalVisible(true);
            setActiveDetailTab('about');
            fetchLeadDetails(record._id?.$oid || record._id);
        }
    };

    const fetchLeadDetails = async (leadId) => {
        setDetailLoading(true);
        try {
            const response = await leadsService.getLeadById(leadId);
            if (response.success) {
                setSelectedLead(response.data);
            }
        } catch (error) {
            console.error('Error fetching lead details:', error);
            message.error('Failed to fetch lead details');
        } finally {
            setDetailLoading(false);
        }
    };

    const formatLabel = (key) => {
        return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    };

    const exportSingleToExcel = async (record) => {
        try {
            setLoading(true);
            let detailedData = {};

            if (selectedSection === 'leads' || selectedSection === 'login-leads') {
                const leadId = record._id?.$oid || record._id;
                try {
                    const response = await leadsService.getLeadById(leadId);
                    detailedData = response.success ? response.data : record;
                } catch (fetchError) {
                    console.error('Error fetching lead:', fetchError);
                    message.warning('Could not fetch complete details, exporting available data');
                    detailedData = record;
                }
            } else {
                detailedData = record;
            }

            const workbook = XLSX.utils.book_new();

            if (selectedSection === 'leads' || selectedSection === 'login-leads') {
                const lead = detailedData;
                
                const aboutData = [{
                    'Lead ID': lead.custom_lead_id || '',
                    'First Name': lead.first_name || '',
                    'Last Name': lead.last_name || '',
                    'Email': lead.email || '',
                    'Phone': lead.phone || '',
                    'Status': lead.status || '',
                    'Sub Status': lead.sub_status || '',
                    'Priority': lead.priority || '',
                    'Loan Type': lead.loan_type || lead.loan_type_name || '',
                    'Loan Amount': lead.loan_amount || '',
                    'Loan Eligibility': lead.loan_eligibility || '',
                    'Processing Bank': lead.processing_bank || '',
                    'Department': lead.department_name || '',
                    'Source': lead.source || '',
                    'Campaign': lead.campaign_name || '',
                    'Data Code': lead.data_code || '',
                    'Reference': lead.reference || '',
                    'Assigned To': getUserNameById(lead.assigned_to),
                    'Reported To': lead.assign_report_to && lead.assign_report_to.length > 0 
                        ? lead.assign_report_to.map(uid => getUserNameById(uid)).join(', ') 
                        : '',
                    'Created By': lead.created_by_name || getUserNameById(lead.created_by),
                    'Created Date': lead.created_date || lead.created_at || '',
                    'Updated Date': lead.updated_date || lead.updated_at || '',
                    'Pincode & City': lead.pincode_city || '',
                    'Company Name': lead.company_name || '',
                    'Company Category': lead.company_category?.name || lead.company_category || '',
                    'Salary': lead.salary || '',
                    'Salary Type': lead.salary_type || '',
                    'File Sent to Login': lead.file_sent_to_login ? 'Yes' : 'No',
                    'Login Sent Date': lead.login_department_sent_date || '',
                    'PAN Card': lead.pan_card || '',
                    'Aadhar Card': lead.aadhar_card || '',
                    'DOB': lead.dob || '',
                    'Gender': lead.gender || '',
                    'Marital Status': lead.marital_status || '',
                }];
                const aboutSheet = XLSX.utils.json_to_sheet(aboutData);
                XLSX.utils.book_append_sheet(workbook, aboutSheet, 'About');

                const obligations = lead.dynamic_fields?.obligations || [];
                if (obligations.length > 0) {
                    const obligationsData = obligations.map((obl, idx) => ({
                        '#': idx + 1,
                        'Type': obl.type || obl.obligation_type || '',
                        'Bank/NBFC': obl.bank_name || obl.lender_name || '',
                        'Product': obl.product || '',
                        'Loan Type': obl.loan_type || '',
                        'EMI': obl.emi || '',
                        'EMI Amount': obl.emi_amount || '',
                        'Outstanding Amount': obl.outstanding || obl.outstanding_amount || '',
                        'Total Loan Amount': obl.total_loan || '',
                        'Tenure (Months)': obl.tenure || '',
                        'Tenure Left (Months)': obl.tenure_left || obl.remaining_tenure || '',
                        'ROI (%)': obl.roi || '',
                        'Account Number': obl.account_number || '',
                        'Action': obl.action || '',
                        'Bureau Status': obl.bureau_status || '',
                    }));
                    const obligationsSheet = XLSX.utils.json_to_sheet(obligationsData);
                    XLSX.utils.book_append_sheet(workbook, obligationsSheet, 'Obligations');
                } else if (lead.dynamic_fields?.obligation_data && typeof lead.dynamic_fields.obligation_data === 'object') {
                    const obligationObjData = Object.entries(lead.dynamic_fields.obligation_data).map(([key, value]) => ({
                        'Field': formatLabel(key),
                        'Value': typeof value === 'number' ? `₹${value.toLocaleString()}` : value || '',
                    }));
                    const obligationObjSheet = XLSX.utils.json_to_sheet(obligationObjData);
                    XLSX.utils.book_append_sheet(workbook, obligationObjSheet, 'Obligations');
                } else {
                    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{'Note': 'No obligations data available'}]), 'Obligations');
                }

                const remarksData = [{
                    'Remark Type': 'General Remarks',
                    'Content': lead.remarks || lead.notes || '',
                }, {
                    'Remark Type': 'Internal Notes',
                    'Content': lead.internal_notes || '',
                }, {
                    'Remark Type': 'Login Remarks',
                    'Content': lead.login_remarks || '',
                }, {
                    'Remark Type': 'Operations Remarks',
                    'Content': lead.operations_remarks || '',
                }, {
                    'Remark Type': 'Credit Remarks',
                    'Content': lead.credit_remarks || '',
                }, {
                    'Remark Type': 'Sales Remarks',
                    'Content': lead.sales_remarks || '',
                }];
                const remarksSheet = XLSX.utils.json_to_sheet(remarksData);
                XLSX.utils.book_append_sheet(workbook, remarksSheet, 'Remarks');

                const tasks = lead.dynamic_fields?.tasks || [];
                if (tasks.length > 0) {
                    const tasksData = tasks.map((task, idx) => ({
                        '#': idx + 1,
                        'Title': task.title || '',
                        'Description': task.description || '',
                        'Status': task.status || '',
                        'Priority': task.priority || '',
                        'Due Date': task.due_date || '',
                        'Assigned To': task.assigned_to ? getUserNameById(task.assigned_to) : '',
                        'Created At': task.created_at || '',
                        'Completed At': task.completed_at || '',
                    }));
                    const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
                    XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Tasks');
                } else {
                    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{'Note': 'No tasks data available'}]), 'Tasks');
                }

                const documents = lead.documents || [];
                if (documents.length > 0) {
                    const docsData = documents.map((doc, idx) => ({
                        '#': idx + 1,
                        'Document Type': doc.document_type || doc.type || '',
                        'Document Name': doc.document_name || doc.name || doc.file_name || '',
                        'File Path': doc.file_path || '',
                        'Uploaded Date': doc.uploaded_date || doc.created_at || '',
                        'Uploaded By': doc.uploaded_by ? getUserNameById(doc.uploaded_by) : '',
                        'Status': doc.status || '',
                    }));
                    const docsSheet = XLSX.utils.json_to_sheet(docsData);
                    XLSX.utils.book_append_sheet(workbook, docsSheet, 'Attachments');
                } else {
                    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{'Note': 'No attachments available'}]), 'Attachments');
                }

                const activities = lead.activity || [];
                if (activities.length > 0) {
                    const activityData = activities.map((act, idx) => ({
                        '#': idx + 1,
                        'Date & Time': act.timestamp || act.created_at || act.date || '',
                        'User': act.user || act.user_name || act.created_by || '',
                        'Action': act.action || act.activity_type || act.type || '',
                        'Description': act.description || act.message || '',
                        'Section': act.section || act.module || '',
                        'Field Changed': act.field_changed || act.field || '',
                        'Old Value': act.old_value || act.previous_value || '',
                        'New Value': act.new_value || act.current_value || '',
                    }));
                    const activitySheet = XLSX.utils.json_to_sheet(activityData);
                    XLSX.utils.book_append_sheet(workbook, activitySheet, 'Lead Activity');
                } else {
                    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{'Note': 'No activity history available'}]), 'Lead Activity');
                }
            } else {
                const exportData = [];
                if (Array.isArray(detailedData)) {
                    detailedData.forEach(item => {
                        const cleanRow = {};
                        Object.keys(item).forEach(key => {
                            if (!key.startsWith('_')) {
                                cleanRow[formatLabel(key)] = item[key];
                            }
                        });
                        exportData.push(cleanRow);
                    });
                } else {
                    const cleanRow = {};
                    Object.keys(detailedData).forEach(key => {
                        if (!key.startsWith('_')) {
                            cleanRow[formatLabel(key)] = detailedData[key];
                        }
                    });
                    exportData.push(cleanRow);
                }
                const mainSheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, mainSheet, 'Details');
            }

            const fileName = `${selectedSection}_${record.custom_lead_id || record._id || 'record'}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            message.success('Export successful!');
        } catch (error) {
            console.error('Export error:', error);
            message.error(`Failed to export data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const exportBulkToExcel = async () => {
        try {
            if (!selectedRows || selectedRows.length === 0) {
                message.warning('Please select rows to export');
                return;
            }

            setLoading(true);
            const workbook = XLSX.utils.book_new();

            if (selectedSection === 'leads' || selectedSection === 'login-leads') {
                for (const lead of selectedRows) {
                    const leadId = lead._id?.$oid || lead._id;
                    let detailedLead = lead;
                    
                    try {
                        const response = await leadsService.getLeadById(leadId);
                        detailedLead = response.success ? response.data : lead;
                    } catch (error) {
                        console.error(`Error fetching lead ${leadId}:`, error);
                    }

                    const sheetName = `Lead_${lead.custom_lead_id || leadId}`.slice(0, 31);
                    
                    const leadData = [{
                        'Lead ID': detailedLead.custom_lead_id || '',
                        'First Name': detailedLead.first_name || '',
                        'Last Name': detailedLead.last_name || '',
                        'Full Name': `${detailedLead.first_name || ''} ${detailedLead.last_name || ''}`.trim(),
                        'Email': detailedLead.email || '',
                        'Phone': detailedLead.phone || '',
                        'Status': detailedLead.status || '',
                        'Loan Amount': detailedLead.loan_amount || '',
                        'Processing Bank': detailedLead.processing_bank || '',
                        'Assigned To': getUserNameById(detailedLead.assigned_to),
                        'Created Date': detailedLead.created_date || '',
                    }];
                    
                    const obligations = detailedLead.dynamic_fields?.obligations || [];
                    if (obligations.length > 0) {
                        leadData[0]['Total Obligations'] = obligations.length;
                        obligations.forEach((obl, idx) => {
                            leadData[0][`Obligation ${idx + 1} - Type`] = obl.type || '';
                            leadData[0][`Obligation ${idx + 1} - Bank`] = obl.bank_name || '';
                            leadData[0][`Obligation ${idx + 1} - EMI`] = obl.emi_amount || '';
                            leadData[0][`Obligation ${idx + 1} - Outstanding`] = obl.outstanding_amount || '';
                        });
                    }

                    leadData[0]['Remarks'] = detailedLead.remarks || '';
                    
                    const sheet = XLSX.utils.json_to_sheet(leadData);
                    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
                }
            } else {
                const exportData = selectedRows.map(row => {
                    const cleanRow = {};
                    Object.keys(row).forEach(key => {
                        if (!key.startsWith('_')) {
                            cleanRow[formatLabel(key)] = row[key];
                        }
                    });
                    return cleanRow;
                });
                const sheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, sheet, selectedSection);
            }

            const fileName = `${selectedSection}_bulk_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            message.success(`${selectedRows.length} records exported successfully!`);
        } catch (error) {
            console.error('Bulk export error:', error);
            message.error('Failed to export bulk data');
        } finally {
            setLoading(false);
        }
    };

    const exportAllToExcel = () => {
        try {
            if (!filteredData || filteredData.length === 0) {
                message.warning('No data to export');
                return;
            }

            const workbook = XLSX.utils.book_new();

            if (selectedSection === 'leads' || selectedSection === 'login-leads') {
                const exportData = filteredData.map(lead => ({
                    'Lead ID': lead.custom_lead_id || '',
                    'First Name': lead.first_name || '',
                    'Last Name': lead.last_name || '',
                    'Full Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                    'Email': lead.email || '',
                    'Phone': lead.phone || '',
                    'Status': lead.status || '',
                    'Loan Amount': lead.loan_amount || '',
                    'Loan Type': lead.loan_type || lead.loan_type_name || '',
                    'Processing Bank': lead.processing_bank || '',
                    'Assigned To': getUserNameById(lead.assigned_to),
                    'Created Date': lead.created_date || lead.created_at || '',
                    'Department': lead.department_name || '',
                    'Source': lead.source || '',
                    'Priority': lead.priority || '',
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
            } else {
                const exportData = filteredData.map(row => {
                    const cleanRow = {};
                    Object.keys(row).forEach(key => {
                        if (!key.startsWith('_')) {
                            cleanRow[formatLabel(key)] = row[key];
                        }
                    });
                    return cleanRow;
                });
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, worksheet, selectedSection);
            }
            
            const fileName = `${selectedSection}_all_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            message.success(`${filteredData.length} records exported successfully!`);
        } catch (error) {
            console.error('Export all error:', error);
            message.error('Failed to export data');
        }
    };

    const flattenObject = (obj, prefix = '') => {
        const flattened = {};
        
        if (!obj || typeof obj !== 'object') {
            return {};
        }
        
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            const newKey = prefix ? `${prefix}_${key}` : key;
            
            if (value === null || value === undefined) {
                flattened[newKey] = '';
            } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                Object.assign(flattened, flattenObject(value, newKey));
            } else if (Array.isArray(value)) {
                flattened[newKey] = JSON.stringify(value);
            } else {
                flattened[newKey] = value;
            }
        });
        
        return flattened;
    };

    const resetFilters = () => {
        setFilters({
            dateRange: null,
            searchText: '',
            status: null,
        });
        setSelectedRows([]);
        setSelectedRowKeys([]);
    };

    const getColumns = () => {
        const baseColumns = [
            {
                title: 'Action',
                key: 'action',
                width: 120,
                fixed: 'left',
                render: (_, record) => (
                    <Space size="small">
                        <Tooltip title="View Details">
                            <Button 
                                type="primary" 
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(record);
                                }}
                                style={{ 
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    color: 'white'
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="Export">
                            <Button 
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    exportSingleToExcel(record);
                                }}
                                style={{ 
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    border: '1px solid #f59e0b',
                                    color: '#f59e0b'
                                }}
                            />
                        </Tooltip>
                    </Space>
                ),
            },
        ];

        switch (selectedSection) {
            case 'leads':
            case 'login-leads':
                return [
                    ...baseColumns,
                    {
                        title: 'Lead ID',
                        dataIndex: 'custom_lead_id',
                        key: 'custom_lead_id',
                        width: 140,
                        sorter: true,
                        render: (text) => <span style={{ color: '#a78bfa', fontWeight: 500 }}>{text || '-'}</span>
                    },
                    {
                        title: 'Name',
                        key: 'name',
                        width: 180,
                        sorter: true,
                        render: (_, record) => (
                            <div>
                                <div style={{ fontWeight: 600, color: '#f3f4f6' }}>
                                    {record.first_name || ''} {record.last_name || ''}
                                </div>
                                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                    {record.email || ''}
                                </div>
                            </div>
                        ),
                    },
                    {
                        title: 'Phone',
                        dataIndex: 'phone',
                        key: 'phone',
                        width: 140,
                        render: (text) => <span style={{ color: '#cbd5e1' }}>{text || '-'}</span>
                    },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 130,
                        sorter: true,
                        render: (status) => (
                            <Tag color={getStatusColor(status)} style={{ fontWeight: 500 }}>
                                {status}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Loan Amount',
                        dataIndex: 'loan_amount',
                        key: 'loan_amount',
                        width: 140,
                        sorter: true,
                        render: (amount) => (
                            <span style={{ color: '#34d399', fontWeight: 600 }}>
                                {amount ? `₹${amount.toLocaleString()}` : '-'}
                            </span>
                        ),
                    },
                    {
                        title: 'Assigned To',
                        key: 'assigned_to',
                        width: 160,
                        render: (_, record) => (
                            <span style={{ color: '#cbd5e1' }}>
                                {getUserNameById(record.assigned_to) || '-'}
                            </span>
                        ),
                    },
                    {
                        title: 'Created Date',
                        dataIndex: 'created_date',
                        key: 'created_date',
                        width: 170,
                        sorter: true,
                        render: (date) => (
                            <span style={{ color: '#9ca3af' }}>
                                {date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'}
                            </span>
                        ),
                    },
                ];

            case 'employees':
                return [
                    ...baseColumns,
                    {
                        title: 'Employee ID',
                        dataIndex: 'employee_id',
                        key: 'employee_id',
                        width: 140,
                        render: (text) => <span style={{ color: '#a78bfa' }}>{text || '-'}</span>
                    },
                    {
                        title: 'Name',
                        key: 'name',
                        width: 180,
                        render: (_, record) => (
                            <div>
                                <div style={{ fontWeight: 600, color: '#f3f4f6' }}>
                                    {record.first_name || ''} {record.last_name || ''}
                                </div>
                            </div>
                        ),
                    },
                    {
                        title: 'Email',
                        dataIndex: 'email',
                        key: 'email',
                        width: 220,
                        render: (text) => <span style={{ color: '#cbd5e1' }}>{text || '-'}</span>
                    },
                    {
                        title: 'Department',
                        dataIndex: 'department_name',
                        key: 'department_name',
                        width: 160,
                        render: (text) => <span style={{ color: '#cbd5e1' }}>{text || '-'}</span>
                    },
                    {
                        title: 'Designation',
                        dataIndex: 'designation_name',
                        key: 'designation_name',
                        width: 160,
                        render: (text) => <span style={{ color: '#cbd5e1' }}>{text || '-'}</span>
                    },
                    {
                        title: 'Status',
                        dataIndex: 'is_active',
                        key: 'is_active',
                        width: 100,
                        render: (isActive) => (
                            <Tag color={isActive ? 'green' : 'red'}>
                                {isActive ? 'Active' : 'Inactive'}
                            </Tag>
                        ),
                    },
                ];

            case 'tasks':
                return [
                    ...baseColumns,
                    {
                        title: 'Task Title',
                        dataIndex: 'title',
                        key: 'title',
                        width: 250,
                        render: (text) => <span style={{ color: '#f3f4f6', fontWeight: 500 }}>{text || '-'}</span>
                    },
                    {
                        title: 'Assigned To',
                        key: 'assigned_to',
                        width: 160,
                        render: (_, record) => (
                            <span style={{ color: '#cbd5e1' }}>
                                {getUserNameById(record.assigned_to) || '-'}
                            </span>
                        ),
                    },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 120,
                        render: (status) => (
                            <Tag color={status === 'completed' ? 'green' : 'orange'}>
                                {status}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Priority',
                        dataIndex: 'priority',
                        key: 'priority',
                        width: 100,
                        render: (priority) => (
                            <Tag color={priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'blue'}>
                                {priority}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Due Date',
                        dataIndex: 'due_date',
                        key: 'due_date',
                        width: 150,
                        render: (date) => (
                            <span style={{ color: '#9ca3af' }}>
                                {date ? dayjs(date).format('YYYY-MM-DD') : '-'}
                            </span>
                        ),
                    },
                ];

            default:
                const sampleRecord = filteredData[0] || {};
                const keys = Object.keys(sampleRecord).filter(key => !key.startsWith('_') && key !== 'id');
                
                return [
                    ...baseColumns,
                    ...keys.slice(0, 6).map(key => ({
                        title: key.replace(/_/g, ' ').toUpperCase(),
                        dataIndex: key,
                        key: key,
                        width: 150,
                        render: (value) => {
                            if (typeof value === 'object') return <span style={{ color: '#6b7280' }}>{JSON.stringify(value)}</span>;
                            if (typeof value === 'boolean') return value ? 'Yes' : 'No';
                            return <span style={{ color: '#cbd5e1' }}>{value || '-'}</span>;
                        },
                    })),
                ];
        }
    };

    const getStatusColor = (status) => {
        if (!status) return 'default';
        const statusLower = status.toLowerCase();
        if (statusLower.includes('active') || statusLower.includes('new')) return 'blue';
        if (statusLower.includes('pending') || statusLower.includes('progress')) return 'orange';
        if (statusLower.includes('completed') || statusLower.includes('closed')) return 'green';
        if (statusLower.includes('rejected') || statusLower.includes('failed')) return 'red';
        return 'default';
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys, selectedRows) => {
            setSelectedRowKeys(selectedKeys);
            setSelectedRows(selectedRows);
        },
        getCheckboxProps: (record) => ({
            disabled: false
        }),
    };

    const sectionMenu = (
        <Menu
            selectedKeys={[selectedSection]}
            onClick={({ key }) => {
                setSelectedSection(key);
                resetFilters();
            }}
            style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
            {REPORT_SECTIONS.map(section => (
                <Menu.Item key={section.key} icon={section.icon} style={{ color: '#e5e7eb' }}>
                    {section.label}
                </Menu.Item>
            ))}
        </Menu>
    );

    const renderDetailContent = () => {
        if (!selectedLead) return null;

        const tabItems = [
            {
                key: 'about',
                label: <span><UserOutlined /> About</span>,
                children: (
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <Descriptions bordered column={2} size="small" style={{ background: '#1f2937' }}>
                            <Descriptions.Item label="Lead ID" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#e5e7eb' }}>{selectedLead.custom_lead_id || '-'}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Name" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#e5e7eb', fontWeight: 600 }}>
                                    {selectedLead.first_name || ''} {selectedLead.last_name || ''} {selectedLead.customer_name ? `(${selectedLead.customer_name})` : ''}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Email" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#cbd5e1' }}>{selectedLead.email || '-'}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Phone" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#cbd5e1' }}>{selectedLead.phone || '-'}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Status" labelStyle={{ color: '#9ca3af' }}>
                                <Tag color={getStatusColor(selectedLead.status)}>
                                    {selectedLead.status || '-'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Loan Amount" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#34d399', fontWeight: 600 }}>
                                    {selectedLead.loan_amount ? `₹${selectedLead.loan_amount.toLocaleString()}` : '-'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Assigned To" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#cbd5e1' }}>
                                    {getUserNameById(selectedLead.assigned_to) || '-'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Created Date" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#9ca3af' }}>
                                    {selectedLead.created_date || selectedLead.created_at ? dayjs(selectedLead.created_date || selectedLead.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                ),
            },
            {
                key: 'obligations',
                label: <span><FileProtectOutlined /> Obligations</span>,
                children: (
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {selectedLead.dynamic_fields?.obligations && Array.isArray(selectedLead.dynamic_fields.obligations) && selectedLead.dynamic_fields.obligations.length > 0 ? (
                            <Table
                                dataSource={selectedLead.dynamic_fields.obligations.map((obl, idx) => ({ ...obl, key: idx }))}
                                columns={[
                                    { title: '#', key: 'idx', width: 50, render: (_, __, idx) => <span style={{ color: '#9ca3af' }}>{idx + 1}</span> },
                                    { title: 'Type', dataIndex: 'type', key: 'type', width: 120, render: (t) => <span style={{ color: '#e5e7eb' }}>{t || '-'}</span> },
                                    { title: 'Bank', dataIndex: 'bank_name', key: 'bank_name', width: 150, render: (t) => <span style={{ color: '#cbd5e1' }}>{t || '-'}</span> },
                                    { title: 'EMI Amount', dataIndex: 'emi_amount', key: 'emi_amount', width: 120, render: (t) => <span style={{ color: '#f59e0b', fontWeight: 600 }}>{t ? `₹${Number(t).toLocaleString()}` : '-'}</span> },
                                    { title: 'Outstanding', dataIndex: 'outstanding_amount', key: 'outstanding_amount', width: 120, render: (t) => <span style={{ color: '#34d399', fontWeight: 600 }}>{t ? `₹${Number(t).toLocaleString()}` : '-'}</span> },
                                ]}
                                pagination={false}
                                size="small"
                                scroll={{ x: 1200 }}
                                style={{ background: '#1f2937' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                                No obligations data available
                            </div>
                        )}
                    </div>
                ),
            },
            {
                key: 'remarks',
                label: <span><FileTextOutlined /> Remarks</span>,
                children: (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <Descriptions bordered column={1} size="small" style={{ background: '#1f2937' }}>
                            <Descriptions.Item label="General Remarks" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                                    {selectedLead.remarks || selectedLead.notes || '-'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Login Remarks" labelStyle={{ color: '#9ca3af' }}>
                                <span style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                                    {selectedLead.login_remarks || '-'}
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                ),
            },
            {
                key: 'tasks',
                label: <span><CheckCircleOutlined /> Tasks</span>,
                children: (
                    <div>
                        {selectedLead.dynamic_fields?.tasks && selectedLead.dynamic_fields.tasks.length > 0 ? (
                            <Table
                                dataSource={selectedLead.dynamic_fields.tasks}
                                columns={[
                                    { title: 'Title', dataIndex: 'title', key: 'title', render: (t) => <span style={{ color: '#e5e7eb' }}>{t}</span> },
                                    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'completed' ? 'green' : 'orange'}>{s}</Tag> },
                                    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (p) => <Tag color={p === 'high' ? 'red' : 'blue'}>{p}</Tag> },
                                ]}
                                pagination={false}
                                size="small"
                                style={{ background: '#1f2937' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                                No tasks data available
                            </div>
                        )}
                    </div>
                ),
            },
            {
                key: 'attachments',
                label: <span><FileExcelOutlined /> Attachments</span>,
                children: (
                    <div>
                        {selectedLead.documents && selectedLead.documents.length > 0 ? (
                            <Table
                                dataSource={selectedLead.documents}
                                columns={[
                                    { title: 'Document Name', dataIndex: 'document_name', key: 'document_name', render: (t) => <span style={{ color: '#e5e7eb' }}>{t}</span> },
                                    { title: 'Type', dataIndex: 'document_type', key: 'document_type', render: (t) => <span style={{ color: '#cbd5e1' }}>{t}</span> },
                                ]}
                                pagination={false}
                                size="small"
                                style={{ background: '#1f2937' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                                No attachments available
                            </div>
                        )}
                    </div>
                ),
            },
            {
                key: 'activity',
                label: <span><HistoryOutlined /> Activity History</span>,
                children: (
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {selectedLead.activity && selectedLead.activity.length > 0 ? (
                            <Table
                                dataSource={selectedLead.activity}
                                columns={[
                                    { title: 'Date', dataIndex: 'timestamp', key: 'timestamp', width: 150, render: (t) => <span style={{ color: '#9ca3af', fontSize: '12px' }}>{t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'}</span> },
                                    { title: 'User', dataIndex: 'user', key: 'user', width: 120, render: (u) => <span style={{ color: '#a78bfa' }}>{u || '-'}</span> },
                                    { title: 'Action', dataIndex: 'action', key: 'action', render: (a) => <span style={{ color: '#e5e7eb' }}>{a}</span> },
                                ]}
                                pagination={false}
                                size="small"
                                style={{ background: '#1f2937' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                                No activity history available
                            </div>
                        )}
                    </div>
                ),
            },
        ];

        return (
            <Tabs
                activeKey={activeDetailTab}
                onChange={setActiveDetailTab}
                items={tabItems}
                style={{ background: '#111827', color: '#e5e7eb' }}
                tabBarStyle={{ background: '#1f2937', borderBottom: '1px solid #374151', color: '#9ca3af' }}
            />
        );
    };

    return (
        <div style={{ padding: '12px', backgroundColor: '#0f0f14', minHeight: '100vh', color: '#e5e7eb' }}>
            <style>{`
                .ant-table-thead > tr > th { background: #1f2937 !important; color: #e5e7eb !important; border-bottom:1px solid #374151 !important; padding: 5px 6px !important; font-size: 11px !important; }
                .ant-table-tbody > tr > td { background: #0f0f14 !important; color: #cbd5e1 !important; border-bottom:1px solid #1f2937 !important; padding: 5px 6px !important; font-size: 11px !important; }
                .ant-table-tbody > tr:hover > td { background: #1f2937 !important; cursor: pointer; }
                .ant-card { background: #111827 !important; border: 1px solid #1f2937 !important; }
                .ant-card-head { background: #1f2937 !important; border-bottom: 1px solid #374151 !important; padding: 10px 12px !important; }
                .ant-card-body { padding: 12px !important; }
                .ant-card-head-title { font-size: 13px !important; }
                .ant-statistic-title { font-size: 11px !important; }
                .ant-statistic-content { font-size: 18px !important; }
                .ant-descriptions-item-label { background: #1f2937 !important; color: #9ca3af !important; padding: 4px !important; font-size: 11px !important; }
                .ant-descriptions-item-content { background: #0f0f14 !important; color: #e5e7eb !important; padding: 4px !important; font-size: 11px !important; }
                .ant-modal-content { background: #111827 !important; }
                .ant-modal-header { background: #1f2937 !important; border-bottom: 1px solid #374151 !important; padding: 10px 12px !important; }
                .ant-modal-title { font-size: 13px !important; }
                .ant-modal-body { padding: 12px !important; }
                .ant-tabs-tab { color: #9ca3af !important; font-size: 11px !important; padding: 6px 10px !important; }
                .ant-tabs-tab-active { color: #667eea !important; }
                .ant-tabs-ink-bar { background: #667eea !important; }
                .ant-btn { font-size: 11px !important; padding: 3px 10px !important; height: 26px !important; }
                .ant-btn-sm { font-size: 10px !important; padding: 2px 8px !important; height: 24px !important; }
                .ant-input { font-size: 11px !important; padding: 3px 6px !important; }
                .ant-select { font-size: 11px !important; }
                .ant-tag { font-size: 10px !important; padding: 2px 5px !important; }
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: #0f0f14; }
                ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
            `}</style>
            
            <Card 
                title={<span style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}><FileTextOutlined style={{ marginRight: 6, color: '#667eea', fontSize: '13px' }} />Comprehensive Reports</span>}
                extra={
                    <Space size="small">
                        <Dropdown overlay={sectionMenu} trigger={['click']}>
                            <Button style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderColor: '#667eea', color: 'white', fontWeight: 500 }}>
                                <Space size="small">{REPORT_SECTIONS.find(s => s.key === selectedSection)?.icon} {REPORT_SECTIONS.find(s => s.key === selectedSection)?.label} <DownOutlined /></Space>
                            </Button>
                        </Dropdown>
                        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981' }}>Refresh</Button>
                    </Space>
                }
                style={{ borderRadius: '6px', boxShadow: '0 6px 24px rgba(0, 0, 0, 0.4)', border: '1px solid #1f2937' }}
            >
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '8px' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>Total Records</span>} value={statistics.total} prefix={<FileTextOutlined />} valueStyle={{ color: 'white', fontWeight: 'bold' }} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ background: 'linear-gradient(135deg, #667eea 0%, #1d4ed8 100%)', borderRadius: '8px' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>Active/Approved</span>} value={statistics.active} prefix={<CheckCircleOutlined />} valueStyle={{ color: 'white', fontWeight: 'bold' }} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '8px' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>Completed</span>} value={statistics.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: 'white', fontWeight: 'bold' }} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '8px' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>Pending</span>} value={statistics.pending} prefix={<ClockCircleOutlined />} valueStyle={{ color: 'white', fontWeight: 'bold' }} />
                        </Card>
                    </Col>
                </Row>

                <Card title={<span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '13px' }}><FilterOutlined /> Filters & Export</span>} style={{ marginBottom: 12, border: '1px solid #1f2937' }}>
                    <Row gutter={[8, 8]}>
                        <Col xs={24} sm={12} md={8} lg={6}><RangePicker style={{ width: '100%' }} value={filters.dateRange} onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))} placeholder={['Start Date', 'End Date']} /></Col>
                        <Col xs={24} sm={12} md={8} lg={6}><Select placeholder="Filter by Status" style={{ width: '100%' }} value={filters.status} onChange={(value) => setFilters(prev => ({ ...prev, status: value }))} allowClear><Option value="active">Active</Option><Option value="pending">Pending</Option><Option value="completed">Completed</Option><Option value="approved">Approved</Option><Option value="rejected">Rejected</Option></Select></Col>
                        <Col xs={24} sm={12} md={8} lg={6}><Search placeholder="Search..." allowClear enterButton prefix={<SearchOutlined />} onSearch={(value) => setFilters(prev => ({ ...prev, searchText: value }))} onChange={(e) => !e.target.value && setFilters(prev => ({ ...prev, searchText: '' }))} style={{ width: '100%' }} /></Col>
                        <Col xs={24} sm={12} md={8} lg={6}><Button onClick={resetFilters} style={{ width: '100%' }} icon={<ReloadOutlined />}>Reset Filters</Button></Col>
                        <Col xs={24} sm={12} md={4}><Button type="primary" icon={<FileExcelOutlined />} onClick={exportBulkToExcel} disabled={selectedRows.length === 0} style={{ width: '100%', background: selectedRows.length > 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : undefined }}>Export ({selectedRows.length})</Button></Col>
                        <Col xs={24} sm={12} md={4}><Button icon={<DownloadOutlined />} onClick={exportAllToExcel} disabled={filteredData.length === 0} style={{ width: '100%', background: filteredData.length > 0 ? 'rgba(16, 185, 129, 0.2)' : undefined }}>Export All</Button></Col>
                    </Row>
                </Card>

                <Spin spinning={loading} tip="Loading data..." size="large">
                    <div style={{ background: '#111827', borderRadius: '4px', padding: '8px', border: '1px solid #1f2937' }}>
                        <Table rowSelection={rowSelection} columns={getColumns()} dataSource={filteredData} rowKey={(record) => record._id?.$oid || record._id || record.id || Math.random()} scroll={{ x: 'max-content', y: 320 }} pagination={{ total: filteredData.length, pageSize: 50, showSizeChanger: true, showQuickJumper: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`, pageSizeOptions: ['10', '25', '50', '100', '200'] }} bordered size="small" onRow={(record) => ({ onClick: () => handleRowClick(record), style: { cursor: 'pointer' } })} />
                    </div>
                </Spin>
            </Card>

            <Modal title={<span style={{ color: '#f3f4f6', fontWeight: 600, fontSize: '13px' }}><UserOutlined /> Lead Details</span>} open={detailModalVisible} onCancel={() => { setDetailModalVisible(false); setSelectedLead(null); }} footer={null} width={600} style={{ top: 25 }}>
                <Spin spinning={detailLoading} tip="Loading lead details...">{renderDetailContent()}</Spin>
            </Modal>
        </div>
    );
};

export default ComprehensiveReportDark;
