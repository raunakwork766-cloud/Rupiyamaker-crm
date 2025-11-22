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
    Tooltip,
    Input,
    Checkbox,
    Typography,
    Divider
} from 'antd';
import { 
    DownloadOutlined, 
    FileExcelOutlined, 
    ReloadOutlined,
    FilterOutlined,
    DollarOutlined,
    UserOutlined,
    BankOutlined,
    TrophyOutlined,
    TeamOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CalendarOutlined,
    FileTextOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { leadsService } from '../../services/leadsService';
import { hrmsService } from '../../services/hrmsService';
import { tasksService } from '../../services/tasksService';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;
const { Title } = Typography;

const LeadsReport = () => {
    // Report sections configuration
    const REPORT_SECTIONS = [
        { key: 'leads', label: 'Lead CRM', icon: <UserOutlined /> },
        { key: 'login-leads', label: 'Login Leads', icon: <UserOutlined /> },
        { key: 'employees', label: 'Employees', icon: <TeamOutlined /> },
        { key: 'attendance', label: 'Attendance', icon: <CalendarOutlined /> },
        { key: 'tasks', label: 'Tasks', icon: <CheckCircleOutlined /> },
        { key: 'leaves', label: 'Leaves', icon: <ClockCircleOutlined /> },
        { key: 'departments', label: 'Departments', icon: <BankOutlined /> },
        { key: 'roles', label: 'Roles & Permissions', icon: <TeamOutlined /> },
        { key: 'products', label: 'Products', icon: <FileTextOutlined /> },
        { key: 'holidays', label: 'Holidays', icon: <CalendarOutlined /> },
    ];

    const [selectedSection, setSelectedSection] = useState('leads');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    
    // Filters state
    const [filters, setFilters] = useState({
        dateRange: null,
        searchText: '',
        status: null,
        department: null,
        assignedTo: null,
    });

    // Statistics state
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

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Fetch leads data
            const leadsResponse = await leadsService.getAllLeads();
            console.log('Leads response:', leadsResponse);
            
            if (leadsResponse.success) {
                // Handle different response structures
                let leadsData = [];
                if (Array.isArray(leadsResponse.data)) {
                    leadsData = leadsResponse.data;
                } else if (leadsResponse.data && Array.isArray(leadsResponse.data.items)) {
                    leadsData = leadsResponse.data.items;
                } else if (leadsResponse.data && Array.isArray(leadsResponse.data.data)) {
                    leadsData = leadsResponse.data.data;
                }
                
                setLeads(leadsData);
                console.log('Leads data set:', leadsData.length, 'items');
            } else {
                console.warn('Failed to fetch leads:', leadsResponse);
                setLeads([]);
                message.warning('Failed to fetch leads data');
            }

            // Fetch departments
            const deptResponse = await hrmsService.getDepartments();
            if (deptResponse.success) {
                let deptData = [];
                if (Array.isArray(deptResponse.data)) {
                    deptData = deptResponse.data;
                } else if (deptResponse.data && Array.isArray(deptResponse.data.items)) {
                    deptData = deptResponse.data.items;
                }
                setDepartments(deptData);
            } else {
                setDepartments([]);
            }

            // Fetch loan types
            const loanTypesResponse = await leadsService.getLoanTypes();
            if (loanTypesResponse.success) {
                let loanTypesData = [];
                if (Array.isArray(loanTypesResponse.data)) {
                    loanTypesData = loanTypesResponse.data;
                } else if (loanTypesResponse.data && Array.isArray(loanTypesResponse.data.items)) {
                    loanTypesData = loanTypesResponse.data.items;
                }
                setLoanTypes(loanTypesData);
            } else {
                setLoanTypes([]);
            }

            // Fetch all users for assigned_to mapping
            const usersResponse = await hrmsService.getEmployees();
            if (usersResponse.success) {
                let usersData = [];
                if (Array.isArray(usersResponse.data)) {
                    usersData = usersResponse.data;
                } else if (usersResponse.data && Array.isArray(usersResponse.data.items)) {
                    usersData = usersResponse.data.items;
                }
                setUsers(usersData);
                console.log('Users data loaded:', usersData.length, 'users');
            } else {
                setUsers([]);
            }

        } catch (error) {
            console.error('Error fetching initial data:', error);
            message.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        // Ensure leads is an array before trying to spread it
        if (!Array.isArray(leads)) {
            console.warn('Leads is not an array:', leads);
            setFilteredLeads([]);
            return;
        }

        let filtered = [...leads];

        // Date range filter
        if (filters.dateRange && filters.dateRange.length === 2) {
            const [startDate, endDate] = filters.dateRange;
            filtered = filtered.filter(lead => {
                const createdDate = dayjs(lead.created_date || lead.created_at);
                return createdDate.isAfter(startDate) && createdDate.isBefore(endDate);
            });
        }

        // Status filter
        if (filters.status) {
            filtered = filtered.filter(lead => lead.status === filters.status);
        }

        // Sub-status filter
        if (filters.subStatus) {
            filtered = filtered.filter(lead => lead.sub_status === filters.subStatus);
        }

        // Department filter
        if (filters.department) {
            filtered = filtered.filter(lead => lead.department_id === filters.department);
        }

        // Loan type filter
        if (filters.loanType) {
            filtered = filtered.filter(lead => lead.loan_type_id === filters.loanType);
        }

        // Priority filter
        if (filters.priority) {
            filtered = filtered.filter(lead => lead.priority === filters.priority);
        }

        // Search text filter
        if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            filtered = filtered.filter(lead => 
                (lead.first_name || '').toLowerCase().includes(searchLower) ||
                (lead.last_name || '').toLowerCase().includes(searchLower) ||
                (lead.phone || '').includes(searchLower) ||
                (lead.custom_lead_id || '').toLowerCase().includes(searchLower) ||
                (lead.email || '').toLowerCase().includes(searchLower)
            );
        }

        setFilteredLeads(filtered);
    };

    const calculateStatistics = () => {
        // Ensure filteredLeads is an array
        if (!Array.isArray(filteredLeads)) {
            console.warn('FilteredLeads is not an array:', filteredLeads);
            setStatistics({
                totalLeads: 0,
                totalLoanAmount: 0,
                avgLoanAmount: 0,
                totalObligations: 0,
                avgObligations: 0,
                conversionRate: 0,
                statusDistribution: {},
                departmentDistribution: {}
            });
            return;
        }

        const totalLeads = filteredLeads.length;
        const totalLoanAmount = filteredLeads.reduce((sum, lead) => sum + (lead.loan_amount || 0), 0);
        const avgLoanAmount = totalLeads > 0 ? totalLoanAmount / totalLeads : 0;

        // Calculate obligations
        let totalObligations = 0;
        let obligationCount = 0;
        
        filteredLeads.forEach(lead => {
            const obligations = lead.dynamic_fields?.obligations || [];
            obligations.forEach(obligation => {
                totalObligations += (obligation.outstanding || obligation.total_loan || 0);
                obligationCount++;
            });
        });

        const avgObligations = obligationCount > 0 ? totalObligations / obligationCount : 0;

        // Status distribution
        const statusDistribution = {};
        filteredLeads.forEach(lead => {
            const status = lead.status || 'Unknown';
            statusDistribution[status] = (statusDistribution[status] || 0) + 1;
        });

        // Department distribution
        const departmentDistribution = {};
        filteredLeads.forEach(lead => {
            const deptName = lead.department_name || 'Unknown';
            departmentDistribution[deptName] = (departmentDistribution[deptName] || 0) + 1;
        });

        // Conversion rate (assuming 'WON' or 'DISBURSED' as converted)
        const convertedLeads = filteredLeads.filter(lead => 
            ['WON', 'DISBURSED', 'COMPLETED'].includes(lead.status?.toUpperCase())
        ).length;
        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        setStatistics({
            totalLeads,
            totalLoanAmount,
            avgLoanAmount,
            totalObligations,
            avgObligations,
            conversionRate,
            statusDistribution,
            departmentDistribution
        });
    };

    const exportToExcel = () => {
        try {
            // Create workbook
            const workbook = XLSX.utils.book_new();

            // Leads Summary Sheet
            if (selectedColumns.includes('leads_summary')) {
                const summaryData = filteredLeads.map(lead => ({
                    'Lead ID': lead.custom_lead_id || lead._id?.$oid || lead._id,
                    'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                    'Phone': lead.phone || lead.mobile_number,
                    'Email': lead.email || '',
                    'Loan Type': lead.loan_type_name || lead.loan_type,
                    'Loan Amount': lead.loan_amount || 0,
                    'Status': lead.status,
                    'Sub Status': lead.sub_status || '',
                    'Priority': lead.priority || '',
                    'Department': lead.department_name || '',
                    'Assigned To': getAssignedUsersNames(lead.assigned_to, users),
                    'Created By': lead.created_by_name || getUserNameById(lead.created_by, users),
                    'Created Date': lead.created_date ? dayjs(lead.created_date).format('YYYY-MM-DD') : '',
                    'Updated Date': lead.updated_at ? dayjs(lead.updated_at).format('YYYY-MM-DD') : '',
                    'Campaign': lead.campaign_name || '',
                    'Processing Bank': lead.processing_bank || '',
                    'Data Code': lead.data_code || '',
                    'Source': lead.source || ''
                }));
                
                const summarySheet = XLSX.utils.json_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(workbook, summarySheet, 'Leads Summary');
            }

            // Obligations Analysis Sheet
            if (selectedColumns.includes('obligations')) {
                const obligationData = [];
                filteredLeads.forEach(lead => {
                    const processedObligations = processObligationData(lead, users);
                    obligationData.push(...processedObligations);
                });

                const obligationsSheet = XLSX.utils.json_to_sheet(obligationData.map(ob => ({
                    'Lead ID': ob.custom_lead_id,
                    'Customer Name': ob.customer_name,
                    'Phone': ob.phone,
                    'Email': ob.email,
                    'Assigned To': ob.assigned_to,
                    'Department': ob.department,
                    'Obligation #': ob.obligation_index,
                    'Product': ob.product,
                    'Bank Name': ob.bank_name,
                    'Total Loan': ob.total_loan,
                    'Outstanding': ob.outstanding,
                    'EMI': ob.emi,
                    'Tenure (Months)': ob.tenure,
                    'ROI (%)': ob.roi,
                    'Action': ob.action,
                    'Lead Status': ob.lead_status,
                    'Lead Sub Status': ob.lead_sub_status,
                    'Lead Priority': ob.lead_priority,
                    'Lead Loan Amount': ob.lead_loan_amount,
                    'Lead Loan Type': ob.lead_loan_type,
                    'Processing Bank': ob.processing_bank,
                    'Monthly Income': ob.monthly_income,
                    'Annual Income': ob.annual_income,
                    'Partner Salary': ob.partner_salary,
                    'CIBIL Score': ob.cibil_score,
                    'FOIR %': ob.foir_percent,
                    'Total Income': ob.total_income,
                    'FOIR Amount': ob.foir_amount,
                    'Total Obligations': ob.total_obligations,
                    'Final Eligibility': ob.final_eligibility,
                    'Created By': ob.created_by,
                    'Created Date': ob.created_date,
                    'Updated Date': ob.updated_date,
                    'Operations Amount Approved': ob.operations_amount_approved,
                    'Operations Amount Disbursed': ob.operations_amount_disbursed,
                    'Operations Disbursement Date': ob.operations_disbursement_date,
                    'File Sent to Login': ob.file_sent_to_login,
                    'Login Status': ob.login_status,
                    'Login Remarks': ob.login_remarks
                })));
                XLSX.utils.book_append_sheet(workbook, obligationsSheet, 'Obligations Analysis');
            }

            // Financial Details Sheet
            if (selectedColumns.includes('financial_details')) {
                const financialData = filteredLeads.map(lead => {
                    const financial = lead.dynamic_fields?.financial_details || {};
                    const eligibility = lead.dynamic_fields?.eligibility_details || {};
                    
                    return {
                        'Lead ID': lead.custom_lead_id,
                        'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                        'Monthly Income': financial.monthly_income || 0,
                        'Annual Income': financial.annual_income || 0,
                        'Partner Salary': financial.partner_salary || 0,
                        'Yearly Bonus': financial.yearly_bonus || 0,
                        'FOIR %': financial.foir_percent || 0,
                        'CIBIL Score': financial.cibil_score || '',
                        'Bank Name': financial.bank_name || '',
                        'Total Income': eligibility.totalIncome || 0,
                        'FOIR Amount': eligibility.foirAmount || 0,
                        'Total Obligations': eligibility.totalObligations || 0,
                        'Final Eligibility': eligibility.finalEligibility || 0,
                        'Multiplier Eligibility': eligibility.multiplierEligibility || 0
                    };
                });
                
                const financialSheet = XLSX.utils.json_to_sheet(financialData);
                XLSX.utils.book_append_sheet(workbook, financialSheet, 'Financial Details');
            }

            // Operations Data Sheet
            if (selectedColumns.includes('operations_info')) {
                const operationsData = filteredLeads.map(lead => ({
                    'Lead ID': lead.custom_lead_id,
                    'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                    'Amount Approved': lead.operations_amount_approved || '',
                    'Amount Disbursed': lead.operations_amount_disbursed || '',
                    'Cashback to Customer': lead.operations_cashback_to_customer || '',
                    'Net Disbursement': lead.operations_net_disbursement_amount || '',
                    'Rate': lead.operations_rate || '',
                    'Tenure Given': lead.operations_tenure_given || '',
                    'Disbursement Date': lead.operations_disbursement_date || '',
                    'Channel Name': lead.operations_channel_name || '',
                    'LOS Number': lead.operations_los_number || '',
                    'Updated By': lead.operations_updated_by || ''
                }));
                
                const operationsSheet = XLSX.utils.json_to_sheet(operationsData);
                XLSX.utils.book_append_sheet(workbook, operationsSheet, 'Operations Data');
            }

            // Assignment History Sheet
            if (selectedColumns.includes('assignment_info')) {
                const assignmentData = [];
                filteredLeads.forEach(lead => {
                    const history = lead.assignment_history || [];
                    history.forEach((assignment, index) => {
                        assignmentData.push({
                            'Lead ID': lead.custom_lead_id,
                            'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                            'Assignment #': index + 1,
                            'Department': assignment.department_id || '',
                            'Assigned Date': assignment.assigned_date ? dayjs(assignment.assigned_date).format('YYYY-MM-DD HH:mm') : '',
                            'Transferred Date': assignment.transferred_date ? dayjs(assignment.transferred_date).format('YYYY-MM-DD HH:mm') : '',
                            'Transferred By': assignment.transferred_by || '',
                            'Transferred To': assignment.transferred_to || ''
                        });
                    });
                });
                
                const assignmentSheet = XLSX.utils.json_to_sheet(assignmentData);
                XLSX.utils.book_append_sheet(workbook, assignmentSheet, 'Assignment History');
            }

            // Statistics Sheet
            const statsData = [
                { 'Metric': 'Total Leads', 'Value': statistics.totalLeads },
                { 'Metric': 'Total Loan Amount', 'Value': statistics.totalLoanAmount },
                { 'Metric': 'Average Loan Amount', 'Value': Math.round(statistics.avgLoanAmount) },
                { 'Metric': 'Total Obligations', 'Value': Math.round(statistics.totalObligations) },
                { 'Metric': 'Average Obligations', 'Value': Math.round(statistics.avgObligations) },
                { 'Metric': 'Conversion Rate (%)', 'Value': statistics.conversionRate.toFixed(2) }
            ];

            const statsSheet = XLSX.utils.json_to_sheet(statsData);
            XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

            // Generate filename with timestamp
            const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
            const filename = `Leads_Report_${timestamp}.xlsx`;

            // Export file
            XLSX.writeFile(workbook, filename);
            message.success(`Report exported successfully as ${filename}`);

        } catch (error) {
            console.error('Error exporting to Excel:', error);
            message.error('Failed to export report');
        }
    };

    const resetFilters = () => {
        setFilters({
            dateRange: null,
            status: null,
            subStatus: null,
            department: null,
            loanType: null,
            assignedTo: null,
            priority: null,
            searchText: ''
        });
    };

    const getStatusColor = (status) => {
        const colors = {
            'WON': 'green',
            'LOST': 'red',
            'DISBURSED': 'blue',
            'IN PROGRESS': 'orange',
            'PENDING': 'yellow',
            'COMPLETED': 'cyan'
        };
        return colors[status?.toUpperCase()] || 'default';
    };

    const columns = [
        {
            title: 'Lead ID',
            dataIndex: 'custom_lead_id',
            key: 'custom_lead_id',
            fixed: 'left',
            width: 120,
        },
        {
            title: 'Customer Name',
            key: 'customer_name',
            render: (_, record) => `${record.first_name || ''} ${record.last_name || ''}`.trim(),
            width: 180,
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
            width: 120,
        },
        {
            title: 'Loan Type',
            dataIndex: 'loan_type_name',
            key: 'loan_type',
            width: 120,
        },
        {
            title: 'Loan Amount',
            dataIndex: 'loan_amount',
            key: 'loan_amount',
            render: (amount) => amount ? `₹${amount.toLocaleString()}` : '₹0',
            width: 120,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={getStatusColor(status)}>
                    {status || 'Unknown'}
                </Tag>
            ),
            width: 120,
        },
        {
            title: 'Obligations',
            key: 'obligations',
            render: (_, record) => {
                const obligations = record.dynamic_fields?.obligations || [];
                const totalObligations = obligations.reduce((sum, ob) => 
                    sum + (ob.outstanding || ob.total_loan || 0), 0
                );
                const totalEMI = obligations.reduce((sum, ob) => 
                    sum + (ob.emi || 0), 0
                );
                
                return (
                    <Tooltip title={
                        <div>
                            <div><strong>Total Obligations:</strong> {obligations.length}</div>
                            <div><strong>Total Outstanding:</strong> ₹{totalObligations.toLocaleString()}</div>
                            <div><strong>Total EMI:</strong> ₹{totalEMI.toLocaleString()}</div>
                            {obligations.map((ob, idx) => (
                                <div key={idx} style={{ marginTop: 4, borderTop: '1px solid #f0f0f0', paddingTop: 4 }}>
                                    <div><strong>{ob.product || 'Unknown Product'}</strong></div>
                                    <div>Bank: {ob.bank_name || ob.bankName || 'Unknown'}</div>
                                    <div>Outstanding: ₹{(ob.outstanding || ob.total_loan || 0).toLocaleString()}</div>
                                    <div>EMI: ₹{(ob.emi || 0).toLocaleString()}</div>
                                    <div>Action: {ob.action || 'None'}</div>
                                </div>
                            ))}
                        </div>
                    }>
                        <div>
                            <div>{obligations.length} obligations</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                ₹{totalObligations.toLocaleString()}
                            </div>
                        </div>
                    </Tooltip>
                );
            },
            width: 140,
        },
        {
            title: 'CIBIL Score',
            key: 'cibil_score',
            render: (_, record) => record.dynamic_fields?.financial_details?.cibil_score || 'N/A',
            width: 100,
        },
        {
            title: 'Assigned To',
            key: 'assigned_to',
            render: (_, record) => getAssignedUsersNames(record.assigned_to, users),
            width: 150,
        },
        {
            title: 'Department',
            dataIndex: 'department_name',
            key: 'department',
            width: 120,
        },
        {
            title: 'Created Date',
            key: 'created_date',
            render: (_, record) => dayjs(record.created_date || record.created_at).format('DD/MM/YYYY'),
            width: 120,
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card title="Leads Reports & Analytics" extra={
                <Space>
                    <Button 
                        type="primary" 
                        icon={<FileExcelOutlined />}
                        onClick={exportToExcel}
                        disabled={filteredLeads.length === 0}
                    >
                        Export to Excel
                    </Button>
                    <Button 
                        icon={<ReloadOutlined />}
                        onClick={fetchInitialData}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Space>
            }>
                
                {/* Statistics Cards */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Total Leads"
                                value={statistics.totalLeads}
                                prefix={<UserOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Total Loan Amount"
                                value={statistics.totalLoanAmount}
                                prefix={<DollarOutlined />}
                                formatter={(value) => `₹${value.toLocaleString()}`}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Total Obligations"
                                value={Math.round(statistics.totalObligations)}
                                prefix={<BankOutlined />}
                                formatter={(value) => `₹${value.toLocaleString()}`}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Conversion Rate"
                                value={statistics.conversionRate}
                                prefix={<TrophyOutlined />}
                                suffix="%"
                                precision={2}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Filters */}
                <Card title="Filters" style={{ marginBottom: 24 }}>
                    <Row gutter={[16, 16]}>
                        <Col span={6}>
                            <Search
                                placeholder="Search by name, phone, email..."
                                value={filters.searchText}
                                onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                                allowClear
                            />
                        </Col>
                        <Col span={6}>
                            <RangePicker
                                style={{ width: '100%' }}
                                value={filters.dateRange}
                                onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
                                placeholder={['Start Date', 'End Date']}
                            />
                        </Col>
                        <Col span={4}>
                            <Select
                                placeholder="Status"
                                style={{ width: '100%' }}
                                value={filters.status}
                                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                                allowClear
                            >
                                <Option value="WON">Won</Option>
                                <Option value="LOST">Lost</Option>
                                <Option value="IN PROGRESS">In Progress</Option>
                                <Option value="PENDING">Pending</Option>
                                <Option value="DISBURSED">Disbursed</Option>
                            </Select>
                        </Col>
                        <Col span={4}>
                            <Select
                                placeholder="Priority"
                                style={{ width: '100%' }}
                                value={filters.priority}
                                onChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
                                allowClear
                            >
                                <Option value="high">High</Option>
                                <Option value="medium">Medium</Option>
                                <Option value="low">Low</Option>
                            </Select>
                        </Col>
                        <Col span={4}>
                            <Button onClick={resetFilters} style={{ width: '100%' }}>
                                Reset Filters
                            </Button>
                        </Col>
                    </Row>
                </Card>

                {/* Export Options */}
                <Card title="Export Options" style={{ marginBottom: 24 }}>
                    <Checkbox.Group
                        value={selectedColumns}
                        onChange={setSelectedColumns}
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={6}>
                                <Checkbox value="leads_summary">Leads Summary</Checkbox>
                            </Col>
                            <Col span={6}>
                                <Checkbox value="obligations">Obligations Analysis</Checkbox>
                            </Col>
                            <Col span={6}>
                                <Checkbox value="financial_details">Financial Details</Checkbox>
                            </Col>
                            <Col span={6}>
                                <Checkbox value="operations_info">Operations Data</Checkbox>
                            </Col>
                            <Col span={6}>
                                <Checkbox value="assignment_info">Assignment History</Checkbox>
                            </Col>
                        </Row>
                    </Checkbox.Group>
                </Card>

                {/* Data Table */}
                <Spin spinning={loading}>
                    <Table
                        columns={columns}
                        dataSource={filteredLeads}
                        rowKey={(record) => record._id?.$oid || record._id}
                        scroll={{ x: 1800, y: 600 }}
                        pagination={{
                            total: filteredLeads.length,
                            pageSize: 50,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} leads`
                        }}
                    />
                </Spin>
            </Card>
        </div>
    );
};

export default LeadsReport;
