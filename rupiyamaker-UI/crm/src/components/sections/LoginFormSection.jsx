import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Share2, X, Download } from "lucide-react";
import * as XLSX from 'xlsx';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

const QUAL_CATALOG = [
  { level: 'School Level', entries: ['10th Pass', '12th Pass'] },
  { level: 'Diploma Level', entries: ['ITI', 'Polytechnic Diploma', 'Diploma in Engineering', 'Diploma in Pharmacy (D.Pharm)', 'Diploma in Computer Applications', 'Diploma in Hotel Management', 'Diploma in Fashion Designing', 'Diploma in Nursing', 'Diploma in Agriculture', 'Diploma in Architecture', 'Diploma in Education (D.Ed)', 'Diploma in Physiotherapy', 'Diploma in Lab Technology'] },
  { level: "Bachelor's Degree", entries: ['BA', 'BA (Hons)', 'B.Com', 'B.Com (Hons)', 'B.Sc', 'B.Sc (Hons)', 'BBA', 'BCA', 'BMS', 'BSW', 'BFA', 'BJMC', 'BHM', 'BTTM', 'B.Des', 'B.Voc', 'B.Lib', 'B.Tech', 'BE', 'B.Arch', 'B.Plan', 'MBBS', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'BPT', 'B.Pharm', 'B.Sc Nursing', 'BVSc', 'LLB (3 Year)', 'BA LLB', 'BBA LLB', 'B.Com LLB', 'B.Ed', 'B.El.Ed', 'CA', 'CS', 'CMA'] },
  { level: "Master's Degree", entries: ['MA', 'M.Com', 'M.Sc', 'MBA', 'PGDM', 'MCA', 'M.Tech', 'ME', 'M.Pharm', 'MS', 'LLM', 'M.Ed', 'MSW', 'M.Des', 'M.Lib', 'M.Plan'] },
  { level: 'Doctorate Level', entries: ['PhD', 'MPhil', 'D.Litt', 'DM', 'MCh'] }
];
const getQualLevel = (qual) => {
  if (!qual) return '';
  const group = QUAL_CATALOG.find(g => g.entries.includes(qual));
  return group ? group.level : '';
};
const MARITAL_STATUS = ["Single", "Married"];
const ADDRESS_TYPES = ["Owned", "Rented", "Company provided"];
const ADDRESS_PROOFS = [
  "Aadhaar Card",
  "Voter ID Card",
  "Driving License",
  "Passport",
  "Electricity Bill",
  "Water Bill",
  "Gas Bill",
  "Postpaid Mobile Bill",
  "WiFi / Broadband Bill",
  "Bank Statement",
  "Rent Agreement",
  "Property Documents (Registry / Sale Deed)",
  "Credit Card Statement"
];
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
  canEdit = true, // Add canEdit prop for permission-based editing
  onFieldChange = null // Optional callback for auto-save (public form)
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
  const [availableBanks, setAvailableBanks] = useState([]);

  // Qualification searchable dropdown states
  const [qualOpen, setQualOpen] = useState(false);
  const [qualSearch, setQualSearch] = useState('');
  const qualRef = useRef(null);

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
    mobileNumber: isCoApplicant ? (data?.mobileNumber || data?.mobile_number || "") : (data?.mobileNumber || data?.mobile_number || mobileNumber || ""),
    alternateNumber: isCoApplicant ? (data?.alternateNumber || data?.alternate_number || "") : (data?.alternateNumber || data?.alternate_number || (leadData?.alternative_phone) || ""),
    mothersName: isCoApplicant ? (data?.mothersName || data?.mothers_name || "") : (data?.mothersName || data?.mothers_name || ""),
    maritalStatus: isCoApplicant ? (data?.maritalStatus || data?.marital_status || "") : (data?.maritalStatus || data?.marital_status || ""),
    spousesName: isCoApplicant ? (data?.spousesName || data?.spouses_name || "") : (data?.spousesName || data?.spouses_name || ""),
    spousesDob: isCoApplicant ? (data?.spousesDob || data?.spouses_dob || "") : (data?.spousesDob || data?.spouses_dob || ""),
    currentAddress: isCoApplicant ? (data?.currentAddress || data?.current_address || "") : (data?.currentAddress || data?.current_address || ""),
    currentAddressLandmark: isCoApplicant ? (data?.currentAddressLandmark || data?.current_address_landmark || "") : (data?.currentAddressLandmark || data?.current_address_landmark || ""),
    currentAddressType: isCoApplicant ? (data?.currentAddressType || data?.current_address_type || "") : (data?.currentAddressType || data?.current_address_type || ""),
    currentAddressProof: isCoApplicant ? (data?.currentAddressProof || data?.current_address_proof || "") : (data?.currentAddressProof || data?.current_address_proof || ""),
    yearsAtCurrentAddress: isCoApplicant ? (data?.yearsAtCurrentAddress || data?.years_at_current_address || "") : (data?.yearsAtCurrentAddress || data?.years_at_current_address || ""),
    yearsInCurrentCity: isCoApplicant ? (data?.yearsInCurrentCity || data?.years_in_current_city || "") : (data?.yearsInCurrentCity || data?.years_in_current_city || ""),
    permanentAddress: isCoApplicant ? (data?.permanentAddress || data?.permanent_address || "") : (data?.permanentAddress || data?.permanent_address || ""),
    permanentAddressLandmark: isCoApplicant ? (data?.permanentAddressLandmark || data?.permanent_address_landmark || "") : (data?.permanentAddressLandmark || data?.permanent_address_landmark || ""),
    companyName: isCoApplicant ? (data?.companyName || data?.company_name || "") : (data?.companyName || data?.company_name || ""),
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

  // Custom DOB picker states
  const [activeDobField, setActiveDobField] = useState(null);
  const [dobTempDay, setDobTempDay] = useState('');
  const [dobTempMonth, setDobTempMonth] = useState('');
  const [dobTempYear, setDobTempYear] = useState('');
  const dobPickerRef = useRef(null);

  // Custom Year+Month picker states
  const [activeYearField, setActiveYearField] = useState(null);
  const [yearTempYears, setYearTempYears] = useState('');
  const [yearTempMonths, setYearTempMonths] = useState('');
  const yearPickerRef = useRef(null);

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
      mobileNumber: isCoApplicant ? (data?.mobileNumber || data?.mobile_number || "") : (data?.mobileNumber || data?.mobile_number || mobileNumber || ""),
      alternateNumber: isCoApplicant ? (data?.alternateNumber || data?.alternate_number || "") : (data?.alternateNumber || data?.alternate_number || (leadData?.alternative_phone) || ""),
      fathersName: isCoApplicant ? (data?.fathersName || data?.fathers_name || "") : (data?.fathersName || data?.fathers_name || ""),
      ifscCode: isCoApplicant ? (data?.ifscCode || data?.ifsc_code || "") : (data?.ifscCode || data?.ifsc_code || ""),
      mothersName: isCoApplicant ? (data?.mothersName || data?.mothers_name || "") : (data?.mothersName || data?.mothers_name || ""),
      maritalStatus: isCoApplicant ? (data?.maritalStatus || data?.marital_status || "") : (data?.maritalStatus || data?.marital_status || ""),
      spousesName: isCoApplicant ? (data?.spousesName || data?.spouses_name || "") : (data?.spousesName || data?.spouses_name || ""),
      spousesDob: isCoApplicant ? (data?.spousesDob || data?.spouses_dob || "") : (data?.spousesDob || data?.spouses_dob || ""),
      currentAddress: isCoApplicant ? (data?.currentAddress || data?.current_address || "") : (data?.currentAddress || data?.current_address || ""),
      currentAddressLandmark: isCoApplicant ? (data?.currentAddressLandmark || data?.current_address_landmark || "") : (data?.currentAddressLandmark || data?.current_address_landmark || ""),
      currentAddressType: isCoApplicant ? (data?.currentAddressType || data?.current_address_type || "") : (data?.currentAddressType || data?.current_address_type || ""),
      currentAddressProof: isCoApplicant ? (data?.currentAddressProof || data?.current_address_proof || "") : (data?.currentAddressProof || data?.current_address_proof || ""),
      yearsAtCurrentAddress: isCoApplicant ? (data?.yearsAtCurrentAddress || data?.years_at_current_address || "") : (data?.yearsAtCurrentAddress || data?.years_at_current_address || ""),
      yearsInCurrentCity: isCoApplicant ? (data?.yearsInCurrentCity || data?.years_in_current_city || "") : (data?.yearsInCurrentCity || data?.years_in_current_city || ""),
      permanentAddress: isCoApplicant ? (data?.permanentAddress || data?.permanent_address || "") : (data?.permanentAddress || data?.permanent_address || ""),
      permanentAddressLandmark: isCoApplicant ? (data?.permanentAddressLandmark || data?.permanent_address_landmark || "") : (data?.permanentAddressLandmark || data?.permanent_address_landmark || ""),
      companyName: isCoApplicant ? (data?.companyName || data?.company_name || "") : (data?.companyName || data?.company_name || ""),
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

  // Close DOB / Year-Month pickers on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (activeDobField && dobPickerRef.current && !dobPickerRef.current.contains(e.target)) {
        setActiveDobField(null);
      }
      if (activeYearField && yearPickerRef.current && !yearPickerRef.current.contains(e.target)) {
        setActiveYearField(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [activeDobField, activeYearField]);

  // Fetch bank names from settings on mount
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`/api/settings/bank-names${userId ? `?user_id=${userId}` : ''}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          const names = data.filter(b => b.is_active).map(b => b.name);
          if (names.length > 0) setAvailableBanks(names);
        }
      } catch (e) {
        console.warn('Could not load bank names from settings', e);
      }
    };
    fetchBanks();
  }, []);

  // Close qualification dropdown on outside click
  useEffect(() => {
    const handleOutsideQual = (e) => {
      if (qualRef.current && !qualRef.current.contains(e.target)) {
        setQualOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideQual);
    return () => document.removeEventListener('mousedown', handleOutsideQual);
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

    const updatedFields = { ...fields, [field]: processedValue };
    setFields(updatedFields);
    if (onFieldChange) onFieldChange(updatedFields);
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

  const handleBlur = (field, value) => {
    // If field is _formSwitch, this is a special case for saving during tab switching
    const isFormSwitch = field === '_formSwitch';
    
    // For _formSwitch, use the full value object passed; otherwise update a single field
    const updatedData = isFormSwitch ? value : { ...fields, [field]: value };
    
    // Update local state
    if (!isFormSwitch) {
      setFields(prev => ({ ...prev, [field]: value }));
    }
    
    // Auto-save on every field blur for internal (non-public) forms
    if (!isPublic) {
      if (isFormSwitch && leadId) {
        handleSaveForm();
      } else if (!isFormSwitch && onSave) {
        onSave(updatedData);
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
      // Only update local state - let parent component handle debounced auto-save
      // This prevents duplicate activity history entries
      handleBlur(fieldName, newValue);
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

          // Form sharing silently enabled
        } else {
          // Missing credentials — link will still be generated
        }
      } else {
      }

      // Create a clean short link — rupiyamaker.com/f/{code} (no IP, no port)
      let formUrl;
      try {
        const shortRes = await fetch(`${API_BASE_URL}/share-links/create-form-short`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId || '',
            form_type: isCoApplicant ? 'coApplicant' : 'applicant',
            mobile: mobileNumber || 'guest',
          }),
        });
        if (shortRes.ok) {
          const shortData = await shortRes.json();
          formUrl = shortData.short_url; // https://rupiyamaker.com/f/{code}
        }
      } catch (_) { /* fallback below */ }

      // Fallback: plain URL (IP-free, using current origin)
      if (!formUrl) {
        const base = `${window.location.origin}/public/login-form/${mobileNumber || 'guest'}`;
        formUrl = isCoApplicant
          ? (leadId ? `${base}?leadId=${leadId}&coApplicant=true&restrictTo=coApplicant` : `${base}?coApplicant=true&restrictTo=coApplicant`)
          : (leadId ? `${base}?leadId=${leadId}&restrictTo=applicant` : `${base}?restrictTo=applicant`);
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
          alert(`${formType} Form link copied!\n\n${formUrl}`);
        }).catch(() => {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = formUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          const formType = isCoApplicant ? 'Co-Applicant' : 'Applicant';
          alert(`${formType} Form link copied!\n\n${formUrl}`);
        });
      }
    } catch (error) {
      alert('Error: ' + error.message);

      // Catch-block fallback: build plain URL (no IP, no port)
      const base = `${window.location.origin}/public/login-form/${mobileNumber || 'guest'}`;
      const formUrl = isCoApplicant
        ? (leadId ? `${base}?leadId=${leadId}&coApplicant=true&restrictTo=coApplicant` : `${base}?coApplicant=true&restrictTo=coApplicant`)
        : (leadId ? `${base}?leadId=${leadId}&restrictTo=applicant` : `${base}?restrictTo=applicant`);

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

  // ── Custom picker helpers ──────────────────────────────────────────────────
  const parseDateValue = (val) => {
    if (!val) return { day: '', month: '', year: '' };
    const dmy = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return { day: dmy[1], month: dmy[2], year: dmy[3] };
    const ymd = String(val).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return { day: ymd[3], month: ymd[2], year: ymd[1] };
    return { day: '', month: '', year: '' };
  };
  const formatDateDisplay = (d, m, y) => {
    if (!d && !m && !y) return '';
    return `${d ? String(d).padStart(2,'0') : 'DD'}/${m ? String(m).padStart(2,'0') : 'MM'}/${y || 'YYYY'}`;
  };
  const parseYearsMonths = (val) => {
    if (!val) return { years: '', months: '' };
    const s = String(val);
    const full = s.match(/(\d+)\s*[Yy]ear[s]?\s*(\d+)\s*[Mm]onth[s]?/);
    if (full) return { years: full[1], months: full[2] };
    const yearOnly = s.match(/^(\d+(?:\.\d+)?)\s*[Yy]ear[s]?/);
    if (yearOnly) { const n=parseFloat(yearOnly[1]); const y=Math.floor(n); const m=Math.round((n-y)*12); return { years: y>0?String(y):'', months: m>0?String(m):'' }; }
    const monthOnly = s.match(/^(\d+)\s*[Mm]onth[s]?/);
    if (monthOnly) return { years: '', months: monthOnly[1] };
    const num = parseFloat(s);
    if (!isNaN(num) && num > 0) { const y=Math.floor(num); const m=Math.round((num-y)*12); return { years: y>0?String(y):'', months: m>0?String(m):'' }; }
    return { years: s, months: '' };
  };
  const formatYearsMonths = (years, months) => {
    const y = parseInt(years) || 0;
    const m = parseInt(months) || 0;
    if (y === 0 && m === 0) return '';
    const parts = [];
    if (y > 0) parts.push(`${y} Year${y !== 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} Month${m !== 1 ? 's' : ''}`);
    return parts.join(' ');
  };
  const openDobPicker = (fieldName) => {
    if (!canEdit) return;
    const p = parseDateValue(fields[fieldName]);
    setDobTempDay(p.day); setDobTempMonth(p.month); setDobTempYear(p.year);
    setActiveDobField(fieldName); setActiveYearField(null);
  };
  const applyDob = () => {
    const formatted = formatDateDisplay(dobTempDay, dobTempMonth, dobTempYear);
    // Auto-calculate currentWorkExperience when DOJ Current Company is set
    if (activeDobField === 'dojCurrentCompany' && dobTempDay && dobTempMonth && dobTempYear) {
      const doj = new Date(parseInt(dobTempYear), parseInt(dobTempMonth) - 1, parseInt(dobTempDay));
      const now = new Date();
      if (!isNaN(doj.getTime()) && doj <= now) {
        let diffYears = now.getFullYear() - doj.getFullYear();
        let diffMonths = now.getMonth() - doj.getMonth();
        if (now.getDate() < doj.getDate()) diffMonths--;
        if (diffMonths < 0) { diffYears--; diffMonths += 12; }
        const expFormatted = formatYearsMonths(String(diffYears), String(diffMonths));
        const updatedFields = { ...fields, dojCurrentCompany: formatted, currentWorkExperience: expFormatted };
        setFields(updatedFields);
        if (!isPublic && onSave) onSave(updatedFields);
        setActiveDobField(null);
        return;
      }
    }
    handleChange(activeDobField, formatted);
    handleBlur(activeDobField, formatted);
    setActiveDobField(null);
  };
  const openYearPicker = (fieldName) => {
    if (!canEdit) return;
    const p = parseYearsMonths(fields[fieldName]);
    setYearTempYears(p.years); setYearTempMonths(p.months);
    setActiveYearField(fieldName); setActiveDobField(null);
  };
  const saveYearMonth = () => {
    const formatted = formatYearsMonths(yearTempYears, yearTempMonths);
    handleChange(activeYearField, formatted);
    handleBlur(activeYearField, formatted);
    setActiveYearField(null);
  };

  // Render a DOB picker field
  const renderDobPicker = (fieldName, label) => (
    <div className="flex flex-col h-full" ref={activeDobField === fieldName ? dobPickerRef : null}>
      <label className={labelClass} style={labelStyle}>{label}</label>
      <div className="relative">
        <div
          className={`${canEdit ? inputClass : inputReadOnlyClass} cursor-pointer flex items-center justify-between`}
          style={inputStyle}
          onClick={() => activeDobField === fieldName ? setActiveDobField(null) : openDobPicker(fieldName)}
        >
          <span className={fields[fieldName] ? '' : 'text-gray-400 font-normal'}>
            {fields[fieldName] || 'DD / MM / YYYY'}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        {activeDobField === fieldName && (
          <div className="absolute top-full left-0 z-50 bg-white border-2 border-cyan-400 rounded-xl p-4 shadow-2xl mt-1 w-full min-w-[240px]">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Day</label>
                <input type="number" min="1" max="31" value={dobTempDay}
                  onChange={e => setDobTempDay(e.target.value.replace(/[^0-9]/g,'').slice(0,2))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-black font-bold text-sm outline-none focus:border-cyan-400" placeholder="DD" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Month</label>
                <select value={dobTempMonth} onChange={e => setDobTempMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded px-1 py-1.5 text-black font-bold text-sm outline-none focus:border-cyan-400">
                  <option value="">MM</option>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => (
                    <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Year</label>
                <input type="number" min="1900" max="2030" value={dobTempYear}
                  onChange={e => setDobTempYear(e.target.value.slice(0,4))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-black font-bold text-sm outline-none focus:border-cyan-400" placeholder="YYYY" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={applyDob} className="flex-1 bg-cyan-500 text-white text-xs font-bold py-1.5 rounded hover:bg-cyan-600 transition-colors">Apply</button>
              <button type="button" onClick={() => setActiveDobField(null)} className="flex-1 bg-gray-100 text-gray-700 text-xs font-bold py-1.5 rounded hover:bg-gray-200 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render a Year+Month picker field
  const renderYearPicker = (fieldName, label) => (
    <div className="flex flex-col h-full" ref={activeYearField === fieldName ? yearPickerRef : null}>
      <label className={labelClass} style={labelStyle}>{label}</label>
      <div className="relative">
        <div
          className={`${canEdit ? inputClass : inputReadOnlyClass} cursor-pointer`}
          style={inputStyle}
          onClick={() => activeYearField === fieldName ? setActiveYearField(null) : openYearPicker(fieldName)}
        >
          {fields[fieldName] || <span className="text-gray-400 font-normal text-sm">Click to set...</span>}
        </div>
        {activeYearField === fieldName && (
          <div className="absolute top-full left-0 z-50 bg-white border-2 border-cyan-400 rounded-xl p-4 shadow-2xl mt-1 w-full">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Years</label>
                <input type="number" min="0" max="50" value={yearTempYears}
                  onChange={e => {
                    const y = e.target.value.replace(/[^0-9]/g,'');
                    setYearTempYears(y);
                    const fmt = formatYearsMonths(y, yearTempMonths);
                    if (fmt) handleChange(fieldName, fmt);
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-black font-bold text-sm outline-none focus:border-cyan-400" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Months</label>
                <input type="number" min="0" max="11" value={yearTempMonths}
                  onChange={e => {
                    const m = e.target.value.replace(/[^0-9]/g,'');
                    setYearTempMonths(m);
                    const fmt = formatYearsMonths(yearTempYears, m);
                    if (fmt) handleChange(fieldName, fmt);
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-black font-bold text-sm outline-none focus:border-cyan-400" placeholder="0" />
              </div>
            </div>
            <button type="button" onClick={saveYearMonth}
              className="w-full bg-cyan-500 text-white text-xs font-bold py-1.5 rounded hover:bg-cyan-600 transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Style classes to match About/HowToProcess sections
  const labelClass = "block font-bold mb-2 uppercase";
  const labelStyle = { color: "black", fontWeight: 650, fontSize: "15px" };  const inputClass =
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
        <div className="flex justify-start items-center mb-6">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center text-xl gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-300"
          >
            <Share2 className="w-5 h-5" />
            {isCoApplicant ? 'Share Co-Applicant Form' : 'Share Applicant Form'}
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
                            handleBlur("salaryAccountBank", "");
                            setBankSearch("");
                            setShowBankDropdown(false);
                          }}
                        >
                          ✕ Clear Selection
                        </div>
                      )}

                      {(() => {
                        const bankList = availableBanks.length > 0
                          ? availableBanks
                          : (bankOptions && bankOptions.length > 0 ? bankOptions : ["HDFC Bank", "ICICI Bank", "SBI Bank", "Axis Bank"]);
                        
                        const filteredBanks = bankList.filter(bank =>
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
                              handleBlur("salaryAccountBank", bank);
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
          <label className={labelClass} style={labelStyle}>Highest Qualification</label>
          <div className="relative" ref={qualRef}>
            <div
              className={`w-full px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between ${
                (isPublic || !canEdit)
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                  : 'bg-white border-black hover:border-cyan-400'
              } ${qualOpen ? 'border-cyan-400' : ''}`}
              style={{ fontSize: '15px', fontWeight: 'bold', color: fields.qualification ? '#16a34a' : '#6b7280' }}
              onClick={() => { if (!isPublic && canEdit) { setQualOpen(v => !v); setQualSearch(''); } }}
            >
              <span className="flex-1">
                {fields.qualification
                  ? <>{fields.qualification}{getQualLevel(fields.qualification) && <span style={{ fontWeight: 'normal', fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>({getQualLevel(fields.qualification)})</span>}</>
                  : 'Select Highest Qualification'}
              </span>
              <svg className={`w-5 h-5 transition-transform ${qualOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {qualOpen && !isPublic && canEdit && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-black text-sm focus:outline-none focus:border-cyan-400"
                    placeholder="Search qualification..."
                    value={qualSearch}
                    onChange={e => setQualSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {fields.qualification && (
                    <div
                      className="px-3 py-2 cursor-pointer text-red-600 hover:bg-red-50 border-b border-gray-100 text-sm font-medium"
                      onClick={() => { handleChange('qualification', ''); handleBlur('qualification', ''); setQualOpen(false); }}
                    >✕ Clear</div>
                  )}
                  {QUAL_CATALOG
                    .map(g => ({ ...g, entries: g.entries.filter(e => e.toLowerCase().includes(qualSearch.toLowerCase())) }))
                    .filter(g => g.entries.length > 0)
                    .map(g => (
                      <div key={g.level}>
                        <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">{g.level}</div>
                        {g.entries.map(entry => (
                          <div
                            key={entry}
                            className={`px-4 py-2 cursor-pointer text-sm text-black hover:bg-indigo-50 hover:text-indigo-700 ${
                              fields.qualification === entry ? 'bg-sky-50 text-sky-700 font-medium' : ''
                            }`}
                            onClick={() => { handleChange('qualification', entry); handleBlur('qualification', entry); setQualOpen(false); setQualSearch(''); }}
                          >{entry}</div>
                        ))}
                      </div>
                    ))
                  }
                  {QUAL_CATALOG.every(g => g.entries.every(e => !e.toLowerCase().includes(qualSearch.toLowerCase()))) && qualSearch && (
                    <div className="px-3 py-2 text-gray-500 text-sm text-center">No results for "{qualSearch}"</div>
                  )}
                </div>
              </div>
            )}
          </div>
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
            {renderDobPicker('spousesDob', "Spouse's DOB")}
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
        {renderYearPicker('yearsAtCurrentAddress', "No of Years Living in Current Addr.")}
        {renderYearPicker('yearsInCurrentCity', "No of Years Living in Current City")}
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
        {renderDobPicker('dojCurrentCompany', "DOJ in Current Company")}
        {renderYearPicker('currentWorkExperience', "Current Work Experience")}
        {renderYearPicker('totalWorkExperience', "Total Work Experience")}
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