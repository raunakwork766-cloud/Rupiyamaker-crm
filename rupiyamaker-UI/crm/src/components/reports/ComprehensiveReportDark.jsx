import React, { useState, useEffect } from 'react';
import {
    Table, Button, DatePicker, Select, Space,
    Spin, message, Tag, Modal, Tabs, Descriptions, Tooltip, Input
} from 'antd';
import {
    DownloadOutlined, FileExcelOutlined, ReloadOutlined,
    UserOutlined, CheckCircleOutlined, ClockCircleOutlined,
    FileTextOutlined, EyeOutlined, FilterOutlined, SearchOutlined,
    FileProtectOutlined, HistoryOutlined, SolutionOutlined,
    TeamOutlined, CalendarOutlined, CreditCardOutlined,
    BarChartOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import { leadsService } from '../../services/leadsService';
import { hrmsService } from '../../services/hrmsService';
import { ticketsAPI } from '../../services/api';
import axios from 'axios';
import './ReportsHubSpot.css';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://156.67.111.95:8049';

// =====================================================
// LEAD CRM EXPORT HELPERS
// =====================================================

// Format date to IST for export
const fmtDateIST = (d) => {
    if (!d) return '';
    const parsed = dayjs(d);
    return parsed.isValid() ? parsed.tz('Asia/Kolkata').format('DD-MM-YYYY HH:mm') : '';
};

// Format INR amount with Indian comma separator
const fmtINR = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const cleaned = typeof val === 'string' ? val.replace(/[₹,\s]/g, '') : String(val);
    const num = parseFloat(cleaned);
    if (isNaN(num)) return val || '';
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
};

// Format obligation table as single-cell text — monospace padded alignment (like screenshot)
const formatObligationTable = (obligations) => {
    if (!obligations || !obligations.length) return '';
    const validRows = obligations.filter(o =>
        o.product || o.bank_name || o.bankName || o.tenure ||
        o.total_loan || o.totalLoan || o.outstanding || o.emi
    );
    if (!validRows.length) return '';

    const pad = (s, w) => String(s == null ? '' : s).padEnd(w);
    const fmtNum = (val) => {
        if (val === null || val === undefined || val === '') return '-';
        const cleaned = typeof val === 'string' ? val.replace(/[₹,\s]/g, '') : String(val);
        const num = parseFloat(cleaned);
        if (isNaN(num)) return String(val);
        return Math.round(num).toLocaleString('en-IN');
    };

    const rowData = validRows.map((o, i) => ({
        num: String(i + 1),
        product: o.product || '-',
        bank: o.bank_name || o.bankName || '-',
        tenure: o.tenure ? `${o.tenure}M` : '-',
        roi: o.roi ? `${o.roi}${String(o.roi).includes('%') ? '' : '%'}` : '-',
        totalLoan: fmtNum(o.total_loan || o.totalLoan),
        outstanding: fmtNum(o.outstanding),
        emi: fmtNum(o.emi),
        action: o.action || 'Obligate',
    }));

    const W = {
        num: 3,
        product: Math.max(7,  ...rowData.map(r => r.product.length)),
        bank:    Math.max(13, ...rowData.map(r => r.bank.length)),
        tenure:  Math.max(7,  ...rowData.map(r => r.tenure.length)),
        roi:     Math.max(5,  ...rowData.map(r => r.roi.length)),
        totalLoan:   Math.max(10, ...rowData.map(r => r.totalLoan.length)),
        outstanding: Math.max(11, ...rowData.map(r => r.outstanding.length)),
        emi:     Math.max(9,  ...rowData.map(r => r.emi.length)),
    };

    const header = `${pad('#',W.num)}  ${pad('Product',W.product)}  ${pad('Bank',W.bank)}  ${pad('Tenure',W.tenure)}  ${pad('ROI',W.roi)}  ${pad('Total Loan',W.totalLoan)}  ${pad('Outstanding',W.outstanding)}  ${pad('EMI',W.emi)}  Action`;
    const sep = '-'.repeat(header.length);

    const rows = rowData.map(r =>
        `${pad(r.num,W.num)}  ${pad(r.product,W.product)}  ${pad(r.bank,W.bank)}  ${pad(r.tenure,W.tenure)}  ${pad(r.roi,W.roi)}  ${pad(r.totalLoan,W.totalLoan)}  ${pad(r.outstanding,W.outstanding)}  ${pad(r.emi,W.emi)}  ${r.action}`
    );

    return ['Obligation Details', header, sep, ...rows].join('\n');
};

// Build a comprehensive export row from lead data matching UI labels
const buildLeadExportRow = (lead, getUserNameFn) => {
    const row = {};
    const df = lead.dynamic_fields || {};

    // ═══ ABOUT SECTION ═══
    row['Lead ID'] = lead.custom_lead_id || lead.id || '';
    row['Lead Date & Time'] = fmtDateIST(lead.createdAt || lead.created_date || lead.created_at);
    row['Created By'] = lead.created_by_name || getUserNameFn(lead.created_by);
    row['Team Name'] = lead.team_name || '';
    row['Product Name'] = lead.product_name || '';
    row['Campaign Name'] = lead.campaign_name || lead.campaignName || '';
    row['Data Code'] = lead.data_code || lead.dataCode || '';
    row['Customer Name'] = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '';
    row['Mobile Number'] = lead.mobile_number || lead.phone || '';
    row['Alternate Number'] = lead.alternative_phone || lead.alternate_phone || '';
    row['Email'] = lead.email || '';
    row['Pincode & City'] = lead.pincode_city || '';
    row['Status'] = lead.status || '';
    row['Sub Status'] = lead.sub_status || '';
    row['Assigned To'] = lead.assigned_to_name || getUserNameFn(lead.assigned_to);

    // ═══ HOW TO PROCESS SECTION ═══
    const proc = df.process || lead.process_data || {};
    row['Processing Bank'] = proc.processing_bank || lead.processing_bank || '';
    row['Loan Type'] = proc.loan_type || lead.loan_type_name || lead.loan_type || '';
    row['Case Type'] = proc.case_type || '';
    row['Loan Amount Required'] = proc.loan_amount_required ? fmtINR(proc.loan_amount_required) : (lead.loan_amount ? fmtINR(lead.loan_amount) : '');
    row['Required Tenure (Months)'] = proc.required_tenure ? `${proc.required_tenure} Months` : '';
    row['Purpose of Loan'] = proc.purpose_of_loan || '';
    row['How to Process'] = proc.how_to_process || '';

    // ═══ APPLICANT FORM SECTION ═══
    const af = df.applicant_form || lead.loginForm || {};
    row['Login Call Reference'] = af.referenceNameForLogin || '';
    row['Aadhar Number'] = af.aadharNumber || '';
    row['Pan Card'] = af.panCard || '';
    row["Father's Name"] = af.fathersName || '';
    row['Salary A/C Bank Name'] = af.salaryAccountBank || '';
    row['Salary A/C Bank Number'] = af.salaryAccountBankNumber || '';
    row['IFSC Code'] = af.ifscCode || '';
    row['Applicant Customer Name'] = af.customerName || '';
    row['Applicant Mobile Number'] = af.mobileNumber || '';
    row['Applicant Alternate Number'] = af.alternateNumber || '';
    row['Qualification'] = af.qualification || '';
    row["Mother's Name"] = af.mothersName || '';
    row['Marital Status'] = af.maritalStatus || '';
    row['Spouse Name'] = af.spousesName || '';
    row["Spouse's DOB"] = af.spousesDob || '';
    row['Current Address'] = af.currentAddress || '';
    row['Current Address Landmark'] = af.currentAddressLandmark || '';
    row['Current Address Type'] = af.currentAddressType || '';
    row['Current Address Proof'] = af.currentAddressProof || '';
    row['Years at Current Address'] = af.yearsAtCurrentAddress || '';
    row['Years in Current City'] = af.yearsInCurrentCity || '';
    row['Permanent Address'] = af.permanentAddress || '';
    row['Permanent Address Landmark'] = af.permanentAddressLandmark || '';
    row['Company Name (Applicant)'] = af.companyName || '';
    row['Designation'] = af.yourDesignation || '';
    row['Department (Applicant)'] = af.yourDepartment || '';
    row['DOJ in Current Company'] = af.dojCurrentCompany || '';
    row['Current Work Experience (Years)'] = af.currentWorkExperience || '';
    row['Total Work Experience (Years)'] = af.totalWorkExperience || '';
    row['Personal Email'] = af.personalEmail || '';
    row['Work Email'] = af.workEmail || '';
    row['Office Address'] = af.officeAddress || '';
    row['Office Address Landmark'] = af.officeAddressLandmark || '';
    row['Reference 1 Name'] = af.ref1Name || '';
    row['Reference 1 Mobile'] = af.ref1Mobile || '';
    row['Reference 1 Relation'] = af.ref1Relation || '';
    row['Reference 1 Address'] = af.ref1Address || '';
    row['Reference 2 Name'] = af.ref2Name || '';
    row['Reference 2 Mobile'] = af.ref2Mobile || '';
    row['Reference 2 Relation'] = af.ref2Relation || '';
    row['Reference 2 Address'] = af.ref2Address || '';

    // ═══ OBLIGATION SECTION ═══
    const fin  = df.financial_details  || {};
    const pd   = df.personal_details   || {};
    const ce   = df.check_eligibility  || {};
    const elig = df.eligibility_details || {};
    const obligations = df.obligations || [];

    // Financial Details
    row['Monthly Income (Salary)'] = fmtINR(fin.monthly_income || lead.salary || df.salary) || '';
    row['Yearly Bonus']            = fmtINR(fin.yearly_bonus   || df.yearlyBonus) || '';
    row['Partner Salary']          = fmtINR(fin.partner_salary || lead.partnerSalary || df.partnerSalary) || '';
    row['CIBIL Score']             = fin.cibil_score || lead.cibilScore || lead.cibil_score || df.cibilScore || '';

    // Company / Personal Details (from Obligation section)
    row['Company Name (Obligation)']     = pd.company_name     || lead.company_name     || '';
    row['Company Type']                  = pd.company_type     || lead.company_type     || '';
    row['Company Category (Obligation)'] = pd.company_category || lead.company_category || '';

    // Obligation Summary
    row['Total BT POS']     = fmtINR(lead.totalBtPos || lead.total_bt_pos || df.totalBtPos || elig.totalBtPos) || '';
    row['Total Obligation'] = fmtINR(lead.totalObligation || lead.total_obligation || df.totalObligation || elig.totalObligations) || '';

    // Obligation Table (formatted as aligned monospace text)
    row['Obligation Details'] = formatObligationTable(obligations);

    // Check Eligibility Section
    row['CE: Company Category'] = ce.company_category || '';
    row['FOIR %']               = ce.foir_percent ? `${ce.foir_percent}%` : '';
    row['Monthly EMI Can Pay']  = fmtINR(ce.monthly_emi_can_pay) || '';
    row['CE: Tenure (Months)']  = ce.tenure_months ? `${ce.tenure_months} M` : '';
    row['CE: Tenure (Years)']   = ce.tenure_years  ? `${ce.tenure_years} Yrs` : '';
    row['CE: ROI']              = ce.roi ? `${ce.roi}${String(ce.roi).includes('%') ? '' : '%'}` : '';
    row['CE: Multiplier']       = ce.multiplier || '';
    row['Loan Eligibility Status'] = ce.loan_eligibility_status || '';

    // Eligibility Calculation Summary
    row['Total Income (Elig.)']        = fmtINR(elig.totalIncome)           || '';
    row['FOIR Amount (Elig.)']         = fmtINR(elig.foirAmount)            || '';
    row['Total Obligations (Elig.)']   = fmtINR(elig.totalObligations)      || '';
    row['Final Eligibility']           = fmtINR(elig.finalEligibility)      || '';
    row['Multiplier Eligibility']      = fmtINR(elig.multiplierEligibility) || '';
    row['FOIR Eligibility']            = fmtINR(elig.foirEligibility)       || '';

    return row;
};

// Build Excel worksheet with proper column widths for lead export
const buildLeadWorksheet = (rows) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths — wider for key columns
    const cols = Object.keys(rows[0] || {});
    ws['!cols'] = cols.map(col => {
        if (col === 'Obligation Details')       return { wch: 110 };
        if (col.includes('Address'))            return { wch: 35 };
        if (col.includes('Eligibility'))        return { wch: 22 };
        if (col.includes('Name') || col.includes('Email')) return { wch: 25 };
        if (col.includes('Lead ID') || col.includes('Date')) return { wch: 22 };
        if (col.startsWith('CE:'))              return { wch: 20 };
        return { wch: 20 };
    });
    // Set row heights for obligation column (enable multiline viewing)
    if (rows.length > 0) {
        const oblIdx = cols.indexOf('Obligation Details');
        if (oblIdx >= 0) {
            rows.forEach((r, i) => {
                const cellRef = XLSX.utils.encode_cell({ c: oblIdx, r: i + 1 });
                if (ws[cellRef] && ws[cellRef].v && typeof ws[cellRef].v === 'string' && ws[cellRef].v.includes('\n')) {
                    const lineCount = ws[cellRef].v.split('\n').length;
                    if (!ws['!rows']) ws['!rows'] = [];
                    ws['!rows'][i + 1] = { hpt: Math.max(15, lineCount * 15) };
                }
            });
        }
    }
    return ws;
};

const SECTIONS = [
    { key: 'plod-leads',  label: 'Lead CRM', icon: <CreditCardOutlined />, color: '#6366f1', group: 'leads' },
    { key: 'login-leads', label: 'Login Leads',   icon: <FileTextOutlined />,   color: '#3b82f6', group: 'leads' },
    { key: 'tasks',       label: 'Tasks',         icon: <CheckCircleOutlined />,color: '#10b981', group: 'work'  },
    { key: 'tickets',     label: 'Tickets',       icon: <SolutionOutlined />,   color: '#f59e0b', group: 'work'  },
    { key: 'attendance',  label: 'Attendance',    icon: <CalendarOutlined />,   color: '#06b6d4', group: 'hr'   },
    { key: 'employees',   label: 'Employees',     icon: <TeamOutlined />,       color: '#ec4899', group: 'hr'   },
    { key: 'leaves',      label: 'Leaves',        icon: <ClockCircleOutlined />,color: '#f97316', group: 'hr'   },
];
const GROUP_LABELS = { leads: 'CRM', work: 'Operations', hr: 'People' };

const ComprehensiveReportDark = () => {
    const [selectedSection, setSelectedSection] = useState('plod-leads');
    const [loading, setLoading]         = useState(false);
    const [allLeads, setAllLeads]       = useState([]);
    const [data, setData]               = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [users, setUsers]             = useState([]);
    const [selectedRows, setSelectedRows]       = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [counts, setCounts]           = useState({});
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedLead, setSelectedLead]   = useState(null);
    const [activeDetailTab, setActiveDetailTab] = useState('about');
    const [detailLoading, setDetailLoading] = useState(false);
    const [filters, setFilters] = useState({ dateRange: null, searchText: '', status: null });
    const [statistics, setStatistics]   = useState({ total: 0, active: 0, completed: 0, pending: 0 });

    useEffect(() => { fetchUsers(); }, []);
    useEffect(() => { fetchSectionData(); }, [selectedSection]);
    useEffect(() => { applyFilters(); }, [filters, data]);
    useEffect(() => { calculateStatistics(); }, [filteredData]);

    const fetchUsers = async () => {
        try {
            const res = await hrmsService.getAllEmployees();
            if (res.success && res.data) setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (e) { console.error('fetchUsers', e); }
    };

    const getUserName = (userId) => {
        if (!userId) return '-';
        const u = users.find(u =>
            (u._id && (u._id === userId || u._id.$oid === userId)) ||
            (u.id && u.id === userId)
        );
        return u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.username || '-') : '-';
    };

    const fetchAllLeads = async () => {
        try {
            const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/leads/?user_id=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            const arr = data.items || (Array.isArray(data) ? data : []);
            setAllLeads(arr);
            setCounts(p => ({ ...p, 'plod-leads': arr.length }));
        } catch (e) { console.error('fetchAllLeads', e); }
    };

    const fetchSectionData = async () => {
        setLoading(true);
        try {
            let fetched = [];
            switch (selectedSection) {
                case 'plod-leads': {
                    try {
                        const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
                        const token = localStorage.getItem('token');
                        const response = await fetch(`/api/leads/?user_id=${userId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            }
                        });
                        if (!response.ok) throw new Error(`API error: ${response.status}`);
                        const data = await response.json();
                        fetched = data.items || (Array.isArray(data) ? data : []);
                    } catch (e2) { console.error('leads fetch error', e2); fetched = []; }
                    setAllLeads(fetched);
                    setCounts(p => ({ ...p, 'plod-leads': fetched.length }));
                    break;
                }
                case 'login-leads': {
                    const token = localStorage.getItem('token');
                    const userId = localStorage.getItem('userId');
                    try {
                        const r = await axios.get('/api/lead-login/login-department-leads', {
                            headers: { Authorization: `Bearer ${token}` }, params: { user_id: userId }
                        });
                        fetched = r.data?.leads || [];
                    } catch (e) { fetched = []; }
                    break;
                }
                case 'employees': {
                    const r = await hrmsService.getAllEmployees();
                    fetched = r.success ? (Array.isArray(r.data) ? r.data : []) : [];
                    break;
                }
                case 'tasks': {
                    const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
                    const r = await axios.get(`/api/tasks/with-stats?user_id=${userId}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    fetched = r.data.tasks || r.data.data || r.data || [];
                    if (!Array.isArray(fetched)) fetched = [];
                    break;
                }
                case 'tickets': {
                    const r = await ticketsAPI.getTickets(1, 500, {});
                    fetched = r.tickets || r.data || [];
                    if (!Array.isArray(fetched)) fetched = [];
                    break;
                }
                case 'attendance': {
                    const r = await axios.get(`${API_BASE_URL}/api/attendance`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                    fetched = r.data.data || [];
                    break;
                }
                case 'leaves': {
                    const r = await axios.get(`${API_BASE_URL}/api/leaves`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                    fetched = r.data.data || [];
                    break;
                }
                default: fetched = [];
            }
            setData(fetched); setFilteredData(fetched);
            setCounts(p => ({ ...p, [selectedSection]: fetched.length }));
        } catch (e) {
            console.error('fetchSectionData', e);
            message.error('Failed to load data');
            setData([]); setFilteredData([]);
        } finally { setLoading(false); }
    };

    const applyFilters = () => {
        if (!Array.isArray(data)) { setFilteredData([]); return; }
        let f = [...data];
        if (filters.dateRange?.length === 2) {
            const [s, e] = filters.dateRange;
            f = f.filter(item => { const d = dayjs(item.created_date || item.created_at || item.date); return d.isAfter(s.startOf('day')) && d.isBefore(e.endOf('day')); });
        }
        if (filters.status) f = f.filter(i => (i.status || '').toLowerCase().includes(filters.status.toLowerCase()));
        if (filters.searchText) { const q = filters.searchText.toLowerCase(); f = f.filter(i => Object.values(i).some(v => v && v.toString().toLowerCase().includes(q))); }
        setFilteredData(f);
    };
    const resetFilters = () => setFilters({ dateRange: null, searchText: '', status: null });

    const calculateStatistics = () => {
        if (!Array.isArray(filteredData)) { setStatistics({ total: 0, active: 0, completed: 0, pending: 0 }); return; }
        let active = 0, completed = 0, pending = 0;
        filteredData.forEach(i => {
            const s = (i.status || '').toLowerCase();
            if (s.includes('active') || s.includes('new') || s.includes('approved') || s.includes('won')) active++;
            else if (s.includes('completed') || s.includes('closed') || s.includes('disbursed')) completed++;
            else if (s.includes('pending') || s.includes('progress')) pending++;
        });
        setStatistics({ total: filteredData.length, active, completed, pending });
    };

    const handleRowClick = (record) => {
        if (['plod-leads','login-leads'].includes(selectedSection)) {
            setSelectedLead(record); setDetailModalVisible(true); setActiveDetailTab('about');
            fetchLeadDetails(record._id?.$oid || record._id);
        }
    };
    const fetchLeadDetails = async (leadId) => {
        setDetailLoading(true);
        try { const r = await leadsService.getLeadById(leadId); if (r.success) setSelectedLead(r.data); }
        catch (e) { console.error('fetchLeadDetails', e); }
        finally { setDetailLoading(false); }
    };

    const fmtLabel = (k) => k.replace(/_/g,' ').replace(/([A-Z])/g,' $1').trim();
    const isLeadSection = ['plod-leads', 'login-leads'].includes(selectedSection);

    const exportAllToExcel = () => {
        if (!filteredData.length) { message.warning('No data to export'); return; }
        const wb = XLSX.utils.book_new();
        let ws;
        if (isLeadSection) {
            const rows = filteredData.map(r => buildLeadExportRow(r, getUserName));
            ws = buildLeadWorksheet(rows);
        } else {
            ws = XLSX.utils.json_to_sheet(filteredData.map(r => { const o = {}; Object.keys(r).forEach(k => { if (!k.startsWith('_')) o[fmtLabel(k)] = typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]; }); return o; }));
        }
        XLSX.utils.book_append_sheet(wb, ws, selectedSection);
        XLSX.writeFile(wb, `${selectedSection}-${dayjs().format('YYYY-MM-DD')}.xlsx`);
        message.success(`${filteredData.length} records export ho gayi!`);
    };
    const exportBulkToExcel = () => {
        if (!selectedRows.length) { message.warning('Pehle records select karo'); return; }
        const wb = XLSX.utils.book_new();
        let ws;
        if (isLeadSection) {
            const rows = selectedRows.map(r => buildLeadExportRow(r, getUserName));
            ws = buildLeadWorksheet(rows);
        } else {
            ws = XLSX.utils.json_to_sheet(selectedRows.map(r => { const o = {}; Object.keys(r).forEach(k => { if (!k.startsWith('_')) o[fmtLabel(k)] = typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]; }); return o; }));
        }
        XLSX.utils.book_append_sheet(wb, ws, selectedSection);
        XLSX.writeFile(wb, `${selectedSection}-selected-${dayjs().format('YYYY-MM-DD')}.xlsx`);
        message.success(`${selectedRows.length} selected records exported!`);
    };
    const exportRowExcel = (record) => {
        const wb = XLSX.utils.book_new();
        let ws;
        if (isLeadSection) {
            ws = buildLeadWorksheet([buildLeadExportRow(record, getUserName)]);
        } else {
            const o = {}; Object.keys(record).forEach(k => { if (!k.startsWith('_')) o[fmtLabel(k)] = typeof record[k] === 'object' ? JSON.stringify(record[k]) : record[k]; });
            ws = XLSX.utils.json_to_sheet([o]);
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Record');
        XLSX.writeFile(wb, `record-${dayjs().format('YYYY-MM-DD-HHmm')}.xlsx`);
    };

    const getStatusColor = (s) => {
        if (!s) return 'default';
        const sl = s.toLowerCase();
        if (sl.includes('active') || sl.includes('new')) return 'blue';
        if (sl.includes('pending') || sl.includes('progress')) return 'orange';
        if (sl.includes('completed') || sl.includes('closed') || sl.includes('disbursed')) return 'green';
        if (sl.includes('rejected') || sl.includes('failed')) return 'red';
        return 'default';
    };

    const actionCol = {
        title:'', key:'act', width:72, fixed:'right',
        render: (_, record) => (
            <Space size={4}>
                {['plod-leads','login-leads'].includes(selectedSection) && (
                    <Tooltip title="View">
                        <Button type="primary" size="small" icon={<EyeOutlined />}
                            onClick={e => { e.stopPropagation(); handleRowClick(record); }}
                            style={{ background:'#ff7a59', borderColor:'#ff7a59' }} />
                    </Tooltip>
                )}
                <Tooltip title="Export row">
                    <Button size="small" icon={<DownloadOutlined />}
                        onClick={e => { e.stopPropagation(); exportRowExcel(record); }}
                        style={{ borderColor:'#cbd6e2', color:'#33475b' }} />
                </Tooltip>
            </Space>
        ),
    };

    const getColumns = () => {
        const isLead = ['plod-leads','login-leads'].includes(selectedSection);
        if (isLead) return [
            actionCol,
            { title:'Lead ID',  dataIndex:'custom_lead_id', key:'lid',    width:130, render:t=><span className="hs-reports-link">{t||'-'}</span> },
            { title:'Name',     key:'name', width:180, render:(_,r)=>(<div><div style={{fontWeight:600,color:'#33475b'}}>{r.first_name||''} {r.last_name||''}</div><div className="hs-reports-subtext">{r.email||''}</div></div>) },
            { title:'Phone',    dataIndex:'phone',       key:'ph',    width:130 },
            { title:'Loan Type',dataIndex:'loan_type_name',key:'lt',  width:130 },
            { title:'Status',   dataIndex:'status',      key:'st',    width:125, render:s=><Tag style={{fontSize:'11px', fontWeight:600}} color={getStatusColor(s)}>{s||'-'}</Tag> },
            { title:'Sub Status',dataIndex:'sub_status', key:'sub',   width:150, render:t=><span className="hs-reports-subtext">{t||'-'}</span> },
            { title:'Loan Amt', dataIndex:'loan_amount', key:'la',    width:120, render:a=><span className="hs-reports-amount">{a?`₹${Number(a).toLocaleString()}`:'-'}</span> },
            { title:'Assigned', key:'asgn', width:160, render:(_,r)=>getUserName(r.assigned_to) },
            { title:'Created',  dataIndex:'created_date',key:'cr',    width:150, render:d=><span className="hs-reports-subtext">{d?dayjs(d).tz('Asia/Kolkata').format('DD-MM-YY HH:mm'):'-'}</span> },
        ];
        if (selectedSection === 'employees') return [
            actionCol,
            { title:'Emp ID',    dataIndex:'employee_id',    key:'eid',   width:120, render:t=><span className="hs-reports-link">{t||'-'}</span> },
            { title:'Name',      key:'name', width:180, render:(_,r)=><span style={{fontWeight:600,color:'#33475b'}}>{r.first_name||''} {r.last_name||''}</span> },
            { title:'Email',     dataIndex:'email',          key:'em',    width:210 },
            { title:'Department',dataIndex:'department_name',key:'dept',  width:150 },
            { title:'Designation',dataIndex:'designation_name',key:'des',width:150 },
            { title:'Status',    dataIndex:'is_active',      key:'act',   width:90,  render:a=><Tag color={a?'green':'red'}>{a?'Active':'Inactive'}</Tag> },
        ];
        if (selectedSection === 'tasks') return [
            actionCol,
            { title:'Subject',  dataIndex:'subject',  key:'subject', width:280, render:t=><span style={{fontWeight:600,color:'#33475b'}}>{t||'-'}</span> },
            { title:'Type',     dataIndex:'task_type',key:'type',    width:120, render:t=><span className="hs-reports-link">{t||'-'}</span> },
            { title:'Assigned', key:'asgn', width:170, render:(_,r)=>{
                if (r.assigned_users?.length) return r.assigned_users.map(u=>u.name||u).join(', ');
                if (r.assigned_to) return getUserName(Array.isArray(r.assigned_to)?r.assigned_to[0]:r.assigned_to);
                return <span className="hs-reports-subtext">Unassigned</span>;
            }},
            { title:'Status',   dataIndex:'status',   key:'st',     width:120, render:s=><Tag color={s==='Completed'||s==='completed'?'green':s==='In Progress'?'blue':'orange'}>{s||'-'}</Tag> },
            { title:'Priority', dataIndex:'priority', key:'prio',   width:100, render:p=><Tag color={p==='High'||p==='high'?'red':p==='Medium'||p==='medium'?'orange':'blue'}>{p||'-'}</Tag> },
            { title:'Urgent',   dataIndex:'is_urgent',key:'urg',    width:80,  render:v=><Tag color={v?'red':'default'}>{v?'Yes':'No'}</Tag> },
            { title:'Due Date', dataIndex:'due_date', key:'due',    width:130, render:d=><span className="hs-reports-subtext">{d?dayjs(d).tz('Asia/Kolkata').format('DD-MM-YYYY'):'-'}</span> },
            { title:'Created',  dataIndex:'created_at',key:'cr',   width:145, render:d=><span className="hs-reports-subtext">{d?dayjs(d).tz('Asia/Kolkata').format('DD-MM-YY HH:mm'):'-'}</span> },
        ];
        if (selectedSection === 'tickets') return [
            actionCol,
            { title:'Subject',  dataIndex:'subject',       key:'sub',  width:280, render:t=><span style={{fontWeight:600,color:'#33475b'}}>{t||'-'}</span> },
            { title:'Created By',dataIndex:'created_by_name',key:'cb', width:150, render:t=><span className="hs-reports-link">{t||'-'}</span> },
            { title:'Assigned', key:'asgn', width:180, render:(_,r)=>{
                if (r.assigned_users?.length) return r.assigned_users.map(u=>u.name||u.user_name||u).join(', ');
                return <span className="hs-reports-subtext">-</span>;
            }},
            { title:'Status',   dataIndex:'status',        key:'st',   width:110, render:s=><Tag color={getStatusColor(s)}>{s||'-'}</Tag> },
            { title:'Priority', dataIndex:'priority',      key:'prio', width:100, render:p=><Tag color={p==='high'?'red':'orange'}>{p||'-'}</Tag> },
            { title:'Tags',     dataIndex:'tags',          key:'tags', width:150, render:tags=>Array.isArray(tags)?tags.map(t=><Tag key={t} style={{fontSize:'10px'}}>{t}</Tag>):'-' },
            { title:'Created',  dataIndex:'created_at',   key:'cr',   width:145, render:d=><span className="hs-reports-subtext">{d?dayjs(d).tz('Asia/Kolkata').format('DD-MM-YY HH:mm'):'-'}</span> },
        ];
        const sample = filteredData[0] || {};
        const keys = Object.keys(sample).filter(k => !k.startsWith('_') && k!=='id').slice(0,7);
        return [actionCol, ...keys.map(k => ({
            title: k.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()), dataIndex:k, key:k, width:150,
            render: v => { if(typeof v==='object') return <span className="hs-reports-subtext">{JSON.stringify(v)}</span>; if(typeof v==='boolean') return v?'Yes':'No'; return v||'-'; }
        }))];
    };

    const renderDetailContent = () => {
        if (!selectedLead) return null;
        return (
            <Tabs activeKey={activeDetailTab} onChange={setActiveDetailTab}
                items={[
                    { key:'about', label:<span><UserOutlined /> About</span>, children:(
                        <Descriptions bordered column={2} size="small">
                            {[['Lead ID',selectedLead.custom_lead_id],['Name',`${selectedLead.first_name||''} ${selectedLead.last_name||''}`],
                              ['Email',selectedLead.email],['Phone',selectedLead.phone],
                              ['Status',<Tag color={getStatusColor(selectedLead.status)}>{selectedLead.status}</Tag>],
                              ['Loan Type',selectedLead.loan_type_name||selectedLead.loan_type],
                              ['Loan Amt',selectedLead.loan_amount?`₹${Number(selectedLead.loan_amount).toLocaleString()}`:'-'],
                              ['Salary',selectedLead.salary?`₹${Number(selectedLead.salary).toLocaleString()}`:'-'],
                              ['Company',selectedLead.company_name],['Assigned To',getUserName(selectedLead.assigned_to)],
                              ['Created',selectedLead.created_date?dayjs(selectedLead.created_date).tz('Asia/Kolkata').format('DD-MM-YYYY HH:mm'):'-'],
                              ['Source',selectedLead.source],
                            ].map(([lbl,val])=>(
                                <Descriptions.Item key={lbl} label={lbl}>{val||'-'}</Descriptions.Item>
                            ))}
                        </Descriptions>
                    )},
                    { key:'obligations', label:<span><FileProtectOutlined /> Obligations</span>, children:(
                        selectedLead.dynamic_fields?.obligations?.length>0 ? (
                            <Table size="small" pagination={false} scroll={{x:900}}
                                dataSource={selectedLead.dynamic_fields.obligations.map((o,i)=>({...o,key:i}))}
                                columns={[
                                    {title:'#',key:'i',width:40,render:(_,__,i)=>i+1},
                                    {title:'Type',dataIndex:'type',width:110},
                                    {title:'Bank',dataIndex:'bank_name',width:140},
                                    {title:'EMI',dataIndex:'emi_amount',width:110,render:v=><span className="hs-reports-amount">{v?`₹${Number(v).toLocaleString()}`:'-'}</span>},
                                    {title:'Outstanding',dataIndex:'outstanding_amount',width:120,render:v=><span className="hs-reports-amount">{v?`₹${Number(v).toLocaleString()}`:'-'}</span>},
                                ]} />
                        ) : <div style={{textAlign:'center',color:'#516f90',padding:'40px'}}>No obligations data</div>
                    )},
                    { key:'remarks', label:<span><FileTextOutlined /> Remarks</span>, children:(
                        <Descriptions bordered column={1} size="small">
                            {[['General',selectedLead.remarks||selectedLead.notes],['Login',selectedLead.login_remarks],
                              ['Credit',selectedLead.credit_remarks],['Operations',selectedLead.operations_remarks]
                            ].map(([lbl,val])=>(
                                <Descriptions.Item key={lbl} label={lbl} contentStyle={{ whiteSpace:'pre-wrap' }}>{val||'-'}</Descriptions.Item>
                            ))}
                        </Descriptions>
                    )},
                    { key:'activity', label:<span><HistoryOutlined /> Activity</span>, children:(
                        selectedLead.activity?.length>0 ? (
                            <Table size="small" pagination={false} scroll={{x:600}}
                                dataSource={selectedLead.activity.map((a,i)=>({...a,key:i}))}
                                columns={[
                                    {title:'Date',dataIndex:'timestamp',width:150,render:t=><span className="hs-reports-subtext">{t?dayjs(t).tz('Asia/Kolkata').format('DD-MM-YY HH:mm'):'-'}</span>},
                                    {title:'User',dataIndex:'user',width:120,render:u=><span className="hs-reports-link">{u||'-'}</span>},
                                    {title:'Action',dataIndex:'action'},
                                ]} />
                        ) : <div style={{textAlign:'center',color:'#516f90',padding:'40px'}}>No activity</div>
                    )},
                ]} />
        );
    };

    const handleSectionChange = (key) => {
        setSelectedSection(key); setData([]); setFilteredData([]);
        setSelectedRows([]); setSelectedRowKeys([]); resetFilters();
    };
    const handleRefresh = () => { fetchSectionData(); };
    const grouped = ['leads','work','hr'].map(g => ({ label: GROUP_LABELS[g], items: SECTIONS.filter(s => s.group === g) }));
    const currentSection = SECTIONS.find(s => s.key === selectedSection);

    return (
        <div className="hs-reports-page">
            <aside className="hs-reports-sidebar">
                <div className="hs-reports-sidebar-head">
                    <h1 className="hs-reports-sidebar-title">
                        <BarChartOutlined /> Reporting
                    </h1>
                    <p className="hs-reports-sidebar-sub">
                        Explore CRM, operations, and people reports in one place.
                    </p>
                </div>
                <nav className="hs-reports-sidebar-nav">
                    {grouped.map(({ label, items }) => (
                        <div key={label}>
                            <div className="hs-reports-group-label">{label}</div>
                            {items.map(sec => (
                                <button
                                    key={sec.key}
                                    type="button"
                                    className={`hs-reports-nav-item${selectedSection === sec.key ? ' active' : ''}`}
                                    onClick={() => handleSectionChange(sec.key)}
                                >
                                    <span className="hs-reports-nav-icon" style={{ color: selectedSection === sec.key ? sec.color : '#99acc2' }}>
                                        {sec.icon}
                                    </span>
                                    <span className="hs-reports-nav-label">{sec.label}</span>
                                    {counts[sec.key] !== undefined && (
                                        <span className="hs-reports-nav-count">{counts[sec.key]}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="hs-reports-main">
                <div className="hs-reports-topbar">
                    <div className="hs-reports-breadcrumb">
                        <span className="hs-reports-breadcrumb-root">Reporting</span>
                        <span className="hs-reports-breadcrumb-sep">›</span>
                        <span className="hs-reports-breadcrumb-current">{currentSection?.label}</span>
                        <span className="hs-reports-record-count">({filteredData.length} records)</span>
                    </div>
                    <div className="hs-reports-top-actions">
                        <button type="button" className="hs-reports-btn hs-reports-btn-secondary" onClick={handleRefresh} disabled={loading}>
                            <ReloadOutlined spin={loading} /> Refresh
                        </button>
                    </div>
                </div>

                <div className="hs-reports-metrics">
                    {[
                        { key:'total', label:'Total', value:statistics.total },
                        { key:'active', label:'Active', value:statistics.active },
                        { key:'completed', label:'Completed', value:statistics.completed },
                        { key:'pending', label:'Pending', value:statistics.pending },
                    ].map(({ key, label, value }) => (
                        <div key={key} className={`hs-reports-metric-card ${key}`}>
                            <div className="hs-reports-metric-value">{value}</div>
                            <div className="hs-reports-metric-label">{label}</div>
                        </div>
                    ))}
                </div>

                <div className="hs-reports-panel">
                    <div className="hs-reports-filters">
                        <span className="hs-reports-filters-label"><FilterOutlined /> Filters</span>
                        <RangePicker size="middle" value={filters.dateRange}
                            onChange={d => setFilters(p=>({...p,dateRange:d}))} placeholder={['Start date','End date']} style={{ width:240 }} />
                        <Select size="middle" placeholder="Status" style={{ width:140 }} value={filters.status}
                            onChange={v => setFilters(p=>({...p,status:v}))} allowClear>
                            {['Active','Pending','Completed','Approved','Rejected','New'].map(s=>
                                <Option key={s} value={s.toLowerCase()}>{s}</Option>)}
                        </Select>
                        <Search size="middle" placeholder="Search records" prefix={<SearchOutlined />} style={{ width:220 }} allowClear
                            onSearch={v => setFilters(p=>({...p,searchText:v}))}
                            onChange={e => !e.target.value && setFilters(p=>({...p,searchText:''}))} />
                        <Button onClick={resetFilters}>Reset</Button>
                        <Button icon={<FileExcelOutlined />} onClick={exportBulkToExcel} disabled={!selectedRows.length}>
                            Export selected ({selectedRows.length})
                        </Button>
                        <Button type="primary" icon={<DownloadOutlined />} onClick={exportAllToExcel} disabled={!filteredData.length}
                            style={{ background:'#ff7a59', borderColor:'#ff7a59' }}>
                            Export all
                        </Button>
                    </div>

                    <div className="hs-reports-table-wrap">
                        <Spin spinning={loading} tip="Loading report data…">
                            <Table
                                rowSelection={{ selectedRowKeys, onChange:(keys,rows)=>{setSelectedRowKeys(keys);setSelectedRows(rows);} }}
                                columns={getColumns()}
                                dataSource={filteredData}
                                rowKey={r => r._id?.$oid || r._id || r.id || Math.random().toString(36)}
                                scroll={{ x:'max-content', y:'calc(100dvh - 24rem)' }}
                                size="middle"
                                pagination={{ total:filteredData.length, pageSize:50, showSizeChanger:true, showQuickJumper:true, pageSizeOptions:['25','50','100','200'], showTotal:(t,[s,e])=>`${s}-${e} of ${t}` }}
                                onRow={record => ({ onClick:()=>handleRowClick(record), style:{ cursor:['plod-leads','login-leads'].includes(selectedSection)?'pointer':'default' } })}
                            />
                        </Spin>
                    </div>
                </div>
            </main>

            <Modal
                className="hs-reports-modal"
                title={<span><UserOutlined /> Lead details</span>}
                open={detailModalVisible}
                onCancel={()=>{setDetailModalVisible(false);setSelectedLead(null);}}
                footer={null}
                width={760}
                style={{ top:40 }}
                destroyOnClose
            >
                <Spin spinning={detailLoading} tip="Loading lead details…">{renderDetailContent()}</Spin>
            </Modal>
        </div>
    );
};

export default ComprehensiveReportDark;
