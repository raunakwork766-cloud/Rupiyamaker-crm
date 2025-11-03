import React, { useRef, useState, useEffect } from "react";
import { Search, CheckCircle, AlertCircle, Loader, X, Phone, User, Building, CreditCard, FileText, Camera } from "lucide-react";

// --- Helper for formatting currency with commas (Indian style) ---
function formatINR(value) {
  const cleaned = String(value).replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";
  let [intPart, decPart] = cleaned.split(".");
  if (intPart.length > 1 && intPart.startsWith("0")) intPart = intPart.replace(/^0+/, "") || "0";
  let lastThree = intPart.slice(-3);
  let otherNumbers = intPart.slice(0, -3);
  otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  let formatted = otherNumbers ? otherNumbers + "," + lastThree : lastThree;
  if (decPart !== undefined) formatted += "." + decPart.slice(0, 2);
  return formatted;
}

function parseINR(formatted) {
  return formatted.replace(/,/g, "").replace(/[^0-9.]/g, "");
}

// For online pincode fetching
async function fetchCityByPincode(pincode) {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.[0]) {
      return data[0].PostOffice[0].District || data[0].PostOffice[0].Name;
    }
  } catch (e) {
    console.error('Error fetching city by pincode:', e);
  }
  return "";
}

export default function CreateLead({ user }) {
  // State management
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCheckResult, setPhoneCheckResult] = useState(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [loanTypes, setLoanTypes] = useState([]);
  const [selectedLoanType, setSelectedLoanType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lead form data
  const [leadData, setLeadData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    alternative_phone: "",
    loan_type: "",
    loan_amount: "",
    source: "Direct",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    date_of_birth: "",
    gender: "",
    marital_status: "",
    occupation: "",
    employer_name: "",
    monthly_income: "",
    annual_income: "",
    employment_type: "",
    years_of_experience: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    pan_number: "",
    aadhar_number: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    reference1_name: "",
    reference1_phone: "",
    reference1_relation: "",
    reference2_name: "",
    reference2_phone: "",
    reference2_relation: "",
  });

  // Get user ID for API calls
  const userId = localStorage.getItem('userId') || '';

  // Load loan types on component mount
  useEffect(() => {
    loadLoanTypes();
  }, []);

  const loadLoanTypes = async () => {
    try {
      const response = await fetch(`http://localhost:8048/loan-types?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch loan types');
      }

      const data = await response.json();
      setLoanTypes(data);
    } catch (error) {
      console.error('Error loading loan types:', error);
      setError('Failed to load loan types. Please refresh the page.');
    }
  };

  // Phone number check functionality
  const checkPhoneNumber = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    setIsCheckingPhone(true);
    setPhoneCheckResult(null);
    setError("");

    try {
      // Search for existing leads with this phone number
      const response = await fetch(`http://localhost:8048/leads/search?user_id=${userId}&phone=${phoneNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check phone number');
      }

      const data = await response.json();
      console.log('Phone check result:', data);

      if (data.leads && data.leads.length > 0) {
        // Check if lead exists and its status
        const existingLead = data.leads[0];
        const leadDate = new Date(existingLead.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now - leadDate) / (1000 * 60 * 60 * 24));

        if (existingLead.status === 'active' && daysDiff > 15) {
          setPhoneCheckResult({
            type: 'reassign_old',
            message: `Lead found but older than 15 days. You can reassign to yourself.`,
            lead: existingLead,
            daysDiff
          });
        } else if (existingLead.status === 'active') {
          setPhoneCheckResult({
            type: 'processing',
            message: `Lead is already in processing (created ${daysDiff} days ago).`,
            lead: existingLead,
            daysDiff
          });
        } else {
          setPhoneCheckResult({
            type: 'reassign',
            message: `Lead exists with different status. You can reassign.`,
            lead: existingLead
          });
        }
      } else {
        // No existing lead found - allow new lead creation
        setPhoneCheckResult({
          type: 'new',
          message: 'No existing lead found. You can create a new lead.',
          lead: null
        });
        setShowLeadForm(true);
        setLeadData(prev => ({ ...prev, phone: phoneNumber }));
      }
    } catch (error) {
      console.error('Error checking phone number:', error);
      setError('Failed to check phone number. Please try again.');
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // Handle reassign lead
  const handleReassignLead = async (leadId) => {
    try {
      const response = await fetch(`http://localhost:8048/leads/${leadId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assigned_to: userId,
          user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reassign lead');
      }

      setSuccess('Lead has been reassigned to you successfully!');
      setPhoneCheckResult(null);
      setPhoneNumber("");
    } catch (error) {
      console.error('Error reassigning lead:', error);
      setError('Failed to reassign lead. Please try again.');
    }
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setLeadData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle pincode lookup
  const handlePincodeChange = async (pincode) => {
    handleInputChange('postal_code', pincode);
    if (pincode.length === 6) {
      const city = await fetchCityByPincode(pincode);
      if (city) {
        handleInputChange('city', city);
      }
    }
  };

  // Submit lead form
  const submitLead = async () => {
    // Validate required fields
    if (!leadData.first_name || !leadData.last_name || !leadData.phone || !selectedLoanType) {
      setError('Please fill all required fields: First Name, Last Name, Phone, and Loan Type');
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const submitData = {
        ...leadData,
        loan_type: selectedLoanType,
        created_by: userId,
        assigned_to: userId, // Assign to self by default
        dynamic_fields: {
          date_of_birth: leadData.date_of_birth,
          gender: leadData.gender,
          marital_status: leadData.marital_status,
          address: {
            line1: leadData.address_line1,
            line2: leadData.address_line2,
            city: leadData.city,
            state: leadData.state,
            postal_code: leadData.postal_code,
            country: leadData.country
          },
          personal_details: {
            occupation: leadData.occupation,
            employer_name: leadData.employer_name,
            employment_type: leadData.employment_type,
            years_of_experience: parseInt(leadData.years_of_experience) || 0
          },
          financial_details: {
            monthly_income: parseFloat(parseINR(leadData.monthly_income)) || 0,
            annual_income: parseFloat(parseINR(leadData.annual_income)) || 0,
            bank_name: leadData.bank_name,
            account_number: leadData.account_number,
            ifsc_code: leadData.ifsc_code
          },
          identity_details: {
            pan_number: leadData.pan_number,
            aadhar_number: leadData.aadhar_number
          },
          emergency_contact: {
            name: leadData.emergency_contact_name,
            phone: leadData.emergency_contact_phone,
            relation: leadData.emergency_contact_relation
          },
          references: [
            {
              name: leadData.reference1_name,
              phone: leadData.reference1_phone,
              relation: leadData.reference1_relation
            },
            {
              name: leadData.reference2_name,
              phone: leadData.reference2_phone,
              relation: leadData.reference2_relation
            }
          ]
        }
      };

      // Clean up empty values
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === "" || submitData[key] === null) {
          delete submitData[key];
        }
      });

      const response = await fetch(`http://localhost:8048/leads?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to create lead');
      }

      const result = await response.json();
      console.log('Lead created:', result);

      setSuccess('Lead created successfully!');

      // Reset form
      setShowLeadForm(false);
      setPhoneNumber("");
      setPhoneCheckResult(null);
      setSelectedLoanType("");
      setLeadData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        alternative_phone: "",
        loan_type: "",
        loan_amount: "",
        source: "Direct",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "India",
        date_of_birth: "",
        gender: "",
        marital_status: "",
        occupation: "",
        employer_name: "",
        monthly_income: "",
        annual_income: "",
        employment_type: "",
        years_of_experience: "",
        bank_name: "",
        account_number: "",
        ifsc_code: "",
        pan_number: "",
        aadhar_number: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relation: "",
        reference1_name: "",
        reference1_phone: "",
        reference1_relation: "",
        reference2_name: "",
        reference2_phone: "",
        reference2_relation: "",
      });

    } catch (error) {
      console.error('Error creating lead:', error);
      setError(`Failed to create lead: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Logic and State Hook ---
  function useCreateLeadLogic() {


    // Simulate backend for banks
    const [bankList, setBankList] = useState([]);
    useEffect(() => {
      setTimeout(() => {
        setBankList([
          "State Bank of India",
          "HDFC Bank",
          "ICICI Bank",
          "Axis Bank",
          "Punjab National Bank",
          "Kotak Mahindra Bank",
          "Bank of Baroda",
          "IDFC FIRST Bank",
          "IndusInd Bank",
          "Yes Bank",
          "Union Bank of India",
          "Canara Bank",
        ]);
      }, 500);
    }, []);

    // --- Customer Obligation summary from backend (simulate) ---
    const [totalBtPos, setTotalBtPos] = useState("0");
    const [totalObligation, setTotalObligation] = useState("0");
    useEffect(() => {
      setTimeout(() => {
        setTotalBtPos("124500");
        setTotalObligation("18500");
      }, 800);
    }, []);

    // Product types for obligation table
    const productTypes = [
      { value: "pl", label: "PL (Personal Loan)" },
      { value: "od", label: "OD (Overdraft)" },
      { value: "cc", label: "CC (Credit Card)" },
      { value: "bl", label: "BL (Business Loan)" },
      { value: "hl", label: "HL (Home Loan)" },
      { value: "lap", label: "LAP (Loan Against Property)" },
      { value: "al", label: "AL (Auto Loan)" },
      { value: "el", label: "EL (Education Loan)" },
      { value: "gl", label: "GL (Gold Loan)" },
      { value: "loc", label: "LOC (Loan On Credit Card)" },
      { value: "cd", label: "CD (Consumer Durable Loan)" },
      { value: "app_loan", label: "App Loan" },
      { value: "insurance", label: "Insurance" },
    ];

    // --- Action types for table ---
    const actionTypes = [
      { value: "bt", label: "BT" },
      { value: "obligate", label: "Obligate" },
      { value: "co-pay", label: "CO-Pay" },
      { value: "no-pay", label: "No-Pay" },
      { value: "closed", label: "Closed" },
    ];
    const campaignNames = [
      { value: "", label: "Select Campaign" },
      { value: "crm_data", label: "CRM Data" },
      { value: "personal_reference", label: "Personal Reference" },
      { value: "rupiya_maker", label: "Rupiya Maker" },
    ];
    const dataCodes = [
      { value: "", label: "Select Data Code" },
      { value: "mm1", label: "Money Maker 1" },
      { value: "mm2", label: "Money Maker 2" },
      { value: "mm3", label: "Money Maker 3" },
    ];
    const companyCategories = [
      { value: "", label: "Select Company Category" },
      { value: "cat_a", label: "Category A" },
      { value: "cat_b", label: "Category B" },
      { value: "cat_c", label: "Category C" },
    ];
    const companyTypes = [
      { value: "", label: "Select Type" },
      { value: "private", label: "Private" },
      { value: "public", label: "Public" },
      { value: "government", label: "Government" },
      { value: "startup", label: "Startup" },
      { value: "mnc", label: "MNC" },
    ];
    const bonusDivisions = [
      { value: "3", label: "3 Months" },
      { value: "6", label: "6 Months" },
      { value: "12", label: "12 Months" },
      { value: "24", label: "24 Months" },
    ];
    const foirPercents = [
      { value: "50", label: "50%" },
      { value: "55", label: "55%" },
      { value: "60", label: "60%" },
      { value: "65", label: "65%" },
      { value: "70", label: "70%" },
    ];

    // Check Eligibility Section - Company Category Dropdown
    const checkEligibilityCompanyCategories = [
      { value: "super_cat_a", label: "Super CAT A" },
      { value: "cat_a", label: "CAT A" },
      { value: "cat_b", label: "CAT B" },
      { value: "cat_c", label: "CAT C" },
      { value: "unlisted", label: "UNLISTED or MANNUAL FILE" },
    ];

    // State
    const [currentDateTime, setCurrentDateTime] = useState(
      new Date().toISOString().replace("T", " ").slice(0, 19)
    );
    const [productType, setProductType] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [showLeadForm, setShowLeadForm] = useState(false);
    const [campaignName, setCampaignName] = useState("");
    const [dataCode, setDataCode] = useState("");
    const [companyCategory, setCompanyCategory] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [alternateNumber, setAlternateNumber] = useState("");
    const [pincode, setPincode] = useState("");
    const [city, setCity] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [companyType, setCompanyType] = useState("");
    const [salary, setSalary] = useState("");
    const [partnerSalary, setPartnerSalary] = useState("");
    const [yearlyBonus, setYearlyBonus] = useState("");
    const [bonusDivision, setBonusDivision] = useState("12");
    const [loanRequired, setLoanRequired] = useState("");
    const [foirPercent, setFoirPercent] = useState("60");
    const [eligibility, setEligibility] = useState({
      totalIncome: 0,
      foirAmount: 0,
      totalObligations: 0,
      totalBtPos: 0,
      foirEligibility: 0,
      multiplierEligibility: 0,
      finalEligibility: 0,
    });

    // --- Check Eligibility Section State ---
    const [ceCompanyCategory, setCeCompanyCategory] = useState("");
    const [ceFoirPercent, setCeFoirPercent] = useState("");
    const [ceTenureMonths, setCeTenureMonths] = useState("");
    const [ceTenureYears, setCeTenureYears] = useState("");
    const [ceRoi, setCeRoi] = useState("");
    const [ceMonthlyEmiCanPay, setCeMonthlyEmiCanPay] = useState("");
    const [ceMultiplier, setCeMultiplier] = useState("");
    const [loanEligibilityStatus, setLoanEligibilityStatus] = useState("");

    // Obligations Table State
    const [obligations, setObligations] = useState([
      {
        product: "",
        bankName: "",
        tenure: "",
        roi: "",
        totalLoan: "",
        outstanding: "",
        emi: "",
        action: "",
      },
    ]);
    const [bankDropdowns, setBankDropdowns] = useState([false]);
    const [bankFilters, setBankFilters] = useState([""]);
    const [productDropdowns, setProductDropdowns] = useState([false]);

    // Company search
    const [companySearch, setCompanySearch] = useState("");
    const [companySuggestions, setCompanySuggestions] = useState([]);
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
    const [isCompanyLoading, setIsCompanyLoading] = useState(false);

    const leadFormRef = useRef(null);

    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentDateTime(
          new Date().toISOString().replace("T", " ").slice(0, 19)
        );
      }, 1000);
      return () => clearInterval(timer);
    }, []);

    useEffect(() => {
      if (pincode.length === 6 && PINCODE_MAPPING[pincode]) {
        setCity(PINCODE_MAPPING[pincode]);
      }
    }, [pincode]);




    useEffect(() => {
      const s = parseFloat(salary) || 0;
      const ps = parseFloat(partnerSalary) || 0;
      const yb = parseFloat(yearlyBonus) || 0;
      const bd = parseInt(bonusDivision) || 12;
      const monthlyBonus = yb / bd;
      const totalIncome = s + ps + monthlyBonus;
      const fp = parseInt(foirPercent) || 60;
      const foirAmount = totalIncome * (fp / 100);

      let totalObligations = 0;
      let totalBtPos = 0;
      for (const row of obligations) {
        totalObligations += parseFloat(row.emi) || 0;
        totalBtPos += parseFloat(row.outstanding) || 0;
      }

      const foirEligibility = foirAmount - totalObligations;
      const multiplierEligibility = totalIncome * 20;

      let finalEligibility = 0;
      if (totalBtPos < foirEligibility) {
        finalEligibility = Math.min(foirEligibility, multiplierEligibility);
      } else {
        finalEligibility = multiplierEligibility - totalBtPos;
      }
      finalEligibility = Math.max(finalEligibility, 0);

      setEligibility({
        totalIncome,
        foirAmount,
        totalObligations,
        totalBtPos,
        foirEligibility,
        multiplierEligibility,
        finalEligibility,
      });
      setLoanEligibilityStatus(finalEligibility > 0 ? "Eligible" : "Not Eligible");
    }, [
      salary,
      partnerSalary,
      yearlyBonus,
      bonusDivision,
      foirPercent,
      obligations,
    ]);

    // Obligations Table Handlers
    const handleObligationChange = (idx, field, value) => {
      setObligations((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: value };
        return next;
      });
    };

    const handleAddObligation = () => {
      setObligations((prev) => [
        ...prev,
        {
          product: "",
          bankName: "",
          tenure: "",
          roi: "",
          totalLoan: "",
          outstanding: "",
          emi: "",
          action: "",
        },
      ]);
      setBankDropdowns((prev) => [...prev, false]);
      setBankFilters((prev) => [...prev, ""]);
      setProductDropdowns((prev) => [...prev, false]);
    };

    const handleDeleteObligation = (idx) => {
      setObligations((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        return next.length === 0
          ? [
            {
              product: "",
              bankName: "",
              tenure: "",
              roi: "",
              totalLoan: "",
              outstanding: "",
              emi: "",
              action: "",
            },
          ]
          : next;
      });
      setBankDropdowns((prev) => prev.filter((_, i) => i !== idx));
      setBankFilters((prev) => prev.filter((_, i) => i !== idx));
      setProductDropdowns((prev) => prev.filter((_, i) => i !== idx));
    };

    // Bank filter handlers for each row
    const handleBankDropdown = (idx, isOpen) => {
      setBankDropdowns((prev) =>
        prev.map((v, i) => (i === idx ? isOpen : false))
      );
    };
    const handleBankFilterChange = (idx, value) => {
      setBankFilters((prev) =>
        prev.map((v, i) => (i === idx ? value : v))
      );
      handleObligationChange(idx, "bankName", value);
    };
    const handleBankSelect = (idx, value) => {
      handleObligationChange(idx, "bankName", value);
      setBankDropdowns((prev) => prev.map((v, i) => (i === idx ? false : v)));
      setBankFilters((prev) => prev.map((v, i) => (i === idx ? value : v)));
    };

    // Product dropdown handlers for each row
    const handleProductDropdown = (idx, isOpen) => {
      setProductDropdowns((prev) =>
        prev.map((v, i) => (i === idx ? isOpen : false))
      );
    };
    const handleProductSelect = (idx, value) => {
      handleObligationChange(idx, "product", value);
      setProductDropdowns((prev) => prev.map((v, i) => (i === idx ? false : v)));
    };

    // Company search handlers
    const fetchCompanySuggestions = async (search) => {
      setIsCompanyLoading(true);
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
      await new Promise((r) => setTimeout(r, 500));
      const demo = [
        "Tata Consultancy Services",
        "Infosys",
        "Wipro",
        "HCL Technologies",
        "Reliance Industries"
      ].filter(name => name.toLowerCase().includes(search.toLowerCase()));
      setCompanySuggestions(demo);
      setShowCompanySuggestions(demo.length > 0);
      setIsCompanyLoading(false);
    };
    const handleCompanyInputChange = (e) => {
      setCompanyName(e.target.value);
      setCompanySearch(e.target.value);
      setShowCompanySuggestions(false);
    };
    const handleCompanySearchClick = () => {
      if (companySearch.trim().length > 0) {
        fetchCompanySuggestions(companySearch.trim());
      }
    };
    const handleCompanySuggestionClick = (name) => {
      setCompanyName(name);
      setCompanySearch(name);
      setShowCompanySuggestions(false);
    };

    // --- Check Eligibility Handlers ---
    const handleCeCompanyCategoryChange = (e) => setCeCompanyCategory(e.target.value);
    const handleCeFoirPercentChange = (e) => setCeFoirPercent(e.target.value);
    const handleCeTenureMonthsChange = (e) => {
      setCeTenureMonths(e.target.value.replace(/[^0-9]/g, ""));
      setCeTenureYears(e.target.value ? (parseInt(e.target.value) / 12).toFixed(2) : "");
    };
    const handleCeTenureYearsChange = (e) => {
      setCeTenureYears(e.target.value.replace(/[^0-9.]/g, ""));
      setCeTenureMonths(e.target.value ? Math.round(parseFloat(e.target.value) * 12).toString() : "");
    };
    const handleCeRoiChange = (e) => setCeRoi(e.target.value.replace(/[^0-9.]/g, ""));
    const handleCeMonthlyEmiCanPayChange = (e) => setCeMonthlyEmiCanPay(e.target.value.replace(/[^0-9.]/g, ""));
    const handleCeMultiplierChange = (e) => {
      let value = e.target.value.replace(/[^0-9]/g, "");
      if (value === "") value = "";
      else if (parseInt(value) > 35) value = "35";
      setCeMultiplier(value);
    };

    // --- HERE: handleCheckMobile function ---
    function handleCheckMobile() {
      if (!productType) {
        alert("Please select a Product Type");
        return;
      }
      if (
        !mobileNumber ||
        mobileNumber.length !== 10 ||
        !/^\d+$/.test(mobileNumber)
      ) {
        alert("Please enter a valid 10-digit Mobile Number");
        return;
      }
      setShowLeadForm(true);
      setTimeout(() => {
        if (leadFormRef && leadFormRef.current) {
          leadFormRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }

    return {
      // Basic info
      currentDateTime, productType, setProductType,
      mobileNumber, setMobileNumber, showLeadForm,
      campaignName, setCampaignName, dataCode, setDataCode,
      companyCategory, setCompanyCategory, customerName, setCustomerName,
      alternateNumber, setAlternateNumber, pincode, setPincode,
      city, setCity, companyName, setCompanyName, companyType, setCompanyType,
      salary, setSalary, partnerSalary, setPartnerSalary, yearlyBonus, setYearlyBonus,
      bonusDivision, setBonusDivision, loanRequired, setLoanRequired,
      foirPercent, setFoirPercent, eligibility, leadFormRef, handleCheckMobile,
      // Obligations
      obligations, handleObligationChange, handleAddObligation, handleDeleteObligation,
      // Bank dropdown/filter
      bankList, bankDropdowns, setBankDropdowns, bankFilters, handleBankDropdown,
      handleBankFilterChange, handleBankSelect,
      // Product dropdown
      productTypes, productDropdowns, setProductDropdowns, handleProductDropdown, handleProductSelect,
      // Customer Obligation summary
      totalBtPos, totalObligation,
      // Action types
      actionTypes,
      // Company search
      companySearch, companySuggestions, showCompanySuggestions,
      handleCompanyInputChange, handleCompanySearchClick, handleCompanySuggestionClick,
      setShowCompanySuggestions, isCompanyLoading,
      campaignNames, dataCodes, companyCategories, companyTypes, bonusDivisions, foirPercents,
      // Check Eligibility Section
      ceCompanyCategory, handleCeCompanyCategoryChange,
      ceFoirPercent, handleCeFoirPercentChange,
      ceTenureMonths, handleCeTenureMonthsChange,
      ceTenureYears, handleCeTenureYearsChange,
      ceRoi, handleCeRoiChange,
      ceMonthlyEmiCanPay, handleCeMonthlyEmiCanPayChange,
      ceMultiplier, handleCeMultiplierChange,
      loanEligibilityStatus,
      checkEligibilityCompanyCategories, formatINR, parseINR
    };
  }

  // --- Dummy Data for Reassignment Table ---
  const dummyLeads = [
    {
      id: 1,
      name: "John Doe",
      mobile: "9876543210",
      productType: "Personal Loan",
      assignedTo: "Agent 1",
      status: "Open",
    },
    {
      id: 2,
      name: "Jane Smith",
      mobile: "9123456789",
      productType: "Home Loan",
      assignedTo: "Agent 2",
      status: "Open",
    },
    {
      id: 3,
      name: "Amit Patel",
      mobile: "9001234567",
      productType: "Overdraft",
      assignedTo: "Agent 3",
      status: "Closed",
    },
  ];

  function ReassignmentTable() {
    const [leads, setLeads] = useState(dummyLeads);
    const [editId, setEditId] = useState(null);
    const [assignedTo, setAssignedTo] = useState({});
    const agents = ["Agent 1", "Agent 2", "Agent 3", "Agent 4"];
    const handleEdit = (id, currentAssigned) => {
      setEditId(id);
      setAssignedTo((prev) => ({ ...prev, [id]: currentAssigned }));
    };
    const handleChange = (id, value) => {
      setAssignedTo((prev) => ({ ...prev, [id]: value }));
    };
    const handleSave = (id) => {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id ? { ...lead, assignedTo: assignedTo[id] } : lead
        )
      );
      setEditId(null);
    };

    return (
      <div className="p-6 mb-6 rounded-lg shadow-md bg-zinc-900">
        <div className="mb-6 text-lg font-semibold text-sky-400">Lead Reassignment</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Lead ID</th>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Customer Name</th>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Mobile</th>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Product Type</th>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Assigned To</th>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Status</th>
                <th className="px-3 py-2 font-semibold text-gray-300 border-b border-neutral-800">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-3 py-2">{lead.id}</td>
                  <td className="px-3 py-2">{lead.name}</td>
                  <td className="px-3 py-2">{lead.mobile}</td>
                  <td className="px-3 py-2">{lead.productType}</td>
                  <td className="px-3 py-2">
                    {editId === lead.id ? (
                      <select
                        className="w-full px-2 py-1 text-white border rounded-lg form-select border-neutral-800 bg-neutral-800"
                        value={assignedTo[lead.id] || lead.assignedTo}
                        onChange={(e) => handleChange(lead.id, e.target.value)}
                      >
                        {agents.map((agent) => (
                          <option key={agent} value={agent}>{agent}</option>
                        ))}
                      </select>
                    ) : (
                      lead.assignedTo
                    )}
                  </td>
                  <td className="px-3 py-2">{lead.status}</td>
                  <td className="px-3 py-2">
                    {editId === lead.id ? (
                      <button
                        className="px-3 py-1 text-white rounded bg-sky-400 hover:bg-sky-500"
                        onClick={() => handleSave(lead.id)}
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        className="px-3 py-1 text-white rounded bg-neutral-700 hover:bg-neutral-600"
                        onClick={() => handleEdit(lead.id, lead.assignedTo)}
                      >
                        Reassign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function LoanEligibilitySection({
    salary,
    partnerSalary,
    yearlyBonus,
    bonusDivision,
    obligations,
    totalBtPos,
  }) {
    const [foirPercent, setFoirPercent] = useState(60);
    const [tenureMonths, setTenureMonths] = useState(60);
    const [roi, setRoi] = useState(11);
    const [multiplier, setMultiplier] = useState(20);

    // Calculation helpers
    const parseCurrency = (str) =>
      Math.round(parseFloat(String(str).replace(/[^\d.]/g, ""))) || 0;
    const formatCurrency = (amt) => {
      if (isNaN(amt) || amt === 0) return "₹0";
      amt = Math.round(amt);
      let s = amt.toString();
      let out = "";
      let i = s.length - 3;
      while (i > 0) {
        out = "," + s.slice(i, i + 2) + out;
        i -= 2;
      }
      out = s.slice(0, i + 2) + out + s.slice(-3);
      if (out.startsWith(",")) out = out.slice(1);
      return "₹" + out;
    };

    // Derived values
    const totalIncome =
      (parseFloat(salary) || 0) +
      (parseFloat(partnerSalary) || 0) +
      ((parseFloat(yearlyBonus) || 0) / (parseInt(bonusDivision) || 12));
    const totalObligation = obligations.reduce(
      (acc, row) => acc + (parseFloat(row.emi) || 0),
      0
    );
    const foirAmount = totalIncome * (parseInt(foirPercent) / 100);
    const monthlyEmiCanPay = Math.max(0, foirAmount - totalObligation);

    // FOIR-based eligibility
    const tMonths = parseInt(tenureMonths) || 0;
    const tRoi = parseFloat(roi) || 0;
    const monthlyRate = tRoi / 1200;
    let loanAmountFOIR = 0;
    if (tMonths && tRoi) {
      if (monthlyRate === 0) loanAmountFOIR = monthlyEmiCanPay * tMonths;
      else {
        const powerTerm = Math.pow(1 + monthlyRate, tMonths);
        if (powerTerm !== 1)
          loanAmountFOIR = (monthlyEmiCanPay * (powerTerm - 1)) / (monthlyRate * powerTerm);
        else loanAmountFOIR = monthlyEmiCanPay * tMonths;
      }
    }

    // Multiplier-based eligibility
    const multiplierEligibility = Math.max(0, totalIncome - totalObligation) * multiplier;

    // Final eligibility (lower of two)
    const finalEligibility =
      loanAmountFOIR > 0 && multiplierEligibility > 0
        ? Math.min(loanAmountFOIR, multiplierEligibility)
        : loanAmountFOIR > 0
          ? loanAmountFOIR
          : multiplierEligibility;

    // Shortfall check
    let shortfall = null;
    if (parseCurrency(totalBtPos) > finalEligibility && finalEligibility > 0) {
      shortfall = parseCurrency(totalBtPos) - finalEligibility;
    }

    return (
      <div>
        <h2 style={{ marginBottom: 12 }}>Loan Eligibility Calculator</h2>
        <div style={{ marginBottom: 12 }}>
          <label>
            FOIR %:{" "}
            <input
              type="number"
              min={1}
              max={100}
              value={foirPercent}
              onChange={(e) => setFoirPercent(e.target.value)}
              style={{ width: 60, marginRight: 20 }}
            />
          </label>
          <label>
            Tenure (Months):{" "}
            <input
              type="number"
              min={1}
              value={tenureMonths}
              onChange={(e) => setTenureMonths(e.target.value)}
              style={{ width: 60, marginRight: 20 }}
            />
          </label>
          <label>
            ROI (%):{" "}
            <input
              type="number"
              min={1}
              value={roi}
              step="0.01"
              onChange={(e) => setRoi(e.target.value)}
              style={{ width: 60, marginRight: 20 }}
            />
          </label>
          <label>
            Multiplier:{" "}
            <input
              type="number"
              min={1}
              max={35}
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              style={{ width: 60 }}
            />
          </label>
        </div>
        <div>
          <table style={{ width: "100%", maxWidth: 600, marginBottom: 16 }}>
            <tbody>
              <tr>
                <td>Total Income:</td>
                <td>{formatCurrency(totalIncome)}</td>
              </tr>
              <tr>
                <td>Total Obligation:</td>
                <td>{formatCurrency(totalObligation)}</td>
              </tr>
              <tr>
                <td>Monthly EMI Can Pay:</td>
                <td>{formatCurrency(monthlyEmiCanPay)}</td>
              </tr>
              <tr>
                <td>Loan Eligibility (FOIR):</td>
                <td>{formatCurrency(loanAmountFOIR)}</td>
              </tr>
              <tr>
                <td>Loan Eligibility (Multiplier):</td>
                <td>{formatCurrency(multiplierEligibility)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Final Loan Eligibility:</strong>
                </td>
                <td>
                  <strong>{formatCurrency(finalEligibility)}</strong>
                </td>
              </tr>
              <tr>
                <td>Total BT POS:</td>
                <td>{formatCurrency(totalBtPos)}</td>
              </tr>
            </tbody>
          </table>
          {finalEligibility > 0 && shortfall ? (
            <div style={{ color: "red", fontWeight: "bold" }}>
              Balance Transfer Not Possible. Shortfall of {formatCurrency(shortfall)}.
            </div>
          ) : finalEligibility > 0 ? (
            <div style={{ color: "green", fontWeight: "bold" }}>
              Eligible for Balance Transfer.
            </div>
          ) : (
            <div style={{ color: "red", fontWeight: "bold" }}>
              Not eligible for any loan.
            </div>
          )}
        </div>
      </div>
    );
  }


  // --- Main Component ---
  export default function CreateLead() {
    const [activeTab, setActiveTab] = useState("all");
    const [leadSection, setLeadSection] = useState("leadinfo");

    const [pincode, setPincode] = useState("");
    const [city, setCity] = useState("");
    const lastChanged = useRef(null);
    const [isFetchingPincode, setIsFetchingPincode] = useState(false);
    const [isFetchingCity, setIsFetchingCity] = useState(false);
    const [pincodeError, setPincodeError] = useState("");


    // Bi-directional autofill with online data!
    useEffect(() => {
      let ignore = false;

      if (pincode.length === 0) {
        setPincodeError("");
        setCity("");
        return;
      }

      if (pincode.length < 6) {
        setPincodeError("Pincode must be 6 digits.");
        setCity("");
        return;
      }

      if (
        lastChanged.current === "pincode" &&
        pincode.length === 6
      ) {
        setIsFetchingCity(true);
        fetchCityByPincode(pincode).then(resultCity => {
          if (!ignore) {
            if (resultCity) {
              setCity(resultCity);
              setPincodeError("");
            } else {
              setCity("");
              setPincodeError("Invalid pincode. Please enter a valid 6-digit Indian pincode.");
            }
          }
          setIsFetchingCity(false);
        });
      }
      return () => { ignore = true; };
    }, [pincode]);

    useEffect(() => {
      let ignore = false;
      const trimmedCity = city.trim();
      if (
        lastChanged.current === "city" &&
        trimmedCity.length > 2
      ) {
        setIsFetchingPincode(true);
        fetchPincodeByCity(trimmedCity).then(resultPincode => {
          if (!ignore && resultPincode && pincode !== resultPincode) setPincode(resultPincode);
          setIsFetchingPincode(false);
        });
      }
      return () => { ignore = true; };
    }, [city]);


    // --- Custom onChange handlers for money fields ---
    const handleSalaryChange = (e) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      setSalary(formatINR(raw));
    };
    const handlePartnerSalaryChange = (e) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      setPartnerSalary(formatINR(raw));
    };
    const handleYearlyBonusChange = (e) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      setYearlyBonus(formatINR(raw));
    };
    const handleLoanRequiredChange = (e) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      setLoanRequired(formatINR(raw));
    };

    // For Obligation Table fields (Total Loan, Outstanding, EMI)
    const handleObligationMoneyChange = (idx, field, value) => {
      const raw = value.replace(/[^0-9.]/g, "");
      handleObligationChange(idx, field, formatINR(raw));
    };



    const {
      currentDateTime, productType, setProductType,
      mobileNumber, setMobileNumber, showLeadForm,
      campaignName, setCampaignName, dataCode, setDataCode,
      companyCategory, setCompanyCategory, customerName, setCustomerName,
      alternateNumber, setAlternateNumber, companyName, setCompanyName, companyType, setCompanyType,
      salary, setSalary, partnerSalary, setPartnerSalary, yearlyBonus, setYearlyBonus,
      bonusDivision, setBonusDivision, loanRequired, setLoanRequired,
      foirPercent, setFoirPercent, eligibility, leadFormRef, handleCheckMobile,
      obligations, handleObligationChange, handleAddObligation, handleDeleteObligation,
      bankList, bankDropdowns, setBankDropdowns, bankFilters, handleBankDropdown,
      handleBankFilterChange, handleBankSelect,
      productTypes, productDropdowns, setProductDropdowns, handleProductDropdown, handleProductSelect,
      totalBtPos, totalObligation, actionTypes,
      companySearch, companySuggestions, showCompanySuggestions,
      handleCompanyInputChange, handleCompanySearchClick, handleCompanySuggestionClick,
      setShowCompanySuggestions, isCompanyLoading,
      campaignNames, dataCodes, companyCategories, companyTypes, bonusDivisions, foirPercents,
      ceCompanyCategory, handleCeCompanyCategoryChange,
      ceFoirPercent, handleCeFoirPercentChange,
      ceTenureMonths, handleCeTenureMonthsChange,
      ceTenureYears, handleCeTenureYearsChange,
      ceRoi, handleCeRoiChange,
      ceMonthlyEmiCanPay, handleCeMonthlyEmiCanPayChange,
      ceMultiplier, handleCeMultiplierChange,
      loanEligibilityStatus,
      checkEligibilityCompanyCategories, formatINR, parseINR
    } = useCreateLeadLogic();

    return (
      <>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
        <div className="flex-1 p-6 mx-auto main-content max-w-8xl">
          {/* Tab Selector */}
          <div className="flex items-center mb-8 space-x-2">
            <button
              className={`px-6 py-2 rounded-t-md font-extrabold text-xl transition ${activeTab === "all"
                ? "bg-sky-400 text-white"
                : "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
                }`}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              className={`px-6 py-2 rounded-t-md font-extrabold text-xl transition ${activeTab === "reassignment"
                ? "bg-sky-400 text-white"
                : "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
                }`}
              onClick={() => setActiveTab("reassignment")}
            >
              Reassignment
            </button>
          </div>

          {activeTab === "all" && (
            <>

              {/* Product selector */}
              <div className="p-6 mb-6 bg-white rounded-lg shadow-md card">
                <div className="mb-6 text-xl font-bold card-title text-[#03B0F5]">Select Product Type</div>
                <div className="form-section">
                  <div className="form-group">
                    <div className="flex flex-wrap gap-4 form-row">
                      <div className="form-group flex-1 min-w-[220px]">
                        <label className="block mb-2 text-md  font-bold text-black form-label required-field">
                          Product Type<span className="ml-1 text-red-400">*</span>
                        </label>
                        <select
                          className="w-full px-3 py-2 text-white border rounded-lg form-select border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400"
                          id="productType"
                          value={productType}
                          onChange={(e) => setProductType(e.target.value)}
                        >
                          <option value="">Select Product</option>
                          <option value="pl">Personal Loan (PL)</option>
                          <option value="od">Overdraft (OD)</option>
                          <option value="hl">Home Loan</option>
                        </select>
                      </div>
                      <div className="form-group flex-1 min-w-[220px]">
                        <label className="block mb-2 text-md font-bold text-black form-label required-field">
                          Mobile Number<span className="ml-1 text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-white border rounded-lg form-control border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400"
                          maxLength={10}
                          placeholder="Enter 10-digit Mobile Number"
                          value={mobileNumber}
                          onChange={(e) =>
                            setMobileNumber(
                              e.target.value.replace(/[^0-9]/g, "").slice(0, 10)
                            )
                          }
                        />
                      </div>
                      <div className="form-group flex-1 min-w-[150px] flex items-end">
                        <button
                          type="button"
                          className="w-full px-4 py-2 font-bold text-white rounded-lg btn btn-primary bg-sky-400 hover:bg-sky-500"
                          id="checkMobile"
                          onClick={handleCheckMobile}
                        >
                          Check &amp; Load Form
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LEAD FORM */}
              {showLeadForm && (
                <div className="p-6 mb-6 bg-white rounded-lg shadow-md card" id="leadForm" ref={leadFormRef}>
                  {/* Section Selector */}
                  <div className="flex gap-4 mb-8">
                    <button
                      className={`flex-1 px-6 py-3 text-lg font-bold uppercase rounded-t-md border-b-4 transition ${leadSection === "leadinfo"
                        ? "border-sky-400 text-[#03B0F5] bg-neutral-900"
                        : "border-transparent text-[#03B0F5] bg-neutral-800 hover:text-sky-300"
                        }`}
                      onClick={() => setLeadSection("leadinfo")}
                    >
                      Lead Information
                    </button>
                    <button
                      className={`flex-1 px-6 py-3 text-lg font-bold uppercase rounded-t-md border-b-4 transition ${leadSection === "obligation"
                        ? "border-sky-400 text-sky-400 bg-neutral-900"
                        : "border-transparent text-[#03B0F5] bg-neutral-800 hover:text-sky-300"
                        }`}
                      onClick={() => setLeadSection("obligation")}
                    >
                      Obligation
                    </button>
                  </div>

                  {/* Lead Information Section */}
                  {leadSection === "leadinfo" && (
                    <>
                      {/* Card 1: Lead Info */}
                      <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-neutral-200 card">
                        <div className="mb-2 text-lg font-extrabold text-[#03B0F5]">Lead Information</div>
                        <div className="form-section">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row">
                            {/* Column 1 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Campaign Name<span className="ml-1 text-red-400">*</span>
                              </label>
                              <select
                                className="w-full px-3 py-2 text-white border rounded-lg form-select border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                              >
                                {campaignNames.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {/* Column 2 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label">Data Code</label>
                              <select
                                className="w-full px-3 py-2 text-white border rounded-lg form-select border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400"
                                value={dataCode}
                                onChange={(e) => setDataCode(e.target.value)}
                              >
                                {dataCodes.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {/* Column 3 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Company Category<span className="ml-1 text-red-400">*</span>
                              </label>
                              <select
                                className="w-full px-3 py-2 text-white border rounded-lg form-select border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400"
                                value={companyCategory}
                                onChange={(e) => setCompanyCategory(e.target.value)}
                              >
                                {companyCategories.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Personal */}
                      <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-neutral-200 card">
                        <div className="mb-2 text-lg font-extrabold text-[#03B0F5]">Personal</div>
                        <div className="form-section">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row">
                            {/* Column 1 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Customer Name<span className="ml-1 text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 text-semibold focus:outline-none focus:border-sky-400"
                                placeholder="Full Name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                              />
                            </div>
                            {/* Column 2 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label">Alternate Number</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-80 focus:outline-none focus:border-sky-400"
                                placeholder="Alternate Mobile Number"
                                value={alternateNumber}
                                onChange={(e) =>
                                  setAlternateNumber(
                                    e.target.value.replace(/[^0-9]/g, "").slice(0, 10)
                                  )
                                }
                              />
                            </div>
                            {/* Column 3 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Pincode<span className="ml-1 text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none focus:border-sky-400"
                                id="pincode"
                                maxLength={6}
                                placeholder="6-digit Pincode"
                                value={pincode}
                                onChange={(e) => {
                                  lastChanged.current = "pincode";
                                  setPincode(
                                    e.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                                  )
                                }}
                              />
                              {(pincodeError || isFetchingCity) && (
                                <div className="text-xs mt-1" style={{ color: pincodeError ? "#f44336" : "#666" }}>
                                  {pincodeError ? pincodeError : isFetchingCity ? "Fetching city..." : ""}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 form-row">
                            {/* Column 1 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                City<span className="ml-1 text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
                                id="city"
                                placeholder="City"
                                value={city}
                                onChange={e => {
                                  lastChanged.current = "city";
                                  setCity(e.target.value)
                                }}
                                readOnly
                              />
                            </div>
                            {/* Column 2 */}
                            <div className="form-group relative">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Company Name<span className="ml-1 text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none focus:border-sky-400"
                                placeholder="Company Name"
                                value={companyName}
                                onChange={handleCompanyInputChange}
                                autoComplete="off"
                                onFocus={() => setShowCompanySuggestions(companySuggestions.length > 0)}
                                onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 100)}
                              />
                              {showCompanySuggestions && (
                                <div className="absolute z-10 w-full mt-1 border rounded shadow-lg bg-neutral-900 border-neutral-700">
                                  {companySuggestions.map((name) => (
                                    <div
                                      key={name}
                                      className="px-3 py-2 text-gray-300 cursor-pointer hover:bg-sky-400/10"
                                      onMouseDown={() => handleCompanySuggestionClick(name)}
                                    >
                                      {name}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Column 3 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Company Type<span className="ml-1 text-red-400">*</span>
                              </label>
                              <select
                                className="w-full px-3 py-2 text-black border rounded-lg form-select border-neutral-800 focus:outline-none focus:border-sky-400"
                                value={companyType}
                                onChange={(e) => setCompanyType(e.target.value)}
                              >
                                {companyTypes.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Financial */}
                      <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-neutral-200 card">
                        <div className="mb-2 text-lg font-extrabold text-[#03B0F5]">Financial</div>
                        <div className="form-section">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row">
                            {/* Column 1 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Monthly Salary<span className="ml-1 text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none focus:border-sky-400"
                                id="salary"
                                placeholder="In Rupees"
                                value={salary}
                                onChange={handleSalaryChange}
                                inputMode="numeric"
                              />
                            </div>
                            {/* Column 2 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label">Partner's Salary</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none focus:border-sky-400"
                                id="partnerSalary"
                                placeholder="In Rupees"
                                value={partnerSalary}
                                onChange={handlePartnerSalaryChange}
                                inputMode="numeric"
                              />
                            </div>
                            {/* Column 3 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black form-label">Yearly Bonus</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none focus:border-sky-400"
                                id="yearlyBonus"
                                placeholder="In Rupees"
                                value={yearlyBonus}
                                onChange={handleYearlyBonusChange}
                                inputMode="numeric"
                              />

                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 form-row">
                            {/* Column 1 */}
                            <div className="form-group">
                              <label className="block mb-2 text-md font-bold text-black font- form-label">Bonus Division</label>
                              <select
                                className="w-full px-3 py-2 text-black border rounded-lg form-select border-neutral-800 focus:outline-none focus:border-sky-400"
                                id="bonusDivision"
                                value={bonusDivision}
                                onChange={(e) => setBonusDivision(e.target.value)}
                              >
                                {bonusDivisions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {/* Column 2 */}
                            <div className="form-group col-span-2">
                              <label className="block mb-2 text-md font-bold text-black form-label required-field">
                                Loan Amount Required<span className="ml-1 text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg form-control border-neutral-800 focus:outline-none focus:border-sky-400"
                                id="loanRequired"
                                placeholder="In Rupees"
                                value={loanRequired}
                                onChange={handleLoanRequiredChange}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* OBLIGATION SECTION */}
                  {leadSection === "obligation" && (
                    <div className="mb-8 form-section">
                      {/* Customer Details Section */}
                      <div className="mb-6">
                        <div className="mb-2 text-2xl font-bold text-sky-400">Customer Details</div>
                        <div className="flex flex-wrap items-end gap-4 p-4 mb-4 border rounded-lg bg-grey/50 border-neutral-700">
                          {/* Customer Name */}
                          <div className="form-group flex-1 min-w-[180px]">
                            <label className="block mb-2 text-lg font-bold text-black">Customer Name</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Full Name"
                            />
                          </div>
                          {/* Mobile Number */}
                          <div className="form-group flex-1 min-w-[140px]">
                            <label className="block mb-2 text-lg font-bold text-black">Mobile Number</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                              value={mobileNumber}
                              onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                              placeholder="10-digit number"
                            />
                          </div>
                          {/* Salary */}
                          <div className="form-group flex-1 min-w-[140px]">
                            <label className="block mb-2 text-lg font-bold text-black">Salary</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                              value={salary}
                              onChange={handleSalaryChange}
                              placeholder="In Rupees"
                              inputMode="numeric"
                            />
                          </div>
                          {/* Partner's Salary */}
                          <div className="form-group flex-1 min-w-[140px]">
                            <label className="block mb-2 text-lg font-bold text-black">Partner's Salary</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                              value={partnerSalary}
                              onChange={handlePartnerSalaryChange}
                              placeholder="In Rupees"
                              inputMode="numeric"
                            />
                          </div>
                          {/* Bonus */}
                          <div className="form-group flex-1 min-w-[140px] relative">
                            <label className="block mb-2 text-lg font-bold text-black">Bonus</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                              value={yearlyBonus}
                              onChange={handleYearlyBonusChange}
                              placeholder="In Rupees"
                              inputMode="numeric"
                            />
                            {/* Bonus Division: Show in a single row if bonus is present */}
                            {/* Bonus Division: Show as buttons */}
                            {yearlyBonus && parseFloat(parseINR(yearlyBonus)) > 0 && (
                              <div className="flex gap-4 mt-3">
                                {[3, 6, 12, 24].map((divisor) => (
                                  <button
                                    key={divisor}
                                    type="button"
                                    className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg font-bold border border-sky-300 hover:bg-sky-200 transition"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        formatINR(Math.floor(Number(parseINR(yearlyBonus)) / divisor))
                                      );
                                    }}
                                  >
                                    <span className="text-gray-700">{divisor}:</span>{" "}
                                    <span>{formatINR(Math.floor(Number(parseINR(yearlyBonus)) / divisor))}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Company Name with search */}
                          <div className="form-group flex-1 min-w-[250px] relative">
                            <label className="block mb-2 text-lg font-bold text-black">Company Name</label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                                value={companyName}
                                onChange={handleCompanyInputChange}
                                placeholder="Company Name"
                                autoComplete="off"
                                onFocus={() => setShowCompanySuggestions(false)}
                              />
                              <button
                                type="button"
                                className="flex items-center px-3 py-2 ml-2 font-bold text-white rounded bg-sky-400 hover:bg-sky-500"
                                onClick={handleCompanySearchClick}
                                disabled={isCompanyLoading}
                                tabIndex={-1}
                              >
                                {isCompanyLoading ? (
                                  <i className="fas fa-spinner fa-spin"></i>
                                ) : (
                                  <i className="fas fa-search"></i>
                                )}
                              </button>
                            </div>
                            {showCompanySuggestions && (
                              <div className="absolute z-10 w-full mt-1 border rounded shadow-lg bg-neutral-900 border-neutral-700">
                                {companySuggestions.map((name) => (
                                  <div
                                    key={name}
                                    className="px-3 py-2 text-gray-300 cursor-pointer hover:bg-sky-400/10"
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
                      {/* Customer Obligation Section - with glass effect */}
                      <div className="mb-4">
                        <div className="mb-2 text-2xl font-bold text-[#03B0F5]">Customer Obligation</div>
                        <div className="flex flex-wrap items-center gap-4 p-4 mb-2 glass-effect">
                          <div className="form-group flex-1 min-w-[220px]">
                            <label className="block mb-1 text-lg font-bold text-black">Total BT POS</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 font-bold text-[#000] bg-gray-200 border rounded-lg form-control border-neutral-800"
                              value={totalBtPos}
                              readOnly
                            />
                          </div>
                          <div className="form-group flex-1 min-w-[220px]">
                            <label className="block mb-1 text-lg font-bold text-black">Total Obligation</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 font-bold text-[#000] bg-gray-200 border rounded-lg form-control border-neutral-800"
                              value={totalObligation}
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                      {/* Product selection dropdowns above obligation table (one for each row) */}
                      <div className="mb-2 overflow-x-auto table-container">
                        <table id="obligationTable" className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="px-3 py-2 text-lg font-bold text-black border-b border-neutral-800">S.No</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Product</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Bank Name</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Tenure</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">ROI%</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Total Loan</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Outstanding</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">EMI</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Action</th>
                              <th className="px-3 py-2 text-xl text-black border-b font-bol border-neutral-800">Delete</th>
                            </tr>
                          </thead>
                          <tbody>
                            {obligations.map((row, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 text-black">{idx + 1}</td>
                                {/* Product Select Menu */}
                                <td className="px-3 py-2">
                                  <select
                                    className="w-full px-2 py-1 text-black border rounded-lg form-select border-neutral-800 focus:outline-none"
                                    value={row.product}
                                    onChange={e => handleObligationChange(idx, "product", e.target.value)}
                                  >
                                    <option value="">Select Product</option>
                                    {productTypes.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </td>
                                {/* Bank Name Select Menu */}
                                <td className="px-3 py-2">
                                  <select
                                    className="w-full px-2 py-1 text-black border rounded-lg form-select border-neutral-800 focus:outline-none"
                                    value={row.bankName}
                                    onChange={e => handleObligationChange(idx, "bankName", e.target.value)}
                                  >
                                    <option value="">Select Bank</option>
                                    {bankList.map(bank => (
                                      <option key={bank} value={bank}>{bank}</option>
                                    ))}
                                  </select>
                                </td>
                                {/* Tenure */}
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
                                    placeholder="Months"
                                    value={row.tenure}
                                    onChange={e =>
                                      handleObligationChange(idx, "tenure", e.target.value.replace(/[^0-9]/g, ""))
                                    }
                                  />
                                </td>
                                {/* ROI */}
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
                                    placeholder="%"
                                    step="0.01"
                                    value={row.roi}
                                    onChange={e =>
                                      handleObligationChange(idx, "roi", e.target.value.replace(/[^0-9.]/g, ""))
                                    }
                                  />
                                </td>
                                {/* Total Loan */}
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
                                    placeholder="Loan"
                                    value={row.totalLoan}
                                    onChange={e =>
                                      handleObligationChange(idx, "totalLoan", e.target.value.replace(/[^0-9.]/g, ""))
                                    }
                                  />
                                </td>
                                {/* Outstanding */}
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
                                    placeholder="Outstanding"
                                    value={row.outstanding}
                                    onChange={e =>
                                      handleObligationChange(idx, "outstanding", e.target.value.replace(/[^0-9.]/g, ""))
                                    }
                                  />
                                </td>
                                {/* EMI */}
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1 text-black border rounded-lg form-control border-neutral-800 focus:outline-none"
                                    placeholder="EMI"
                                    value={row.emi}
                                    onChange={e =>
                                      handleObligationChange(idx, "emi", e.target.value.replace(/[^0-9.]/g, ""))
                                    }
                                  />
                                </td>
                                {/* Action */}
                                <td className="px-3 py-2">
                                  <select
                                    className="w-full px-2 py-1 text-black border rounded-lg form-select border-neutral-800 focus:outline-none"
                                    value={row.action}
                                    onChange={e => handleObligationChange(idx, "action", e.target.value)}
                                  >
                                    <option value="">Select</option>
                                    {actionTypes.map(opt =>
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    )}
                                  </select>
                                </td>
                                {/* Delete */}
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
                          className="px-5 py-2 font-bold transition border-2 rounded-lg text-sky-400 border-sky-400 hover:bg-sky-400/20"
                          id="addObligationRow"
                          onClick={handleAddObligation}
                          type="button"
                        >
                          <i className="mr-2 fas fa-plus"></i> Add Another Obligation
                        </button>
                      </div>

                      {/* --- CHECK ELIGIBILITY SECTION --- */}
                      <div className="p-4 mt-6 mb-4 border rounded-lg border-sky-400 bg-sky-50/50">
                        <div className="mb-3 text-2xl font-bold text-sky-500">Check Eligibility</div>
                        {/* First Row */}
                        <div className="flex flex-wrap gap-4 mb-4">
                          {/* Total Income */}
                          <div className="form-group flex-1 min-w-[180px]">
                            <label className="block mb-1 text-base font-bold text-black">Total Income</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1 font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={eligibility.totalIncome}
                              readOnly
                            />
                          </div>
                          {/* Company Category Dropdown */}
                          <div className="form-group flex-1 min-w-[200px]">
                            <label className="block mb-1 text-base font-bold text-black">
                              Company Category
                            </label>
                            <select
                              className="w-full px-2 py-1 text-black bg-gray-100 border rounded-lg form-select border-neutral-300"
                              value={ceCompanyCategory}
                              onChange={handleCeCompanyCategoryChange}
                            >
                              <option value="">Select Category</option>
                              {checkEligibilityCompanyCategories.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          {/* FOIR % */}
                          <div className="form-group flex-1 min-w-[120px]">
                            <label className="block mb-1 text-base font-bold text-black">FOIR %</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={ceFoirPercent}
                              onChange={handleCeFoirPercentChange}
                              min={0}
                              max={100}
                            />
                          </div>
                          {/* FOIR Amount */}
                          <div className="form-group flex-1 min-w-[160px]">
                            <label className="block mb-1 text-base font-bold text-black">FOIR Amount</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1 font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={eligibility.foirAmount}
                              readOnly
                            />
                          </div>
                          {/* Total Obligation */}
                          <div className="form-group flex-1 min-w-[160px]">
                            <label className="block mb-1 text-base font-bold text-black">Total Obligation</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1 font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={eligibility.totalObligations}
                              readOnly
                            />
                          </div>
                        </div>
                        {/* Second Row */}
                        <div className="flex flex-wrap gap-4 mb-4">
                          {/* Monthly EMI Can Pay */}
                          <div className="form-group flex-1 min-w-[180px]">
                            <label className="block mb-1 text-base font-bold text-black">Monthly EMI Can Pay</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={ceMonthlyEmiCanPay}
                              onChange={handleCeMonthlyEmiCanPayChange}
                            />
                          </div>
                          {/* Tenure (Months) */}
                          <div className="form-group flex-1 min-w-[180px]">
                            <label className="block mb-1 text-base font-bold text-black">TENURE (Months)</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={ceTenureMonths}
                              onChange={handleCeTenureMonthsChange}
                            />
                          </div>
                          {/* Tenure (Years) */}
                          <div className="form-group flex-1 min-w-[180px]">
                            <label className="block mb-1 text-base font-bold text-black">TENURE (Years)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full px-2 py-1 text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={ceTenureYears}
                              onChange={handleCeTenureYearsChange}
                            />
                          </div>
                          {/* ROI */}
                          <div className="form-group flex-1 min-w-[140px]">
                            <label className="block mb-1 text-base font-bold text-black">ROI</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={ceRoi}
                              onChange={handleCeRoiChange}
                            />
                          </div>
                        </div>
                        {/* Third Row */}
                        <div className="flex flex-wrap items-end gap-4 mb-2">
                          {/* TOTAL BT POS */}
                          <div className="form-group flex-1 min-w-[180px]">
                            <label className="block mb-1 text-base font-bold text-black">TOTAL BT POS</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1 font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={eligibility.totalBtPos}
                              readOnly
                            />
                          </div>
                          {/* Loan Eligibility as per Hour */}
                          <div className="form-group flex-1 min-w-[220px]">
                            <label className="block mb-1 text-base font-bold text-black">Loan Eligibility as per Hour</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1 font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={eligibility.finalEligibility}
                              readOnly
                            />
                            <span className={`block mt-1 text-xs font-semibold ${loanEligibilityStatus === "Eligible" ? "text-green-600" : "text-red-600"}`}>
                              {loanEligibilityStatus === "Eligible" ? "You are eligible for this loan" : "You are NOT eligible for this loan"}
                            </span>
                          </div>
                          {/* Loan Eligibility as per Multiplier */}
                          <div className="form-group flex-1 min-w-[220px]">
                            <label className="block mb-1 text-base font-bold text-black">Loan Eligibility as per Multiplier</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1 font-bold text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                              value={eligibility.multiplierEligibility}
                              readOnly
                            />
                            <div className="flex items-center gap-2 mt-1">
                              <span className="block text-xs font-semibold text-black">Multiplier</span>
                              <input
                                type="number"
                                className="w-20 px-2 py-1 text-black bg-gray-100 border rounded-lg form-control border-neutral-300"
                                max={35}
                                min={1}
                                value={ceMultiplier}
                                onChange={handleCeMultiplierChange}
                                placeholder="Max 35"
                              />
                            </div>
                          </div>
                        </div>
                      </div>


                    </div>


                  )}

                  <div className="flex justify-end gap-4 mt-8 form-actions">
                    <button type="button" className="px-5 py-2 font-semibold text-white rounded-lg btn btn-secondary bg-neutral-800 hover:bg-neutral-700">
                      Cancel
                    </button>
                    <button type="button" className="px-5 py-2 font-bold text-white rounded-lg btn btn-primary bg-sky-400 hover:bg-sky-500">
                      Create Lead
                    </button>
                  </div>


                </div>
              )}
            </>
          )}


          {activeTab === "reassignment" && <ReassignmentTable />}
        </div>
      </>
    );
  }