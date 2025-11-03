import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, User, Building, CreditCard, FileText, MessageSquare,
    Paperclip, CheckSquare, Activity, UserCheck, Share2, Lock,
    Calendar, Phone, Mail, MapPin, DollarSign, Star, Upload,
    Plus, Edit3, Trash2, Save, X, Eye, Download, Copy
} from 'lucide-react';

// Import new section components
import AboutSection from './lead-details/AboutSection';
import HowToProcessSection from './lead-details/HowToProcessSection';
import StatusSection from './lead-details/StatusSection';
import ObligationsSection from './lead-details/ObligationsSection';
import AssignmentInfoSection from './lead-details/AssignmentInfoSection';
import RemarksSection from './lead-details/RemarksSection';
import AttachmentsSection from './lead-details/AttachmentsSection';
import TasksSection from './lead-details/TasksSection';
import ActivitiesSection from './lead-details/ActivitiesSection';
import TasksSection from './lead-details/TasksSection';
import ActivitiesSection from './lead-details/ActivitiesSection';

export default function LeadDetails({ lead, user, onBack }) {
    const [activeTab, setActiveTab] = useState('details');
    const [leadData, setLeadData] = useState(lead);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Add this function to update a lead
    const updateLead = async (updatedData) => {
        try {
            setIsLoading(true);
            const userId = localStorage.getItem('userId') || '';

            const response = await fetch(`http://localhost:8048/leads/${lead._id}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...updatedData,
                    updated_by: userId
                })
            });

            if (response.ok) {
                const updatedLead = await response.json();
                setLeadData({ ...leadData, ...updatedData });
                setSuccess('Lead updated successfully');
                return true;
            } else {
                throw new Error('Failed to update lead');
            }
        } catch (error) {
            console.error('Error updating lead:', error);
            setError('Failed to update lead: ' + error.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Tab-specific states - removed since we're using modular components
    const [shareableLink, setShareableLink] = useState('');

    const userId = localStorage.getItem('userId') || '';
    const userDepartment = user?.department || localStorage.getItem('userDepartment') || 'sales';

    const tabs = [
        { id: 'details', label: 'Lead Details', icon: User },
        { id: 'obligations', label: 'Obligations', icon: CreditCard },
        { id: 'remarks', label: 'Remarks', icon: MessageSquare },
        { id: 'attachments', label: 'Attachments', icon: Paperclip },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'activities', label: 'Activities', icon: Activity }
    ];

    // No need for useEffect to load tab data since modular components handle their own data loading

    const updateLeadStatus = async (status, subStatus) => {
        try {
            setIsLoading(true);
            const response = await fetch(`http://localhost:8048/leads/${lead._id}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status,
                    sub_status: subStatus,
                    updated_by: userId
                })
            });

            if (response.ok) {
                const updatedData = await response.json();
                setLeadData(prev => ({
                    ...prev,
                    status: status,
                    sub_status: subStatus
                }));
                setSuccess('Status updated successfully');
            } else {
                throw new Error('Failed to update status');
            }
        } catch (error) {
            setError('Failed to update status');
        } finally {
            setIsLoading(false);
        }
    };

    const generateShareableLink = async () => {
        try {
            const response = await fetch(`http://localhost:8048/leads/${lead._id}/share-link?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                setShareableLink(data.link);
                setSuccess('Shareable link generated successfully');
            }
        } catch (error) {
            setError('Failed to generate shareable link');
        }
    };

    const assignReportTo = async (reportToUserId) => {
        try {
            const response = await fetch(`http://localhost:8048/leads/${lead._id}/assign-report?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    report_to: reportToUserId
                })
            });

            if (response.ok) {
                setSuccess('Report assignment updated successfully');
            }
        } catch (error) {
            setError('Failed to update report assignment');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return amount ? `₹${parseInt(amount).toLocaleString('en-IN')}` : 'N/A';
    };

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={onBack}
                                className="mr-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-white">
                                    {leadData.first_name} {leadData.last_name}
                                </h1>
                                <p className="text-gray-400">
                                    Lead ID: {leadData.custom_lead_id || leadData._id?.slice(-8)} | {leadData.phone} | {leadData.email}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={generateShareableLink}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Share
                            </button>
                            <div className="text-right">
                                <div className="text-sm text-gray-400">Status</div>
                                <div className="space-y-1">
                                    <div className="text-white font-semibold">
                                        {leadData.status || (userDepartment === 'sales' ? 'ACTIVE LEAD' : 'ACTIVE LOGIN')}
                                    </div>
                                    {leadData.sub_status && (
                                        <div className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full border border-gray-600">
                                            {leadData.sub_status}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-6">
                        {error}
                        <button
                            onClick={() => setError('')}
                            className="ml-4 text-red-400 hover:text-red-200"
                        >
                            ×
                        </button>
                    </div>
                )}

                {success && (
                    <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded-lg mb-6">
                        {success}
                        <button
                            onClick={() => setSuccess('')}
                            className="ml-4 text-green-400 hover:text-green-200"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden mb-6">
                    <div className="flex border-b border-gray-800 overflow-x-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;

                            // Check if user can view this tab
                            const canViewTab = leadData.can_view_all_tabs ||
                                tab.id === 'details' || // Details tab always visible
                                (tab.id === 'remarks' && (leadData.can_add_notes || leadData.can_edit)) ||
                                (tab.id === 'attachments' && (leadData.can_upload_attachments || leadData.can_edit)) ||
                                (tab.id === 'tasks' && (leadData.can_add_tasks || leadData.can_edit)) ||
                                (tab.id === 'activities' && leadData.can_view_all_tabs) ||
                                (tab.id === 'obligations' && leadData.can_view_all_tabs);

                            if (!canViewTab) return null;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center px-6 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-400 bg-gray-800'
                                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                                        }`}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'details' && (
                            <div className="space-y-6">
                                {/* About Section */}
                                <AboutSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                    currentUserRole={user}
                                />

                                {/* How To Process Section */}
                                <HowToProcessSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                />

                                {/* Status Section */}
                                <StatusSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                    userDepartment={userDepartment}
                                    formatDate={formatDate}
                                />

                                {/* Assignment Information */}
                                <AssignmentInfoSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                    userDepartment={userDepartment}
                                    formatDate={formatDate}
                                    user={user}
                                />
                            </div>
                        )}

                        {activeTab === 'obligations' && (
                            <ObligationsSection
                                leadData={leadData}
                                onUpdate={updateLead}
                            />
                        )}

                        
                        {activeTab === 'remarks' && (
                            <RemarksSection
                                leadId={lead._id}
                                userId={userId}
                                formatDate={formatDate}
                            />
                        )}

                        {activeTab === 'attachments' && (
                            <AttachmentsSection
                                leadId={lead._id}
                                userId={userId}
                                formatDate={formatDate}
                            />
                        )}

                        {activeTab === 'tasks' && (
                            <TasksSection
                                leadId={lead._id}
                                userId={userId}
                                formatDate={formatDate}
                            />
                        )}

                        {activeTab === 'activities' && (
                            <ActivitiesSection
                                leadId={lead._id}
                                userId={userId}
                                formatDate={formatDate}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
    const [reportToUsers, setReportToUsers] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState(null);

    const userId = localStorage.getItem('userId') || '';

    useEffect(() => {
        loadCurrentUserInfo();
    }, []);

    useEffect(() => {
        if (currentUserRole) {
            loadReportToUsers();
        }
    }, [currentUserRole]);

    const loadCurrentUserInfo = async () => {
        try {
            const userId = localStorage.getItem('userId');
            const response = await fetch(`http://localhost:8048/users/${userId}`);
            if (response.ok) {
                const userData = await response.json();
                setCurrentUserRole(userData.role_id); // Get the full role object
            }
        } catch (error) {
            console.error('Error loading current user info:', error);
        }
    };

    const loadReportToUsers = async () => {
        try {
            if (!currentUserRole) return;

            const response = await fetch(`http://localhost:8048/users?role_id=${currentUserRole}&user_id=${localStorage.getItem('userId')}`);
            if (response.ok) {
                const data = await response.json();
                setReportToUsers(data || []);
            }
        } catch (error) {
            console.error('Error loading report-to users:', error);
        }
    };

    const updateLead = async (updatedData) => {
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadData._id}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...updatedData,
                    updated_by: userId
                })
            });

            if (response.ok) {
                setLeadData(prev => ({ ...prev, ...updatedData }));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating lead:', error);
            return false;
        }
    };

    return (
        <div className="space-y-6">
            {/* About Section */}
            <AboutSection
                leadData={leadData}
                onUpdate={updateLead}
                currentUserRole={user}
            />

            {/* How To Process Section */}
            <HowToProcessSection
                leadData={leadData}
                onUpdate={updateLead}
            />

            {/* Status Section */}
            <StatusSection
                leadData={leadData}
                onUpdate={updateLead}
                userDepartment={userDepartment}
                formatDate={formatDate}
            />

            {/* Assignment Information */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <UserCheck className="w-5 h-5 mr-2" />
                    Assignment Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Assigned To</label>
                        <div className="text-white">{leadData.assigned_to_name || 'Unassigned'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Created By</label>
                        <div className="text-white">{leadData.created_by_name || 'System'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Report To</label>
                        <select
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            defaultValue={leadData.report_to || ''}
                            onChange={(e) => assignReportTo(e.target.value)}
                        >
                            <option value="">Select TL</option>
                            {reportToUsers.map(user => (
                                <option key={user._id} value={user._id}>
                                    {user.first_name} {user.last_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Team</label>
                        <div className="text-white">{leadData.team_name || 'N/A'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{userDepartment === 'sales' ? 'Campaign' : 'Channel'}</label>
                        <div className="text-white">{leadData.campaign_name || leadData.channel_name || 'N/A'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Created Date</label>
                        <div className="text-white flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {leadData.created_at ? formatDate(leadData.created_at) : 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newRemark, setNewRemark] = useState('');

    // Bank and product lists - same as in CreateLead_new.jsx
    const bankList = [
        "State Bank of India", "HDFC Bank", "ICICI Bank", "Punjab National Bank",
        "Bank of Baroda", "Canara Bank", "Union Bank of India", "Bank of India",
        "Central Bank of India", "Indian Bank", "IDBI Bank", "UCO Bank",
        "Indian Overseas Bank", "Punjab & Sind Bank", "Axis Bank", "Kotak Mahindra Bank",
        "Yes Bank", "IndusInd Bank", "Federal Bank", "South Indian Bank",
        "Karur Vysya Bank", "Tamilnad Mercantile Bank", "City Union Bank",
        "Dhanlaxmi Bank", "Lakshmi Vilas Bank", "RBL Bank", "Bandhan Bank",
        "IDFC First Bank", "AU Small Finance Bank", "Equitas Small Finance Bank"
    ];

    const productTypes = [
        { value: "personal_loan", label: "Personal Loan" },
        { value: "home_loan", label: "Home Loan" },
        { value: "car_loan", label: "Car Loan" },
        { value: "education_loan", label: "Education Loan" },
        { value: "credit_card", label: "Credit Card" },
        { value: "business_loan", label: "Business Loan" },
        { value: "gold_loan", label: "Gold Loan" },
        { value: "loan_against_property", label: "Loan Against Property" },
        { value: "two_wheeler_loan", label: "Two Wheeler Loan" },
        { value: "overdraft", label: "Overdraft" }
    ];

    const actionTypes = [
        { value: "closure", label: "Closure" },
        { value: "transfer", label: "Transfer" },
        { value: "continue", label: "Continue" },
        { value: "restructure", label: "Restructure" }
    ];

    useEffect(() => {
        loadObligationsData();
    }, [leadId]);

    useEffect(() => {
        calculateEligibility();
    }, [obligations, leadData]);

    const loadObligationsData = async () => {
        if (!leadId) return;

        setIsLoading(true);
        try {
            // Load basic lead data first to get dynamic_fields
            const leadResponse = await fetch(`http://localhost:8048/leads/${leadId}?user_id=${userId}`);
            if (leadResponse.ok) {
                const fetchedLeadData = await leadResponse.json();
                setLeadData(fetchedLeadData);

                // Check for obligations in dynamic_fields (primary source)
                let obligationsFound = false;

                // Look for obligations in dynamic_fields
                if (fetchedLeadData.dynamic_fields?.obligations &&
                    Array.isArray(fetchedLeadData.dynamic_fields.obligations) &&
                    fetchedLeadData.dynamic_fields.obligations.length > 0) {

                    console.log("Found obligations in dynamic_fields:", fetchedLeadData.dynamic_fields.obligations);
                    obligationsFound = true;

                    const processedObligations = fetchedLeadData.dynamic_fields.obligations.map(obligation => ({
                        product: obligation.product || '',
                        bankName: obligation.bank_name || '',
                        tenure: obligation.tenure || '',
                        roi: obligation.roi || '',
                        totalLoan: obligation.total_loan || '',
                        outstanding: obligation.outstanding || '',
                        emi: obligation.emi || '',
                        action: obligation.action || ''
                    }));

                    setObligations(processedObligations);

                    // Set eligibility if available
                    if (fetchedLeadData.dynamic_fields?.eligibility) {
                        setEligibility(fetchedLeadData.dynamic_fields.eligibility);
                    }
                }

                // If obligations not found in dynamic_fields, try the secondary API endpoint
                if (!obligationsFound) {
                    try {
                        const response = await fetch(`http://localhost:8048/leads/${leadId}/obligations?user_id=${userId}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.obligations && Array.isArray(data.obligations) && data.obligations.length > 0) {
                                console.log("Found obligations in API response:", data.obligations);

                                const processedObligations = data.obligations.map(obligation => ({
                                    product: obligation.product || '',
                                    bankName: obligation.bank_name || '',
                                    tenure: obligation.tenure || '',
                                    roi: obligation.roi || '',
                                    totalLoan: obligation.total_loan || '',
                                    outstanding: obligation.outstanding || '',
                                    emi: obligation.emi || '',
                                    action: obligation.action || ''
                                }));

                                setObligations(processedObligations);
                                setEligibility(data.eligibility || {});
                                obligationsFound = true;
                            }
                        }
                    } catch (apiError) {
                        console.error("Error fetching obligations from API:", apiError);
                    }
                }

                // If no obligations found anywhere, initialize with an empty one
                if (!obligationsFound) {
                    console.log("No obligations found, initializing with empty one");
                    setObligations([{
                        product: "",
                        bankName: "",
                        tenure: "",
                        roi: "",
                        totalLoan: "",
                        outstanding: "",
                        emi: "",
                        action: "",
                    }]);
                }
            }
        } catch (error) {
            console.error('Error loading obligations:', error);
            setError('Failed to load obligations data: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const parseINR = (value) => {
        if (!value || value === null || value === undefined) return '';
        return value.toString().replace(/[₹,]/g, '');
    };

    const calculateEligibility = () => {
        if (!leadData.salary && !leadData.dynamic_fields?.financial_details?.monthly_income) return;

        const s = parseFloat(parseINR(leadData.salary || leadData.dynamic_fields?.financial_details?.monthly_income)) || 0;
        const ps = parseFloat(parseINR(leadData.partner_salary || leadData.dynamic_fields?.financial_details?.partner_salary)) || 0;
        const yb = parseFloat(parseINR(leadData.yearly_bonus || leadData.dynamic_fields?.financial_details?.yearly_bonus)) || 0;
        const bd = parseInt(leadData.bonus_division || leadData.dynamic_fields?.financial_details?.bonus_division) || 12;
        const monthlyBonus = yb / bd;
        const totalIncome = s + ps + monthlyBonus;
        const fp = parseInt(leadData.foir_percent || leadData.dynamic_fields?.financial_details?.foir_percent) || 60;
        const foirAmount = totalIncome * (fp / 100);

        let totalObligations = 0;
        let totalBtPos = 0;
        for (const row of obligations) {
            totalObligations += parseFloat(row.emi) || 0;
            totalBtPos += parseFloat(row.outstanding) || 0;
        }

        const foirEligibility = foirAmount - totalObligations;
        const multiplierEligibility = totalIncome * 20;

        let finalEligibility = 0;
        if (totalBtPos < foirEligibility) {
            finalEligibility = Math.min(foirEligibility, multiplierEligibility);
        } else {
            finalEligibility = multiplierEligibility - totalBtPos;
        }
        finalEligibility = Math.max(finalEligibility, 0);

        setEligibility({
            totalIncome,
            foirAmount,
            totalObligations,
            totalBtPos,
            foirEligibility,
            multiplierEligibility,
            finalEligibility,
        });
    };

    const handleObligationChange = (idx, field, value) => {
        setObligations((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleAddObligation = () => {
        setObligations((prev) => [
            ...prev,
            {
                product: "",
                bankName: "",
                tenure: "",
                roi: "",
                totalLoan: "",
                outstanding: "",
                emi: "",
                action: "",
            },
        ]);
    };

    const handleDeleteObligation = (idx) => {
        setObligations((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            return next.length === 0
                ? [{
                    product: "",
                    bankName: "",
                    tenure: "",
                    roi: "",
                    totalLoan: "",
                    outstanding: "",
                    emi: "",
                    action: "",
                }]
                : next;
        });
    };

    const handleSaveObligations = async () => {
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            // Process obligations data - same format as CreateLead_new.jsx
            const processedObligations = obligations
                .filter(row => row.product || row.bankName || row.emi || row.totalLoan || row.outstanding)
                .map(row => ({
                    product: row.product,
                    bank_name: row.bankName,
                    tenure: parseInt(row.tenure) || 0,
                    roi: parseFloat(row.roi) || 0,
                    total_loan: parseFloat(row.totalLoan) || 0,
                    outstanding: parseFloat(row.outstanding) || 0,
                    emi: parseFloat(row.emi) || 0,
                    action: row.action
                }));

            // Calculate eligibility one more time to ensure it's accurate
            calculateEligibility();

            const requestData = {
                obligations: processedObligations,
                eligibility: eligibility
            };

            // First, update the lead's dynamic_fields.obligations directly via PUT request
            // This ensures the obligations are properly stored in the lead document
            const updateLeadResponse = await fetch(`http://localhost:8048/leads/${leadId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dynamic_fields: {
                        obligations: processedObligations,
                        eligibility: eligibility
                    },
                    updated_by: userId
                })
            });

            if (!updateLeadResponse.ok) {
                throw new Error('Failed to update lead with obligations');
            }

            // Then, use the specialized obligations endpoint to ensure proper handling
            const obligationsResponse = await fetch(`http://localhost:8048/leads/${leadId}/obligations?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            if (obligationsResponse.ok) {
                // Get the updated lead to ensure we have the latest data
                const leadResponse = await fetch(`http://localhost:8048/leads/${leadId}?user_id=${userId}`);
                if (leadResponse.ok) {
                    const updatedLead = await leadResponse.json();

                    // Process the obligations to match the expected format in the UI
                    const updatedObligations = (updatedLead.dynamic_fields?.obligations || []).map(obligation => ({
                        product: obligation.product || '',
                        bankName: obligation.bank_name || '',
                        tenure: obligation.tenure || '',
                        roi: obligation.roi || '',
                        totalLoan: obligation.total_loan || '',
                        outstanding: obligation.outstanding || '',
                        emi: obligation.emi || '',
                        action: obligation.action || ''
                    }));

                    setObligations(updatedObligations.length > 0 ? updatedObligations : processedObligations);
                    setEligibility(updatedLead.dynamic_fields?.eligibility || eligibility);
                    setLeadData(updatedLead);
                } else {
                    setObligations(processedObligations); // Fallback to local data
                }

                setSuccess('Obligations updated successfully');
                setIsEditing(false);
            } else {
                const errorData = await obligationsResponse.json();
                setError(errorData.detail || 'Failed to update obligations');
            }
        } catch (error) {
            console.error('Error saving obligations:', error);
            setError('Failed to save obligations. Please try again: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setError('');
        setSuccess('');
        loadObligationsData(); // Reload original data
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white flex items-center">
                    <CreditCard className="w-6 h-6 mr-2" />
                    Obligations & Eligibility
                </h3>
                <div className="flex items-center space-x-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveObligations}
                                disabled={isLoading}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {isLoading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                disabled={isLoading}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                        >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Obligations Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-white">Current Obligations</h4>
                        {isEditing && (
                            <button
                                onClick={handleAddObligation}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg flex items-center text-sm"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Row
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Product</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Bank</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tenure</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ROI (%)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Loan</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Outstanding</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">EMI</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Action</th>
                                {isEditing && <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {obligations.map((obligation, idx) => (
                                <tr key={idx} className="bg-gray-800 hover:bg-gray-750">
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <select
                                                value={obligation.product}
                                                onChange={(e) => handleObligationChange(idx, 'product', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                            >
                                                <option value="">Select Product</option>
                                                {productTypes.map(type => (
                                                    <option key={type.value} value={type.value}>{type.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-white text-sm">
                                                {productTypes.find(p => p.value === obligation.product)?.label || obligation.product || '-'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <select
                                                value={obligation.bankName}
                                                onChange={(e) => handleObligationChange(idx, 'bankName', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                            >
                                                <option value="">Select Bank</option>
                                                {bankList.map(bank => (
                                                    <option key={bank} value={bank}>{bank}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-white text-sm">{obligation.bankName || '-'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={obligation.tenure}
                                                onChange={(e) => handleObligationChange(idx, 'tenure', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                placeholder="Months"
                                            />
                                        ) : (
                                            <span className="text-white text-sm">{obligation.tenure ? `${obligation.tenure} months` : '-'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={obligation.roi}
                                                onChange={(e) => handleObligationChange(idx, 'roi', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                placeholder="Rate"
                                            />
                                        ) : (
                                            <span className="text-white text-sm">{obligation.roi ? `${obligation.roi}%` : '-'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={obligation.totalLoan}
                                                onChange={(e) => handleObligationChange(idx, 'totalLoan', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                placeholder="Amount"
                                            />
                                        ) : (
                                            <span className="text-white text-sm">{formatCurrency(obligation.totalLoan)}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={obligation.outstanding}
                                                onChange={(e) => handleObligationChange(idx, 'outstanding', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                placeholder="Outstanding"
                                            />
                                        ) : (
                                            <span className="text-white text-sm">{formatCurrency(obligation.outstanding)}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={obligation.emi}
                                                onChange={(e) => handleObligationChange(idx, 'emi', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                placeholder="EMI"
                                            />
                                        ) : (
                                            <span className="text-white text-sm font-medium">{formatCurrency(obligation.emi)}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <select
                                                value={obligation.action}
                                                onChange={(e) => handleObligationChange(idx, 'action', e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                            >
                                                <option value="">Select Action</option>
                                                {actionTypes.map(action => (
                                                    <option key={action.value} value={action.value}>{action.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-white text-sm">
                                                {actionTypes.find(a => a.value === obligation.action)?.label || obligation.action || '-'}
                                            </span>
                                        )}
                                    </td>
                                    {isEditing && (
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleDeleteObligation(idx)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Eligibility Summary */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Eligibility Summary
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Total Income</div>
                        <div className="text-lg font-semibold text-white">{formatCurrency(eligibility.totalIncome)}</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">FOIR Amount</div>
                        <div className="text-lg font-semibold text-white">{formatCurrency(eligibility.foirAmount)}</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Total Obligations</div>
                        <div className="text-lg font-semibold text-red-400">{formatCurrency(eligibility.totalObligations)}</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Final Eligibility</div>
                        <div className={`text-lg font-semibold ${eligibility.finalEligibility > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(eligibility.finalEligibility)}
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">FOIR Eligibility</div>
                        <div className="text-lg font-semibold text-blue-400">{formatCurrency(eligibility.foirEligibility)}</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Multiplier Eligibility (20x)</div>
                        <div className="text-lg font-semibold text-purple-400">{formatCurrency(eligibility.multiplierEligibility)}</div>
                    </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Eligibility Status:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${eligibility.finalEligibility > 0
                            ? 'bg-green-900 text-green-200'
                            : 'bg-red-900 text-red-200'
                            }`}>
                            {eligibility.finalEligibility > 0 ? 'Eligible' : 'Not Eligible'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoginFormTab({ loginForm, setLoginForm, leadId, userId, shareableLink, generateShareableLink }) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [shareLinks, setShareLinks] = useState([]);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareData, setShareData] = useState({
        expires_at: '',
        max_access_count: 10,
        notes: ''
    });

    const [formData, setFormData] = useState({
        // Project & Customer Info
        project_name: '',
        customer_name: '',
        mobile_number: '',
        alt_mobile_number: '',
        aadhar_number: '',
        pan_card_number: '',
        dob: '',
        father_name: '',
        mother_name: '',
        qualification: '',
        marital_status: '',

        // Banking Details
        salary_account_bank_name: '',
        account_number: '',
        ifsc_code: '',

        // Address Details
        current_address: '',
        current_address_type: '',
        current_address_proof: '',
        years_in_current_address: '',
        years_in_current_city: '',
        permanent_address: '',
        permanent_address_landmark: '',

        // Employment Details
        company_name: '',
        designation: '',
        department: '',
        do_in_current_company: '',
        working_work_experience: '',
        total_work_experience: '',
        personal_mail: '',
        office_mail: '',
        office_address: '',
        office_address_landmark: '',

        // References
        reference1_name: '',
        reference1_mobile: '',
        reference1_relation: '',
        reference1_address: '',
        reference2_name: '',
        reference2_mobile: '',
        reference2_relation: '',
        reference2_address: '',

        // Login Credentials
        login_id: '',
        password: '',
        customer_id: '',
        application_number: '',
        notes: ''
    });

    useEffect(() => {
        if (loginForm) {
            setFormData(prev => ({ ...prev, ...loginForm }));
        }
        loadShareLinks();
    }, [loginForm, leadId]);

    const loadShareLinks = async () => {
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/share-links?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setShareLinks(data);
            }
        } catch (error) {
            console.error('Error loading share links:', error);
        }
    };

    const handleSaveLoginForm = async () => {
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/login-form?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setSuccess('Login form updated successfully');
                setIsEditing(false);
                setLoginForm(formData);
            } else {
                throw new Error('Failed to update login form');
            }
        } catch (error) {
            setError('Failed to update login form');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateShareLink = async () => {
        setIsLoading(true);
        try {
            // Set default expiry to 7 days from now if not set
            if (!shareData.expires_at) {
                const defaultExpiry = new Date();
                defaultExpiry.setDate(defaultExpiry.getDate() + 7);
                setShareData(prev => ({ ...prev, expires_at: defaultExpiry.toISOString().slice(0, 16) }));
                return;
            }

            const response = await fetch(`http://localhost:8048/leads/${leadId}/share?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...shareData,
                    expires_at: new Date(shareData.expires_at).toISOString()
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSuccess('Share link generated successfully!');
                setShowShareModal(false);
                setShareData({ expires_at: '', max_access_count: 10, notes: '' });
                loadShareLinks();
            } else {
                throw new Error('Failed to generate share link');
            }
        } catch (error) {
            setError('Failed to generate share link');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Link copied to clipboard!');
    };

    return (
        <div className="space-y-6">
            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Login Form Details */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <FileText className="w-5 h-5 mr-2" />
                        Login Form Details
                    </h3>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="text-blue-400 hover:text-blue-300 flex items-center"
                        >
                            <Edit3 className="w-4 h-4 mr-1" />
                            {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                        {isEditing && (
                            <button
                                onClick={handleSaveLoginForm}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white flex items-center"
                            >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Project & Customer Information */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">Project & Customer Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Project Name Use for Login Call
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.project_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, project_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.project_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Customer Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.customer_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Mobile Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={formData.mobile_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, mobile_number: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.mobile_number || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Alt Mobile Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={formData.alt_mobile_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, alt_mobile_number: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.alt_mobile_number || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Aadhar Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.aadhar_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, aadhar_number: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.aadhar_number || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Pan Card Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.pan_card_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, pan_card_number: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.pan_card_number || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    DOB
                                </label>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={formData.dob}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.dob || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Father Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.father_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, father_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.father_name || 'N/A'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Banking Details */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">Banking Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Qualification
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.qualification}
                                        onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Graduate">Graduate</option>
                                        <option value="Post Graduate">Post Graduate</option>
                                        <option value="Diploma">Diploma</option>
                                        <option value="12th">12th</option>
                                        <option value="10th">10th</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.qualification || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Salary Account Bank Name
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.salary_account_bank_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, salary_account_bank_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="SBI">SBI</option>
                                        <option value="HDFC">HDFC</option>
                                        <option value="ICICI">ICICI</option>
                                        <option value="Axis">Axis</option>
                                        <option value="Kotak">Kotak</option>
                                        <option value="PNB">PNB</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.salary_account_bank_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Account Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.account_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.account_number || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    IFSC Code
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.ifsc_code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ifsc_code: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.ifsc_code || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Mother Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.mother_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, mother_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.mother_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Marital Status
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.marital_status}
                                        onChange={(e) => setFormData(prev => ({ ...prev, marital_status: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.marital_status || 'N/A'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Address Details */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">Address Details</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Current Address
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.current_address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, current_address: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.current_address || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Current Address Type
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.current_address_type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, current_address_type: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Owned">Owned</option>
                                        <option value="Rented">Rented</option>
                                        <option value="Company Provided">Company Provided</option>
                                        <option value="With Parents">With Parents</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.current_address_type || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Current Address Proof
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.current_address_proof}
                                        onChange={(e) => setFormData(prev => ({ ...prev, current_address_proof: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Electricity Bill">Electricity Bill</option>
                                        <option value="Gas Bill">Gas Bill</option>
                                        <option value="Water Bill">Water Bill</option>
                                        <option value="Rent Agreement">Rent Agreement</option>
                                        <option value="Property Papers">Property Papers</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.current_address_proof || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Years in Current Address
                                </label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={formData.years_in_current_address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, years_in_current_address: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.years_in_current_address || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Years in Current City
                                </label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={formData.years_in_current_city}
                                        onChange={(e) => setFormData(prev => ({ ...prev, years_in_current_city: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.years_in_current_city || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Permanent Address
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.permanent_address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, permanent_address: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.permanent_address || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Permanent Address Landmark
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.permanent_address_landmark}
                                        onChange={(e) => setFormData(prev => ({ ...prev, permanent_address_landmark: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.permanent_address_landmark || 'N/A'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Employment Details */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">Employment Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Company Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.company_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.company_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Your Designation
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.designation}
                                        onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.designation || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Your Department
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.department || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Do in Current Company
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.do_in_current_company}
                                        onChange={(e) => setFormData(prev => ({ ...prev, do_in_current_company: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.do_in_current_company || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Working Work Experience
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.working_work_experience}
                                        onChange={(e) => setFormData(prev => ({ ...prev, working_work_experience: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.working_work_experience || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Total Work Experience
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.total_work_experience}
                                        onChange={(e) => setFormData(prev => ({ ...prev, total_work_experience: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.total_work_experience || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Personal Mail
                                </label>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        value={formData.personal_mail}
                                        onChange={(e) => setFormData(prev => ({ ...prev, personal_mail: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.personal_mail || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Office Mail
                                </label>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        value={formData.office_mail}
                                        onChange={(e) => setFormData(prev => ({ ...prev, office_mail: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.office_mail || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Office Address
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.office_address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, office_address: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.office_address || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Office Address Landmark
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.office_address_landmark}
                                        onChange={(e) => setFormData(prev => ({ ...prev, office_address_landmark: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.office_address_landmark || 'N/A'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* References */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">1st Reference</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.reference1_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference1_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.reference1_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Mobile Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={formData.reference1_mobile}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference1_mobile: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.reference1_mobile || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Relation
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.reference1_relation}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference1_relation: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Friend">Friend</option>
                                        <option value="Colleague">Colleague</option>
                                        <option value="Relative">Relative</option>
                                        <option value="Neighbor">Neighbor</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.reference1_relation || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Address
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.reference1_address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference1_address: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.reference1_address || 'N/A'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">2nd Reference</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.reference2_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference2_name: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.reference2_name || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Mobile Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={formData.reference2_mobile}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference2_mobile: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.reference2_mobile || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Relation
                                </label>
                                {isEditing ? (
                                    <select
                                        value={formData.reference2_relation}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference2_relation: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Friend">Friend</option>
                                        <option value="Colleague">Colleague</option>
                                        <option value="Relative">Relative</option>
                                        <option value="Neighbor">Neighbor</option>
                                    </select>
                                ) : (
                                    <div className="text-white py-2">{formData.reference2_relation || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Reference Address
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.reference2_address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reference2_address: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                        rows="2"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.reference2_address || 'N/A'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Login Credentials & Notes */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="text-white font-medium mb-4">Login Credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Login ID
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.login_id}
                                        onChange={(e) => setFormData(prev => ({ ...prev, login_id: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.login_id || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Password
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.password ? '••••••••' : 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Customer ID
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.customer_id}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.customer_id || 'N/A'}</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Application Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.application_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, application_number: e.target.value }))}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                    />
                                ) : (
                                    <div className="text-white py-2">{formData.application_number || 'N/A'}</div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Notes
                            </label>
                            {isEditing ? (
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none"
                                    rows="3"
                                />
                            ) : (
                                <div className="text-white py-2">{formData.notes || 'N/A'}</div>
                            )}
                        </div>
                    </div>

                    {/* Save Button (visible at bottom when editing) */}
                    {isEditing && (
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <div className="flex justify-center">
                                <button
                                    onClick={handleSaveLoginForm}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg text-white flex items-center font-medium"
                                >
                                    <Save className="w-5 h-5 mr-2" />
                                    {isLoading ? 'SAVING...' : 'SAVE'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Share Links Management */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <Share2 className="w-5 h-5 mr-2" />
                        Share Links
                    </h3>
                    <button
                        onClick={() => setShowShareModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Generate Link
                    </button>
                </div>

                {shareLinks.length > 0 ? (
                    <div className="space-y-3">
                        {shareLinks.map((link, index) => (
                            <div key={index} className="bg-gray-700 p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="text-white font-medium">Share Link #{index + 1}</div>
                                        <div className="text-gray-400 text-sm">
                                            Expires: {new Date(link.expires_at).toLocaleString()}
                                        </div>
                                        <div className="text-gray-400 text-sm">
                                            Max Access: {link.max_access_count} | Current Access: {link.access_count || 0}
                                        </div>
                                        {link.notes && (
                                            <div className="text-gray-400 text-sm">Notes: {link.notes}</div>
                                        )}
                                        <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300 break-all">
                                            {window.location.origin}/public/lead-form/{link.share_token}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-4">
                                        <button
                                            onClick={() => copyToClipboard(`${window.location.origin}/public/lead-form/${link.share_token}`)}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => window.open(`/public/lead-form/${link.share_token}`, '_blank')}
                                            className="text-green-400 hover:text-green-300"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        <Share2 className="w-12 h-12 mx-auto mb-4" />
                        <p>No share links generated yet</p>
                    </div>
                )}
            </div>

            {/* Share Link Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-lg w-96">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Generate Share Link</h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Expires At
                                </label>
                                <input
                                    type="datetime-local"
                                    value={shareData.expires_at}
                                    onChange={(e) => setShareData(prev => ({ ...prev, expires_at: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Max Access Count
                                </label>
                                <input
                                    type="number"
                                    value={shareData.max_access_count}
                                    onChange={(e) => setShareData(prev => ({ ...prev, max_access_count: parseInt(e.target.value) }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={shareData.notes}
                                    onChange={(e) => setShareData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white resize-none"
                                    rows="3"
                                    placeholder="Optional notes for this share link"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateShareLink}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
                            >
                                {isLoading ? 'Generating...' : 'Generate Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RemarksTab({ remarks, setRemarks, leadId, userId, formatDate }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [noteContent, setNoteContent] = useState('');
    const [noteType, setNoteType] = useState('general');
    const [editingNote, setEditingNote] = useState(null);

    useEffect(() => {
        loadRemarks();
    }, [leadId]);

    const loadRemarks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/remarks?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setRemarks(data || []);
            }
        } catch (error) {
            console.error('Error loading remarks:', error);
            setError('Failed to load remarks');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddRemark = async () => {
        if (!noteContent.trim()) return;

        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/remarks?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lead_id: leadId,
                    content: noteContent,
                    note_type: noteType,
                    created_by: userId
                }),
            });

            if (response.ok) {
                setSuccess('Remark added successfully');
                setNoteContent('');
                setNoteType('general');
                loadRemarks();
            } else {
                throw new Error('Failed to add remark');
            }
        } catch (error) {
            setError('Failed to add remark');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditRemark = async (noteId, content, type) => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/remarks/${noteId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: content,
                    note_type: type
                }),
            });

            if (response.ok) {
                setSuccess('Remark updated successfully');
                setEditingNote(null);
                loadRemarks();
            } else {
                throw new Error('Failed to update remark');
            }
        } catch (error) {
            setError('Failed to update remark');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRemark = async (noteId) => {
        if (!confirm('Are you sure you want to delete this remark?')) return;

        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/remarks/${noteId}?user_id=${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setSuccess('Remark deleted successfully');
                loadRemarks();
            } else {
                throw new Error('Failed to delete remark');
            }
        } catch (error) {
            setError('Failed to delete remark');
        } finally {
            setIsLoading(false);
        }
    };

    const noteTypeOptions = [
        { value: 'general', label: 'General', color: 'bg-gray-600' },
        { value: 'call', label: 'Call', color: 'bg-blue-600' },
        { value: 'meeting', label: 'Meeting', color: 'bg-green-600' },
        { value: 'followup', label: 'Follow-up', color: 'bg-yellow-600' },
        { value: 'important', label: 'Important', color: 'bg-red-600' }
    ];

    return (
        <div className="space-y-6">
            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Add New Remark */}
            {leadData.can_add_notes && (
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <MessageSquare className="w-5 h-5 mr-2" />
                        Add New Remark
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                            <select
                                value={noteType}
                                onChange={(e) => setNoteType(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                            >
                                {noteTypeOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Content</label>
                            <textarea
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white resize-none"
                                rows="4"
                                placeholder="Enter your remark here..."
                            />
                        </div>

                        <button
                            onClick={handleAddRemark}
                            disabled={isLoading || !noteContent.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white flex items-center"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Remark
                        </button>
                    </div>
                </div>
            )}

            {/* Remarks List */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">Remarks History</h3>

                {isLoading ? (
                    <div className="text-center text-gray-400 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                        <p className="mt-2">Loading remarks...</p>
                    </div>
                ) : remarks.length > 0 ? (
                    <div className="space-y-4">
                        {remarks.map((remark, index) => {
                            const noteTypeData = noteTypeOptions.find(opt => opt.value === remark.note_type) || noteTypeOptions[0];
                            const isEditing = editingNote === remark._id;

                            return (
                                <div key={remark._id || index} className="bg-gray-700 p-4 rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center mb-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${noteTypeData.color}`}>
                                                    {noteTypeData.label}
                                                </span>
                                                <span className="ml-3 text-sm text-gray-400">
                                                    {remark.creator_name || 'Unknown User'}
                                                </span>
                                                <span className="ml-3 text-sm text-gray-400">
                                                    {formatDate(remark.created_at)}
                                                </span>
                                            </div>

                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <select
                                                        defaultValue={remark.note_type}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm"
                                                        ref={(el) => el && (el.noteType = remark.note_type)}
                                                    >
                                                        {noteTypeOptions.map(option => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                    <textarea
                                                        defaultValue={remark.content}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm resize-none"
                                                        rows="3"
                                                        ref={(el) => el && (el.content = remark.content)}
                                                    />
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                const typeSelect = document.querySelector(`select[ref='${remark._id}-type']`) || { value: remark.note_type };
                                                                const contentTextarea = document.querySelector(`textarea[ref='${remark._id}-content']`) || { value: remark.content };
                                                                handleEditRemark(remark._id, contentTextarea.value, typeSelect.value);
                                                            }}
                                                            className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white text-sm"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingNote(null)}
                                                            className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-white text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-white">{remark.content}</p>
                                            )}
                                        </div>

                                        {!isEditing && (remark.can_edit || remark.can_delete) && (
                                            <div className="flex items-center space-x-2 ml-4">
                                                {remark.can_edit && (
                                                    <button
                                                        onClick={() => setEditingNote(remark._id)}
                                                        className="text-blue-400 hover:text-blue-300"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {remark.can_delete && (
                                                    <button
                                                        onClick={() => handleDeleteRemark(remark._id)}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                        <p>No remarks yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function AttachmentsTab({ attachments, setAttachments, leadId, userId, formatDate }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [documentType, setDocumentType] = useState('');
    const [documentCategory, setDocumentCategory] = useState('');
    const [documentDescription, setDocumentDescription] = useState('');

    useEffect(() => {
        loadAttachments();
    }, [leadId]);

    const loadAttachments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/attachments?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setAttachments(data || []);
            }
        } catch (error) {
            console.error('Error loading attachments:', error);
            setError('Failed to load attachments');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async () => {
        if (uploadFiles.length === 0) {
            setError('Please select files to upload');
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();

            for (let i = 0; i < uploadFiles.length; i++) {
                formData.append('files', uploadFiles[i]);
            }

            formData.append('document_type', documentType || 'general');
            formData.append('category', documentCategory || 'general');

            if (documentDescription) {
                formData.append('description', documentDescription);
            }

            const response = await fetch(`http://localhost:8048/leads/${leadId}/attachments?user_id=${userId}`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                setSuccess('Files uploaded successfully');
                setUploadFiles([]);
                setDocumentType('');
                setDocumentCategory('');
                setDocumentDescription('');
                loadAttachments();
            } else {
                throw new Error('Failed to upload files');
            }
        } catch (error) {
            setError('Failed to upload files');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAttachment = async (docId) => {
        if (!confirm('Are you sure you want to delete this attachment?')) return;

        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/attachments/${docId}?user_id=${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setSuccess('Attachment deleted successfully');
                loadAttachments();
            } else {
                throw new Error('Failed to delete attachment');
            }
        } catch (error) {
            setError('Failed to delete attachment');
        } finally {
            setIsLoading(false);
        }
    };

    const getFileIcon = (fileType) => {
        switch (fileType) {
            case 'image':
                return '🖼️';
            case 'pdf':
                return '📄';
            case 'document':
                return '📝';
            case 'spreadsheet':
                return '📊';
            default:
                return '📎';
        }
    };

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'verified':
                return 'bg-green-600';
            case 'pending':
                return 'bg-yellow-600';
            case 'rejected':
                return 'bg-red-600';
            default:
                return 'bg-gray-600';
        }
    };

    const documentTypes = [
        'Identity Proof', 'Address Proof', 'Income Proof', 'Bank Statement',
        'Salary Slip', 'Form 16', 'ITR', 'PAN Card', 'Aadhar Card', 'Other'
    ];

    const documentCategories = [
        'Required', 'Optional', 'Additional', 'Supporting'
    ];

    return (
        <div className="space-y-6">
            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* File Upload */}
            {leadData.can_upload_attachments && (
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Upload className="w-5 h-5 mr-2" />
                        Upload Attachments
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Document Type</label>
                                <select
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="">Select Type</option>
                                    {documentTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                                <select
                                    value={documentCategory}
                                    onChange={(e) => setDocumentCategory(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="">Select Category</option>
                                    {documentCategories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={documentDescription}
                                    onChange={(e) => setDocumentDescription(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Files</label>
                            <input
                                type="file"
                                multiple
                                onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                            />
                        </div>

                        {uploadFiles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-300 mb-2">Selected Files:</h4>
                                <div className="space-y-1">
                                    {Array.from(uploadFiles).map((file, index) => (
                                        <div key={index} className="text-sm text-gray-400">
                                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleFileUpload}
                            disabled={isLoading || uploadFiles.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white flex items-center"
                        >
                            <Upload className="w-4 h-4 mr-1" />
                            {isLoading ? 'Uploading...' : 'Upload Files'}
                        </button>
                    </div>
                </div>
            )}

            {/* Attachments List */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">Attachments</h3>

                {isLoading ? (
                    <div className="text-center text-gray-400 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                        <p className="mt-2">Loading attachments...</p>
                    </div>
                ) : attachments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {attachments.map((attachment, index) => (
                            <div key={attachment._id || index} className="bg-gray-700 p-4 rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-2">{getFileIcon(attachment.file_type)}</span>
                                        <div className="flex-1">
                                            <div className="text-white font-medium text-sm truncate">
                                                {attachment.filename}
                                            </div>
                                            <div className="text-gray-400 text-xs">
                                                {attachment.uploader_name || 'Unknown'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => window.open(attachment.file_path, '_blank')}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        {attachment.can_delete && (
                                            <button
                                                onClick={() => handleDeleteAttachment(attachment._id)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                        {attachment.document_type}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">
                                        {attachment.category}
                                    </span>
                                    <span className={`px-2 py-1 text-white text-xs rounded ${getStatusBadgeColor(attachment.status)}`}>
                                        {attachment.status || 'pending'}
                                    </span>
                                </div>

                                {attachment.description && (
                                    <p className="text-gray-400 text-xs mb-2">{attachment.description}</p>
                                )}

                                <div className="text-gray-400 text-xs">
                                    {formatDate(attachment.created_at)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        <Paperclip className="w-12 h-12 mx-auto mb-4" />
                        <p>No attachments yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function TasksTab({ tasks, setTasks, leadId, userId, formatDate }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        assigned_to: userId
    });

    useEffect(() => {
        loadTasks();
    }, [leadId]);

    const loadTasks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/tasks?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setTasks(data.tasks || []);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            setError('Failed to load tasks');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTask = async () => {
        if (!newTask.title.trim()) {
            setError('Task title is required');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8048/leads/${leadId}/tasks?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...newTask,
                    lead_id: leadId,
                    created_by: userId
                }),
            });

            if (response.ok) {
                setSuccess('Task added successfully');
                setNewTask({
                    title: '',
                    description: '',
                    priority: 'medium',
                    due_date: '',
                    assigned_to: userId
                });
                loadTasks();
            } else {
                throw new Error('Failed to add task');
            }
        } catch (error) {
            setError('Failed to add task');
        } finally {
            setIsLoading(false);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high':
                return 'bg-red-600';
            case 'medium':
                return 'bg-yellow-600';
            case 'low':
                return 'bg-green-600';
            default:
                return 'bg-gray-600';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-600';
            case 'in_progress':
                return 'bg-blue-600';
            case 'pending':
                return 'bg-yellow-600';
            default:
                return 'bg-gray-600';
        }
    };

    return (
        <div className="space-y-6">
            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Add New Task */}
            {leadData.can_add_tasks && (
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Plus className="w-5 h-5 mr-2" />
                        Add New Task
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    placeholder="Enter task title"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                                <select
                                    value={newTask.priority}
                                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                                <input
                                    type="datetime-local"
                                    value={newTask.due_date}
                                    onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                            <textarea
                                value={newTask.description}
                                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white resize-none"
                                rows="3"
                                placeholder="Enter task description"
                            />
                        </div>

                        <button
                            onClick={handleAddTask}
                            disabled={isLoading || !newTask.title.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white flex items-center"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Task
                        </button>
                    </div>
                </div>
            )}

            {/* Tasks List */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">Tasks</h3>

                {isLoading ? (
                    <div className="text-center text-gray-400 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                        <p className="mt-2">Loading tasks...</p>
                    </div>
                ) : tasks.length > 0 ? (
                    <div className="space-y-4">
                        {tasks.map((task, index) => (
                            <div key={task._id || index} className="bg-gray-700 p-4 rounded-lg">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center mb-2">
                                            <h4 className="text-white font-medium">{task.title}</h4>
                                            <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium text-white ${getPriorityColor(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(task.status)}`}>
                                                {task.status || 'pending'}
                                            </span>
                                        </div>

                                        {task.description && (
                                            <p className="text-gray-300 mb-2">{task.description}</p>
                                        )}

                                        <div className="flex items-center text-sm text-gray-400 space-x-4">
                                            {task.due_date && (
                                                <span>Due: {formatDate(task.due_date)}</span>
                                            )}
                                            <span>Created: {formatDate(task.created_at)}</span>
                                            {task.assigned_to_name && (
                                                <span>Assigned to: {task.assigned_to_name}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2 ml-4">
                                        <button className="text-blue-400 hover:text-blue-300">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button className="text-red-400 hover:text-red-300">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        <CheckSquare className="w-12 h-12 mx-auto mb-4" />
                        <p>No tasks yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ActivitiesTab({ activities, formatDate }) {
    const [isLoading, setIsLoading] = useState(false);

    const getActivityIcon = (activityType) => {
        switch (activityType) {
            case 'create':
                return <Plus className="w-4 h-4 text-green-400" />;
            case 'update':
                return <Edit3 className="w-4 h-4 text-blue-400" />;
            case 'status_change':
            case 'sub_status_change':
                return <Activity className="w-4 h-4 text-purple-400" />;
            case 'assignment':
            case 'department_transfer':
                return <UserCheck className="w-4 h-4 text-yellow-400" />;
            case 'document':
                return <Paperclip className="w-4 h-4 text-cyan-400" />;
            case 'note':
            case 'note_update':
                return <MessageSquare className="w-4 h-4 text-indigo-400" />;
            case 'delete':
                return <Trash2 className="w-4 h-4 text-red-400" />;
            case 'obligations_updated':
                return <CreditCard className="w-4 h-4 text-orange-400" />;
            default:
                return <Activity className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Activity Timeline
                </h3>

                {isLoading ? (
                    <div className="text-center text-gray-400 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                        <p className="mt-2">Loading activities...</p>
                    </div>
                ) : activities.length > 0 ? (
                    <div className="space-y-4">
                        {activities.map((activity, index) => (
                            <div key={activity._id || index} className="flex items-start space-x-4 p-4 bg-gray-700 rounded-lg">
                                <div className="flex-shrink-0 mt-1">
                                    {getActivityIcon(activity.activity_type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-white font-medium">{activity.description}</p>
                                        <span className="text-sm text-gray-400">
                                            {formatDate(activity.created_at || activity.timestamp)}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">
                                        By: {activity.user_name || 'System'}
                                    </div>
                                    {activity.details && (
                                        <div className="mt-2 p-2 bg-gray-600 rounded text-sm text-gray-300">
                                            {typeof activity.details === 'string'
                                                ? activity.details
                                                : JSON.stringify(activity.details, null, 2)
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        <Activity className="w-12 h-12 mx-auto mb-4" />
                        <p>No activities yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
