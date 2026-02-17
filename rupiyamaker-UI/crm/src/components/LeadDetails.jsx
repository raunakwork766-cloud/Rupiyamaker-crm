import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, User, Building, CreditCard, FileText, MessageSquare,
    Paperclip, CheckSquare, Activity, UserCheck, Share2, Lock,
    Calendar, Phone, Mail, MapPin, DollarSign, Star, Upload,
    Plus, Edit3, Trash2, Save, X, Eye, Download, Copy, ChevronDown, ChevronUp
} from 'lucide-react';
import { API_BASE_URL, buildApiUrl, buildMediaUrl } from '../config/api';

// Import new section components
import AboutSection from './lead-details/AboutSection';
import HowToProcessSection from './lead-details/HowToProcessSection';
import StatusSection from './lead-details/StatusSection';
import ObligationsSection from './lead-details/ObligationsSection';
import LoginFormSection from './lead-details/LoginFormSection';
import AssignmentInfoSection from './lead-details/AssignmentInfoSection';
import AttachmentsSection from './lead-details/AttachmentsSection';
import TasksSection from './lead-details/TasksSection';
import ImportantQuestionsSection from './lead-details/ImportantQuestionsSection';
import OperationsSection from './lead-details/OperationsSection';

// Import new modular section components
import Remarks from './sections/Remarks';
import Activities from './sections/Activities';
import RequestReassignmentButton from './sections/RequestReassignmentButton';

export default function LeadDetails({ lead, user, onBack, onLeadUpdate }) {
    const [activeTab, setActiveTab] = useState('details');
    const [leadData, setLeadData] = useState(lead);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [showCoApplicant, setShowCoApplicant] = useState(false);
    const [shareableLink, setShareableLink] = useState('');

    // Fetch assignable users for reassignment
    const fetchAssignableUsers = async () => {
        try {
            const userId = localStorage.getItem('userId') || '';
            const response = await fetch(buildApiUrl(`users/assignable?user_id=${userId}`));
            
            if (response.ok) {
                const data = await response.json();
                setAssignableUsers(data);
            }
        } catch (error) {
            console.error('Error fetching assignable users:', error);
        }
    };
    
    useEffect(() => {
        fetchAssignableUsers();
    }, []);

    // Enhanced function to update a lead with better error handling and data synchronization
    const updateLead = async (updatedData) => {
        console.log('🔄 updateLead called with data:', updatedData);
        console.log('🔄 updateLead RAW updatedData stringify:', JSON.stringify(updatedData));
        console.log('🔄 🚨 CRITICAL DEBUG: updatedData keys:', Object.keys(updatedData));
        console.log('🔄 🚨 CRITICAL DEBUG: Has dynamic_fields?', 'dynamic_fields' in updatedData);
        console.log('🔄 🚨 CRITICAL DEBUG: Has city?', 'city' in updatedData);
        console.log('🔄 🚨 CRITICAL DEBUG: Has postal_code?', 'postal_code' in updatedData);
        if ('dynamic_fields' in updatedData) {
            console.log('🔄 🚨 CRITICAL DEBUG: dynamic_fields keys:', Object.keys(updatedData.dynamic_fields));
            console.log('🔄 🚨 CRITICAL DEBUG: Has obligation_data?', 'obligation_data' in updatedData.dynamic_fields);
            console.log('🔄 🚨 CRITICAL DEBUG: Has address?', 'address' in updatedData.dynamic_fields);
            if ('address' in updatedData.dynamic_fields) {
                console.log('🔄 🚨 CRITICAL DEBUG: address keys:', Object.keys(updatedData.dynamic_fields.address));
            }
        }
        console.log('🔄 Current leadData state:', leadData);
        console.log('🔄 Lead ID:', leadData?._id);
        try {
            // Guard: if no fields to update, skip calling API to prevent empty PUTs (which caused 422/500 earlier)
            if (!updatedData || Object.keys(updatedData).length === 0) {
                console.log('⚠️ updateLead: empty updatedData received, skipping API call');
                return true;
            }
            
            // Additional guard: Check if only metadata fields are being sent (no actual data changes)
            const metadataFields = ['updated_by', 'updated_at', 'created_at', 'created_by'];
            const dataFields = Object.keys(updatedData).filter(key => !metadataFields.includes(key));
            if (dataFields.length === 0) {
                console.log('⚠️ updateLead: only metadata fields in update, skipping API call');
                return true;
            }
            
            setIsLoading(true);
            const userId = localStorage.getItem('userId') || '';
            const token = localStorage.getItem('token') || '';
            console.log('🔄 Using userId:', userId, 'token length:', token?.length);

            // 🎯 CRITICAL FIX: Only send the fields being updated, not the entire lead
            // The backend will handle merging with existing data properly
            // This prevents data loss when multiple tabs/sections update simultaneously
            const payload = { ...updatedData };
            
            console.log('📦 Payload to send (only updated fields):', payload);
            console.log('📦 🚨 Payload stringified:', JSON.stringify(payload));

            // Validate and fix data types before sending to API
            const sanitizedPayload = { ...payload };
            
            // Ensure company_type and company_category are strings in dynamic_fields.personal_details
            if (sanitizedPayload.dynamic_fields?.personal_details) {
                if (sanitizedPayload.dynamic_fields.personal_details.company_type !== undefined && 
                    sanitizedPayload.dynamic_fields.personal_details.company_type !== null &&
                    typeof sanitizedPayload.dynamic_fields.personal_details.company_type !== 'string') {
                    console.warn('Converting company_type to string:', sanitizedPayload.dynamic_fields.personal_details.company_type);
                    sanitizedPayload.dynamic_fields.personal_details.company_type = String(sanitizedPayload.dynamic_fields.personal_details.company_type);
                }
                
                if (sanitizedPayload.dynamic_fields.personal_details.company_category !== undefined && 
                    sanitizedPayload.dynamic_fields.personal_details.company_category !== null &&
                    typeof sanitizedPayload.dynamic_fields.personal_details.company_category !== 'string') {
                    console.warn('Converting company_category to string:', sanitizedPayload.dynamic_fields.personal_details.company_category);
                    sanitizedPayload.dynamic_fields.personal_details.company_category = String(sanitizedPayload.dynamic_fields.personal_details.company_category);
                }
            }

            // Ensure address fields are strings if they exist
            if (sanitizedPayload.dynamic_fields?.address) {
                Object.keys(sanitizedPayload.dynamic_fields.address).forEach(key => {
                    const value = sanitizedPayload.dynamic_fields.address[key];
                    if (value !== null && value !== undefined && typeof value !== 'string') {
                        console.warn(`Converting address.${key} to string:`, value);
                        sanitizedPayload.dynamic_fields.address[key] = String(value);
                    }
                });
            }

            // Ensure basic fields are proper types
            ['first_name', 'last_name', 'phone', 'email', 'data_code', 'loan_type', 'loan_type_name', 'city', 'postal_code', 'alternative_phone'].forEach(field => {
                if (sanitizedPayload[field] !== undefined && sanitizedPayload[field] !== null && typeof sanitizedPayload[field] !== 'string') {
                    console.warn(`Converting ${field} to string:`, sanitizedPayload[field]);
                    sanitizedPayload[field] = String(sanitizedPayload[field]);
                }
            });

            // Defensive merge: if child component sent partial dynamic_fields, merge with current leadData.dynamic_fields
            // This prevents accidental loss of keys (like obligation_data) when components send only a subset
            if (sanitizedPayload.dynamic_fields && leadData?.dynamic_fields) {
                console.log('🔐 updateLead: merging dynamic_fields from payload with current leadData.dynamic_fields to avoid overwrites');
                try {
                    sanitizedPayload.dynamic_fields = {
                        ...leadData.dynamic_fields,
                        ...sanitizedPayload.dynamic_fields
                    };
                } catch (e) {
                    console.warn('⚠️ Failed to merge dynamic_fields defensively:', e);
                }
                console.log('🔐 Merged dynamic_fields keys:', Object.keys(sanitizedPayload.dynamic_fields));
            }

            // Add metadata
            sanitizedPayload.updated_by = userId;
            sanitizedPayload.updated_at = new Date().toISOString();

            console.log('📡 Making API call to update lead:', {
                leadId: leadData._id,
                userId,
                originalData: updatedData,
                fullPayload: sanitizedPayload,
                apiUrl: `${API_BASE_URL}/leads/${leadData._id}?user_id=${userId}`
            });

            const response = await fetch(`${API_BASE_URL}/leads/${leadData._id}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(sanitizedPayload)
            });

            console.log('📡 API Response Status:', response.status);
            
            if (!response.ok) {
                // Log detailed error information for debugging
                const errorText = await response.text();
                console.error('❌ API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    payload: sanitizedPayload
                });
                
                // Try to parse as JSON for better error display
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('❌ Parsed error:', errorJson);
                    setError(`Failed to update lead: ${errorJson.detail || errorText}`);
                } catch (e) {
                    setError(`Failed to update lead: ${response.status} ${errorText}`);
                }
                
                setIsLoading(false);
                setTimeout(() => setError(''), 5000);
                return false;
            }
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('✅ API Response Data:', responseData);
                
                // Fetch fresh data from backend to ensure we have the latest
                console.log('🔄 Fetching fresh data from backend...');
                const freshDataResponse = await fetch(`${API_BASE_URL}/leads/${leadData._id}?user_id=${userId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    }
                });

                if (freshDataResponse.ok) {
                    const freshLeadData = await freshDataResponse.json();
                    console.log('✅ Fresh lead data fetched successfully:', freshLeadData);
                    console.log('🔍 PARENT: XYZ value in fresh data:', freshLeadData.xyz);
                    
                    // Update the leadData state with fresh data from backend
                    setLeadData(freshLeadData);
                    console.log('🔍 PARENT: setLeadData called with xyz =', freshLeadData.xyz);
                    
                    // Notify parent component about the updated lead
                    if (onLeadUpdate) {
                        onLeadUpdate(freshLeadData);
                    }
                    
                    setSuccess('Lead updated successfully and data refreshed');
                    setTimeout(() => setSuccess(''), 2000);
                    return true;
                } else {
                    console.warn('⚠️ Could not fetch fresh data, using optimistic update');
                    // Use optimistic update with the sanitized payload
                    setLeadData(sanitizedPayload);
                    
                    // Notify parent component about the updated lead (optimistic)
                    if (onLeadUpdate) {
                        onLeadUpdate(sanitizedPayload);
                    }
                    
                    setSuccess('Lead updated successfully (optimistic update)');
                    setTimeout(() => setSuccess(''), 2000);
                    return true;
                }
            } else {
                const errorText = await response.text();
                console.error('❌ API response error:', response.status, errorText);
                console.error('❌ Full request payload that caused error:', JSON.stringify(sanitizedPayload, null, 2));
                
                // Try to parse error response
                let errorMessage = errorText;
                let detailedError = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || errorText;
                    detailedError = errorJson.detail || errorJson.message || errorJson.error || errorText;
                    console.error('❌ Detailed error from API:', detailedError);
                } catch (e) {
                    // errorText is not JSON, use as is
                }
                
                throw new Error(`Failed to update lead: ${response.status} - ${errorMessage}`);
            }
        } catch (error) {
            console.error('❌ Error updating lead:', error);
            console.error('❌ Error details:', {
                message: error.message,
                stack: error.stack,
                leadId: leadData._id,
                userId: userId,
                hasToken: !!token,
                tokenLength: token?.length,
                updateData: updatedData
            });
            setError('Failed to update lead: ' + error.message);
            setTimeout(() => setError(''), 5000);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const userId = localStorage.getItem('userId') || '';
    const userDepartment = user?.department || localStorage.getItem('userDepartment') || 'sales';

    // Check if co_applicant_form exists and show it automatically
    useEffect(() => {
        // Check if the co-applicant form data exists and is non-null
        const hasCoApplicantForm = leadData.dynamic_fields?.co_applicant_form && 
            typeof leadData.dynamic_fields.co_applicant_form === 'object';
            
        if (hasCoApplicantForm && !showCoApplicant) {
            console.log("Auto-showing co-applicant form because data exists");
            setShowCoApplicant(true);
        }
    }, [leadData, showCoApplicant]);

    // Fetch fresh lead data when component mounts
    useEffect(() => {
        const fetchCurrentLeadData = async () => {
            try {
                setIsLoading(true);
                const userId = localStorage.getItem('userId') || '';
                
                // Fetch fresh lead data
                const response = await fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const freshLeadData = await response.json();
                    setLeadData(freshLeadData);
                }
            } catch (error) {
                console.error('Error fetching fresh lead data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCurrentLeadData();
    }, [lead._id]);

    const tabs = [
        { id: 'details', label: 'Lead Details', icon: User },
        { id: 'obligations', label: 'Obligations', icon: CreditCard },
        { id: 'remarks', label: 'Remark', icon: MessageSquare },
        { id: 'attachments', label: 'Attachments', icon: Paperclip },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'activities', label: 'Activities', icon: Activity }
    ];

    const updateLeadStatus = async (status, subStatus) => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`, {
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
            const shareData = {
                lead_id: lead._id,
                expires_in_days: 7,
                purpose: "public_form",
                base_url: "https://raunakcrm.bhoomitechzone.us:4521",
                allow_update: true,
                one_time_use: false
            };
            
            const response = await fetch(`${API_BASE_URL}/share-links/create?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shareData)
            });

            if (response.ok) {
                const data = await response.json();
                setShareableLink(data.url);
                setSuccess('Shareable link generated successfully');
            }
        } catch (error) {
            setError('Failed to generate shareable link');
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
                <div className=" rounded-lg p-6 mb-6">
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
                        <RequestReassignmentButton 
                            leadId={leadData._id}
                            buttonClassName="bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center mr-2"
                            assignableUsers={assignableUsers}
                            onRequestSubmitted={() => {
                                setSuccess('Lead reassignment requested successfully');
                                setTimeout(() => setSuccess(''), 3000);
                            }}
                        />
                        <button
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                            onClick={async () => {
                                // Toggle the co-applicant form visibility
                                const newShowCoApplicant = !showCoApplicant;
                                
                                // First update the state to show/hide the form immediately
                                setShowCoApplicant(newShowCoApplicant);
                                
                                if (newShowCoApplicant) {
                                    console.log("Showing co-applicant form");
                                    
                                    // If showing co-applicant form and no co-applicant form exists yet, create one
                                    if (!leadData.dynamic_fields?.co_applicant_form) {
                                        console.log("Creating new co-applicant form");
                                        
                                        // Create empty co-applicant form with basic structure
                                        const currentDynamicFields = leadData.dynamic_fields || {};
                                        const updatedFields = {
                                            dynamic_fields: {
                                                ...currentDynamicFields,
                                                co_applicant_form: {}
                                            }
                                        };
                                        
                                        // Update the lead data with the new co-applicant form
                                        await updateLead(updatedFields);
                                    }
                                } else {
                                    console.log("Hiding co-applicant form");
                                }
                            }}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {showCoApplicant ? 'Hide Co-Applicant Form' : 'Show Co-Applicant Form'}
                        </button>
                        {leadData?.form_share === false ? (
                            <div className="flex items-center bg-gray-500 px-4 py-2 rounded-lg font-medium text-white">
                                <Share2 className="w-4 h-4 mr-2" />
                                Form Submitted
                            </div>
                        ) : (
                            <button
                                onClick={generateShareableLink}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Share
                            </button>
                        )}
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
                <div className="bg-black rounded-lg  overflow-hidden mb-6">
                    <div className="flex overflow-x-auto ml-2 gap-3">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;

                            // Check if user can view this tab
                            const canViewTab = leadData.can_view_all_tabs ||
                                tab.id === 'details' || // Details tab always visible
                                (tab.id === 'remarks' && (leadData.can_add_notes || leadData.can_edit)) ||
                                (tab.id === 'attachments' && (leadData.can_upload_attachments || leadData.can_edit)) ||
                                (tab.id === 'tasks' && (leadData.can_add_tasks || leadData.can_edit)) ||
                                (tab.id === 'activities' && (leadData.can_view_all_tabs || leadData.can_edit || leadData.can_view)) ||
                                (tab.id === 'obligations' && leadData.can_view_all_tabs);

                            if (!canViewTab) return null;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center px-6 py-4 font-bold text-md h-[30px] border-b-2 rounded-4xl transition-colors whitespace-nowrap ${activeTab === tab.id
                                        ? ' text-white bg-[#03b0f5]'
                                        : ' text-[#000] bg-white hover:text-[#03b0f5] hover:bg-gray-300'
                                        }`}
                                >
                                    <Icon className="w-5 h-5 mr-2" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6 bg-black">
                        {activeTab === 'details' && (
                            <div className="space-y-6">
                                {/* About Section */}
                                <AboutSection
                                    key={`about-${leadData._id}`}
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                    currentUserRole={user}
                                />

                                {/* How To Process Section */}
                                <HowToProcessSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                />

                                {/* Login Form Section */}
                                <LoginFormSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                    onGenerateShareableLink={generateShareableLink}
                                    shareableLink={shareableLink}
                                />
                                    
                                {/* Co-Applicant Form */}
                                {showCoApplicant && (
                                    <div className="mt-8 pt-6 border-t-2 border-cyan-400">
                                        {console.log("Rendering co-applicant form", {
                                            coApplicantData: leadData.dynamic_fields?.co_applicant_form 
                                        })}
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold text-[#03B0F5]">Co-Applicant</h3>
                                            <button
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold"
                                                onClick={() => {
                                                    updateLead({ dynamic_fields: { ...leadData.dynamic_fields, co_applicant_form: null } });
                                                    setShowCoApplicant(false);
                                                }}
                                            >
                                                Remove Co-Applicant
                                            </button>
                                        </div>
                                        <LoginFormSection
                                            leadData={leadData}
                                            onUpdate={updateLead}
                                            isCoApplicant={true}
                                            shareableLink={shareableLink}
                                            onGenerateShareableLink={generateShareableLink}
                                        />
                                    </div>
                                )}

                                {/* Important Questions Section */}
                                <ImportantQuestionsSection
                                    leadData={leadData}
                                    onUpdate={updateLead}
                                    currentUserRole={user}
                                />

                                {/* Operations Section - Show for login department or leads sent to login */}
                                {(userDepartment === 'login' || leadData.file_sent_to_login) && (
                                    <OperationsSection
                                        leadData={leadData}
                                        onUpdate={updateLead}
                                    />
                                )}

                                {/* Request Reassignment Button - Always visible */}
                                <div className="mt-6">
                                    <RequestReassignmentButton
                                        leadId={lead._id}
                                        assignableUsers={assignableUsers}
                                        onRequestSubmitted={() => {
                                            setSuccess('Lead reassignment requested successfully');
                                            setTimeout(() => setSuccess(''), 3000);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'obligations' && (
                            <ObligationsSection
                                leadData={{
                                    ...leadData,
                                    // Initialize obligations if they don't exist
                                    obligations: leadData.obligations || [],
                                    dynamic_fields: {
                                        ...leadData.dynamic_fields,
                                        obligations: leadData.dynamic_fields?.obligations || []
                                    }
                                }}
                                onUpdate={(updatedData) => {
                                    // Handle updating obligations - merge approach to support both formats
                                    const updatedObligations = updatedData.obligations || updatedData.dynamic_fields?.obligations || [];
                                    const currentDynamicFields = leadData.dynamic_fields || {};
                                    
                                    updateLead({
                                        obligations: updatedObligations,
                                        dynamic_fields: {
                                            ...currentDynamicFields,
                                            obligations: updatedObligations
                                        }
                                    });
                                }}
                            />
                        )}

                        {activeTab === 'remarks' && (
                            <Remarks
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
                            <Activities
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