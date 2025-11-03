/**
 * ObligationDataHelper - Fixes API calls in loops and improves performance
 * 
 * This file provides debouncing functions for handling API calls related to obligations
 * to avoid making excessive API calls when editing obligation data in the UI.
 */

// Debounce function to limit API calls
export function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// Save obligation data to API with debouncing
export const saveObligationDataToAPIDebounced = debounce(async (leadId, userId, obligationData, token) => {
  if (!leadId) {
    console.warn('No lead ID available, cannot save to API');
    return;
  }

  try {
    const API_BASE_URL = '/api'; // Always use proxy
    const apiUrl = `${API_BASE_URL}/leads/${leadId}/obligations?user_id=${userId}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(obligationData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Add response validation to ensure data is actually saved
    const responseData = await response.json();
    
    if (!responseData.success && !responseData.acknowledged) {
      console.warn('API returned 200 but success flag is false:', responseData);
      throw new Error('API reported success but did not confirm data was saved');
    }
    
    return response;
  } catch (error) {
    console.error('Error saving obligation data to API:', error);
    throw error;
  }
}, 1000); // 1000ms debounce

// Helper function to batch prepare obligation data
export const prepareObligationData = (formData) => {
  const {
    salary,
    partnerSalary,
    yearlyBonus,
    bonusDivision,
    loanRequired,
    companyName,
    companyType,
    companyCategory,
    cibilScore,
    obligations,
    totalBtPos,
    totalObligation,
    eligibility,
    ceCompanyCategory,
    ceFoirPercent,
    ceCustomFoirPercent,
    ceMonthlyEmiCanPay,
    ceTenureMonths,
    ceTenureYears,
    ceRoi,
    ceMultiplier,
    loanEligibilityStatus,
    processingBank,
    parseINR,
    parseROI
  } = formData;

  return {
    salary,
    partnerSalary,
    yearlyBonus,
    bonusDivision,
    loanRequired,
    companyName,
    companyType,
    companyCategory,
    cibilScore,
    obligations,
    totalBtPos,
    totalObligation,
    eligibility,
    
    // Add Check Eligibility section values
    ceCompanyCategory,
    ceFoirPercent,
    ceCustomFoirPercent,
    ceMonthlyEmiCanPay,
    ceTenureMonths,
    ceTenureYears,
    ceRoi,
    ceMultiplier,
    loanEligibilityStatus,
    processingBank,
    
    // Also include processing_bank at the root level for API compatibility
    processing_bank: processingBank,
    
    // Ensure bank name is also set at root level for direct data rendering
    bank_name: processingBank, 
    bankName: processingBank,
    
    // Also include nested structure to match dynamic_fields format
    dynamic_fields: {
      financial_details: {
        monthly_income: salary ? parseINR(salary) : null,
        partner_salary: partnerSalary ? parseINR(partnerSalary) : null,
        yearly_bonus: yearlyBonus ? parseINR(yearlyBonus) : null,
        bonus_division: bonusDivision || null,
        cibil_score: cibilScore || null
      },
      personal_details: {
        company_name: companyName || null,
        company_type: companyType || null,
        company_category: companyCategory || null
      },
      check_eligibility: {
        company_category: ceCompanyCategory || null,
        foir_percent: ceFoirPercent || 60,
        custom_foir_percent: ceCustomFoirPercent || null,
        monthly_emi_can_pay: ceMonthlyEmiCanPay || 0,
        tenure_months: ceTenureMonths || null,
        tenure_years: ceTenureYears || null,
        roi: ceRoi || null,
        multiplier: ceMultiplier || 0,
        loan_eligibility_status: loanEligibilityStatus || 'Not Eligible'
      },
      eligibility_details: eligibility || {
        totalIncome: '',
        foirAmount: '',
        totalObligations: '',
        totalBtPos: '',
        finalEligibility: '',
        multiplierEligibility: ''
      },
      obligations: obligations.map(obl => ({
        product: obl.product || '',
        bank_name: obl.bankName || obl.bank_name || '', // Map both bankName and bank_name for compatibility
        bankName: obl.bankName || obl.bank_name || '', // Include both formats for consistency
        tenure: obl.tenure ? parseINR(obl.tenure) : null,
        roi: obl.roi ? parseROI(obl.roi) : null,
        total_loan: obl.totalLoan ? parseINR(obl.totalLoan) : null,
        outstanding: obl.outstanding ? parseINR(obl.outstanding) : null,
        emi: obl.emi ? parseINR(obl.emi) : null,
        action: obl.action || 'Obligate'
      }))
    }
  };
};

// Helper function to normalize obligation data from API
export const normalizeObligationData = (apiData) => {
  if (!apiData || !apiData.dynamic_fields || !apiData.dynamic_fields.obligations) {
    return apiData;
  }
  
  // Deep clone the data to avoid mutating the original
  const normalizedData = JSON.parse(JSON.stringify(apiData));
  
  // Ensure each obligation has both bank_name and bankName properties
  normalizedData.dynamic_fields.obligations = normalizedData.dynamic_fields.obligations.map(obl => {
    const bankName = obl.bankName || obl.bank_name || '';
    return {
      ...obl,
      bank_name: bankName,
      bankName: bankName
    };
  });
  
  return normalizedData;
};
