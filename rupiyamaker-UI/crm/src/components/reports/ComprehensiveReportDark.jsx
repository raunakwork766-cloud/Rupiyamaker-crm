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
import { leadsService } from '../../services/leadsService';
import { hrmsService } from '../../services/hrmsService';
import { ticketsAPI } from '../../services/api';
import axios from 'axios';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://156.67.111.95:8049';

const SECTIONS = [
    { key: 'plod-leads',  label: 'Lead CRM', icon: <CreditCardOutlined />, color: '#6366f1', group: 'leads' },
    { key: 'login-leads', label: 'Login Leads',   icon: <FileTextOutlined />,   color: '#3b82f6', group: 'leads' },
    { key: 'tasks',       label: 'Tasks',         icon: <CheckCircleOutlined />,color: '#10b981', group: 'work'  },
    { key: 'tickets',     label: 'Tickets',       icon: <SolutionOutlined />,   color: '#f59e0b', group: 'work'  },
    { key: 'attendance',  label: 'Attendance',    icon: <CalendarOutlined />,   color: '#06b6d4', group: 'hr'   },
    { key: 'employees',   label: 'Employees',     icon: <TeamOutlined />,       color: '#ec4899', group: 'hr'   },
    { key: 'leaves',      label: 'Leaves',        icon: <ClockCircleOutlined />,color: '#f97316', group: 'hr'   },
];
const GROUP_LABELS = { leads: 'CRM LEADS', work: 'WORK', hr: 'HR' };

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
            const res = await leadsService.getAllLeads();
            if (res.success) {
                const arr = Array.isArray(res.data) ? res.data : (res.data?.items || []);
                setAllLeads(arr);
                setCounts(p => ({ ...p, 'plod-leads': arr.length }));
            }
        } catch (e) { console.error('fetchAllLeads', e); }
    };

    const fetchSectionData = async () => {
        setLoading(true);
        try {
            let fetched = [];
            switch (selectedSection) {
                case 'plod-leads': {
                    const res = await leadsService.getAllLeads();
                    if (res.success) {
                        fetched = Array.isArray(res.data) ? res.data : (res.data?.items || []);
                    } else {
                        // try direct axios fallback
                        try {
                            const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
                            const r = await axios.get(`/api/leads?user_id=${userId}`, {
                                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                            });
                            fetched = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.leads || r.data?.data || []);
                        } catch (e2) { console.error('leads fallback error', e2); }
                    }
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
    const exportAllToExcel = () => {
        if (!filteredData.length) { message.warning('No data'); return; }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(filteredData.map(r => { const o = {}; Object.keys(r).forEach(k => { if (!k.startsWith('_')) o[fmtLabel(k)] = r[k]; }); return o; }));
        XLSX.utils.book_append_sheet(wb, ws, selectedSection);
        XLSX.writeFile(wb, `${selectedSection}-${dayjs().format('YYYY-MM-DD')}.xlsx`);
        message.success('Exported');
    };
    const exportBulkToExcel = () => {
        if (!selectedRows.length) { message.warning('Select records'); return; }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(selectedRows.map(r => { const o = {}; Object.keys(r).forEach(k => { if (!k.startsWith('_')) o[fmtLabel(k)] = r[k]; }); return o; }));
        XLSX.utils.book_append_sheet(wb, ws, selectedSection);
        XLSX.writeFile(wb, `${selectedSection}-selected-${dayjs().format('YYYY-MM-DD')}.xlsx`);
        message.success(`Exported ${selectedRows.length} records`);
    };
    const exportRowExcel = (record) => {
        const wb = XLSX.utils.book_new();
        const o = {}; Object.keys(record).forEach(k => { if (!k.startsWith('_')) o[fmtLabel(k)] = record[k]; });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([o]), 'Record');
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
        title:'', key:'act', width:70, fixed:'right',
        render: (_, record) => (
            <Space size={4}>
                {['plod-leads','login-leads'].includes(selectedSection) && (
                    <Tooltip title="View"><Button type="primary" size="small" icon={<EyeOutlined />}
                        onClick={e => { e.stopPropagation(); handleRowClick(record); }}
                        style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none' }} /></Tooltip>
                )}
                <Tooltip title="Export Row"><Button size="small" icon={<DownloadOutlined />}
                    onClick={e => { e.stopPropagation(); exportRowExcel(record); }}
                    style={{ background:'rgba(245,158,11,0.15)', border:'1px solid #f59e0b', color:'#f59e0b' }} /></Tooltip>
            </Space>
        ),
    };

    const getColumns = () => {
        const isLead = ['plod-leads','login-leads'].includes(selectedSection);
        if (isLead) return [
            actionCol,
            { title:'Lead ID',  dataIndex:'custom_lead_id', key:'lid',    width:130, render:t=><span style={{color:'#a78bfa',fontWeight:500}}>{t||'-'}</span> },
            { title:'Name',     key:'name', width:180, render:(_,r)=>(<div><div style={{fontWeight:600,color:'#f3f4f6'}}>{r.first_name||''} {r.last_name||''}</div><div style={{fontSize:'11px',color:'#9ca3af'}}>{r.email||''}</div></div>) },
            { title:'Phone',    dataIndex:'phone',       key:'ph',    width:130, render:t=><span style={{color:'#cbd5e1'}}>{t||'-'}</span> },
            { title:'Loan Type',dataIndex:'loan_type_name',key:'lt',  width:130, render:t=><span style={{color:'#fcd34d'}}>{t||'-'}</span> },
            { title:'Status',   dataIndex:'status',      key:'st',    width:125, render:s=><Tag style={{fontSize:'10px'}} color={getStatusColor(s)}>{s||'-'}</Tag> },
            { title:'Sub Status',dataIndex:'sub_status', key:'sub',   width:150, render:t=><span style={{color:'#9ca3af'}}>{t||'-'}</span> },
            { title:'Loan Amt', dataIndex:'loan_amount', key:'la',    width:120, render:a=><span style={{color:'#34d399',fontWeight:600}}>{a?`₹${Number(a).toLocaleString()}`:'-'}</span> },
            { title:'Assigned', key:'asgn', width:160, render:(_,r)=><span style={{color:'#cbd5e1'}}>{getUserName(r.assigned_to)}</span> },
            { title:'Created',  dataIndex:'created_date',key:'cr',    width:150, render:d=><span style={{color:'#6b7280'}}>{d?dayjs(d).format('DD-MM-YY HH:mm'):'-'}</span> },
        ];
        if (selectedSection === 'employees') return [
            actionCol,
            { title:'Emp ID',    dataIndex:'employee_id',    key:'eid',   width:120, render:t=><span style={{color:'#a78bfa'}}>{t||'-'}</span> },
            { title:'Name',      key:'name', width:180, render:(_,r)=><span style={{fontWeight:600,color:'#f3f4f6'}}>{r.first_name||''} {r.last_name||''}</span> },
            { title:'Email',     dataIndex:'email',          key:'em',    width:210, render:t=><span style={{color:'#cbd5e1'}}>{t||'-'}</span> },
            { title:'Department',dataIndex:'department_name',key:'dept',  width:150, render:t=><span style={{color:'#cbd5e1'}}>{t||'-'}</span> },
            { title:'Designation',dataIndex:'designation_name',key:'des',width:150, render:t=><span style={{color:'#cbd5e1'}}>{t||'-'}</span> },
            { title:'Status',    dataIndex:'is_active',      key:'act',   width:90,  render:a=><Tag color={a?'green':'red'}>{a?'Active':'Inactive'}</Tag> },
        ];
        if (selectedSection === 'tasks') return [
            actionCol,
            { title:'Subject',  dataIndex:'subject',  key:'subject', width:280, render:t=><span style={{color:'#f3f4f6',fontWeight:500}}>{t||'-'}</span> },
            { title:'Type',     dataIndex:'task_type',key:'type',    width:120, render:t=><span style={{color:'#a78bfa'}}>{t||'-'}</span> },
            { title:'Assigned', key:'asgn', width:170, render:(_,r)=>{
                if (r.assigned_users?.length) return <span style={{color:'#cbd5e1'}}>{r.assigned_users.map(u=>u.name||u).join(', ')}</span>;
                if (r.assigned_to) return <span style={{color:'#cbd5e1'}}>{getUserName(Array.isArray(r.assigned_to)?r.assigned_to[0]:r.assigned_to)}</span>;
                return <span style={{color:'#9ca3af'}}>Unassigned</span>;
            }},
            { title:'Status',   dataIndex:'status',   key:'st',     width:120, render:s=><Tag color={s==='Completed'||s==='completed'?'green':s==='In Progress'?'blue':'orange'}>{s||'-'}</Tag> },
            { title:'Priority', dataIndex:'priority', key:'prio',   width:100, render:p=><Tag color={p==='High'||p==='high'?'red':p==='Medium'||p==='medium'?'orange':'blue'}>{p||'-'}</Tag> },
            { title:'Urgent',   dataIndex:'is_urgent',key:'urg',    width:80,  render:v=><Tag color={v?'red':'default'}>{v?'Yes':'No'}</Tag> },
            { title:'Due Date', dataIndex:'due_date', key:'due',    width:130, render:d=><span style={{color:'#9ca3af'}}>{d?dayjs(d).format('DD-MM-YYYY'):'-'}</span> },
            { title:'Created',  dataIndex:'created_at',key:'cr',   width:145, render:d=><span style={{color:'#6b7280'}}>{d?dayjs(d).format('DD-MM-YY HH:mm'):'-'}</span> },
        ];
        if (selectedSection === 'tickets') return [
            actionCol,
            { title:'Subject',  dataIndex:'subject',       key:'sub',  width:280, render:t=><span style={{color:'#f3f4f6',fontWeight:500}}>{t||'-'}</span> },
            { title:'Created By',dataIndex:'created_by_name',key:'cb', width:150, render:t=><span style={{color:'#a78bfa'}}>{t||'-'}</span> },
            { title:'Assigned', key:'asgn', width:180, render:(_,r)=>{
                if (r.assigned_users?.length) return <span style={{color:'#cbd5e1'}}>{r.assigned_users.map(u=>u.name||u.user_name||u).join(', ')}</span>;
                return <span style={{color:'#9ca3af'}}>-</span>;
            }},
            { title:'Status',   dataIndex:'status',        key:'st',   width:110, render:s=><Tag color={getStatusColor(s)}>{s||'-'}</Tag> },
            { title:'Priority', dataIndex:'priority',      key:'prio', width:100, render:p=><Tag color={p==='high'?'red':'orange'}>{p||'-'}</Tag> },
            { title:'Tags',     dataIndex:'tags',          key:'tags', width:150, render:tags=>Array.isArray(tags)?tags.map(t=><Tag key={t} style={{fontSize:'10px'}}>{t}</Tag>):'-' },
            { title:'Created',  dataIndex:'created_at',   key:'cr',   width:145, render:d=><span style={{color:'#6b7280'}}>{d?dayjs(d).format('DD-MM-YY HH:mm'):'-'}</span> },
        ];
        const sample = filteredData[0] || {};
        const keys = Object.keys(sample).filter(k => !k.startsWith('_') && k!=='id').slice(0,7);
        return [actionCol, ...keys.map(k => ({
            title: k.replace(/_/g,' ').toUpperCase(), dataIndex:k, key:k, width:150,
            render: v => { if(typeof v==='object') return <span style={{color:'#6b7280'}}>{JSON.stringify(v)}</span>; if(typeof v==='boolean') return v?'Yes':'No'; return <span style={{color:'#cbd5e1'}}>{v||'-'}</span>; }
        }))];
    };

    const renderDetailContent = () => {
        if (!selectedLead) return null;
        return (
            <Tabs activeKey={activeDetailTab} onChange={setActiveDetailTab}
                style={{color:'#e5e7eb'}} tabBarStyle={{background:'#1f2937',borderBottom:'1px solid #374151'}}
                items={[
                    { key:'about', label:<span><UserOutlined /> About</span>, children:(
                        <Descriptions bordered column={2} size="small" style={{background:'#1f2937'}}>
                            {[['Lead ID',selectedLead.custom_lead_id],['Name',`${selectedLead.first_name||''} ${selectedLead.last_name||''}`],
                              ['Email',selectedLead.email],['Phone',selectedLead.phone],
                              ['Status',<Tag color={getStatusColor(selectedLead.status)}>{selectedLead.status}</Tag>],
                              ['Loan Type',selectedLead.loan_type_name||selectedLead.loan_type],
                              ['Loan Amt',selectedLead.loan_amount?`₹${Number(selectedLead.loan_amount).toLocaleString()}`:'-'],
                              ['Salary',selectedLead.salary?`₹${Number(selectedLead.salary).toLocaleString()}`:'-'],
                              ['Company',selectedLead.company_name],['Assigned To',getUserName(selectedLead.assigned_to)],
                              ['Created',selectedLead.created_date?dayjs(selectedLead.created_date).format('DD-MM-YYYY HH:mm'):'-'],
                              ['Source',selectedLead.source],
                            ].map(([lbl,val])=>(
                                <Descriptions.Item key={lbl} label={lbl}
                                    labelStyle={{color:'#9ca3af',background:'#1f2937'}}
                                    contentStyle={{color:'#e5e7eb',background:'#0f0f14'}}>{val||'-'}</Descriptions.Item>
                            ))}
                        </Descriptions>
                    )},
                    { key:'obligations', label:<span><FileProtectOutlined /> Obligations</span>, children:(
                        selectedLead.dynamic_fields?.obligations?.length>0 ? (
                            <Table size="small" pagination={false} scroll={{x:900}}
                                dataSource={selectedLead.dynamic_fields.obligations.map((o,i)=>({...o,key:i}))}
                                columns={[
                                    {title:'#',key:'i',width:40,render:(_,__,i)=><span style={{color:'#9ca3af'}}>{i+1}</span>},
                                    {title:'Type',dataIndex:'type',width:110,render:t=><span style={{color:'#e5e7eb'}}>{t||'-'}</span>},
                                    {title:'Bank',dataIndex:'bank_name',width:140,render:t=><span style={{color:'#cbd5e1'}}>{t||'-'}</span>},
                                    {title:'EMI',dataIndex:'emi_amount',width:110,render:v=><span style={{color:'#f59e0b',fontWeight:600}}>{v?`₹${Number(v).toLocaleString()}`:'-'}</span>},
                                    {title:'Outstanding',dataIndex:'outstanding_amount',width:120,render:v=><span style={{color:'#34d399',fontWeight:600}}>{v?`₹${Number(v).toLocaleString()}`:'-'}</span>},
                                ]} />
                        ) : <div style={{textAlign:'center',color:'#9ca3af',padding:'40px'}}>No obligations data</div>
                    )},
                    { key:'remarks', label:<span><FileTextOutlined /> Remarks</span>, children:(
                        <Descriptions bordered column={1} size="small" style={{background:'#1f2937'}}>
                            {[['General',selectedLead.remarks||selectedLead.notes],['Login',selectedLead.login_remarks],
                              ['Credit',selectedLead.credit_remarks],['Operations',selectedLead.operations_remarks]
                            ].map(([lbl,val])=>(
                                <Descriptions.Item key={lbl} label={lbl}
                                    labelStyle={{color:'#9ca3af',background:'#1f2937'}}
                                    contentStyle={{color:'#cbd5e1',background:'#0f0f14',whiteSpace:'pre-wrap'}}>{val||'-'}</Descriptions.Item>
                            ))}
                        </Descriptions>
                    )},
                    { key:'activity', label:<span><HistoryOutlined /> Activity</span>, children:(
                        selectedLead.activity?.length>0 ? (
                            <Table size="small" pagination={false} scroll={{x:600}}
                                dataSource={selectedLead.activity.map((a,i)=>({...a,key:i}))}
                                columns={[
                                    {title:'Date',dataIndex:'timestamp',width:150,render:t=><span style={{color:'#9ca3af',fontSize:'11px'}}>{t?dayjs(t).format('DD-MM-YY HH:mm'):'-'}</span>},
                                    {title:'User',dataIndex:'user',width:120,render:u=><span style={{color:'#a78bfa'}}>{u||'-'}</span>},
                                    {title:'Action',dataIndex:'action',render:a=><span style={{color:'#e5e7eb'}}>{a||'-'}</span>},
                                ]} />
                        ) : <div style={{textAlign:'center',color:'#9ca3af',padding:'40px'}}>No activity</div>
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
        <div style={{ display:'flex', height:'100vh', backgroundColor:'#0a0a0f', color:'#e5e7eb', overflow:'hidden' }}>
            <style>{`
                .rep-nav-item{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:5px;cursor:pointer;transition:all 0.18s;font-size:13px;color:#9ca3af;margin:2px 0;border-left:3px solid transparent;}
                .rep-nav-item:hover{background:rgba(255,255,255,0.05);color:#e5e7eb;}
                .rep-nav-item.active{background:rgba(99,102,241,0.14);color:#c4b5fd;}
                .rep-nav-cnt{margin-left:auto;background:rgba(99,102,241,0.2);color:#a78bfa;border-radius:10px;padding:0 7px;font-size:10px;font-weight:600;}
                .rep-grp-lbl{font-size:10px;font-weight:700;letter-spacing:1.4px;color:#374151;padding:10px 12px 3px;margin-top:4px;}
                .rrt .ant-table-thead>tr>th{background:#111827!important;color:#9ca3af!important;border-bottom:1px solid #1f2937!important;padding:6px 8px!important;font-size:11px!important;}
                .rrt .ant-table-tbody>tr>td{background:#0a0a0f!important;color:#cbd5e1!important;border-bottom:1px solid #111827!important;padding:5px 8px!important;font-size:11px!important;}
                .rrt .ant-table-tbody>tr:hover>td{background:#111827!important;cursor:pointer;}
                .rrt .ant-select-selector{background:#111827!important;border-color:#1f2937!important;color:#e5e7eb!important;font-size:11px!important;}
                .rrt .ant-input{background:#111827!important;border-color:#1f2937!important;color:#e5e7eb!important;font-size:11px!important;}
                .rrt .ant-picker{background:#111827!important;border-color:#1f2937!important;font-size:11px!important;}
                .rrt .ant-picker-input input{color:#e5e7eb!important;font-size:11px!important;}
                .rrt .ant-modal-content,.rrt .ant-modal-header{background:#111827!important;border-color:#1f2937!important;}
                .rrt .ant-tabs-tab{color:#9ca3af!important;font-size:11px!important;}
                .rrt .ant-tabs-tab-active .ant-tabs-tab-btn{color:#818cf8!important;}
                .rrt .ant-tabs-ink-bar{background:#818cf8!important;}
                .rrt .ant-pagination{font-size:11px!important;}
                ::-webkit-scrollbar{width:5px;height:5px;}
                ::-webkit-scrollbar-track{background:#0a0a0f;}
                ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px;}
            `}</style>

            {/* Left nav */}
            <div style={{ width:195, flexShrink:0, background:'#0c0c14', borderRight:'1px solid #1a1a28', overflowY:'auto', padding:'10px 6px' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#6366f1', padding:'4px 12px 10px', borderBottom:'1px solid #1a1a28', marginBottom:2, display:'flex', alignItems:'center', gap:8 }}>
                    <BarChartOutlined /> REPORTS
                </div>
                {grouped.map(({ label, items }) => (
                    <div key={label}>
                        <div className="rep-grp-lbl">{label}</div>
                        {items.map(sec => (
                            <div key={sec.key}
                                className={`rep-nav-item${selectedSection===sec.key?' active':''}`}
                                style={{ borderLeftColor: selectedSection===sec.key ? sec.color : 'transparent' }}
                                onClick={() => handleSectionChange(sec.key)}>
                                <span style={{ color: selectedSection===sec.key ? sec.color : '#4b5563' }}>{sec.icon}</span>
                                <span style={{ flex:1 }}>{sec.label}</span>
                                {counts[sec.key]!==undefined && <span className="rep-nav-cnt">{counts[sec.key]}</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="rrt" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

                {/* Topbar */}
                <div style={{ background:'#0c0c14', borderBottom:'1px solid #1a1a28', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <span style={{ color: currentSection?.color, fontSize:15 }}>{currentSection?.icon}</span>
                        <span style={{ fontWeight:700, fontSize:14, color:'#f3f4f6' }}>{currentSection?.label}</span>
                        <span style={{ fontSize:12, color:'#4b5563', marginLeft:4 }}>({filteredData.length} records)</span>
                    </div>
                    <Button icon={<ReloadOutlined />} size="small" onClick={handleRefresh} loading={loading}
                        style={{ background:'rgba(16,185,129,0.12)', border:'1px solid #10b981', color:'#10b981' }}>
                        Refresh
                    </Button>
                </div>

                {/* Stats */}
                <div style={{ display:'flex', gap:8, padding:'8px 14px', flexShrink:0, borderBottom:'1px solid #1a1a28', background:'#0c0c14' }}>
                    {[
                        { label:'Total',     value:statistics.total,     color:'#6366f1' },
                        { label:'Active',    value:statistics.active,    color:'#3b82f6' },
                        { label:'Completed', value:statistics.completed, color:'#10b981' },
                        { label:'Pending',   value:statistics.pending,   color:'#f59e0b' },
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{ flex:1, background:'#0f0f18', border:`1px solid ${color}25`, borderRadius:7, padding:'7px 12px', textAlign:'center' }}>
                            <div style={{ fontSize:18, fontWeight:700, color }}>{value}</div>
                            <div style={{ fontSize:'10px', color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.7px' }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div style={{ padding:'6px 14px', background:'#0a0a0f', borderBottom:'1px solid #1a1a28', flexShrink:0 }}>
                    <Space size={6} wrap>
                        <RangePicker size="small" value={filters.dateRange}
                            onChange={d => setFilters(p=>({...p,dateRange:d}))} placeholder={['Start','End']} style={{ width:220 }} />
                        <Select size="small" placeholder="Status" style={{ width:130 }} value={filters.status}
                            onChange={v => setFilters(p=>({...p,status:v}))} allowClear>
                            {['Active','Pending','Completed','Approved','Rejected','New'].map(s=>
                                <Option key={s} value={s.toLowerCase()}>{s}</Option>)}
                        </Select>
                        <Search size="small" placeholder="Search…" style={{ width:200 }} allowClear
                            onSearch={v => setFilters(p=>({...p,searchText:v}))}
                            onChange={e => !e.target.value && setFilters(p=>({...p,searchText:''}))} />
                        <Button size="small" icon={<ReloadOutlined />} onClick={resetFilters}>Reset</Button>
                        <Button size="small" icon={<FileExcelOutlined />} onClick={exportBulkToExcel} disabled={!selectedRows.length}
                            style={{ background:selectedRows.length?'rgba(99,102,241,0.15)':undefined, border:selectedRows.length?'1px solid #6366f1':undefined, color:selectedRows.length?'#a5b4fc':undefined }}>
                            Export ({selectedRows.length})
                        </Button>
                        <Button size="small" icon={<DownloadOutlined />} onClick={exportAllToExcel} disabled={!filteredData.length}
                            style={{ background:filteredData.length?'rgba(16,185,129,0.12)':undefined, border:filteredData.length?'1px solid #10b981':undefined, color:filteredData.length?'#10b981':undefined }}>
                            Export All
                        </Button>
                    </Space>
                </div>

                {/* Table */}
                <div style={{ flex:1, overflow:'auto', padding:'4px 6px 8px' }}>
                    <Spin spinning={loading} tip="Loading…" size="large">
                        <Table
                            rowSelection={{ selectedRowKeys, onChange:(keys,rows)=>{setSelectedRowKeys(keys);setSelectedRows(rows);} }}
                            columns={getColumns()}
                            dataSource={filteredData}
                            rowKey={r => r._id?.$oid || r._id || r.id || Math.random().toString(36)}
                            scroll={{ x:'max-content' }}
                            size="small"
                            pagination={{ total:filteredData.length, pageSize:50, showSizeChanger:true, showQuickJumper:true, pageSizeOptions:['25','50','100','200'], showTotal:(t,[s,e])=>`${s}-${e} of ${t}` }}
                            onRow={record => ({ onClick:()=>handleRowClick(record), style:{ cursor:['plod-leads','login-leads'].includes(selectedSection)?'pointer':'default' } })}
                        />
                    </Spin>
                </div>
            </div>

            {/* Detail Modal */}
            <Modal
                title={<span style={{color:'#f3f4f6',fontWeight:600}}><UserOutlined /> Lead Details</span>}
                open={detailModalVisible}
                onCancel={()=>{setDetailModalVisible(false);setSelectedLead(null);}}
                footer={null} width={640} style={{top:30}}
                styles={{ body: { padding:'8px', background:'#111827' } }}>
                <Spin spinning={detailLoading} tip="Loading…">{renderDetailContent()}</Spin>
            </Modal>
        </div>
    );
};

export default ComprehensiveReportDark;
