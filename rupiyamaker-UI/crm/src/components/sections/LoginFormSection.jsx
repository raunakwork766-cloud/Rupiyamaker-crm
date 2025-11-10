import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Share2, X, Download } from "lucide-react";
import * as XLSX from 'xlsx';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

const QUALIFICATIONS = ["10", "12", "Graduate", "Master", "Phd"];
const MARITAL_STATUS = ["Single", "Married"];
const ADDRESS_TYPES = ["Owned", "Rented", "Company provided"];
const ADDRESS_PROOFS = ["Aadhar", "Utility Bill", "Rent Agreement", "Passport"];
const REFERENCE_RELATIONS = ["Friend", "Relative", "Colleague", "Other"];

const LoginFormSection = forwardRef(function LoginFormSection({
  data,
  onSave,
  bankOptions = [],
  mobileNumber = "",
  bankName = "",
  leadCustomerName = "",
  isCoApplicant = false,
  leadId = null,
  isReadOnlyMobile = false,
  isPublic = false,
  leadData = null, // Add leadData prop to access form_share and other lead info
  canEdit = true // Add canEdit prop for permission-based editing
}, ref) {
  // Add state for save status indicator
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Add state for searchable bank dropdown
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [bankSearch, setBankSearch] = useState(() => {
    // Initialize with the current bank name from data or bankName prop
    return data?.salaryAccountBank || bankName || '';
  });
  
  // Create ref for dropdown
  const bankDropdownRef = useRef(null);

  const [fields, setFields] = useState({
    // For co-applicants, only pre-fill reference name if it exists in their own data
    referenceNameForLogin: isCoApplicant ? (data?.referenceNameForLogin || "") : (data?.referenceNameForLogin || ""),
    // Exclude sensitive fields for public forms and co-applicants get fresh fields
    ...(isPublic ? {} : {
      aadharNumber: isCoApplicant ? (data?.aadharNumber || "") : (data?.aadharNumber || ""),
      panCard: isCoApplicant ? (data?.panCard || "") : (data?.panCard || ""),
      salaryAccountBank: isCoApplicant ? (data?.salaryAccountBank || "") : (data?.salaryAccountBank || bankName || ""),
      salaryAccountBankNumber: isCoApplicant ? (data?.salaryAccountBankNumber || "") : (data?.salaryAccountBankNumber || ""),
      fathersName: isCoApplicant ? (data?.fathersName || "") : (data?.fathersName || ""),
      ifscCode: isCoApplicant ? (data?.ifscCode || "") : (data?.ifscCode || ""),
    }),
    qualification: isCoApplicant ? (data?.qualification || "") : (data?.qualification || ""),
    customerName: isCoApplicant ? (data?.customerName || "") : (data?.customerName || leadCustomerName || ""),
    mobileNumber: isCoApplicant ? (data?.mobileNumber || "") : (data?.mobileNumber || mobileNumber || ""),
    alternateNumber: isCoApplicant ? (data?.alternateNumber || "") : (data?.alternateNumber || (leadData?.alternative_phone) || ""),
    mothersName: isCoApplicant ? (data?.mothersName || "") : (data?.mothersName || ""),
    maritalStatus: isCoApplicant ? (data?.maritalStatus || "") : (data?.maritalStatus || ""),
    spousesName: isCoApplicant ? (data?.spousesName || "") : (data?.spousesName || ""),
    spousesDob: isCoApplicant ? (data?.spousesDob || "") : (data?.spousesDob || ""),
    currentAddress: isCoApplicant ? (data?.currentAddress || "") : (data?.currentAddress || ""),
    currentAddressLandmark: isCoApplicant ? (data?.currentAddressLandmark || "") : (data?.currentAddressLandmark || ""),
    currentAddressType: isCoApplicant ? (data?.currentAddressType || "") : (data?.currentAddressType || ""),
    currentAddressProof: isCoApplicant ? (data?.currentAddressProof || "") : (data?.currentAddressProof || ""),
    yearsAtCurrentAddress: isCoApplicant ? (data?.yearsAtCurrentAddress || "") : (data?.yearsAtCurrentAddress || ""),
    yearsInCurrentCity: isCoApplicant ? (data?.yearsInCurrentCity || "") : (data?.yearsInCurrentCity || ""),
    permanentAddress: isCoApplicant ? (data?.permanentAddress || "") : (data?.permanentAddress || ""),
    permanentAddressLandmark: isCoApplicant ? (data?.permanentAddressLandmark || "") : (data?.permanentAddressLandmark || ""),
    companyName: isCoApplicant ? (data?.companyName || "") : (data?.companyName || ""),
    yourDesignation: isCoApplicant ? (data?.yourDesignation || "") : (data?.yourDesignation || ""),
    yourDepartment: isCoApplicant ? (data?.yourDepartment || "") : (data?.yourDepartment || ""),
    dojCurrentCompany: isCoApplicant ? (data?.dojCurrentCompany || "") : (data?.dojCurrentCompany || ""),
    currentWorkExperience: isCoApplicant ? (data?.currentWorkExperience || "") : (data?.currentWorkExperience || ""),
    totalWorkExperience: isCoApplicant ? (data?.totalWorkExperience || "") : (data?.totalWorkExperience || ""),
    personalEmail: isCoApplicant ? (data?.personalEmail || "") : (data?.personalEmail || ""),
    workEmail: isCoApplicant ? (data?.workEmail || "") : (data?.workEmail || ""),
    officeAddress: isCoApplicant ? (data?.officeAddress || "") : (data?.officeAddress || ""),
    officeAddressLandmark: isCoApplicant ? (data?.officeAddressLandmark || "") : (data?.officeAddressLandmark || ""),
    // Reference fields for both primary applicants and co-applicants
    ref1Name: data?.ref1Name || "",
    ref1Mobile: data?.ref1Mobile || "",
    ref1Relation: data?.ref1Relation || "",
    ref1Address: data?.ref1Address || "",
    ref2Name: data?.ref2Name || "",
    ref2Mobile: data?.ref2Mobile || "",
    ref2Relation: data?.ref2Relation || "",
    ref2Address: data?.ref2Address || "",
  });

  const [showSharePopup, setShowSharePopup] = useState(false);

  // Sync fields with data prop changes
  useEffect(() => {
    console.log('🔄 [sections/LoginFormSection] useEffect triggered');
    console.log('📦 data prop:', data);
    console.log('📦 data keys:', Object.keys(data || {}));
    console.log('📦 data.referenceNameForLogin:', data?.referenceNameForLogin);
    console.log('📦 data.aadharNumber:', data?.aadharNumber);
    console.log('📦 data.panCard:', data?.panCard);
    console.log('📦 leadCustomerName:', leadCustomerName);
    console.log('📦 mobileNumber:', mobileNumber);
    console.log('📦 bankName:', bankName);
    
    setFields({
      // For co-applicants, only use their own data, not fallback to primary applicant's data
      referenceNameForLogin: isCoApplicant ? (data?.referenceNameForLogin || "") : (data?.referenceNameForLogin || ""),
      aadharNumber: isCoApplicant ? (data?.aadharNumber || "") : (data?.aadharNumber || ""),
      qualification: isCoApplicant ? (data?.qualification || "") : (data?.qualification || ""),
      customerName: isCoApplicant ? (data?.customerName || "") : (data?.customerName || leadCustomerName || ""),
      panCard: isCoApplicant ? (data?.panCard || "") : (data?.panCard || ""),
      salaryAccountBank: isCoApplicant ? (data?.salaryAccountBank || "") : (data?.salaryAccountBank || bankName || ""),
      salaryAccountBankNumber: isCoApplicant ? (data?.salaryAccountBankNumber || "") : (data?.salaryAccountBankNumber || ""),
      mobileNumber: isCoApplicant ? (data?.mobileNumber || "") : (data?.mobileNumber || mobileNumber || ""),
      alternateNumber: isCoApplicant ? (data?.alternateNumber || "") : (data?.alternateNumber || (leadData?.alternative_phone) || ""),
      fathersName: isCoApplicant ? (data?.fathersName || "") : (data?.fathersName || ""),
      ifscCode: isCoApplicant ? (data?.ifscCode || "") : (data?.ifscCode || ""),
      mothersName: isCoApplicant ? (data?.mothersName || "") : (data?.mothersName || ""),
      maritalStatus: isCoApplicant ? (data?.maritalStatus || "") : (data?.maritalStatus || ""),
      spousesName: isCoApplicant ? (data?.spousesName || "") : (data?.spousesName || ""),
      spousesDob: isCoApplicant ? (data?.spousesDob || "") : (data?.spousesDob || ""),
      currentAddress: isCoApplicant ? (data?.currentAddress || "") : (data?.currentAddress || ""),
      currentAddressLandmark: isCoApplicant ? (data?.currentAddressLandmark || "") : (data?.currentAddressLandmark || ""),
      currentAddressType: isCoApplicant ? (data?.currentAddressType || "") : (data?.currentAddressType || ""),
      currentAddressProof: isCoApplicant ? (data?.currentAddressProof || "") : (data?.currentAddressProof || ""),
      yearsAtCurrentAddress: isCoApplicant ? (data?.yearsAtCurrentAddress || "") : (data?.yearsAtCurrentAddress || ""),
      yearsInCurrentCity: isCoApplicant ? (data?.yearsInCurrentCity || "") : (data?.yearsInCurrentCity || ""),
      permanentAddress: isCoApplicant ? (data?.permanentAddress || "") : (data?.permanentAddress || ""),
      permanentAddressLandmark: isCoApplicant ? (data?.permanentAddressLandmark || "") : (data?.permanentAddressLandmark || ""),
      companyName: isCoApplicant ? (data?.companyName || "") : (data?.companyName || ""),
      yourDesignation: isCoApplicant ? (data?.yourDesignation || "") : (data?.yourDesignation || ""),
      yourDepartment: isCoApplicant ? (data?.yourDepartment || "") : (data?.yourDepartment || ""),
      dojCurrentCompany: isCoApplicant ? (data?.dojCurrentCompany || "") : (data?.dojCurrentCompany || ""),
      currentWorkExperience: isCoApplicant ? (data?.currentWorkExperience || "") : (data?.currentWorkExperience || ""),
      totalWorkExperience: isCoApplicant ? (data?.totalWorkExperience || "") : (data?.totalWorkExperience || ""),
      personalEmail: isCoApplicant ? (data?.personalEmail || "") : (data?.personalEmail || ""),
      workEmail: isCoApplicant ? (data?.workEmail || "") : (data?.workEmail || ""),
      officeAddress: isCoApplicant ? (data?.officeAddress || "") : (data?.officeAddress || ""),
      officeAddressLandmark: isCoApplicant ? (data?.officeAddressLandmark || "") : (data?.officeAddressLandmark || ""),
      // Reference fields for both primary applicants and co-applicants
      ref1Name: data?.ref1Name || "",
      ref1Mobile: data?.ref1Mobile || "",
      ref1Relation: data?.ref1Relation || "",
      ref1Address: data?.ref1Address || "",
      ref2Name: data?.ref2Name || "",
      ref2Mobile: data?.ref2Mobile || "",
      ref2Relation: data?.ref2Relation || "",
      ref2Address: data?.ref2Address || "",
    });
    
    console.log('✅ [sections/LoginFormSection] Fields updated');
    console.log('✅ fields will be set with referenceNameForLogin:', data?.referenceNameForLogin);
    console.log('✅ fields will be set with aadharNumber:', data?.aadharNumber);
  }, [data, bankName, mobileNumber, isCoApplicant, isPublic]);

  // Sync bankSearch with the actual field value when it changes externally
  useEffect(() => {
    setBankSearch(fields.salaryAccountBank || '');
  }, [fields.salaryAccountBank]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target)) {
        setShowBankDropdown(false);
        setBankSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);



  // Auto-resize textareas on component mount and data changes
  useEffect(() => {
    const resizeTextareas = () => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      });
    };

    // Resize after a short delay to ensure DOM is updated
    const timer = setTimeout(resizeTextareas, 100);
    return () => clearTimeout(timer);
  }, [fields]);

  const handleChange = (field, value) => {
    // Fields that should not be converted to uppercase (numeric, dates, emails)
    const excludeFromUppercase = [
      'mobileNumber', 'alternateNumber', 'aadharNumber', 'salaryAccountBankNumber',
      'yearsAtCurrentAddress', 'yearsInCurrentCity', 'currentWorkExperience', 'totalWorkExperience',
      'spousesDob', 'dojCurrentCompany', 'personalEmail', 'workEmail',
      'ref1Mobile', 'ref2Mobile'
    ];

    // Convert to uppercase if it's a text field
    const processedValue = excludeFromUppercase.includes(field) || typeof value !== 'string' 
      ? value 
      : value.toUpperCase();

    setFields(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleSaveForm = () => {
    // Call the onSave callback with the current fields
    onSave(fields);
  };
  
  // This method is for saving data without the final submission
  const handleSaveFormWithoutSubmit = () => {
    // Just update the parent's state with current fields, without triggering final submission
    // Create a copy of fields to prevent shared references
    const fieldsCopy = {...fields};
    // Call the standard blur handler which will update local state but not trigger a submission
    handleBlur('_formSwitch', fieldsCopy);
  };
  
  // Function to get current form data without saving
  const getCurrentFormData = () => {
    // Return a copy of the current fields
    return {...fields};
  };
  
  // Expose functions to parent component via ref
  useImperativeHandle(ref, () => ({
    handleSaveForm,
    handleSaveFormWithoutSubmit,
    getCurrentFormData
  }));

  const handleBlur = async (field, value) => {
    // If field is _formSwitch, this is a special case for saving during tab switching
    const isFormSwitch = field === '_formSwitch';
    
    // For _formSwitch, use the full value object passed; otherwise update a single field
    const updatedData = isFormSwitch ? value : { ...fields, [field]: value };
    
    // Update local state
    if (!isFormSwitch) {
      setFields(prev => ({ ...prev, [field]: value }));
    }
    
    // For public forms, just update local state (no auto-save)
    // For internal forms, continue with auto-save behavior
    if (!isPublic || isFormSwitch) {
      // For tab switching (isFormSwitch), we want to save even for public forms
      
      // If we have a leadId, make API call to save the data
      if (leadId) {
        try {
          // Show saving status
          setSaveStatus('Saving...');
          setIsSaving(true);

          const apiBaseUrl = '/api';
          const userId = localStorage.getItem('userId');

          // Prepare data for API - use different structure for applicant vs co-applicant
          const apiData = isCoApplicant ? {
            co_applicant_form: updatedData
          } : {
            applicant_form: updatedData
          };

          // Save immediately on blur without debouncing
          const token = localStorage.getItem('token');
          
          // Determine if this is a login lead by checking leadData for original_lead_id
          const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
          const apiUrl = isLoginLead
            ? `${apiBaseUrl}/lead-login/login-leads/${leadId}/login-form?user_id=${userId}`
            : `${apiBaseUrl}/leads/${leadId}/login-form?user_id=${userId}`;
          
          console.log(`📡 LoginFormSection: Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);

          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Validate that the response indicates success
          const responseData = await response.json();
          
          // Check if response has success or acknowledged flag, or if response is valid
          // Accept response if: success is true, acknowledged is true, or response has data property
          if (responseData.success === false || (responseData.acknowledged === false && !responseData.success)) {
            console.warn('API returned 200 but success flag is false:', responseData);
            throw new Error('API reported success but did not confirm data was saved');
          }

          // Refresh lead data to get the latest from backend
          try {
            const refreshUrl = isLoginLead
              ? `${apiBaseUrl}/lead-login/login-leads/${leadId}?user_id=${userId}`
              : `${apiBaseUrl}/leads/${leadId}?user_id=${userId}`;
            const refreshResponse = await fetch(refreshUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (refreshResponse.ok) {
              const updatedLead = await refreshResponse.json();
              // Get updated form data based on co-applicant flag
              const updatedFormData = isCoApplicant
                ? updatedLead.dynamic_fields?.co_applicant_form
                : updatedLead.dynamic_fields?.applicant_form;

              if (updatedFormData) {
                // Call onSave with the latest data from backend
                onSave(updatedFormData);
              }

              // Update status to saved
              setSaveStatus('Saved');

              // Clear status after 2 seconds
              setTimeout(() => {
                setSaveStatus('');
              }, 2000);
            }
          } catch (error) {
            console.error('Error in refresh callback:', error);
            setSaveStatus('Saved (refresh failed)');

            // Clear error status after 2 seconds
            setTimeout(() => {
              setSaveStatus('');
            }, 2000);
          }

        } catch (error) {
          console.error('Error saving form data:', error);
          setSaveStatus('Error saving');

          // Clear error status after 3 seconds
          setTimeout(() => {
            setSaveStatus('');
          }, 3000);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const getInputProps = (fieldName, fieldValue) => ({
    className: canEdit ? inputClass : inputReadOnlyClass,
    style: canEdit ? inputStyle : inputReadOnlyStyle,
    value: fieldValue,
    onChange: canEdit ? (e => handleChange(fieldName, e.target.value)) : undefined,
    readOnly: !canEdit,
    // For all forms, call handleBlur on blur to ensure values are updated properly
    // For public forms, handleBlur will just update local state
    ...(canEdit ? { onBlur: e => handleBlur(fieldName, e.target.value) } : {})
  });

  const getSelectProps = (fieldName, fieldValue) => ({
    className: canEdit ? inputClass : inputReadOnlyClass,
    style: canEdit ? inputStyle : inputReadOnlyStyle,
    value: fieldValue,
    onChange: canEdit ? (e => {
      const newValue = e.target.value;
      // First update the fields state
      handleChange(fieldName, newValue);
      // For dropdowns, we need to manually save the value for both public and non-public forms
      // Set a timeout to ensure the state is updated before calling handleBlur
      setTimeout(() => {
        handleBlur(fieldName, newValue);
      }, 0);
    }) : undefined,
    disabled: !canEdit
  });

  const getTextareaProps = (fieldName, fieldValue) => ({
    className: canEdit ? `${inputClass} resize-none overflow-hidden` : `${inputReadOnlyClass} resize-none overflow-hidden`,
    value: fieldValue,
    onChange: canEdit ? (e => {
      handleChange(fieldName, e.target.value);
      // Auto-resize textarea
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }) : undefined,
    onInput: canEdit ? (e => {
      // Ensure height adjusts on input
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }) : undefined,
    style: { minHeight: '40px', maxHeight: '200px', fontSize: '18px' },
    rows: 1,
    readOnly: !canEdit,
    // For all forms, call handleBlur on blur to ensure values are updated properly
    // For public forms, handleBlur will just update local state
    ...(canEdit ? { onBlur: e => handleBlur(fieldName, e.target.value) } : {})
  });

  const handleShare = () => {
    // Directly generate and show share link without opening popup
    handleGenerateShareLink();
  };

  const handleExportToExcel = () => {
    try {
      // Create data array for Excel export
      const exportData = [];

      // Add reference name for login for both primary applicant and co-applicant
      exportData.push({ Field: "Reference Name For Login", Value: fields.referenceNameForLogin || "null" });

      // Add all other fields for both applicant types
      exportData.push(
        { Field: "Aadhar Number", Value: fields.aadharNumber || "null" },
        { Field: "PAN Card", Value: fields.panCard || "null" },
        { Field: "Father's Name", Value: fields.fathersName || "null" },
        { Field: "Salary Account Bank", Value: fields.salaryAccountBank || "null" },
        { Field: "Salary Account Bank Number", Value: fields.salaryAccountBankNumber || "null" },
        { Field: "IFSC Code", Value: fields.ifscCode || "null" },
        { Field: "Customer Name", Value: fields.customerName || "null" },
        { Field: "Mobile Number", Value: fields.mobileNumber || "null" },
        { Field: "Alternate Number", Value: fields.alternateNumber || "null" },
        { Field: "Qualification", Value: fields.qualification || "null" },
        { Field: "Mother's Name", Value: fields.mothersName || "null" },
        { Field: "Marital Status", Value: fields.maritalStatus || "null" },
        { Field: "Spouse Name", Value: fields.spousesName || "null" },
        { Field: "Spouse's DOB", Value: fields.spousesDob || "null" },
        { Field: "Current Address", Value: fields.currentAddress || "null" },
        { Field: "Current Address Landmark", Value: fields.currentAddressLandmark || "null" },
        { Field: "Current Address Type", Value: fields.currentAddressType || "null" },
        { Field: "Current Address Proof", Value: fields.currentAddressProof || "null" },
        { Field: "Years at Current Address", Value: fields.yearsAtCurrentAddress || "null" },
        { Field: "Years in Current City", Value: fields.yearsInCurrentCity || "null" },
        { Field: "Permanent Address", Value: fields.permanentAddress || "null" },
        { Field: "Permanent Address Landmark", Value: fields.permanentAddressLandmark || "null" },
        { Field: "Company Name", Value: fields.companyName || "null" },
        { Field: "Your Designation", Value: fields.yourDesignation || "null" },
        { Field: "Your Department", Value: fields.yourDepartment || "null" },
        { Field: "DOJ in Current Company", Value: fields.dojCurrentCompany || "null" },
        { Field: "Current Work Experience", Value: fields.currentWorkExperience || "null" },
        { Field: "Total Work Experience", Value: fields.totalWorkExperience || "null" },
        { Field: "Personal Email", Value: fields.personalEmail || "null" },
        { Field: "Work Email", Value: fields.workEmail || "null" },
        { Field: "Office Address", Value: fields.officeAddress || "null" },
        { Field: "Office Address Landmark", Value: fields.officeAddressLandmark || "null" }
      );

      // Add reference fields for both primary applicant and co-applicant
      exportData.push(
        { Field: "Reference 1 - Name", Value: fields.ref1Name || "null" },
        { Field: "Reference 1 - Mobile", Value: fields.ref1Mobile || "null" },
        { Field: "Reference 1 - Relation", Value: fields.ref1Relation || "null" },
        { Field: "Reference 1 - Address", Value: fields.ref1Address || "null" },
        { Field: "Reference 2 - Name", Value: fields.ref2Name || "null" },
        { Field: "Reference 2 - Mobile", Value: fields.ref2Mobile || "null" },
        { Field: "Reference 2 - Relation", Value: fields.ref2Relation || "null" },
        { Field: "Reference 2 - Address", Value: fields.ref2Address || "null" }
      );

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Field column
        { wch: 50 }  // Value column
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, isCoApplicant ? "Co-Applicant Form" : "Applicant Form");

      // Generate filename with customer name and timestamp
      const customerName = fields.customerName || "Customer";
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${customerName}_${isCoApplicant ? 'Co-Applicant' : 'Applicant'}_Form_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      alert(`Excel file "${filename}" has been downloaded successfully!`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  };

  const handleGenerateShareLink = async () => {
    try {
      // First, update the lead to set form_share to true (enable form sharing)
      if (leadId) {
        const userId = localStorage.getItem('userId');
        let token = localStorage.getItem('token');

        // If token is not available directly, try to get it from userData
        if (!token) {
          const userData = localStorage.getItem('userData');
          if (userData) {
            try {
              const userDataObj = JSON.parse(userData);
              token = userDataObj.token;
            } catch (e) {
              console.error('Error parsing userData:', e);
            }
          }
        }

        if (userId && token) {
          const updateResponse = await fetch(`${API_BASE_URL}/leads/${leadId}?user_id=${userId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              form_share: true
            })
          });

          const responseText = await updateResponse.text();

          if (updateResponse.ok) {
            const formType = isCoApplicant ? 'Co-Applicant' : 'Applicant';
            alert(`${formType} form sharing enabled! Generating share link...`);
          } else {
            alert(`Warning: Failed to enable form sharing (${updateResponse.status}). Link will still be generated.`);
          }
        } else {
          alert('Warning: Missing authentication credentials. Link will still be generated.');
        }
      } else {
      }

      // Generate shareable link for specific form only
      // Create independent URLs that restrict access to only the shared form type
      const baseUrl = `${window.location.origin}/public/login-form/${mobileNumber || 'guest'}`;
      let formUrl;
      
      if (isCoApplicant) {
        // Co-applicant form link - only shows co-applicant form, no tab switching
        formUrl = leadId 
          ? `${baseUrl}?leadId=${leadId}&coApplicant=true&restrictTo=coApplicant` 
          : `${baseUrl}?coApplicant=true&restrictTo=coApplicant`;
      } else {
        // Applicant form link - only shows applicant form, no tab switching
        formUrl = leadId 
          ? `${baseUrl}?leadId=${leadId}&restrictTo=applicant` 
          : `${baseUrl}?restrictTo=applicant`;
      }

      if (navigator.share) {
        // Use native sharing if available (mobile devices)
        const formType = isCoApplicant ? 'Co-Applicant' : 'Applicant';
        const shareText = isCoApplicant 
          ? `Please fill out this Co-Applicant form for ${leadCustomerName || data?.customerName || data?.name || 'Customer'}. This link provides access ONLY to the Co-Applicant form.`
          : `Please fill out this Applicant form for ${leadCustomerName || data?.customerName || data?.name || 'Customer'}. This link provides access ONLY to the Applicant form.`;
          
        navigator.share({
          title: `${formType} Form (Restricted Access)`,
          text: shareText,
          url: formUrl,
        }).catch(err => {
          // Silently handle sharing errors
        });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(formUrl).then(() => {
          const formType = isCoApplicant ? 'Co-Applicant' : 'Applicant';
          const description = isCoApplicant 
            ? 'This link provides access ONLY to the Co-Applicant form. Users cannot switch to the Applicant form.' 
            : 'This link provides access ONLY to the Applicant form. Users cannot switch to the Co-Applicant form.';
          alert(`${formType} Form link copied to clipboard!\n\n${description}\n\nShare this link: ${formUrl}`);
        }).catch(err => {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = formUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          const formType = isCoApplicant ? 'Co-Applicant' : 'Applicant';
          const description = isCoApplicant 
            ? 'This link provides access ONLY to the Co-Applicant form. Users cannot switch to the Applicant form.' 
            : 'This link provides access ONLY to the Applicant form. Users cannot switch to the Co-Applicant form.';
          alert(`${formType} Form link copied to clipboard!\n\n${description}\n\nShare this link: ${formUrl}`);
        });
      }
    } catch (error) {
      alert('Error: ' + error.message);

      // Still generate the link even if the API call fails
      const baseUrl = `${window.location.origin}/public/login-form/${mobileNumber || 'guest'}`;
      let formUrl;
      
      if (isCoApplicant) {
        // Co-applicant form link - only shows co-applicant form, no tab switching
        formUrl = leadId 
          ? `${baseUrl}?leadId=${leadId}&coApplicant=true&restrictTo=coApplicant` 
          : `${baseUrl}?coApplicant=true&restrictTo=coApplicant`;
      } else {
        // Applicant form link - only shows applicant form, no tab switching
        formUrl = leadId 
          ? `${baseUrl}?leadId=${leadId}&restrictTo=applicant` 
          : `${baseUrl}?restrictTo=applicant`;
      }

      // Fallback: copy to clipboard
      navigator.clipboard.writeText(formUrl).then(() => {
        const formType = isCoApplicant ? 'Co-Applicant' : 'Applicant';
        const description = isCoApplicant 
          ? 'This link provides access ONLY to the Co-Applicant form. Users cannot switch to the Applicant form.' 
          : 'This link provides access ONLY to the Applicant form. Users cannot switch to the Co-Applicant form.';
        alert(`${formType} Form link copied to clipboard (fallback)!\n\n${description}\n\nShare this link: ${formUrl}`);
      }).catch(err => {
        alert('Form URL: ' + formUrl);
      });
    }
  }; const handleCopyToCoApplicant = async () => {
    try {
      // Copy current form data but clear personal identifiers for co-applicant
      const coApplicantData = {
        ...fields,
        // Clear personal identifiers that should be unique per person
        customerName: "",
        aadharNumber: "",
        panCard: "",
        mobileNumber: "",
        alternateNumber: "",
        personalEmail: "",
        // Keep non-personal data like address, company info that might be similar
        // Clear reference name as it's specific to primary applicant
        referenceNameForLogin: "",
      };

      // If leadId is available, save co-applicant data to API
      if (leadId) {
        const userId = localStorage.getItem('userId');
        if (userId) {
          const apiUrl = `/api/leads/${leadId}?user_id=${userId}`;
          const updateData = {
            dynamic_fields: {
              co_applicant_form: coApplicantData
            }
          };

          const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(updateData)
          });

          if (response.ok) {
            alert('Co-applicant form created successfully with copied data!\nPersonal details have been cleared for the co-applicant to fill.');
            // Trigger parent component to refresh and show co-applicant form
            if (onSave) {
              // Save current applicant data and signal co-applicant creation
              onSave({ ...fields, _coApplicantCreated: true });
            }
            // Refresh the page to ensure co-applicant section is visible
            window.location.reload();
          } else {
            throw new Error('Failed to create co-applicant form');
          }
        }
      }

      setShowSharePopup(false);
    } catch (error) {
      console.error('Error creating co-applicant form:', error);
      alert('Error creating co-applicant form. Please try again.');
    }
  };

  // Helper function to determine if we should show reference fields
  // Show reference fields for both primary applicants and co-applicants
  const shouldShowReferenceFields = () => {
    return true; // Show for both primary and co-applicant
  };

  // Style classes to match About/HowToProcess sections
  const labelClass = "block font-bold mb-2 uppercase";
  const labelStyle = { color: "black", fontWeight: 650, fontSize: "15px" };
  const inputClass =
    "w-full px-2 py-2 border border-black rounded text-green-600 font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 h-10";
  const inputStyle = { fontSize: "15px" };
  const inputReadOnlyClass =
    "w-full px-2 py-2 border border-black rounded text-green-600 font-bold bg-gray-100 cursor-not-allowed h-10";
  const inputReadOnlyStyle = { fontSize: "15px" };

  return (
    <div className="p-4 rounded-2xl border-2 border-cyan-400/70 bg-white shadow-2xl space-y-6">{/* Removed form tag since no submit button */}
      {/* Save status indicator */}
      {saveStatus && (
        <div className={`text-sm font-semibold mb-2 ${saveStatus === 'Saved' ? 'text-green-500' :
            saveStatus === 'Saving...' ? 'text-blue-500' :
              'text-red-500'
          }`}>
          {saveStatus}
        </div>
      )}

      {/* Read-only indicator banner */}
      {!canEdit && !isPublic && (
        <div className="p-3 rounded-lg bg-gray-100 border-l-4 border-gray-500 mb-4">
          <div className="flex items-center">
            <div className="text-gray-700 font-semibold">
              🔒 Read-Only Mode: You don't have permission to edit login form fields
            </div>
          </div>
        </div>
      )}

      {/* Share and Export Buttons at the top - show separate share buttons for applicant and co-applicant */}
      {!isPublic && canEdit && (
        <div className="flex justify-between items-center mb-6">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center text-xl gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-300"
          >
            <Share2 className="w-5 h-5" />
            {isCoApplicant ? 'Share Co-Applicant Form' : 'Share Applicant Form'}
          </button>
          
          {/* Export button only for primary applicant */}
          {!isCoApplicant && (
            <button
              type="button"
              onClick={handleExportToExcel}
              className="flex items-center text-xl gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300"
            >
              <Download className="w-5 h-5" />
              Export to Excel
            </button>
          )}
        </div>
      )}

      {/* Export Button for Co-Applicant and not on public form */}
      {isCoApplicant && !isPublic && canEdit && (
        <div className="flex justify-end items-center mb-6">
          <button
            type="button"
            onClick={handleExportToExcel}
            className="flex items-center text-xl gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300"
          >
            <Download className="w-5 h-5" />
            Export to Excel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 items-start">
        {/* Show reference name for both primary applicant and co-applicant, but not on public form */}
        {!isPublic && (
          <div className="flex flex-col h-full">
            <label className={labelClass} style={labelStyle}>Login Call Reference</label>
            <input
              {...getInputProps("referenceNameForLogin", fields.referenceNameForLogin)}
            />
          </div>
        )}
        {/* Hide sensitive fields (Aadhar, PAN, Father's name, Bank details) only for public forms */}
        {!isPublic && (
          <>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Aadhar Number</label>
              <input
                {...getInputProps("aadharNumber", fields.aadharNumber)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Pan Card</label>
              <input
                {...getInputProps("panCard", fields.panCard)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Father's Name</label>
              <input
                {...getInputProps("fathersName", fields.fathersName)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Salary A/C Bank Name</label>
              <div className="relative" ref={bankDropdownRef}>
                {/* SearchableSelect-style dropdown button */}
                <div
                  className={`w-full px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between ${
                    (isPublic || !canEdit) 
                      ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                      : 'bg-white text-black border-black hover:border-cyan-400 focus:border-cyan-400'
                  } ${showBankDropdown ? 'border-cyan-400' : ''}`}
                  onClick={() => {
                    if (!isPublic && canEdit) {
                      setShowBankDropdown(!showBankDropdown);
                      if (!showBankDropdown) {
                        setBankSearch('');
                      }
                    }
                  }}
                  style={{fontSize: "15px", fontWeight: 'bold', color: fields.salaryAccountBank ? '#16a34a' : '#6b7280'}}
                >
                  <span className="flex-1">
                    {fields.salaryAccountBank || "Select Bank"}
                  </span>
                  <svg 
                    className={`w-5 h-5 transition-transform ${showBankDropdown ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* SearchableSelect-style dropdown menu */}
                {showBankDropdown && !isPublic && canEdit && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                    {/* Search input */}
                    <div className="p-3 border-b border-gray-200">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:border-cyan-400"
                          placeholder="Search banks..."
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-60 overflow-y-auto">
                      {/* Clear option */}
                      {fields.salaryAccountBank && (
                        <div
                          className="px-3 py-2 cursor-pointer text-red-600 hover:bg-red-50 border-b border-gray-100 font-medium"
                          onClick={() => {
                            handleChange("salaryAccountBank", "");
                            setBankSearch("");
                            setShowBankDropdown(false);
                          }}
                        >
                          ✕ Clear Selection
                        </div>
                      )}

                      {(() => {
                        const availableBanks = bankOptions && bankOptions.length > 0 
                          ? bankOptions 
                          : ["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"];
                        
                        const filteredBanks = availableBanks.filter(bank =>
                          bank.toLowerCase().includes((bankSearch || '').toLowerCase())
                        );
                        
                        if (filteredBanks.length === 0) {
                          return (
                            <div className="px-3 py-2 text-gray-500 text-center">
                              {bankSearch ? `No results found for "${bankSearch}"` : "No banks available"}
                            </div>
                          );
                        }
                        
                        return filteredBanks.map((bank, index) => (
                          <div
                            key={bank || index}
                            className={`px-3 py-2 cursor-pointer text-black hover:bg-gray-100 ${
                              fields.salaryAccountBank === bank ? 'bg-sky-50 text-sky-700 font-medium' : ''
                            }`}
                            onClick={() => {
                              handleChange("salaryAccountBank", bank);
                              setBankSearch(bank);
                              setShowBankDropdown(false);
                            }}
                          >
                            {bank}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Salary A/C Bank Number</label>
              <input
                {...getInputProps("salaryAccountBankNumber", fields.salaryAccountBankNumber)}
                placeholder="Enter salary account number"
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>IFSC Code</label>
              <input
                {...getInputProps("ifscCode", fields.ifscCode)}
              />
            </div>
          </>
        )}

        {/* Visual Separator Line - show for both primary applicant and co-applicant, but not on public form */}
        {!isPublic && (
          <div className="col-span-full">
            <div className="border-t-2 border-cyan-400/70 my-6">
            </div>
          </div>
        )}

        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Customer Name</label>
          <input
            {...getInputProps("customerName", fields.customerName)}
          />
        </div>


        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Mobile Number</label>
          {/* For co-applicant, mobile number should be editable. For primary applicant, keep read-only */}
          <input
            {...(isCoApplicant ? getInputProps("mobileNumber", fields.mobileNumber) : {
              className: inputReadOnlyClass,
              style: inputReadOnlyStyle,
              value: fields.mobileNumber,
              readOnly: true
            })}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Alternate Number</label>
          <input
            {...getInputProps("alternateNumber", fields.alternateNumber)}
            placeholder="Enter alternate mobile number"
          />
        </div>

        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Qualification</label>
          <select
            {...getSelectProps("qualification", fields.qualification)}
          >
            <option value="">Select</option>
            {QUALIFICATIONS.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Mother's Name</label>
          <input
            {...getInputProps("mothersName", fields.mothersName)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Marital Status</label>
          <select
            {...getSelectProps("maritalStatus", fields.maritalStatus)}
          >
            <option value="">Select</option>
            {MARITAL_STATUS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {fields.maritalStatus === "Married" && (
          <>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Spouse Name</label>
              <input
                {...getInputProps("spousesName", fields.spousesName)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Spouse's DOB</label>
              <input
                type="date"
                {...getInputProps("spousesDob", fields.spousesDob)}
              />
            </div>
          </>
        )}
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Current Address</label>
          <textarea
            {...getTextareaProps("currentAddress", fields.currentAddress)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Current Address Landmark</label>
          <input
            {...getInputProps("currentAddressLandmark", fields.currentAddressLandmark)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Current Address Type</label>
          <select
            {...getSelectProps("currentAddressType", fields.currentAddressType)}
          >
            <option value="">Select</option>
            {ADDRESS_TYPES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Current Address Proof</label>
          <select
            {...getSelectProps("currentAddressProof", fields.currentAddressProof)}
          >
            <option value="">Select</option>
            {ADDRESS_PROOFS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>No of Years Living in Current Addr.</label>
          <input
            type="number"
            {...getInputProps("yearsAtCurrentAddress", fields.yearsAtCurrentAddress)}
            min="0"
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>No of Years Living in Current City</label>
          <input
            type="number"
            {...getInputProps("yearsInCurrentCity", fields.yearsInCurrentCity)}
            min="0"
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Permanent Address</label>
          <textarea
            {...getTextareaProps("permanentAddress", fields.permanentAddress)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Permanent Address Landmark</label>
          <input
            {...getInputProps("permanentAddressLandmark", fields.permanentAddressLandmark)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Company Name</label>
          <input
            {...getInputProps("companyName", fields.companyName)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Your Designation</label>
          <input
            {...getInputProps("yourDesignation", fields.yourDesignation)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Your Department</label>
          <input
            {...getInputProps("yourDepartment", fields.yourDepartment)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>DOJ in Current Company</label>
          <input
            type="date"
            {...getInputProps("dojCurrentCompany", fields.dojCurrentCompany)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Current Work Experience (years)</label>
          <input
            type="number"
            {...getInputProps("currentWorkExperience", fields.currentWorkExperience)}
            min="0"
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Total Work Experience (years)</label>
          <input
            type="number"
            {...getInputProps("totalWorkExperience", fields.totalWorkExperience)}
            min="0"
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Personal Email</label>
          <input
            type="email"
            {...getInputProps("personalEmail", fields.personalEmail)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Work Email</label>
          <input
            type="email"
            {...getInputProps("workEmail", fields.workEmail)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Office Address</label>
          <textarea
            {...getTextareaProps("officeAddress", fields.officeAddress)}
          />
        </div>
        <div className="flex flex-col h-full">
          <label className={labelClass} style={labelStyle}>Office Address Landmark</label>
          <input
            {...getInputProps("officeAddressLandmark", fields.officeAddressLandmark)}
          />
        </div>
      </div>

      {/* Reference sections - only show for primary applicant */}
      {shouldShowReferenceFields() && (
        <>
          {/* 1st Reference */}
          <div className="mt-8 mb-2 font-extrabold text-[#00AEEF] text-base">1st Reference</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Name</label>
              <input
                {...getInputProps("ref1Name", fields.ref1Name)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Mobile Number</label>
              <input
                {...getInputProps("ref1Mobile", fields.ref1Mobile)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Relation</label>
              <select
                {...getSelectProps("ref1Relation", fields.ref1Relation)}
              >
                <option value="">Select</option>
                {REFERENCE_RELATIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Address</label>
              <textarea
                {...getTextareaProps("ref1Address", fields.ref1Address)}
              />
            </div>
          </div>

          {/* 2nd Reference */}
          <div className="mt-8 mb-2 font-extrabold text-[#00AEEF] text-base">2nd Reference</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Name</label>
              <input
                {...getInputProps("ref2Name", fields.ref2Name)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Mobile Number</label>
              <input
                {...getInputProps("ref2Mobile", fields.ref2Mobile)}
              />
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Relation</label>
              <select
                {...getSelectProps("ref2Relation", fields.ref2Relation)}
              >
                <option value="">Select</option>
                {REFERENCE_RELATIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col h-full">
              <label className={labelClass} style={labelStyle}>Reference Address</label>
              <textarea
                {...getTextareaProps("ref2Address", fields.ref2Address)}
              />
            </div>
          </div>
        </>
      )}

      {/* Share Popup Modal */}
      {showSharePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-full w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <div className="flex flex-col h-full">
                <h2 className="text-2xl font-bold text-[#00AEEF]">
                  Customer: {leadCustomerName || data?.customerName || data?.name || 'N/A'}
                </h2>
                <p className="text-gray-600 mt-1">Complete your loan application form</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateShareLink}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300"
                >
                  <Share2 className="w-4 h-4" />
                  Generate Share Link
                </button>
                <button
                  onClick={() => setShowSharePopup(false)}
                  className="text-gray-500 hover:text-gray-700 p-2"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
          </div>
    
          {/* Form Content - Only Reference Sections */}
          <div className="p-6">

            {/* Reference sections - only show for primary applicant */}
            {shouldShowReferenceFields() && (
              <>
                {/* 1st Reference */}
                <div className="mt-8 mb-4 font-extrabold text-[#00AEEF] text-lg border-b pb-2">1st Reference</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-4">
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Name *</label>
                    <input
                      {...getInputProps("ref1Name", fields.ref1Name)}
                    />
                  </div>
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Mobile Number *</label>
                    <input
                      {...getInputProps("ref1Mobile", fields.ref1Mobile)}
                    />
                  </div>
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Relation *</label>
                    <select
                      {...getSelectProps("ref1Relation", fields.ref1Relation)}
                    >
                      <option value="">Select</option>
                      {REFERENCE_RELATIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Address *</label>
                    <textarea
                      {...getTextareaProps("ref1Address", fields.ref1Address)}
                    />
                  </div>
                </div>

                {/* 2nd Reference */}
                <div className="mt-8 mb-4 font-extrabold text-[#00AEEF] text-lg border-b pb-2">2nd Reference</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-4">
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Name *</label>
                    <input
                      {...getInputProps("ref2Name", fields.ref2Name)}
                    />
                  </div>
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Mobile Number *</label>
                    <input
                      {...getInputProps("ref2Mobile", fields.ref2Mobile)}
                    />
                  </div>
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Relation *</label>
                    <select
                      {...getSelectProps("ref2Relation", fields.ref2Relation)}
                    >
                      <option value="">Select</option>
                      {REFERENCE_RELATIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col h-full">
                    <label className={labelClass} style={labelStyle}>Reference Address *</label>
                    <textarea
                      {...getTextareaProps("ref2Address", fields.ref2Address)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="mt-8 p-4 bg-green-50 rounded-lg">
              {isPublic ? (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={handleSaveForm}
                    className="flex items-center text-lg gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 mb-4"
                  >
                    Save Form
                  </button>
                  <p className="text-blue-700 font-medium">
                    Click Save Form button to submit your information
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-green-700 font-medium">
                    ✓ All changes are saved automatically as you fill the form
                  </p>
                  <p className="text-xl text-green-600 mt-1">
                    You can close this window anytime and your progress will be saved
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Footer with save button - always visible for public forms */}
    {isPublic && (
      <div className="mt-8 p-4 bg-green-50 rounded-lg">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={handleSaveForm}
            className="flex items-center text-lg gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 mb-4"
          >
            Save Form
          </button>
          <p className="text-blue-700 font-medium">
            Click Save Form button to submit your information
          </p>
        </div>
      </div>
    )}

    </div>
  );
});

export default LoginFormSection;