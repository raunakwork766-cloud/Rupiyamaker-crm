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
import LoginFormSection from './lead-details/LoginFormSection';
import AssignmentInfoSection from './lead-details/AssignmentInfoSection';
import RemarksSection from './lead-details/RemarksSection';
import AttachmentsSection from './lead-details/AttachmentsSection';
import TasksSection from './lead-details/TasksSection';
import ActivitiesSection from './lead-details/ActivitiesSection';
import OperationsSection from './lead-details/OperationsSection';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

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

            const response = await fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`, {
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
                // Properly merge the updated data with existing leadData
                setLeadData(prev => ({
                    ...prev,
                    ...updatedData
                }));
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
        { id: 'login_form', label: 'Login Form', icon: FileText },
        { id: 'remarks', label: 'Remarks', icon: MessageSquare },
        { id: 'attachments', label: 'Attachments', icon: Paperclip },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'activities', label: 'Activities', icon: Activity }
    ];

    // No need for useEffect to load tab data since modular components handle their own data loading

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
            const response = await fetch(`${API_BASE_URL}/leads/${lead._id}/share-link?user_id=${userId}`, {
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
        <div className="min-h-screen bg-white text-white p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg p-6 mb-6 border border-gray-800">
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
                                (tab.id === 'login_form' && userDepartment === 'login') || // Login form only for login dept
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

                                {/* Operations Section - Only for Login Department */}
                                {userDepartment === 'login' && (
                                    <OperationsSection
                                        leadData={leadData}
                                        onUpdate={updateLead}
                                    />
                                )}
                            </div>
                        )}

                        {activeTab === 'obligations' && (
                            <ObligationsSection
                                leadData={leadData}
                                onUpdate={updateLead}
                            />
                        )}

                        {activeTab === 'login_form' && (
                            <LoginFormSection
                                leadData={leadData}
                                onUpdate={updateLead}
                                onGenerateShareableLink={generateShareableLink}
                                shareableLink={shareableLink}
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
