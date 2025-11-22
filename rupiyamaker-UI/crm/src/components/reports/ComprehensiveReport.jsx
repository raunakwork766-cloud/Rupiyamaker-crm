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
    Menu
} from 'antd';
import { 
    DownloadOutlined, 
    FileExcelOutlined, 
    ReloadOutlined,
    UserOutlined,
    BankOutlined,
    TeamOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CalendarOutlined,
    FileTextOutlined,
    DownOutlined,
    DollarOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { leadsService } from '../../services/leadsService';
import { hrmsService } from '../../services/hrmsService';
import axios from 'axios';

const { RangePicker } = DatePicker;
const { Option } = Select;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://156.67.111.95:8049';

const ComprehensiveReport = () => {
    // Report sections configuration
    const REPORT_SECTIONS = [
        { key: 'leads', label: 'Lead CRM', icon: <UserOutlined /> },
        { key: 'login-leads', label: 'Login Leads', icon: <FileTextOutlined /> },
        { key: 'employees', label: 'Employees', icon: <TeamOutlined /> },
        { key: 'attendance', label: 'Attendance', icon: <CalendarOutlined /> },
        { key: 'tasks', label: 'Tasks', icon: <CheckCircleOutlined /> },
        { key: 'leaves', label: 'Leaves', icon: <ClockCircleOutlined /> },
        { key: 'departments', label: 'Departments', icon: <BankOutlined /> },
        { key: 'roles', label: 'Roles & Permissions', icon: <TeamOutlined /> },
        { key: 'products', label: 'Products', icon: <DollarOutlined /> },
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

    // Field name mappings for user-friendly Excel headers
    const FIELD_NAME_MAPPINGS = {
        // Basic Information
        'lead_id': 'Lead ID (Database)',
        'custom_lead_id': 'Lead ID',
        'first_name': 'First Name',
        'last_name': 'Last Name',
        'email': 'Email Address',
        'phone': 'Phone Number',
        'mobile_number': 'Mobile Number',
        'alternate_phone': 'Alternate Phone',
        
        // Status Information
        'status': 'Status',
        'sub_status': 'Sub Status',
        'priority': 'Priority',
        
        // Loan Information
        'loan_amount': 'Loan Amount',
        'loan_type': 'Loan Type',
        'loan_type_name': 'Loan Type Name',
        'processing_bank': 'Processing Bank',
        'bank_name': 'Bank Name',
        
        // Assignment Information
        'assigned_to': 'Assigned To',
        'created_by': 'Created By',
        'updated_by': 'Updated By',
        'department': 'Department',
        'department_name': 'Department Name',
        
        // Dates
        'created_date': 'Created Date',
        'updated_date': 'Updated Date',
        'created_at': 'Created At',
        'updated_at': 'Updated At',
        'date': 'Date',
        'timestamp': 'Timestamp',
        
        // Personal Details
        'personal_details_father_name': 'Father Name',
        'personal_details_mother_name': 'Mother Name',
        'personal_details_spouse_name': 'Spouse Name',
        'personal_details_date_of_birth': 'Date of Birth',
        'personal_details_dob': 'Date of Birth',
        'personal_details_gender': 'Gender',
        'personal_details_marital_status': 'Marital Status',
        'personal_details_education': 'Education',
        'personal_details_qualification': 'Qualification',
        'personal_details_current_address': 'Current Address',
        'personal_details_permanent_address': 'Permanent Address',
        'personal_details_address': 'Address',
        'personal_details_city': 'City',
        'personal_details_state': 'State',
        'personal_details_pincode': 'Pincode',
        'personal_details_postal_code': 'Postal Code',
        'personal_details_country': 'Country',
        'personal_details_nationality': 'Nationality',
        'personal_details_pan_number': 'PAN Number',
        'personal_details_aadhar_number': 'Aadhar Number',
        'personal_details_passport_number': 'Passport Number',
        
        // Employment Details
        'employment_details_employment_type': 'Employment Type',
        'employment_details_company_name': 'Company Name',
        'employment_details_employer_name': 'Employer Name',
        'employment_details_designation': 'Designation',
        'employment_details_job_title': 'Job Title',
        'employment_details_years_in_current_job': 'Years in Current Job',
        'employment_details_total_experience': 'Total Experience',
        'employment_details_monthly_salary': 'Monthly Salary',
        'employment_details_gross_salary': 'Gross Salary',
        'employment_details_net_salary': 'Net Salary',
        'employment_details_office_address': 'Office Address',
        'employment_details_office_phone': 'Office Phone',
        'employment_details_office_email': 'Office Email',
        'employment_details_employee_id': 'Employee ID',
        
        // Business Details
        'business_details_business_name': 'Business Name',
        'business_details_business_type': 'Business Type',
        'business_details_nature_of_business': 'Nature of Business',
        'business_details_years_in_business': 'Years in Business',
        'business_details_monthly_income': 'Monthly Income',
        'business_details_annual_turnover': 'Annual Turnover',
        'business_details_business_address': 'Business Address',
        'business_details_gst_number': 'GST Number',
        'business_details_business_pan': 'Business PAN',
        
        // Financial Details
        'financial_details_monthly_income': 'Monthly Income',
        'financial_details_annual_income': 'Annual Income',
        'financial_details_partner_salary': 'Partner Salary',
        'financial_details_spouse_income': 'Spouse Income',
        'financial_details_yearly_bonus': 'Yearly Bonus',
        'financial_details_other_income': 'Other Income',
        'financial_details_total_income': 'Total Income',
        'financial_details_foir_percent': 'FOIR %',
        'financial_details_foir': 'FOIR',
        'financial_details_cibil_score': 'CIBIL Score',
        'financial_details_credit_score': 'Credit Score',
        'financial_details_bank_name': 'Bank Name',
        'financial_details_account_number': 'Account Number',
        'financial_details_ifsc_code': 'IFSC Code',
        
        // Residence Details
        'residence_details_residence_type': 'Residence Type',
        'residence_details_ownership_status': 'Ownership Status',
        'residence_details_years_at_current_residence': 'Years at Current Residence',
        'residence_details_monthly_rent': 'Monthly Rent',
        
        // Obligations
        'obligations_type': 'Obligation Type',
        'obligations_bank_name': 'Bank Name',
        'obligations_emi_amount': 'EMI Amount',
        'obligations_outstanding_amount': 'Outstanding Amount',
        'obligations_tenure_left': 'Tenure Left',
        
        // Operations Data
        'operations_amount_approved': 'Amount Approved',
        'operations_amount_disbursed': 'Amount Disbursed',
        'operations_disbursement_date': 'Disbursement Date',
        'operations_cashback_to_customer': 'Cashback to Customer',
        'operations_net_disbursement_amount': 'Net Disbursement Amount',
        'operations_rate': 'Rate',
        'operations_tenure_given': 'Tenure Given',
        'operations_channel_name': 'Channel Name',
        'operations_los_number': 'LOS Number',
        'operations_updated_by': 'Updated By',
        'operations_remarks': 'Operations Remarks',
        
        // Login Information
        'file_sent_to_login': 'File Sent to Login',
        'login_status': 'Login Status',
        'login_date': 'Login Date',
        'login_remarks': 'Login Remarks',
        
        // Documents
        'document_type': 'Document Type',
        'document_name': 'Document Name',
        'file_name': 'File Name',
        'file_path': 'File Path',
        'file_url': 'File URL',
        'uploaded_date': 'Uploaded Date',
        'uploaded_by': 'Uploaded By',
        
        // Activity
        'action': 'Action',
        'description': 'Description',
        'field_changed': 'Field Changed',
        'old_value': 'Old Value',
        'new_value': 'New Value',
        'user': 'User',
        'user_name': 'User Name',
        
        // Other Common Fields
        'remarks': 'Remarks',
        'comments': 'Comments',
        'notes': 'Notes',
        'reference_number': 'Reference Number',
        'application_number': 'Application Number',
        'source': 'Source',
        'campaign': 'Campaign',
        'is_active': 'Is Active',
        'is_deleted': 'Is Deleted',
        'documents': 'Documents',
        'activity': 'Activity Log',
        'importantquestion': 'Important Questions',
        'question_responses': 'Question Responses',
        'process_data': 'Process Data',
        'dynamic_fields': 'Dynamic Fields',
        
        // ID fields
        '_id': 'ID',
        'id': 'ID',
        '$oid': 'Object ID',
        'employee_id': 'Employee ID',
        'user_id': 'User ID',
        'department_id': 'Department ID',
    };

    // Convert backend field names to frontend display names
    const convertToFrontendNames = (data) => {
        const converted = {};
        Object.keys(data).forEach(key => {
            const friendlyName = FIELD_NAME_MAPPINGS[key] || 
                                 key.split('_').map(word => 
                                     word.charAt(0).toUpperCase() + word.slice(1)
                                 ).join(' ');
            converted[friendlyName] = data[key];
        });
        return converted;
    };

    // Helper function to get user name by ID
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

    // Fetch users
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

    // Fetch data based on selected section
    const fetchData = async () => {
        setLoading(true);
        try {
            let response;
            let fetchedData = [];

            switch (selectedSection) {
                case 'leads':
                    response = await leadsService.getAllLeads();
                    if (response.success) {
                        fetchedData = Array.isArray(response.data) ? response.data : 
                                     (response.data.items ? response.data.items : []);
                    }
                    break;

                case 'login-leads':
                    const loginResponse = await axios.get(`${API_BASE_URL}/api/login-leads`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = loginResponse.data.data || [];
                    break;

                case 'employees':
                    response = await hrmsService.getAllEmployees();
                    fetchedData = response.success ? (Array.isArray(response.data) ? response.data : []) : [];
                    break;

                case 'attendance':
                    const attendanceResponse = await axios.get(`${API_BASE_URL}/api/attendance`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = attendanceResponse.data.data || [];
                    break;

                case 'tasks':
                    const tasksResponse = await axios.get(`${API_BASE_URL}/api/tasks`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = tasksResponse.data.data || [];
                    break;

                case 'leaves':
                    const leavesResponse = await axios.get(`${API_BASE_URL}/api/leaves`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = leavesResponse.data.data || [];
                    break;

                case 'departments':
                    const deptResponse = await axios.get(`${API_BASE_URL}/api/departments`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = deptResponse.data.data || [];
                    break;

                case 'roles':
                    const rolesResponse = await axios.get(`${API_BASE_URL}/api/roles`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = rolesResponse.data.data || [];
                    break;

                case 'products':
                    const productsResponse = await axios.get(`${API_BASE_URL}/api/products`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = productsResponse.data.data || [];
                    break;

                case 'holidays':
                    const holidaysResponse = await axios.get(`${API_BASE_URL}/api/holidays`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    fetchedData = holidaysResponse.data.data || [];
                    break;

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

    // Apply filters
    const applyFilters = () => {
        if (!Array.isArray(data)) {
            setFilteredData([]);
            return;
        }

        let filtered = [...data];

        // Date range filter
        if (filters.dateRange && filters.dateRange.length === 2) {
            const [startDate, endDate] = filters.dateRange;
            filtered = filtered.filter(item => {
                const itemDate = dayjs(item.created_date || item.created_at || item.date);
                return itemDate.isAfter(startDate.startOf('day')) && itemDate.isBefore(endDate.endOf('day'));
            });
        }

        // Status filter
        if (filters.status) {
            filtered = filtered.filter(item => item.status === filters.status);
        }

        // Search text filter
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

    // Calculate statistics
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

    // Export single row to Excel with complete details
    const exportSingleToExcel = async (record) => {
        console.log('🔵 Export Single Lead Started', record);
        try {
            setLoading(true);
            let detailedData = {};

            if (selectedSection === 'leads') {
                // Fetch complete lead details
                const leadId = record._id?.$oid || record._id;
                console.log('📌 Fetching lead details for ID:', leadId);
                
                try {
                    const response = await leadsService.getLeadById(leadId);
                    console.log('✅ Lead fetch response:', response);
                    const lead = response.success ? response.data : record;
                    detailedData = prepareLeadCompleteData(lead);
                    console.log('📊 Prepared lead data:', detailedData);
                } catch (fetchError) {
                    console.error('❌ Error fetching lead:', fetchError);
                    message.warning('Could not fetch complete details, exporting available data');
                    detailedData = prepareLeadCompleteData(record);
                }
            } else {
                detailedData = record;
            }

            console.log('📝 Creating Excel workbook...');
            // Create workbook with detailed sheets
            const workbook = XLSX.utils.book_new();

            // If it's a lead, create organized sheets matching the frontend sections
            if (selectedSection === 'leads') {
                console.log('📄 Creating lead sheets with sections...');
                const lead = detailedData;
                
                // 1. ABOUT SECTION - Basic Lead Information
                const aboutData = {
                    'Lead ID': lead.custom_lead_id || null,
                    'First Name': lead.first_name || null,
                    'Last Name': lead.last_name || null,
                    'Email': lead.email || null,
                    'Phone': lead.phone || null,
                    'Alternate Phone': lead.alternate_phone || null,
                    'Status': lead.status || null,
                    'Sub Status': lead.sub_status || null,
                    'Priority': lead.priority || null,
                    'Loan Type': lead.loan_type || null,
                    'Loan Amount': lead.loan_amount || null,
                    'Processing Bank': lead.processing_bank || null,
                    'Department': lead.department || null,
                    'Assigned To': lead.assigned_to || null,
                    'Created By': lead.created_by || null,
                    'Created Date': lead.created_date || null,
                    'Updated Date': lead.updated_date || null,
                };
                const aboutSheet = XLSX.utils.json_to_sheet([aboutData]);
                XLSX.utils.book_append_sheet(workbook, aboutSheet, 'About');

                // 2. HOW TO PROCESS SECTION - Process Data
                const processData = {
                    'Current Process Stage': lead.process_data?.current_stage || null,
                    'Process Status': lead.process_data?.status || null,
                    'Next Action': lead.process_data?.next_action || null,
                    'Process Owner': lead.process_data?.owner || null,
                    'Process Priority': lead.process_data?.priority || null,
                    'Expected Completion Date': lead.process_data?.expected_completion || null,
                    'Actual Completion Date': lead.process_data?.actual_completion || null,
                    'Process Notes': lead.process_data?.notes || null,
                    'Workflow Step': lead.process_data?.workflow_step || null,
                    'Approval Status': lead.process_data?.approval_status || null,
                    'Approved By': lead.process_data?.approved_by || null,
                    'Rejection Reason': lead.process_data?.rejection_reason || null,
                };
                const processSheet = XLSX.utils.json_to_sheet([processData]);
                XLSX.utils.book_append_sheet(workbook, processSheet, 'How To Process');

                // 3. APPLICANT SECTION - Personal, Employment, Business, Financial Details
                const applicantData = {
                    // Personal Information
                    'Father Name': lead.dynamic_fields?.personal_details?.father_name || null,
                    'Mother Name': lead.dynamic_fields?.personal_details?.mother_name || null,
                    'Spouse Name': lead.dynamic_fields?.personal_details?.spouse_name || null,
                    'Date of Birth': lead.dynamic_fields?.personal_details?.date_of_birth || lead.dynamic_fields?.personal_details?.dob || null,
                    'Age': lead.dynamic_fields?.personal_details?.age || null,
                    'Gender': lead.dynamic_fields?.personal_details?.gender || null,
                    'Marital Status': lead.dynamic_fields?.personal_details?.marital_status || null,
                    'Education': lead.dynamic_fields?.personal_details?.education || lead.dynamic_fields?.personal_details?.qualification || null,
                    'Current Address': lead.dynamic_fields?.personal_details?.current_address || lead.dynamic_fields?.personal_details?.address || null,
                    'Permanent Address': lead.dynamic_fields?.personal_details?.permanent_address || null,
                    'City': lead.dynamic_fields?.personal_details?.city || null,
                    'State': lead.dynamic_fields?.personal_details?.state || null,
                    'Pincode': lead.dynamic_fields?.personal_details?.pincode || lead.dynamic_fields?.personal_details?.postal_code || null,
                    'Country': lead.dynamic_fields?.personal_details?.country || null,
                    'Nationality': lead.dynamic_fields?.personal_details?.nationality || null,
                    'PAN Number': lead.dynamic_fields?.personal_details?.pan_number || null,
                    'Aadhar Number': lead.dynamic_fields?.personal_details?.aadhar_number || null,
                    'Passport Number': lead.dynamic_fields?.personal_details?.passport_number || null,
                    
                    // Employment Information
                    'Employment Type': lead.dynamic_fields?.employment_details?.employment_type || null,
                    'Company Name': lead.dynamic_fields?.employment_details?.company_name || lead.dynamic_fields?.employment_details?.employer_name || null,
                    'Designation': lead.dynamic_fields?.employment_details?.designation || lead.dynamic_fields?.employment_details?.job_title || null,
                    'Department': lead.dynamic_fields?.employment_details?.department || null,
                    'Employee ID': lead.dynamic_fields?.employment_details?.employee_id || null,
                    'Years in Current Job': lead.dynamic_fields?.employment_details?.years_in_current_job || null,
                    'Total Work Experience': lead.dynamic_fields?.employment_details?.total_experience || null,
                    'Monthly Salary': lead.dynamic_fields?.employment_details?.monthly_salary || null,
                    'Gross Salary': lead.dynamic_fields?.employment_details?.gross_salary || null,
                    'Net Salary': lead.dynamic_fields?.employment_details?.net_salary || null,
                    'Office Address': lead.dynamic_fields?.employment_details?.office_address || null,
                    'Office Phone': lead.dynamic_fields?.employment_details?.office_phone || null,
                    'Office Email': lead.dynamic_fields?.employment_details?.office_email || null,
                    
                    // Business Information
                    'Business Name': lead.dynamic_fields?.business_details?.business_name || null,
                    'Business Type': lead.dynamic_fields?.business_details?.business_type || null,
                    'Nature of Business': lead.dynamic_fields?.business_details?.nature_of_business || null,
                    'Years in Business': lead.dynamic_fields?.business_details?.years_in_business || null,
                    'Monthly Business Income': lead.dynamic_fields?.business_details?.monthly_income || null,
                    'Annual Turnover': lead.dynamic_fields?.business_details?.annual_turnover || null,
                    'Business Address': lead.dynamic_fields?.business_details?.business_address || null,
                    'GST Number': lead.dynamic_fields?.business_details?.gst_number || null,
                    'Business PAN': lead.dynamic_fields?.business_details?.business_pan || null,
                    'Business Registration Number': lead.dynamic_fields?.business_details?.registration_number || null,
                    
                    // Financial Information
                    'Monthly Income': lead.dynamic_fields?.financial_details?.monthly_income || null,
                    'Annual Income': lead.dynamic_fields?.financial_details?.annual_income || null,
                    'Partner/Spouse Salary': lead.dynamic_fields?.financial_details?.partner_salary || lead.dynamic_fields?.financial_details?.spouse_income || null,
                    'Yearly Bonus': lead.dynamic_fields?.financial_details?.yearly_bonus || null,
                    'Other Income': lead.dynamic_fields?.financial_details?.other_income || null,
                    'Total Monthly Income': lead.dynamic_fields?.financial_details?.total_income || null,
                    'CIBIL Score': lead.dynamic_fields?.financial_details?.cibil_score || lead.dynamic_fields?.financial_details?.credit_score || null,
                    'FOIR Percentage': lead.dynamic_fields?.financial_details?.foir_percent || lead.dynamic_fields?.financial_details?.foir || null,
                    'Bank Name': lead.dynamic_fields?.financial_details?.bank_name || null,
                    'Account Number': lead.dynamic_fields?.financial_details?.account_number || null,
                    'IFSC Code': lead.dynamic_fields?.financial_details?.ifsc_code || null,
                    'Account Type': lead.dynamic_fields?.financial_details?.account_type || null,
                    
                    // Residence Information
                    'Residence Type': lead.dynamic_fields?.residence_details?.residence_type || null,
                    'Ownership Status': lead.dynamic_fields?.residence_details?.ownership_status || null,
                    'Years at Current Residence': lead.dynamic_fields?.residence_details?.years_at_current_residence || null,
                    'Monthly Rent': lead.dynamic_fields?.residence_details?.monthly_rent || null,
                    'Landlord Name': lead.dynamic_fields?.residence_details?.landlord_name || null,
                    'Landlord Contact': lead.dynamic_fields?.residence_details?.landlord_contact || null,
                };
                
                const applicantSheet = XLSX.utils.json_to_sheet([applicantData]);
                XLSX.utils.book_append_sheet(workbook, applicantSheet, 'Applicant');

                // 4. CO-APPLICANT SECTION - Co-applicant Details
                const coApplicantData = {
                    // Co-Applicant Personal Information
                    'Co-Applicant Name': lead.dynamic_fields?.co_applicant_details?.name || lead.dynamic_fields?.co_applicant_details?.full_name || null,
                    'Co-Applicant First Name': lead.dynamic_fields?.co_applicant_details?.first_name || null,
                    'Co-Applicant Last Name': lead.dynamic_fields?.co_applicant_details?.last_name || null,
                    'Relationship with Applicant': lead.dynamic_fields?.co_applicant_details?.relationship || null,
                    'Co-Applicant Father Name': lead.dynamic_fields?.co_applicant_details?.father_name || null,
                    'Co-Applicant Mother Name': lead.dynamic_fields?.co_applicant_details?.mother_name || null,
                    'Co-Applicant Date of Birth': lead.dynamic_fields?.co_applicant_details?.date_of_birth || lead.dynamic_fields?.co_applicant_details?.dob || null,
                    'Co-Applicant Age': lead.dynamic_fields?.co_applicant_details?.age || null,
                    'Co-Applicant Gender': lead.dynamic_fields?.co_applicant_details?.gender || null,
                    'Co-Applicant Marital Status': lead.dynamic_fields?.co_applicant_details?.marital_status || null,
                    'Co-Applicant Education': lead.dynamic_fields?.co_applicant_details?.education || null,
                    'Co-Applicant Phone': lead.dynamic_fields?.co_applicant_details?.phone || lead.dynamic_fields?.co_applicant_details?.mobile_number || null,
                    'Co-Applicant Email': lead.dynamic_fields?.co_applicant_details?.email || null,
                    'Co-Applicant Address': lead.dynamic_fields?.co_applicant_details?.address || null,
                    'Co-Applicant City': lead.dynamic_fields?.co_applicant_details?.city || null,
                    'Co-Applicant State': lead.dynamic_fields?.co_applicant_details?.state || null,
                    'Co-Applicant Pincode': lead.dynamic_fields?.co_applicant_details?.pincode || null,
                    'Co-Applicant PAN': lead.dynamic_fields?.co_applicant_details?.pan_number || null,
                    'Co-Applicant Aadhar': lead.dynamic_fields?.co_applicant_details?.aadhar_number || null,
                    
                    // Co-Applicant Employment
                    'Co-Applicant Employment Type': lead.dynamic_fields?.co_applicant_details?.employment_type || null,
                    'Co-Applicant Company Name': lead.dynamic_fields?.co_applicant_details?.company_name || null,
                    'Co-Applicant Designation': lead.dynamic_fields?.co_applicant_details?.designation || null,
                    'Co-Applicant Monthly Income': lead.dynamic_fields?.co_applicant_details?.monthly_income || null,
                    'Co-Applicant Annual Income': lead.dynamic_fields?.co_applicant_details?.annual_income || null,
                    'Co-Applicant CIBIL Score': lead.dynamic_fields?.co_applicant_details?.cibil_score || null,
                };
                
                const coApplicantSheet = XLSX.utils.json_to_sheet([coApplicantData]);
                XLSX.utils.book_append_sheet(workbook, coApplicantSheet, 'Co-Applicant');

                // 5. OBLIGATIONS SECTION - All obligations/EMIs
                if (lead.dynamic_fields?.obligations && lead.dynamic_fields.obligations.length > 0) {
                    const obligationsData = lead.dynamic_fields.obligations.map(obl => ({
                        'Obligation Type': obl.type || obl.obligation_type || null,
                        'Bank/NBFC Name': obl.bank_name || obl.lender_name || null,
                        'Loan Type': obl.loan_type || null,
                        'EMI Amount': obl.emi_amount || obl.emi || null,
                        'Outstanding Amount': obl.outstanding_amount || obl.outstanding || null,
                        'Original Loan Amount': obl.loan_amount || obl.original_amount || null,
                        'Tenure (Months)': obl.tenure || obl.total_tenure || null,
                        'Tenure Left (Months)': obl.tenure_left || obl.remaining_tenure || null,
                        'Interest Rate (%)': obl.interest_rate || obl.rate || null,
                        'Start Date': obl.start_date || obl.loan_start_date || null,
                        'End Date': obl.end_date || obl.loan_end_date || null,
                        'Account Number': obl.account_number || obl.loan_account_number || null,
                        'Status': obl.status || null,
                        'Remarks': obl.remarks || obl.comments || null,
                        'Is Closed': obl.is_closed || null,
                        'Closure Date': obl.closure_date || null,
                    }));
                    const obligationsSheet = XLSX.utils.json_to_sheet(obligationsData);
                    XLSX.utils.book_append_sheet(workbook, obligationsSheet, 'Obligations');
                } else {
                    // Show empty obligation template
                    const emptyObligationData = {
                        'Obligation Type': null,
                        'Bank/NBFC Name': null,
                        'Loan Type': null,
                        'EMI Amount': null,
                        'Outstanding Amount': null,
                        'Original Loan Amount': null,
                        'Tenure (Months)': null,
                        'Tenure Left (Months)': null,
                        'Interest Rate (%)': null,
                        'Start Date': null,
                        'End Date': null,
                        'Account Number': null,
                        'Status': null,
                        'Remarks': null,
                        'Is Closed': null,
                        'Closure Date': null,
                    };
                    const obligationsSheet = XLSX.utils.json_to_sheet([emptyObligationData]);
                    XLSX.utils.book_append_sheet(workbook, obligationsSheet, 'Obligations');
                }

                // 6. REMARKS SECTION - All remarks and comments
                const remarksData = {
                    'General Remarks': lead.remarks || null,
                    'Internal Notes': lead.internal_notes || null,
                    'Login Remarks': lead.login_remarks || null,
                    'Operations Remarks': lead.operations_remarks || null,
                    'Credit Remarks': lead.credit_remarks || null,
                    'Sales Remarks': lead.sales_remarks || null,
                    'Important Notes': lead.notes || null,
                    'Comments': lead.comments || null,
                    'Special Instructions': lead.special_instructions || null,
                    'Follow Up Notes': lead.followup_notes || null,
                };
                const remarksSheet = XLSX.utils.json_to_sheet([remarksData]);
                XLSX.utils.book_append_sheet(workbook, remarksSheet, 'Remarks');

                // 7. ATTACHMENTS/DOCUMENTS SECTION
                if (lead.documents && lead.documents.length > 0) {
                    const documentsData = lead.documents.map(doc => ({
                        'Document Type': doc.document_type || doc.type || null,
                        'Document Name': doc.document_name || doc.name || doc.file_name || null,
                        'Category': doc.category || null,
                        'File Path': doc.file_path || doc.path || null,
                        'File URL': doc.file_url || doc.url || null,
                        'File Size': doc.file_size || doc.size || null,
                        'File Format': doc.file_format || doc.format || null,
                        'Uploaded Date': doc.uploaded_date || doc.created_at || null,
                        'Uploaded By': doc.uploaded_by || doc.created_by || null,
                        'Status': doc.status || null,
                        'Verification Status': doc.verification_status || null,
                        'Verified By': doc.verified_by || null,
                        'Verification Date': doc.verification_date || null,
                        'Remarks': doc.remarks || doc.comments || null,
                        'Is Required': doc.is_required || null,
                        'Expiry Date': doc.expiry_date || null,
                    }));
                    const documentsSheet = XLSX.utils.json_to_sheet(documentsData);
                    XLSX.utils.book_append_sheet(workbook, documentsSheet, 'Attachments');
                } else {
                    // Show empty document template
                    const emptyDocumentData = {
                        'Document Type': null,
                        'Document Name': null,
                        'Category': null,
                        'File Path': null,
                        'File URL': null,
                        'File Size': null,
                        'File Format': null,
                        'Uploaded Date': null,
                        'Uploaded By': null,
                        'Status': null,
                        'Verification Status': null,
                        'Verified By': null,
                        'Verification Date': null,
                        'Remarks': null,
                        'Is Required': null,
                        'Expiry Date': null,
                    };
                    const documentsSheet = XLSX.utils.json_to_sheet([emptyDocumentData]);
                    XLSX.utils.book_append_sheet(workbook, documentsSheet, 'Attachments');
                }

                // 8. LEAD ACTIVITY SECTION - Complete activity log
                if (lead.activity && lead.activity.length > 0) {
                    const activityData = lead.activity.map(act => ({
                        'Date & Time': act.timestamp || act.created_at || act.date || null,
                        'User': act.user || act.user_name || act.created_by || null,
                        'User Role': act.user_role || act.role || null,
                        'Action Type': act.action || act.activity_type || act.type || null,
                        'Description': act.description || act.message || null,
                        'Section': act.section || act.module || null,
                        'Field Changed': act.field_changed || act.field || null,
                        'Old Value': act.old_value || act.previous_value || null,
                        'New Value': act.new_value || act.current_value || null,
                        'Change Summary': act.change_summary || null,
                        'IP Address': act.ip_address || null,
                        'Device': act.device || null,
                        'Browser': act.browser || null,
                        'Location': act.location || null,
                        'Status': act.status || null,
                    }));
                    const activitySheet = XLSX.utils.json_to_sheet(activityData);
                    XLSX.utils.book_append_sheet(workbook, activitySheet, 'Lead Activity');
                } else {
                    // Show empty activity template
                    const emptyActivityData = {
                        'Date & Time': null,
                        'User': null,
                        'User Role': null,
                        'Action Type': null,
                        'Description': null,
                        'Section': null,
                        'Field Changed': null,
                        'Old Value': null,
                        'New Value': null,
                        'Change Summary': null,
                        'IP Address': null,
                        'Device': null,
                        'Browser': null,
                        'Location': null,
                        'Status': null,
                    };
                    const activitySheet = XLSX.utils.json_to_sheet([emptyActivityData]);
                    XLSX.utils.book_append_sheet(workbook, activitySheet, 'Lead Activity');
                }

                // 9. OPERATIONS DATA SECTION
                const operationsData = {
                    'Application Number': lead.application_number || null,
                    'LOS Number': lead.operations_los_number || null,
                    'Amount Requested': lead.loan_amount || null,
                    'Amount Approved': lead.operations_amount_approved || null,
                    'Amount Disbursed': lead.operations_amount_disbursed || null,
                    'Disbursement Date': lead.operations_disbursement_date || null,
                    'Disbursement Mode': lead.operations_disbursement_mode || null,
                    'Disbursement Bank': lead.operations_disbursement_bank || null,
                    'Cashback to Customer': lead.operations_cashback_to_customer || null,
                    'Net Disbursement Amount': lead.operations_net_disbursement_amount || null,
                    'Interest Rate (%)': lead.operations_rate || null,
                    'Tenure Given (Months)': lead.operations_tenure_given || null,
                    'Processing Fee': lead.operations_processing_fee || null,
                    'Channel Name': lead.operations_channel_name || null,
                    'Partner Name': lead.operations_partner_name || null,
                    'Payout Amount': lead.operations_payout || null,
                    'File Sent to Login': lead.file_sent_to_login || null,
                    'Login Date': lead.login_date || null,
                    'Login Status': lead.login_status || null,
                    'Sanction Date': lead.sanction_date || null,
                    'Sanction Letter': lead.sanction_letter || null,
                    'Updated By': lead.operations_updated_by || null,
                    'Last Update Date': lead.operations_last_updated || null,
                };
                const operationsSheet = XLSX.utils.json_to_sheet([operationsData]);
                XLSX.utils.book_append_sheet(workbook, operationsSheet, 'Operations Data');

                // 10. IMPORTANT QUESTIONS SECTION
                const questionsData = {
                    'Property Identified': lead.importantquestion?.property_identified || lead.question_responses?.property_identified || null,
                    'Property Value': lead.importantquestion?.property_value || lead.question_responses?.property_value || null,
                    'Property Location': lead.importantquestion?.property_location || lead.question_responses?.property_location || null,
                    'Property Type': lead.importantquestion?.property_type || lead.question_responses?.property_type || null,
                    'Builder Name': lead.importantquestion?.builder_name || lead.question_responses?.builder_name || null,
                    'Ready to Move': lead.importantquestion?.ready_to_move || lead.question_responses?.ready_to_move || null,
                    'Under Construction': lead.importantquestion?.under_construction || lead.question_responses?.under_construction || null,
                    'Possession Date': lead.importantquestion?.possession_date || lead.question_responses?.possession_date || null,
                    'Down Payment Done': lead.importantquestion?.down_payment_done || lead.question_responses?.down_payment_done || null,
                    'Down Payment Amount': lead.importantquestion?.down_payment_amount || lead.question_responses?.down_payment_amount || null,
                    'Own Contribution': lead.importantquestion?.own_contribution || lead.question_responses?.own_contribution || null,
                    'Co-Borrower Available': lead.importantquestion?.co_borrower || lead.question_responses?.co_borrower || null,
                    'Reference Check Done': lead.importantquestion?.reference_check || lead.question_responses?.reference_check || null,
                    'Additional Comments': lead.importantquestion?.comments || lead.question_responses?.comments || null,
                };
                const questionsSheet = XLSX.utils.json_to_sheet([questionsData]);
                XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Important Questions');

            } else {
                // For non-lead sections, use the original flat structure
                const flatData = flattenObject(detailedData);
                const friendlyData = convertToFrontendNames(flatData);
                const mainSheet = XLSX.utils.json_to_sheet([friendlyData]);
                XLSX.utils.book_append_sheet(workbook, mainSheet, 'Details');
            }

            // Download the file
            const fileName = `${selectedSection}_${record.custom_lead_id || record._id || 'record'}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
            console.log('💾 Writing file:', fileName);
            XLSX.writeFile(workbook, fileName);
            console.log('✅ Export successful!');
            message.success('Export successful!');
        } catch (error) {
            console.error('❌ Export error:', error);
            console.error('Error stack:', error.stack);
            message.error(`Failed to export data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Export bulk data to Excel
    const exportBulkToExcel = async () => {
        try {
            if (!selectedRows || selectedRows.length === 0) {
                message.warning('Please select rows to export');
                return;
            }

            setLoading(true);
            const workbook = XLSX.utils.book_new();

            if (selectedSection === 'leads') {
                // Export selected leads with complete details
                const allLeadsData = [];
                
                for (const lead of selectedRows) {
                    const leadId = lead._id?.$oid || lead._id;
                    try {
                        const response = await leadsService.getLeadById(leadId);
                        const detailedLead = response.success ? response.data : lead;
                        const processedData = prepareLeadCompleteData(detailedLead);
                        const flatData = flattenObject(processedData);
                        const friendlyData = convertToFrontendNames(flatData);
                        allLeadsData.push(friendlyData);
                    } catch (error) {
                        console.error(`Error fetching lead ${leadId}:`, error);
                        // Add basic data even if fetch fails
                        const basicData = convertToFrontendNames(flattenObject(lead));
                        allLeadsData.push(basicData);
                    }
                }
                
                // Create single sheet with all leads
                const sheet = XLSX.utils.json_to_sheet(allLeadsData);
                XLSX.utils.book_append_sheet(workbook, sheet, 'Leads Data');
            } else {
                // For other sections, export as a single sheet with friendly names
                const exportData = selectedRows.map(row => {
                    const flatRow = flattenObject(row);
                    return convertToFrontendNames(flatRow);
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

    // Prepare complete lead data for export
    const prepareLeadCompleteData = (lead) => {
        console.log('🔧 Preparing lead complete data:', lead);
        try {
            const preparedData = {
                // Basic Information
                lead_id: lead._id?.$oid || lead._id,
                custom_lead_id: lead.custom_lead_id,
                first_name: lead.first_name,
                last_name: lead.last_name,
                email: lead.email,
                phone: lead.phone || lead.mobile_number,
                alternate_phone: lead.alternate_phone,
                
                // Status Information
                status: lead.status,
                sub_status: lead.sub_status,
                priority: lead.priority,
                
                // Loan Information
                loan_amount: lead.loan_amount,
                loan_type: lead.loan_type_name || lead.loan_type,
                processing_bank: lead.processing_bank,
                
                // Assignment Information
                assigned_to: getUserNameById(lead.assigned_to),
                created_by: lead.created_by_name || getUserNameById(lead.created_by),
                department: lead.department_name,
                
                // Dates
                created_date: lead.created_date ? dayjs(lead.created_date).format('YYYY-MM-DD HH:mm:ss') : '',
                updated_date: lead.updated_at ? dayjs(lead.updated_at).format('YYYY-MM-DD HH:mm:ss') : '',
                
                // Dynamic Fields (all sections)
                dynamic_fields: lead.dynamic_fields,
                
                // Process Data
                process_data: lead.process_data,
                
                // Operations Data
                operations_amount_approved: lead.operations_amount_approved,
                operations_amount_disbursed: lead.operations_amount_disbursed,
                operations_disbursement_date: lead.operations_disbursement_date,
                operations_remarks: lead.operations_remarks,
                
                // Login Information
                file_sent_to_login: lead.file_sent_to_login ? 'Yes' : 'No',
                login_status: lead.login_status,
                login_remarks: lead.login_remarks,
                
                // Documents
                documents: lead.documents,
                
                // Activity Log
                activity: lead.activity,
                
                // Important Questions
                importantquestion: lead.importantquestion,
                question_responses: lead.question_responses,
            };
            
            console.log('✅ Lead data prepared successfully');
            return preparedData;
        } catch (error) {
            console.error('❌ Error preparing lead data:', error);
            // Return minimal data if there's an error
            return {
                lead_id: lead._id?.$oid || lead._id,
                custom_lead_id: lead.custom_lead_id,
                first_name: lead.first_name,
                last_name: lead.last_name,
                error: 'Error preparing complete data',
                raw_lead: lead
            };
        }
    };

    // Helper function to flatten nested objects for Excel export
    const flattenObject = (obj, prefix = '') => {
        try {
            console.log('🔄 Flattening object with prefix:', prefix);
            const flattened = {};
            
            if (!obj || typeof obj !== 'object') {
                console.warn('⚠️ Invalid object to flatten:', obj);
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
            
            console.log(`✅ Flattened ${Object.keys(flattened).length} properties`);
            return flattened;
        } catch (error) {
            console.error('❌ Error flattening object:', error);
            return { error: 'Failed to flatten object', original: JSON.stringify(obj) };
        }
    };

    // Export all filtered data
    const exportAllToExcel = () => {
        try {
            if (!filteredData || filteredData.length === 0) {
                message.warning('No data to export');
                return;
            }

            // Convert all data to friendly names
            const exportData = filteredData.map(row => {
                const flatRow = flattenObject(row);
                return convertToFrontendNames(flatRow);
            });
            
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, selectedSection);
            
            const fileName = `${selectedSection}_all_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            message.success(`${filteredData.length} records exported successfully!`);
        } catch (error) {
            console.error('Export all error:', error);
            message.error('Failed to export data');
        }
    };

    // Reset filters
    const resetFilters = () => {
        setFilters({
            dateRange: null,
            searchText: '',
            status: null,
        });
        setSelectedRows([]);
        setSelectedRowKeys([]);
    };

    // Get columns based on selected section
    const getColumns = () => {
        const baseColumns = [
            {
                title: 'Action',
                key: 'action',
                width: 100,
                render: (_, record) => (
                    <Button 
                        type="link" 
                        icon={<DownloadOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('🔵 Export button clicked for record:', record);
                            exportSingleToExcel(record);
                        }}
                        size="small"
                        style={{ color: '#2563eb', fontWeight: 500 }}
                    >
                        Export
                    </Button>
                ),
            },
        ];

        switch (selectedSection) {
            case 'leads':
                return [
                    ...baseColumns,
                    {
                        title: 'Lead ID',
                        dataIndex: 'custom_lead_id',
                        key: 'custom_lead_id',
                        width: 120,
                    },
                    {
                        title: 'Name',
                        key: 'name',
                        width: 180,
                        render: (_, record) => `${record.first_name || ''} ${record.last_name || ''}`.trim(),
                    },
                    {
                        title: 'Phone',
                        dataIndex: 'phone',
                        key: 'phone',
                        width: 130,
                    },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 120,
                        render: (status) => (
                            <Tag color="#2563eb" style={{ fontWeight: 500 }}>
                                {status}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Loan Amount',
                        dataIndex: 'loan_amount',
                        key: 'loan_amount',
                        width: 130,
                        render: (amount) => amount ? `₹${amount.toLocaleString()}` : '-',
                    },
                    {
                        title: 'Assigned To',
                        key: 'assigned_to',
                        width: 150,
                        render: (_, record) => getUserNameById(record.assigned_to),
                    },
                    {
                        title: 'Created Date',
                        dataIndex: 'created_date',
                        key: 'created_date',
                        width: 150,
                        render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
                    },
                ];

            case 'employees':
                return [
                    ...baseColumns,
                    {
                        title: 'Employee ID',
                        dataIndex: 'employee_id',
                        key: 'employee_id',
                        width: 120,
                    },
                    {
                        title: 'Name',
                        key: 'name',
                        width: 180,
                        render: (_, record) => `${record.first_name || ''} ${record.last_name || ''}`.trim(),
                    },
                    {
                        title: 'Email',
                        dataIndex: 'email',
                        key: 'email',
                        width: 200,
                    },
                    {
                        title: 'Department',
                        dataIndex: 'department_name',
                        key: 'department_name',
                        width: 150,
                    },
                    {
                        title: 'Designation',
                        dataIndex: 'designation_name',
                        key: 'designation_name',
                        width: 150,
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
                    },
                    {
                        title: 'Assigned To',
                        key: 'assigned_to',
                        width: 150,
                        render: (_, record) => getUserNameById(record.assigned_to),
                    },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 120,
                        render: (status) => <Tag color={status === 'completed' ? 'green' : 'orange'}>{status}</Tag>,
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
                        render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
                    },
                ];

            default:
                // Generic columns for other sections
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
                            if (typeof value === 'object') return JSON.stringify(value);
                            if (typeof value === 'boolean') return value ? 'Yes' : 'No';
                            return value || '-';
                        },
                    })),
                ];
        }
    };

    // Row selection configuration
    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys, selectedRows) => {
            setSelectedRowKeys(selectedKeys);
            setSelectedRows(selectedRows);
        },
    };

    // Section selector menu
    const sectionMenu = (
        <Menu
            selectedKeys={[selectedSection]}
            onClick={({ key }) => {
                setSelectedSection(key);
                resetFilters();
            }}
        >
            {REPORT_SECTIONS.map(section => (
                <Menu.Item key={section.key} icon={section.icon}>
                    {section.label}
                </Menu.Item>
            ))}
        </Menu>
    );

    return (
        <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card 
                title={
                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
                        <FileTextOutlined style={{ marginRight: 8, color: '#2563eb' }} />
                        Comprehensive Reports & Analytics
                    </span>
                }
                extra={
                    <Space>
                        {/* Section Dropdown */}
                        <Dropdown overlay={sectionMenu} trigger={['click']}>
                            <Button 
                                type="primary" 
                                size="large"
                                style={{ 
                                    backgroundColor: '#2563eb',
                                    borderColor: '#2563eb',
                                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                                }}
                            >
                                <Space>
                                    {REPORT_SECTIONS.find(s => s.key === selectedSection)?.icon}
                                    {REPORT_SECTIONS.find(s => s.key === selectedSection)?.label}
                                    <DownOutlined />
                                </Space>
                            </Button>
                        </Dropdown>
                        
                        <Button 
                            icon={<ReloadOutlined />}
                            onClick={fetchData}
                            loading={loading}
                            size="large"
                        >
                            Refresh
                        </Button>
                    </Space>
                }
                style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >

                    {/* Statistics */}
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                            <Card 
                                bordered={false}
                                style={{ 
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                                }}
                            >
                                <Statistic
                                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Total Records</span>}
                                    value={statistics.total}
                                    prefix={<FileTextOutlined style={{ color: 'white' }} />}
                                    valueStyle={{ color: 'white', fontWeight: 'bold' }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card 
                                bordered={false}
                                style={{ 
                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)'
                                }}
                            >
                                <Statistic
                                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Active/Approved</span>}
                                    value={statistics.active}
                                    prefix={<CheckCircleOutlined style={{ color: 'white' }} />}
                                    valueStyle={{ color: 'white', fontWeight: 'bold' }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card 
                                bordered={false}
                                style={{ 
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                                }}
                            >
                                <Statistic
                                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Completed</span>}
                                    value={statistics.completed}
                                    prefix={<CheckCircleOutlined style={{ color: 'white' }} />}
                                    valueStyle={{ color: 'white', fontWeight: 'bold' }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card 
                                bordered={false}
                                style={{ 
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)'
                                }}
                            >
                                <Statistic
                                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Pending</span>}
                                    value={statistics.pending}
                                    prefix={<ClockCircleOutlined style={{ color: 'white' }} />}
                                    valueStyle={{ color: 'white', fontWeight: 'bold' }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* Filters */}
                    <Card 
                        title={<span style={{ fontWeight: 600 }}>Filters & Export</span>}
                        style={{ marginBottom: 24, borderRadius: '8px' }}
                    >
                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={12} md={6}>
                                <RangePicker
                                    style={{ width: '100%' }}
                                    value={filters.dateRange}
                                    onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
                                    placeholder={['Start Date', 'End Date']}
                                />
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Select
                                    placeholder="Filter by Status"
                                    style={{ width: '100%' }}
                                    value={filters.status}
                                    onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                                    allowClear
                                >
                                    <Option value="active">Active</Option>
                                    <Option value="pending">Pending</Option>
                                    <Option value="completed">Completed</Option>
                                    <Option value="approved">Approved</Option>
                                    <Option value="rejected">Rejected</Option>
                                </Select>
                            </Col>
                            <Col xs={24} sm={12} md={4}>
                                <Button onClick={resetFilters} style={{ width: '100%' }}>
                                    Reset Filters
                                </Button>
                            </Col>
                            <Col xs={24} sm={12} md={4}>
                                <Button
                                    type="primary"
                                    icon={<FileExcelOutlined />}
                                    onClick={() => {
                                        console.log('Export Selected clicked, selectedRows:', selectedRows.length);
                                        exportBulkToExcel();
                                    }}
                                    disabled={selectedRows.length === 0}
                                    style={{ 
                                        width: '100%',
                                        backgroundColor: selectedRows.length > 0 ? '#2563eb' : undefined,
                                        borderColor: selectedRows.length > 0 ? '#2563eb' : undefined
                                    }}
                                >
                                    Export ({selectedRows.length})
                                </Button>
                            </Col>
                            <Col xs={24} sm={12} md={4}>
                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={() => {
                                        console.log('Export All clicked, filteredData:', filteredData.length);
                                        exportAllToExcel();
                                    }}
                                    disabled={filteredData.length === 0}
                                    style={{ 
                                        width: '100%',
                                        backgroundColor: filteredData.length > 0 ? '#10b981' : undefined,
                                        borderColor: filteredData.length > 0 ? '#10b981' : undefined,
                                        color: filteredData.length > 0 ? 'white' : undefined
                                    }}
                                >
                                    Export All
                                </Button>
                            </Col>
                        </Row>
                    </Card>

                    {/* Data Table */}
                    <Spin spinning={loading}>
                        <div style={{ 
                            background: 'white',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <Table
                                rowSelection={rowSelection}
                                columns={getColumns()}
                                dataSource={filteredData}
                                rowKey={(record) => record._id?.$oid || record._id || record.id || Math.random()}
                                scroll={{ x: 'max-content', y: 600 }}
                                pagination={{
                                    total: filteredData.length,
                                    pageSize: 50,
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
                                    pageSizeOptions: ['10', '25', '50', '100', '200'],
                                }}
                                bordered
                                size="small"
                            />
                        </div>
                    </Spin>
            </Card>
        </div>
    );
};

export default ComprehensiveReport;
