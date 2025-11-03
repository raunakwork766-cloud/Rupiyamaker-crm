import React, { useState } from 'react';
import { Plus, X, Edit, Trash2 } from 'lucide-react';

const StatusManagementTab = ({
    statuses,
    selectedDepartment,
    setSelectedDepartment,
    showStatusModal,
    setShowStatusModal,
    showSubStatusModal,
    setShowSubStatusModal,
    statusModalType,
    setStatusModalType,
    subStatusModalType,
    setSubStatusModalType,
    editingStatus,
    setEditingStatus,
    editingSubStatus,
    setEditingSubStatus,
    selectedStatus,
    setSelectedStatus,
    createStatus,
    updateStatus,
    deleteStatus,
    deleteSubStatusFromArray,
    createSubStatus,
    updateSubStatus,
    deleteSubStatus
}) => {
    // Local loading states for form submissions
    const [isStatusFormSubmitting, setIsStatusFormSubmitting] = useState(false);
    const [isSubStatusFormSubmitting, setIsSubStatusFormSubmitting] = useState(false);
    
    // Ensure statuses is always an array
    const statusesArray = Array.isArray(statuses) ? statuses : [];
    
    // Debug logging
    console.log('StatusManagementTab render:', {
        statusesReceived: statuses,
        statusesArray,
        statusesLength: statusesArray.length,
        selectedDepartment
    });
    
    return (
        <div className="p-6 bg-gray-900 text-white">
            <h2 className="text-2xl font-bold mb-4 text-white">Status Management</h2>
            <div className="flex gap-4 mb-4">
                <select
                    value={selectedDepartment}
                    onChange={e => setSelectedDepartment(e.target.value)}
                    className="px-3 py-2 rounded border border-gray-600 bg-black text-white"
                >
                    <option value="">Select Department</option>
                    <option value="leads">Leads</option>
                    <option value="login">Login</option>
                </select>
                <button
                    className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"
                    onClick={() => { 
                        setStatusModalType('add'); 
                        setEditingStatus(null); 
                        setShowStatusModal(true); 
                    }}
                >
                    <Plus size={18}/> Add Status
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full bg-black text-white border border-gray-700 rounded">
                    <thead>
                        <tr className="bg-gray-800">
                            <th className="px-4 py-2 text-left">Status Name</th>
                            <th className="px-4 py-2 text-left">Department</th>
                            <th className="px-4 py-2 text-center">Order</th>
                            <th className="px-4 py-2 text-left">Color</th>
                            <th className="px-4 py-2 text-center">Reassign (days)</th>
                            <th className="px-4 py-2 text-center">Manager Approval</th>
                            <th className="px-4 py-2 text-left">Sub-Options</th>
                            <th className="px-4 py-2 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {statusesArray
                            .filter(status => {
                                // Handle both old format (status.department) and new format (department_ids)
                                if (selectedDepartment === '') return true; // Show all if no department selected
                                
                                // Check if status has department field (old format)
                                if (status.department) {
                                    return status.department === selectedDepartment;
                                }
                                
                                // Check if status has department_ids field (new format)
                                if (status.department_ids) {
                                    // If department_ids is an array, check if selectedDepartment is in it
                                    if (Array.isArray(status.department_ids)) {
                                        return status.department_ids.includes(selectedDepartment);
                                    }
                                    // If department_ids is a string, compare directly
                                    return status.department_ids === selectedDepartment;
                                }
                                
                                // If department_ids is null/undefined, show the status (assume it's for all departments)
                                console.log('Showing status with null department_ids:', status.name);
                                return true;
                            })
                            .map(status => (
                            <tr key={status._id || status.id} className="border-b border-gray-700 hover:bg-gray-800">
                                <td className="px-4 py-3 font-semibold">{status.name}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
                                        {status.department || (status.department_ids ? 
                                            (Array.isArray(status.department_ids) ? status.department_ids.join(', ') : status.department_ids) 
                                            : 'All Departments')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">{status.order || 0}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-4 h-4 rounded" 
                                            style={{ backgroundColor: status.color || '#6B7280' }}
                                        ></div>
                                        <span className="text-xs">{status.color || '#6B7280'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {status.reassignment_period || 0}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {status.is_manager_permission_required ? 
                                        <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">Required</span> : 
                                        <span className="px-2 py-1 rounded text-xs bg-gray-600 text-white">Not Required</span>
                                    }
                                </td>
                                <td className="px-4 py-3">
                                    <div className="max-w-xs">
                                        {/* Sub-options Header with Add Button */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-300">
                                                Sub-Options ({(status.sub_statuses || []).length})
                                            </span>
                                            <button
                                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
                                                onClick={() => { 
                                                    setSelectedStatus(status); 
                                                    setSubStatusModalType('add'); 
                                                    setEditingSubStatus(null); 
                                                    setShowSubStatusModal(true); 
                                                }}
                                                title="Add Sub-Option"
                                            >
                                                <Plus size={12}/> Add
                                            </button>
                                        </div>
                                        
                                        {/* Sub-options List */}
                                        {(status.sub_statuses || []).length > 0 ? (
                                            <div className="space-y-1 border border-gray-600 rounded p-2 bg-gray-800">
                                                {(status.sub_statuses || []).map((sub, index) => (
                                                    <div key={index} className="flex items-center justify-between p-1 hover:bg-gray-700 rounded">
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <span className="text-sm text-white">{typeof sub === 'string' ? sub : sub.name}</span>
                                                            <div className="flex gap-1">
                                                                {typeof sub === 'object' && sub.reassignment_period > 0 && (
                                                                    <span className="text-xs px-1 py-0.5 bg-blue-700 text-white rounded" title="Reassignment Period">{sub.reassignment_period}d</span>
                                                                )}
                                                                {typeof sub === 'object' && sub.is_manager_permission_required && (
                                                                    <span className="text-xs px-1 py-0.5 bg-green-700 text-white rounded" title="Manager Permission Required">M</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {typeof sub === 'object' && (
                                                                <button
                                                                    className="text-blue-400 hover:text-blue-300 p-1"
                                                                    onClick={() => { 
                                                                        setSelectedStatus(status); 
                                                                        setEditingSubStatus(sub);
                                                                        setSubStatusModalType('edit'); 
                                                                        setShowSubStatusModal(true); 
                                                                    }}
                                                                    title="Edit Sub-Option"
                                                                >
                                                                    <Edit size={12}/>
                                                                </button>
                                                            )}
                                                            <button
                                                                className="text-red-400 hover:text-red-300 p-1"
                                                                onClick={async () => { 
                                                                    if (window.confirm('Are you sure you want to delete this sub-option?')) {
                                                                        if (typeof sub === 'object' && sub._id) {
                                                                            await deleteSubStatus(sub._id);
                                                                        } else {
                                                                            await deleteSubStatusFromArray(status._id || status.id, sub, index); 
                                                                        }
                                                                    }
                                                                }}
                                                                title="Delete Sub-Option"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 text-sm text-center py-2 border border-gray-600 rounded bg-gray-800">
                                                No sub-options
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            className="text-blue-400 hover:text-blue-300 p-1"
                                            onClick={() => { 
                                                setEditingStatus(status); 
                                                setStatusModalType('edit'); 
                                                setShowStatusModal(true); 
                                            }}
                                            title="Edit Status"
                                        >
                                            <Edit size={16}/>
                                        </button>
                                        <button
                                            className="text-red-400 hover:text-red-300 p-1"
                                            onClick={async () => { 
                                                if (window.confirm('Are you sure you want to delete this status? This will also delete all its sub-options.')) {
                                                    await deleteStatus(status._id || status.id); 
                                                }
                                            }}
                                            title="Delete Status"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Status Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-600">
                            <h3 className="text-xl font-bold text-white">
                                {statusModalType === 'add' ? 'Add Status' : 'Edit Status'}
                            </h3>
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-full p-1 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                        <form id="statusForm" onSubmit={async e => {
                            e.preventDefault();
                            
                            // Set loading state
                            setIsStatusFormSubmitting(true);
                            
                            try {
                                const name = e.target.statusName.value.trim();
                                const color = e.target.color.value.trim();
                                const orderValue = e.target.order.value.trim();
                                const reassignmentPeriodValue = e.target.reassignmentPeriod.value.trim();
                                
                                // Handle empty values properly
                                const order = orderValue === '' ? 1 : parseInt(orderValue, 10);
                                const reassignmentPeriod = reassignmentPeriodValue === '' ? 0 : parseInt(reassignmentPeriodValue, 10);
                                const isManagerPermissionRequired = e.target.isManagerPermissionRequired?.checked || false;
                                
                                if (!name) return;
                                
                                const payload = { 
                                    name, 
                                    department_ids: selectedDepartment === 'all' ? null : [selectedDepartment], 
                                    order, 
                                    color: color || '#6B7280',
                                    is_active: true,
                                    reassignment_period: reassignmentPeriod,
                                    is_manager_permission_required: isManagerPermissionRequired,
                                    description: null // Add description field as shown in API response
                                };
                                
                                let ok = false;
                                if (statusModalType === 'add') {
                                    ok = await createStatus(payload);
                                } else if (statusModalType === 'edit' && editingStatus) {
                                    ok = await updateStatus(editingStatus._id || editingStatus.id, payload);
                                }
                                
                                if (ok) setShowStatusModal(false);
                            } finally {
                                // Always reset loading state
                                setIsStatusFormSubmitting(false);
                            }
                        }}>
                            <input
                                name="statusName"
                                defaultValue={editingStatus?.name || ''}
                                placeholder="Status Name"
                                required
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <input
                                name="color"
                                type="color"
                                defaultValue={editingStatus?.color || '#6B7280'}
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <input
                                name="order"
                                type="number"
                                defaultValue={editingStatus?.order || ''}
                                placeholder="Order"
                                min="1"
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <input
                                name="reassignmentPeriod"
                                type="number"
                                defaultValue={editingStatus?.reassignment_period || ''}
                                placeholder="Reassignment Period (in days)"
                                min="0"
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <div className="flex items-center mb-4">
                                <input
                                    name="isManagerPermissionRequired"
                                    type="checkbox"
                                    id="isManagerPermissionRequired"
                                    defaultChecked={editingStatus?.is_manager_permission_required || false}
                                    className="mr-2 h-4 w-4"
                                />
                                <label htmlFor="isManagerPermissionRequired" className="text-white">
                                    Manager approval required
                                </label>
                            </div>
                        </form>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="flex justify-end gap-2 p-6 border-t border-gray-600">
                            <button 
                                type="button" 
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors" 
                                onClick={() => setShowStatusModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                form="statusForm"
                                disabled={isStatusFormSubmitting}
                                className={`px-4 py-2 text-white rounded transition-colors ${
                                    isStatusFormSubmitting 
                                        ? 'bg-gray-500 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isStatusFormSubmitting ? 'Saving...' : (statusModalType === 'add' ? 'Add' : 'Update')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Status Modal */}
            {showSubStatusModal && (
                <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-600">
                            <h3 className="text-xl font-bold text-white">
                                {subStatusModalType === 'add' ? 'Add Sub-Status' : 'Edit Sub-Status'}
                            </h3>
                            <button
                                onClick={() => setShowSubStatusModal(false)}
                                className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-full p-1 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                        <form id="subStatusForm" onSubmit={async e => {
                            e.preventDefault();
                            
                            // Set loading state
                            setIsSubStatusFormSubmitting(true);
                            
                            try {
                                const name = e.target.subStatusName.value.trim();
                                const reassignmentPeriodValue = e.target.reassignmentPeriod.value.trim();
                                const reassignmentPeriod = reassignmentPeriodValue === '' ? 0 : parseInt(reassignmentPeriodValue, 10);
                                const isManagerPermissionRequired = e.target.isManagerPermissionRequired?.checked || false;
                                if (!name) return;
                                
                                if (subStatusModalType === 'add') {
                                    // Add sub-status to the status's sub_statuses array
                                    const currentSubStatuses = [...(selectedStatus.sub_statuses || [])];
                                    
                                    // Handle multiple sub-statuses (one per line)
                                    const subStatusNames = name.split('\n').filter(n => n.trim() !== '');
                                    
                                    // Add each sub-status
                                    subStatusNames.forEach(subName => {
                                        const trimmedName = subName.trim();
                                        if (trimmedName) {
                                            const newSubStatus = {
                                                name: trimmedName,
                                                reassignment_period: reassignmentPeriod,
                                                is_manager_permission_required: isManagerPermissionRequired
                                            };
                                            currentSubStatuses.push(newSubStatus);
                                        }
                                    });
                                    
                                    const ok = await updateStatus(selectedStatus._id || selectedStatus.id, {
                                        sub_statuses: currentSubStatuses
                                    });
                                    if (ok) setShowSubStatusModal(false);
                                } else {
                                    // Edit existing sub-status in array
                                    const currentSubStatuses = [...(selectedStatus.sub_statuses || [])];
                                    const editIndex = currentSubStatuses.findIndex(sub => 
                                        (typeof sub === 'string' ? sub : sub.name) === 
                                        (typeof editingSubStatus === 'string' ? editingSubStatus : editingSubStatus.name)
                                    );
                                    if (editIndex !== -1) {
                                        // Keep existing structure if it's an object
                                        const existingSubStatus = currentSubStatuses[editIndex];
                                        if (typeof existingSubStatus === 'object') {
                                            currentSubStatuses[editIndex] = {
                                                ...existingSubStatus,
                                                name: name,
                                                reassignment_period: reassignmentPeriod,
                                                is_manager_permission_required: isManagerPermissionRequired
                                            };
                                        } else {
                                            // Convert string to object
                                            currentSubStatuses[editIndex] = {
                                                name: name,
                                                reassignment_period: reassignmentPeriod,
                                                is_manager_permission_required: isManagerPermissionRequired
                                            };
                                        }
                                        const ok = await updateStatus(selectedStatus._id || selectedStatus.id, {
                                            sub_statuses: currentSubStatuses
                                        });
                                        if (ok) setShowSubStatusModal(false);
                                    }
                                }
                            } finally {
                                // Always reset loading state
                                setIsSubStatusFormSubmitting(false);
                            }
                        }}>
                            {subStatusModalType === 'add' ? (
                                <textarea
                                    name="subStatusName"
                                    placeholder="Enter sub-status names (one per line)"
                                    required
                                    rows="5"
                                    className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                                />
                            ) : (
                                <input
                                    name="subStatusName"
                                    defaultValue={
                                        typeof editingSubStatus === 'string' 
                                            ? editingSubStatus 
                                            : editingSubStatus?.name || ''
                                    }
                                    placeholder="Sub-Status Name"
                                    required
                                    className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                                />
                            )}
                            <input
                                name="reassignmentPeriod"
                                type="number"
                                defaultValue={
                                    typeof editingSubStatus === 'object' 
                                        ? editingSubStatus?.reassignment_period || ''
                                        : ''
                                }
                                placeholder="Reassignment Period (in days)"
                                min="0"
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <div className="flex items-center mb-4">
                                <input
                                    name="isManagerPermissionRequired"
                                    type="checkbox"
                                    id="subStatusManagerPermissionRequired"
                                    defaultChecked={
                                        typeof editingSubStatus === 'object' 
                                            ? editingSubStatus?.is_manager_permission_required || false
                                            : false
                                    }
                                    className="mr-2 h-4 w-4"
                                />
                                <label htmlFor="subStatusManagerPermissionRequired" className="text-white">
                                    Manager approval required
                                </label>
                            </div>
                        </form>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="flex justify-end gap-2 p-6 border-t border-gray-600">
                            <button 
                                type="button" 
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors" 
                                onClick={() => setShowSubStatusModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                form="subStatusForm"
                                disabled={isSubStatusFormSubmitting}
                                className={`px-4 py-2 text-white rounded transition-colors ${
                                    isSubStatusFormSubmitting 
                                        ? 'bg-gray-500 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isSubStatusFormSubmitting ? 'Saving...' : (subStatusModalType === 'add' ? 'Add' : 'Update')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusManagementTab;
