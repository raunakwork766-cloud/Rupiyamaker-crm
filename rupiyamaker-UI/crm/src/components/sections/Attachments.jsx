import React, { useRef, useState, useEffect } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { Search, Info } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './attachments.css';
import { getISTDateYMD } from '../../utils/dateUtils';

// Document categories from premium_document_upload.html reference
const DOCUMENT_CATEGORIES = [
  {
    id: 'kyc',
    title: 'PERSONAL IDENTIFICATION (KYC)',
    keywords: ['cibil', 'pan', 'aadhaar', 'aadhar', 'voter', 'driving licen', 'passport', 'kyc', 'id proof', 'identity'],
  },
  {
    id: 'employment',
    title: 'EMPLOYMENT PROOFS',
    keywords: ['salary slip', 'offer letter', 'employment', 'form 16', 'appointment letter', 'experience letter', 'increment'],
  },
  {
    id: 'financial',
    title: 'FINANCIAL STATEMENTS',
    keywords: ['bank statement', 'itr', 'income tax', 'financial', 'account statement'],
  },
];

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

  // Profile switcher (applicant vs co-applicant)
  const [currentProfile, setCurrentProfile] = useState('applicant');

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
  const [editingFileId, setEditingFileId] = useState(null); // ID of file being renamed
  const [editingFileName, setEditingFileName] = useState(''); // edit value (base name only)
  const [viewerDoc, setViewerDoc] = useState(null); // { blobUrl, downloadUrl, name, isPdf, isImage, loading, error }

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
      const generatedDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const generatedTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      
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
      const generatedDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const generatedTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      
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
      
      // Block duplicate filenames for this attachment type
      const existingNames = uploadedDocuments
        .filter(d => d.document_type === attachmentType.name)
        .map(d => (d.filename || d.file_name || '').toLowerCase().trim());
      const duplicates = files.filter(f => existingNames.includes(f.name.toLowerCase().trim()));
      if (duplicates.length > 0) {
        showNotification(
          `Duplicate file(s) detected: ${duplicates.map(f => f.name).join(', ')}. Upload blocked.`,
          'error'
        );
        e.target.value = '';
        return;
      }

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
      formData.append('owner_type', currentProfile); // applicant or coapplicant
      
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
            const applicantFilename = `${(currentLeadData.first_name || 'Customer')}_Applicant_Form_${getISTDateYMD()}.pdf`;
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
            const coApplicantFilename = `${(currentLeadData.first_name || 'Customer')}_Co-Applicant_Form_${getISTDateYMD()}.pdf`;
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
        passwordText += `Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;
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
        const zipFilename = `Lead_${leadId}_Documents_${getISTDateYMD()}.zip`;
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

  // ── helpers ──────────────────────────────────────────────────
  const getProfileDocs = (docs) => docs.filter(doc => {
    if (currentProfile === 'applicant') return !doc.owner_type || doc.owner_type === 'applicant';
    return doc.owner_type === 'coapplicant';
  });

  // Rename a file: sends new filename (base + ext) to backend, updates local state
  const handleRenameFile = async (docId, newBase, ext) => {
    const trimmed = newBase.trim();
    if (!trimmed) { setEditingFileId(null); setEditingFileName(''); return; }
    const newFilename = trimmed + ext;
    try {
      const res = await fetch(
        `${BASE_URL}/leads/${leadId}/documents/${docId}?user_id=${currentUserId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: newFilename }),
        }
      );
      if (!res.ok) throw new Error('Server returned ' + res.status);
      setUploadedDocuments(prev =>
        prev.map(d => d._id === docId ? { ...d, filename: newFilename } : d)
      );
      showNotification('File renamed successfully', 'success');
    } catch (err) {
      showNotification('Rename failed: ' + err.message, 'error');
    } finally {
      setEditingFileId(null);
      setEditingFileName('');
    }
  };

  const getFileIconClass = (filename) => {
    const name = (filename || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'fa-file-pdf text-blue-500';
    if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'fa-file-image text-green-500';
    if (name.match(/\.(doc|docx)$/)) return 'fa-file-word text-blue-600';
    if (name.match(/\.(xls|xlsx|csv)$/)) return 'fa-file-excel text-emerald-600';
    return 'fa-file text-gray-400';
  };

  // ── drag-to-reorder state ─────────────────────────────────────
  // We use refs so we don't re-render during drag; only re-render on drop.
  const dragFile = React.useRef(null);          // { docType, fromIdx }
  const [dragOverKey, setDragOverKey] = React.useState(null); // `${docType}_${idx}`

  const handleFileDragStart = (e, docType, fromIdx) => {
    dragFile.current = { docType, fromIdx };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fromIdx); // needed for Firefox
    // slight delay so the element doesn't disappear before the ghost is captured
    setTimeout(() => {
      if (e.target) e.target.style.opacity = '0.45';
    }, 0);
  };

  const handleFileDragOver = (e, docType, toIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    const key = `${docType}_${toIdx}_${half}`;
    if (dragOverKey !== key) setDragOverKey(key);
  };

  const handleFileDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    // Delay null so drop fires first (Firefox fires dragend before drop)
    setTimeout(() => { dragFile.current = null; }, 50);
    setDragOverKey(null);
  };

  const handleFileDrop = (e, docType, toIdx) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragFile.current) return;
    const { docType: fromDocType, fromIdx } = dragFile.current;
    dragFile.current = null;
    if (fromDocType !== docType) return;

    // Determine top/bottom half at drop time for precision
    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;

    // Reorder uploadedDocuments in state
    setUploadedDocuments(prev => {
      const typeDocs = prev.filter(d => d.document_type === docType && getProfileDocs([d]).length > 0);
      const otherDocs = prev.filter(d => !(d.document_type === docType && getProfileDocs([d]).length > 0));
      const moved = [...typeDocs];
      const item = moved.splice(fromIdx, 1)[0];
      // After splice, adjust target index for the removal shift, then insert before/after
      let insertAt;
      if (isTopHalf) {
        // insert before toIdx
        insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
      } else {
        // insert after toIdx
        insertAt = fromIdx < toIdx ? toIdx : toIdx + 1;
      }
      insertAt = Math.max(0, Math.min(moved.length, insertAt));
      // Skip if result is identical position
      if (moved[insertAt] && moved[insertAt]._id === item._id) {
        return prev;
      }
      moved.splice(insertAt, 0, item);
      return [...otherDocs, ...moved];
    });
  };

  // Prevent browser navigation when OS file is accidentally dropped outside zones
  React.useEffect(() => {
    const stop = e => e.preventDefault();
    window.addEventListener('dragover', stop, false);
    window.addEventListener('drop', stop, false);
    return () => {
      window.removeEventListener('dragover', stop, false);
      window.removeEventListener('drop', stop, false);
    };
  }, []);

  // ── loading / error guards ────────────────────────────────────
  if (loadingTypes) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm font-medium">Loading attachments...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUserId || currentUserId === 'default_user') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-center py-10 text-red-500 text-sm font-medium">
          Error: User ID not found. Please log in again.
        </div>
      </div>
    );
  }

  // active types + historical types that have uploaded files
  const allDisplayTypes = [
    ...attachmentTypes.map(t => ({ ...t, isHistorical: false })),
    ...historicalAttachmentTypes
      .filter(t => !attachmentTypes.some(a => a.name === t.name))
      .filter(t => getProfileDocs(uploadedDocuments.filter(d => d.document_type === t.name)).length > 0)
      .map(t => ({ ...t, isHistorical: true }))
  ];

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 w-full">

      {/* Notification Banner */}
      {notification && (
        <div className={`mb-3 px-3 py-2 rounded flex items-center gap-2 text-xs font-medium ${
          notification.type === 'error'   ? 'bg-red-50 border border-red-200 text-red-700' :
          notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
                                            'bg-green-50 border border-green-200 text-green-700'
        }`}>
          <i className={`fa-solid ${
            notification.type === 'error'   ? 'fa-circle-xmark' :
            notification.type === 'warning' ? 'fa-triangle-exclamation' :
                                              'fa-circle-check'
          }`}></i>
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-auto opacity-60 hover:opacity-100 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ── Header: DL ALL (left) + Switcher (right) ── */}
      <div className="mb-2 border-b border-gray-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadAll}
            disabled={isDownloadingAll || getProfileDocs(uploadedDocuments).length === 0}
            className="bg-gray-900 border border-gray-900 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-black transition flex items-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDownloadingAll
              ? <><i className="fa-solid fa-spinner fa-spin mr-1 text-xs"></i> Zipping…</>
              : <><i className="fa-solid fa-download mr-1 text-xs"></i> DOWNLOAD ALL ({getProfileDocs(uploadedDocuments).length})</>
            }
          </button>
        </div>

        {/* Applicant / Co-Applicant Switcher */}
        <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-lg self-start sm:self-auto border border-gray-200 shadow-inner">
          {['applicant', 'coapplicant'].map(prof => (
            <button
              key={prof}
              onClick={() => setCurrentProfile(prof)}
              className={`px-4 py-1 rounded-md text-[11px] tracking-wide transition-all ${
                currentProfile === prof
                  ? 'font-black bg-white text-[#2563eb] shadow-sm border border-gray-200'
                  : 'font-bold text-gray-500 hover:text-gray-800 border border-transparent hover:bg-gray-200/50'
              }`}
            >
              {prof === 'applicant' ? 'APPLICANT' : 'CO-APPLICANT'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Document rows ── */}
      <div className="space-y-3" id="categories-container">
        {allDisplayTypes.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
            No documents active in this section. Go to Settings → Others → Attachment Types to add them.
          </div>
        )}

        {(() => {
          let globalFileIndex = 1;

          // Group by DOCUMENT_CATEGORIES (from premium_document_upload.html)
          const grouped = DOCUMENT_CATEGORIES.map(cat => ({
            ...cat,
            types: allDisplayTypes.filter(t =>
              cat.keywords.some(kw => t.name.toLowerCase().includes(kw))
            ),
          })).filter(cat => cat.types.length > 0);
          const matchedNames = new Set(grouped.flatMap(g => g.types.map(t => t.name)));
          const otherTypes = allDisplayTypes.filter(t => !matchedNames.has(t.name));
          if (otherTypes.length > 0) grouped.push({ id: 'other', title: 'OTHER DOCUMENTS', types: otherTypes });

          return grouped.map((cat, catIdx) => (
            <div key={cat.id} className="mb-3 last:mb-0">
              <div className="border-b-2 border-gray-800 pb-1 mb-3 flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{catIdx + 1}. {cat.title}</h3>
              </div>
              <div className="space-y-2.5">
                {cat.types.map((attachmentType) => {
            const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
            const inputRef = dynamicRefs[key];
            const password = dynamicPasswords[key] || '';
            const typeDocuments = getProfileDocs(
              uploadedDocuments.filter(doc => doc.document_type === attachmentType.name)
            );
            // Snapshot the starting global index for this doc type, then advance by count
            const typeStartGlobal = globalFileIndex;
            globalFileIndex += typeDocuments.length;

            return (
              <div
                key={attachmentType.id || attachmentType._id}
                className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col md:flex-row gap-2.5 items-start md:items-stretch shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors hover:border-gray-300 relative group/docrow hover:shadow-sm"
              >
                {/* ── LEFT: doc label ── */}
                <div className="w-full md:w-1/4 lg:w-1/5 shrink-0 flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-sm shrink-0">
                    <i className="fa-solid fa-file-invoice"></i>
                  </div>
                  <div className="pt-0.5 flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-xs leading-tight pr-1 tracking-tight">
                      {attachmentType.name.toUpperCase()}
                    </h4>
                    {attachmentType.isHistorical && (
                      <span className="inline-block mt-1 px-1 py-0.5 bg-yellow-100 text-yellow-800 text-[8px] font-bold rounded">ARCHIVE</span>
                    )}
                    {attachmentType.description && (
                      <div className="relative mt-1">
                        <div
                          className="w-4 h-4 bg-[#2563eb] rounded-full flex items-center justify-center cursor-help"
                          onMouseEnter={() => handleTooltipEnter(attachmentType.id || attachmentType._id)}
                          onMouseLeave={() => handleTooltipLeave(attachmentType.id || attachmentType._id)}
                        >
                          <span className="text-white text-[9px] font-bold leading-none">i</span>
                        </div>
                        {showTooltip[attachmentType.id || attachmentType._id] && (
                          <div
                            className="absolute z-[9999] p-3 text-xs text-white bg-gray-800 rounded-lg shadow-2xl"
                            style={{ left: '50%', bottom: '100%', transform: 'translateX(-50%)', marginBottom: 8, minWidth: 220, maxWidth: 360, border: '1px solid rgba(255,255,255,0.15)' }}
                          >
                            {attachmentType.description.split(/\r?\n/).map((line, i, arr) => (
                              <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
                            ))}
                            <div className="absolute w-0 h-0" style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1f2937' }}></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── MIDDLE: draggable file list ── */}
                <div className="flex-1 w-full bg-slate-50 border border-gray-100 rounded p-1.5 flex flex-col gap-1.5 min-h-[50px]">
                  {typeDocuments.length > 0 ? (
                    <div className="space-y-1 w-full">
                      {typeDocuments.map((doc, fileIdx) => {
                        const displayNum = typeStartGlobal + fileIdx; // global file number
                        const fname = (doc.filename || doc.file_name || `Document ${displayNum}`).toUpperCase();
                        const isLocked = doc.has_password;
                        const overKeyTop = `${attachmentType.name}_${fileIdx}_top`;
                        const overKeyBottom = `${attachmentType.name}_${fileIdx}_bottom`;
                        const isDraggedOverTop = dragOverKey === overKeyTop;
                        const isDraggedOverBottom = dragOverKey === overKeyBottom;
                        const isDraggedOver = isDraggedOverTop || isDraggedOverBottom;

                        return (
                          <div
                            key={doc._id}
                            draggable
                            onDragStart={e => handleFileDragStart(e, attachmentType.name, fileIdx)}
                            onDragOver={e => handleFileDragOver(e, attachmentType.name, fileIdx)}
                            onDragEnd={handleFileDragEnd}
                            onDrop={e => handleFileDrop(e, attachmentType.name, fileIdx)}
                            className={`cursor-grab active:cursor-grabbing bg-white border rounded p-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition group/filerow
                              ${isLocked ? 'border-red-200' : 'border-gray-200'}
                              ${isDraggedOverTop ? '!border-t-2 !border-t-[#2563eb]' : isDraggedOverBottom ? '!border-b-2 !border-b-[#2563eb]' : 'hover:border-blue-300'}`}
                          >
                            {/* file info */}
                            <div className="flex items-start gap-1.5 min-w-0 pr-2 flex-1 w-full">
                              <div className="text-[9px] font-black w-4 h-4 bg-gray-100 text-gray-500 rounded flex items-center justify-center shrink-0 mt-0.5 group-hover/filerow:bg-blue-100 group-hover/filerow:text-[#2563eb] transition-colors select-none">
                                {displayNum}
                              </div>
                              <i className="fa-solid fa-grip-vertical text-gray-300 mt-0.5 mr-0.5 text-[10px] shrink-0 cursor-grab select-none"></i>
                              <i className={`fa-solid ${isLocked ? 'fa-file-shield text-red-500' : getFileIconClass(fname)} text-base shrink-0 mt-0.5 select-none`}></i>
                              <div className="flex-1 w-full min-w-0">
                                {editingFileId === doc._id ? (() => {
                                  const origName = doc.filename || doc.file_name || '';
                                  const lastDot = origName.lastIndexOf('.');
                                  const ext = lastDot >= 0 ? origName.substring(lastDot) : '';
                                  return (
                                    <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                      <input
                                        autoFocus
                                        value={editingFileName}
                                        onChange={e => setEditingFileName(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') { e.preventDefault(); handleRenameFile(doc._id, editingFileName, ext); }
                                          else if (e.key === 'Escape') { setEditingFileId(null); setEditingFileName(''); }
                                        }}
                                        onBlur={() => handleRenameFile(doc._id, editingFileName, ext)}
                                        className="text-[11px] font-bold text-gray-800 bg-blue-50 border border-blue-400 rounded px-1 py-0.5 outline-none flex-1 min-w-0"
                                      />
                                      {ext && <span className="text-[11px] text-gray-500 shrink-0">{ext.toUpperCase()}</span>}
                                    </div>
                                  );
                                })() : (
                                  <span
                                    className="text-[12px] font-bold text-gray-800 break-all w-full line-clamp-2 leading-tight cursor-text select-none"
                                    title={`${fname} — double-click to rename`}
                                    onDoubleClick={e => {
                                      e.stopPropagation();
                                      const origName = doc.filename || doc.file_name || '';
                                      const lastDot = origName.lastIndexOf('.');
                                      const base = lastDot >= 0 ? origName.substring(0, lastDot) : origName;
                                      setEditingFileId(doc._id);
                                      setEditingFileName(base);
                                    }}
                                  >
                                    {fname}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* action buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto relative z-10">
                              {isLocked && (
                                <>
                                  <input
                                    type="password"
                                    id={`pw_${doc._id}`}
                                    placeholder="Password"
                                    className="text-[9px] border border-red-200 px-1 py-0.5 rounded w-20 outline-none focus:border-red-400 text-gray-700 bg-white"
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={() => {
                                      const pw = document.getElementById(`pw_${doc._id}`)?.value || getDocumentPassword(doc);
                                      if (pw && !String(pw).includes('not available')) {
                                        navigator.clipboard.writeText(pw);
                                        showNotification('Password copied!', 'success');
                                      } else {
                                        showNotification('Enter the password or it is not stored', 'warning');
                                      }
                                    }}
                                    className="bg-gray-800 hover:bg-black text-white text-[9px] font-bold px-2.5 py-1 rounded whitespace-nowrap"
                                  >
                                    DECRYPT
                                  </button>
                                </>
                              )}
                              <button
                                onClick={async () => {
                                  const fname2 = (doc.filename || doc.file_name || '').toLowerCase();
                                  const ext2 = fname2.split('.').pop();
                                  const isPdf = ext2 === 'pdf';
                                  const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext2);
                                  const downloadUrl = `${BASE_URL}/leads/${leadId}/attachments/${doc._id}/download?user_id=${currentUserId}`;
                                  const docName = doc.filename || doc.file_name || 'Document';
                                  // Show loading state immediately
                                  setViewerDoc({ blobUrl: null, downloadUrl, name: docName, isPdf, isImage, loading: true, error: null });
                                  try {
                                    const res = await fetch(
                                      `${BASE_URL}/leads/${leadId}/attachments/${doc._id}/view?user_id=${currentUserId}`,
                                      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                                    );
                                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                    const blob = await res.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    setViewerDoc({ blobUrl, downloadUrl, name: docName, isPdf, isImage, loading: false, error: null });
                                  } catch (err) {
                                    setViewerDoc(prev => prev ? { ...prev, loading: false, error: err.message } : null);
                                  }
                                }}
                                className="bg-gray-50 border border-gray-200 rounded p-1 text-gray-500 hover:text-[#2563eb] hover:bg-white transition shadow-sm"
                                title="View"
                              >
                                <i className="fa-solid fa-eye text-[10px]"></i>
                              </button>
                              <button
                                onClick={() => handleDownload(doc._id)}
                                className="bg-gray-50 border border-gray-200 rounded p-1 text-gray-500 hover:text-green-600 hover:bg-white transition shadow-sm"
                                title="Download"
                              >
                                <i className="fa-solid fa-download text-[10px]"></i>
                              </button>
                              <div className="w-px h-4 bg-gray-200 mx-0.5 hidden sm:block"></div>
                              <button
                                onClick={() => handleDelete(doc._id)}
                                className="bg-red-50 border border-red-100 rounded p-1 text-gray-500 hover:text-red-500 hover:bg-red-100 transition shadow-sm"
                                title="Delete"
                              >
                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 font-medium italic py-2 flex items-center justify-center h-full w-full border border-dashed border-gray-300 rounded bg-gray-50/50">No files attached yet. Click "Attach Files".</div>
                  )}
                </div>

                {/* ── RIGHT: upload + password ── */}
                <div className="w-full md:w-32 shrink-0 flex flex-col gap-1.5 items-end justify-center">
                  <div className="relative w-full">
                    <input
                      type="file"
                      multiple
                      ref={inputRef}
                      onChange={handleFileChange(key)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                      disabled={isLoading}
                      title=""
                    />
                    <button className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold py-2 px-2 rounded shadow-sm text-[11px] flex items-center justify-center gap-1.5 transition uppercase pointer-events-none whitespace-nowrap">
                      {isLoading
                        ? <><i className="fa-solid fa-spinner fa-spin"></i> Uploading…</>
                        : <><i className="fa-solid fa-cloud-arrow-up"></i> Attach Files</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
              </div>
            </div>
          ));
        })()}
      </div>

      <textarea id="copy-helper" style={{ position: 'absolute', left: '-9999px' }} readOnly></textarea>

      {/* ── Inline File Viewer Modal ── */}
      {viewerDoc && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col bg-black/85"
          onClick={() => { if (viewerDoc.blobUrl) URL.revokeObjectURL(viewerDoc.blobUrl); setViewerDoc(null); }}
        >
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white text-sm font-bold truncate max-w-[55vw]" title={viewerDoc.name}>
              <i className="fa-solid fa-file mr-2 text-blue-400"></i>{viewerDoc.name}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={viewerDoc.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5"
                onClick={e => e.stopPropagation()}
              >
                <i className="fa-solid fa-download"></i> Download
              </a>
              <button
                onClick={() => { if (viewerDoc.blobUrl) URL.revokeObjectURL(viewerDoc.blobUrl); setViewerDoc(null); }}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-xmark"></i> Close
              </button>
            </div>
          </div>

          {/* Viewer area */}
          <div className="flex-1 overflow-hidden flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {viewerDoc.loading ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-gray-300">Loading file...</span>
              </div>
            ) : viewerDoc.error ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <i className="fa-solid fa-triangle-exclamation text-5xl text-yellow-400"></i>
                <p className="text-sm text-gray-300">Failed to load file: {viewerDoc.error}</p>
                <a href={viewerDoc.downloadUrl} target="_blank" rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded transition flex items-center gap-2">
                  <i className="fa-solid fa-download"></i> Download Instead
                </a>
              </div>
            ) : (viewerDoc.isPdf || viewerDoc.isImage) ? (
              <iframe
                src={viewerDoc.blobUrl}
                title={viewerDoc.name}
                className="w-full h-full border-0 bg-white"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white gap-5">
                <i className="fa-solid fa-file-lines text-6xl text-gray-400"></i>
                <p className="text-base font-medium text-gray-300">Preview not available for this file type.</p>
                <a
                  href={viewerDoc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-download"></i> Download to View
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

