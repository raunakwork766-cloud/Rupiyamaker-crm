import React, { useState, useEffect, useRef } from 'react';
import { Save, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function HowToProcessSection({ leadData, lead, process, onUpdate, onSave }) {
    // Handle prop naming differences between components (leadData vs lead and onUpdate vs onSave)
    const leadInfo = leadData || lead || {};
    const updateHandler = onUpdate || onSave || (() => {});
    const [editableData, setEditableData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [open, setOpen] = useState(true);
    const lastSavedData = useRef({});

    useEffect(() => {
        // Use process prop if available, otherwise use data from leadInfo
        const processData = process || {};
        
        setEditableData({
            bank_name: processData.bank_name || leadInfo.dynamic_fields?.financial_details?.bank_name || '',
            product_need: processData.product_need || leadInfo.dynamic_fields?.product_need || '',
            case_type: processData.case_type || leadInfo.dynamic_fields?.case_type || '',
            loan_amount_applied: processData.loan_amount_applied || leadInfo.loan_amount || '',
            required_tenure: processData.required_tenure || leadInfo.dynamic_fields?.required_tenure || '',
            tenure_in_years: processData.tenure_in_years || leadInfo.dynamic_fields?.tenure_in_years || ''
        });
        lastSavedData.current = {
            bank_name: processData.bank_name || leadInfo.dynamic_fields?.financial_details?.bank_name || '',
            product_need: processData.product_need || leadInfo.dynamic_fields?.product_need || '',
            case_type: processData.case_type || leadInfo.dynamic_fields?.case_type || '',
            loan_amount_applied: processData.loan_amount_applied || leadInfo.loan_amount || '',
            required_tenure: processData.required_tenure || leadInfo.dynamic_fields?.required_tenure || '',
            tenure_in_years: processData.tenure_in_years || leadInfo.dynamic_fields?.tenure_in_years || ''
        };
    }, [leadInfo, process]);

    const handleInputChange = (field, value) => {
        setEditableData(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'required_tenure' && value) {
                newData.tenure_in_years = (parseInt(value) / 12).toFixed(1);
            }
            return newData;
        });
    };

    const handleFieldBlur = async (field) => {
        // Get the original value from leadInfo to compare against
        let originalValue;
        const processData = leadInfo.dynamic_fields?.processing_details || {};
        
        switch (field) {
            case 'bank_name':
                originalValue = processData.bank_name || leadInfo.dynamic_fields?.financial_details?.bank_name || '';
                break;
            case 'product_need':
                originalValue = processData.product_need || leadInfo.dynamic_fields?.product_need || '';
                break;
            case 'case_type':
                originalValue = processData.case_type || leadInfo.dynamic_fields?.case_type || '';
                break;
            case 'loan_amount_applied':
                originalValue = processData.loan_amount_applied || leadInfo.loan_amount || '';
                break;
            case 'required_tenure':
                originalValue = processData.required_tenure || leadInfo.dynamic_fields?.required_tenure || '';
                break;
            default:
                originalValue = '';
        }
        
        console.log('🔍 HowToProcess: Field:', field, 'Current:', editableData[field], 'Original:', originalValue);
        
        if (editableData[field] === originalValue) {
            console.log('⏭️ HowToProcess: No change detected, skipping save');
            return;
        }
        
        console.log('💾 HowToProcess: Change detected, saving...');
        setIsSaving(true);
        try {
            const updateData = {
                loan_amount: parseFloat(editableData.loan_amount_applied) || 0,
                dynamic_fields: {
                    ...leadInfo.dynamic_fields,
                    financial_details: {
                        ...leadInfo.dynamic_fields?.financial_details,
                        bank_name: editableData.bank_name
                    },
                    product_need: editableData.product_need,
                    case_type: editableData.case_type,
                    required_tenure: editableData.required_tenure,
                    tenure_in_years: editableData.tenure_in_years
                }
            };
            
            const result = await updateHandler(updateData);
            if (result !== false) {
                lastSavedData.current[field] = editableData[field];
                setSaveMessage('✅ Data saved successfully');
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                setSaveMessage('❌ Failed to save data');
                setTimeout(() => setSaveMessage(''), 3000);
            }
        } catch (error) {
            console.error('HowToProcessSection: Save failed:', error);
            setSaveMessage('❌ Failed to save data');
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (amount) => {
        return amount ? `₹${parseInt(amount).toLocaleString('en-IN')}` : 'N/A';
    };

    return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-white ">
            <button
                className="w-full flex justify-between items-center px-4 py-3 text-left text-xl font-semibold text-[#03b0f5] focus:outline-none"
                onClick={() => setOpen(prev => !prev)}
                type="button"
            >
                <span className="flex items-center font-bold">
                    <Info className="w-6 h-6 mr-2" />
                    How To Process
                </span>
                {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {open && (
                <div className="p-6 -mt-7">
                    <div className="flex justify-end items-center mb-2">
                        <div className="flex items-center space-x-4">
                            {isSaving && (
                                <div className="flex items-center text-blue-600 font-semibold">
                                    <Save className="w-4 h-4 mr-1 animate-pulse" />
                                    Saving...
                                </div>
                            )}
                            {saveMessage && (
                                <div className="text-sm font-semibold">
                                    {saveMessage}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-2 border-[#03b0f5] p-4 rounded-lg bg-white">
                        {/* Bank Name */}
                        <div>
                            <label className="block text-lg font-semibold mb-1" style={{ color: "#03b0f5", fontWeight: 600 }}>Bank Name</label>
                            <select
                                value={editableData.bank_name}
                                onChange={e => handleInputChange('bank_name', e.target.value)}
                                onBlur={() => handleFieldBlur('bank_name')}
                                className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-green-600 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Select Bank</option>
                                <option value="State Bank of India">State Bank of India</option>
                                <option value="HDFC Bank">HDFC Bank</option>
                                <option value="ICICI Bank">ICICI Bank</option>
                                <option value="Punjab National Bank">Punjab National Bank</option>
                                <option value="Bank of Baroda">Bank of Baroda</option>
                                <option value="Canara Bank">Canara Bank</option>
                                <option value="Union Bank of India">Union Bank of India</option>
                                <option value="Bank of India">Bank of India</option>
                                <option value="Central Bank of India">Central Bank of India</option>
                                <option value="Indian Bank">Indian Bank</option>
                                <option value="IDBI Bank">IDBI Bank</option>
                                <option value="UCO Bank">UCO Bank</option>
                                <option value="Indian Overseas Bank">Indian Overseas Bank</option>
                                <option value="Punjab & Sind Bank">Punjab & Sind Bank</option>
                                <option value="Axis Bank">Axis Bank</option>
                                <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                                <option value="Yes Bank">Yes Bank</option>
                                <option value="IndusInd Bank">IndusInd Bank</option>
                                <option value="Federal Bank">Federal Bank</option>
                                <option value="South Indian Bank">South Indian Bank</option>
                                <option value="Karur Vysya Bank">Karur Vysya Bank</option>
                                <option value="Tamilnad Mercantile Bank">Tamilnad Mercantile Bank</option>
                                <option value="City Union Bank">City Union Bank</option>
                                <option value="Dhanlaxmi Bank">Dhanlaxmi Bank</option>
                                <option value="Lakshmi Vilas Bank">Lakshmi Vilas Bank</option>
                                <option value="RBL Bank">RBL Bank</option>
                                <option value="Bandhan Bank">Bandhan Bank</option>
                                <option value="IDFC First Bank">IDFC First Bank</option>
                                <option value="AU Small Finance Bank">AU Small Finance Bank</option>
                                <option value="Equitas Small Finance Bank">Equitas Small Finance Bank</option>
                            </select>
                        </div>

                        {/* Product Need */}
                        <div>
                            <label className="block text-lg font-semibold mb-1" style={{ color: "#03b0f5", fontWeight: 600 }}>Product Need</label>
                            <select
                                value={editableData.product_need}
                                onChange={e => handleInputChange('product_need', e.target.value)}
                                onBlur={() => handleFieldBlur('product_need')}
                                className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-green-600 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Select Product Need</option>
                                <option value="Personal Loan">Personal Loan</option>
                                <option value="Home Loan">Home Loan</option>
                                <option value="Business Loan">Business Loan</option>
                                <option value="Car Loan">Car Loan</option>
                                <option value="Education Loan">Education Loan</option>
                                <option value="Credit Card">Credit Card</option>
                                <option value="Balance Transfer">Balance Transfer</option>
                            </select>
                        </div>

                        {/* Case Type */}
                        <div>
                            <label className="block text-lg font-semibold mb-1" style={{ color: "#03b0f5", fontWeight: 600 }}>Case Type</label>
                            <select
                                value={editableData.case_type}
                                onChange={e => handleInputChange('case_type', e.target.value)}
                                onBlur={() => handleFieldBlur('case_type')}
                                className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-green-600 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Select Case Type</option>
                                <option value="Fresh">Fresh</option>
                                <option value="BT">Balance Transfer</option>
                                <option value="Top Up">Top Up</option>
                                <option value="BT + Top Up">BT + Top Up</option>
                            </select>
                        </div>

                        {/* Loan Amount Applied */}
                        <div>
                            <label className="block text-lg font-semibold mb-1" style={{ color: "#03b0f5", fontWeight: 600 }}>Loan Amount Applied</label>
                            <input
                                type="number"
                                value={editableData.loan_amount_applied}
                                onChange={e => handleInputChange('loan_amount_applied', e.target.value)}
                                onBlur={() => handleFieldBlur('loan_amount_applied')}
                                className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-green-600 font-semibold focus:outline-none focus:border-blue-500"
                                placeholder="Enter loan amount"
                            />
                        </div>

                        {/* Required Tenure */}
                        <div>
                            <label className="block text-lg font-semibold mb-1" style={{ color: "#03b0f5", fontWeight: 600 }}>Required Tenure (Months)</label>
                            <input
                                type="number"
                                value={editableData.required_tenure}
                                onChange={e => handleInputChange('required_tenure', e.target.value)}
                                onBlur={() => handleFieldBlur('required_tenure')}
                                className="w-full bg-white border border-gray-600 rounded px-3 py-2 text-green-600 font-semibold focus:outline-none focus:border-blue-500"
                                placeholder="Enter tenure in months"
                            />
                        </div>

                        {/* Tenure in Years */}
                        <div>
                            <label className="block text-lg font-semibold mb-1" style={{ color: "#03b0f5", fontWeight: 600 }}>Tenure in Years</label>
                            <div className="bg-white p-2 rounded border text-green-600 font-semibold">
                                {editableData.tenure_in_years || leadData.dynamic_fields?.tenure_in_years || 'N/A'}
                                {editableData.tenure_in_years && ' years'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}