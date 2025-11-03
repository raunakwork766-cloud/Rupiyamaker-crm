import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

const CustomStatusDropdown = ({ 
    department = 'leads', 
    selectedStatus, 
    selectedSubStatus, 
    onStatusChange, 
    onSubStatusChange,
    disabled = false,
    className = ""
}) => {
    const [statuses, setStatuses] = useState([]);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [showSubStatusDropdown, setShowSubStatusDropdown] = useState(false);
    const [statusSearchTerm, setStatusSearchTerm] = useState('');
    const [subStatusSearchTerm, setSubStatusSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const statusDropdownRef = useRef(null);
    const subStatusDropdownRef = useRef(null);

    // Load statuses on component mount and when department changes
    useEffect(() => {
        loadStatuses();
    }, [department]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
                setShowStatusDropdown(false);
            }
            if (subStatusDropdownRef.current && !subStatusDropdownRef.current.contains(event.target)) {
                setShowSubStatusDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const loadStatuses = async () => {
        try {
            setIsLoading(true);
            const userId = localStorage.getItem('user_id') || localStorage.getItem('userId');
            const response = await axios.get(`/leads/admin/statuses?user_id=${userId}&department=${department}`);
            setStatuses(response.data || []);
        } catch (error) {
            console.error('Error loading statuses:', error);
            setStatuses([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter statuses based on search term
    const filteredStatuses = statuses.filter(status =>
        status.name.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );

    // Get sub-statuses for the selected status
    const getSubStatuses = () => {
        const currentStatus = statuses.find(status => status.name === selectedStatus);
        return currentStatus?.sub_statuses || [];
    };

    // Filter sub-statuses based on search term
    const filteredSubStatuses = getSubStatuses().filter(subStatus => {
        const subStatusName = typeof subStatus === 'string' ? subStatus : subStatus.name;
        return subStatusName.toLowerCase().includes(subStatusSearchTerm.toLowerCase());
    });

    const handleStatusChange = (statusName) => {
        onStatusChange(statusName);
        setShowStatusDropdown(false);
        setStatusSearchTerm('');
        // Reset sub-status when status changes
        onSubStatusChange('');
    };

    const handleSubStatusChange = (subStatusName) => {
        onSubStatusChange(subStatusName);
        setShowSubStatusDropdown(false);
        setSubStatusSearchTerm('');
    };

    const getDefaultStatus = () => {
        if (department === 'sales') return 'ACTIVE LEAD';
        if (department === 'login') return 'ACTIVE LOGIN';
        return 'ACTIVE LEAD';
    };

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
            {/* Status Dropdown */}
            <div className="relative" ref={statusDropdownRef}>
                <label className="block text-lg font-semibold text-black mb-1">Status</label>
                <div className="status-dropdown">
                    <button
                        onClick={() => !disabled && setShowStatusDropdown(!showStatusDropdown)}
                        disabled={disabled || isLoading}
                        className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-black text-left focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                        {selectedStatus || getDefaultStatus()}
                        {showStatusDropdown ? 
                            <ChevronUp className="w-4 h-4 float-right mt-1" /> : 
                            <ChevronDown className="w-4 h-4 float-right mt-1" />
                        }
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
                            {isLoading ? (
                                <div className="px-3 py-2 text-gray-500">Loading statuses...</div>
                            ) : filteredStatuses.length > 0 ? (
                                filteredStatuses.map((status) => (
                                    <button
                                        key={status._id || status.id}
                                        onClick={() => handleStatusChange(status.name)}
                                        className="w-full text-left px-3 py-2 text-black hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            {status.color && (
                                                <div 
                                                    className="w-3 h-3 rounded" 
                                                    style={{ backgroundColor: status.color }}
                                                ></div>
                                            )}
                                            {status.name}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-2 text-gray-500">No statuses found</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-Status Dropdown */}
            <div className="relative" ref={subStatusDropdownRef}>
                <label className="block text-lg font-semibold text-black mb-1">Sub-Status</label>
                <div className="status-dropdown">
                    <button
                        onClick={() => !disabled && selectedStatus && setShowSubStatusDropdown(!showSubStatusDropdown)}
                        disabled={disabled || !selectedStatus}
                        className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-black text-left focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                        {selectedSubStatus || 'Select Sub-Status'}
                        {showSubStatusDropdown ? 
                            <ChevronUp className="w-4 h-4 float-right mt-1" /> : 
                            <ChevronDown className="w-4 h-4 float-right mt-1" />
                        }
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
                            {filteredSubStatuses.length > 0 ? (
                                filteredSubStatuses.map((subStatus, index) => {
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
                                })
                            ) : (
                                <div className="px-3 py-2 text-gray-500">
                                    {selectedStatus ? 'No sub-statuses available' : 'Select a status first'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomStatusDropdown;
