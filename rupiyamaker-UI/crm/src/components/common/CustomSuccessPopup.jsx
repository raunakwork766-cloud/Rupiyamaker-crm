import React from 'react';
import { CheckCircle, User, Mail, Phone, Building, X, Calendar } from 'lucide-react';

const CustomSuccessPopup = ({ 
    isVisible, 
    onClose, 
    employeeData, 
    updatedFields = [],
    profileUpdated = false
}) => {
    if (!isVisible) return null;

    const formatEmployeeName = (employee) => {
        if (!employee) return 'Unknown Employee';
        return `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Unknown Employee';
    };

    const formatEmployeeId = (employee) => {
        if (!employee) return 'N/A';
        return employee.employee_id ? `RM${employee.employee_id}` : 'N/A';
    };

    const getEmployeeInfo = () => {
        if (!employeeData) return null;
        
        return [
            {
                icon: <User className="w-4 h-4" />,
                label: 'Employee Name',
                value: formatEmployeeName(employeeData)
            },
            {
                icon: <Mail className="w-4 h-4" />,
                label: 'Employee ID',
                value: formatEmployeeId(employeeData)
            },
            {
                icon: <Mail className="w-4 h-4" />,
                label: 'Email',
                value: employeeData.email || 'N/A'
            },
            {
                icon: <Phone className="w-4 h-4" />,
                label: 'Phone',
                value: employeeData.phone || 'N/A'
            },
            {
                icon: <Building className="w-4 h-4" />,
                label: 'Department',
                value: employeeData.department || 'N/A'
            }
        ].filter(item => item.value && item.value !== 'N/A');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-transparent bg-opacity-50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors duration-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center space-x-3">
                        <div className="bg-white bg-opacity-20 rounded-full p-3">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Employee Updated Successfully!</h2>
                            <p className="text-green-100 text-sm mt-1">
                                The employee information has been updated successfully.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Employee Info */}
                    {employeeData && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                    <User className="w-4 h-4 mr-2" />
                                    Employee Details
                                </h3>
                                <div className="space-y-2">
                                    {getEmployeeInfo()?.map((info, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="flex items-center text-gray-600">
                                                <span className="text-gray-400 mr-2">{info.icon}</span>
                                                <span className="text-sm">{info.label}:</span>
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{info.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Updated Fields Summary */}
                            {updatedFields && updatedFields.length > 0 && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Updated Fields ({updatedFields.length})
                                    </h3>
                                    <div className="text-xs text-blue-600 space-y-1">
                                        {updatedFields.slice(0, 5).map((field, index) => (
                                            <div key={index} className="truncate">
                                                • {field}
                                            </div>
                                        ))}
                                        {updatedFields.length > 5 && (
                                            <div className="text-blue-500 italic">
                                                ... and {updatedFields.length - 5} more fields
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Profile Picture Update */}
                            {profileUpdated && (
                                <div className="bg-purple-50 rounded-lg p-3">
                                    <div className="flex items-center text-purple-700">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        <span className="text-sm font-medium">Profile picture updated successfully</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomSuccessPopup;