import React, { useState, useEffect } from 'react';
import { 
    Building2, 
    DollarSign, 
    Percent, 
    Calendar, 
    CreditCard, 
    TrendingUp, 
    Banknote,
    Hash,
    Shield,
    Save,
    Edit3,
    Eye,
    X,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { formatDate as formatDateUtil } from '../../utils/dateUtils';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

export default function OperationsSection({ leadData, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [formData, setFormData] = useState({
        operations_channel_name: '',
        operations_rate: '',
        operations_amount_disbursed: '',
        operations_los_number: '',
        operations_pf_insurance: '',
        operations_internal_top: '',
        operations_amount_approved: '',
        operations_tenure_given: '',
        operations_cashback_to_customer: '',
        operations_net_disbursement_amount: '',
        operations_disbursement_date: ''
    });

    const [open, setOpen] = useState(false); // Dropdown closed by default

    // Initialize form data from leadData
    useEffect(() => {
        if (leadData) {
            setFormData({
                operations_channel_name: leadData.operations_channel_name || '',
                operations_rate: leadData.operations_rate || '',
                operations_amount_disbursed: leadData.operations_amount_disbursed || '',
                operations_los_number: leadData.operations_los_number || '',
                operations_pf_insurance: leadData.operations_pf_insurance || '',
                operations_internal_top: leadData.operations_internal_top || '',
                operations_amount_approved: leadData.operations_amount_approved || '',
                operations_tenure_given: leadData.operations_tenure_given || '',
                operations_cashback_to_customer: leadData.operations_cashback_to_customer || '',
                operations_net_disbursement_amount: leadData.operations_net_disbursement_amount || '',
                operations_disbursement_date: leadData.operations_disbursement_date || ''
            });
        }
    }, [leadData]);

    // Handle form input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle save operations data
    const handleSave = async () => {
        try {
            setIsSaving(true);
            const operationsData = {
                channel_name: formData.operations_channel_name,
                rate: formData.operations_rate,
                amount_disbursed: formData.operations_amount_disbursed,
                los_number: formData.operations_los_number,
                pf_insurance: formData.operations_pf_insurance,
                internal_top: formData.operations_internal_top,
                amount_approved: formData.operations_amount_approved,
                tenure_given: formData.operations_tenure_given,
                cashback_to_customer: formData.operations_cashback_to_customer,
                net_disbursement_amount: formData.operations_net_disbursement_amount,
                disbursement_date: formData.operations_disbursement_date
            };
            const userId = localStorage.getItem('userId') || '';
            const response = await fetch(`${API_BASE_URL}/lead-login/update-operations/${leadData._id}?user_id=${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(operationsData)
            });

            if (!response.ok) {
                throw new Error('Failed to update operations data');
            }

            const result = await response.json();
            const success = await onUpdate(formData);
            if (success) {
                setIsEditing(false);
                setSaveMessage('Operations data updated successfully');
                setTimeout(() => setSaveMessage(''), 3000);
            }
        } catch (error) {
            setSaveMessage('Failed to update operations data');
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle cancel editing
    const handleCancel = () => {
        setFormData({
            operations_channel_name: leadData.operations_channel_name || '',
            operations_rate: leadData.operations_rate || '',
            operations_amount_disbursed: leadData.operations_amount_disbursed || '',
            operations_los_number: leadData.operations_los_number || '',
            operations_pf_insurance: leadData.operations_pf_insurance || '',
            operations_internal_top: leadData.operations_internal_top || '',
            operations_amount_approved: leadData.operations_amount_approved || '',
            operations_tenure_given: leadData.operations_tenure_given || '',
            operations_cashback_to_customer: leadData.operations_cashback_to_customer || '',
            operations_net_disbursement_amount: leadData.operations_net_disbursement_amount || '',
            operations_disbursement_date: leadData.operations_disbursement_date || ''
        });
        setIsEditing(false);
    };

    // Helper function to format currency
    const formatCurrency = (value) => {
        if (!value || value === 0) return '-';
        const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
        return isNaN(numValue) ? '-' : `₹${numValue.toLocaleString()}`;
    };

    // Helper function to format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            return formatDateUtil(dateString);
        } catch (error) {
            return '-';
        }
    };

    // Helper component for displaying field values
    const FieldDisplay = ({ label, value, icon: Icon, type = 'text' }) => {
        let displayValue = value || '-';
        if (type === 'currency') {
            displayValue = formatCurrency(value);
        } else if (type === 'date') {
            displayValue = formatDate(value);
        } else if (type === 'percentage') {
            displayValue = value ? `${value}%` : '-';
        } else if (type === 'months') {
            displayValue = value ? `${value} months` : '-';
        }
        return (
            <div className="space-y-2">
                <div className="flex items-center">
                    <Icon className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-black">{label}</span>
                </div>
                <div className="text-black pl-6">{displayValue}</div>
            </div>
        );
    };

    // Helper component for editing field values
    const FieldEdit = ({ label, value, onChange, icon: Icon, type = 'text', placeholder }) => {
        return (
            <div className="space-y-2">
                <div className="flex items-center">
                    <Icon className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-lg font-extrabold text-black">{label}</span>
                </div>
                <div className="pl-6">
                    <input
                        type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 bg-white border border-gray-600 rounded-md text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        step={type === 'number' ? '0.01' : undefined}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-white">
            <button
                className="w-full flex justify-between items-center px-4 py-3 text-left text-xl font-bold text-[#03b0f5] focus:outline-none"
                onClick={() => setOpen(prev => !prev)}
                type="button"
            >
                <span className="flex items-center">
                    <Building2 className="w-6 h-6 mr-2" />
                    Operations
                </span>
                {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {open && (
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                           
                           
                        </div>
                        <div className="flex items-center space-x-2">
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                                >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    Edit
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleCancel}
                                        className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {saveMessage && (
                        <div className={`mt-4 p-3 rounded-md text-sm ${
                            saveMessage.includes('successfully') 
                                ? 'bg-green-100 border border-green-400 text-green-800' 
                                : 'bg-red-100 border border-red-400 text-red-800'
                        }`}>
                            {saveMessage}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Channel Information */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-black border-b border-gray-200 pb-2">
                                Channel Information
                            </h4>
                            {isEditing ? (
                                <>
                                    <FieldEdit
                                        label="Channel Name"
                                        value={formData.operations_channel_name}
                                        onChange={(value) => handleInputChange('operations_channel_name', value)}
                                        icon={Building2}
                                        placeholder="Enter channel name"
                                    />
                                    <FieldEdit
                                        label="Rate (%)"
                                        value={formData.operations_rate}
                                        onChange={(value) => handleInputChange('operations_rate', value)}
                                        icon={Percent}
                                        type="number"
                                        placeholder="Enter rate percentage"
                                    />
                                </>
                            ) : (
                                <>
                                    <FieldDisplay
                                        label="Channel Name"
                                        value={formData.operations_channel_name}
                                        icon={Building2}
                                    />
                                    <FieldDisplay
                                        label="Rate"
                                        value={formData.operations_rate}
                                        icon={Percent}
                                        type="percentage"
                                    />
                                </>
                            )}
                        </div>

                        {/* Financial Details */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-black border-b border-gray-200 pb-2">
                                Financial Details
                            </h4>
                            {isEditing ? (
                                <>
                                    <FieldEdit
                                        label="Amount Disbursed (₹)"
                                        value={formData.operations_amount_disbursed}
                                        onChange={(value) => handleInputChange('operations_amount_disbursed', value)}
                                        icon={DollarSign}
                                        type="number"
                                        placeholder="Enter disbursed amount"
                                    />
                                    <FieldEdit
                                        label="Amount Approved (₹)"
                                        value={formData.operations_amount_approved}
                                        onChange={(value) => handleInputChange('operations_amount_approved', value)}
                                        icon={CreditCard}
                                        type="number"
                                        placeholder="Enter approved amount"
                                    />
                                    <FieldEdit
                                        label="Net Disbursement (₹)"
                                        value={formData.operations_net_disbursement_amount}
                                        onChange={(value) => handleInputChange('operations_net_disbursement_amount', value)}
                                        icon={Banknote}
                                        type="number"
                                        placeholder="Enter net disbursement"
                                    />
                                </>
                            ) : (
                                <>
                                    <FieldDisplay
                                        label="Amount Disbursed"
                                        value={formData.operations_amount_disbursed}
                                        icon={DollarSign}
                                        type="currency"
                                    />
                                    <FieldDisplay
                                        label="Amount Approved"
                                        value={formData.operations_amount_approved}
                                        icon={CreditCard}
                                        type="currency"
                                    />
                                    <FieldDisplay
                                        label="Net Disbursement"
                                        value={formData.operations_net_disbursement_amount}
                                        icon={Banknote}
                                        type="currency"
                                    />
                                </>
                            )}
                        </div>

                        {/* Additional Information */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-black border-b border-gray-200 pb-2">
                                Additional Information
                            </h4>
                            {isEditing ? (
                                <>
                                    <FieldEdit
                                        label="LOS Number"
                                        value={formData.operations_los_number}
                                        onChange={(value) => handleInputChange('operations_los_number', value)}
                                        icon={Hash}
                                        placeholder="Enter LOS number"
                                    />
                                    <FieldEdit
                                        label="Tenure Given (months)"
                                        value={formData.operations_tenure_given}
                                        onChange={(value) => handleInputChange('operations_tenure_given', value)}
                                        icon={Calendar}
                                        type="number"
                                        placeholder="Enter tenure in months"
                                    />
                                    <FieldEdit
                                        label="Disbursement Date"
                                        value={formData.operations_disbursement_date ? 
                                            new Date(formData.operations_disbursement_date).toISOString().split('T')[0] : ''}
                                        onChange={(value) => handleInputChange('operations_disbursement_date', value)}
                                        icon={Calendar}
                                        type="date"
                                    />
                                </>
                            ) : (
                                <>
                                    <FieldDisplay
                                        label="LOS Number"
                                        value={formData.operations_los_number}
                                        icon={Hash}
                                    />
                                    <FieldDisplay
                                        label="Tenure Given"
                                        value={formData.operations_tenure_given}
                                        icon={Calendar}
                                        type="months"
                                    />
                                    <FieldDisplay
                                        label="Disbursement Date"
                                        value={formData.operations_disbursement_date}
                                        icon={Calendar}
                                        type="date"
                                    />
                                </>
                            )}
                        </div>

                        {/* Insurance & Other Charges */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-black border-b border-gray-200 pb-2">
                                Insurance & Charges
                            </h4>
                            {isEditing ? (
                                <>
                                    <FieldEdit
                                        label="PF & Insurance (₹)"
                                        value={formData.operations_pf_insurance}
                                        onChange={(value) => handleInputChange('operations_pf_insurance', value)}
                                        icon={Shield}
                                        type="number"
                                        placeholder="Enter PF & insurance amount"
                                    />
                                    <FieldEdit
                                        label="Internal Top (₹)"
                                        value={formData.operations_internal_top}
                                        onChange={(value) => handleInputChange('operations_internal_top', value)}
                                        icon={TrendingUp}
                                        type="number"
                                        placeholder="Enter internal top amount"
                                    />
                                    <FieldEdit
                                        label="Cashback to Customer (₹)"
                                        value={formData.operations_cashback_to_customer}
                                        onChange={(value) => handleInputChange('operations_cashback_to_customer', value)}
                                        icon={Banknote}
                                        type="number"
                                        placeholder="Enter cashback amount"
                                    />
                                </>
                            ) : (
                                <>
                                    <FieldDisplay
                                        label="PF & Insurance"
                                        value={formData.operations_pf_insurance}
                                        icon={Shield}
                                        type="currency"
                                    />
                                    <FieldDisplay
                                        label="Internal Top"
                                        value={formData.operations_internal_top}
                                        icon={TrendingUp}
                                        type="currency"
                                    />
                                    <FieldDisplay
                                        label="Cashback to Customer"
                                        value={formData.operations_cashback_to_customer}
                                        icon={Banknote}
                                        type="currency"
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="mt-8 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <h4 className="text-lg font-medium text-black mb-4 flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2" />
                                Operations Summary
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="text-center">
                                    <div className="text-gray-500">Total Approved</div>
                                    <div className="text-lg font-semibold text-green-700">
                                        {formatCurrency(formData.operations_amount_approved)}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-gray-500">Net Disbursed</div>
                                    <div className="text-lg font-semibold text-blue-700">
                                        {formatCurrency(formData.operations_net_disbursement_amount)}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-gray-500">Processing Rate</div>
                                    <div className="text-lg font-semibold text-yellow-700">
                                        {formData.operations_rate ? `${formData.operations_rate}%` : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}