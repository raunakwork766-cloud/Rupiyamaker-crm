import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

export default function AssignmentInfoSection({
    leadData,
    onUpdate,
    userDepartment,
    formatDate,
    user
}) {
    const [reportToUsers, setReportToUsers] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false); // Dropdown closed by default

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
            const response = await fetch(`${API_BASE_URL}/users/${userId}`);
            if (response.ok) {
                const userData = await response.json();
                setCurrentUserRole(userData.role_id);
            }
        } catch (error) {
            console.error('Error loading current user info:', error);
        }
    };

    const loadReportToUsers = async () => {
        try {
            if (!currentUserRole) return;

            const response = await fetch(`${API_BASE_URL}/users?role_id=${currentUserRole}&user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setReportToUsers(data || []);
            }
        } catch (error) {
            console.error('Error loading report-to users:', error);
        }
    };

    const assignReportTo = async (reportToUserId) => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/leads/${leadData._id}/assign-report?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    report_to: reportToUserId
                })
            });

            if (response.ok) {
                if (onUpdate) {
                    await onUpdate({ report_to: reportToUserId });
                }
            }
        } catch (error) {
            console.error('Failed to update report assignment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-white">
            <button
                className="w-full flex justify-between items-center px-4 py-3 text-left text-xl font-bold text-[#03b0f5] focus:outline-none"
                onClick={() => setOpen(prev => !prev)}
                type="button"
            >
                <span className="flex items-center">
                    <UserCheck className="w-6 h-6 mr-2" />
                    Assignment Information
                </span>
                {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {open && (
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-lg font-semibold text-black mb-1">Assigned To</label>
                            <div className="bg-white p-2 rounded border text-black">{leadData.assigned_to_name || 'Unassigned'}</div>
                        </div>
                        <div>
                            <label className="block text-lg font-semibold text-black mb-1">Created By</label>
                            <div className="bg-white p-2 rounded border text-black">{leadData.created_by_name || 'System'}</div>
                        </div>
                        <div>
                            <label className="block text-lg font-semibold text-black mb-1">Report To</label>
                            <select
                                className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-black focus:outline-none focus:border-blue-500"
                                defaultValue={leadData.report_to || ''}
                                onChange={(e) => assignReportTo(e.target.value)}
                                disabled={isLoading}
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
                            <label className="block text-lg font-semibold text-black mb-1">Team</label>
                            <div className="bg-white p-2 rounded border text-black">{leadData.team_name || 'N/A'}</div>
                        </div>
                        <div>
                            <label className="block text-lg font-semibold text-black mb-1">
                                {userDepartment === 'sales' ? 'Campaign' : 'Channel'}
                            </label>
                            <div className="bg-white p-2 rounded border text-black">{leadData.campaign_name || leadData.channel_name || 'N/A'}</div>
                        </div>
                        <div>
                            <label className="block text-lg font-semibold text-black mb-1">Created Date</label>
                            <div className="bg-white p-2 rounded border text-black flex items-center">
                                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                {leadData.created_at ? formatDate(leadData.created_at) : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}