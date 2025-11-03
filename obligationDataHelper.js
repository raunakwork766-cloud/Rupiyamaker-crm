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
    // Get API base URL from environment or use default
    const API_BASE_URL = process.env.API_BASE_URL || 'https://rupiyamaker.com:8049';
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

    console.log('Obligation data saved to API successfully (debounced)');
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
    
    // Add loan_amount at the top level to match database schema
    loan_amount: loanRequired ? parseINR(loanRequired) : 0,
    
    // Also include nested structure to match dynamic_fields format
    dynamic_fields: {
      financial_details: {
        monthly_income: salary ? parseINR(salary) : null,
        partner_salary: partnerSalary ? parseINR(partnerSalary) : null,
        yearly_bonus: yearlyBonus ? parseINR(yearlyBonus) : null,
        bonus_division: bonusDivision || null,
        cibil_score: cibilScore || null,
        loan_required: loanRequired ? parseINR(loanRequired) : null,
        loan_amount: loanRequired ? parseINR(loanRequired) : 0
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
        multiplier: ceMultiplier || 35,
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
      process: {
        processing_bank: processingBank || '',
        loan_amount: loanRequired ? parseINR(loanRequired) : 0,
        loan_amount_required: loanRequired ? parseINR(loanRequired) : 0,
        how_to_process: "None",
        case_type: "Normal"
      },
      obligations: obligations.map(obl => ({
        product: obl.product || '',
        bank_name: obl.bankName || '',
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
