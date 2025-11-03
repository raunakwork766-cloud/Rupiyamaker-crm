import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { User, ChevronDown, FileText, MessageSquare, Paperclip, Activity, Settings } from 'lucide-react';
import hrmsService from '../services/hrmsService';
import EmployeeFormNew from './hrms/EmployeeFormNew';
import EmployeeRemarks from './employee-details/EmployeeRemarks';
import EmployeeAttachments from './sections/EmployeeAttachmentsNew';
import EmployeeActivity from './employee-details/EmployeeActivity';
import ProfileAvatar from './common/ProfileAvatar';
import usePostalLookup from '../hooks/usePostalLookup';
import { formatDateTime } from '../utils/dateUtils';
import { useCustomNotification } from './common/CustomNotification';
import FieldUpdateIndicator from './common/FieldUpdateIndicator';
import CustomSuccessPopup from './common/CustomSuccessPopup';
import { getUserPermissions, canEditEmployees } from '../utils/permissions';

const EmployeeDetails = ({ employee, onBack, onEmployeeUpdate }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [openSections, setOpenSections] = useState([0]);
    const [employeeData, setEmployeeData] = useState(employee);
    const [loading, setLoading] = useState(false);
    const [activityRefreshKey, setActivityRefreshKey] = useState(0);
    const [fieldUpdateStates, setFieldUpdateStates] = useState({});
    
    // Custom notification system
    const notification = useCustomNotification();
    
    // Custom success popup state
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successPopupData, setSuccessPopupData] = useState({
        employeeData: null,
        updatedFields: [],
        profileUpdated: false
    });

    // Ensure first tab is always active when component mounts
    useEffect(() => {
        setActiveTab(0);
        setOpenSections([0]);
    }, []);

    // Sync employeeData when employee prop changes
    useEffect(() => {
        console.log('🔄 Employee prop changed, syncing data:', employee);
        setEmployeeData(employee);
        // Always reset to first tab when a new employee is selected
        setActiveTab(0);
        setOpenSections([0]);
    }, [employee]);

    const detailSections = [
        {
            label: "EMPLOYEE FORM",
            icon: <span className="mr-1">📝</span>,
            getContent: () => [
                {
                    content: <EmployeeFormNew 
                        key={`employee-form-${employeeData._id}-${employeeData._refreshKey || Date.now()}`}
                        employee={employeeData} 
                        onFinish={handleEmployeeUpdate} 
                        disableSuccessModal={true}
                        onCancel={() => {
                            console.log('📝 EmployeeFormNew: Cancel clicked - navigating back to employees screen');
                            onBack(); // Navigate back to employees screen
                        }}
                        loading={loading}
                        inline={true} 
                    />
                }
            ]
        },
        {
            label: "REMARK",
            getContent: () => [
                {
                    content: (
                        <div className="p-6 bg-white rounded-xl shadow-2xl text-[1rem] text-gray-100 border-l-4 border-cyan-500/60">
                            <EmployeeRemarks employeeId={employeeData._id} />
                        </div>
                    ),
                },
            ],
        },
        {
            label: "ATTACHEMENT",
            getContent: () => [
                {
                    content: (
                        <div className="p-4 bg-white rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
                            <EmployeeAttachments 
                                key={`attachments-${employeeData._id}-${employeeData._refreshKey || Date.now()}`}
                                employee={employeeData} 
                            />
                        </div>
                    ),
                },
            ],
        },
        {
            label: "EMPLOYEE ACTIVITY",
            getContent: () => {
                const activityKey = `activity-${employeeData._id}-${activityRefreshKey}-${employeeData._refreshKey || Date.now()}`;
                console.log('🎯 EmployeeDetails: Rendering EmployeeActivity with key:', activityKey);
                console.log('🎯 EmployeeDetails: Employee refresh key:', employeeData._refreshKey);
                console.log('🎯 EmployeeDetails: Activity refresh key:', activityRefreshKey);
                return [
                    {
                        content: (
                            <div className="p-4 bg-white rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
                                <EmployeeActivity 
                                    key={activityKey}
                                    employeeId={employeeData._id}
                                    employeeData={employeeData}
                                    refreshTrigger={activityRefreshKey}
                                />
                            </div>
                        ),
                    },
                ];
            },
        }
    ];

    const handleEmployeeUpdate = async (updatedData, imageFile = null) => {
        console.log('🔥 ===== HANDLE EMPLOYEE UPDATE CALLED =====');
        console.log('🔄 EmployeeDetails: handleEmployeeUpdate called');
        console.log('🔄 EmployeeDetails: Updating employee with data:', updatedData);
        console.log('🔄 EmployeeDetails: Employee ID:', employeeData._id);
        console.log('🔄 EmployeeDetails: Image file:', imageFile);
        
        try {
            setLoading(true);
            console.log('🔄 EmployeeDetails: Loading state set to true');
            
            // Validate that we have an employee ID
            if (!employeeData._id) {
                console.error('❌ EmployeeDetails: No employee ID found');
                notification.error('Missing Employee ID', 'Employee ID is missing. Cannot update employee.');
                return;
            }
            
            // Initialize changed fields tracking at function level
            let changedFields = [];
            
            // Step 1: Update employee data using dictionary method
            console.log('🔄 EmployeeDetails: Step 1 - Updating employee data with dict method...');
            const updateResponse = await hrmsService.updateEmployeeDict(employeeData._id, updatedData);
            console.log('✅ EmployeeDetails: Employee data updated successfully:', updateResponse);
            
            // Step 1.5: Log employee activity for the update with detailed changes
            console.log('🔄 EmployeeDetails: Step 1.5 - Logging employee activity...');
            try {
                // Create a detailed description of what was changed
                const fieldLabels = {
                    first_name: 'First Name',
                    last_name: 'Last Name',
                    email: 'Email',
                    phone: 'Phone',
                    department: 'Department',
                    designation: 'Designation',
                    role: 'Role',
                    salary: 'Salary',
                    address: 'Address',
                    date_of_birth: 'Date of Birth',
                    date_of_joining: 'Date of Joining',
                    employee_id: 'Employee ID',
                    status: 'Status',
                    gender: 'Gender',
                    marital_status: 'Marital Status',
                    emergency_contact: 'Emergency Contact',
                    qualification: 'Qualification',
                    experience: 'Experience',
                    reporting_manager: 'Reporting Manager'
                };

                // Define sensitive fields that should not be logged
                const sensitiveFields = ['password', 'Password', 'PASSWORD', 'confirm_password', 'confirmPassword', 'new_password', 'old_password', 'current_password'];
                let passwordFieldsUpdated = false;

                // Compare updated data with original employee data to find changes
                const fieldChanges = {};
                Object.keys(updatedData).forEach(key => {
                    // Check if this is a sensitive/password field
                    const isSensitiveField = sensitiveFields.some(sensitiveField => 
                        key.toLowerCase().includes(sensitiveField.toLowerCase()) || 
                        key === sensitiveField
                    );

                    if (isSensitiveField) {
                        console.log(`🔒 EmployeeDetails: Skipping sensitive field "${key}" from activity log`);
                        // Track that password fields were updated without logging values
                        if (updatedData[key] !== employeeData[key]) {
                            passwordFieldsUpdated = true;
                        }
                        return;
                    }

                    // Compare values (handle null, undefined, empty string cases)
                    const oldValue = employeeData[key];
                    const newValue = updatedData[key];
                    
                    // Only track actual changes (not just undefined vs empty string)
                    if (String(oldValue || '') !== String(newValue || '')) {
                        const fieldName = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        const displayOldValue = oldValue || 'Not set';
                        const displayNewValue = newValue || 'Cleared';
                        
                        // Add to simple changes array for description
                        changedFields.push(`${fieldName}: "${displayOldValue}" → "${displayNewValue}"`);
                        
                        // Add to detailed field_changes object for EmployeeActivity component
                        fieldChanges[key] = {
                            label: fieldName,
                            from: displayOldValue,
                            to: displayNewValue
                        };
                    }
                });

                // Add a secure notification if password fields were updated
                if (passwordFieldsUpdated) {
                    changedFields.push('Password/Security fields: Updated (details hidden for security)');
                    fieldChanges['security_fields'] = {
                        label: 'Security Fields',
                        from: 'Previous values',
                        to: 'Updated (hidden for security)'
                    };
                }

                const description = changedFields.length > 0 
                    ? `Employee profile updated. Changes: ${changedFields.join('; ')}`
                    : 'Employee profile updated (no field changes detected)';

                const activityData = {
                    action: 'profile_updated',
                    description: description,
                    timestamp: new Date().toISOString(),
                    details: {
                        field_changes: fieldChanges,
                        changes: changedFields,
                        updated_fields: Object.keys(updatedData),
                        total_changes: changedFields.length,
                        total_fields_changed: Object.keys(fieldChanges).length
                    }
                };
                
                await hrmsService.logEmployeeActivity(employeeData._id, activityData);
                console.log('✅ EmployeeDetails: Employee activity logged successfully with details:', activityData);
            } catch (activityError) {
                console.warn('⚠️ EmployeeDetails: Failed to log employee activity:', activityError);
                // Don't fail the update if activity logging fails
            }
            
            // Step 2: Upload profile picture if provided
            if (imageFile) {
                console.log('🔄 EmployeeDetails: Step 2 - Uploading profile picture...');
                const photoResponse = await hrmsService.uploadEmployeePhoto(employeeData._id, imageFile);
                console.log('✅ EmployeeDetails: Profile picture uploaded successfully:', photoResponse);
            }
            
            // Step 3: Try to fetch the complete updated employee data from the server
            console.log('🔄 EmployeeDetails: Step 3 - Fetching updated employee data from server...');
            
            // Wait a moment to ensure backend processing is complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            let freshEmployeeData;
            try {
                const fetchResponse = await hrmsService.getEmployeeById(employeeData._id);
                console.log('✅ EmployeeDetails: Fresh employee data fetched:', fetchResponse);
                
                if (fetchResponse && fetchResponse.data) {
                    // Use fresh data from server
                    freshEmployeeData = {...fetchResponse.data, _refreshKey: Date.now(), _lastUpdated: new Date().toISOString()};
                    console.log('🔄 EmployeeDetails: Using fresh data from server:', freshEmployeeData);
                } else {
                    // Fallback: merge updated data with existing employee data if server fetch fails
                    console.warn('⚠️ EmployeeDetails: Server refresh failed, merging updated data with existing data');
                    freshEmployeeData = {...employeeData, ...updatedData, _refreshKey: Date.now(), _lastUpdated: new Date().toISOString()};
                    console.log('🔄 EmployeeDetails: Using merged data as fallback:', freshEmployeeData);
                }
            } catch (fetchError) {
                console.warn('⚠️ EmployeeDetails: Error fetching fresh data, using merged data as fallback:', fetchError);
                // Fallback: merge updated data with existing employee data
                freshEmployeeData = {...employeeData, ...updatedData, _refreshKey: Date.now(), _lastUpdated: new Date().toISOString()};
                console.log('🔄 EmployeeDetails: Using merged data as fallback:', freshEmployeeData);
            }
            
            // Force a state update by ensuring the object reference changes
            setEmployeeData(() => freshEmployeeData);
            
            console.log('✅ EmployeeDetails: Local state updated with fresh server data and refresh key:', freshEmployeeData);
            console.log('✅ EmployeeDetails: Employee data object ID:', freshEmployeeData._id);
            console.log('✅ EmployeeDetails: Refresh key:', freshEmployeeData._refreshKey);
            
            // Show custom success popup instead of notification
            setSuccessPopupData({
                employeeData: freshEmployeeData,
                updatedFields: changedFields,
                profileUpdated: !!imageFile
            });
            setShowSuccessPopup(true);
            
            // Step 4: Force refresh of activity component with small delay to ensure activity was logged
            setTimeout(() => {
                setActivityRefreshKey(prev => {
                    const newKey = prev + 1;
                    console.log('🔄 EmployeeDetails: Activity refresh key incremented from', prev, 'to', newKey);
                    console.log('🔄 EmployeeDetails: This will force EmployeeActivity component to re-mount and fetch fresh data');
                    return newKey;
                });
            }, 1000); // 1 second delay to ensure backend activity logging is complete
            
            // Step 5: Don't show success message here - let EmployeeFormNew handle it
            console.log('🔄 EmployeeDetails: Step 5 - Update completed, letting EmployeeFormNew show success modal...');
            
            // Step 6: Notify parent component to refresh the employee table
            if (onEmployeeUpdate) {
                console.log('🔄 EmployeeDetails: Calling parent onEmployeeUpdate callback with fresh data:', freshEmployeeData);
                await onEmployeeUpdate(freshEmployeeData);
            }
            
            console.log('🎉 EmployeeDetails: Employee update completed successfully!');
            
            // Return the fresh employee data to indicate success
            return freshEmployeeData;
            
        } catch (error) {
            console.error('❌ EmployeeDetails: Error updating employee:', error);
            
            // Prepare detailed error message
            let errorTitle = 'Employee Update Failed';
            let errorMessage = 'An unknown error occurred while updating the employee.';
            let fieldErrors = [];
            
            if (error.response) {
                console.error('❌ EmployeeDetails: Error response status:', error.response.status);
                console.error('❌ EmployeeDetails: Error response data:', error.response.data);
                
                // Handle different error response structures
                if (error.response.data) {
                    const errorData = error.response.data;
                    
                    // Check for validation errors with field details
                    if (errorData.detail && Array.isArray(errorData.detail)) {
                        errorTitle = 'Validation Errors';
                        errorMessage = 'Please fix the following issues:';
                        fieldErrors = errorData.detail.map(err => {
                            if (err.loc && err.msg) {
                                const field = err.loc[err.loc.length - 1];
                                return `• ${field}: ${err.msg}`;
                            }
                            return `• ${err.msg || err}`;
                        });
                    }
                    // Check for simple error detail string
                    else if (errorData.detail && typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                    // Check for error message
                    else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                    // Check for error key
                    else if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                    // Handle FastAPI validation errors
                    else if (errorData.msg) {
                        errorMessage = errorData.msg;
                    }
                }
                
                // Add HTTP status context
                if (error.response.status === 400) {
                    errorTitle = 'Invalid Data';
                } else if (error.response.status === 401) {
                    errorTitle = 'Authentication Error';
                    errorMessage = 'Please log in again to continue.';
                } else if (error.response.status === 403) {
                    errorTitle = 'Permission Denied';
                    errorMessage = 'You do not have permission to update this employee.';
                } else if (error.response.status === 404) {
                    errorTitle = 'Employee Not Found';
                    errorMessage = 'The employee record could not be found.';
                } else if (error.response.status === 500) {
                    errorTitle = 'Server Error';
                    errorMessage = 'A server error occurred. Please try again later.';
                }
            } else if (error.request) {
                errorTitle = 'Network Error';
                errorMessage = 'Unable to connect to the server. Please check your internet connection.';
            } else {
                errorMessage = error.message || 'An unexpected error occurred.';
            }
            
            // Show detailed error notification
            const errorDetails = fieldErrors.length > 0 ? fieldErrors.join('\n') : null;
            notification.error(
                errorTitle, 
                errorMessage + (errorDetails ? `\n\nDetails:\n${errorDetails}` : ''),
                { autoClose: false, duration: 10000 }
            );
            
            // Also show a simple notification for quick reference
            const shortMessage = errorTitle + (fieldErrors.length > 0 ? ` (${fieldErrors.length} issues)` : '');
            console.log(`📝 Short error message: ${shortMessage}`);
            
            console.error('❌ EmployeeDetails: Detailed error information shown to user');
            throw error; // Re-throw to let EmployeeFormNew handle the error
        } finally {
            setLoading(false);
        }
    };

    const handleBackToTable = () => {
        onBack();
    };

    const activeTabSection = detailSections[activeTab];
    const sectionData = activeTabSection.getContent();

    return (
        <div className="min-h-screen bg-black text-white text-base">
            {/* Header */}
            <div className="flex items-center gap-3 px-2 sm:px-4 lg:px-6 py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg w-full">
                <button
                    onClick={handleBackToTable}
                    className="text-cyan-300 mr-2 px-2 py-1 text-xl font-bold rounded hover:bg-cyan-900/20 transition"
                    aria-label="Back"
                >
                    {"←"}
                </button>
                <ProfileAvatar 
                    employee={employeeData} 
                    size={40}
                    showFallback={true}
                    className="drop-shadow"
                />
                <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-cyan-300 tracking-wide drop-shadow">
                        {`${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim() || 'Employee Details'}
                    </h1>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center ${
                        employeeData.employee_status === 'active' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-500 text-white'
                    }`}>
                        {employeeData.employee_status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div className="flex-1"></div>
                <div className="text-sm text-cyan-200">
                    ID: {employeeData.employee_id || 'No ID'}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 px-2 sm:px-4 lg:px-7 py-3 bg-black border-b border-[#232c3a] w-full overflow-x-auto">
                {detailSections.map((tab, idx) => (
                    <button
                        key={tab.label}
                        className={`
                            flex items-center px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-3xl font-extrabold border shadow-md text-sm sm:text-base lg:text-[1.05rem] transition whitespace-nowrap
                            ${idx === activeTab
                                ? "bg-[#03B0F5] via-blue-700 to-cyan-500 text-white border-cyan-400 shadow-lg scale-105"
                                : "bg-white text-[#03B0F5] border-[#2D3C56] hover:bg-cyan-400/10 hover:text-cyan-400"
                            }
                            focus:outline-none
                        `}
                        style={{
                            boxShadow: idx === activeTab ? "0 4px 16px 0 #1cb5e080" : undefined,
                            cursor: "pointer",
                            letterSpacing: "0.01em"
                        }}
                        onClick={() => {
                            setActiveTab(idx);
                            // Auto-open first section when switching to EMPLOYEE DETAILS tab (index 0)
                            setOpenSections(idx === 0 ? [0] : []);
                        }}
                    >
                        {tab.icon || null}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Section Content */}
            <div className="px-2 sm:px-4 lg:px-6 py-6 w-full">
                <div className="p-2 sm:p-4 bg-white shadow-2xl w-full">
                    {sectionData.map((section, idx) => (
                        <div key={idx} className="mb-6 w-full">
                            {section.label && (
                                <>
                                    {activeTab === 0 ? (
                                        // Collapsible dropdown for EMPLOYEE DETAILS tab only
                                        <button
                                            className="w-full px-2 sm:px-5 py-3 font-extrabold text-base sm:text-lg lg:text-[1.05rem] text-[#03B0F5] bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-between transition-colors duration-200"
                                            onClick={() => {
                                                // Toggle section in the openSections array
                                                setOpenSections(prev => {
                                                    if (prev.includes(idx)) {
                                                        // Remove from array if already open
                                                        return prev.filter(sectionIdx => sectionIdx !== idx);
                                                    } else {
                                                        // Add to array if not open
                                                        return [...prev, idx];
                                                    }
                                                });
                                            }}
                                        >
                                            <span>{section.label}</span>
                                            <svg
                                                className={`w-5 h-5 transform transition-transform duration-200 ${openSections.includes(idx) ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    ) : (
                                        // Static header for other tabs
                                        <div className="px-2 sm:px-5 py-2 font-extrabold text-base sm:text-lg lg:text-[1.05rem] text-[#03B0F5]">
                                            {section.label}
                                        </div>
                                    )}
                                </>
                            )}
                            {activeTab === 0 ? (
                                // Conditional rendering for EMPLOYEE DETAILS tab only
                                openSections.includes(idx) && (
                                    <div className="rounded-xl border-2 border-cyan-400/40 shadow-inner bg-white w-full mt-2">
                                        {section.content}
                                    </div>
                                )
                            ) : (
                                // Always show content for other tabs
                                <div className="rounded-xl border-2 border-cyan-400/40 shadow-inner bg-white w-full">
                                    {section.content}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Custom Notification Container */}
            <notification.NotificationContainer />
            
            {/* Custom Success Popup */}
            <CustomSuccessPopup
                isVisible={showSuccessPopup}
                onClose={() => setShowSuccessPopup(false)}
                employeeData={successPopupData?.employeeData}
                updatedFields={successPopupData?.updatedFields || []}
                profileUpdated={successPopupData?.profileUpdated || false}
            />
        </div>
    );
};

// Address Information Section Component with Postal Code Lookup
const AddressInfoSection = ({ employee, onUpdate }) => {
    // Helper function to extract address fields with backwards compatibility
    const getAddressFields = (addressType) => {
        const addressObj = employee[`${addressType}_address`];
        
        if (addressObj && typeof addressObj === 'object') {
            // New structured format
            return {
                address: addressObj.address || '',
                city: addressObj.city || '',
                state: addressObj.state || '',
                pincode: addressObj.pincode || '',
                country: addressObj.country || 'India'
            };
        } else {
            // Legacy flat format - fallback to individual fields
            return {
                address: employee[`${addressType}_address`] || '',
                city: employee[`${addressType}_city`] || '',
                state: employee[`${addressType}_state`] || '',
                pincode: employee[`${addressType}_pincode`] || '',
                country: employee[`${addressType}_country`] || 'India'
            };
        }
    };

    const permanentFields = getAddressFields('permanent');
    const currentFields = getAddressFields('current');

    const [fields, setFields] = useState({
        permanent_address: permanentFields.address,
        permanent_city: permanentFields.city,
        permanent_state: permanentFields.state,
        permanent_pincode: permanentFields.pincode,
        permanent_country: permanentFields.country,
        current_address: currentFields.address,
        current_city: currentFields.city,
        current_state: currentFields.state,
        current_pincode: currentFields.pincode,
        current_country: currentFields.country,
        same_as_permanent: employee.same_as_permanent || false
    });

    const { lookupPincode, loading: postalLoading } = usePostalLookup();

    // Update local state if the employee prop changes from parent
    useEffect(() => {
        const newPermanentFields = getAddressFields('permanent');
        const newCurrentFields = getAddressFields('current');
        
        const newFields = {
            permanent_address: newPermanentFields.address,
            permanent_city: newPermanentFields.city,
            permanent_state: newPermanentFields.state,
            permanent_pincode: newPermanentFields.pincode,
            permanent_country: newPermanentFields.country,
            current_address: newCurrentFields.address,
            current_city: newCurrentFields.city,
            current_state: newCurrentFields.state,
            current_pincode: newCurrentFields.pincode,
            current_country: newCurrentFields.country,
            same_as_permanent: employee.same_as_permanent || false
        };

        const hasChanges = Object.keys(newFields).some(key => newFields[key] !== fields[key]);
        if (hasChanges) {
            setFields(newFields);
        }
    }, [employee]);

    const handleChange = (field, value) => {
        setFields(prev => {
            const updated = { ...prev, [field]: value };
            
            // If same_as_permanent is checked, copy permanent address to current
            if (field === 'same_as_permanent' && value) {
                updated.current_address = prev.permanent_address;
                updated.current_city = prev.permanent_city;
                updated.current_state = prev.permanent_state;
                updated.current_pincode = prev.permanent_pincode;
                updated.current_country = prev.permanent_country;
            }
            
            return updated;
        });
    };

    const handleBlur = async (field, value) => {
        if (value !== employee[field]) {
            try {
                // For address fields, structure them properly for the backend
                let updateData;
                
                if (field.startsWith('permanent_')) {
                    // Build permanent address object
                    const addressField = field.replace('permanent_', '');
                    const currentPermanentAddress = employee.permanent_address || {};
                    
                    updateData = {
                        permanent_address: {
                            ...currentPermanentAddress,
                            [addressField === 'address' ? 'address' : addressField]: value,
                            address_type: 'permanent'
                        }
                    };
                } else if (field.startsWith('current_')) {
                    // Build current address object
                    const addressField = field.replace('current_', '');
                    const currentCurrentAddress = employee.current_address || {};
                    
                    updateData = {
                        current_address: {
                            ...currentCurrentAddress,
                            [addressField === 'address' ? 'address' : addressField]: value,
                            address_type: 'current'
                        }
                    };
                } else {
                    // For non-address fields, send as is
                    updateData = { [field]: value };
                }
                
                await onUpdate(updateData);
            } catch (error) {
                console.error(`Error updating ${field}:`, error);
                setFields(prev => ({
                    ...prev,
                    [field]: employee[field] || ''
                }));
            }
        }
    };

    const handlePincodeChange = async (type, pincode) => {
        handleChange(`${type}_pincode`, pincode);
        
        if (pincode && pincode.length === 6) {
            try {
                const result = await lookupPincode(pincode);
                if (result) {
                    setFields(prev => ({
                        ...prev,
                        [`${type}_city`]: result.city,
                        [`${type}_state`]: result.state,
                        [`${type}_country`]: result.country
                    }));
                    
                    // Update the employee data
                    await onUpdate({
                        [`${type}_city`]: result.city,
                        [`${type}_state`]: result.state,
                        [`${type}_country`]: result.country
                    });
                }
            } catch (error) {
                console.error('Error looking up pincode:', error);
            }
        }
    };

    return (
        <div className="p-6 bg-white">
            <div className="space-y-8">
                {/* Permanent Address */}
                <div>
                    <h3 className="text-xl font-bold text-[#03b0f5] mb-4">Permanent Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
                            <div className="text-lg text-[#03b0f5] font-bold">ADDRESS</div>
                            <textarea
                                rows={3}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.permanent_address}
                                onChange={e => handleChange("permanent_address", e.target.value)}
                                onBlur={e => handleBlur("permanent_address", e.target.value)}
                                placeholder="Enter permanent address"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">PIN CODE</div>
                            <input
                                type="text"
                                maxLength={6}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.permanent_pincode}
                                onChange={e => handlePincodeChange("permanent", e.target.value)}
                                onBlur={e => handleBlur("permanent_pincode", e.target.value)}
                                placeholder="Enter pin code"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">CITY</div>
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.permanent_city}
                                onChange={e => handleChange("permanent_city", e.target.value)}
                                onBlur={e => handleBlur("permanent_city", e.target.value)}
                                placeholder="Enter city"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">STATE</div>
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.permanent_state}
                                onChange={e => handleChange("permanent_state", e.target.value)}
                                onBlur={e => handleBlur("permanent_state", e.target.value)}
                                placeholder="Enter state"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">COUNTRY</div>
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.permanent_country}
                                onChange={e => handleChange("permanent_country", e.target.value)}
                                onBlur={e => handleBlur("permanent_country", e.target.value)}
                                placeholder="Enter country"
                            />
                        </div>
                    </div>
                </div>

                {/* Current Address */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-[#03b0f5]">Current Address</h3>
                        <label className="flex items-center gap-2 text-[#03b0f5] font-medium">
                            <input
                                type="checkbox"
                                checked={fields.same_as_permanent}
                                onChange={e => handleChange("same_as_permanent", e.target.checked)}
                                className="w-4 h-4 text-[#03b0f5] border-2 border-[#03b0f5] rounded focus:ring-[#03b0f5]"
                            />
                            Same as Permanent Address
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
                            <div className="text-lg text-[#03b0f5] font-bold">ADDRESS</div>
                            <textarea
                                rows={3}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.current_address}
                                onChange={e => handleChange("current_address", e.target.value)}
                                onBlur={e => handleBlur("current_address", e.target.value)}
                                placeholder="Enter current address"
                                disabled={fields.same_as_permanent}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">PIN CODE</div>
                            <input
                                type="text"
                                maxLength={6}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.current_pincode}
                                onChange={e => handlePincodeChange("current", e.target.value)}
                                onBlur={e => handleBlur("current_pincode", e.target.value)}
                                placeholder="Enter pin code"
                                disabled={fields.same_as_permanent}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">CITY</div>
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.current_city}
                                onChange={e => handleChange("current_city", e.target.value)}
                                onBlur={e => handleBlur("current_city", e.target.value)}
                                placeholder="Enter city"
                                disabled={fields.same_as_permanent}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">STATE</div>
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.current_state}
                                onChange={e => handleChange("current_state", e.target.value)}
                                onBlur={e => handleBlur("current_state", e.target.value)}
                                placeholder="Enter state"
                                disabled={fields.same_as_permanent}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-lg text-[#03b0f5] font-bold">COUNTRY</div>
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                value={fields.current_country}
                                onChange={e => handleChange("current_country", e.target.value)}
                                onBlur={e => handleBlur("current_country", e.target.value)}
                                placeholder="Enter country"
                                disabled={fields.same_as_permanent}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Personal Information Section Component
const PersonalInfoSection = ({ employee, onUpdate }) => {
    const [fields, setFields] = useState({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || '',
        marital_status: employee.marital_status || '',
        nationality: employee.nationality || '',
        blood_group: employee.blood_group || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || ''
    });

    const [fieldStates, setFieldStates] = useState({});
    const notification = useCustomNotification();

    // Update local state if the employee prop changes from parent
    // But only if the values are actually different to avoid overriding user edits
    useEffect(() => {
        console.log('🔄 PersonalInfo: Employee prop changed, checking for updates');
        const newFields = {
            first_name: employee.first_name || '',
            last_name: employee.last_name || '',
            date_of_birth: employee.date_of_birth || '',
            gender: employee.gender || '',
            marital_status: employee.marital_status || '',
            nationality: employee.nationality || '',
            blood_group: employee.blood_group || '',
            emergency_contact_name: employee.emergency_contact_name || '',
            emergency_contact_phone: employee.emergency_contact_phone || ''
        };

        // Only update if there are actual differences to avoid overriding user input
        const hasChanges = Object.keys(newFields).some(key => newFields[key] !== fields[key]);
        if (hasChanges) {
            console.log('🔄 PersonalInfo: Updating fields with new employee data');
            setFields(newFields);
        } else {
            console.log('ℹ️ PersonalInfo: No changes detected, keeping current field values');
        }
    }, [employee]);

    const handleChange = (field, value) => {
        setFields(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleBlur = async (field, value) => {
        console.log(`🎯 PersonalInfo: onBlur - field: ${field}, value: ${value}, original: ${employee[field]}`);
        if (value !== employee[field]) {
            console.log(`📤 PersonalInfo: Saving change for ${field}: ${employee[field]} → ${value}`);
            
            // Set updating state
            setFieldStates(prev => ({ ...prev, [field]: { updating: true, success: null, error: null } }));
            
            try {
                // Convert date strings to ISO format if needed
                let processedValue = value;
                if (field === 'date_of_birth' && value) {
                    // Ensure date is in ISO format
                    processedValue = new Date(value).toISOString().split('T')[0];
                }
                
                await onUpdate({ [field]: processedValue });
                console.log(`✅ PersonalInfo: Successfully updated ${field}`);
                
                // Set success state
                setFieldStates(prev => ({ ...prev, [field]: { updating: false, success: true, error: null } }));
                
                // Show success notification
                const fieldName = field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                notification.success('Field Updated', `${fieldName} updated successfully`);
                
                // Clear success state after 3 seconds
                setTimeout(() => {
                    setFieldStates(prev => ({ ...prev, [field]: { updating: false, success: null, error: null } }));
                }, 3000);
                
            } catch (error) {
                console.error(`❌ PersonalInfo: Error updating ${field}:`, error);
                
                // Set error state
                setFieldStates(prev => ({ ...prev, [field]: { updating: false, success: null, error: error.message } }));
                
                // Show error notification
                const fieldName = field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                notification.error('Update Failed', `Failed to update ${fieldName}. Please try again.`);
                
                // Revert on error
                setFields(prev => ({
                    ...prev,
                    [field]: employee[field] || ''
                }));
                
                // Clear error state after 5 seconds
                setTimeout(() => {
                    setFieldStates(prev => ({ ...prev, [field]: { updating: false, success: null, error: null } }));
                }, 5000);
            }
        } else {
            console.log(`ℹ️ PersonalInfo: No change for ${field}, skipping save`);
        }
    };

    return (
        <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">FIRST NAME</div>
                    <div className="relative">
                        <input
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.first_name}
                            onChange={e => handleChange("first_name", e.target.value)}
                            onBlur={e => handleBlur("first_name", e.target.value)}
                        />
                        <FieldUpdateIndicator
                            fieldName="first_name"
                            isUpdating={fieldStates.first_name?.updating}
                            updateSuccess={fieldStates.first_name?.success}
                            updateError={fieldStates.first_name?.error}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">LAST NAME</div>
                    <div className="relative">
                        <input
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.last_name}
                            onChange={e => handleChange("last_name", e.target.value)}
                            onBlur={e => handleBlur("last_name", e.target.value)}
                        />
                        <FieldUpdateIndicator
                            fieldName="last_name"
                            isUpdating={fieldStates.last_name?.updating}
                            updateSuccess={fieldStates.last_name?.success}
                            updateError={fieldStates.last_name?.error}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">DATE OF BIRTH</div>
                    <input
                        type="date"
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.date_of_birth}
                        onChange={e => handleChange("date_of_birth", e.target.value)}
                        onBlur={e => handleBlur("date_of_birth", e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">GENDER</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.gender}
                        onChange={e => handleChange("gender", e.target.value)}
                        onBlur={e => handleBlur("gender", e.target.value)}
                    >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">MARITAL STATUS</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.marital_status}
                        onChange={e => handleChange("marital_status", e.target.value)}
                        onBlur={e => handleBlur("marital_status", e.target.value)}
                    >
                        <option value="">Select Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">NATIONALITY</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.nationality}
                        onChange={e => handleChange("nationality", e.target.value)}
                        onBlur={e => handleBlur("nationality", e.target.value)}
                        placeholder="Enter nationality"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">BLOOD GROUP</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.blood_group}
                        onChange={e => handleChange("blood_group", e.target.value)}
                        onBlur={e => handleBlur("blood_group", e.target.value)}
                    >
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">EMERGENCY CONTACT NAME</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.emergency_contact_name}
                        onChange={e => handleChange("emergency_contact_name", e.target.value)}
                        onBlur={e => handleBlur("emergency_contact_name", e.target.value)}
                        placeholder="Enter emergency contact name"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">EMERGENCY CONTACT PHONE</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.emergency_contact_phone}
                        onChange={e => handleChange("emergency_contact_phone", e.target.value)}
                        onBlur={e => handleBlur("emergency_contact_phone", e.target.value)}
                        placeholder="Enter emergency contact phone"
                    />
                </div>
            </div>
            
            {/* Notification Container for Personal Info */}
            <notification.NotificationContainer />
        </div>
    );
};

// Employment Details Section Component
const EmploymentDetailsSection = ({ employee, onUpdate }) => {
    // Check if user has permission to edit employees
    const userPermissions = getUserPermissions();
    const hasEditPermission = canEditEmployees(userPermissions);
    
    const [fields, setFields] = useState({
        employee_id: employee.employee_id || '',
        joining_date: employee.joining_date || '',
        designation: employee.designation || '',
        designation_id: employee.designation_id || '',
        department_id: employee.department_id || '',
        department_name: employee.department_name || '',
        role_id: employee.role_id || '',
        role_name: employee.role_name || '',
        employee_status: employee.employee_status || '',
        salary: employee.salary || '',
        work_location: employee.work_location || '',
        mac_addresses: employee.mac_addresses || employee.mac_address ? 
            (Array.isArray(employee.mac_addresses) ? employee.mac_addresses : [employee.mac_address]) : []
    });

    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(false);
    const [loadingDesignations, setLoadingDesignations] = useState(false);
    const [newMacAddress, setNewMacAddress] = useState('');

    // Fetch roles and departments on component mount
    useEffect(() => {
        const fetchRolesAndDepartments = async () => {
            try {
                console.log('🚀 Starting to fetch roles, departments, and designations...');
                setLoadingRoles(true);
                setLoadingDepartments(true);
                setLoadingDesignations(true);
                
                // Test individual API calls first
                console.log('🔄 Testing individual API calls...');
                
                try {
                    const testRoles = await hrmsService.getRoles();
                    console.log('✅ Individual roles call successful:', testRoles);
                } catch (error) {
                    console.error('❌ Individual roles call failed:', error);
                }
                
                try {
                    const testDepartments = await hrmsService.getDepartments();
                    console.log('✅ Individual departments call successful:', testDepartments);
                } catch (error) {
                    console.error('❌ Individual departments call failed:', error);
                }
                
                try {
                    const testDesignations = await hrmsService.getDesignations();
                    console.log('✅ Individual designations call successful:', testDesignations);
                } catch (error) {
                    console.error('❌ Individual designations call failed:', error);
                }
                
                const [rolesResult, departmentsResult, designationsResult] = await Promise.all([
                    hrmsService.getRoles(),
                    hrmsService.getDepartments(),
                    hrmsService.getDesignations()
                ]);
                
                console.log('📊 Raw roles result:', rolesResult);
                console.log('📊 Raw departments result:', departmentsResult);
                console.log('📊 Raw designations result:', designationsResult);
                
                // Extract roles from nested response structure
                let rolesData = [];
                if (rolesResult && rolesResult.data) {
                    if (Array.isArray(rolesResult.data)) {
                        rolesData = rolesResult.data;
                    } else if (rolesResult.data.roles && Array.isArray(rolesResult.data.roles)) {
                        rolesData = rolesResult.data.roles;
                    }
                } else if (Array.isArray(rolesResult)) {
                    rolesData = rolesResult;
                }
                
                // Extract departments from nested response structure  
                let departmentsData = [];
                if (departmentsResult && departmentsResult.data) {
                    if (Array.isArray(departmentsResult.data)) {
                        departmentsData = departmentsResult.data;
                    } else if (departmentsResult.data.departments && Array.isArray(departmentsResult.data.departments)) {
                        departmentsData = departmentsResult.data.departments;
                    }
                } else if (Array.isArray(departmentsResult)) {
                    departmentsData = departmentsResult;
                }

                // Extract designations from nested response structure  
                let designationsData = [];
                if (designationsResult && designationsResult.data) {
                    if (Array.isArray(designationsResult.data)) {
                        designationsData = designationsResult.data;
                    } else if (designationsResult.data.designations && Array.isArray(designationsResult.data.designations)) {
                        designationsData = designationsResult.data.designations;
                    }
                } else if (Array.isArray(designationsResult)) {
                    designationsData = designationsResult;
                }
                
                console.log('🔍 Processed roles data:', rolesData);
                console.log('🔍 Processed departments data:', departmentsData);
                console.log('🔍 Processed designations data:', designationsData);
                console.log('🔍 Final roles state will be set to:', rolesData);
                console.log('🔍 Final departments state will be set to:', departmentsData);
                console.log('🔍 Final designations state will be set to:', designationsData);
                
                setRoles(rolesData);
                setDepartments(departmentsData);
                setDesignations(designationsData);
                
                console.log('✅ State updated - roles length:', rolesData.length);
                console.log('✅ State updated - departments length:', departmentsData.length);
                console.log('✅ State updated - designations length:', designationsData.length);
                
                if (departmentsData.length === 0) {
                    console.warn('⚠️ No departments loaded - this may indicate an API issue');
                   
                }
                if (designationsData.length === 0) {
                    console.warn('⚠️ No designations loaded - this may indicate an API issue');
                    
                }
                if (rolesData.length > 0 || departmentsData.length > 0 || designationsData.length > 0) {
                    console.log(`✅ Successfully loaded ${rolesData.length} roles, ${departmentsData.length} departments, and ${designationsData.length} designations`);
                }
                
            } catch (error) {
                console.error('❌ Error fetching roles, departments, and designations:', error);
                message.error('Failed to load roles, departments, and designations. Please refresh the page or contact support.');
                // Set empty arrays on error to prevent map errors
                setRoles([]);
                setDepartments([]);
                setDesignations([]);
            } finally {
                setLoadingRoles(false);
                setLoadingDepartments(false);
                setLoadingDesignations(false);
                console.log('🏁 Finished loading roles, departments, and designations');
            }
        };

        fetchRolesAndDepartments();
    }, []);

    // Update local state if the employee prop changes from parent
    // But only if the values are actually different to avoid overriding user edits
    useEffect(() => {
        console.log('🔄 EmploymentDetails: Employee prop changed, checking for updates');
        const newFields = {
            employee_id: employee.employee_id || '',
            joining_date: employee.joining_date || '',
            designation: employee.designation || '',
            designation_id: employee.designation_id || '',
            department_id: employee.department_id || '',
            department_name: employee.department_name || '',
            role_id: employee.role_id || '',
            role_name: employee.role_name || '',
            employee_status: employee.employee_status || '',
            salary: employee.salary || '',
            work_location: employee.work_location || '',
            mac_addresses: employee.mac_addresses || employee.mac_address ? 
                (Array.isArray(employee.mac_addresses) ? employee.mac_addresses : [employee.mac_address]) : []
        };

        // Only update if there are actual differences to avoid overriding user input
        const hasChanges = Object.keys(newFields).some(key => newFields[key] !== fields[key]);
        if (hasChanges) {
            console.log('🔄 EmploymentDetails: Updating fields with new employee data');
            setFields(newFields);
        } else {
            console.log('ℹ️ EmploymentDetails: No changes detected, keeping current field values');
        }
    }, [employee]);

    const handleChange = (field, value) => {
        setFields(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleRoleChange = async (roleId) => {
        console.log('👤 Role change initiated:', roleId);
        
        const selectedRole = Array.isArray(roles) ? roles.find(role => (role._id || role.id) === roleId) : null;
        const roleName = selectedRole ? (selectedRole.name || selectedRole.role_name || '') : '';
        
        console.log('👤 Selected role:', selectedRole);
        console.log('👤 Role name:', roleName);
        
        setFields(prev => ({
            ...prev,
            role_id: roleId,
            role_name: roleName
        }));

        try {
            console.log('👤 Updating role in backend...');
            await onUpdate({ 
                role_id: roleId,
                role_name: roleName
            });
            console.log('✅ Role updated successfully');
            notification.success('Role Updated', `Role changed to ${roleName}`);
        } catch (error) {
            console.error('❌ Error updating role:', error);
            notification.error('Update Failed', 'Failed to update role. Please try again.');
            setFields(prev => ({
                ...prev,
                role_id: employee.role_id || '',
                role_name: employee.role_name || ''
            }));
        }
    };

    const handleDepartmentChange = async (departmentId) => {
        console.log('🏢 Department change initiated:', departmentId);
        
        const selectedDepartment = Array.isArray(departments) ? departments.find(dept => (dept._id || dept.id) === departmentId) : null;
        const departmentName = selectedDepartment ? (selectedDepartment.name || selectedDepartment.department_name || '') : '';
        
        console.log('🏢 Selected department:', selectedDepartment);
        console.log('🏢 Department name:', departmentName);
        
        setFields(prev => ({
            ...prev,
            department_id: departmentId,
            department_name: departmentName
        }));

        try {
            console.log('🏢 Updating department in backend...');
            await onUpdate({ 
                department_id: departmentId,
                department_name: departmentName
            });
            console.log('✅ Department updated successfully');
            notification.success('Department Updated', `Department changed to ${departmentName}`);
        } catch (error) {
            console.error('❌ Error updating department:', error);
            notification.error('Update Failed', 'Failed to update department. Please try again.');
            setFields(prev => ({
                ...prev,
                department_id: employee.department_id || '',
                department_name: employee.department_name || ''
            }));
        }
    };

    const handleDesignationChange = async (designationId) => {
        console.log('💼 Designation change initiated:', designationId);
        
        // Handle custom designation selection
        if (designationId === '__CUSTOM__') {
            setFields(prev => ({
                ...prev,
                designation: '__CUSTOM__',
                designation_id: ''
            }));
            return; // Don't save to backend yet, wait for custom input
        }
        
        // Find the selected designation from our list
        const selectedDesignation = designations.find(d => (d._id || d.id) === designationId);
        console.log('Selected designation:', selectedDesignation);
        
        if (selectedDesignation) {
            setFields(prev => ({
                ...prev,
                designation: selectedDesignation.name,
                designation_id: designationId
            }));
    
            try {
                console.log('💼 Updating designation in backend...');
                await onUpdate({ 
                    designation: selectedDesignation.name,
                    designation_id: designationId
                });
                console.log('✅ Designation updated successfully');
                notification.success('Designation Updated', `Designation changed to ${selectedDesignation.name}`);
            } catch (error) {
                console.error('❌ Error updating designation:', error);
                notification.error('Update Failed', 'Failed to update designation. Please try again.');
                setFields(prev => ({
                    ...prev,
                    designation: employee.designation || '',
                    designation_id: employee.designation_id || ''
                }));
            }
        } else {
            console.error('❌ Selected designation not found in list');
            notification.error('Invalid Selection', 'Selected designation not found. Please refresh and try again.');
        }
    };
    
    // Handle custom designation entry
    const handleCustomDesignationSubmit = async (designationName) => {
        if (!designationName.trim()) return;
        
        try {
            console.log('💼 Creating custom designation:', designationName);
            
            // Just update the employee record with the custom designation text
            await onUpdate({ 
                designation: designationName,
                designation_id: '' // Clear any previous designation ID
            });
            
            setFields(prev => ({
                ...prev,
                designation: designationName,
                designation_id: ''
            }));
            
            console.log('✅ Custom designation set successfully');
            notification.success('Custom Designation Set', `Designation set to "${designationName}"`);
        } catch (error) {
            console.error('❌ Error setting custom designation:', error);
            notification.error('Update Failed', 'Failed to set custom designation. Please try again.');
            setFields(prev => ({
                ...prev,
                designation: employee.designation || '',
                designation_id: employee.designation_id || ''
            }));
        }
    };
    
    // Handle MAC address management
    const handleAddMacAddress = async () => {
        if (!newMacAddress.trim()) return;
        
        // Validate MAC address format
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(newMacAddress.trim())) {
            notification.error('Invalid Format', 'MAC address must be in format like 00:1A:2B:3C:4D:5E');
            return;
        }
        
        try {
            // Create new array with the new MAC address
            const updatedMacAddresses = [...fields.mac_addresses, newMacAddress.trim()];
            
            // Update in backend
            await onUpdate({ mac_addresses: updatedMacAddresses });
            
            // Update local state
            setFields(prev => ({
                ...prev,
                mac_addresses: updatedMacAddresses
            }));
            
            // Clear input field
            setNewMacAddress('');
            
            notification.success('MAC Address Added', `Added ${newMacAddress.trim()} successfully`);
        } catch (error) {
            console.error('❌ Error adding MAC address:', error);
            notification.error('Update Failed', 'Failed to add MAC address. Please try again.');
        }
    };
    
    const handleRemoveMacAddress = async (macToRemove) => {
        try {
            // Filter out the MAC address to remove
            const updatedMacAddresses = fields.mac_addresses.filter(mac => mac !== macToRemove);
            
            // Update in backend
            await onUpdate({ mac_addresses: updatedMacAddresses });
            
            // Update local state
            setFields(prev => ({
                ...prev,
                mac_addresses: updatedMacAddresses
            }));
            
            notification.success('MAC Address Removed', `Removed ${macToRemove}`);
        } catch (error) {
            console.error('❌ Error removing MAC address:', error);
            notification.error('Update Failed', 'Failed to remove MAC address. Please try again.');
        }
    };

    const handleBlur = async (field, value) => {
        console.log(`🎯 EmploymentDetails: onBlur - field: ${field}, value: ${value}, original: ${employee[field]}`);
        if (value !== employee[field]) {
            console.log(`📤 EmploymentDetails: Saving change for ${field}: ${employee[field]} → ${value}`);
            try {
                // Convert date strings to ISO format if needed
                let processedValue = value;
                if (field === 'joining_date' && value) {
                    // Ensure date is in ISO format
                    processedValue = new Date(value).toISOString().split('T')[0];
                }
                
                await onUpdate({ [field]: processedValue });
                console.log(`✅ EmploymentDetails: Successfully updated ${field}`);
            } catch (error) {
                console.error(`❌ EmploymentDetails: Error updating ${field}:`, error);
                // Revert on error
                setFields(prev => ({
                    ...prev,
                    [field]: employee[field] || ''
                }));
            }
        } else {
            console.log(`ℹ️ EmploymentDetails: No change for ${field}, skipping save`);
        }
    };

    return (
        <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">EMPLOYEE ID</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base bg-gray-100 cursor-not-allowed"
                        value={fields.employee_id}
                        readOnly
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">JOINING DATE</div>
                    <input
                        type="date"
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.joining_date}
                        onChange={e => handleChange("joining_date", e.target.value)}
                        onBlur={e => handleBlur("joining_date", e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">DESIGNATION</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.designation_id || ''}
                        onChange={e => handleDesignationChange(e.target.value)}
                        disabled={loadingDesignations || !hasEditPermission}
                    >
                        <option value="">
                            {loadingDesignations ? 'Loading designations...' : hasEditPermission ? 'Select Designation' : 'No Permission to Edit'}
                        </option>
                        {Array.isArray(designations) && designations.length > 0 ? (
                            designations.map(designation => (
                                <option key={designation._id || designation.id} value={designation._id || designation.id}>
                                    {designation.name || 'Unnamed Designation'}
                                    {designation.reporting_designation_name && ` (Reports to: ${designation.reporting_designation_name})`}
                                </option>
                            ))
                        ) : (
                            !loadingDesignations && (
                                <option value="" disabled>
                                    No designations available
                                </option>
                            )
                        )}
                        {/* Allow custom designation entry only if user has edit permission */}
                        {hasEditPermission && <option value="__CUSTOM__">+ Add Custom Designation</option>}
                    </select>
                    
                    {/* Display current designation name */}
                    {fields.designation && !fields.designation_id && fields.designation !== '__CUSTOM__' && (
                        <div className="text-sm text-blue-600">
                            Current designation: {fields.designation} (Custom)
                        </div>
                    )}
                    
                    {loadingDesignations && (
                        <div className="text-sm text-gray-500">Loading designations...</div>
                    )}
                    {!loadingDesignations && (!Array.isArray(designations) || designations.length === 0) && (
                        <div className="text-sm text-red-500">
                            No designations found. Please check backend connection.
                        </div>
                    )}
                    {/* Custom designation input - show when custom option is selected */}
                    {fields.designation === '__CUSTOM__' && (
                        <div className="flex gap-2">
                            <input
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Enter custom designation"
                                autoFocus
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCustomDesignationSubmit(e.target.value);
                                    }
                                }}
                            />
                            <button 
                                className="bg-[#03b0f5] text-white px-3 py-2 rounded font-bold"
                                onClick={(e) => {
                                    const input = e.target.previousSibling;
                                    handleCustomDesignationSubmit(input.value);
                                }}
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">DEPARTMENT</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.department_id}
                        onChange={e => handleDepartmentChange(e.target.value)}
                        disabled={loadingDepartments || !hasEditPermission}
                    >
                        <option value="">
                            {loadingDepartments ? 'Loading departments...' : hasEditPermission ? 'Select Department' : 'No Permission to Edit'}
                        </option>
                        {(() => {
                            console.log('🔍 DEPARTMENT DROPDOWN RENDER - departments:', departments);
                            console.log('🔍 DEPARTMENT DROPDOWN RENDER - Array.isArray(departments):', Array.isArray(departments));
                            console.log('🔍 DEPARTMENT DROPDOWN RENDER - departments.length:', departments?.length);
                            console.log('🔍 DEPARTMENT DROPDOWN RENDER - loadingDepartments:', loadingDepartments);
                            return null;
                        })()}
                        {Array.isArray(departments) && departments.length > 0 ? (
                            departments.map(dept => {
                                console.log('🔍 DEPARTMENT OPTION RENDER - dept:', dept);
                                return (
                                    <option key={dept._id || dept.id} value={dept._id || dept.id}>
                                        {dept.name || dept.department_name || 'Unnamed Department'}
                                    </option>
                                );
                            })
                        ) : (
                            !loadingDepartments && (
                                <option value="" disabled>
                                    No departments available
                                </option>
                            )
                        )}
                    </select>
                    {loadingDepartments && (
                        <div className="text-sm text-gray-500">Loading departments...</div>
                    )}
                    {!loadingDepartments && (!Array.isArray(departments) || departments.length === 0) && (
                        <div className="text-sm text-red-500">
                            No departments found. Please check backend connection.
                            <br />
                            Debug: {JSON.stringify({ departments, loadingDepartments, isArray: Array.isArray(departments) })}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">ROLE</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.role_id}
                        onChange={e => handleRoleChange(e.target.value)}
                        disabled={loadingRoles || !hasEditPermission}
                    >
                        <option value="">
                            {loadingRoles ? 'Loading roles...' : hasEditPermission ? 'Select Role' : 'No Permission to Edit'}
                        </option>
                        {(() => {
                            console.log('🔍 ROLE DROPDOWN RENDER - roles:', roles);
                            console.log('🔍 ROLE DROPDOWN RENDER - Array.isArray(roles):', Array.isArray(roles));
                            console.log('🔍 ROLE DROPDOWN RENDER - roles.length:', roles?.length);
                            console.log('🔍 ROLE DROPDOWN RENDER - loadingRoles:', loadingRoles);
                            return null;
                        })()}
                        {Array.isArray(roles) && roles.length > 0 ? (
                            roles.map(role => {
                                console.log('🔍 ROLE OPTION RENDER - role:', role);
                                return (
                                    <option key={role._id || role.id} value={role._id || role.id}>
                                        {role.name || role.role_name || 'Unnamed Role'}
                                    </option>
                                );
                            })
                        ) : (
                            !loadingRoles && (
                                <option value="" disabled>
                                    No roles available
                                </option>
                            )
                        )}
                    </select>
                    {loadingRoles && (
                        <div className="text-sm text-gray-500">Loading roles...</div>
                    )}
                    {!loadingRoles && (!Array.isArray(roles) || roles.length === 0) && (
                        <div className="text-sm text-red-500">
                            No roles found. Please check backend connection.
                            <br />
                            Debug: {JSON.stringify({ roles, loadingRoles, isArray: Array.isArray(roles) })}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">STATUS</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.employee_status}
                        onChange={e => handleChange("employee_status", e.target.value)}
                        onBlur={e => handleBlur("employee_status", e.target.value)}
                    >
                        <option value="">Select Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">SALARY</div>
                    <input
                        type="number"
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.salary}
                        onChange={e => handleChange("salary", e.target.value)}
                        onBlur={e => handleBlur("salary", e.target.value)}
                        placeholder="Enter salary"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">WORK LOCATION</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.work_location}
                        onChange={e => handleChange("work_location", e.target.value)}
                        onBlur={e => handleBlur("work_location", e.target.value)}
                        placeholder="Enter work location"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">MAC ADDRESSES</div>
                    <div className="flex gap-2">
                        <input
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold flex-1 text-base"
                            placeholder="Enter MAC address"
                            value={newMacAddress}
                            onChange={e => setNewMacAddress(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddMacAddress();
                                }
                            }}
                            pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                            title="Please enter a valid MAC address format (AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)"
                        />
                        <button 
                            className="bg-[#03b0f5] text-white px-3 py-2 rounded font-bold"
                            onClick={handleAddMacAddress}
                        >
                            Add
                        </button>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                        Format: 00:1A:2B:3C:4D:5E
                    </div>
                    
                    {/* List of MAC addresses */}
                    {fields.mac_addresses && fields.mac_addresses.length > 0 ? (
                        <div className="mt-2 border rounded p-2 bg-gray-50">
                            <h4 className="font-semibold text-[#03b0f5] mb-2">Registered MAC Addresses:</h4>
                            <ul className="space-y-2">
                                {fields.mac_addresses.map((mac, index) => (
                                    <li key={index} className="flex justify-between items-center border-b pb-1">
                                        <span className="text-[#0db45c] font-mono">{mac}</span>
                                        <button 
                                            className="text-red-500 hover:text-red-700 text-sm"
                                            onClick={() => handleRemoveMacAddress(mac)}
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-gray-500 italic text-sm mt-2">
                            No MAC addresses registered yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Contact Information Section Component
const ContactInfoSection = ({ employee, onUpdate }) => {
    const [fields, setFields] = useState({
        email: employee.email || '',
        phone: employee.phone || '',
        alternate_phone: employee.alternate_phone || '',
        work_email: employee.work_email || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        emergency_contact_relation: employee.emergency_contact_relation || ''
    });

    // Update local state if the employee prop changes from parent
    useEffect(() => {
        const newFields = {
            email: employee.email || '',
            phone: employee.phone || '',
            alternate_phone: employee.alternate_phone || '',
            work_email: employee.work_email || '',
            emergency_contact_name: employee.emergency_contact_name || '',
            emergency_contact_phone: employee.emergency_contact_phone || '',
            emergency_contact_relation: employee.emergency_contact_relation || ''
        };

        const hasChanges = Object.keys(newFields).some(key => newFields[key] !== fields[key]);
        if (hasChanges) {
            setFields(newFields);
        }
    }, [employee]);

    const handleChange = (field, value) => {
        setFields(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleBlur = async (field, value) => {
        if (value !== employee[field]) {
            try {
                await onUpdate({ [field]: value });
            } catch (error) {
                console.error(`Error updating ${field}:`, error);
                setFields(prev => ({
                    ...prev,
                    [field]: employee[field] || ''
                }));
            }
        }
    };

    return (
        <div className="p-6 bg-white">
            {/* Regular Contact Information */}
            <div className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">📞 Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">PERSONAL EMAIL</div>
                        <input
                            type="email"
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.email}
                            onChange={e => handleChange("email", e.target.value)}
                            onBlur={e => handleBlur("email", e.target.value)}
                            placeholder="Enter personal email address"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">WORK EMAIL</div>
                        <input
                            type="email"
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.work_email}
                            onChange={e => handleChange("work_email", e.target.value)}
                            onBlur={e => handleBlur("work_email", e.target.value)}
                            placeholder="Enter work email address"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">PRIMARY PHONE</div>
                        <input
                            type="tel"
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.phone}
                            onChange={e => handleChange("phone", e.target.value)}
                            onBlur={e => handleBlur("phone", e.target.value)}
                            placeholder="Enter primary phone number"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">ALTERNATE PHONE</div>
                        <input
                            type="tel"
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.alternate_phone}
                            onChange={e => handleChange("alternate_phone", e.target.value)}
                            onBlur={e => handleBlur("alternate_phone", e.target.value)}
                            placeholder="Enter alternate phone number"
                        />
                    </div>
                </div>
            </div>

            {/* Emergency Contact Information */}
            <div className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">🚨 Emergency Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">EMERGENCY CONTACT NAME</div>
                        <input
                            type="text"
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.emergency_contact_name}
                            onChange={e => handleChange("emergency_contact_name", e.target.value)}
                            onBlur={e => handleBlur("emergency_contact_name", e.target.value)}
                            placeholder="Enter emergency contact name"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">EMERGENCY CONTACT PHONE</div>
                        <input
                            type="tel"
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.emergency_contact_phone}
                            onChange={e => handleChange("emergency_contact_phone", e.target.value)}
                            onBlur={e => handleBlur("emergency_contact_phone", e.target.value)}
                            placeholder="Enter emergency contact phone"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="text-lg text-[#03b0f5] font-bold">RELATION</div>
                        <select
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            value={fields.emergency_contact_relation}
                            onChange={e => handleChange("emergency_contact_relation", e.target.value)}
                            onBlur={e => handleBlur("emergency_contact_relation", e.target.value)}
                        >
                            <option value="">Select Relation</option>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Brother">Brother</option>
                            <option value="Sister">Sister</option>
                            <option value="Son">Son</option>
                            <option value="Daughter">Daughter</option>
                            <option value="Friend">Friend</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Comprehensive Employee Form Component - Same layout as EmployeeFormNew but editable with backend data
const ComprehensiveEmployeeForm = ({ employee, onUpdate }) => {
    const [formData, setFormData] = useState({
        // Profile Photo
        profile_photo: employee?.profile_photo || '',
        
        // Employee Information
        employee_id: employee?.employee_id || '',
        first_name: employee?.first_name || '',
        last_name: employee?.last_name || '',
        phone: employee?.phone || '',
        alternate_phone: employee?.alternate_phone || '',
        email: employee?.email || '',
        work_email: employee?.work_email || '',
        date_of_birth: employee?.date_of_birth || '',
        pan_number: employee?.pan_number || '',
        aadhaar_number: employee?.aadhaar_number || '',
        highest_qualification: employee?.highest_qualification || '',
        experience_level: employee?.experience_level || '',
        gender: employee?.gender || '',
        marital_status: employee?.marital_status || '',
        nationality: employee?.nationality || 'Indian',
        blood_group: employee?.blood_group || '',
        
        // Address Information
        current_address: employee?.current_address?.address || employee?.current_address || '',
        current_city: employee?.current_address?.city || employee?.current_city || '',
        current_state: employee?.current_address?.state || employee?.current_state || '',
        current_pincode: employee?.current_address?.pincode || employee?.current_pincode || '',
        permanent_address: employee?.permanent_address?.address || employee?.permanent_address || '',
        permanent_city: employee?.permanent_address?.city || employee?.permanent_city || '',
        permanent_state: employee?.permanent_address?.state || employee?.permanent_state || '',
        permanent_pincode: employee?.permanent_address?.pincode || employee?.permanent_pincode || '',
        same_as_permanent: employee?.same_as_permanent || false,
        
        // Emergency Contacts
        emergency_contact_name: employee?.emergency_contact_name || employee?.emergency_contacts?.[0]?.name || '',
        emergency_contact_phone: employee?.emergency_contact_phone || employee?.emergency_contacts?.[0]?.phone || '',
        emergency_contact_relation: employee?.emergency_contact_relation || employee?.emergency_contacts?.[0]?.relation || '',
        emergency_contact_2_name: employee?.emergency_contacts?.[1]?.name || '',
        emergency_contact_2_phone: employee?.emergency_contacts?.[1]?.phone || '',
        emergency_contact_2_relation: employee?.emergency_contacts?.[1]?.relation || '',
        
        // Employment Details
        joining_date: employee?.joining_date || '',
        salary: employee?.salary || '',
        monthly_target: employee?.monthly_target || '',
        incentive: employee?.incentive || '',
        department_id: employee?.department_id || '',
        role_id: employee?.role_id || '',
        designation: employee?.designation || '',
        work_location: employee?.work_location || '',
        employee_status: employee?.employee_status || 'active',
        
        // Banking Details
        salary_account_number: employee?.salary_account_number || '',
        salary_ifsc_code: employee?.salary_ifsc_code || '',
        salary_bank_name: employee?.salary_bank_name || '',
        
        // Access Controls
        crm_access: employee?.crm_access || false,
        login_enabled: employee?.login_enabled || false,
        onboarding_status: employee?.onboarding_status || 'pending'
    });

    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);

    // Update form data when employee prop changes
    useEffect(() => {
        const newFormData = {
            profile_photo: employee?.profile_photo || '',
            employee_id: employee?.employee_id || '',
            first_name: employee?.first_name || '',
            last_name: employee?.last_name || '',
            phone: employee?.phone || '',
            alternate_phone: employee?.alternate_phone || '',
            email: employee?.email || '',
            work_email: employee?.work_email || '',
            date_of_birth: employee?.date_of_birth || '',
            pan_number: employee?.pan_number || '',
            aadhaar_number: employee?.aadhaar_number || '',
            highest_qualification: employee?.highest_qualification || '',
            experience_level: employee?.experience_level || '',
            gender: employee?.gender || '',
            marital_status: employee?.marital_status || '',
            nationality: employee?.nationality || 'Indian',
            blood_group: employee?.blood_group || '',
            current_address: employee?.current_address?.address || employee?.current_address || '',
            current_city: employee?.current_address?.city || employee?.current_city || '',
            current_state: employee?.current_address?.state || employee?.current_state || '',
            current_pincode: employee?.current_address?.pincode || employee?.current_pincode || '',
            permanent_address: employee?.permanent_address?.address || employee?.permanent_address || '',
            permanent_city: employee?.permanent_address?.city || employee?.permanent_city || '',
            permanent_state: employee?.permanent_address?.state || employee?.permanent_state || '',
            permanent_pincode: employee?.permanent_address?.pincode || employee?.permanent_pincode || '',
            same_as_permanent: employee?.same_as_permanent || false,
            emergency_contact_name: employee?.emergency_contact_name || employee?.emergency_contacts?.[0]?.name || '',
            emergency_contact_phone: employee?.emergency_contact_phone || employee?.emergency_contacts?.[0]?.phone || '',
            emergency_contact_relation: employee?.emergency_contact_relation || employee?.emergency_contacts?.[0]?.relation || '',
            emergency_contact_2_name: employee?.emergency_contacts?.[1]?.name || '',
            emergency_contact_2_phone: employee?.emergency_contacts?.[1]?.phone || '',
            emergency_contact_2_relation: employee?.emergency_contacts?.[1]?.relation || '',
            joining_date: employee?.joining_date || '',
            salary: employee?.salary || '',
            monthly_target: employee?.monthly_target || '',
            incentive: employee?.incentive || '',
            department_id: employee?.department_id || '',
            role_id: employee?.role_id || '',
            designation: employee?.designation || '',
            work_location: employee?.work_location || '',
            employee_status: employee?.employee_status || 'active',
            salary_account_number: employee?.salary_account_number || '',
            salary_ifsc_code: employee?.salary_ifsc_code || '',
            salary_bank_name: employee?.salary_bank_name || '',
            crm_access: employee?.crm_access || false,
            login_enabled: employee?.login_enabled || false,
            onboarding_status: employee?.onboarding_status || 'pending'
        };

        const hasChanges = Object.keys(newFormData).some(key => newFormData[key] !== formData[key]);
        if (hasChanges) {
            setFormData(newFormData);
        }
    }, [employee]);

    // Fetch departments and roles
    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const [departmentsRes, rolesRes] = await Promise.all([
                    hrmsService.getDepartments(),
                    hrmsService.getRoles()
                ]);

                let departmentsData = [];
                if (departmentsRes?.data) {
                    departmentsData = Array.isArray(departmentsRes.data) ? departmentsRes.data : departmentsRes.data.departments || [];
                } else if (Array.isArray(departmentsRes)) {
                    departmentsData = departmentsRes;
                }

                let rolesData = [];
                if (rolesRes?.data) {
                    rolesData = Array.isArray(rolesRes.data) ? rolesRes.data : rolesRes.data.roles || [];
                } else if (Array.isArray(rolesRes)) {
                    rolesData = rolesRes;
                }

                setDepartments(departmentsData);
                setRoles(rolesData);
            } catch (error) {
                console.error('Error fetching dropdown data:', error);
            }
        };

        fetchDropdownData();
    }, []);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleBlur = async (field, value) => {
        if (value !== employee[field]) {
            setIsUpdating(true);
            try {
                await onUpdate({ [field]: value });
                message.success('Field updated successfully');
            } catch (error) {
                console.error(`Error updating ${field}:`, error);
                message.error('Failed to update field');
                // Revert the change
                setFormData(prev => ({
                    ...prev,
                    [field]: employee[field] || ''
                }));
            } finally {
                setIsUpdating(false);
            }
        }
    };

    const handleSaveAll = async () => {
        setIsUpdating(true);
        try {
            // Prepare comprehensive data for update
            const updateData = {
                ...formData,
                // Structure address data properly
                current_address: {
                    address: formData.current_address,
                    city: formData.current_city,
                    state: formData.current_state,
                    pincode: formData.current_pincode,
                    country: 'India'
                },
                permanent_address: {
                    address: formData.permanent_address,
                    city: formData.permanent_city,
                    state: formData.permanent_state,
                    pincode: formData.permanent_pincode,
                    country: 'India'
                },
                // Structure emergency contacts
                emergency_contacts: [
                    {
                        name: formData.emergency_contact_name,
                        phone: formData.emergency_contact_phone,
                        relation: formData.emergency_contact_relation
                    }
                ]
            };

            if (formData.emergency_contact_2_name || formData.emergency_contact_2_phone) {
                updateData.emergency_contacts.push({
                    name: formData.emergency_contact_2_name,
                    phone: formData.emergency_contact_2_phone,
                    relation: formData.emergency_contact_2_relation
                });
            }

            await onUpdate(updateData);
            message.success('All employee data updated successfully');
        } catch (error) {
            console.error('Error updating employee data:', error);
            message.error('Failed to update employee data');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-6 bg-white">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-[#03b0f5]">Employee Information Form</h3>
                <button
                    onClick={handleSaveAll}
                    disabled={isUpdating}
                    className="bg-[#03b0f5] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0291cc] disabled:opacity-50"
                >
                    {isUpdating ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>

            <div className="space-y-8">
                {/* Profile Information */}
                <div className="border-l-4 border-[#03b0f5] pl-4">
                    <h4 className="text-xl font-bold text-[#03b0f5] mb-4">👤 Profile Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">EMPLOYEE ID</label>
                            <input
                                type="text"
                                name="employee_id"
                                value={formData.employee_id}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base bg-gray-100"
                                readOnly
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">FIRST NAME *</label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('first_name', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="First Name"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">LAST NAME *</label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('last_name', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Last Name"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">PHONE *</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('phone', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Phone Number"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">ALTERNATE PHONE</label>
                            <input
                                type="tel"
                                name="alternate_phone"
                                value={formData.alternate_phone}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('alternate_phone', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Alternate Phone"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">PERSONAL EMAIL *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('email', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Personal Email"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">WORK EMAIL</label>
                            <input
                                type="email"
                                name="work_email"
                                value={formData.work_email}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('work_email', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Work Email"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">DATE OF BIRTH</label>
                            <input
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('date_of_birth', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">GENDER</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('gender', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">MARITAL STATUS</label>
                            <select
                                name="marital_status"
                                value={formData.marital_status}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('marital_status', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="">Select Status</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                                <option value="Widowed">Widowed</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">NATIONALITY</label>
                            <input
                                type="text"
                                name="nationality"
                                value={formData.nationality}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('nationality', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Nationality"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">BLOOD GROUP</label>
                            <select
                                name="blood_group"
                                value={formData.blood_group}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('blood_group', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="">Select Blood Group</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Employment Details */}
                <div className="border-l-4 border-[#03b0f5] pl-4">
                    <h4 className="text-xl font-bold text-[#03b0f5] mb-4">💼 Employment Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">JOINING DATE</label>
                            <input
                                type="date"
                                name="joining_date"
                                value={formData.joining_date}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('joining_date', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">DEPARTMENT</label>
                            <select
                                name="department_id"
                                value={formData.department_id}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('department_id', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="">Select Department</option>
                                {departments.map(dept => (
                                    <option key={dept._id || dept.id} value={dept._id || dept.id}>
                                        {dept.name || dept.department_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">ROLE</label>
                            <select
                                name="role_id"
                                value={formData.role_id}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('role_id', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="">Select Role</option>
                                {roles.map(role => (
                                    <option key={role._id || role.id} value={role._id || role.id}>
                                        {role.name || role.role_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">DESIGNATION</label>
                            <input
                                type="text"
                                name="designation"
                                value={formData.designation}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('designation', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Designation"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">SALARY</label>
                            <input
                                type="number"
                                name="salary"
                                value={formData.salary}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('salary', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Monthly Salary"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">WORK LOCATION</label>
                            <input
                                type="text"
                                name="work_location"
                                value={formData.work_location}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('work_location', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Work Location"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">STATUS</label>
                            <select
                                name="employee_status"
                                value={formData.employee_status}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('employee_status', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Address Information */}
                <div className="border-l-4 border-[#03b0f5] pl-4">
                    <h4 className="text-xl font-bold text-[#03b0f5] mb-4">🏠 Address Information</h4>
                    
                    {/* Current Address */}
                    <div className="mb-6">
                        <h5 className="text-lg font-bold text-[#03b0f5] mb-3">Current Address</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
                                <label className="text-lg text-[#03b0f5] font-bold">ADDRESS</label>
                                <textarea
                                    name="current_address"
                                    value={formData.current_address}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('current_address', e.target.value)}
                                    rows={3}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="Current Address"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-lg text-[#03b0f5] font-bold">CITY</label>
                                <input
                                    type="text"
                                    name="current_city"
                                    value={formData.current_city}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('current_city', e.target.value)}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="City"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-lg text-[#03b0f5] font-bold">STATE</label>
                                <input
                                    type="text"
                                    name="current_state"
                                    value={formData.current_state}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('current_state', e.target.value)}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="State"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-lg text-[#03b0f5] font-bold">PINCODE</label>
                                <input
                                    type="text"
                                    name="current_pincode"
                                    value={formData.current_pincode}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('current_pincode', e.target.value)}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="Pincode"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Permanent Address */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h5 className="text-lg font-bold text-[#03b0f5]">Permanent Address</h5>
                            <label className="flex items-center gap-2 text-[#03b0f5] font-medium">
                                <input
                                    type="checkbox"
                                    name="same_as_permanent"
                                    checked={formData.same_as_permanent}
                                    onChange={handleInputChange}
                                    className="w-4 h-4"
                                />
                                Same as Current Address
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
                                <label className="text-lg text-[#03b0f5] font-bold">ADDRESS</label>
                                <textarea
                                    name="permanent_address"
                                    value={formData.permanent_address}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('permanent_address', e.target.value)}
                                    rows={3}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="Permanent Address"
                                    disabled={formData.same_as_permanent}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-lg text-[#03b0f5] font-bold">CITY</label>
                                <input
                                    type="text"
                                    name="permanent_city"
                                    value={formData.permanent_city}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('permanent_city', e.target.value)}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="City"
                                    disabled={formData.same_as_permanent}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-lg text-[#03b0f5] font-bold">STATE</label>
                                <input
                                    type="text"
                                    name="permanent_state"
                                    value={formData.permanent_state}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('permanent_state', e.target.value)}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="State"
                                    disabled={formData.same_as_permanent}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-lg text-[#03b0f5] font-bold">PINCODE</label>
                                <input
                                    type="text"
                                    name="permanent_pincode"
                                    value={formData.permanent_pincode}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('permanent_pincode', e.target.value)}
                                    className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                    placeholder="Pincode"
                                    disabled={formData.same_as_permanent}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Emergency Contact */}
                <div className="border-l-4 border-[#03b0f5] pl-4">
                    <h4 className="text-xl font-bold text-[#03b0f5] mb-4">🚨 Emergency Contact</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">CONTACT NAME</label>
                            <input
                                type="text"
                                name="emergency_contact_name"
                                value={formData.emergency_contact_name}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('emergency_contact_name', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Emergency Contact Name"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">CONTACT PHONE</label>
                            <input
                                type="tel"
                                name="emergency_contact_phone"
                                value={formData.emergency_contact_phone}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('emergency_contact_phone', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                                placeholder="Emergency Contact Phone"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">RELATION</label>
                            <select
                                name="emergency_contact_relation"
                                value={formData.emergency_contact_relation}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('emergency_contact_relation', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="">Select Relation</option>
                                <option value="Father">Father</option>
                                <option value="Mother">Mother</option>
                                <option value="Spouse">Spouse</option>
                                <option value="Brother">Brother</option>
                                <option value="Sister">Sister</option>
                                <option value="Friend">Friend</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Access Controls */}
                <div className="border-l-4 border-[#03b0f5] pl-4">
                    <h4 className="text-xl font-bold text-[#03b0f5] mb-4">🔐 Access Controls</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg">
                            <div>
                                <div className="font-medium text-gray-800">CRM Access</div>
                                <div className="text-sm text-gray-600">Allow access to CRM system</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="crm_access"
                                    checked={formData.crm_access}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('crm_access', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#03b0f5]"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg">
                            <div>
                                <div className="font-medium text-gray-800">Login Enabled</div>
                                <div className="text-sm text-gray-600">Allow system login</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="login_enabled"
                                    checked={formData.login_enabled}
                                    onChange={handleInputChange}
                                    onBlur={e => handleBlur('login_enabled', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#03b0f5]"></div>
                            </label>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-lg text-[#03b0f5] font-bold">ONBOARDING STATUS</label>
                            <select
                                name="onboarding_status"
                                value={formData.onboarding_status}
                                onChange={handleInputChange}
                                onBlur={e => handleBlur('onboarding_status', e.target.value)}
                                className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                            >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="on_hold">On Hold</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                    onClick={handleSaveAll}
                    disabled={isUpdating}
                    className="w-full bg-[#03b0f5] text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-[#0291cc] disabled:opacity-50"
                >
                    {isUpdating ? 'Saving All Changes...' : 'Save All Changes'}
                </button>
            </div>
        </div>
    );
};

export default EmployeeDetails;
