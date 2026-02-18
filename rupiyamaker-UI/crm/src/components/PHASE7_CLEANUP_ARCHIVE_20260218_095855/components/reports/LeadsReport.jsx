import React, { useState, useEffect, useCallback } from 'react';
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
    Modal
} from 'antd';
import { 
    DownloadOutlined, 
    FileExcelOutlined, 
    ReloadOutlined,
    DollarOutlined,
    UserOutlined,
    BankOutlined,
    TrophyOutlined,
    EyeOutlined,
    PhoneOutlined,
    MailOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { leadsService } from '../../services/leadsService';
import { hrmsService } from '../../services/hrmsService';
import LeadDetails from '../LeadDetails';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;
const { Title } = Typography;

const LeadsReport = () => {
    const [loading, setLoading] = useState(false);
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState(['leads_summary', 'obligations', 'financial_details']);
    
    // View modal state
    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    
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
        totalLeads: 0,
        totalLoanAmount: 0,
        avgLoanAmount: 0,
        totalObligations: 0,
        avgObligations: 0,
        conversionRate: 0
    });
    
    // Store additional data for each lead
    const [leadsRemarks, setLeadsRemarks] = useState({});
    const [leadsAttachments, setLeadsAttachments] = useState({});
    const [fetchingAdditionalData, setFetchingAdditionalData] = useState(false);

    // Fetch users first
    const fetchUsers = async () => {
        try {
            const usersResponse = await hrmsService.getEmployees();
            if (usersResponse.success && Array.isArray(usersResponse.data)) {
                setUsers(usersResponse.data);
            } else if (usersResponse.data && Array.isArray(usersResponse.data.items)) {
                setUsers(usersResponse.data.items);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsers([]);
        }
    };

    // Fetch departments
    const fetchDepartments = async () => {
        try {
            const deptResponse = await hrmsService.getDepartments();
            if (deptResponse.success && Array.isArray(deptResponse.data)) {
                setDepartments(deptResponse.data);
            } else if (deptResponse.data && Array.isArray(deptResponse.data.items)) {
                setDepartments(deptResponse.data.items);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
            setDepartments([]);
        }
    };

    // Fetch all data
    const fetchData = async () => {
        setLoading(true);
        try {
            const leadsResponse = await leadsService.getAllLeads();
            
            if (leadsResponse.success) {
                let leadsData = [];
                if (Array.isArray(leadsResponse.data)) {
                    leadsData = leadsResponse.data;
                } else if (leadsResponse.data && Array.isArray(leadsResponse.data.items)) {
                    leadsData = leadsResponse.data.items;
                } else if (leadsResponse.data && Array.isArray(leadsResponse.data.data)) {
                    leadsData = leadsResponse.data.data;
                }
                
                setLeads(leadsData);
                setFilteredLeads(leadsData);
                
                // Fetch remarks and attachments for each lead
                await fetchAdditionalLeadsData(leadsData);
            } else {
                message.warning('Failed to fetch leads data');
                setLeads([]);
                setFilteredLeads([]);
            }

            await fetchDepartments();
        } catch (error) {
            console.error('Error fetching initial data:', error);
            message.error('Failed to fetch data');
            setLeads([]);
            setFilteredLeads([]);
        } finally {
            setLoading(false);
        }
    };
    
    // Fetch remarks and attachments for leads
    const fetchAdditionalLeadsData = async (leadsList) => {
        if (!leadsList || leadsList.length === 0) return;
        
        setFetchingAdditionalData(true);
        const remarksData = {};
        const attachmentsData = {};
        const userId = localStorage.getItem('userId') || '';
        
        try {
            // Fetch remarks and attachments for each lead (with concurrency limit)
            const batchSize = 10;
            for (let i = 0; i < leadsList.length; i += batchSize) {
                const batch = leadsList.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (lead) => {
                    try {
                        // Fetch remarks
                        const notesResponse = await fetch(`/api/leads/${lead._id}/notes?user_id=${userId}`);
                        if (notesResponse.ok) {
                            const notes = await notesResponse.json();
                            remarksData[lead._id] = notes || [];
                        }
                        
                        // Fetch attachments
                        const docsResponse = await fetch(`/api/leads/${lead._id}/documents?user_id=${userId}`);
                        if (docsResponse.ok) {
                            const docs = await docsResponse.json();
                            attachmentsData[lead._id] = docs || [];
                        }
                    } catch (error) {
                        console.error(`Error fetching additional data for lead ${lead._id}:`, error);
                    }
                }));
            }
            
            setLeadsRemarks(remarksData);
            setLeadsAttachments(attachmentsData);
            console.log('Additional data fetched:', {
                remarks: Object.keys(remarksData).length,
                attachments: Object.keys(attachmentsData).length
            });
        } catch (error) {
            console.error('Error fetching additional leads data:', error);
        } finally {
            setFetchingAdditionalData(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (users.length > 0) {
            fetchData();
        }
    }, [users.length]);

    useEffect(() => {
        applyFilters();
    }, [filters, leads]);

    useEffect(() => {
        calculateStatistics();
    }, [filteredLeads]);

    const applyFilters = () => {
        if (!Array.isArray(leads)) {
            setFilteredLeads([]);
            return;
        }

        let filtered = [...leads];

        if (filters.dateRange && filters.dateRange.length === 2) {
            const [startDate, endDate] = filters.dateRange;
            filtered = filtered.filter(lead => {
                const createdDate = dayjs(lead.created_date || lead.created_at);
                return createdDate.isAfter(startDate) && createdDate.isBefore(endDate);
            });
        }

        if (filters.status) {
            filtered = filtered.filter(lead => lead.status === filters.status);
        }

        if (filters.department) {
            filtered = filtered.filter(lead => lead.department_id === filters.department);
        }

        if (filters.assignedTo) {
            filtered = filtered.filter(lead => lead.assigned_to === filters.assignedTo);
        }

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
        if (!Array.isArray(filteredLeads)) {
            setStatistics({
                totalLeads: 0,
                totalLoanAmount: 0,
                avgLoanAmount: 0,
                totalObligations: 0,
                avgObligations: 0,
                conversionRate: 0
            });
            return;
        }

        const totalLeads = filteredLeads.length;
        const totalLoanAmount = filteredLeads.reduce((sum, lead) => sum + (lead.loan_amount || 0), 0);
        const avgLoanAmount = totalLeads > 0 ? totalLoanAmount / totalLeads : 0;

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
            conversionRate
        });
    };

    const getUserNameById = (userId, usersList) => {
        if (!userId) return '';
        const user = usersList.find(u => u._id === userId || u.id === userId);
        return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown';
    };

    const getAssignedUsersNames = (assignedTo, usersList) => {
        if (!assignedTo) return 'Unassigned';
        if (typeof assignedTo === 'string') {
            const user = usersList.find(u => u._id === assignedTo || u.id === assignedTo);
            return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown';
        }
        if (Array.isArray(assignedTo) && assignedTo.length > 0) {
            const names = assignedTo.map(id => {
                const user = usersList.find(u => u._id === id || u.id === id);
                return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown';
            });
            return names.join(', ');
        }
        return 'Unassigned';
    };

    const exportToExcel = () => {
        try {
            const workbook = XLSX.utils.book_new();

            // Leads Summary Sheet - Complete with all dropdown fields
            if (selectedColumns.includes('leads_summary')) {
                const summaryData = filteredLeads.map(lead => {
                    const personal = lead.dynamic_fields?.personal_details || {};
                    const financial = lead.dynamic_fields?.financial_details || {};
                    const applicant = lead.dynamic_fields?.applicant_form || {};
                    
                    return {
                        'Lead ID': lead.custom_lead_id || lead._id,
                        'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                        'Phone': lead.phone || lead.mobile_number,
                        'Email': lead.email || '',
                        'Alternative Phone': lead.alternative_phone || '',
                        'Loan Type': lead.loan_type_name || lead.loan_type,
                        'Loan Amount': lead.loan_amount || 0,
                        'Status': lead.status,
                        'Sub Status': lead.sub_status || '',
                        'Priority': lead.priority || '',
                        'Department': lead.department_name || '',
                        'Assigned To': getAssignedUsersNames(lead.assigned_to, users),
                        'Created By': lead.created_by_name || getUserNameById(lead.created_by, users),
                        'Created Date': lead.created_date ? dayjs(lead.created_date).format('YYYY-MM-DD') : '',
                        'Updated Date': lead.updated_date ? dayjs(lead.updated_date).format('YYYY-MM-DD') : '',
                        'Processing Bank': lead.processing_bank || '',
                        'Loan Tenure': lead.loan_tenure || '',
                        'Loan ROI': lead.loan_roi || '',
                        // Personal Details Dropdowns
                        'Company Name': personal.company_name || '',
                        'Company Type': Array.isArray(personal.company_type) ? personal.company_type.join(', ') : personal.company_type || '',
                        'Company Category': personal.company_category || '',
                        'Designation': personal.designation || '',
                        'Work Experience': personal.work_experience || '',
                        'Residence Type': personal.residence_type || '',
                        'Education': personal.education || '',
                        'Marital Status': personal.marital_status || '',
                        'City': lead.city || '',
                        'Postal Code': lead.postal_code || '',
                        // Financial Details
                        'Monthly Income': financial.monthly_income || 0,
                        'Annual Income': financial.annual_income || 0,
                        'Partner Salary': financial.partner_salary || 0,
                        'Yearly Bonus': financial.yearly_bonus || 0,
                        'CIBIL Score': financial.cibil_score || '',
                        'Bank Name': financial.bank_name || '',
                        'Bank Account Number': financial.bank_account_number || '',
                        'Total Obligations': lead.dynamic_fields?.eligibility_details?.totalObligations || 0,
                        // Applicant Form Details
                        'Reference Name': applicant.referenceName || '',
                        'Aadhar Number': applicant.aadharNumber || '',
                        'PAN Card': applicant.panCard || '',
                        'Father\'s Name': applicant.fathersName || '',
                        'Mother\'s Name': applicant.mothersName || ''
                    };
                });
                
                const summarySheet = XLSX.utils.json_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(workbook, summarySheet, 'Leads Summary');
            }

            // Complete Obligations Sheet with all fields
            if (selectedColumns.includes('obligations')) {
                const obligationData = [];
                filteredLeads.forEach(lead => {
                    const obligations = lead.dynamic_fields?.obligations || [];
                    const financial = lead.dynamic_fields?.financial_details || {};
                    const eligibility = lead.dynamic_fields?.eligibility_details || {};
                    
                    obligations.forEach((obligation, index) => {
                        obligationData.push({
                            'Lead ID': lead.custom_lead_id,
                            'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                            'Obligation #': index + 1,
                            'Product': obligation.product || '',
                            'Bank Name': obligation.bank_name || obligation.bankName || '',
                            'Total Loan': obligation.total_loan || 0,
                            'Outstanding': obligation.outstanding || 0,
                            'EMI': obligation.emi || 0,
                            'Tenure': obligation.tenure || 0,
                            'ROI': obligation.roi || 0,
                            'Action': obligation.action || '',
                            // Lead Context for Obligations
                            'Lead Status': lead.status,
                            'Priority': lead.priority || '',
                            'Loan Amount': lead.loan_amount || 0,
                            'Processing Bank': lead.processing_bank || '',
                            // Customer Income
                            'Monthly Income': financial.monthly_income || 0,
                            'Annual Income': financial.annual_income || 0,
                            'Partner Salary': financial.partner_salary || 0,
                            'CIBIL Score': financial.cibil_score || '',
                            'FOIR %': eligibility.foirPercent || '',
                            // Total Calculations
                            'Total Income': eligibility.totalIncome || 0,
                            'FOIR Amount': eligibility.foirAmount || 0,
                            'Total Obligations': eligibility.totalObligations || 0,
                            'Final Eligibility': eligibility.finalEligibility || 0
                        });
                    });
                });

                const obligationsSheet = XLSX.utils.json_to_sheet(obligationData);
                XLSX.utils.book_append_sheet(workbook, obligationsSheet, 'Obligations');
            }

            // Complete Financial Details Sheet
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
                        'CIBIL Score': financial.cibil_score || '',
                        'Bank Name': financial.bank_name || '',
                        'Bank Account Number': financial.bank_account_number || '',
                        'IFSC Code': financial.ifsc_code || '',
                        'Salary Credit Bank': financial.salary_account_bank || '',
                        'Salary Account Number': financial.salary_account_bank_number || '',
                        'Total Income': eligibility.totalIncome || 0,
                        'FOIR Amount': eligibility.foirAmount || 0,
                        'Total Obligations': eligibility.totalObligations || 0,
                        'Final Eligibility': eligibility.finalEligibility || 0,
                        'Multiplier Eligibility': eligibility.multiplierEligibility || 0,
                        'Tenure (Months)': eligibility.tenureMonths || 0,
                        'Tenure (Years)': eligibility.tenureYears || 0,
                        'ROI': eligibility.roi || 0,
                        'Custom FOIR %': eligibility.customFoirPercent || 0,
                        'Monthly EMI Can Pay': eligibility.monthlyEmiCanPay || 0
                    };
                });
                
                const financialSheet = XLSX.utils.json_to_sheet(financialData);
                XLSX.utils.book_append_sheet(workbook, financialSheet, 'Financial Details');
            }

            // Complete Personal Details Sheet
            if (selectedColumns.includes('personal_details')) {
                const personalData = filteredLeads.map(lead => {
                    const personal = lead.dynamic_fields?.personal_details || {};
                    const applicant = lead.dynamic_fields?.applicant_form || {};
                    const address = lead.dynamic_fields?.address || {};
                    
                    return {
                        'Lead ID': lead.custom_lead_id,
                        'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                        'Phone': lead.phone || '',
                        'Email': lead.email || '',
                        'Company Name': personal.company_name || '',
                        'Company Type': Array.isArray(personal.company_type) ? personal.company_type.join(', ') : personal.company_type || '',
                        'Company Category': personal.company_category || '',
                        'Designation': personal.designation || '',
                        'Department': personal.department || '',
                        'DOJ in Current Company': personal.dojCurrentCompany || '',
                        'Current Work Experience': personal.currentWorkExperience || '',
                        'Total Work Experience': personal.totalWorkExperience || '',
                        'Office Address': personal.officeAddress || '',
                        'Office Address Landmark': personal.officeAddressLandmark || '',
                        'Residence Type': personal.residenceType || personal.residence_type || '',
                        'Current Address': address.currentAddress || '',
                        'Current Address Landmark': address.currentAddressLandmark || '',
                        'Current Address Type': address.currentAddressType || '',
                        'Years at Current Address': address.yearsAtCurrentAddress || '',
                        'Years in Current City': address.yearsInCurrentCity || '',
                        'Permanent Address': address.permanentAddress || '',
                        'Permanent Address Landmark': address.permanentAddressLandmark || '',
                        'Education': personal.education || '',
                        'Marital Status': personal.maritalStatus || personal.marital_status || '',
                        'Spouse Name': personal.spousesName || applicant.spousesName || '',
                        'Father\'s Name': personal.fathersName || applicant.fathersName || '',
                        'Mother\'s Name': personal.mothersName || applicant.mothersName || '',
                        'City': lead.city || '',
                        'Postal Code': lead.postal_code || ''
                    };
                });
                
                const personalSheet = XLSX.utils.json_to_sheet(personalData);
                XLSX.utils.book_append_sheet(workbook, personalSheet, 'Personal Details');
            }

            // Remarks Sheet - NEW
            const remarksSheetData = [];
            filteredLeads.forEach(lead => {
                const remarks = leadsRemarks[lead._id] || [];
                remarks.forEach(remark => {
                    remarksSheetData.push({
                        'Lead ID': lead.custom_lead_id,
                        'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                        'Phone': lead.phone || '',
                        'Note Type': remark.note_type || 'General',
                        'Content': remark.content || '',
                        'Created By': remark.creator_name || 'Unknown',
                        'Created Date': remark.created_at ? dayjs(remark.created_at).format('YYYY-MM-DD HH:mm:ss') : ''
                    });
                });
            });
            
            if (remarksSheetData.length > 0) {
                const remarksSheet = XLSX.utils.json_to_sheet(remarksSheetData);
                XLSX.utils.book_append_sheet(workbook, remarksSheet, 'Remarks');
            }

            // Attachments Sheet - NEW
            const attachmentsSheetData = [];
            filteredLeads.forEach(lead => {
                const attachments = leadsAttachments[lead._id] || [];
                attachments.forEach(attachment => {
                    attachmentsSheetData.push({
                        'Lead ID': lead.custom_lead_id,
                        'Customer Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                        'Phone': lead.phone || '',
                        'Document Type': attachment.document_type || '',
                        'File Name': attachment.filename || attachment.file_name || '',
                        'File Size (MB)': attachment.fileSize ? (attachment.fileSize / 1024 / 1024).toFixed(2) : '',
                        'Upload Date': attachment.created_at ? dayjs(attachment.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
                        'Uploaded By': attachment.uploaded_by_name || 'Unknown',
                        'Has Password': attachment.has_password ? 'Yes' : 'No',
                        'Password': attachment.has_password ? attachment.password || '' : ''
                    });
                });
            });
            
            if (attachmentsSheetData.length > 0) {
                const attachmentsSheet = XLSX.utils.json_to_sheet(attachmentsSheetData);
                XLSX.utils.book_append_sheet(workbook, attachmentsSheet, 'Attachments');
            }

            const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
            const filename = `Leads_Report_${timestamp}.xlsx`;
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
            searchText: '',
            status: null,
            department: null,
            assignedTo: null
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

    const handleViewLead = (lead) => {
        setSelectedLead(lead);
        setViewModalVisible(true);
    };

    const handleCloseViewModal = () => {
        setViewModalVisible(false);
        setSelectedLead(null);
    };

    const handleLeadUpdate = useCallback((updatedLead) => {
        setLeads(prevLeads => 
            prevLeads.map(lead => 
                lead._id === updatedLead._id ? updatedLead : lead
            )
        );
        setFilteredLeads(prevFiltered => 
            prevFiltered.map(lead => 
                lead._id === updatedLead._id ? updatedLead : lead
            )
        );
        message.success('Lead updated successfully');
    }, []);

    const columns = [
        {
            title: 'Action',
            key: 'action',
            fixed: 'left',
            width: 80,
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewLead(record)}
                >
                    View
                </Button>
            ),
        },
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
            width: 130,
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            width: 200,
        },
        {
            title: 'Loan Type',
            dataIndex: 'loan_type_name',
            key: 'loan_type',
            width: 140,
        },
        {
            title: 'Loan Amount',
            dataIndex: 'loan_amount',
            key: 'loan_amount',
            render: (amount) => amount ? `₹${amount.toLocaleString()}` : '₹0',
            width: 130,
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
                
                return (
                    <Tooltip title={`${obligations.length} obligations, Total: ₹${totalObligations.toLocaleString()}`}>
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
            title: 'Assigned To',
            key: 'assigned_to',
            render: (_, record) => getAssignedUsersNames(record.assigned_to, users),
            width: 160,
        },
        {
            title: 'Department',
            dataIndex: 'department_name',
            key: 'department',
            width: 140,
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
                        onClick={fetchData}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Space>
            }>
                
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
                                placeholder="Department"
                                style={{ width: '100%' }}
                                value={filters.department}
                                onChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
                                allowClear
                            >
                                {departments.map(dept => (
                                    <Option key={dept._id || dept.id} value={dept._id || dept.id}>
                                        {dept.name}
                                    </Option>
                                ))}
                            </Select>
                        </Col>
                        <Col span={4}>
                            <Button onClick={resetFilters} style={{ width: '100%' }}>
                                Reset Filters
                            </Button>
                        </Col>
                    </Row>
                </Card>

                <Card title="Export Options" style={{ marginBottom: 24 }}>
                    <Checkbox.Group
                        value={selectedColumns}
                        onChange={setSelectedColumns}
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={5}>
                                <Checkbox value="leads_summary">Leads Summary</Checkbox>
                            </Col>
                            <Col span={5}>
                                <Checkbox value="obligations">Obligations Analysis</Checkbox>
                            </Col>
                            <Col span={5}>
                                <Checkbox value="financial_details">Financial Details</Checkbox>
                            </Col>
                            <Col span={5}>
                                <Checkbox value="personal_details">Personal Details</Checkbox>
                            </Col>
                        </Row>
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col span={5}>
                                <Checkbox value="remarks">Remarks</Checkbox>
                            </Col>
                            <Col span={5}>
                                <Checkbox value="attachments">Attachments</Checkbox>
                            </Col>
                            <Col span={5}>
                                <Checkbox value="activities">Activities</Checkbox>
                            </Col>
                        </Row>
                    </Checkbox.Group>
                    <div style={{ marginTop: 16, padding: '12px', background: '#e6f7ff', borderRadius: '4px' }}>
                        <small style={{ color: '#096dd9' }}>
                            ℹ️ Remarks and Attachments sheets are automatically included when data is available
                        </small>
                    </div>
                </Card>

                <Spin spinning={loading}>
                    <Table
                        columns={columns}
                        dataSource={filteredLeads}
                        rowKey={(record) => record._id}
                        scroll={{ x: 2000, y: 600 }}
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

            <Modal
                title={
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            {selectedLead ? 
                                `${selectedLead.first_name} ${selectedLead.last_name}`.trim() :
                                'Lead Details'
                            }
                        </Title>
                        {selectedLead && (
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                Lead ID: {selectedLead.custom_lead_id} | Phone: {selectedLead.phone}
                            </div>
                        )}
                    </div>
                }
                open={viewModalVisible}
                onCancel={handleCloseViewModal}
                footer={null}
                width="95%"
                style={{ top: 20 }}
                bodyStyle={{ padding: 0, height: 'calc(100vh - 150px)', overflow: 'auto' }}
            >
                {selectedLead && (
                    <LeadDetails
                        lead={selectedLead}
                        user={{ department: localStorage.getItem('userDepartment') || 'sales' }}
                        onBack={handleCloseViewModal}
                        onLeadUpdate={handleLeadUpdate}
                    />
                )}
            </Modal>
        </div>
    );
};

export default LeadsReport;