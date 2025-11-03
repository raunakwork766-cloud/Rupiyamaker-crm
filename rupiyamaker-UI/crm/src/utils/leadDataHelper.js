// Lead Data Helper - Manages temporary lead data across form sections
// BROWSER-COMPATIBLE VERSION - Uses in-memory storage instead of localStorage

// In-memory storage for the session
let tempLeadData = {};

// Helper function to safely convert values to string and trim
const safeStringTrim = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

// Helper function to safely check if a value is a non-empty string after trimming
const isNonEmptyString = (value) => {
  return safeStringTrim(value) !== '';
};

// Save lead info section data to memory
export const saveLeadInfoData = (data) => {
  try {
    tempLeadData = {
      ...tempLeadData,
      leadInfo: {
        ...data,
        lastUpdated: new Date().toISOString()
      }
    };
    return true;
  } catch (error) {
    console.error('Error saving lead info data:', error);
    return false;
  }
};

// Save obligation section data to memory
export const saveObligationData = (data) => {
  try {
    tempLeadData = {
      ...tempLeadData,
      obligation: {
        ...data,
        lastUpdated: new Date().toISOString()
      }
    };
    return true;
  } catch (error) {
    console.error('Error saving obligation data:', error);
    return false;
  }
};

// Get all temporary lead data
export const getTempLeadData = () => {
  try {
    return tempLeadData || {};
  } catch (error) {
    console.error('Error getting temp lead data:', error);
    return {};
  }
};

// Clear temporary lead data
export const clearTempLeadData = () => {
  try {
    tempLeadData = {};
    console.log('Temporary lead data cleared');
    return true;
  } catch (error) {
    console.error('Error clearing temp lead data:', error);
    return false;
  }
};

// Check if we have complete data for lead creation
export const hasCompleteLeadData = () => {
  const data = getTempLeadData();
  const hasLeadInfo = data.leadInfo && 
    data.leadInfo.productType && 
    data.leadInfo.mobileNumber && 
    data.leadInfo.customerName;
  // Obligation data is optional, so we don't require it
  return hasLeadInfo;
};

// Combine all sections data into final lead object
export const getFinalLeadData = (parseINR, hookState = null) => {
  const data = getTempLeadData();
  const leadInfo = data.leadInfo || {};
  const obligation = data.obligation || {};

  // If hookState is provided, use it as fallback for missing obligation data
  let finalObligation = obligation;
  if (hookState && (!obligation.salary || !obligation.obligations)) {
    console.log('Using hookState as fallback for obligation data');
    finalObligation = {
      salary: hookState.salary || obligation.salary,
      partnerSalary: hookState.partnerSalary || obligation.partnerSalary,
      yearlyBonus: hookState.yearlyBonus || obligation.yearlyBonus,
      bonusDivision: hookState.bonusDivision || obligation.bonusDivision,
      foirPercent: hookState.foirPercent || obligation.foirPercent,
      customFoirPercent: hookState.customFoirPercent || obligation.customFoirPercent,
      obligations: hookState.obligations || obligation.obligations,
      loanRequired: hookState.loanRequired || obligation.loanRequired,
      companyName: hookState.companyName || obligation.companyName,
      companyType: hookState.companyType || obligation.companyType,
      companyCategory: hookState.companyCategory || obligation.companyCategory,
      cibilScore: hookState.cibilScore || obligation.cibilScore,
      // Add calculated totals and eligibility data
      totalBtPos: hookState.totalBtPos || obligation.totalBtPos,
      totalObligation: hookState.totalObligation || obligation.totalObligation,
      eligibility: hookState.eligibility || obligation.eligibility,
      // Add Check Eligibility section values
      ceCompanyCategory: hookState.ceCompanyCategory || obligation.ceCompanyCategory,
      ceFoirPercent: hookState.ceFoirPercent || obligation.ceFoirPercent,
      ceCustomFoirPercent: hookState.ceCustomFoirPercent || obligation.ceCustomFoirPercent,
      ceMonthlyEmiCanPay: hookState.ceMonthlyEmiCanPay || obligation.ceMonthlyEmiCanPay,
      ceTenureMonths: hookState.ceTenureMonths || obligation.ceTenureMonths,
      ceTenureYears: hookState.ceTenureYears || obligation.ceTenureYears,
      ceRoi: hookState.ceRoi || obligation.ceRoi,
      ceMultiplier: hookState.ceMultiplier || obligation.ceMultiplier,
      loanEligibilityStatus: hookState.loanEligibilityStatus || obligation.loanEligibilityStatus,
      processingBank: hookState.processingBank || obligation.processingBank,
    };
  }

  console.log('=== DEBUGGING DATA RETRIEVAL ===');
  console.log('Raw temp data:', data);
  console.log('Lead Info data:', leadInfo);
  console.log('Original obligation data:', obligation);
  console.log('Final obligation data:', finalObligation);
  console.log('Processing bank from finalObligation:', finalObligation.processingBank);
  console.log('HookState processingBank:', hookState?.processingBank);
  console.log('Hook state provided:', !!hookState);
  console.log('=== END DEBUGGING ===');

  // Get current user info for created_by field
  const userData = window.currentUserData || null;
  let currentUser = null;
  if (userData) {
    try {
      currentUser = typeof userData === 'string' ? JSON.parse(userData) : userData;
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }

  // Split customer name into first_name and last_name
  const nameParts = (leadInfo.customerName || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Handle company category - convert array to string if needed
  let companyCategory = leadInfo.companyCategory || obligation.companyCategory || '';
  if (Array.isArray(companyCategory)) {
    // If it's an array, join with comma or take first item
    companyCategory = companyCategory.length > 0 ? companyCategory[0] : '';
  }

  // Handle company type - ensure it's always a string
  let companyType = leadInfo.companyType || finalObligation.companyType || '';
  if (Array.isArray(companyType)) {
    // If it's an array, take the value property or first item
    companyType = companyType.length > 0 ? 
                  (companyType[0].value || companyType[0].label || companyType[0]) : '';
  } else if (typeof companyType === 'object' && companyType !== null) {
    // If it's an object, extract the value or label
    companyType = companyType.value || companyType.label || '';
  }
  // Ensure it's a string
  companyType = String(companyType);

  // Get loan amount from obligation section if not in lead info
  const loanAmount = isNonEmptyString(finalObligation.loanRequired) ? 
                     parseINR(finalObligation.loanRequired) : 
                     (isNonEmptyString(leadInfo.loanRequired) ? 
                      parseINR(leadInfo.loanRequired) : 0);

  // Prepare assigned_to and assign_report_to as arrays of user IDs
  let assignedToList = [];
  let assignReportToList = [];
  
  // Handle assignedToIds if available (new format with user IDs)
  if (leadInfo.assignedToIds && Array.isArray(leadInfo.assignedToIds)) {
    assignedToList = leadInfo.assignedToIds.filter(Boolean).map(String);
  } else if (Array.isArray(leadInfo.assignedTo)) {
    // Legacy support: if still using names, convert to IDs
    assignedToList = leadInfo.assignedTo.filter(Boolean).map(assignedUser => {
      if (typeof assignedUser === 'object') {
        return String(assignedUser.id || assignedUser._id || assignedUser.user_id || '');
      } else {
        // This is a name, we'd need user data to convert - for now keep as string
        return String(assignedUser);
      }
    }).filter(id => id);
  } else if (leadInfo.assignedTo) {
    assignedToList = [String(leadInfo.assignedTo)];
  }
  
  // Handle assignReportTo (supervisor/manager IDs)
  if (Array.isArray(leadInfo.assignReportTo)) {
    assignReportToList = leadInfo.assignReportTo.filter(Boolean).map(String);
  } else if (leadInfo.assignReportTo) {
    assignReportToList = [String(leadInfo.assignReportTo)];
  }

  // Calculate total eligibility, total obligation, total bt from obligation data
  let totalEligibility = 0, totalObligation = 0, totalBt = 0;
  
  console.log('=== CALCULATION DEBUG ===');
  console.log('Lead Info eligibility:', leadInfo.eligibility);
  console.log('Final obligation data for calculation:', finalObligation);
  
  // If eligibility data is passed from leadInfo, use it
  if (leadInfo.eligibility && typeof leadInfo.eligibility === 'object') {
    totalEligibility = leadInfo.eligibility.finalEligibility || 0;
    totalObligation = leadInfo.eligibility.totalObligations || 0;
    totalBt = leadInfo.eligibility.totalBtPos || 0;
    console.log('Using eligibility from leadInfo:', { totalEligibility, totalObligation, totalBt });
  } 
  // If eligibility data is available in finalObligation, use it
  else if (finalObligation.eligibility && typeof finalObligation.eligibility === 'object') {
    totalEligibility = parseINR(finalObligation.eligibility.finalEligibility) || 0;
    totalObligation = parseINR(finalObligation.eligibility.totalObligations) || parseINR(finalObligation.totalObligation) || 0;
    totalBt = parseINR(finalObligation.eligibility.totalBtPos) || parseINR(finalObligation.totalBtPos) || 0;
    console.log('Using eligibility from finalObligation.eligibility:', { totalEligibility, totalObligation, totalBt });
  }
  // If individual calculated values are available, use them
  else if (finalObligation.totalBtPos || finalObligation.totalObligation) {
    totalObligation = parseINR(finalObligation.totalObligation) || 0;
    totalBt = parseINR(finalObligation.totalBtPos) || 0;
    console.log('Using individual calculated values from finalObligation:', { totalObligation, totalBt });
    
    // Calculate eligibility from salary data if available
    const salary = finalObligation.salary ? parseINR(finalObligation.salary) : 0;
    const partnerSalary = finalObligation.partnerSalary ? parseINR(finalObligation.partnerSalary) : 0;
    const yearlyBonus = finalObligation.yearlyBonus ? parseINR(finalObligation.yearlyBonus) : 0;
    const bonusDivision = parseInt(finalObligation.bonusDivision) || 12;
    const foirPercent = finalObligation.foirPercent === 'custom' ? 
                       parseInt(finalObligation.customFoirPercent || '60') : 
                       parseInt(finalObligation.foirPercent || '60');
    
    if (salary > 0 || partnerSalary > 0) {
      const monthlyBonus = yearlyBonus / bonusDivision;
      const totalIncome = salary + partnerSalary + monthlyBonus;
      const foirAmount = totalIncome * (foirPercent / 100);
      
      // Calculate eligibility
      const foirEligibility = foirAmount - totalObligation;
      const multiplierEligibility = totalIncome * 0;
      
      if (totalBt < foirEligibility) {
        totalEligibility = Math.min(foirEligibility, multiplierEligibility);
      } else {
        totalEligibility = multiplierEligibility - totalBt;
      }
      totalEligibility = Math.max(totalEligibility, 0);
      
      console.log('Calculated eligibility from salary data:', { totalIncome, foirAmount, foirEligibility, multiplierEligibility, totalEligibility });
    }
  }
  else {
    // Calculate from obligation data if not available
    console.log('Calculating from obligation data...');
    const salary = finalObligation.salary ? parseINR(finalObligation.salary) : 0;
    const partnerSalary = finalObligation.partnerSalary ? parseINR(finalObligation.partnerSalary) : 0;
    const yearlyBonus = finalObligation.yearlyBonus ? parseINR(finalObligation.yearlyBonus) : 0;
    const bonusDivision = parseInt(finalObligation.bonusDivision) || 12;
    const foirPercent = finalObligation.foirPercent === 'custom' ? 
                       parseInt(finalObligation.customFoirPercent || '60') : 
                       parseInt(finalObligation.foirPercent || '60');
    
    console.log('Salary values:', { salary, partnerSalary, yearlyBonus, bonusDivision, foirPercent });
    
    const monthlyBonus = yearlyBonus / bonusDivision;
    const totalIncome = salary + partnerSalary + monthlyBonus;
    const foirAmount = totalIncome * (foirPercent / 100);
    
    console.log('Income calculation:', { monthlyBonus, totalIncome, foirAmount });
    
    // Calculate total obligations and BT from obligations array
    totalObligation = 0;
    totalBt = 0;
    console.log('Obligations array:', finalObligation.obligations);
    if (finalObligation.obligations && Array.isArray(finalObligation.obligations)) {
      for (const obl of finalObligation.obligations) {
        const emiValue = obl.emi ? parseINR(obl.emi) : 0;
        const outstandingValue = obl.outstanding ? parseINR(obl.outstanding) : 0;
        totalObligation += emiValue;
        totalBt += outstandingValue;
        console.log('Processing obligation:', { 
          product: obl.product, 
          emi: obl.emi, 
          emiValue, 
          outstanding: obl.outstanding, 
          outstandingValue 
        });
      }
    }
    
    console.log('Totals from obligations:', { totalObligation, totalBt });
    
    // Calculate eligibility
    const foirEligibility = foirAmount - totalObligation;
    const multiplierEligibility = totalIncome * 0;
    
    console.log('Eligibility calculation:', { foirEligibility, multiplierEligibility });
    
    if (totalBt < foirEligibility) {
      totalEligibility = Math.min(foirEligibility, multiplierEligibility);
    } else {
      totalEligibility = multiplierEligibility - totalBt;
    }
    totalEligibility = Math.max(totalEligibility, 0);
    
    console.log('Final eligibility:', totalEligibility);
  }
  
  console.log('=== FINAL TOTALS ===');
  console.log('Total Eligibility:', totalEligibility);
  console.log('Total Obligation:', totalObligation);
  console.log('Total BT:', totalBt);
  
  // Prepare final lead data with correct JSON structure
  const finalLeadData = {
    // Root level fields
    loan_type: leadInfo.productType || '',
    loan_type_name: leadInfo.productType || '',
    loan_type_id: leadInfo.selectedLoanTypeId || '',
    mobile_number: leadInfo.mobileNumber || '',
    alternative_phone: leadInfo.alternateNumber || '',
    first_name: firstName,
    last_name: lastName,
    // Status handling based on selection
    status: leadInfo.status === 'lead' ? 'ACTIVE LEADS' : 
            leadInfo.status === 'not_a_lead' ? 'NOT A LEAD' : 
            (leadInfo.status || '').toUpperCase(),
    sub_status: leadInfo.status === 'lead' ? 'NEW LEAD' : 
                leadInfo.status === 'not_a_lead' ? 'NOT A LEAD' : 
                (leadInfo.status || '').toUpperCase(),
    campaign_name: leadInfo.campaignName || '',
    data_code: leadInfo.dataCode || '',
    // Add processing_bank field
    processing_bank: leadInfo.processingBank || finalObligation.processingBank || (Array.isArray(finalObligation.companyType) && finalObligation.companyType.length > 0 ? finalObligation.companyType[finalObligation.companyType.length - 1] : '') || finalObligation.decideBankForCase || '',
    // Assignment structure
    assign_report_to: assignedToList,
    assigned_to: currentUser?.user_id,
    created_by: currentUser?.user_id || currentUser?.id || '',
    department_id: currentUser?.department_id || '',
    loan_amount: loanAmount, // Use loan amount from obligation section
    created_date: new Date().toISOString(),
    
    // Dynamic fields structure - matching backend schema
    dynamic_fields: {
      // Address information - ENSURE THESE ARE POPULATED
      address: {
        pincode: String(leadInfo.pincode || ''), // Ensure string
        city: String(leadInfo.city || '') // Ensure string
      },
      
      // Personal details (company info)
      personal_details: {
        company_name: String(leadInfo.companyName || finalObligation.companyName || ''), // Ensure string
        company_type: String(companyType), // Use the processed companyType as string
        company_category: String(companyCategory) // Ensure this is a string
      },
      
      // Financial details
      financial_details: {
        monthly_income: isNonEmptyString(finalObligation.salary) ? 
                       parseINR(finalObligation.salary) : 0,
        partner_salary: isNonEmptyString(finalObligation.partnerSalary) ? 
                       parseINR(finalObligation.partnerSalary) : 0,
        yearly_bonus: isNonEmptyString(finalObligation.yearlyBonus) ? 
                     parseINR(finalObligation.yearlyBonus) : 0,
        bonus_division: finalObligation.bonusDivision ? 
                       parseInt(finalObligation.bonusDivision) : 12,
        foir_percent: finalObligation.foirPercent === 'custom' ? 
                     parseInt(finalObligation.customFoirPercent || '60') : 
                     parseInt(finalObligation.foirPercent || '60'),
        cibil_score: String(finalObligation.cibilScore || '') // Ensure string
      },
      
      // Obligations as array (backend expects a list)
      obligations: (finalObligation.obligations || []).map(obl => ({
        product: String(obl.product || ''),
        bank_name: String(obl.bankName || obl.bank_name || ''), // Include snake_case field
        bankName: String(obl.bankName || obl.bank_name || ''),  // Include camelCase field
        tenure: obl.tenure ? parseInt(obl.tenure) : 0,
        roi: obl.roi ? parseFloat(obl.roi) : 0.0,
        total_loan: isNonEmptyString(obl.totalLoan) ?  // Include snake_case field
                   parseINR(obl.totalLoan) : 0,
        totalLoan: isNonEmptyString(obl.totalLoan) ?   // Include camelCase field
                   parseINR(obl.totalLoan) : 0,
        outstanding: isNonEmptyString(obl.outstanding) ? 
                    parseINR(obl.outstanding) : 0,
        emi: isNonEmptyString(obl.emi) ? parseINR(obl.emi) : 0,
        action: String(obl.action || '')
      })),
      
      // Include important questions data if available from the leadInfo or data
      important_questions: leadInfo.question_responses || leadInfo.importantquestion || data.question_responses || {},
      
      // Totals as separate fields
      // eligibility_totals: {
      //   total_eligibility: totalEligibility,
      //   total_obligation: totalObligation,
      //   total_bt: totalBt
      // },
      
      // Check Eligibility section data
      check_eligibility: {
        company_category: String(finalObligation.ceCompanyCategory || ''),
        foir_percent: parseInt(finalObligation.ceFoirPercent || '60'),
        custom_foir_percent: String(finalObligation.ceCustomFoirPercent || ''),
        monthly_emi_can_pay: parseFloat(finalObligation.ceMonthlyEmiCanPay || '0'),
        tenure_months: String(finalObligation.ceTenureMonths || ''),
        tenure_years: String(finalObligation.ceTenureYears || ''),
        roi: String(finalObligation.ceRoi || ''),
        multiplier: parseInt(finalObligation.ceMultiplier || '0'),
        loan_eligibility_status: String(finalObligation.loanEligibilityStatus || 'Not Eligible')
      },
      
      // Process section data with default values
      process: {
        how_to_process: "None",
        case_type: "Normal"
      },
      
      // Eligibility calculation details (if available) - convert to strings for backend
      eligibility_details: finalObligation.eligibility ? {
        totalIncome: String(finalObligation.eligibility.totalIncome || 0),
        foirAmount: String(finalObligation.eligibility.foirAmount || 0),
        totalObligations: String(finalObligation.eligibility.totalObligations || 0),
        totalBtPos: String(finalObligation.eligibility.totalBtPos || 0),
        finalEligibility: String(finalObligation.eligibility.finalEligibility || 0),
        multiplierEligibility: String(finalObligation.eligibility.multiplierEligibility || 0),
        foirEligibility: String(finalObligation.eligibility.foirEligibility || 0)
      } : {
        totalIncome: "0",
        foirAmount: "0",
        totalObligations: "0",
        totalBtPos: "0",
        finalEligibility: "0",
        multiplierEligibility: "0",
        foirEligibility: "0"
      }
    }
  };

  console.log('=== FINAL COMBINED LEAD DATA ===');
  console.log('Lead Info Section:', leadInfo);
  console.log('Final Obligation Section:', finalObligation);
  console.log('=== DEBUGGING SPECIFIC FIELDS ===');
  console.log('City from leadInfo:', leadInfo.city);
  console.log('Pincode from leadInfo:', leadInfo.pincode);
  console.log('Loan Amount from obligation:', finalObligation.loanRequired);
  console.log('Company Category (raw):', leadInfo.companyCategory || finalObligation.companyCategory);
  console.log('Company Category (processed):', companyCategory);
  console.log('=== CALCULATED TOTALS ===');
  console.log('Total Eligibility:', totalEligibility);
  console.log('Total Obligation:', totalObligation);  
  console.log('Total BT:', totalBt);
  console.log('=== USER ASSIGNMENT ===');
  console.log('Assigned To List:', assignedToList);
  console.log('Assign Report To List:', assignReportToList);
  console.log('Current User:', currentUser);
  console.log('=== FINAL PAYLOAD ===');
  console.log('Final Combined Data:', finalLeadData);

  return finalLeadData;
};

// Save lead info section data when user switches tabs or completes section
export const saveCurrentLeadInfoSection = (formData) => {
  // Ensure all fields are properly captured with debugging
  console.log('=== SAVING LEAD INFO SECTION ===');
  console.log('Input formData:', formData);
  console.log('City from formData:', formData.city);
  console.log('Pincode from formData:', formData.pincode);
  console.log('Eligibility from formData:', formData.eligibility);
  
  const leadInfoData = {
    productType: formData.productType,
    mobileNumber: formData.mobileNumber,
    customerName: formData.customerName,
    alternateNumber: formData.alternateNumber,
    pincode: formData.pincode,
    city: formData.city,
    companyName: formData.companyName,
    companyType: formData.companyType,
    companyCategory: formData.companyCategory,
    campaignName: formData.campaignName,
    dataCode: formData.dataCode,
    status: formData.status,
    assignedTo: formData.assignedTo,
    assignedToIds: formData.assignedToIds, // Add the new field for user IDs
    loanRequired: formData.loanRequired,
    selectedLoanTypeId: formData.selectedLoanTypeId,
    assignReportTo: formData.assignReportTo,
    eligibility: formData.eligibility, // Add eligibility data if available
    processingBank: formData.processingBank || "" // Add processing bank field
  };

  console.log('Lead info data to save:', leadInfoData);
  return saveLeadInfoData(leadInfoData);
};

// Load saved lead info data when component mounts
export const loadSavedLeadInfoData = () => {
  const data = getTempLeadData();
  return data.leadInfo || {};
};

// Load saved obligation data when component mounts
export const loadSavedObligationData = () => {
  const data = getTempLeadData();
  return data.obligation || {};
};