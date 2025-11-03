import React, { useState } from 'react';
import CustomStatusDropdown from './CustomStatusDropdown';

const StatusDropdownExample = () => {
    const [currentStatus, setCurrentStatus] = useState('');
    const [currentSubStatus, setCurrentSubStatus] = useState('');
    const [department, setDepartment] = useState('leads');

    const handleStatusChange = (status) => {
        setCurrentStatus(status);
        setCurrentSubStatus(''); // Reset sub-status when status changes
        console.log('Status changed to:', status);
    };

    const handleSubStatusChange = (subStatus) => {
        setCurrentSubStatus(subStatus);
        console.log('Sub-status changed to:', subStatus);
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">Custom Status Dropdown Example</h2>
            
            {/* Department Selector */}
            <div className="mb-6">
                <label className="block text-lg font-semibold text-black mb-2">Department</label>
                <select 
                    value={department} 
                    onChange={(e) => setDepartment(e.target.value)}
                    className="bg-white border border-gray-600 rounded px-3 py-2 text-black"
                >
                    <option value="leads">Leads</option>
                    <option value="login">Login</option>
                    <option value="sales">Sales</option>
                    <option value="loan_processing">Loan Processing</option>
                </select>
            </div>

            {/* Status Dropdown Component */}
            <CustomStatusDropdown
                department={department}
                selectedStatus={currentStatus}
                selectedSubStatus={currentSubStatus}
                onStatusChange={handleStatusChange}
                onSubStatusChange={handleSubStatusChange}
                disabled={false}
            />

            {/* Display Current Selection */}
            <div className="mt-6 p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Current Selection:</h3>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Status:</strong> {currentStatus || 'None selected'}</p>
                <p><strong>Sub-Status:</strong> {currentSubStatus || 'None selected'}</p>
            </div>
        </div>
    );
};

export default StatusDropdownExample;
