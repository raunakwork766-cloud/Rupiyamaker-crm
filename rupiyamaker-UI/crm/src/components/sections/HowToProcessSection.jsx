import { useState, useEffect, useRef } from "react";

export default function HowToProcessSection({ process, onSave, lead, canEdit = true }) {
  // For dummy data, ensure process has default values to prevent errors
  // Also try to get data from lead.dynamic_fields if process is not provided
  const safetyProcess = process || lead?.dynamic_fields?.process || {};
  
  // Default loan types to ensure the dropdown always has these options
  const DEFAULT_LOAN_TYPES = [
    { _id: 'PL', name: 'PL (Personal Loan)' },
    { _id: 'OD', name: 'OD (Overdraft)' },
    { _id: 'CC', name: 'CC (Credit Card)' },
    { _id: 'BL', name: 'BL (Business Loan)' },
    { _id: 'HL', name: 'HL (Home Loan)' },
    { _id: 'LAP', name: 'LAP (Loan Against Property)' },
    { _id: 'AL', name: 'AL (Auto Loan / Car Loan)' },
    { _id: 'EL', name: 'EL (Education Loan)' },
    { _id: 'GL', name: 'GL (Gold Loan)' },
    { _id: 'LOC', name: 'LOC (Loan On Credit Card)' },
    { _id: 'CD', name: 'CD (Consumer Durable Loan)' },
    { _id: 'APP_LOAN', name: 'APP LOAN' },
    { _id: 'INSURANCE', name: 'INSURANCE' }
  ];

  // State for loan types
  const [loanTypes, setLoanTypes] = useState(DEFAULT_LOAN_TYPES);
  // State for selected loan type
  const [selectedLoanType, setSelectedLoanType] = useState(null);
  // State for bank options fetched from API
  const [availableBanks, setAvailableBanks] = useState([]);

  // Dropdown visibility states
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [showLoanTypeDropdown, setShowLoanTypeDropdown] = useState(false);

  // Search terms for dropdowns
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [loanTypeSearchTerm, setLoanTypeSearchTerm] = useState('');

  // Focus state for required tenure field
  const [isTenureFocused, setIsTenureFocused] = useState(false);
  
  // Ref for tenure input field
  const tenureInputRef = useRef(null);

  // Utility function to format number in INR format
  const formatINR = (amount) => {
    if (!amount) return "";
    const numAmount = parseFloat(amount.toString().replace(/[^\d.-]/g, ''));
    if (isNaN(numAmount)) return amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  // Utility function to parse INR formatted string back to number
  const parseINR = (formattedAmount) => {
    if (!formattedAmount) return "";
    return formattedAmount.toString().replace(/[^\d.-]/g, '');
  };

  // Helper function to format year display from tenure
  const formatYearFromTenure = (tenure) => {
    if (!tenure) return "";
    const months = parseInt(tenure) || 0;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years > 0 && remainingMonths > 0) {
      return `${years} years ${remainingMonths} months`;
    } else if (years > 0) {
      return `${years} years`;
    } else if (remainingMonths > 0) {
      return `${remainingMonths} months`;
    }
    return "";
  };

  // Helper function to get display value for tenure field
  const getTenureDisplayValue = () => {
    if (isTenureFocused) {
      // When focused, show only the number
      return fields.requiredTenure.replace(/[^\d]/g, '');
    } else {
      // When not focused, show number with "months" suffix
      const numericValue = fields.requiredTenure.replace(/[^\d]/g, '');
      return numericValue ? `${numericValue} months` : '';
    }
  };

  // Helper function to handle tenure focus
  const handleTenureFocus = (e) => {
    setIsTenureFocused(true);
    // Position cursor at the end of the numeric value
    setTimeout(() => {
      if (tenureInputRef.current) {
        const numericValue = fields.requiredTenure.replace(/[^\d]/g, '');
        tenureInputRef.current.setSelectionRange(numericValue.length, numericValue.length);
      }
    }, 0);
  };

  // Helper function to handle tenure blur
  const handleTenureBlur = (e) => {
    const rawValue = e.target.value.replace(/[^\d]/g, '');
    setIsTenureFocused(false);
    
    // Update the field value with "months" suffix
    if (rawValue) {
      setFields(prev => ({ 
        ...prev, 
        requiredTenure: `${rawValue} months`
      }));
    }
    
    if (!canEdit) return;
    handleBlur("requiredTenure", rawValue);
  };

  const [fields, setFields] = useState({
    processingBank: safetyProcess.processing_bank || lead?.dynamic_fields?.process?.processing_bank || "",
    loanAmountRequired: safetyProcess.loan_amount_required ? formatINR(safetyProcess.loan_amount_required) : (lead?.dynamic_fields?.process?.loan_amount_required ? formatINR(lead.dynamic_fields.process.loan_amount_required) : ""),
    howToProcess: safetyProcess.how_to_process || lead?.dynamic_fields?.process?.how_to_process || "",
    loanType: safetyProcess.loan_type || lead?.dynamic_fields?.process?.loan_type || "",
    requiredTenure: safetyProcess.required_tenure ? `${safetyProcess.required_tenure} months` : (lead?.dynamic_fields?.process?.required_tenure ? `${lead.dynamic_fields.process.required_tenure} months` : ""),
    caseType: safetyProcess.case_type || lead?.dynamic_fields?.process?.case_type || "",
    year: safetyProcess.required_tenure ? formatYearFromTenure(safetyProcess.required_tenure) : (lead?.dynamic_fields?.process?.required_tenure ? formatYearFromTenure(lead.dynamic_fields.process.required_tenure) : ""),
  });
  
  // Label styling (matching LoginFormSection)
  const labelClass = "block font-bold mb-2 uppercase";
  const labelStyle = { color: "black", fontWeight: 650, fontSize: "15px" };
  
  // Ref for the auto-expanding textarea
  const howToProcessTextareaRef = useRef(null);
  
  // Auto-resize function for textarea
  const autoResizeTextarea = (textarea) => {
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to expand as needed
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };
  
  // Enhanced handleChange function to handle auto-resize for howToProcess field
  const handleChangeWithResize = (fieldName, value) => {
    // Convert text to uppercase for the howToProcess field
    const processedValue = fieldName === 'howToProcess' ? value.toUpperCase() : value;
    setFields(prev => ({ ...prev, [fieldName]: processedValue }));
    
    // Auto-resize the textarea if it's the howToProcess field
    if (fieldName === 'howToProcess' && howToProcessTextareaRef.current) {
      // Use setTimeout to ensure the value is updated in DOM before resizing
      setTimeout(() => {
        autoResizeTextarea(howToProcessTextareaRef.current);
      }, 0);
    }
  };
  
  // Update local state if the process prop changes from parent - but only on initial load or lead ID change
  useEffect(() => {
    const currentProcess = process || lead?.dynamic_fields?.process || {};
    const tenure = currentProcess.required_tenure || lead?.dynamic_fields?.process?.required_tenure;
    
    setFields({
      processingBank: currentProcess.processing_bank || lead?.dynamic_fields?.process?.processing_bank || "",
      loanAmountRequired: currentProcess.loan_amount_required ? formatINR(currentProcess.loan_amount_required) : (lead?.dynamic_fields?.process?.loan_amount_required ? formatINR(lead.dynamic_fields.process.loan_amount_required) : ""),
      howToProcess: currentProcess.how_to_process || lead?.dynamic_fields?.process?.how_to_process || "",
      loanType: currentProcess.loan_type || lead?.dynamic_fields?.process?.loan_type || "",
      requiredTenure: tenure ? `${tenure} months` : "",
      caseType: currentProcess.case_type || lead?.dynamic_fields?.process?.case_type || "",
      year: tenure ? formatYearFromTenure(tenure) : "",
    });
    
    // Set selected loan type from lead if available (match by id or name)
    if (lead?.dynamic_fields?.process?.loan_type) {
      const val = lead.dynamic_fields.process.loan_type;
      const matchedLoanType = loanTypes.find(lt => lt._id === val || lt.name === val);
      if (matchedLoanType) {
        setSelectedLoanType(matchedLoanType);
      }
    }
  }, [lead?._id, loanTypes]); // Only depend on lead ID and loanTypes, not the entire lead object
  
  // Load loan types
  useEffect(() => {
    loadLoanTypes();
    loadBankOptions();
  }, []);

  // Auto-resize textarea when howToProcess content changes
  useEffect(() => {
    if (howToProcessTextareaRef.current && fields.howToProcess) {
      autoResizeTextarea(howToProcessTextareaRef.current);
    }
  }, [fields.howToProcess]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowBankDropdown(false);
        setShowLoanTypeDropdown(false);
        setBankSearchTerm('');
        setLoanTypeSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to load bank options from API
  const loadBankOptions = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID available');
        setAvailableBanks(["HDFC", "ICICI", "SBI", "Axis"]);
        return;
      }
      
      const apiUrl = `/api/settings/bank-names?user_id=${userId}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Bank options loaded:', data);
        // Extract bank names from the BankNameInDB objects
        const bankNames = data.filter(bank => bank.is_active).map(bank => bank.name);
        if (bankNames.length > 0) {
          setAvailableBanks(bankNames);
        } else {
          // Fallback to default banks
          setAvailableBanks(["HDFC", "ICICI", "SBI", "Axis"]);
        }
      } else {
        console.warn('Failed to fetch bank options, using fallback');
        setAvailableBanks(["HDFC", "ICICI", "SBI", "Axis"]);
      }
    } catch (error) {
      console.error('Error loading bank options:', error);
      setAvailableBanks(["HDFC", "ICICI", "SBI", "Axis"]);
    }
  };
  
  // Function to load loan types from API
  const loadLoanTypes = async () => {
    // Do not use API loan types — always use the built-in defaults
    try {
      setLoanTypes(DEFAULT_LOAN_TYPES);

      // Set selected loan type if lead has loan_type (match by id or name)
      if (lead?.loan_type) {
        const val = lead.loan_type;
        const matchedLoanType = DEFAULT_LOAN_TYPES.find(lt => lt._id === val || lt.name === val);
        if (matchedLoanType) {
          setSelectedLoanType(matchedLoanType);
        }
      }
    } catch (error) {
      console.error('Error loading default loan types:', error);
    }
  };

  const handleChange = (field, value) => {
    console.log('HowToProcessSection handleChange:', field, value);
    
    // Convert text fields to uppercase (exclude numeric fields)
    let processedValue = value;
    if (typeof value === 'string' && !['loanAmountRequired', 'requiredTenure'].includes(field)) {
      processedValue = value.toUpperCase();
    }
    
    // Auto-calculate year from tenure months
    if (field === 'requiredTenure') {
      const months = parseInt(processedValue.toString().replace(/[^\d]/g, '')) || 0;
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      let yearDisplay = "";
      if (years > 0 && remainingMonths > 0) {
        yearDisplay = `${years} years ${remainingMonths} months`;
      } else if (years > 0) {
        yearDisplay = `${years} years`;
      } else if (remainingMonths > 0) {
        yearDisplay = `${remainingMonths} months`;
      }
      
      // Store the numeric value with "months" suffix when not focused
      const displayValue = isTenureFocused ? processedValue : (processedValue ? `${processedValue} months` : '');
      
      setFields(prev => ({ 
        ...prev, 
        [field]: displayValue,
        year: yearDisplay
      }));
    } else {
      // Create the updated field - update local state immediately for responsive UI
      const updatedFields = { ...fields, [field]: processedValue };
      setFields(updatedFields);
    }
    
    // Only save to parent/backend on blur, not on every keystroke
  };
  
  // This function will be called when a field loses focus (onBlur) - like AboutSection
  const handleBlur = async (field, value) => {
    console.log(`🔍 HowToProcessSection: handleBlur called for field: ${field}, value: ${value}`);
    console.log(`🔍 Current field value: ${fields[field]}`);
    
    // Get the original value from the lead data to compare against
    const getOriginalValue = (field) => {
      const processFieldMap = {
        processingBank: 'processing_bank',
        loanAmountRequired: 'loan_amount_required',
        howToProcess: 'how_to_process',
        loanType: 'loan_type',
        requiredTenure: 'required_tenure',
        caseType: 'case_type',
        year: 'year'
      };
      
      const processField = processFieldMap[field] || field;
      return lead?.dynamic_fields?.process?.[processField] || "";
    };
    
    const originalValue = getOriginalValue(field);
    console.log(`🔍 Original lead value for ${field}: ${originalValue}`);
    
    // For loan amount, tenure, and year fields, we need to compare numbers properly
    let normalizedValue = value;
    let normalizedOriginal = originalValue;
    
    if (field === 'loanAmountRequired') {
      normalizedValue = parseFloat(parseINR(value)) || 0;
      normalizedOriginal = parseFloat(originalValue) || 0;
    } else if (field === 'requiredTenure' || field === 'year') {
      // Remove suffixes and compare as numbers
      normalizedValue = parseInt(value.toString().replace(/[^\d]/g, '')) || 0;
      normalizedOriginal = parseInt(originalValue) || 0;
    }
    
    // Only save if the value has actually changed from the original
    if (normalizedValue === normalizedOriginal || (normalizedValue === 0 && normalizedOriginal === "")) {
      console.log(`⏭️ HowToProcessSection: No change detected for ${field}, skipping save`);
      return;
    }
    
    console.log(`💾 HowToProcessSection: Change detected for ${field}, saving...`);
    
    try {
      // Update local state first to ensure UI reflects change immediately
      setFields(prev => ({ ...prev, [field]: value }));
      
      // Save to API if lead ID is available
      if (lead?._id) {
        console.log(`📡 HowToProcessSection: Saving ${field} to API...`);
        const apiSaveSuccess = await saveToAPI(field, value);
        if (apiSaveSuccess) {
          console.log(`✅ HowToProcessSection: Successfully saved ${field} with value: ${value}`);
        } else {
          console.error(`❌ HowToProcessSection: Failed to save ${field} with value: ${value}`);
        }
      }
      
      // Also call parent onSave callback with complete updated process object
      if (onSave) {
        const updatedProcess = {
          ...process,
          [field]: value
        };
        onSave(updatedProcess);
      }
    } catch (error) {
      console.error(`❌ HowToProcessSection: Error in handleBlur for ${field}:`, error);
    }
  };

  // Filter functions for dropdowns
  const getFilteredBanks = () => {
    if (!bankSearchTerm) return availableBanks;
    return availableBanks.filter(bank => 
      bank.toLowerCase().includes(bankSearchTerm.toLowerCase())
    );
  };

  const getFilteredLoanTypes = () => {
    if (!loanTypeSearchTerm) return loanTypes;
    return loanTypes.filter(loanType => 
      loanType.name.toLowerCase().includes(loanTypeSearchTerm.toLowerCase())
    );
  };

  // Handle loan type selection
  const handleLoanTypeChange = async (loanTypeId) => {
    const selectedLoanType = loanTypes.find(lt => lt._id === loanTypeId);
    setSelectedLoanType(selectedLoanType);
    
    if (selectedLoanType) {
      // Update local state
      setFields(prev => ({
        ...prev,
        loanType: selectedLoanType.name
      }));
      
      // Save to API using the same pattern as other fields
      if (lead?._id) {
        await saveToAPI('loanType', selectedLoanType.name);
      }
    }
  };
  
  // Function to save process data to backend API - like AboutSection
  const saveToAPI = async (field, value) => {
    if (!lead?._id) {
      console.warn('HowToProcessSection: No lead ID available, cannot save to API');
      return false;
    }

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.warn('HowToProcessSection: No user ID available');
        return false;
      }

      // Determine if this is a login lead by checking for original_lead_id field
      const isLoginLead = !!lead.original_lead_id || !!lead.login_created_at;
      const apiUrl = isLoginLead 
        ? `/api/lead-login/login-leads/${lead._id}?user_id=${userId}`
        : `/api/leads/${lead._id}?user_id=${userId}`;
      
      console.log(`📡 HowToProcessSection: Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);

      
      // Map field names to process schema field names
      const processFieldMap = {
        processingBank: 'processing_bank',
        loanAmountRequired: 'loan_amount_required',
        howToProcess: 'how_to_process',
        loanType: 'loan_type',
        requiredTenure: 'required_tenure',
        caseType: 'case_type',
        year: 'year'
      };

      const processField = processFieldMap[field] || field;
      
      // Process the value based on field type
      let processedValue = value;
      if (field === 'loanAmountRequired' && value) {
        processedValue = parseFloat(value) || null;
      } else if ((field === 'requiredTenure' || field === 'year') && value) {
        // Remove suffixes and save as numbers
        processedValue = parseInt(value.toString().replace(/[^\d]/g, '')) || null;
      }

      // Create update object for dynamic_fields.process
      const updateData = {
        dynamic_fields: {
          ...lead.dynamic_fields,
          process: {
            ...lead.dynamic_fields?.process,
            [processField]: processedValue
          }
        }
      };

      console.log(`📡 HowToProcessSection: Making API call to update process.${processField}:`, updateData);

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`✅ HowToProcessSection: Successfully saved process.${processField} to API:`, responseData);
      
      // Update the lead object in memory to reflect the change
      if (lead.dynamic_fields) {
        if (!lead.dynamic_fields.process) {
          lead.dynamic_fields.process = {};
        }
        lead.dynamic_fields.process[processField] = processedValue;
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ HowToProcessSection: Error saving process.${field} to API:`, error);
      return false;
    }
  };

  return (
    <div className="max-w-9xl mx-auto">
      
      
      {/* Form Container */}
      <div className="bg-white border-3 border-[#00bcd4] rounded-b-xl p-8">
        {/* First Row: Processing Bank, Loan Type, Case Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 items-start">
          {/* Processing Bank */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>PROCESSING BANK</label>
            <div className="relative dropdown-container">
              <div
                className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold cursor-pointer flex items-center justify-between transition-all duration-300 focus-within:border-[#0097a7] focus-within:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                onClick={() => {
                  if (canEdit) {
                    setShowLoanTypeDropdown(false);
                    setShowBankDropdown(!showBankDropdown);
                  }
                }}
              >
                <span>{fields.processingBank || "Select Bank"}</span>
                <svg className="w-4 h-4 text-[#00bcd4]" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 8 4 4 4-4"/>
                </svg>
              </div>
              {showBankDropdown && canEdit && (
                <div className="absolute w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50 mt-1">
                  <div className="p-3 border-b border-gray-200">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#00bcd4]"
                      placeholder="Search banks..."
                      value={bankSearchTerm}
                      onChange={(e) => setBankSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {getFilteredBanks().length > 0 ? (
                      getFilteredBanks().map((bank, index) => (
                        <div
                          key={index}
                          className="px-4 py-2 text-md font-bold text-green-600 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            handleChange("processingBank", bank);
                            handleBlur("processingBank", bank);
                            setShowBankDropdown(false);
                            setBankSearchTerm('');
                          }}
                        >
                          {bank}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">No banks found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loan Type */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>LOAN TYPE</label>
            <div className="relative dropdown-container">
              <div
                className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold cursor-pointer flex items-center justify-between transition-all duration-300 focus-within:border-[#0097a7] focus-within:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                onClick={() => {
                  if (canEdit) {
                    setShowBankDropdown(false);
                    setShowLoanTypeDropdown(!showLoanTypeDropdown);
                  }
                }}
              >
                <span>{selectedLoanType?.name || "Select Loan Type"}</span>
                <svg className="w-4 h-4 text-[#00bcd4]" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 8 4 4 4-4"/>
                </svg>
              </div>
              {showLoanTypeDropdown && canEdit && (
                <div className="absolute w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50 mt-1">
                  <div className="p-3 border-b border-gray-200">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#00bcd4]"
                      placeholder="Search loan types..."
                      value={loanTypeSearchTerm}
                      onChange={(e) => setLoanTypeSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {getFilteredLoanTypes().length > 0 ? (
                      getFilteredLoanTypes().map((loanType) => (
                        <div
                          key={loanType._id}
                          className="px-4 py-2 text-md font-bold text-green-600 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            handleLoanTypeChange(loanType._id);
                            setShowLoanTypeDropdown(false);
                            setLoanTypeSearchTerm('');
                          }}
                        >
                          {loanType.name}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">No loan types found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Case Type */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>CASE TYPE</label>
            <select
              className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] appearance-none bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2300bcd4' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")] bg-no-repeat bg-[right_12px_center] bg-[length:16px] pr-10 ${
                !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              value={fields.caseType}
              onChange={e => canEdit && handleChange("caseType", e.target.value)}
              onBlur={e => canEdit && handleBlur("caseType", e.target.value)}
              disabled={!canEdit}
            >
              <option value="" className="text-[#10b981] bg-[#f0f9ff]">Select Case Type</option>
              <option value="FRESH ONLY">FRESH ONLY</option>
              <option value="BT ONLY">BT ONLY</option>
              <option value="BT+TOP UP">BT+TOP UP</option>
              <option value="INTERNAL TOP UP">INTERNAL TOP UP</option>
            </select>
          </div>
        </div>

        {/* Second Row: Loan Amount, Tenure Months, Tenure Years */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 items-start">
          {/* Loan Amount Required */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>LOAN AMOUNT REQUIRED</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#00bcd4] font-semibold z-10">₹</span>
              <input
                type="text"
                className={`w-full p-3 pl-8 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                value={fields.loanAmountRequired}
                onChange={e => canEdit && handleChange("loanAmountRequired", e.target.value)}
                onFocus={e => {
                  if (!canEdit) return;
                  // On focus, show raw number for editing
                  if (fields.loanAmountRequired) {
                    const rawValue = parseINR(fields.loanAmountRequired);
                    e.target.value = rawValue;
                    setFields(prev => ({ ...prev, loanAmountRequired: rawValue }));
                  }
                }}
                onBlur={e => {
                  if (!canEdit) return;
                  // On blur, format as INR and save
                  const rawValue = parseINR(e.target.value);
                  const formattedValue = rawValue ? formatINR(rawValue) : "";
                  setFields(prev => ({ ...prev, loanAmountRequired: formattedValue }));
                  handleBlur("loanAmountRequired", rawValue);
                }}
                readOnly={!canEdit}
                placeholder="0"
              />
            </div>
          </div>

          {/* Required Tenure Months */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>REQUIRED TENURE MONTHS</label>
            <input
              ref={tenureInputRef}
              type="text"
              className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              value={getTenureDisplayValue()}
              onChange={e => {
                if (!canEdit) return;
                const numericValue = e.target.value.replace(/[^\d]/g, '');
                handleChange("requiredTenure", numericValue);
              }}
              onFocus={handleTenureFocus}
              onBlur={handleTenureBlur}
              onKeyDown={e => {
                // Allow only numeric keys, backspace, delete, arrow keys, tab
                const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                if (!allowedKeys.includes(e.key) && !/[0-9]/.test(e.key)) {
                  e.preventDefault();
                }
              }}
              readOnly={!canEdit}
              placeholder="Enter months"
            />
          </div>

          {/* Required Tenure Year */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>REQUIRED TENURE YEAR</label>
            <input
              type="text"
              className="w-full p-3 border-2 border-[#00bcd4] rounded-md bg-[#f0f9ff] text-green-600 text-md font-bold italic cursor-not-allowed"
              value={fields.year || "Auto-calculated from months..."}
              readOnly
              placeholder="Auto-calculated from months..."
            />
          </div>
        </div>

        {/* Third Row: How to Process (Full Width) */}
        <div className="mb-0">
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>HOW TO PROCESS</label>
            <textarea
              ref={howToProcessTextareaRef}
              className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] resize-y min-h-[80px] font-inherit ${
                !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              value={fields.howToProcess}
              onChange={e => canEdit && handleChangeWithResize("howToProcess", e.target.value)}
              onBlur={e => canEdit && handleBlur("howToProcess", e.target.value)}
              readOnly={!canEdit}
              placeholder="Enter processing remarks and instructions here..."
              rows="4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}