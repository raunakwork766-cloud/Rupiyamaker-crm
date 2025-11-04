import React, { useRef, useState, useEffect } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { Search, Info } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './attachments.css';

export default function Attachments({ leadId, userId }) {
  // State for notifications
  const [notification, setNotification] = useState(null);
  
  // Test PDF generation on component mount
  useEffect(() => {
    console.log('🧪 Testing jsPDF on component mount...');
    try {
      const testDoc = new jsPDF();
      testDoc.text('Component mounted - PDF test', 20, 20);
      const testBlob = testDoc.output('blob');
      console.log('✅ jsPDF test successful in component:', testBlob);
      console.log('📊 Test blob size:', testBlob.size);
    } catch (error) {
      console.error('❌ jsPDF test failed in component:', error);
    }
  }, []);
  
  
  // Modal state - moved to the top level
  const [showModal, setShowModal] = useState(false);
  const [currentModalCategory, setCurrentModalCategory] = useState(null);
  const modalRef = useRef(null);
  
  // Show notification function
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };
  
  // Function to open modal - moved to the top level
  const openModal = (attachmentType) => {
    setCurrentModalCategory(attachmentType);
    setShowModal(true);
  };

  // Function to close modal - moved to the top level
  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => {
      setCurrentModalCategory(null);
    }, 300);
  };

  // Dynamic states
  const [attachmentTypes, setAttachmentTypes] = useState([]);
  const [historicalAttachmentTypes, setHistoricalAttachmentTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [dynamicFiles, setDynamicFiles] = useState({});
  const [dynamicRefs, setDynamicRefs] = useState({});
  const [dynamicPasswords, setDynamicPasswords] = useState({});
  const [documentPasswords, setDocumentPasswords] = useState({}); // State to store document passwords (indexed by document ID)
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false); // State for download all operation
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [showPasswordFor, setShowPasswordFor] = useState({});
  const [leadData, setLeadData] = useState(null); // State to store lead data for form exports
  const [showTooltip, setShowTooltip] = useState({}); // State to manage tooltip visibility

  // Base URL for API calls
  const BASE_URL = '/api';

  // Get userId from multiple possible sources
  const getUserId = () => {
    // Try different sources for userId
    if (userId) return userId;
    
    // Try from localStorage
    const localUserId = localStorage.getItem('userId') || localStorage.getItem('user_id');
    if (localUserId) return localUserId;
    
    // Default fallback
    console.warn('No userId found, using default');
    return 'default_user';
  };

  const currentUserId = getUserId();

  // Debug logging
  useEffect(() => {
    console.log('Attachments Component Debug:', {
      props: { leadId, userId },
      localStorage: {
        userId: localStorage.getItem('userId'),
        user_id: localStorage.getItem('user_id')
      },
      currentUserId
    });
  }, [leadId, userId]);

  // Tooltip handlers
  const handleTooltipEnter = (attachmentTypeId) => {
    setShowTooltip(prev => ({ ...prev, [attachmentTypeId]: true }));
  };

  const handleTooltipLeave = (attachmentTypeId) => {
    setShowTooltip(prev => ({ ...prev, [attachmentTypeId]: false }));
  };

  // Load attachment types for leads from API
  const loadAttachmentTypes = async () => {
    try {
      setLoadingTypes(true);
      
      // Fetch active attachment types
      const activeResponse = await fetch(`${BASE_URL}/settings/attachment-types?user_id=${currentUserId}&target_type=leads`);
      
      // Fetch all attachment types including historical/deleted ones
      const allTypesResponse = await fetch(`${BASE_URL}/settings/all-attachment-types?user_id=${currentUserId}&target_type=leads`);
      
      if (activeResponse.ok && allTypesResponse.ok) {
        const activeTypes = await activeResponse.json();
        const allTypes = await allTypesResponse.json();
        
        console.log('Loaded active attachment types:', activeTypes);
        console.log('Loaded all attachment types:', allTypes);
        
        setAttachmentTypes(activeTypes);
        setHistoricalAttachmentTypes(allTypes);
        
        // Initialize dynamic states for all attachment types (including historical ones)
        const initialFiles = {};
        const initialRefs = {};
        const initialPasswords = {};
        
        // First add active types
        activeTypes.forEach(type => {
          const key = type.name.toLowerCase().replace(/\s+/g, '_');
          initialFiles[key] = [];
          initialRefs[key] = React.createRef();
          initialPasswords[key] = "";
        });
        
        // Then add historical types (that don't exist in active types)
        allTypes.forEach(type => {
          if (!activeTypes.some(activeType => activeType.name === type.name)) {
            const key = type.name.toLowerCase().replace(/\s+/g, '_');
            initialFiles[key] = [];
            initialRefs[key] = React.createRef();
            initialPasswords[key] = "";
          }
        });
        
        setDynamicFiles(initialFiles);
        setDynamicRefs(initialRefs);
        setDynamicPasswords(initialPasswords);
      } else {
        console.error('Failed to load attachment types');
        setAttachmentTypes([]);
        setHistoricalAttachmentTypes([]);
      }
    } catch (error) {
      console.error('Error loading attachment types:', error);
      setAttachmentTypes([]);
      setHistoricalAttachmentTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

  // Load existing documents for the lead
  const loadUploadedDocuments = async () => {
    if (!leadId) return;
    
    try {
      // Determine if this is a login lead
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const apiUrl = isLoginLead
        ? `${BASE_URL}/lead-login/login-leads/${leadId}/documents?user_id=${currentUserId}`
        : `${BASE_URL}/leads/${leadId}/documents?user_id=${currentUserId}`;
      
      console.log(`📎 Attachments (GET): Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const documents = await response.json();
        setUploadedDocuments(documents);
        
        console.log(`📎 Loaded ${documents.length} documents from ${isLoginLead ? 'login_lead_documents' : 'lead_documents'} collection`);
        
        // Initialize document passwords
        const initialPasswords = {};
        documents.forEach(doc => {
          if (doc.has_password) {
            const typeKey = doc.document_type.toLowerCase().replace(/\s+/g, '_');
            // First try to use the password from the document itself
            if (doc.password) {
              initialPasswords[doc._id] = doc.password;
            } 
            // Otherwise fall back to the attachment type password field
            else {
              initialPasswords[doc._id] = dynamicPasswords[typeKey] || '';
            }
          }
        });
        
        // Update document passwords without overwriting existing ones
        setDocumentPasswords(prev => ({
          ...prev,
          ...initialPasswords
        }));
        
        // Initialize states for document types that exist in uploaded files but not in attachment types
        const existingDocumentTypes = new Set(documents.map(doc => doc.document_type));
        
        // Update the dynamic states for any document type that has files
        setDynamicFiles(prev => {
          const newFiles = {...prev};
          
          existingDocumentTypes.forEach(docType => {
            if (docType && !newFiles[docType.toLowerCase().replace(/\s+/g, '_')]) {
              const key = docType.toLowerCase().replace(/\s+/g, '_');
              newFiles[key] = [];
            }
          });
          
          return newFiles;
        });
        
        setDynamicRefs(prev => {
          const newRefs = {...prev};
          
          existingDocumentTypes.forEach(docType => {
            if (docType && !newRefs[docType.toLowerCase().replace(/\s+/g, '_')]) {
              const key = docType.toLowerCase().replace(/\s+/g, '_');
              newRefs[key] = React.createRef();
            }
          });
          
          return newRefs;
        });
        
        setDynamicPasswords(prev => {
          const newPasswords = {...prev};
          
          existingDocumentTypes.forEach(docType => {
            if (docType && !newPasswords[docType.toLowerCase().replace(/\s+/g, '_')]) {
              const key = docType.toLowerCase().replace(/\s+/g, '_');
              newPasswords[key] = "";
            }
          });
          
          return newPasswords;
        });
      }
    } catch (error) {
      console.error('Error loading uploaded documents:', error);
    }
  };

  // Function to fetch lead data for form exports
  const fetchLeadData = async () => {
    if (!leadId) return null;
    
    try {
      // First try to fetch as login lead, then fall back to regular lead
      let response = await fetch(`${BASE_URL}/lead-login/login-leads/${leadId}?user_id=${currentUserId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // If not found as login lead, try as regular lead
      if (!response.ok) {
        response = await fetch(`${BASE_URL}/leads/${leadId}?user_id=${currentUserId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
      
      if (response.ok) {
        const data = await response.json();
        setLeadData(data);
        console.log('📋 Lead data loaded:', {
          id: data._id,
          isLoginLead: !!(data.original_lead_id || data.login_created_at),
          hasOriginalLeadId: !!data.original_lead_id
        });
        return data;
      } else {
        console.error('Failed to fetch lead data for form export');
        return null;
      }
    } catch (error) {
      console.error('Error fetching lead data for form export:', error);
      return null;
    }
  };

  // Function to generate PDF file for Applicant form - matching LoginFormSection UI structure
  const generateApplicantPDF = (formData, leadInfo) => {
    console.log('🔧 generateApplicantPDF called with:', { formData, leadInfo });
    try {
      const doc = new jsPDF();
      let yPosition = 20;
      
      // Header - matching LoginFormSection style
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239); // Cyan color like in LoginFormSection
      doc.text('APPLICANT FORM', 105, yPosition, { align: 'center' });
      yPosition += 10;
      
      // Add decorative line
      doc.setLineWidth(1);
      doc.setDrawColor(0, 174, 239);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 15;
      
      // Lead info header
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      const customerName = leadInfo?.first_name || leadInfo?.customerName || leadInfo?.name || 'N/A';
      const leadId = leadInfo?._id || 'N/A';
      const generatedDate = new Date().toLocaleDateString();
      const generatedTime = new Date().toLocaleTimeString();
      
      doc.text(`Customer: ${customerName}`, 20, yPosition);
      doc.text(`Lead ID: ${leadId}`, 20, yPosition + 8);
      doc.text(`Generated: ${generatedDate} ${generatedTime}`, 20, yPosition + 16);
      yPosition += 35;
      
      // Get form data with fallbacks matching LoginFormSection field structure
      const data = formData || {};
      
      // SECTION 1: LOGIN & SENSITIVE INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239);
      doc.text('LOGIN & IDENTIFICATION DETAILS', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section1Fields = [
        ['Login Call Reference', data.referenceNameForLogin || '-'],
        ['Aadhar Number', data.aadharNumber || '-'],
        ['PAN Card', data.panCard || '-'],
        ['Father\'s Name', data.fathersName || '-'],
        ['Salary A/C Bank Name', data.salaryAccountBank || '-'],
        ['Salary A/C Bank Number', data.salaryAccountBankNumber || '-'],
        ['IFSC Code', data.ifscCode || '-']
      ];
      
      section1Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 2: PERSONAL INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239);
      doc.text('PERSONAL INFORMATION', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section2Fields = [
        ['Customer Name', data.customerName || customerName || '-'],
        ['Mobile Number', data.mobileNumber || '-'],
        ['Alternate Number', data.alternateNumber || '-'],
        ['Personal Email', data.personalEmail || '-'],
        ['Work Email', data.workEmail || '-'],
        ['Qualification', data.qualification || '-'],
        ['Mother\'s Name', data.mothersName || '-'],
        ['Marital Status', data.maritalStatus || '-']
      ];
      
      // Add spouse details if married
      if (data.maritalStatus === 'Married') {
        section2Fields.push(
          ['Spouse Name', data.spousesName || '-'],
          ['Spouse\'s DOB', data.spousesDob || '-']
        );
      }
      
      section2Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 3: ADDRESS INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239);
      doc.text('ADDRESS INFORMATION', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section3Fields = [
        ['Current Address', data.currentAddress || '-'],
        ['Current Address Landmark', data.currentAddressLandmark || '-'],
        ['Current Address Type', data.currentAddressType || '-'],
        ['Current Address Proof', data.currentAddressProof || '-'],
        ['Years at Current Address', data.yearsAtCurrentAddress || '-'],
        ['Years in Current City', data.yearsInCurrentCity || '-'],
        ['Permanent Address', data.permanentAddress || '-'],
        ['Permanent Address Landmark', data.permanentAddressLandmark || '-']
      ];
      
      section3Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 4: EMPLOYMENT INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239);
      doc.text('EMPLOYMENT INFORMATION', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section4Fields = [
        ['Company Name', data.companyName || '-'],
        ['Your Designation', data.yourDesignation || '-'],
        ['Your Department', data.yourDepartment || '-'],
        ['DOJ in Current Company', data.dojCurrentCompany || '-'],
        ['Current Work Experience (years)', data.currentWorkExperience || '-'],
        ['Total Work Experience (years)', data.totalWorkExperience || '-'],
        ['Office Address', data.officeAddress || '-'],
        ['Office Address Landmark', data.officeAddressLandmark || '-']
      ];
      
      section4Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 5: REFERENCES
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239);
      doc.text('1ST REFERENCE', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const ref1Fields = [
        ['Reference Name', data.ref1Name || '-'],
        ['Reference Mobile Number', data.ref1Mobile || '-'],
        ['Reference Relation', data.ref1Relation || '-'],
        ['Reference Address', data.ref1Address || '-']
      ];
      
      ref1Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 10;
      
      // 2ND REFERENCE
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 174, 239);
      doc.text('2ND REFERENCE', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const ref2Fields = [
        ['Reference Name', data.ref2Name || '-'],
        ['Reference Mobile Number', data.ref2Mobile || '-'],
        ['Reference Relation', data.ref2Relation || '-'],
        ['Reference Address', data.ref2Address || '-']
      ];
      
      ref2Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      // Footer
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Generated by RupiyaMe CRM System', 105, doc.internal.pageSize.height - 10, { align: 'center' });
      
      // Generate PDF as blob
      const pdfBlob = doc.output('blob');
      console.log('✅ Applicant PDF generated successfully:', pdfBlob);
      return pdfBlob;
    } catch (error) {
      console.error('❌ Error generating Applicant PDF:', error);
      return null;
    }
  };

  // Function to generate PDF file for Co-Applicant form - matching LoginFormSection UI structure
  const generateCoApplicantPDF = (formData, leadInfo) => {
    console.log('🔧 generateCoApplicantPDF called with:', { formDataKeys: Object.keys(formData || {}), leadInfoId: leadInfo?._id });
    try {
      const doc = new jsPDF();
      let yPosition = 20;
      
      // Header - matching LoginFormSection style
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47); // Red color for co-applicant
      doc.text('CO-APPLICANT FORM', 105, yPosition, { align: 'center' });
      yPosition += 10;
      
      // Add decorative line
      doc.setLineWidth(1);
      doc.setDrawColor(211, 47, 47);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 15;
      
      // Lead info header
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      const customerName = leadInfo?.first_name || leadInfo?.customerName || leadInfo?.name || 'N/A';
      const leadId = leadInfo?._id || 'N/A';
      const generatedDate = new Date().toLocaleDateString();
      const generatedTime = new Date().toLocaleTimeString();
      
      doc.text(`Customer: ${customerName}`, 20, yPosition);
      doc.text(`Lead ID: ${leadId}`, 20, yPosition + 8);
      doc.text(`Generated: ${generatedDate} ${generatedTime}`, 20, yPosition + 16);
      yPosition += 35;
      
      // Get form data with fallbacks matching LoginFormSection field structure
      const data = formData || {};
      
      // SECTION 1: LOGIN & SENSITIVE INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CO-APPLICANT IDENTIFICATION DETAILS', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section1Fields = [
        ['Aadhar Number', data.aadharNumber || '-'],
        ['PAN Card', data.panCard || '-'],
        ['Father\'s Name', data.fathersName || '-'],
        ['Salary A/C Bank Name', data.salaryAccountBank || '-'],
        ['Salary A/C Bank Number', data.salaryAccountBankNumber || '-'],
        ['IFSC Code', data.ifscCode || '-']
      ];
      
      section1Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 2: PERSONAL INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CO-APPLICANT PERSONAL INFORMATION', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section2Fields = [
        ['Customer Name', data.customerName || '-'],
        ['Mobile Number', data.mobileNumber || '-'],
        ['Alternate Number', data.alternateNumber || '-'],
        ['Personal Email', data.personalEmail || '-'],
        ['Work Email', data.workEmail || '-'],
        ['Qualification', data.qualification || '-'],
        ['Mother\'s Name', data.mothersName || '-'],
        ['Marital Status', data.maritalStatus || '-']
      ];
      
      // Add spouse details if married
      if (data.maritalStatus === 'Married') {
        section2Fields.push(
          ['Spouse Name', data.spousesName || '-'],
          ['Spouse\'s DOB', data.spousesDob || '-']
        );
      }
      
      section2Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 3: ADDRESS INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CO-APPLICANT ADDRESS INFORMATION', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section3Fields = [
        ['Current Address', data.currentAddress || '-'],
        ['Current Address Landmark', data.currentAddressLandmark || '-'],
        ['Current Address Type', data.currentAddressType || '-'],
        ['Current Address Proof', data.currentAddressProof || '-'],
        ['Years at Current Address', data.yearsAtCurrentAddress || '-'],
        ['Years in Current City', data.yearsInCurrentCity || '-'],
        ['Permanent Address', data.permanentAddress || '-'],
        ['Permanent Address Landmark', data.permanentAddressLandmark || '-']
      ];
      
      section3Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 4: EMPLOYMENT INFORMATION
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CO-APPLICANT EMPLOYMENT INFORMATION', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const section4Fields = [
        ['Company Name', data.companyName || '-'],
        ['Your Designation', data.yourDesignation || '-'],
        ['Your Department', data.yourDepartment || '-'],
        ['DOJ in Current Company', data.dojCurrentCompany || '-'],
        ['Current Work Experience (years)', data.currentWorkExperience || '-'],
        ['Total Work Experience (years)', data.totalWorkExperience || '-'],
        ['Office Address', data.officeAddress || '-'],
        ['Office Address Landmark', data.officeAddressLandmark || '-']
      ];
      
      section4Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // SECTION 5: REFERENCES
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CO-APPLICANT 1ST REFERENCE', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const ref1Fields = [
        ['Reference Name', data.ref1Name || '-'],
        ['Reference Mobile Number', data.ref1Mobile || '-'],
        ['Reference Relation', data.ref1Relation || '-'],
        ['Reference Address', data.ref1Address || '-']
      ];
      
      ref1Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      yPosition += 10;
      
      // 2ND REFERENCE
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CO-APPLICANT 2ND REFERENCE', 20, yPosition);
      yPosition += 8;
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      const ref2Fields = [
        ['Reference Name', data.ref2Name || '-'],
        ['Reference Mobile Number', data.ref2Mobile || '-'],
        ['Reference Relation', data.ref2Relation || '-'],
        ['Reference Address', data.ref2Address || '-']
      ];
      
      ref2Fields.forEach(([label, value]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 80, yPosition);
        yPosition += 8;
      });
      
      // Footer
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Generated by RupiyaMe CRM System', 105, doc.internal.pageSize.height - 10, { align: 'center' });
      
      // Generate PDF as blob
      const pdfBlob = doc.output('blob');
      console.log('✅ Co-Applicant PDF generated successfully:', pdfBlob);
      return pdfBlob;
    } catch (error) {
      console.error('❌ Error generating Co-Applicant PDF:', error);
      return null;
    }
  };

  // Load attachment types on component mount
  useEffect(() => {
    if (currentUserId) {
      loadAttachmentTypes();
    }
  }, [currentUserId]);

  // Load lead data when leadId changes to determine if it's a login lead
  useEffect(() => {
    if (leadId && currentUserId) {
      fetchLeadData();
    }
  }, [leadId, currentUserId]);

  // Load uploaded documents when leadId and leadData are available
  useEffect(() => {
    if (leadId && leadData && !loadingTypes && currentUserId) {
      loadUploadedDocuments();
    }
  }, [leadId, leadData, loadingTypes, currentUserId]);

  // Handler for dynamic file input changes - now triggers direct upload
  const handleFileChange = (attachmentKey) => async (e) => {
    console.log('handleFileChange called with key:', attachmentKey);
    const files = Array.from(e.target.files);
    
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log('Files selected:', files.length, files.map(f => f.name));
    
    // Find the attachment type for this key
    const attachmentType = attachmentTypes.find(type => 
      type.name.toLowerCase().replace(/\s+/g, '_') === attachmentKey
    ) || historicalAttachmentTypes.find(type => 
      type.name.toLowerCase().replace(/\s+/g, '_') === attachmentKey
    );
    
    if (attachmentType) {
      console.log('Found attachment type:', attachmentType.name);
      
      // Store files temporarily for upload
      setDynamicFiles(prev => ({
        ...prev,
        [attachmentKey]: files
      }));
      
      // Show uploading notification
      showNotification(`Uploading ${files.length} file(s) for ${attachmentType.name}...`, 'info');
      
      // Trigger direct upload
      try {
        await handleUpload(attachmentType, files);
      } catch (error) {
        console.error('Error in handleFileChange:', error);
        showNotification('Upload failed: ' + error.message, 'error');
      }
    } else {
      console.error('Attachment type not found for key:', attachmentKey);
      console.log('Available attachment types:', attachmentTypes.map(t => t.name));
      console.log('Available historical types:', historicalAttachmentTypes.map(t => t.name));
      showNotification('Attachment type not found. Please try again.', 'error');
    }
  };

  // Function for modal file selection (without automatic upload)
  const handleModalFileChange = (attachmentKey) => (e) => {
    console.log('handleModalFileChange called with key:', attachmentKey);
    const files = Array.from(e.target.files);
    
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log('Files selected for modal:', files.length, files.map(f => f.name));
    
    // Just store files temporarily without uploading
    setDynamicFiles(prev => ({
      ...prev,
      [attachmentKey]: files
    }));
    
    showNotification(`${files.length} file(s) selected. Click "Add Files" to upload.`, 'info');
  };

  // Function to manually upload files from modal
  const handleModalUpload = async () => {
    if (!currentModalCategory) {
      showNotification('No category selected', 'error');
      return;
    }

    const key = currentModalCategory.name.toLowerCase().replace(/\s+/g, '_');
    const files = dynamicFiles[key];
    
    if (!files || files.length === 0) {
      showNotification('Please select files first', 'warning');
      return;
    }

    try {
      showNotification(`Uploading ${files.length} file(s) for ${currentModalCategory.name}...`, 'info');
      await handleUpload(currentModalCategory, files);
    } catch (error) {
      console.error('Error in handleModalUpload:', error);
      showNotification('Upload failed: ' + error.message, 'error');
    }
  };

  // Handler for password input change
  const handlePasswordChange = (attachmentKey, value) => {
    setDynamicPasswords(prev => ({
      ...prev,
      [attachmentKey]: value
    }));
  };

  // Handler for uploading files
  const handleUpload = async (attachmentType, files) => {
    if (!leadId || !files.length || !currentUserId) {
      alert('Missing required information: leadId, files, or userId');
      return;
    }

    try {
      setIsLoading(true);
      const formData = new FormData();
      
      // Get the key for this attachment type
      const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
      
      // Add files to form data
      files.forEach(file => {
        formData.append('files', file);  // Changed from 'documents' to 'files' to match backend API
      });
      
      // Add metadata
      formData.append('user_id', currentUserId);
      formData.append('document_type', attachmentType.name);
      formData.append('category', 'general');  // Required by backend API
      
      // Add password if provided for this specific attachment type
      const password = dynamicPasswords[key];
      if (password) {
        formData.append('password', password);
      }

      console.log('Uploading with data:', {
        leadId,
        userId: currentUserId,
        documentType: attachmentType.name,
        filesCount: files.length,
        hasPassword: !!password
      });

      // Determine if this is a login lead
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const uploadUrl = isLoginLead
        ? `${BASE_URL}/lead-login/login-leads/${leadId}/documents?user_id=${currentUserId}`
        : `${BASE_URL}/leads/${leadId}/documents?user_id=${currentUserId}`;
      
      console.log(`📎 Attachments (POST): Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload result:', result);
        
        // Use notification with password info if applicable
        const successMsg = password 
          ? `${files.length} file(s) for ${attachmentType.name} uploaded successfully with password protection!` 
          : `${files.length} file(s) for ${attachmentType.name} uploaded successfully!`;
        
        showNotification(successMsg, 'success');
        
        // Clear the uploaded files and reset password
        const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
        setDynamicFiles(prev => ({
          ...prev,
          [key]: []
        }));
        
        // Clear password after successful upload
        setDynamicPasswords(prev => ({
          ...prev,
          [key]: ''
        }));
        
        // Reset file input
        if (dynamicRefs[key]?.current) {
          dynamicRefs[key].current.value = '';
        }
        
        // Also reset modal file input if it exists
        const modalFileInput = document.getElementById('modalFileInput');
        if (modalFileInput) {
          modalFileInput.value = '';
        }
        
        // Also clear modal password input
        const modalPasswordInput = document.getElementById('modalPasswordInput');
        if (modalPasswordInput) {
          modalPasswordInput.value = '';
        }
        
        // Reload uploaded documents
        loadUploadedDocuments();
      } else {
        const error = await response.json();
        console.error('Upload error:', error);
        showNotification(`Upload failed: ${error.detail || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      showNotification('Upload failed: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle downloading a document
  const handleDownload = (docId) => {
    window.open(`${BASE_URL}/leads/${leadId}/attachments/${docId}/download?user_id=${currentUserId}`, '_blank');
    
    // Show a notification that the file might need a password
    const doc = uploadedDocuments.find(d => d._id === docId);
    if (doc && doc.has_password) {
      // Show password indicator
      setShowPasswordFor(prev => ({
        ...prev,
        [docId]: true
      }));
      
      // Show notification
      const docType = doc.document_type;
      const password = getDocumentPassword(doc);
      
      if (password && !password.includes("not available")) {
        showNotification(`The document "${doc.filename}" is password protected. Click the lock icon to view the password.`, 'warning');
      } else {
        showNotification(`The document "${doc.filename}" is password protected. Please enter a password in the "${docType}" field above.`, 'warning');
      }
      
      // Hide password indicator after 10 seconds
      setTimeout(() => {
        setShowPasswordFor(prev => ({
          ...prev,
          [docId]: false
        }));
      }, 10000);
    } else {
      showNotification(`Downloading "${doc?.filename || 'document'}"...`, 'success');
    }
  };

  // Handler for deleting a document
  const handleDelete = async (docId) => {
    const doc = uploadedDocuments.find(d => d._id === docId);
    if (!doc) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${doc.filename || doc.file_name || 'this document'}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      
      const response = await fetch(`${BASE_URL}/leads/${leadId}/attachments/${docId}?user_id=${currentUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        showNotification(`Document "${doc.filename || doc.file_name}" deleted successfully!`, 'success');
        // Reload uploaded documents to reflect the deletion
        loadUploadedDocuments();
      } else {
        const error = await response.json();
        console.error('Delete error:', error);
        showNotification(`Failed to delete document: ${error.detail || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showNotification('Failed to delete document: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for save all files
  const handleSaveAll = async () => {
    if (!leadId) {
      alert('No lead ID provided');
      return;
    }

    const filesToUpload = Object.entries(dynamicFiles).filter(([key, files]) => files.length > 0);
    
    if (filesToUpload.length === 0) {
      alert('No files selected for upload');
      return;
    }

    try {
      setIsLoading(true);
      
      for (const [key, files] of filesToUpload) {
        // Find the attachment type for this key
        const attachmentType = attachmentTypes.find(type => 
          type.name.toLowerCase().replace(/\s+/g, '_') === key
        );
        
        // If not found in active types, check in historical types
        const historicalType = !attachmentType ? 
          historicalAttachmentTypes.find(type => 
            type.name.toLowerCase().replace(/\s+/g, '_') === key
          ) : null;
        
        if ((attachmentType || historicalType) && files.length > 0) {
          await handleUpload(attachmentType || historicalType, files);
        }
      }
      
      alert('All files uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for downloading all files as ZIP
  const handleDownloadAll = async () => {
    if (!leadId || uploadedDocuments.length === 0) {
      showNotification('No documents available to download', 'warning');
      return;
    }

    try {
      setIsDownloadingAll(true);
      showNotification('Preparing download... This may take a moment.', 'info');

      // Create JSZip instance directly
      const zip = new JSZip();
      
      if (!zip || typeof zip.file !== 'function') {
        throw new Error('JSZip instance is invalid');
      }

      const passwordInfo = [];
      let downloadedCount = 0;
      let failedCount = 0;

      // Create folders for different document types
      const documentsByType = {};
      uploadedDocuments.forEach(doc => {
        const type = doc.document_type || 'Other';
        if (!documentsByType[type]) {
          documentsByType[type] = [];
        }
        documentsByType[type].push(doc);
      });

      // Create "All" folder first (with prefix to ensure it appears at the top)
      const allFolder = zip.folder("All");
      let allFolderDownloadedCount = 0;
      
      // Fetch lead data and add PDF forms to "All" folder
      let currentLeadData = leadData;
      if (!currentLeadData) {
        console.log('📋 No leadData prop provided, fetching from API...');
        currentLeadData = await fetchLeadData();
      }
      
      console.log('📋 Current lead data:', currentLeadData);
      console.log('📋 Lead ID:', currentLeadData?._id);
      console.log('📋 Dynamic fields:', currentLeadData?.dynamic_fields);
      console.log('📋 Applicant form data:', currentLeadData?.dynamic_fields?.applicant_form);
      console.log('📋 Co-applicant form data:', currentLeadData?.dynamic_fields?.co_applicant_form);
      console.log('📋 Legacy loginForm:', currentLeadData?.loginForm);
      console.log('📋 Legacy coApplicantForm:', currentLeadData?.coApplicantForm);
      
      if (currentLeadData && currentLeadData._id) {
        // Create "Applicant and Co-Applicant Form" subfolder within "All" folder
        const formsFolder = allFolder.folder("Applicant and Co-Applicant Form");
        console.log('📁 Forms folder created:', formsFolder);
        
        // PDF GENERATION - Create Applicant and Co-Applicant forms
        console.log('🔒 PDF GENERATION STARTING...');
        console.log('🔒 jsPDF available?', typeof jsPDF);
        console.log('🔒 JSZip available?', typeof JSZip);
        console.log('🔒 formsFolder created?', !!formsFolder);
        
        // 1. Always create Applicant PDF using improved function
        try {
          console.log('📝 Creating IMPROVED Applicant PDF...');
          
          // Define form data sources with proper fallbacks
          const applicantFormData = currentLeadData.dynamic_fields?.applicant_form || 
                                   currentLeadData.loginForm || 
                                   {};
          
          console.log('🔍 Applicant form data for PDF:', applicantFormData);
          
          // Create comprehensive form data by merging all available sources
          const allAvailableApplicantData = {
            // Base lead data
            customerName: currentLeadData.first_name || currentLeadData.customer_name || '',
            mobileNumber: currentLeadData.mobile || currentLeadData.phone || '',
            personalEmail: currentLeadData.email || '',
            
            // Merge all form data sources
            ...currentLeadData.dynamic_fields?.applicant_form,
            ...currentLeadData.loginForm,
            ...applicantFormData,
            
            // Add any top-level fields that might be relevant
            alternateNumber: currentLeadData.alternative_phone || currentLeadData.alternate_phone,
            ...Object.keys(currentLeadData)
              .filter(key => !['dynamic_fields', 'loginForm', '_id', '__v', 'created_at', 'updated_at'].includes(key))
              .reduce((acc, key) => {
                const value = currentLeadData[key];
                if (value && typeof value !== 'object') {
                  acc[key] = value;
                }
                return acc;
              }, {})
          };
          
          console.log('🔍 MERGED applicant data for PDF:', allAvailableApplicantData);
          
          const applicantBlob = generateApplicantPDF(allAvailableApplicantData, currentLeadData);
          
          if (applicantBlob) {
            const applicantFilename = `${(currentLeadData.first_name || 'Customer')}_Applicant_Form_${new Date().toISOString().split('T')[0]}.pdf`;
            console.log('💾 Adding applicant PDF to folder:', applicantFilename, 'Size:', applicantBlob.size);
            formsFolder.file(applicantFilename, applicantBlob);
            allFolderDownloadedCount++;
            console.log('✅ IMPROVED Applicant PDF created and added to ZIP');
          } else {
            console.error('❌ Failed to generate Applicant PDF');
          }
        } catch (error) {
          console.error('❌ IMPROVED Applicant PDF failed:', error);
          console.error('❌ Error stack:', error.stack);
        }
        
        // 2. Create Co-Applicant PDF using improved function
        try {
          console.log('📝 Creating IMPROVED Co-Applicant PDF...');
          
          // Check for co-applicant data
          const coApplicantFormData = currentLeadData.dynamic_fields?.co_applicant_form || 
                                     currentLeadData.coApplicantForm || 
                                     {};
          
          console.log('🔍 Co-applicant form data for PDF:', coApplicantFormData);
          
          // Create comprehensive co-applicant data by merging all available sources
          const allCoApplicantData = {
            // Base lead data for co-applicant (if they share some basic info)
            ...currentLeadData.dynamic_fields?.co_applicant_form,
            ...currentLeadData.coApplicantForm,
            ...coApplicantFormData
          };
          
          console.log('🔍 MERGED co-applicant data for PDF:', allCoApplicantData);
          
          const coApplicantBlob = generateCoApplicantPDF(allCoApplicantData, currentLeadData);
          
          if (coApplicantBlob) {
            const coApplicantFilename = `${(currentLeadData.first_name || 'Customer')}_Co-Applicant_Form_${new Date().toISOString().split('T')[0]}.pdf`;
            console.log('💾 Adding co-applicant PDF to folder:', coApplicantFilename, 'Size:', coApplicantBlob.size);
            formsFolder.file(coApplicantFilename, coApplicantBlob);
            allFolderDownloadedCount++;
            console.log('✅ IMPROVED Co-Applicant PDF created and added to ZIP');
          } else {
            console.error('❌ Failed to generate Co-Applicant PDF');
          }
        } catch (error) {
          console.error('❌ IMPROVED Co-Applicant PDF creation failed:', error);
          console.error('❌ Error stack:', error.stack);
        }
        
        console.log('🔒 GUARANTEED PDF GENERATION COMPLETED!');
        console.log('📊 Total PDFs added to forms folder:', allFolderDownloadedCount);
        
      } else {
        console.error('❌ No lead data available - cannot generate form PDFs');
        console.log('📋 leadData prop:', leadData);
        console.log('📋 leadId:', leadId);
      }
      
      for (const doc of uploadedDocuments) {
        try {
          // Fetch the file from the server
          const response = await fetch(
            `${BASE_URL}/leads/${leadId}/attachments/${doc._id}/download?user_id=${currentUserId}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            }
          );

          if (response.ok) {
            const blob = await response.blob();
            const filename = doc.filename || doc.file_name || `document_${doc._id}`;
            
            // Add file directly to "All" folder without any subfolders
            allFolder.file(filename, blob);
            allFolderDownloadedCount++;
          }
        } catch (error) {
          console.error(`Error downloading ${doc.filename || doc._id} for All folder:`, error);
        }
      }

      // Download each document and add to ZIP (organized by type)
      for (const [docType, docs] of Object.entries(documentsByType)) {
        const folder = zip.folder(docType);
        
        for (const doc of docs) {
          try {
            // Fetch the file from the server
            const response = await fetch(
              `${BASE_URL}/leads/${leadId}/attachments/${doc._id}/download?user_id=${currentUserId}`,
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              }
            );

            if (response.ok) {
              const blob = await response.blob();
              const filename = doc.filename || doc.file_name || `document_${doc._id}`;
              
              // Add file to the appropriate folder in ZIP
              folder.file(filename, blob);
              downloadedCount++;

              // If the document has a password, add it to password info
              if (doc.has_password) {
                const password = getDocumentPassword(doc);
                passwordInfo.push({
                  folder: docType,
                  filename: filename,
                  password: password && !password.includes("not available") ? password : "Password not available"
                });
              }
            } else {
              console.error(`Failed to download ${doc.filename || doc._id}`);
              failedCount++;
            }
          } catch (error) {
            console.error(`Error downloading ${doc.filename || doc._id}:`, error);
            failedCount++;
          }
        }
      }

      // Create password information file if there are password-protected files
      if (passwordInfo.length > 0) {
        let passwordText = "PASSWORD INFORMATION FOR DOWNLOADED FILES\n";
        passwordText += "=" + "=".repeat(45) + "\n\n";
        passwordText += `Generated on: ${new Date().toLocaleString()}\n`;
        passwordText += `Lead ID: ${leadId}\n\n`;
        
        // Group by folder
        const passwordsByFolder = {};
        passwordInfo.forEach(info => {
          if (!passwordsByFolder[info.folder]) {
            passwordsByFolder[info.folder] = [];
          }
          passwordsByFolder[info.folder].push(info);
        });

        Object.entries(passwordsByFolder).forEach(([folder, files]) => {
          passwordText += `${folder}:\n`;
          passwordText += "-".repeat(folder.length + 1) + "\n";
          files.forEach(file => {
            passwordText += `• ${file.filename}\n`;
            passwordText += `  Password: ${file.password}\n\n`;
          });
          passwordText += "\n";
        });

        passwordText += "\nIMPORTANT NOTES:\n";
        passwordText += "- Keep this file secure and delete it after use\n";
        passwordText += "- Some documents may not require passwords despite being listed\n";
        passwordText += "- If 'Password not available' is shown, the file might not be password protected\n";

        // Add password file to the root of the ZIP
        zip.file("PASSWORDS.txt", passwordText);
      }

      // Generate and download the ZIP file
      if (downloadedCount > 0) {
        console.log('📦 Final ZIP structure before generation:', {
          totalDownloadedCount: downloadedCount,
          allFolderDownloadedCount: allFolderDownloadedCount,
          zipFolders: Object.keys(zip.files)
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipFilename = `Lead_${leadId}_Documents_${new Date().toISOString().split('T')[0]}.zip`;
        saveAs(zipBlob, zipFilename);

        let successMessage = `Successfully downloaded ${downloadedCount} file(s) as ZIP archive.`;
        if (allFolderDownloadedCount > 0) {
          successMessage += ` Includes "All" folder with ${allFolderDownloadedCount} files.`;
        }
        if (passwordInfo.length > 0) {
          successMessage += ` Password information is included in PASSWORDS.txt file.`;
        }
        if (failedCount > 0) {
          successMessage += ` ${failedCount} file(s) failed to download.`;
        }
        
        showNotification(successMessage, 'success');
      } else {
        showNotification('No files could be downloaded', 'error');
      }

    } catch (error) {
      console.error('Error creating ZIP file:', error);
      showNotification('Failed to create download archive: ' + error.message, 'error');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Handler for removing a file
  const handleRemoveFile = (attachmentKey, index) => {
    setDynamicFiles(prev => {
      const newFiles = prev[attachmentKey].filter((_, i) => i !== index);
      
      // If all files are removed, reset the file input
      if (newFiles.length === 0) {
        const inputRef = dynamicRefs[attachmentKey];
        if (inputRef && inputRef.current) {
          inputRef.current.value = '';
        }
      }
      
      return {
        ...prev,
        [attachmentKey]: newFiles
      };
    });
  };

  // Render file previews or names - now using the new card-based design
  const renderFileNames = (files, attachmentKey) => {
    if (!files || files.length === 0) {
      return <span className="text-sm text-gray-500">No file selected</span>;
    }

    return (
      <div className="file-card-grid">
        {files.map((file, idx) => {
          const isImage = file.type.startsWith("image/");
          const isPdf = file.type === "application/pdf";
          
          return (
            <div
              key={idx}
              className="file-card flex flex-col items-center p-3 text-center rounded-lg"
            >
              <div className="relative">
                {isImage ? (
                  <div className="relative w-10 h-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                ) : isPdf ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              
              <p className="mt-2 text-sm font-semibold text-gray-800 break-all w-full">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              
              <div className="w-full border-t my-2"></div>
              
              <div className="flex items-center justify-center space-x-1 w-full">
                {isImage && (
                  <button 
                    className="view-btn flex items-center justify-center p-1.5 text-gray-500 hover:bg-gray-100 rounded-md tooltip"
                    onClick={() => {
                      const fileURL = URL.createObjectURL(file);
                      window.open(fileURL, '_blank');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    <span className="tooltiptext">View</span>
                  </button>
                )}
                
                <button 
                  className="delete-btn flex items-center justify-center p-1.5 text-red-500 hover:bg-red-100 rounded-md tooltip"
                  onClick={() => handleRemoveFile(attachmentKey, idx)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  <span className="tooltiptext">Remove</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Fetch document password from stored passwords
  const getDocumentPassword = (doc) => {
    if (!doc || !doc.has_password) return "";
    
    // Try to get password in following order of priority:
    // 1. If the document object has a password field, use that (this is the actual password used during upload)
    if (doc.password && doc.password.trim()) {
      return doc.password;
    }
    
    // 2. From document-specific stored password
    if (documentPasswords[doc._id] && documentPasswords[doc._id].trim()) {
      return documentPasswords[doc._id];
    }
    
    // 3. From the attachment type password field
    const typeKey = doc.document_type.toLowerCase().replace(/\s+/g, '_');
    if (dynamicPasswords[typeKey] && dynamicPasswords[typeKey].trim()) {
      return dynamicPasswords[typeKey];
    }
    
    // 4. Return placeholder message if no password found
    return "Password not available - please enter a password in the field above";
  };

  // Toggle password visibility for a document
  const togglePasswordVisibility = (docId, documentType) => {
    const isCurrentlyVisible = showPasswordFor[docId];
    
    // Toggle visibility state
    setShowPasswordFor(prev => ({
      ...prev,
      [docId]: !isCurrentlyVisible
    }));
    
    // If turning on visibility, ensure we have the password from the correct attachment type
    if (!isCurrentlyVisible) {
      // Find the document
      const doc = uploadedDocuments.find(d => d._id === docId);
      if (!doc) return;
      
      // Convert document type to the key used in dynamicPasswords
      const typeKey = documentType.toLowerCase().replace(/\s+/g, '_');
      
      // Store the document password in our documentPasswords state for easy access
      // Try to use the existing password from the attachment type
      setDocumentPasswords(prev => ({
        ...prev,
        [docId]: dynamicPasswords[typeKey] || ''
      }));
    }
  };
  
  // We don't need this function with the new UI as documents are displayed in the modal
  const renderUploadedDocuments = (attachmentType) => {
    // This function is no longer used with the new UI
    return null;
  };

  // Show loading state while attachment types are being loaded
  if (loadingTypes) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6" style={{borderColor: "#3b82f640"}}>Attachments</h1>
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center space-x-3">
              <div className="loader"></div>
              <div className="text-lg text-gray-600">Loading attachment types...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if userId is not available
  if (!currentUserId || currentUserId === 'default_user') {
    return (
      <div className="max-w-9xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6" style={{borderColor: "#3b82f640"}}>Attachments</h1>
          <div className="flex items-center justify-center p-8">
            <div className="text-lg text-red-600 text-center">
              Error: User ID not found. Please log in again.
              <br />
              <small className="text-gray-500">
                Debug: userId prop = {userId}, localStorage userId = {localStorage.getItem('userId')}
              </small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6" style={{borderColor: "#3b82f640"}}>Attachments</h1>
        
        {/* Notification area */}
        {notification && (
          <div className={`mb-4 p-3 rounded-lg flex items-center ${
            notification.type === 'error' ? 'bg-red-100 border border-red-300 text-red-800' : 
            notification.type === 'warning' ? 'bg-yellow-100 border border-yellow-300 text-yellow-800' :
            'bg-green-100 border border-green-300 text-green-800'
          }`}>
            <i className={`mr-2 fas ${
              notification.type === 'error' ? 'fa-exclamation-circle' : 
              notification.type === 'warning' ? 'fa-exclamation-triangle' :
              'fa-check-circle'
            }`}></i>
            <span>{notification.message}</span>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Display active attachment types */}
          {attachmentTypes.map((attachmentType, index) => {
            const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
            const files = dynamicFiles[key] || [];
            const inputRef = dynamicRefs[key];
            const password = dynamicPasswords[key] || '';
            
            // Find uploaded documents for this type
            const typeDocuments = uploadedDocuments.filter(doc => 
              doc.document_type === attachmentType.name
            );
            
            return (
              <div 
                key={attachmentType.id || attachmentType._id} 
                className="attachment-card" 
                data-category={attachmentType.name}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-md font-semibold text-gray-700">
                      {attachmentType.name}
                    </h2>
                    {attachmentType.description && (
                      <div className="relative">
                        <div 
                          className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center cursor-help"
                          onMouseEnter={() => handleTooltipEnter(attachmentType.id || attachmentType._id)}
                          onMouseLeave={() => handleTooltipLeave(attachmentType.id || attachmentType._id)}
                        >
                          <span className="text-white text-xs font-bold">i</span>
                        </div>
                        {showTooltip[attachmentType.id || attachmentType._id] && (
                          <div 
                            className="absolute z-[9999] p-4 text-sm text-white bg-gray-800 rounded-lg shadow-lg"
                            style={{
                              left: '50%',
                              bottom: '100%',
                              transform: 'translateX(-50%)',
                              marginBottom: '8px',
                              minWidth: '250px',
                              maxWidth: '400px',
                              width: 'auto',
                              minHeight: '40px',
                              maxHeight: 'none',
                              overflow: 'visible',
                              border: '1px solid rgba(255,255,255,0.2)',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                            }}
                            onMouseEnter={() => {
                              // Debug: Log the description content
                              console.log('📝 Tooltip Description Debug:', {
                                raw: attachmentType.description,
                                type: typeof attachmentType.description,
                                length: attachmentType.description?.length,
                                charCodes: attachmentType.description?.split('').map(char => char.charCodeAt(0))
                              });
                            }}
                          >
                            <div 
                              style={{ 
                                wordWrap: 'break-word',
                                lineHeight: '1.6', 
                                fontSize: '13px',
                                padding: '4px 0',
                                textAlign: 'left',
                                display: 'block',
                                maxWidth: '350px',
                                overflowWrap: 'break-word',
                                fontFamily: 'inherit'
                              }}
                            >
                              {attachmentType.description ? 
                                attachmentType.description
                                  .split(/\r\n|\r|\n|\\n/)
                                  .map((line, index, array) => (
                                    <React.Fragment key={index}>
                                      {line}
                                      {index < array.length - 1 && <br />}
                                    </React.Fragment>
                                  )) :
                                'No description available'
                              }
                            </div>
                            
                            <div 
                              className="absolute w-0 h-0"
                              style={{
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid #374151'
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {typeDocuments.length === 0 ? (
                  <div className="upload-box space-y-3">
                    <input 
                      type="password"
                      placeholder="Password (optional)"
                      className="password-input w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={password}
                      onChange={(e) => handlePasswordChange(key, e.target.value)}
                      disabled={isLoading}
                    />
                    <div className="relative">
                      <input 
                        type="file"
                        multiple
                        ref={inputRef}
                        onChange={handleFileChange(key)}
                        className="file-input block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        disabled={isLoading}
                      />
                      {isLoading && (
                        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-md">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                            <span className="text-sm text-blue-600">Uploading...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Files will be uploaded automatically when selected.</p>
                  </div>
                ) : (
                  <div className="summary-box flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                      </svg>
                      <div>
                        <h3 className="font-bold text-gray-800 file-count-text">
                          {typeDocuments.length} File{typeDocuments.length !== 1 ? 's' : ''} Uploaded
                        </h3>
                        <p className="text-sm text-gray-500">Ready to view or download.</p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-2 sm:mt-0">
                      <input 
                        type="file"
                        multiple
                        ref={inputRef}
                        onChange={handleFileChange(key)}
                        className="hidden"
                        disabled={isLoading}
                      />
                      <button 
                        className="view-manage-btn text-sm font-semibold text-blue-600 hover:text-blue-800"
                        onClick={() => openModal(attachmentType)}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Display historical attachment types with uploaded files */}
          {historicalAttachmentTypes
            .filter(type => !attachmentTypes.some(active => active.name === type.name))
            .map((attachmentType, index) => {
              const typeDocuments = uploadedDocuments.filter(doc => 
                doc.document_type === attachmentType.name
              );
              
              // Only show if there are uploaded documents
              if (typeDocuments.length === 0) return null;
              
              const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
              
              return (
                <div 
                  key={attachmentType.id || attachmentType._id} 
                  className="attachment-card" 
                  data-category={attachmentType.name}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-md font-semibold text-gray-700">
                        {attachmentType.name}
                      </h2>
                      <span className="ml-2 text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">
                        Archive
                      </span>
                      {attachmentType.description && (
                        <div className="relative">
                          <div 
                            className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center cursor-help"
                            onMouseEnter={() => handleTooltipEnter(attachmentType.id || attachmentType._id)}
                            onMouseLeave={() => handleTooltipLeave(attachmentType.id || attachmentType._id)}
                          >
                            <span className="text-white text-xs font-bold">i</span>
                          </div>
                          {showTooltip[attachmentType.id || attachmentType._id] && (
                            <div 
                              className="absolute z-[9999] p-4 text-sm text-white bg-gray-800 rounded-lg shadow-lg"
                              style={{
                                left: '50%',
                                bottom: '100%',
                                transform: 'translateX(-50%)',
                                marginBottom: '8px',
                                minWidth: '250px',
                                maxWidth: '400px',
                                width: 'auto',
                                minHeight: '40px',
                                maxHeight: 'none',
                                overflow: 'visible',
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                              }}
                            >
                              <div 
                                style={{ 
                                  wordWrap: 'break-word',
                                  lineHeight: '1.6', 
                                  fontSize: '13px',
                                  padding: '4px 0',
                                  textAlign: 'left',
                                  display: 'block',
                                  maxWidth: '350px',
                                  overflowWrap: 'break-word',
                                  fontFamily: 'inherit'
                                }}
                              >
                                {attachmentType.description ? 
                                  attachmentType.description
                                    .split(/\r\n|\r|\n|\\n/)
                                    .map((line, index, array) => (
                                      <React.Fragment key={index}>
                                        {line}
                                        {index < array.length - 1 && <br />}
                                      </React.Fragment>
                                    )) :
                                  'No description available'
                                }
                              </div>
                              <div 
                                className="absolute w-0 h-0"
                                style={{
                                  top: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  borderLeft: '6px solid transparent',
                                  borderRight: '6px solid transparent',
                                  borderTop: '6px solid #374151'
                                }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="summary-box flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                      </svg>
                      <div>
                        <h3 className="font-bold text-gray-800 file-count-text">
                          {typeDocuments.length} File{typeDocuments.length !== 1 ? 's' : ''} Uploaded
                        </h3>
                        <p className="text-sm text-gray-500">Ready to view or download.</p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-2 sm:mt-0">
                      <button 
                        className="view-manage-btn text-sm font-semibold text-blue-600 hover:text-blue-800"
                        onClick={() => openModal(attachmentType)}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
        </div>

        <div className="mt-8 pt-6 border-t flex items-center justify-end space-x-3">
          <button
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300"
            onClick={loadUploadedDocuments}
            disabled={isLoading}
          >
            Refresh Documents
          </button>
          <button
            id="downloadAllBtn"
            className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-300 flex items-center"
            onClick={handleDownloadAll}
            disabled={isDownloadingAll || uploadedDocuments.length === 0}
          >
            <span id="downloadAllText">
              {isDownloadingAll ? 'Creating ZIP...' : `Download All Files (${uploadedDocuments.length})`}
            </span>
            {isDownloadingAll && (
              <div id="downloadAllLoader" className="loader ml-2"></div>
            )}
          </button>
          <button
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300"
            onClick={handleSaveAll}
            disabled={isLoading || Object.values(dynamicFiles).every(files => files.length === 0)}
          >
            {isLoading ? 'Uploading...' : 'Upload All Files'}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-right mt-2">
          * Each attachment type has its own password field for secure uploads
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div id="attachmentsModal" className="modal-overlay fixed top-0 left-0 right-0 bottom-0 bg-[rgba(17,24,39,0.6)] backdrop-blur-sm z-40 flex items-center justify-center">
          <div 
            ref={modalRef}
            className={`bg-white rounded-xl shadow-2xl w-full max-w-3xl m-4 transform transition-all duration-300 ease-out ${
              showModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`} 
            id="modal-panel"
          >
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
                <h2 id="modalTitle" className="text-xl font-bold text-gray-800">
                  Manage: {currentModalCategory?.name}
                </h2>
              </div>
              <button 
                id="closeModalBtn" 
                className="p-1 rounded-full hover:bg-gray-200"
                onClick={closeModal}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div id="fileCardGrid" className="file-card-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {currentModalCategory && uploadedDocuments
                  .filter(doc => doc.document_type === currentModalCategory.name)
                  .map((doc, idx) => (
                    <div 
                      key={idx} 
                      className="file-card flex flex-col items-center p-3 text-center rounded-lg bg-white border"
                      data-id={doc._id}
                    >
                      <div className="relative">
                        {doc.file_name?.toLowerCase().endsWith('.pdf') || doc.filename?.toLowerCase().endsWith('.pdf') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                          </svg>
                        ) : doc.file_name?.match(/\.(jpg|jpeg|png|gif)$/i) || doc.filename?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                        
                        {doc.has_password && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500 items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                              </svg>
                            </span>
                          </span>
                        )}
                      </div>
                      
                      <p className="mt-2 text-sm font-semibold text-gray-800 break-all w-full">
                        {doc.filename || doc.file_name || `Document ${idx + 1}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                      </p>
                      
                      <div className="w-full border-t my-2"></div>
                      
                      <div className="flex items-center justify-center space-x-1 w-full">
                        <button 
                          className="view-btn flex items-center justify-center p-1.5 text-gray-500 hover:bg-gray-100 rounded-md tooltip"
                          onClick={() => window.open(`${BASE_URL}/leads/${leadId}/attachments/${doc._id}/view?user_id=${currentUserId}`, '_blank')}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                          <span className="tooltiptext">View</span>
                        </button>
                        
                        <button 
                          className="download-btn flex items-center justify-center p-1.5 text-gray-500 hover:bg-gray-100 rounded-md tooltip"
                          onClick={() => handleDownload(doc._id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                          </svg>
                          <span className="tooltiptext">Download</span>
                        </button>
                        
                        {doc.has_password && (
                          <button 
                            data-password={getDocumentPassword(doc)}
                            className="copy-password-btn flex items-center justify-center p-1.5 text-blue-600 hover:bg-blue-100 rounded-md tooltip"
                            onClick={() => {
                              const password = getDocumentPassword(doc);
                              if (password && !password.includes("not available")) {
                                navigator.clipboard.writeText(password);
                                showNotification("Password copied to clipboard!", "success");
                              } else {
                                showNotification("No password available to copy", "warning");
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-6 4h.01M9 16h.01"></path>
                            </svg>
                            <span className="tooltiptext">Copy Password</span>
                          </button>
                        )}
                        
                        <button 
                          className="delete-btn flex items-center justify-center p-1.5 text-red-500 hover:bg-red-100 rounded-md tooltip"
                          onClick={() => handleDelete(doc._id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                          <span className="tooltiptext">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                {currentModalCategory && uploadedDocuments.filter(doc => doc.document_type === currentModalCategory.name).length === 0 && (
                  <p className="text-gray-500 col-span-full text-center">No files uploaded for this category yet.</p>
                )}
              </div>
            </div>
            
            <div className="p-5 border-t bg-gray-50 rounded-b-xl">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload More Files</label>
              <p className="text-xs text-gray-500 mb-3">Select files and click "Add Files" to upload</p>
              {isLoading && (
                <div className="mb-3 text-center">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-blue-600">Uploading...</span>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {currentModalCategory && (
                  <>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input 
                        id="modalFileInput" 
                        type="file" 
                        multiple 
                        onChange={handleModalFileChange(currentModalCategory.name.toLowerCase().replace(/\s+/g, '_'))}
                        className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer flex-grow" 
                      />
                      <div className="flex items-center gap-2">
                        <input 
                          id="modalPasswordInput" 
                          type="password" 
                          placeholder="Password (optional)" 
                          value={dynamicPasswords[currentModalCategory.name.toLowerCase().replace(/\s+/g, '_')] || ''}
                          onChange={(e) => {
                            console.log('Password input change:', e.target.value);
                            handlePasswordChange(
                              currentModalCategory.name.toLowerCase().replace(/\s+/g, '_'), 
                              e.target.value
                            );
                          }}
                          onFocus={() => console.log('Password input focused')}
                          className="w-full sm:w-auto px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                          disabled={false}
                          readOnly={false}
                        />
                        {dynamicPasswords[currentModalCategory.name.toLowerCase().replace(/\s+/g, '_')] && (
                          <button
                            type="button"
                            onClick={() => handlePasswordChange(currentModalCategory.name.toLowerCase().replace(/\s+/g, '_'), '')}
                            className="px-2 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Clear password"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={handleModalUpload}
                        disabled={isLoading || !dynamicFiles[currentModalCategory.name.toLowerCase().replace(/\s+/g, '_')]?.length}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                      >
                        {isLoading ? 'Uploading...' : 'Add Files'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden copy helper textarea */}
      <textarea id="copy-helper" style={{ position: "absolute", left: "-9999px" }}></textarea>
    </div>
  );
}
