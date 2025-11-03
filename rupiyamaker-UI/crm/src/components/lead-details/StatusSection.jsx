import React, { useState, useEffect } from 'react';
import { ArrowRight, Users, ChevronDown, ChevronUp } from 'lucide-react';

export default function StatusSection({ leadData, onUpdate, userDepartment }) {
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [availableSubStatuses, setAvailableSubStatuses] = useState([]);
    const [selectedStatus, setSelectedStatus] = useState(leadData.status || '');
    const [selectedSubStatus, setSelectedSubStatus] = useState(leadData.sub_status || '');
    const [statusSearchTerm, setStatusSearchTerm] = useState('');
    const [subStatusSearchTerm, setSubStatusSearchTerm] = useState('');
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [showSubStatusDropdown, setShowSubStatusDropdown] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [canTransferToLogin, setCanTransferToLogin] = useState(false);

    // Dropdown open/close state for the whole section
    const [open, setOpen] = useState(false);

    const userId = localStorage.getItem('userId') || '';

    useEffect(() => {
        loadAvailableStatuses();
    }, []);

    useEffect(() => {
        if (selectedStatus) {
            loadSubStatusesForStatus(selectedStatus);
        } else {
            setAvailableSubStatuses([]);
        }
    }, [selectedStatus]);

    useEffect(() => {
        // Check if can transfer to login department
        const status = selectedStatus || leadData.status;
        const subStatus = selectedSubStatus || leadData.sub_status;
        setCanTransferToLogin(
            userDepartment === 'sales' &&
            status === 'ACTIVE' &&
            subStatus === 'FILE COMPLETED'
        );
    }, [selectedStatus, selectedSubStatus, leadData.status, leadData.sub_status, userDepartment]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showStatusDropdown || showSubStatusDropdown) {
                if (!event.target.closest('.status-dropdown')) {
                    setShowStatusDropdown(false);
                    setShowSubStatusDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showStatusDropdown, showSubStatusDropdown]);

    const loadAvailableStatuses = async () => {
        try {
            const response = await fetch(
                `/api/leads/statuses/${userDepartment}?user_id=${userId}`
            );
            if (response.ok) {
                const data = await response.json();
                setAvailableStatuses(data || []);
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
        }
    };

    const loadSubStatusesForStatus = async (statusName) => {
        try {
            const response = await fetch(
                `/api/leads/sub-statuses/${statusName}?user_id=${userId}`
            );
            if (response.ok) {
                const data = await response.json();
                setAvailableSubStatuses(data || []);
            }
        } catch (error) {
            console.error('Error loading sub-statuses:', error);
        }
    };

    const handleStatusChange = async (newStatus) => {
        setSelectedStatus(newStatus);
        setSelectedSubStatus(''); // Reset sub-status when status changes
        setShowStatusDropdown(false);
        await updateStatus(newStatus, '');
    };

    const handleSubStatusChange = async (newSubStatus) => {
        setSelectedSubStatus(newSubStatus);
        setShowSubStatusDropdown(false);
        await updateStatus(selectedStatus, newSubStatus);
    };

    const updateStatus = async (status, subStatus) => {
        setIsUpdatingStatus(true);
        try {
            const updateData = {
                status: status,
                sub_status: subStatus
            };
            await onUpdate(updateData);
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleTransferToLogin = async () => {
        try {
            const response = await fetch(
                `/api/leads/${leadData._id}/transfer-to-login?user_id=${userId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                window.location.reload(); // Simple refresh for now
            } else {
                throw new Error('Failed to transfer lead to login department');
            }
        } catch (error) {
            console.error('Error transferring lead:', error);
        }
    };

    // Filter functions for searchable dropdowns
    const filteredStatuses = availableStatuses.filter(status =>
        status.name.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );

    const filteredSubStatuses = availableSubStatuses.filter(subStatus => {
        if (typeof subStatus === 'string') {
            return subStatus.toLowerCase().includes(subStatusSearchTerm.toLowerCase());
        }
        return subStatus.name?.toLowerCase().includes(subStatusSearchTerm.toLowerCase());
    });

    return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-white">
            <button
                className="w-full flex justify-between items-center px-4 py-3 text-left text-xl font-bold text-[#03b0f5] focus:outline-none"
                onClick={() => setOpen(prev => !prev)}
                type="button"
            >
                <span className="flex items-center">
                    <Users className="w-6 h-6 mr-2" />
                    Status
                </span>
                {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {open && (
                <div className="p-6">
                   
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Status Dropdown */}
                        <div className="relative">
                            <label className="block text-lg font-semibold text-black mb-1">Status</label>
                            <div className="status-dropdown">
                                <button
                                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                    disabled={isUpdatingStatus}
                                    className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-black text-left focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                    {selectedStatus || leadData.status || (userDepartment === 'sales' ? 'ACTIVE LEAD' : 'ACTIVE LOGIN')}
                                </button>

                                {showStatusDropdown && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                        <div className="p-2 border-b border-gray-600">
                                            <input
                                                type="text"
                                                placeholder="Search status..."
                                                value={statusSearchTerm}
                                                onChange={(e) => setStatusSearchTerm(e.target.value)}
                                                className="w-full bg-gray-100 border border-gray-500 rounded px-2 py-1 text-black text-sm focus:outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                        </div>
                                        {filteredStatuses.map((status) => (
                                            <button
                                                key={status._id}
                                                onClick={() => handleStatusChange(status.name)}
                                                className="w-full text-left px-3 py-2 text-black hover:bg-gray-200 transition-colors"
                                            >
                                                {status.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sub-Status Dropdown */}
                        <div className="relative">
                            <label className="block text-lg font-semibold text-black mb-1">Sub-Status</label>
                            <div className="status-dropdown">
                                <button
                                    onClick={() => setShowSubStatusDropdown(!showSubStatusDropdown)}
                                    disabled={isUpdatingStatus || !selectedStatus}
                                    className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-black text-left focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                    {selectedSubStatus || leadData.sub_status || 'Select Sub-Status'}
                                </button>

                                {showSubStatusDropdown && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                        <div className="p-2 border-b border-gray-600">
                                            <input
                                                type="text"
                                                placeholder="Search sub-status..."
                                                value={subStatusSearchTerm}
                                                onChange={(e) => setSubStatusSearchTerm(e.target.value)}
                                                className="w-full bg-gray-100 border border-gray-500 rounded px-2 py-1 text-black text-sm focus:outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                        </div>
                                        {filteredSubStatuses.map((subStatus, index) => {
                                            const subStatusName = typeof subStatus === 'string' ? subStatus : subStatus.name;
                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSubStatusChange(subStatusName)}
                                                    className="w-full text-left px-3 py-2 text-black hover:bg-gray-200 transition-colors"
                                                >
                                                    {subStatusName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Transfer to Login Department Button */}
                    {canTransferToLogin && (
                        <div className="mt-4 p-4 bg-blue-900 border border-blue-600 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-lg font-semibold text-blue-200">Ready for Login Department</h4>
                                    <p className="text-xs text-blue-300 mt-1">
                                        This lead is ready to be transferred to the login department for processing.
                                    </p>
                                </div>
                                <button
                                    onClick={handleTransferToLogin}
                                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    Transfer to Login
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Current Status Display */}
                    <div className="mt-4 p-3 bg-white rounded-lg border border-gray-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-black">Current Status</div>
                                <div className="text-black font-semibold">
                                    {leadData.status || (userDepartment === 'sales' ? 'ACTIVE LEAD' : 'ACTIVE LOGIN')}
                                </div>
                                {leadData.sub_status && (
                                    <div className="text-xs bg-gray-200 text-black px-2 py-1 rounded-full border border-gray-400 mt-1 inline-block">
                                        {leadData.sub_status}
                                    </div>
                                )}
                            </div>
                            {isUpdatingStatus && (
                                <div className="text-blue-400 text-sm">Updating...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}