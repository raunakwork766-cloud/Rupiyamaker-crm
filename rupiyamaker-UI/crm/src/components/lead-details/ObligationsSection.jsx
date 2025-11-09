import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

function formatCurrencyWithCommas(amount) {
  if (amount == null || isNaN(amount) || amount === "") return "₹0";
  amount = Math.round(Number(amount));
  const amountStr = Math.floor(amount).toString();
  let formattedInteger = "";
  let integerPart = amountStr;
  if (integerPart.length > 3) {
    formattedInteger = "," + integerPart.substring(integerPart.length - 3);
    integerPart = integerPart.substring(0, integerPart.length - 3);
    while (integerPart.length > 0) {
      if (integerPart.length >= 2) {
        formattedInteger =
          "," + integerPart.substring(integerPart.length - 2) + formattedInteger;
        integerPart = integerPart.substring(0, integerPart.length - 2);
      } else {
        formattedInteger = integerPart + formattedInteger;
        integerPart = "";
      }
    }
    if (formattedInteger.startsWith(",")) {
      formattedInteger = formattedInteger.substring(1);
    }
  } else {
    formattedInteger = integerPart;
  }
  return "₹" + formattedInteger;
}

function parseCurrency(currencyStr) {
  if (!currencyStr) return 0;
  return Math.round(parseFloat(currencyStr.replace(/[^\d.]/g, ""))) || 0;
}

function formatTenure(value) {
  if (value == null || value === "" || isNaN(value)) return "";
  return `${value} Months`;
}

function parseTenure(value) {
  if (!value) return 0;
  return parseInt(value.replace(/[^0-9]/g, "")) || 0;
}

function formatRoi(value) {
  if (value == null || value === "" || isNaN(value)) return "";
  return `${value} %`;
}

function parseRoi(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
}

function formatTenureYears(value) {
  if (value == null || value === "" || isNaN(value)) return "";
  return `${value} Years`;
}

function parseTenureYears(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
}

function getNumericValue(value, suffix = "") {
  if (!value) return 0;
  let val = String(value || "").trim();
  if (suffix && val.endsWith(suffix)) {
    val = val.replace(suffix, "").trim();
  }
  if (suffix.includes("Years") || suffix.includes("Months")) {
    return parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
  } else {
    return parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
  }
}

export default function ObligationsSection({
  leadData,
  onUpdate,
  formatINR = formatCurrencyWithCommas,
  parseINR = parseCurrency,
}) {
  const [open, setOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState(null);
  const [bankList, setBankList] = useState(['Custom']);
  const [productTypes, setProductTypes] = useState([
    { value: 'Personal Loan', label: 'Personal Loan' },
    { value: 'Home Loan', label: 'Home Loan' },
    { value: 'Business Loan', label: 'Business Loan' },
    { value: 'Car Loan', label: 'Car Loan' },
    { value: 'Credit Card', label: 'Credit Card' },
    { value: 'Loan Against Property', label: 'Loan Against Property' },
    { value: 'Gold Loan', label: 'Gold Loan' },
    { value: 'Education Loan', label: 'Education Loan' },
    { value: 'Other', label: 'Other' }
  ]);
  const [bonusDivisions, setBonusDivisions] = useState([
    { value: '12', label: '12' },
    { value: '6', label: '6' },
    { value: '4', label: '4' },
    { value: '3', label: '3' },
    { value: '2', label: '2' },
    { value: '1', label: '1' }
  ]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [checkEligibilityCompanyCategories, setCheckEligibilityCompanyCategories] = useState([
    { value: 'Cat-A', label: 'Category A' },
    { value: 'Cat-B', label: 'Category B' },
    { value: 'Cat-C', label: 'Category C' }
  ]);
  // --- State ---
  const [customerName, setCustomerName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [salary, setSalary] = useState("");
  const [salaryRaw, setSalaryRaw] = useState(0);
  const [partnerSalary, setPartnerSalary] = useState("");
  const [partnerSalaryRaw, setPartnerSalaryRaw] = useState(0);
  const [yearlyBonus, setYearlyBonus] = useState("");
  const [yearlyBonusRaw, setYearlyBonusRaw] = useState(0);
  const [bonusDivision, setBonusDivision] = useState(bonusDivisions[0]?.value || "");
  const [companyName, setCompanyName] = useState("");
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [isCompanyLoading, setIsCompanyLoading] = useState(false);
  const [totalBtPos, setTotalBtPos] = useState(0);
  const [totalObligation, setTotalObligation] = useState(0);
  const [obligations, setObligations] = useState(
    initialObligations.length > 0
      ? initialObligations.map((row) => ({
          ...row,
          totalLoan: parseINR(row.totalLoan),
          outstanding: parseINR(row.outstanding),
          emi: parseINR(row.emi),
          tenure: parseTenure(row.tenure),
          roi: parseRoi(row.roi),
          action: ["Obligate", "BT", "CO-PAY", "NO-PAY", "Closed"].includes(row.action) ? row.action : "Obligate",
        }))
      : [
          {
            product: "",
            bankName: "",
            tenure: 0,
            roi: 0,
            totalLoan: 0,
            outstanding: 0,
            emi: 0,
            action: "Obligate",
          },
        ]
  );
  const [focusedFields, setFocusedFields] = useState({});
  const [focusedEligibilityFields, setFocusedEligibilityFields] = useState({
    tenureMonths: false,
    tenureYears: false,
    monthlyEmiCanPay: false,
  });
  const [eligibility, setEligibility] = useState({});
  const [ceCompanyCategory, setCeCompanyCategory] = useState("");
  const [ceFoirPercent, setCeFoirPercent] = useState("");
  const [ceMonthlyEmiCanPay, setCeMonthlyEmiCanPay] = useState("");
  const [ceTenureMonths, setCeTenureMonths] = useState("");
  const [ceTenureYears, setCeTenureYears] = useState("");
  const [ceRoi, setCeRoi] = useState("");
  const [ceMultiplier, setCeMultiplier] = useState("");
  const [loanEligibilityStatus, setLoanEligibilityStatus] = useState("");
  const [isManualEmi, setIsManualEmi] = useState(false);

  // --- Handlers ---
  const handleSalaryChange = (e) => {
    const rawValue = parseINR(e.target.value);
    setSalaryRaw(rawValue);
    setSalary(formatINR(rawValue));
  };

  const handlePartnerSalaryChange = (e) => {
    const rawValue = parseINR(e.target.value);
    setPartnerSalaryRaw(rawValue);
    setPartnerSalary(formatINR(rawValue));
  };

  const handleYearlyBonusChange = (e) => {
    const rawValue = parseINR(e.target.value);
    setYearlyBonusRaw(rawValue);
    setYearlyBonus(formatINR(rawValue));
  };

  const handleCompanyInputChange = (e) => {
    setCompanyName(e.target.value);
    setShowCompanySuggestions(true);
  };

  const handleCompanySearchClick = () => {
    setIsCompanyLoading(true);
    setTimeout(() => setIsCompanyLoading(false), 1000);
  };

  const handleCompanySuggestionClick = (name) => {
    setCompanyName(name);
    setShowCompanySuggestions(false);
  };

  const handleObligationChange = (idx, field, value) => {
    setObligations((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]:
                field === "totalLoan" || field === "outstanding" || field === "emi"
                  ? parseINR(value)
                  : field === "tenure"
                  ? parseTenure(value)
                  : field === "roi"
                  ? parseRoi(value)
                  : value,
            }
          : row
      )
    );
  };

  const handleFieldFocus = (idx, field) => {
    setFocusedFields((prev) => ({ ...prev, [`${idx}-${field}`]: true }));
  };

  const handleFieldBlur = (idx, field) => {
    setFocusedFields((prev) => ({ ...prev, [`${idx}-${field}`]: false }));
  };

  const handleEligibilityFieldFocus = (field) => {
    setFocusedEligibilityFields((prev) => ({ ...prev, [field]: true }));
  };

  const handleEligibilityFieldBlur = (field) => {
    setFocusedEligibilityFields((prev) => ({ ...prev, [field]: false }));
  };

  const handleDeleteObligation = (idx) => {
    setObligations((prev) => prev.filter((_, i) => i !== idx));
    setFocusedFields((prev) => {
      const newFocused = { ...prev };
      delete newFocused[`${idx}-tenure`];
      delete newFocused[`${idx}-roi`];
      return newFocused;
    });
  };

  const handleAddObligation = () => {
    setObligations((prev) => [
      ...prev,
      {
        product: "",
        bankName: "",
        tenure: 0,
        roi: 0,
        totalLoan: 0,
        outstanding: 0,
        emi: 0,
        action: "Obligate",
      },
    ]);
  };

  const handleCeCompanyCategoryChange = (e) => setCeCompanyCategory(e.target.value);
  const handleCeFoirPercentChange = (e) => {
    setCeFoirPercent(e.target.value.replace(/[^0-9.]/g, ""));
    setIsManualEmi(false);
  };
  const handleCeMonthlyEmiCanPayChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setCeMonthlyEmiCanPay(value);
    setIsManualEmi(value !== "");
  };
  const handleCeTenureMonthsChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCeTenureMonths(value);
    if (value) {
      const months = parseInt(value) || 0;
      if (months < 11) {
        setCeTenureYears("1");
      } else {
        const years = (months / 12).toFixed(1);
        setCeTenureYears(years);
      }
    } else {
      setCeTenureYears("");
    }
  };
  const handleCeTenureYearsChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setCeTenureYears(value);
  };
  const handleCeRoiChange = (e) => setCeRoi(e.target.value.replace(/[^0-9.]/g, ""));
  const handleCeMultiplierChange = (e) => setCeMultiplier(e.target.value.replace(/[^0-9.]/g, ""));

  // --- Save Handler ---
  const handleSaveObligation = async () => {
    if (!onUpdate) {
      console.error('❌ ObligationsSection: onUpdate function not provided');
      setError('Save function not available');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSaveMessage('');
      
      console.log('💾 ObligationsSection: Preparing obligation data to save...');
      
      // Prepare the obligation data structure
      const obligationData = {
        dynamic_fields: {
          obligation_data: {
            salary: salaryRaw || 0,
            partner_salary: partnerSalaryRaw || 0,
            yearly_bonus: yearlyBonusRaw || 0,
            bonus_division: bonusDivision || "12",
            company_name: companyName || "",
            obligations: obligations.map(obl => ({
              product: obl.product || "",
              bankName: obl.bankName || "",
              tenure: obl.tenure || 0,
              roi: obl.roi || 0,
              totalLoan: obl.totalLoan || 0,
              outstanding: obl.outstanding || 0,
              emi: obl.emi || 0,
              action: obl.action || "Obligate"
            })),
            total_bt_pos: totalBtPosCalc || 0,
            total_obligation: totalObligations || 0
          },
          eligibility_details: {
            company_category: ceCompanyCategory || "",
            foir_percent: parseFloat(ceFoirPercent) || 0,
            monthly_emi_can_pay: parseFloat(ceMonthlyEmiCanPay) || 0,
            tenure_months: parseFloat(ceTenureMonths) || 0,
            tenure_years: parseFloat(ceTenureYears) || 0,
            roi: parseFloat(ceRoi) || 0,
            multiplier: parseFloat(ceMultiplier) || 0,
            total_income: totalIncome || 0,
            total_obligations: totalObligations || 0,
            foir_amount: (totalIncome * parseFloat(ceFoirPercent)) / 100 || 0,
            total_bt_pos: totalBtPosCalc || 0,
            final_eligibility: finalEligibility || 0,
            multiplier_eligibility: loanAmountMultiplier || 0,
            loan_eligibility_status: loanEligibilityStatus || ""
          }
        }
      };

      console.log('📤 ObligationsSection: Saving obligation data:', obligationData);
      
      const result = await onUpdate(obligationData);
      
      if (result !== false) {
        console.log('✅ ObligationsSection: Data saved successfully');
        setSaveMessage('✅ Obligation data saved successfully');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        console.error('❌ ObligationsSection: Save failed (onUpdate returned false)');
        setError('Failed to save obligation data');
        setTimeout(() => setError(''), 5000);
      }
    } catch (err) {
      console.error('❌ ObligationsSection: Error saving data:', err);
      setError('Failed to save: ' + (err.message || 'Unknown error'));
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Calculations ---
  const totalIncome =
    salaryRaw +
    partnerSalaryRaw +
    (yearlyBonusRaw && bonusDivision ? yearlyBonusRaw / Number(bonusDivision) : 0);

  const totalObligations = obligations.reduce((sum, row) => sum + Number(row.emi), 0);

  const totalBtPosCalc = obligations.reduce((sum, row) => sum + Number(row.outstanding), 0);

  const foirPercent = getNumericValue(ceFoirPercent);
  const monthlyEmiCanPay = isManualEmi
    ? getNumericValue(ceMonthlyEmiCanPay)
    : Math.max(0, (totalIncome * foirPercent) / 100 - totalObligations);
  const tenureMonths = getNumericValue(ceTenureMonths, " Months");
  const roi = getNumericValue(ceRoi, "%");
  const monthlyRate = roi / 1200;
  let loanAmountFOIR = 0;
  if (tenureMonths > 0) {
    if (monthlyRate === 0) {
      loanAmountFOIR = monthlyEmiCanPay * tenureMonths;
    } else {
      const powerTerm = Math.pow(1 + monthlyRate, tenureMonths);
      if (powerTerm !== 1) {
        loanAmountFOIR = (monthlyEmiCanPay * (powerTerm - 1)) / (monthlyRate * powerTerm);
      } else {
        loanAmountFOIR = monthlyEmiCanPay * tenureMonths;
      }
    }
  }
  if (isNaN(loanAmountFOIR) || !isFinite(loanAmountFOIR)) loanAmountFOIR = 0;

  const multiplier = getNumericValue(ceMultiplier);
  let loanAmountMultiplier = 0;
  if (multiplier && multiplier <= 35) {
    loanAmountMultiplier = Math.max(0, totalIncome - totalObligations) * multiplier;
  }

  const finalEligibility =
    loanAmountFOIR && loanAmountMultiplier
      ? Math.min(loanAmountFOIR, loanAmountMultiplier)
      : loanAmountFOIR || loanAmountMultiplier;

  let shortfallMessage = "";
  if (totalBtPosCalc > 0 && finalEligibility > 0) {
    if (totalBtPosCalc > finalEligibility) {
      shortfallMessage = `There is a shortfall of ${formatINR(totalBtPosCalc - finalEligibility)}. Balance Transfer Not Possible.`;
    } else {
      shortfallMessage = "Congratulations! Balance Transfer is Eligible.";
    }
  }

  useEffect(() => {
    if (!isManualEmi) {
      const calculatedEmi = Math.max(0, (totalIncome * foirPercent) / 100 - totalObligations);
      setCeMonthlyEmiCanPay(calculatedEmi.toFixed(0));
    }

    setTotalBtPos(totalBtPosCalc);
    setTotalObligation(totalObligations);
    setEligibility({
      totalIncome: totalIncome || 0,
      totalObligations: totalObligations || 0,
      foirAmount: (totalIncome * foirPercent) / 100 || 0,
      totalBtPos: totalBtPosCalc || 0,
      finalEligibility: finalEligibility || 0,
      multiplierEligibility: loanAmountMultiplier || 0,
    });
    setLoanEligibilityStatus(
      totalBtPosCalc > 0 && finalEligibility > 0 && totalBtPosCalc > finalEligibility
        ? "Not Eligible"
        : "Eligible"
    );
  }, [
    salaryRaw,
    partnerSalaryRaw,
    yearlyBonusRaw,
    bonusDivision,
    obligations,
    ceFoirPercent,
    ceTenureMonths,
    ceRoi,
    ceMultiplier,
    totalIncome,
    totalObligations,
    foirPercent,
    finalEligibility,
    loanAmountMultiplier,
    totalBtPosCalc,
    isManualEmi,
  ]);

  // --- Load existing obligation data from leadData ---
  useEffect(() => {
    if (!leadData) return;
    
    console.log('🔄 ObligationsSection: Loading obligation data from leadData:', leadData);
    
    const obligationData = leadData.dynamic_fields?.obligation_data;
    const eligibilityDetails = leadData.dynamic_fields?.eligibility_details;
    
    if (obligationData) {
      console.log('📥 Found existing obligation data:', obligationData);
      
      // Load financial fields
      if (obligationData.salary !== undefined) {
        setSalaryRaw(obligationData.salary || 0);
        setSalary(formatINR(obligationData.salary || 0));
      }
      if (obligationData.partner_salary !== undefined) {
        setPartnerSalaryRaw(obligationData.partner_salary || 0);
        setPartnerSalary(formatINR(obligationData.partner_salary || 0));
      }
      if (obligationData.yearly_bonus !== undefined) {
        setYearlyBonusRaw(obligationData.yearly_bonus || 0);
        setYearlyBonus(formatINR(obligationData.yearly_bonus || 0));
      }
      if (obligationData.bonus_division) {
        setBonusDivision(obligationData.bonus_division);
      }
      if (obligationData.company_name) {
        setCompanyName(obligationData.company_name);
      }
      
      // Load obligations array
      if (obligationData.obligations && Array.isArray(obligationData.obligations)) {
        const loadedObligations = obligationData.obligations.map(obl => ({
          product: obl.product || "",
          bankName: obl.bankName || "",
          tenure: obl.tenure || 0,
          roi: obl.roi || 0,
          totalLoan: obl.totalLoan || 0,
          outstanding: obl.outstanding || 0,
          emi: obl.emi || 0,
          action: obl.action || "Obligate"
        }));
        setObligations(loadedObligations);
        console.log('📥 Loaded obligations:', loadedObligations);
      }
    }
    
    if (eligibilityDetails) {
      console.log('📥 Found existing eligibility details:', eligibilityDetails);
      
      // Load eligibility fields
      if (eligibilityDetails.company_category) {
        setCeCompanyCategory(eligibilityDetails.company_category);
      }
      if (eligibilityDetails.foir_percent !== undefined) {
        setCeFoirPercent(String(eligibilityDetails.foir_percent));
      }
      if (eligibilityDetails.monthly_emi_can_pay !== undefined) {
        setCeMonthlyEmiCanPay(String(eligibilityDetails.monthly_emi_can_pay));
        setIsManualEmi(eligibilityDetails.monthly_emi_can_pay > 0);
      }
      if (eligibilityDetails.tenure_months !== undefined) {
        setCeTenureMonths(String(eligibilityDetails.tenure_months));
      }
      if (eligibilityDetails.tenure_years !== undefined) {
        setCeTenureYears(String(eligibilityDetails.tenure_years));
      }
      if (eligibilityDetails.roi !== undefined) {
        setCeRoi(String(eligibilityDetails.roi));
      }
      if (eligibilityDetails.multiplier !== undefined) {
        setCeMultiplier(String(eligibilityDetails.multiplier));
      }
    }
  }, [leadData?._id]); // Only reload when lead ID changes

  return (
    <div className="mb-8 form-section bg-white p-2">
      <div className="mb-6">
        <div className="mb-2 text-2xl font-bold text-black">Customer Details</div>
        <div className="flex flex-wrap items-end gap-4 p-4 mb-4 border rounded-lg bg-white border-neutral-700">
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-2 text-lg font-bold text-black">Salary</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-lg text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
              value={salary}
              onChange={handleSalaryChange}
              placeholder="In Rupees"
              inputMode="numeric"
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-2 text-lg font-bold text-black">Partner's Salary</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-lg text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
              value={partnerSalary}
              onChange={handlePartnerSalaryChange}
              placeholder="In Rupees"
              inputMode="numeric"
            />
          </div>
         <div className="form-group flex-1 min-w-[220px] flex flex-col">
  <label htmlFor="yearlyBonus" className="block mb-2 text-lg font-bold text-black">
    Bonus:
  </label>
  <div className="relative">
    <input
      type="text"
      id="yearlyBonus"
      className="w-full px-3 py-2 text-lg text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400 bg-white"
      value={yearlyBonus}
      onChange={handleYearlyBonusChange}
      placeholder="In Rupees"
      inputMode="numeric"
    />
    {yearlyBonusRaw > 0 && (
      <div className="absolute left-0 right-0 mt-2 flex flex-wrap gap-2 items-center bg-white z-10 p-2 rounded shadow border border-neutral-200">
        <span className="text-sm font-bold text-black mr-2">Divide by:</span>
        {bonusDivisions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`px-3 py-1 border rounded-md text-sm font-semibold transition ${
              bonusDivision === opt.value
                ? 'bg-sky-600 text-black'
                : 'bg-white text-gray-100 hover:bg-neutral-600'
            }`}
            onClick={() => setBonusDivision(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )}
  </div>
</div>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-4 mb-4 border rounded-lg bg-white border-neutral-700">
          <div className="form-group flex-1 min-w-[220px] relative">
            <label className="block mb-2 text-lg font-bold text-black">Company Name</label>
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full px-3 py-2 text-lg text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                value={companyName}
                onChange={handleCompanyInputChange}
                placeholder="Company Name"
                autoComplete="off"
                onFocus={() => setShowCompanySuggestions(companySuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 100)}
              />
              <button
                type="button"
                className="flex items-center px-3 py-2 ml-2 font-bold text-white rounded bg-blue-400 hover:bg-sky-500"
                onClick={handleCompanySearchClick}
                disabled={isCompanyLoading}
                tabIndex={-1}
              >
                {isCompanyLoading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-search h-10 w-10"></i>
                )}
              </button>
            </div>
            {showCompanySuggestions && (
              <div className="absolute z-10 w-full mt-1 border rounded shadow-lg bg-white border-neutral-700">
                {companySuggestions.map((name) => (
                  <div
                    key={name}
                    className="px-3 py-2 text-black text-lg cursor-pointer hover:bg-sky-400/10"
                    onMouseDown={() => handleCompanySuggestionClick(name)}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-2 text-2xl font-bold text-black">Customer Obligation</div>
        <div className="flex flex-wrap items-center gap-4 p-4 mb-2 border rounded-lg bg-white">
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-lg font-bold text-black">Total BT POS</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-lg font-bold text-black bg-gray-200 border rounded-lg form-control border-neutral-800"
              value={formatINR(totalBtPos)}
              readOnly
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-lg font-bold text-black">Total Obligation</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-lg font-bold text-black bg-gray-200 border rounded-lg form-control border-neutral-800"
              value={formatINR(totalObligation)}
              readOnly
            />
          </div>
        </div>
      </div>
      <div className="mb-2 overflow-x-auto table-container" style={{ maxWidth: '100%', display: 'block' }}>
        <table id="obligationTable" className="w-full border-collapse" style={{ tableLayout: 'auto', width: '100%', display: 'table' }}>
          <thead>
            <tr>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">#</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">Product</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">Bank Name</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">Tenure (Months)</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">ROI %</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">Total Loan</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">Outstanding</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">EMI</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">Action</th>
              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800"></th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((row, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2 text-lg text-black">{idx + 1}</td>
                <td className="px-3 py-2">
                  <select
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    value={row.product || ""}
                    onChange={(e) => handleObligationChange(idx, "product", e.target.value)}
                  >
                    <option value="" disabled>Select Product</option>
                    {productTypes.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    value={row.bankName || ""}
                    onChange={(e) => handleObligationChange(idx, "bankName", e.target.value)}
                  >
                    <option value="" disabled>Select Bank</option>
                    {bankList.map((bank) => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800"
                    placeholder="Months"
                    value={focusedFields[`${idx}-tenure`] ? row.tenure || "" : formatTenure(row.tenure)}
                    onChange={(e) => handleObligationChange(idx, "tenure", e.target.value)}
                    onFocus={() => handleFieldFocus(idx, "tenure")}
                    onBlur={() => handleFieldBlur(idx, "tenure")}
                    inputMode="numeric"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800"
                    placeholder="%"
                    value={focusedFields[`${idx}-roi`] ? row.roi || "" : formatRoi(row.roi)}
                    onChange={(e) => handleObligationChange(idx, "roi", e.target.value)}
                    onFocus={() => handleFieldFocus(idx, "roi")}
                    onBlur={() => handleFieldBlur(idx, "roi")}
                    inputMode="decimal"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800"
                    placeholder="Loan"
                    value={formatINR(row.totalLoan)}
                    onChange={(e) => handleObligationChange(idx, "totalLoan", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800"
                    placeholder="Outstanding"
                    value={formatINR(row.outstanding)}
                    onChange={(e) => handleObligationChange(idx, "outstanding", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800"
                    placeholder="EMI"
                    value={formatINR(row.emi)}
                    onChange={(e) => handleObligationChange(idx, "emi", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full px-2 py-2 text-lg text-black bg-white border rounded-lg border-neutral-800"
                    value={row.action || "Obligate"}
                    onChange={(e) => handleObligationChange(idx, "action", e.target.value)}
                  >
                    <option value="" disabled>Select</option>
                    <option value="Obligate">Obligate</option>
                    <option value="BT">BT</option>
                    <option value="CO-PAY">CO-PAY</option>
                    <option value="NO-PAY">NO-PAY</option>
                    <option value="Closed">Closed</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <i
                    className="mr-2 cursor-pointer fas fa-trash table-action text-sky-400 hover:text-yellow-400"
                    onClick={() => handleDeleteObligation(idx)}
                  ></i>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center mt-4">
        <button
          className="px-5 py-2 font-bold text-lg transition border-2 rounded-lg text-sky-400 border-sky-400 hover:bg-sky-400/20"
          id="addObligationRow"
          onClick={handleAddObligation}
          type="button"
        >
          <i className="mr-2 fas fa-plus"></i> Add Another Obligation
        </button>
      </div>
      <div className="p-4 mt-6 mb-4 border rounded-lg border-sky-400 bg-white">
        <div className="mb-3 text-2xl font-bold text-black">Check Eligibility</div>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">Total Income</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={formatINR(eligibility.totalIncome || 0)}
              readOnly
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">Company Category</label>
            <select
              className="w-full px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-select border-neutral-300"
              value={ceCompanyCategory}
              onChange={handleCeCompanyCategoryChange}
            >
              <option value="">Select Category</option>
              {checkEligibilityCompanyCategories.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">FOIR %</label>
            <input
              type="number"
              className="w-full px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={ceFoirPercent}
              onChange={handleCeFoirPercentChange}
              min={0}
              max={100}
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">FOIR Amount</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={formatINR(eligibility.foirAmount || 0)}
              readOnly
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">Total Obligation</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={formatINR(eligibility.totalObligations || 0)}
              readOnly
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">Monthly EMI Can Pay</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={focusedEligibilityFields.monthlyEmiCanPay ? ceMonthlyEmiCanPay || "" : formatINR(ceMonthlyEmiCanPay)}
              onChange={handleCeMonthlyEmiCanPayChange}
              onFocus={() => handleEligibilityFieldFocus("monthlyEmiCanPay")}
              onBlur={() => handleEligibilityFieldBlur("monthlyEmiCanPay")}
              inputMode="numeric"
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">TENURE (Months)</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={focusedEligibilityFields.tenureMonths ? ceTenureMonths || "" : formatTenure(ceTenureMonths)}
              onChange={handleCeTenureMonthsChange}
              onFocus={() => handleEligibilityFieldFocus("tenureMonths")}
              onBlur={() => handleEligibilityFieldBlur("tenureMonths")}
              inputMode="numeric"
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">TENURE (Years)</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={focusedEligibilityFields.tenureYears ? ceTenureYears || "" : formatTenureYears(ceTenureYears)}
              onChange={handleCeTenureYearsChange}
              onFocus={() => handleEligibilityFieldFocus("tenureYears")}
              onBlur={() => handleEligibilityFieldBlur("tenureYears")}
              inputMode="decimal"
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">ROI</label>
            <input
              type="number"
              className="w-full px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={ceRoi}
              onChange={handleCeRoiChange}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 mb-2">
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">TOTAL BT POS</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={formatINR(eligibility.totalBtPos || 0)}
              readOnly
            />
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">Loan Eligibility as per Hour</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={formatINR(eligibility.finalEligibility || 0)}
              readOnly
            />
            <span className={`block mt-1 text-xs font-semibold ${loanEligibilityStatus === "Eligible" ? "text-green-600" : "text-red-600"}`}>
              {loanEligibilityStatus === "Eligible"}
            </span>
          </div>
          <div className="form-group flex-1 min-w-[220px]">
            <label className="block mb-1 text-base font-bold text-black">Loan Eligibility as per Multiplier</label>
            <input
              type="text"
              className="w-full px-2 py-2 text-lg font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
              value={formatINR(eligibility.multiplierEligibility || 0)}
              readOnly
            />
            <div className="flex items-center gap-2 mt-1">
              <span className="block text-xs font-semibold text-black">Multiplier</span>
              <input
                type="number"
                className="w-20 px-2 py-2 text-lg text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                max={100}
                min={0}
                value={ceMultiplier}
                onChange={handleCeMultiplierChange}
                      placeholder="0"
              />
            </div>
          </div>
        </div>
        {shortfallMessage && (
          <div
            className={`mt-4 text-lg font-semibold text-center rounded-lg py-2 ${
              shortfallMessage === "Congratulations! Balance Transfer is Eligible."
                ? "bg-green-600 text-white"
                : "text-red-600"
            }`}
          >
            {shortfallMessage}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-4 mt-8 form-actions">
        <button type="button" className="px-5 py-2 text-lg font-semibold text-white rounded-lg btn btn-secondary bg-neutral-800 hover:bg-neutral-700">
          Cancel
        </button>
        <button 
          type="button" 
          className="px-5 py-2 text-lg font-bold text-white rounded-lg btn btn-primary bg-sky-400 hover:bg-sky-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          onClick={handleSaveObligation}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <i className="mr-2 fas fa-spinner fa-spin"></i>
              Saving...
            </>
          ) : (
            <>
              <i className="mr-2 fas fa-save"></i>
              Save Obligation
            </>
          )}
        </button>
      </div>
      
      {/* Status Messages */}
      {saveMessage && (
        <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {saveMessage}
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}