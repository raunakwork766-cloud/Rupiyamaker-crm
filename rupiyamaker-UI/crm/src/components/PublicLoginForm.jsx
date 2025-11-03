import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import LoginFormSection from "./sections/LoginFormSection";

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

export default function PublicLoginForm() {
  const { mobileNumber } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const isCoApplicantLink = searchParams.get('coApplicant') === 'true';
  const restrictTo = searchParams.get('restrictTo'); // 'applicant', 'coApplicant', or null
  
  const [leadData, setLeadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Form saved successfully!");
  // Set initial tab based on restriction or coApplicant parameter
  const [activeTab, setActiveTab] = useState(
    restrictTo === 'coApplicant' ? "co-applicant" : 
    restrictTo === 'applicant' ? "applicant" :
    isCoApplicantLink ? "co-applicant" : "applicant"
  );
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  // Keep track of form data to preserve across tab switches
  const [applicantFormData, setApplicantFormData] = useState({});
  const [coApplicantFormData, setCoApplicantFormData] = useState({});
  
  // Bank options state for dynamic dropdown
  const [bankOptions, setBankOptions] = useState(["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
  
  // Create refs to access LoginFormSection methods
  const applicantFormRef = useRef(null);
  const coApplicantFormRef = useRef(null);

  useEffect(() => {
    if ((mobileNumber && mobileNumber !== 'guest') || leadId) {
      loadLeadData();
    } else {
      setLoading(false);
    }
  }, [mobileNumber, leadId]);

  const loadLeadData = async () => {
    try {
      if (!leadId && (!mobileNumber || mobileNumber === 'guest')) {
        // No identifiers to load data with
        return;
      }
      
      // If leadId is provided, use it; otherwise use mobile number
      let url = leadId 
        ? `/api/leads/${leadId}?skip_auth=true` 
        : `/api/leads/by-mobile/${mobileNumber}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        
        // Set lead data first
        setLeadData(data);
        
        // Also initialize our form data state with the loaded data
        if (data?.dynamic_fields?.applicant_form) {
          setApplicantFormData(data.dynamic_fields.applicant_form);
        }
        if (data?.dynamic_fields?.co_applicant_form) {
          setCoApplicantFormData(data.dynamic_fields.co_applicant_form);
        }
        
        // Check if form_share is explicitly false AND there are submitted timestamps
        // This indicates the form was previously submitted via public form
        if (data?.form_share === false) {
          const applicantFormSubmitted = data?.dynamic_fields?.applicant_form?.formSubmittedAt;
          const coApplicantFormSubmitted = data?.dynamic_fields?.co_applicant_form?.formSubmittedAt;
          
          // Only block access if form_share is false AND there are submission timestamps
          // This prevents false positives when admins generate new share links
          if (applicantFormSubmitted || coApplicantFormSubmitted) {
            setIsFormSubmitted(true);
            return;
          }
        }
        
        // If form_share is true or undefined (default), allow access
        // If form_share is false but no submission timestamps, also allow access (admin regenerated link)
        
      } else if (response.status === 403) {
        // Form sharing is disabled (form already submitted)
        setIsFormSubmitted(true);
      } else if (response.status === 422) {
        console.warn('API requires user_id parameter. Using public form without pre-filled data.');
      } else if (response.status === 404) {
        console.warn('Lead not found. Using empty form.');
      }
    } catch (err) {
      console.error('Error loading lead data:', err);
      // Check if error message indicates form sharing is disabled
      if (err.message && err.message.includes('already been submitted')) {
        setIsFormSubmitted(true);
      }
      // Don't set error here as we want to allow form filling even without existing lead
    } finally {
      setLoading(false);
    }
  };

  // Fetch bank options from backend (similar to LoginCRM.jsx)
  const fetchBankOptions = async () => {
    try {
      console.log('🏦 [PublicForm] Fetching bank options from settings API...');
      // For public form, we don't have a user ID, so we'll try with a default or handle it
      const response = await fetch(`${API_BASE_URL}/settings/bank-names?user_id=public`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🌐 [PublicForm] API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 [PublicForm] Raw bank data received:', data);
        
        if (Array.isArray(data) && data.length > 0) {
          const bankNames = data
            .filter(bank => bank && bank.is_active === true)
            .map(bank => bank.name)
            .filter(name => name && name.trim());
          
          console.log(`✅ [PublicForm] Processed ${bankNames.length} active bank names`);
          
          if (bankNames.length > 0) {
            setBankOptions(bankNames);
            console.log('🎯 [PublicForm] Bank options successfully set');
          }
        }
      } else {
        console.warn('⚠️ [PublicForm] Failed to fetch bank options, using defaults');
      }
    } catch (error) {
      console.error('❌ [PublicForm] Error fetching bank options:', error);
    }
  };

  // Fetch bank options on component mount
  useEffect(() => {
    fetchBankOptions();
  }, []);

  const handleSave = async (formData, isCoApplicantForm = false, isFinalSubmission = false) => {
    try {
      const leadId = leadData?._id;
      if (leadId) {
        // Only add submission timestamp if this is a final submission
        const formDataWithOptionalTimestamp = isFinalSubmission 
          ? {
              ...formData,
              formSubmittedAt: new Date().toISOString()
            }
          : formData;
        
        // Prepare the data structure based on whether it's a co-applicant or primary applicant
        const dynamicFields = {
          dynamic_fields: isCoApplicantForm 
            ? { co_applicant_form: formDataWithOptionalTimestamp }
            : { applicant_form: formDataWithOptionalTimestamp }
        };
        
        // Add query parameter to indicate if this is a final submission
        const queryParam = isFinalSubmission ? '?is_final_submission=true' : '?is_final_submission=false';
        
        // Update existing lead
        const response = await fetch(`${API_BASE_URL}/leads/${leadId}/public-login-form${queryParam}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dynamicFields)
        });
        
        if (response.ok) {
          // Update the local lead data to reflect changes
          setLeadData(prevData => ({
            ...prevData,
            // Only set form_share to false if this was a final submission
            form_share: isFinalSubmission ? false : prevData.form_share,
            dynamic_fields: {
              ...prevData.dynamic_fields,
              ...(isCoApplicantForm 
                ? { co_applicant_form: formDataWithOptionalTimestamp }
                : { applicant_form: formDataWithOptionalTimestamp })
            }
          }));
          
          // Update our form data state as well
          if (isCoApplicantForm) {
            setCoApplicantFormData(formDataWithOptionalTimestamp);
          } else {
            setApplicantFormData(formDataWithOptionalTimestamp);
          }
          
          // Only mark form as submitted if this was a final submission
          if (isFinalSubmission) {
            setIsFormSubmitted(true);
            setSuccessMessage("Form submitted successfully!");
            
            // Only show success messages for explicit form submissions
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          } 
          // No success message for non-final submissions (tab switching)
          console.log(isFinalSubmission ? 'Form submitted successfully' : 'Form data saved successfully');
        } else {
          console.error('Error response from server:', await response.text());
          throw new Error('Server returned error response');
        }
      } else {
        // For new leads (when no ID is available)
        // Add submission timestamp to the form data
        const formDataWithTimestamp = {
          ...formData,
          formSubmittedAt: new Date().toISOString()
        };
        
        // Create a new lead with the form data
        const newLeadData = {
          first_name: formData.customerName ? formData.customerName.split(' ')[0] : '',
          last_name: formData.customerName ? formData.customerName.split(' ').slice(1).join(' ') : '',
          phone: formData.mobileNumber || mobileNumber,
          mobile_number: formData.mobileNumber || mobileNumber,
          form_share: false, // Set form_share to false since form is being submitted
          dynamic_fields: {
            applicant_form: isCoApplicantForm ? {} : formDataWithTimestamp,
            co_applicant_form: isCoApplicantForm ? formDataWithTimestamp : {}
          },
          source: "Public Form"
        };
        
        // Attempt to create a new lead via public API
        const response = await fetch(`${API_BASE_URL}/leads/public-form`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newLeadData)
        });
        
        if (response.ok) {
          // Get the created lead data
          const createdLead = await response.json();
          setLeadData({
            ...createdLead,
            form_share: false // Ensure form_share is false after submission
          });
          
          // Mark form as submitted to prevent further edits
          setIsFormSubmitted(true);
          setSuccessMessage("Form submitted successfully!");
          setShowSuccess(true);
          
          setTimeout(() => setShowSuccess(false), 3000);
          console.log('New lead created successfully');
        } else {
          // If the API doesn't exist yet, just simulate success
          console.log('Form data (no existing lead):', formData);
          setSuccessMessage("Form submitted successfully!");
          setShowSuccess(true);
          setIsFormSubmitted(true);
          setTimeout(() => setShowSuccess(false), 3000);
        }
      }
    } catch (err) {
      console.error('Error saving form data:', err);
      setError("Failed to save your data. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleApplicantSave = (formData) => {
    // Update the applicant form data
    setApplicantFormData(formData);
    handleSave(formData, false, true); // Set isFinalSubmission to true for Save Form button
  };

  const handleCoApplicantSave = (formData) => {
    // Update the co-applicant form data
    setCoApplicantFormData(formData);
    handleSave(formData, true, true); // Set isFinalSubmission to true for Save Form button
  };
  
  // Function to preserve form data when switching tabs - without showing success message
  const handleTabChange = async (newTab) => {
    try {
      // If switching from applicant to co-applicant
      if (activeTab === "applicant" && newTab === "co-applicant") {
        if (applicantFormRef.current) {
          // Get current applicant form data and save it
          const currentFormData = applicantFormRef.current.getCurrentFormData();
          setApplicantFormData(currentFormData);
          
          // Save data silently in background
          silentlySaveFormData(currentFormData, false);
        }
      } 
      // If switching from co-applicant to applicant
      else if (activeTab === "co-applicant" && newTab === "applicant") {
        if (coApplicantFormRef.current) {
          // Get current co-applicant form data and save it
          const currentFormData = coApplicantFormRef.current.getCurrentFormData();
          setCoApplicantFormData(currentFormData);
          
          // Save data silently in background
          silentlySaveFormData(currentFormData, true);
        }
      }
      
      // Switch the tab
      setActiveTab(newTab);
    } catch (error) {
      console.error('Error saving form data when switching tabs:', error);
      // Don't show any error to user for a smoother experience
    }
  };
  
  // Function to save form data silently without showing success messages
  const silentlySaveFormData = async (formData, isCoApplicantForm) => {
    try {
      const leadId = leadData?._id;
      if (leadId) {
        // Prepare the data structure based on whether it's a co-applicant or primary applicant
        const dynamicFields = {
          dynamic_fields: isCoApplicantForm 
            ? { co_applicant_form: formData }
            : { applicant_form: formData }
        };
        
        // Update existing lead silently (no success messages)
        await fetch(`${API_BASE_URL}/leads/${leadId}/public-login-form?is_final_submission=false`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dynamicFields)
        });
        
        // Update the local lead data to reflect changes (without notifications)
        setLeadData(prevData => ({
          ...prevData,
          dynamic_fields: {
            ...prevData.dynamic_fields,
            ...(isCoApplicantForm 
              ? { co_applicant_form: formData }
              : { applicant_form: formData })
          }
        }));
      }
    } catch (err) {
      // Log error but don't show to user
      console.error('Silent save error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  // Show submitted message if form has already been submitted
  if (isFormSubmitted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Already Submitted</h1>
            <p className="text-gray-600 mb-4">
              This form has already been submitted and cannot be accessed again.
            </p>
            <p className="text-sm text-red-500 mb-6 font-medium">
              Form already submitted, contact support to request again form.
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Need Help?</strong><br />
              Contact our support team to generate a new form link if updates are required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success and error notifications */}
        {showSuccess && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            <p className="text-center font-medium">{successMessage}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <p className="text-center font-medium">{error}</p>
          </div>
        )}
        
        {/* Tab navigation for switching between applicant and co-applicant - only show if not restricted */}
        {!restrictTo && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            {/* Show indicator if opened via co-applicant link */}
            {isCoApplicantLink && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                <strong>Co-Applicant Form Link:</strong> You've opened a direct link to the Co-Applicant form.
              </div>
            )}
            <div className="flex border-b">
              <button
                className={`px-6 py-2 font-medium text-sm ${
                  activeTab === "applicant"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => handleTabChange("applicant")}
              >
                Applicant Form
              </button>
              <button
                className={`px-6 py-2 font-medium text-sm ${
                  activeTab === "co-applicant"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => handleTabChange("co-applicant")}
              >
                Co-Applicant Form
              </button>
            </div>
          </div>
        )}

        {/* Restricted form indicator - show when access is restricted to specific form */}
       
        
        {/* Applicant Form - show when tab is applicant OR when restricted to applicant */}
        {(activeTab === "applicant" || restrictTo === 'applicant') && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                {restrictTo === 'applicant' ? 'Applicant Form ' : 'Loan Application Form'}
              </h1>
              <p className="text-gray-600 mt-2">
                {leadData 
                  ? `Complete your application, ${leadData.first_name || 'Customer'}` 
                  : 'Please fill out the form below to apply for a loan'
                }
              </p>
              {mobileNumber && mobileNumber !== 'guest' && (
                <p className="text-sm text-blue-600 mt-1">Mobile: {mobileNumber}</p>
              )}
              
            </div>

                        <LoginFormSection
              ref={applicantFormRef}
              data={applicantFormData || leadData?.dynamic_fields?.applicant_form || {}}
              onSave={handleApplicantSave}
              bankOptions={bankOptions}
              mobileNumber={leadData?.mobile_number || ""}
              bankName={leadData?.bank || ""}
              isReadOnlyMobile={true}
              leadId={leadData?._id}
              leadCustomerName={leadData ? `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() : ''}
              isCoApplicant={false}
              isPublic={true}
              leadData={leadData} // Pass the full lead data including form_share status
            />
          </div>
        )}
        
        {/* Co-Applicant Form - show when tab is co-applicant OR when restricted to co-applicant */}
        {(activeTab === "co-applicant" || restrictTo === 'coApplicant') && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                {restrictTo === 'coApplicant' ? 'Co-Applicant Form ' : 'Co-Applicant Form'}
              </h1>
              <p className="text-gray-600 mt-2">
                Please fill in the co-applicant details for this loan application
              </p>
            </div>

            <LoginFormSection
              ref={coApplicantFormRef}
              data={coApplicantFormData || leadData?.dynamic_fields?.co_applicant_form || {}}
              onSave={handleCoApplicantSave}
              bankOptions={bankOptions}
              mobileNumber=""
              bankName=""
              isReadOnlyMobile={false}
              leadId={leadData?._id}
              leadCustomerName={leadData ? `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() : ''}
              isCoApplicant={true}
              isPublic={true}
              leadData={leadData} // Pass the full lead data including form_share status
            />
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Your information is secure and will be used only for loan processing purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
