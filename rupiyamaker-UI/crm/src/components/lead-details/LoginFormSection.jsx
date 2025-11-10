import React, { useState, useEffect, useRef } from 'react';
import { Share2, Plus, Trash2, ChevronDown, ChevronUp, File, Save } from 'lucide-react';
import { saveLoginFormDataToAPIDebounced } from '../../utils/loginFormHelper';

export default function LoginFormSection({ leadData, lead, onUpdate, onGenerateShareableLink, shareableLink, isCoApplicant = false }) {
    // Handle prop naming differences between components (leadData vs lead)
    const leadInfo = leadData || lead || {};
    
    console.log('🔄 LoginFormSection render - leadInfo._id:', leadInfo._id);
    console.log('🔄 LoginFormSection render - isCoApplicant:', isCoApplicant);
    console.log('🔄 LoginFormSection render - leadInfo.dynamic_fields:', leadInfo.dynamic_fields);
    
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [isPermanentSameAsCurrent, setIsPermanentSameAsCurrent] = useState(false);
    const [generatedShareableLink, setGeneratedShareableLink] = useState('');
    const [linkMetadata, setLinkMetadata] = useState(null);
    const [showAdvancedLinkOptions, setShowAdvancedLinkOptions] = useState(false);
    const [linkOptions, setLinkOptions] = useState({
        expiresInDays: 30,
        allowUpdate: true,
        oneTimeUse: false,
        recipientEmail: ''
    });
    const [open, setOpen] = useState(true);
    const lastSavedData = useRef({});

    useEffect(() => {
        console.log('🔄 LoginFormSection useEffect triggered');
        console.log('📦 leadInfo:', leadInfo);
        console.log('🎯 isCoApplicant:', isCoApplicant);
        
        const dynamicFields = leadInfo.dynamic_fields || {};
        console.log('📋 dynamicFields:', dynamicFields);
        console.log('📋 dynamicFields keys:', Object.keys(dynamicFields));
        
        // Select the appropriate form data based on whether this is a co-applicant form
        const formSource = isCoApplicant 
            ? dynamicFields.co_applicant_form || {}
            : dynamicFields.applicant_form || dynamicFields.login_form || {};
        
        console.log('📝 formSource data:', formSource);
        console.log('📝 formSource keys:', Object.keys(formSource));
        console.log('📝 formSource.referenceNameForLogin:', formSource.referenceNameForLogin);
        console.log('📝 formSource.reference_name:', formSource.reference_name);
        console.log('📝 formSource.aadharNumber:', formSource.aadharNumber);
        console.log('📝 formSource.aadhar_number:', formSource.aadhar_number);
        
        // Create a hash of the formSource to detect changes
        const formSourceHash = JSON.stringify(formSource);
        console.log('🔑 formSource hash:', formSourceHash.substring(0, 200) + '...');

        const newFormData = {
            // Support BOTH snake_case (from backend) AND camelCase (from sections/LoginFormSection)
            reference_name: formSource.reference_name || formSource.referenceNameForLogin || '',
            aadhar_number: formSource.aadhar_number || formSource.aadharNumber || (isCoApplicant ? '' : dynamicFields.identity_details?.aadhar_number || ''),
            qualification: formSource.qualification || '',
            qualification_type: formSource.qualification_type || '',
            customer_name: isCoApplicant 
                ? formSource.customer_name || formSource.customerName || `${leadInfo.first_name || ''} ${leadInfo.last_name || ''} (Co-Applicant)`.trim()
                : formSource.customer_name || formSource.customerName || `${leadInfo.first_name || ''} ${leadInfo.last_name || ''}`.trim(),
            pan_number: formSource.pan_number || formSource.panCard || (isCoApplicant ? '' : dynamicFields.identity_details?.pan_number || ''),
            salary_bank_name: formSource.salary_bank_name || formSource.salaryAccountBank || (isCoApplicant ? '' : dynamicFields.financial_details?.bank_name || ''),
            cibil_score: formSource.cibil_score || (isCoApplicant ? '' : dynamicFields.financial_details?.cibil_score || dynamicFields.cibil_score || ''),
            mobile_number: formSource.mobile_number || formSource.mobileNumber || (isCoApplicant ? '' : leadInfo.phone || ''),
            alternate_mobile: formSource.alternate_mobile || formSource.alternateNumber || (isCoApplicant ? '' : leadInfo.alternative_phone || ''),
            personal_email: formSource.personal_email || formSource.personalEmail || (isCoApplicant ? '' : leadInfo.email || ''),
            work_email: formSource.work_email || formSource.workEmail || '',
            product_type: formSource.product_type || (isCoApplicant ? '' : leadInfo.loan_type || ''),
            date_of_birth: formSource.date_of_birth || (isCoApplicant ? '' : dynamicFields.date_of_birth || ''),
            father_name: formSource.father_name || formSource.fathersName || '',
            mother_name: formSource.mother_name || formSource.mothersName || '',
            marital_status: formSource.marital_status || formSource.maritalStatus || (isCoApplicant ? '' : dynamicFields.marital_status || ''),
            current_address: formSource.current_address || formSource.currentAddress || (isCoApplicant ? '' : dynamicFields.address?.street || ''),
            current_landmark: formSource.current_landmark || formSource.currentAddressLandmark || '',
            current_address_type: formSource.current_address_type || formSource.currentAddressType || '',
            current_address_proof_type: formSource.current_address_proof_type || formSource.currentAddressProof || '',
            years_at_current_address: formSource.years_at_current_address || formSource.yearsAtCurrentAddress || '',
            years_in_current_city: formSource.years_in_current_city || formSource.yearsInCurrentCity || '',
            permanent_address: formSource.permanent_address || formSource.permanentAddress || '',
            permanent_landmark: formSource.permanent_landmark || formSource.permanentAddressLandmark || '',
            company_name: formSource.company_name || formSource.companyName || dynamicFields.personal_details?.employer_name || '',
            designation: formSource.designation || formSource.yourDesignation || '',
            department: formSource.department || formSource.yourDepartment || '',
            date_of_joining: formSource.date_of_joining || formSource.dojCurrentCompany || '',
            current_work_experience: formSource.current_work_experience || formSource.currentWorkExperience || dynamicFields.personal_details?.years_of_experience || '',
            total_work_experience: formSource.total_work_experience || formSource.totalWorkExperience || '',
            office_address: formSource.office_address || formSource.officeAddress || '',
            office_landmark: formSource.office_landmark || formSource.officeAddressLandmark || '',
            // Handle references - could be in either format
            references: formSource.references || [
                { 
                    name: formSource.ref1Name || '', 
                    mobile: formSource.ref1Mobile || '', 
                    relation: formSource.ref1Relation || '', 
                    address: formSource.ref1Address || '' 
                },
                { 
                    name: formSource.ref2Name || '', 
                    mobile: formSource.ref2Mobile || '', 
                    relation: formSource.ref2Relation || '', 
                    address: formSource.ref2Address || '' 
                }
            ]
        };
        
        console.log('✅ newFormData created with keys:', Object.keys(newFormData));
        console.log('✅ newFormData.reference_name:', newFormData.reference_name);
        console.log('✅ newFormData.aadhar_number:', newFormData.aadhar_number);
        console.log('✅ newFormData.pan_number:', newFormData.pan_number);
        console.log('✅ newFormData.mobile_number:', newFormData.mobile_number);
        console.log('✅ Full newFormData:', newFormData);
        console.log('✅ Setting formData state...');
        setFormData(newFormData);

        // Also update lastSavedData with the same mapping
        lastSavedData.current = { ...newFormData };

        const currentAddr = formSource.current_address || dynamicFields.address?.street || '';
        const permanentAddr = formSource.permanent_address || '';
        const currentLandmark = formSource.current_landmark || '';
        const permanentLandmark = formSource.permanent_landmark || '';

        if (currentAddr && permanentAddr && currentAddr === permanentAddr &&
            currentLandmark === permanentLandmark) {
            setIsPermanentSameAsCurrent(true);
        }
    }, [
        leadInfo, 
        isCoApplicant, 
        // Use JSON.stringify to create a stable dependency that changes when data changes
        JSON.stringify(leadInfo?.dynamic_fields?.applicant_form || {}),
        JSON.stringify(leadInfo?.dynamic_fields?.co_applicant_form || {})
    ]);
    
    // Additional useEffect to log when leadData prop changes
    useEffect(() => {
        console.log('🔔 leadData/lead prop changed!');
        console.log('🔔 New leadData._id:', leadInfo._id);
        console.log('🔔 New applicant_form:', leadInfo?.dynamic_fields?.applicant_form);
        console.log('🔔 New co_applicant_form:', leadInfo?.dynamic_fields?.co_applicant_form);
    }, [leadData, lead]);
    
    // Additional useEffect to log formData state changes
    useEffect(() => {
        console.log('📊 formData state updated:', formData);
        console.log('📊 formData.reference_name:', formData.reference_name);
        console.log('📊 formData.aadhar_number:', formData.aadhar_number);
        console.log('📊 formData.pan_number:', formData.pan_number);
    }, [formData]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        if (isPermanentSameAsCurrent) {
            if (field === 'current_address') {
                setFormData(prev => ({
                    ...prev,
                    [field]: value,
                    permanent_address: value
                }));
            } else if (field === 'current_landmark') {
                setFormData(prev => ({
                    ...prev,
                    [field]: value,
                    permanent_landmark: value
                }));
            }
        }
    };

    const handleFieldBlur = async (field) => {
        console.log(`🔵 handleFieldBlur called for field: ${field}`);
        console.log(`🔵 Current value: ${formData[field]}`);
        console.log(`🔵 Last saved value: ${lastSavedData.current[field]}`);
        
        if (formData[field] === lastSavedData.current[field]) {
            console.log(`⏭️ Skipping save - value unchanged`);
            return;
        }
        
        console.log(`💾 Saving field: ${field} with value:`, formData[field]);
        setIsSaving(true);
        
        // Optimistically update lastSavedData immediately to prevent duplicate saves
        const previousValue = lastSavedData.current[field];
        lastSavedData.current = { ...formData };
        
        try {
            if (isCoApplicant) {
                console.log('📤 Saving co-applicant form data:', formData);
                // For co-applicant, update via parent component
                if (onUpdate) {
                    await onUpdate({
                        dynamic_fields: {
                            co_applicant_form: formData
                        }
                    });
                }
            } else {
                console.log('📤 Saving applicant form data:', formData);
                // For primary applicant, use parent update function
                if (onUpdate) {
                    const updatePayload = {
                        dynamic_fields: {
                            applicant_form: formData
                        }
                    };
                    console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));
                    await onUpdate(updatePayload);
                    console.log('✅ onUpdate completed - parent should refresh data now');
                }
            }
            
            console.log('✅ Save successful! Data updated in backend');
            setSaveMessage(`✅ ${isCoApplicant ? 'Co-Applicant' : 'Applicant'} form data saved`);
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('❌ Save failed:', error);
            // Revert optimistic update on error
            lastSavedData.current[field] = previousValue;
            setSaveMessage(`❌ Failed to update: ${error.message}`);
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReferenceChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            references: prev.references.map((ref, i) =>
                i === index ? { ...ref, [field]: value } : ref
            )
        }));
    };

    const handleReferenceBlur = () => {
        handleFieldBlur('references');
    };

    const addReference = () => {
        setFormData(prev => ({
            ...prev,
            references: [...prev.references, { name: '', mobile: '', relation: '', address: '' }]
        }));
        setTimeout(() => handleFieldBlur('references'), 0);
    };

    const removeReference = (index) => {
        if (formData.references.length > 2) {
            setFormData(prev => ({
                ...prev,
                references: prev.references.filter((_, i) => i !== index)
            }));
            setTimeout(() => handleFieldBlur('references'), 0);
        }
    };

    const handlePermanentSameAsCurrent = (checked) => {
        setIsPermanentSameAsCurrent(checked);

        if (checked) {
            setFormData(prev => ({
                ...prev,
                permanent_address: prev.current_address,
                permanent_landmark: prev.current_landmark
            }));
            setTimeout(() => handleFieldBlur('permanent_address'), 0);
        } else {
            setFormData(prev => ({
                ...prev,
                permanent_address: '',
                permanent_landmark: ''
            }));
            setTimeout(() => handleFieldBlur('permanent_address'), 0);
        }
    };

    const handleGenerateLink = async () => {
        setIsGeneratingLink(true);
        try {
            // Check if form_share is false (form already submitted)
            if (leadInfo?.form_share === false) {
                setSaveMessage('❌ Form already submitted. Contact support to request a new form.');
                setTimeout(() => setSaveMessage(''), 5000);
                return;
            }

            const userId = localStorage.getItem('userId') || '';
            const shareData = {
                lead_id: leadInfo._id,
                expires_in_days: linkOptions.expiresInDays,
                purpose: "public_form",
                recipient_email: linkOptions.recipientEmail || formData.personal_email || formData.work_email || leadInfo.email || null,
                base_url: `${window.location.protocol}//${window.location.host}`,
                allow_update: linkOptions.allowUpdate,
                one_time_use: linkOptions.oneTimeUse
            };
            const url = `/api/share-links/create?user_id=${userId}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shareData)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to generate share link: ${errorData.detail || response.statusText}`);
            }
            const result = await response.json();
            const shareUrl = result.url;
            if (shareUrl && navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    setSaveMessage('✅ Share link generated and copied to clipboard!');
                } catch {
                    setSaveMessage(`✅ Share link generated: ${shareUrl}`);
                }
            } else {
                setSaveMessage(`✅ Share link generated: ${shareUrl || 'Check console for details'}`);
            }
            if (shareUrl) {
                setGeneratedShareableLink(shareUrl);
                setLinkMetadata({
                    shareId: result.id,
                    generatedAt: new Date(result.created_at).toISOString(),
                    expiresAt: new Date(result.expires_at).toISOString(),
                    recipientEmail: shareData.recipient_email,
                    purpose: shareData.purpose,
                    allowUpdate: result.allow_edit,
                    oneTimeUse: shareData.one_time_use
                });
            }
            setTimeout(() => setSaveMessage(''), 5000);
            if (onGenerateShareableLink && typeof onGenerateShareableLink === 'function') {
                try {
                    await onGenerateShareableLink(result.url);
                } catch {}
            }
            return result.url;
        } catch (error) {
            setSaveMessage(`❌ Failed to generate share link: ${error.message}`);
            setTimeout(() => setSaveMessage(''), 5000);
            throw error;
        } finally {
            setIsGeneratingLink(false);
        }
    };

    // Color styles
    const labelClass = "block text-lg font-semibold mb-1";
    const labelStyle = { color: "#03b0f5", fontWeight: 600 };
    const inputClass = "w-full bg-white border border-gray-600 rounded px-3 py-2 text-green-600 font-semibold focus:outline-none focus:border-blue-500";
    const selectClass = inputClass;
    const textareaClass = inputClass;

    const qualificationOptions = [
        'High School', 'Intermediate', 'Graduate', 'Post Graduate', 'Diploma', 'ITI', 'Professional Course'
    ];
    const qualificationTypeOptions = [
        'Regular', 'Distance', 'Correspondence'
    ];
    const relationOptions = [
        'Father', 'Mother', 'Brother', 'Sister', 'Friend', 'Colleague', 'Relative', 'Neighbor'
    ];
    const addressTypeOptions = [
        'Own', 'Rented', 'Family', 'Company Provided'
    ];
    const addressProofOptions = [
        'Aadhar Card', 'Passport', 'Voter ID', 'Driving License', 'Utility Bill', 'Bank Statement'
    ];
    const productTypeOptions = [
        'Personal Loan', 'Home Loan', 'Business Loan', 'Car Loan', 'Education Loan', 'Credit Card'
    ];
    const maritalStatusOptions = [
        'Single', 'Married', 'Divorced', 'Widowed'
    ];
    
    // Auto-open the form section when it's a co-applicant form
    useEffect(() => {
        if (isCoApplicant && !open) {
            console.log("Auto-opening co-applicant form section");
            setOpen(true);
        }
    }, [isCoApplicant]);
    
    // Function to manually save the entire form at once
    const handleSaveForm = async () => {
        setIsSaving(true);
        try {
            const userId = localStorage.getItem('userId') || '';
            let response;
            
            if (isCoApplicant) {
                // For co-applicant form
                const url = `/api/leads/${leadInfo._id}?user_id=${userId}`;
                response = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        dynamic_fields: {
                            co_applicant_form: formData
                        }
                    })
                });
            } else {
                // For primary applicant form - use debounced API call to prevent excessive API calls
                const token = localStorage.getItem('token');
                await saveLoginFormDataToAPIDebounced(leadInfo._id, userId, formData, token);
                // No need to check response.ok as the debounced function handles errors
                response = { ok: true }; // Simulate successful response
            }
            
            if (!response.ok) {
                throw new Error(`Failed to save form data`);
            }
            
            lastSavedData.current = { ...formData };
            setSaveMessage(`✅ ${isCoApplicant ? 'Co-Applicant' : 'Applicant'} form saved successfully`);
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Error saving form:', error);
            setSaveMessage(`❌ Failed to save form: ${error.message}`);
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
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
                    <File className="w-6 h-6 mr-2" />
                    {isCoApplicant ? 'Co-Applicant Form' : 'Login Form'}
                </span>
                {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {open && (
                <div className="space-y-6">
                    {/* Header with Share button */}
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-[#03b0f5]">
                            {isCoApplicant ? 'Co-Applicant Form' : 'Login Form'}
                        </h2>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSaveForm}
                                disabled={isSaving}
                                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {isSaving ? 'Saving...' : 'Save Form'}
                            </button>
                            <button
                                onClick={handleGenerateLink}
                                disabled={isGeneratingLink}
                                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                {isGeneratingLink ? 'Generating...' : 'Generate Shareable Link'}
                            </button>
                        </div>
                    </div>

                    {/* Success/Error Message */}
                    {saveMessage && (
                        <div className={`p-3 rounded-md text-sm ${
                            saveMessage.includes('successfully') || saveMessage.includes('saved')
                                ? 'bg-green-900 border border-green-600 text-green-200'
                                : 'bg-red-900 border border-red-600 text-red-200'
                        }`}>
                            {saveMessage}
                        </div>
                    )}

                    {/* Generate Link Call-to-Action */}
                    {!shareableLink && !generatedShareableLink && (
                        <div className="bg-white  rounded-lg p-4 border">
                            <div className="text-center mb-4">
                                <div className="flex items-center justify-center mb-1">
                                    <Share2 className="w-6 h-6 mr-2 text-blue-400" />
                                    <h4 className="text-black text-lg font-medium">Share This Lead Form</h4>
                                </div>
                                <p className="text-gray-700 text-md mb-2">
                                    Generate a secure shareable link to allow others to view and update this lead form
                                </p>
                                <div className="flex items-center justify-center space-x-3">
                                    <button
                                        onClick={handleGenerateLink}
                                        disabled={isGeneratingLink}
                                        className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-white"
                                    >
                                        <Share2 className="w-4 h-4 mr-2" />
                                        {isGeneratingLink ? 'Generating Link...' : 'Generate Shareable Link'}
                                    </button>
                                    <button
                                        onClick={() => setShowAdvancedLinkOptions(!showAdvancedLinkOptions)}
                                        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm transition-colors text-white"
                                    >
                                        {showAdvancedLinkOptions ? 'Hide Options' : 'Advanced Options'}
                                    </button>
                                </div>
                            </div>
                            {showAdvancedLinkOptions && (
                                <div className="border-t border-gray-600 pt-4 space-y-3">
                                    <h5 className="text-gray-300 font-medium text-sm">Link Configuration</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <label className="block text-gray-300 mb-1">Expires in (days)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={linkOptions.expiresInDays}
                                                onChange={(e) => setLinkOptions(prev => ({
                                                    ...prev,
                                                    expiresInDays: parseInt(e.target.value) || 30
                                                }))}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-1">Recipient Email (optional)</label>
                                            <input
                                                type="email"
                                                value={linkOptions.recipientEmail}
                                                onChange={(e) => setLinkOptions(prev => ({
                                                    ...prev,
                                                    recipientEmail: e.target.value
                                                }))}
                                                placeholder={formData.personal_email || formData.work_email || leadInfo.email || "Enter email"}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        <label className="flex items-center space-x-2 text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={linkOptions.allowUpdate}
                                                onChange={(e) => setLinkOptions(prev => ({
                                                    ...prev,
                                                    allowUpdate: e.target.checked
                                                }))}
                                                className="rounded"
                                            />
                                            <span>Allow recipients to update the form</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={linkOptions.oneTimeUse}
                                                onChange={(e) => setLinkOptions(prev => ({
                                                    ...prev,
                                                    oneTimeUse: e.target.checked
                                                }))}
                                                className="rounded"
                                            />
                                            <span>One-time use only</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Enhanced Shareable Link Management */}
                    {(shareableLink || generatedShareableLink) && (
                        <div className="bg-gradient-to-r from-blue-900 to-purple-900 border border-blue-600 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-blue-200 font-semibold text-lg flex items-center">
                                    <Share2 className="w-5 h-5 mr-2" />
                                    Shareable Link Management
                                </h4>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleGenerateLink()}
                                        disabled={isGeneratingLink}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors disabled:opacity-50 text-white"
                                        title="Generate new link"
                                    >
                                        {isGeneratingLink ? 'Generating...' : 'Regenerate'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setGeneratedShareableLink('');
                                            setLinkMetadata(null);
                                        }}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors text-white"
                                        title="Clear current link"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={generatedShareableLink || shareableLink}
                                        readOnly
                                        className="flex-1 bg-blue-800 border border-blue-600 rounded px-3 py-2 text-blue-100 text-sm font-mono"
                                        placeholder="No link generated yet"
                                    />
                                    <button
                                        onClick={async () => {
                                            const linkToCopy = generatedShareableLink || shareableLink;
                                            try {
                                                await navigator.clipboard.writeText(linkToCopy);
                                                setSaveMessage('✅ Link copied to clipboard!');
                                                setTimeout(() => setSaveMessage(''), 3000);
                                            } catch {
                                                setSaveMessage('❌ Failed to copy link');
                                                setTimeout(() => setSaveMessage(''), 3000);
                                            }
                                        }}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors text-white text-sm font-medium"
                                        title="Copy link to clipboard"
                                        disabled={!generatedShareableLink && !shareableLink}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            const linkToOpen = generatedShareableLink || shareableLink;
                                            if (linkToOpen) {
                                                window.open(linkToOpen, '_blank', 'noopener,noreferrer');
                                            }
                                        }}
                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors text-white"
                                        disabled={!generatedShareableLink && !shareableLink}
                                        title="Open link in new tab"
                                    >
                                        Preview Link
                                    </button>
                                    <button
                                        onClick={() => {
                                            const linkToShare = generatedShareableLink || shareableLink;
                                            const leadName = `${leadInfo.first_name || ''} ${leadInfo.last_name || ''}`.trim();
                                            const subject = `Lead Form - ${leadName}`;
                                            const body = `Please fill out this lead form: ${linkToShare}`;
                                            const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                            window.location.href = mailtoLink;
                                        }}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-sm transition-colors text-white"
                                        disabled={!generatedShareableLink && !shareableLink}
                                        title="Share via email"
                                    >
                                        Email Link
                                    </button>
                                    <button
                                        onClick={() => {
                                            const linkToShare = generatedShareableLink || shareableLink;
                                            if (navigator.share) {
                                                navigator.share({
                                                    title: 'Lead Form Link',
                                                    text: 'Please fill out this lead form',
                                                    url: linkToShare
                                                }).catch(console.error);
                                            } else {
                                                navigator.clipboard.writeText(linkToShare);
                                                setSaveMessage('✅ Link copied for sharing!');
                                                setTimeout(() => setSaveMessage(''), 3000);
                                            }
                                        }}
                                        className="px-3 py-1 bg-pink-600 hover:bg-pink-700 rounded text-sm transition-colors text-white"
                                        disabled={!generatedShareableLink && !shareableLink}
                                        title="Share link"
                                    >
                                        Share
                                    </button>
                                    <button
                                        onClick={() => {
                                            const linkForQR = generatedShareableLink || shareableLink;
                                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(linkForQR)}`;
                                            window.open(qrUrl, '_blank', 'width=400,height=400');
                                        }}
                                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition-colors text-white"
                                        disabled={!generatedShareableLink && !shareableLink}
                                        title="Generate QR code"
                                    >
                                        QR Code
                                    </button>
                                </div>
                                <div className="text-xs text-blue-300 space-y-1 bg-blue-800 bg-opacity-30 rounded p-3">
                                    <p className="font-medium text-blue-200">Link Details:</p>
                                    {linkMetadata ? (
                                        <>
                                            <p>• Generated: {new Date(linkMetadata.generatedAt).toLocaleString()}</p>
                                            <p>• Expires: {new Date(linkMetadata.expiresAt).toLocaleString()}</p>
                                            <p>• Updates allowed: {linkMetadata.allowUpdate ? 'Yes' : 'No'}</p>
                                            <p>• One-time use: {linkMetadata.oneTimeUse ? 'Yes' : 'No'}</p>
                                            <p>• Link ID: {linkMetadata.shareId}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p>• Expires in {linkOptions.expiresInDays} days from generation</p>
                                            <p>• Recipients can {linkOptions.allowUpdate ? 'view and update' : 'only view'} lead information</p>
                                            <p>• Link can be used {linkOptions.oneTimeUse ? 'only once' : 'multiple times'}</p>
                                        </>
                                    )}
                                    {(linkOptions.recipientEmail || formData.personal_email || formData.work_email || leadInfo.email) && (
                                        <p>• Recipient: {linkOptions.recipientEmail || formData.personal_email || formData.work_email || leadInfo.email}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Applicant Details */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <h3 className="text-lg font-bold text-[#03b0f5] mb-4">Applicant Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass} style={labelStyle}>Reference Name (Used for Login Call)</label>
                                <input
                                    type="text"
                                    value={formData.reference_name}
                                    onChange={e => handleInputChange('reference_name', e.target.value)}
                                    onBlur={() => handleFieldBlur('reference_name')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Aadhar Number</label>
                                <input
                                    type="text"
                                    value={formData.aadhar_number}
                                    onChange={e => handleInputChange('aadhar_number', e.target.value)}
                                    onBlur={() => handleFieldBlur('aadhar_number')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Qualification</label>
                                <select
                                    value={formData.qualification}
                                    onChange={e => handleInputChange('qualification', e.target.value)}
                                    onBlur={() => handleFieldBlur('qualification')}
                                    className={selectClass}
                                >
                                    <option value="">Select Qualification</option>
                                    {qualificationOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Qualification Type</label>
                                <select
                                    value={formData.qualification_type}
                                    onChange={e => handleInputChange('qualification_type', e.target.value)}
                                    onBlur={() => handleFieldBlur('qualification_type')}
                                    className={selectClass}
                                >
                                    <option value="">Select Type</option>
                                    {qualificationTypeOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Customer Name (Not Editable)</label>
                                <div className="bg-white p-2 rounded border text-green-600 font-semibold">
                                    {formData.customer_name}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>PAN Card Number</label>
                                <input
                                    type="text"
                                    value={formData.pan_number}
                                    onChange={e => handleInputChange('pan_number', e.target.value)}
                                    onBlur={() => handleFieldBlur('pan_number')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>CIBIL Score</label>
                                <input
                                    type="text"
                                    value={formData.cibil_score}
                                    onChange={e => handleInputChange('cibil_score', e.target.value)}
                                    onBlur={() => handleFieldBlur('cibil_score')}
                                    className={inputClass}
                                    placeholder="Enter CIBIL Score (300-900)"
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Salary Account - Bank Name</label>
                                <input
                                    type="text"
                                    value={formData.salary_bank_name}
                                    onChange={e => handleInputChange('salary_bank_name', e.target.value)}
                                    onBlur={() => handleFieldBlur('salary_bank_name')}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-[#03b0f5] mb-4">Contact Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass} style={labelStyle}>Mobile Number (Not Editable)</label>
                                <div className="bg-white p-2 rounded border text-green-600 font-semibold">
                                    {formData.mobile_number}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Alternate Mobile Number (Not Editable)</label>
                                <div className="bg-white p-2 rounded border text-green-600 font-semibold">
                                    {formData.alternate_mobile || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Personal Email</label>
                                <input
                                    type="email"
                                    value={formData.personal_email}
                                    onChange={e => handleInputChange('personal_email', e.target.value)}
                                    onBlur={() => handleFieldBlur('personal_email')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Work Email</label>
                                <input
                                    type="email"
                                    value={formData.work_email}
                                    onChange={e => handleInputChange('work_email', e.target.value)}
                                    onBlur={() => handleFieldBlur('work_email')}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Product Selection */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-semibold text-[#03b0f5] mb-4">Product Selection</h3>
                        <div className="max-w-md">
                            <label className={labelClass} style={labelStyle}>Product Type</label>
                            <select
                                value={formData.product_type}
                                onChange={e => handleInputChange('product_type', e.target.value)}
                                onBlur={() => handleFieldBlur('product_type')}
                                className={selectClass}
                            >
                                <option value="">Select Product Type</option>
                                {productTypeOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-[#03b0f5] mb-4">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className={labelClass} style={labelStyle}>Date of Birth (DD-MM-YYYY)</label>
                                <input
                                    type="date"
                                    value={formData.date_of_birth}
                                    onChange={e => handleInputChange('date_of_birth', e.target.value)}
                                    onBlur={() => handleFieldBlur('date_of_birth')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Father's Name</label>
                                <input
                                    type="text"
                                    value={formData.father_name}
                                    onChange={e => handleInputChange('father_name', e.target.value)}
                                    onBlur={() => handleFieldBlur('father_name')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Mother's Name</label>
                                <input
                                    type="text"
                                    value={formData.mother_name}
                                    onChange={e => handleInputChange('mother_name', e.target.value)}
                                    onBlur={() => handleFieldBlur('mother_name')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Marital Status</label>
                                <select
                                    value={formData.marital_status}
                                    onChange={e => handleInputChange('marital_status', e.target.value)}
                                    onBlur={() => handleFieldBlur('marital_status')}
                                    className={selectClass}
                                >
                                    <option value="">Select Status</option>
                                    {maritalStatusOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Address Details - Current */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-[#03b0f5] mb-4">Current Address</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className={labelClass} style={labelStyle}>Current Address</label>
                                <textarea
                                    value={formData.current_address}
                                    onChange={e => handleInputChange('current_address', e.target.value)}
                                    onBlur={() => handleFieldBlur('current_address')}
                                    rows="3"
                                    className={textareaClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Landmark</label>
                                <input
                                    type="text"
                                    value={formData.current_landmark}
                                    onChange={e => handleInputChange('current_landmark', e.target.value)}
                                    onBlur={() => handleFieldBlur('current_landmark')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Address Type</label>
                                <select
                                    value={formData.current_address_type}
                                    onChange={e => handleInputChange('current_address_type', e.target.value)}
                                    onBlur={() => handleFieldBlur('current_address_type')}
                                    className={selectClass}
                                >
                                    <option value="">Select Type</option>
                                    {addressTypeOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Address Proof Type</label>
                                <select
                                    value={formData.current_address_proof_type}
                                    onChange={e => handleInputChange('current_address_proof_type', e.target.value)}
                                    onBlur={() => handleFieldBlur('current_address_proof_type')}
                                    className={selectClass}
                                >
                                    <option value="">Select Proof Type</option>
                                    {addressProofOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Years at Current Address</label>
                                <input
                                    type="number"
                                    value={formData.years_at_current_address}
                                    onChange={e => handleInputChange('years_at_current_address', e.target.value)}
                                    onBlur={() => handleFieldBlur('years_at_current_address')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Years in Current City</label>
                                <input
                                    type="number"
                                    value={formData.years_in_current_city}
                                    onChange={e => handleInputChange('years_in_current_city', e.target.value)}
                                    onBlur={() => handleFieldBlur('years_in_current_city')}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Details - Permanent */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-[#03b0f5]">Permanent Address</h3>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="permanentSameAsCurrent"
                                    checked={isPermanentSameAsCurrent}
                                    onChange={e => handlePermanentSameAsCurrent(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-white border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <label
                                    htmlFor="permanentSameAsCurrent"
                                    className="text-lg font-semibold text-black cursor-pointer"
                                >
                                    Same as current address
                                </label>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass} style={labelStyle}>Permanent Address</label>
                                <textarea
                                    value={formData.permanent_address}
                                    onChange={e => handleInputChange('permanent_address', e.target.value)}
                                    onBlur={() => handleFieldBlur('permanent_address')}
                                    disabled={isPermanentSameAsCurrent}
                                    rows="3"
                                    className={`${textareaClass} ${isPermanentSameAsCurrent ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-white'}`}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Landmark</label>
                                <input
                                    type="text"
                                    value={formData.permanent_landmark}
                                    onChange={e => handleInputChange('permanent_landmark', e.target.value)}
                                    onBlur={() => handleFieldBlur('permanent_landmark')}
                                    disabled={isPermanentSameAsCurrent}
                                    className={`${inputClass} ${isPermanentSameAsCurrent ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-white'}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Employment Information */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-[#03b0f5] mb-4">Employment Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass} style={labelStyle}>Company Name</label>
                                <input
                                    type="text"
                                    value={formData.company_name}
                                    onChange={e => handleInputChange('company_name', e.target.value)}
                                    onBlur={() => handleFieldBlur('company_name')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Your Designation</label>
                                <input
                                    type="text"
                                    value={formData.designation}
                                    onChange={e => handleInputChange('designation', e.target.value)}
                                    onBlur={() => handleFieldBlur('designation')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Your Department</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={e => handleInputChange('department', e.target.value)}
                                    onBlur={() => handleFieldBlur('department')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Date of Joining (DD-MM-YYYY)</label>
                                <input
                                    type="date"
                                    value={formData.date_of_joining}
                                    onChange={e => handleInputChange('date_of_joining', e.target.value)}
                                    onBlur={() => handleFieldBlur('date_of_joining')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Current Work Experience (Years)</label>
                                <input
                                    type="number"
                                    value={formData.current_work_experience}
                                    onChange={e => handleInputChange('current_work_experience', e.target.value)}
                                    onBlur={() => handleFieldBlur('current_work_experience')}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Total Work Experience (Years)</label>
                                <input
                                    type="number"
                                    value={formData.total_work_experience}
                                    onChange={e => handleInputChange('total_work_experience', e.target.value)}
                                    onBlur={() => handleFieldBlur('total_work_experience')}
                                    className={inputClass}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass} style={labelStyle}>Office Address</label>
                                <textarea
                                    value={formData.office_address}
                                    onChange={e => handleInputChange('office_address', e.target.value)}
                                    onBlur={() => handleFieldBlur('office_address')}
                                    rows="2"
                                    className={textareaClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass} style={labelStyle}>Office Address Landmark</label>
                                <input
                                    type="text"
                                    value={formData.office_landmark}
                                    onChange={e => handleInputChange('office_landmark', e.target.value)}
                                    onBlur={() => handleFieldBlur('office_landmark')}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* References */}
                    <div className="bg-white rounded-lg p-6 border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-[#03b0f5]">References</h3>
                            <button
                                onClick={addReference}
                                className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Reference
                            </button>
                        </div>
                        <div className="space-y-6">
                            {formData.references?.map((reference, index) => (
                                <div key={index} className="bg-white rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-green-600 font-medium">{index + 1}. Reference</h4>
                                        {formData.references.length > 2 && (
                                            <button
                                                onClick={() => removeReference(index)}
                                                className="p-1 text-red-500 hover:text-red-300 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass} style={labelStyle}>Reference Name</label>
                                            <input
                                                type="text"
                                                value={reference.name}
                                                onChange={e => handleReferenceChange(index, 'name', e.target.value)}
                                                onBlur={handleReferenceBlur}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass} style={labelStyle}>Reference Mobile Number</label>
                                            <input
                                                type="text"
                                                value={reference.mobile}
                                                onChange={e => handleReferenceChange(index, 'mobile', e.target.value)}
                                                onBlur={handleReferenceBlur}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass} style={labelStyle}>Reference Relation</label>
                                            <select
                                                value={reference.relation}
                                                onChange={e => handleReferenceChange(index, 'relation', e.target.value)}
                                                onBlur={handleReferenceBlur}
                                                className={selectClass}
                                            >
                                                <option value="">Select Relation</option>
                                                {relationOptions.map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass} style={labelStyle}>Reference Address</label>
                                            <textarea
                                                value={reference.address}
                                                onChange={e => handleReferenceChange(index, 'address', e.target.value)}
                                                onBlur={handleReferenceBlur}
                                                rows="2"
                                                className={textareaClass}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}