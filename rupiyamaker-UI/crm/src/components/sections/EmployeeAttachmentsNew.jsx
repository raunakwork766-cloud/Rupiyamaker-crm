import React, { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Search, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './attachments.css';

const EmployeeAttachmentsNew = ({ employee }) => {
  const BASE_URL = '/api';
  
  // State for notifications
  const [notification, setNotification] = useState(null);
  
  // Modal state - moved to the top level
  const [showModal, setShowModal] = useState(false);
  const [currentModalCategory, setCurrentModalCategory] = useState(null);
  
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
  const [showTooltip, setShowTooltip] = useState({}); // State to manage tooltip visibility

  const modalRef = useRef(null);

  // Get userId from multiple possible sources
  const getUserId = () => {
    // Try different sources for userId
    const localUserId = localStorage.getItem('user_id') || localStorage.getItem('userId');
    if (localUserId) return localUserId;
    
    // Default fallback
    console.warn('No userId found, using default');
    return '66b5b5e8e2b49b00122f1db5';
  };

  const currentUserId = getUserId();

  // Debug logging
  useEffect(() => {
    console.log('Employee Attachments Component Debug:', {
      props: { employee },
      localStorage: {
        userId: localStorage.getItem('userId'),
        user_id: localStorage.getItem('user_id')
      },
      currentUserId
    });
  }, [employee]);

  // Tooltip handlers
  const handleTooltipEnter = (attachmentTypeId) => {
    setShowTooltip(prev => ({ ...prev, [attachmentTypeId]: true }));
  };

  const handleTooltipLeave = (attachmentTypeId) => {
    setShowTooltip(prev => ({ ...prev, [attachmentTypeId]: false }));
  };

  // Modal functions - exact same as lead attachments
  const openModal = (attachmentType) => {
    console.log('Opening modal for attachment type:', attachmentType);
    setCurrentModalCategory(attachmentType);
    setShowModal(true);
    console.log('Modal state set to true');
  };

  const closeModal = () => {
    console.log('Closing modal');
    setShowModal(false);
    setTimeout(() => {
      setCurrentModalCategory(null);
    }, 300);
  };

  // Show notification function - exact same as lead attachments
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Get document password function - adapted for employee attachments
  const getDocumentPassword = (doc) => {
    if (!doc || (!doc.has_password && !doc.is_password_protected)) return "";
    
    if (doc.password && doc.password.trim()) {
      return doc.password;
    }
    
    // Try different possible field names for document type
    const documentType = doc.document_type || doc.attachment_type || doc.category;
    if (documentType) {
      const key = documentType.toLowerCase().replace(/\s+/g, '_');
      const storedPassword = dynamicPasswords[key];
      if (storedPassword && storedPassword.trim()) {
        return storedPassword;
      }
    }
    
    return "Password not available";
  };

  // Load attachment types for employees from API
  const loadAttachmentTypes = async () => {
    try {
      setLoadingTypes(true);
      
      // Fetch active attachment types
      const activeResponse = await fetch(`${BASE_URL}/settings/attachment-types?user_id=${currentUserId}&target_type=employees`);
      
      // Fetch all attachment types including historical/deleted ones
      const allTypesResponse = await fetch(`${BASE_URL}/settings/all-attachment-types?user_id=${currentUserId}&target_type=employees`);
      
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
      showNotification('Error loading attachment types', 'error');
    } finally {
      setLoadingTypes(false);
    }
  };

  // Load existing documents for the employee
  const loadUploadedDocuments = async () => {
    if (!employee?._id) return;
    
    try {
      const response = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments?user_id=${currentUserId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const documents = await response.json();
        setUploadedDocuments(documents);
        
        // Initialize document passwords
        const initialPasswords = {};
        documents.forEach(doc => {
          if (doc.has_password || doc.is_password_protected) {
            const documentType = doc.document_type || doc.attachment_type || doc.category;
            if (documentType) {
              const typeKey = documentType.toLowerCase().replace(/\s+/g, '_');
              // First try to use the password from the document itself
              if (doc.password) {
                initialPasswords[doc._id] = doc.password;
              } 
              // Otherwise fall back to the attachment type password field
              else {
                initialPasswords[doc._id] = dynamicPasswords[typeKey] || '';
              }
            }
          }
        });
        
        // Update document passwords without overwriting existing ones
        setDocumentPasswords(prev => ({
          ...prev,
          ...initialPasswords
        }));
        
        // Initialize states for document types that exist in uploaded files but not in attachment types
        const existingDocumentTypes = new Set(
          documents.map(doc => doc.document_type || doc.attachment_type || doc.category).filter(Boolean)
        );
        
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

  useEffect(() => {
    loadAttachmentTypes();
  }, []);

  useEffect(() => {
    if (employee?._id) {
      loadUploadedDocuments();
    }
  }, [employee]);

  // Handle file change - auto upload when files are selected
  const handleFileChange = (attachmentKey) => async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    setDynamicFiles(prev => ({
      ...prev,
      [attachmentKey]: files
    }));

    // Find the attachment type for this key
    const attachmentType = [...attachmentTypes, ...historicalAttachmentTypes].find(type => 
      type.name.toLowerCase().replace(/\s+/g, '_') === attachmentKey
    );
    
    if (attachmentType) {
      // Auto-upload the files
      await handleUpload(attachmentType, files);
    }
  };

  // Handle modal file change - exact same as lead attachments
  const handleModalFileChange = (attachmentKey) => (e) => {
    console.log('handleModalFileChange called with key:', attachmentKey);
    const files = Array.from(e.target.files);
    
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log('Files selected for modal:', files.length, files.map(f => f.name));
    
    setDynamicFiles(prev => ({
      ...prev,
      [attachmentKey]: files
    }));
    
    showNotification(`${files.length} file(s) selected. Click "Add Files" to upload.`, 'info');
  };

  // Handle modal upload - exact same as lead attachments
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

  // Handle password change - exact same as lead attachments
  const handlePasswordChange = (attachmentKey, value) => {
    setDynamicPasswords(prev => ({
      ...prev,
      [attachmentKey]: value
    }));
  };

  // Handle upload - exact same as lead attachments
  const handleUpload = async (attachmentType, files = null) => {
    if (!employee?._id) {
      showNotification('No employee ID provided', 'error');
      return;
    }

    const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
    const filesToUpload = files || dynamicFiles[key] || [];
    
    if (filesToUpload.length === 0) {
      showNotification('No files selected for upload', 'error');
      return;
    }

    try {
      setIsLoading(true);
      
      // Process files one by one (HRMS API expects single file uploads)
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Use attachment type ID (not name!)
        const attachmentTypeId = attachmentType.id || attachmentType._id;
        if (!attachmentTypeId) {
          throw new Error('Attachment type ID is missing');
        }
        formData.append('attachment_type', attachmentTypeId);
        formData.append('description', '');

        // Add password if provided
        const password = dynamicPasswords[key];
        if (password && password.trim()) {
          formData.append('is_password_protected', 'true');
          formData.append('password', password);
        } else {
          formData.append('is_password_protected', 'false');
        }

        // Debug: Log all FormData entries
        console.log('📋 FormData contents:');
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}:`, value);
        }

        console.log('📤 Uploading file:', {
          employeeId: employee._id,
          currentUserId: currentUserId,
          fileName: file.name,
          fileSize: file.size,
          attachmentTypeName: attachmentType.name,
          attachmentTypeId: attachmentTypeId,
          isPasswordProtected: password && password.trim() ? true : false,
          endpoint: `${BASE_URL}/hrms/employees/${employee._id}/attachments?user_id=${currentUserId}`
        });

        const response = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments?user_id=${currentUserId}`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            console.error('Server error response:', errorData);
          } catch (e) {
            console.error('Could not parse error response as JSON');
          }
          throw new Error(`Failed to upload ${file.name}: ${errorMessage}`);
        }

        return await response.json();
      });

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);

      console.log('✅ All uploads successful:', results);
      
      const fileCount = filesToUpload.length;
      showNotification(
        `${fileCount} file${fileCount > 1 ? 's' : ''} uploaded successfully for ${attachmentType.name}!`, 
        'success'
      );

      // Clear files and password after successful upload
      setDynamicFiles(prev => ({
        ...prev,
        [key]: []
      }));
      setDynamicPasswords(prev => ({
        ...prev,
        [key]: ''
      }));

      // Clear file input
      const inputRef = dynamicRefs[key];
      if (inputRef && inputRef.current) {
        inputRef.current.value = '';
      }

      // Clear modal file input if exists
      const modalFileInput = document.getElementById('modalFileInput');
      if (modalFileInput) {
        modalFileInput.value = '';
      }

      // Reload documents
      await loadUploadedDocuments();
    } catch (error) {
      console.error('❌ Upload error:', error);
      showNotification('Upload error: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle download - exact same as lead attachments
  const handleDownload = (docId) => {
    window.open(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${docId}/download?user_id=${currentUserId}`, '_blank');
  };

  // Handle delete - exact same as lead attachments
  const handleDelete = async (docId) => {
    const doc = uploadedDocuments.find(d => d._id === docId);
    if (!doc) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${doc.original_file_name || doc.filename || doc.file_name || 'this document'}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      
      const response = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${docId}?user_id=${currentUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });      if (response.ok) {
        showNotification(`Document "${doc.original_file_name || doc.filename || doc.file_name}" deleted successfully!`, 'success');
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

  // Handle download all files as ZIP
  const handleDownloadAll = async () => {
    if (uploadedDocuments.length === 0) {
      showNotification('No documents to download', 'warning');
      return;
    }

    try {
      setIsDownloadingAll(true);
      showNotification('Creating ZIP file...', 'info');
      
      const zip = new JSZip();
      const downloadPromises = [];

      // Create download promises for all documents
      uploadedDocuments.forEach(doc => {
        const downloadPromise = fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${doc._id}/download?user_id=${currentUserId}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to download ${doc.filename || doc.file_name}`);
            }
            return response.blob();
          })
          .then(blob => {
            const filename = doc.original_file_name || doc.filename || doc.file_name || `document_${doc._id}`;
            zip.file(filename, blob);
          })
          .catch(error => {
            const errorFilename = doc.original_file_name || doc.filename || doc.file_name || `document_${doc._id}`;
            console.error(`Error downloading ${errorFilename}:`, error);
            // Add a text file with error info instead
            zip.file(`ERROR_${errorFilename}.txt`, `Failed to download: ${error.message}`);
          });
        
        downloadPromises.push(downloadPromise);
      });

      // Wait for all downloads to complete
      await Promise.all(downloadPromises);

      // Generate and download the ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const employeeName = employee?.first_name || employee?.name || employee?._id || 'Employee';
      const filename = `${employeeName}_Attachments_${new Date().toISOString().split('T')[0]}.zip`;
      
      saveAs(content, filename);
      showNotification(`Downloaded ${uploadedDocuments.length} files as ${filename}`, 'success');

    } catch (error) {
      console.error('Error creating ZIP:', error);
      showNotification('Error creating ZIP file: ' + error.message, 'error');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Render file names - exact same as lead attachments
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
            </div>
          );
        })}
      </div>
    );
  };

  if (loadingTypes) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6" style={{borderColor: "#3b82f640"}}>Employee Attachments</h1>
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

  if (!currentUserId || currentUserId === 'default_user') {
    return (
      <div className="max-w-9xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6" style={{borderColor: "#3b82f640"}}>Employee Attachments</h1>
          <div className="flex items-center justify-center p-8">
            <div className="text-lg text-red-600 text-center">
              Error: User ID not found. Please log in again.
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
              // Check by attachment type ID (what we send when uploading)
              (doc.attachment_type === (attachmentType.id || attachmentType._id)) ||
              // Check by attachment type name (from backend enhancement)
              (doc.attachment_type_name === attachmentType.name) ||
              // Legacy fallbacks
              (doc.document_type === attachmentType.name) ||
              (doc.category === attachmentType.name)
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
                              console.log('📝 Employee Tooltip Description Debug:', {
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
                          <div className="loader"></div>
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
                      <button 
                        className="view-manage-btn text-sm font-semibold text-blue-600 hover:text-blue-800"
                        onClick={(e) => {
                          console.log('Manage button clicked for:', attachmentType.name);
                          e.preventDefault();
                          openModal(attachmentType);
                        }}
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
                // Check by attachment type ID (what we send when uploading)
                (doc.attachment_type === (attachmentType.id || attachmentType._id)) ||
                // Check by attachment type name (from backend enhancement)
                (doc.attachment_type_name === attachmentType.name) ||
                // Legacy fallbacks
                (doc.document_type === attachmentType.name) ||
                (doc.category === attachmentType.name)
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
        </div>
        <p className="text-xs text-gray-500 text-right mt-2">
          * Each attachment type has its own password field for secure uploads
        </p>
      </div>

      {/* Modal - exact same as lead attachments */}
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
                  .filter(doc => 
                    // Check by attachment type ID (what we send when uploading)
                    (doc.attachment_type === (currentModalCategory.id || currentModalCategory._id)) ||
                    // Check by attachment type name (from backend enhancement)
                    (doc.attachment_type_name === currentModalCategory.name) ||
                    // Legacy fallbacks
                    (doc.document_type === currentModalCategory.name) ||
                    (doc.category === currentModalCategory.name)
                  )
                  .map((doc, idx) => (
                    <div 
                      key={idx} 
                      className="file-card flex flex-col items-center p-3 text-center rounded-lg bg-white border"
                      data-id={doc._id}
                    >
                      <div className="relative">
                        {doc.original_file_name?.toLowerCase().endsWith('.pdf') || doc.file_name?.toLowerCase().endsWith('.pdf') || doc.filename?.toLowerCase().endsWith('.pdf') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                          </svg>
                        ) : doc.original_file_name?.match(/\.(jpg|jpeg|png|gif)$/i) || doc.file_name?.match(/\.(jpg|jpeg|png|gif)$/i) || doc.filename?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                        
                        {(doc.has_password || doc.is_password_protected) && (
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
                        {doc.original_file_name || doc.filename || doc.file_name || `Document ${idx + 1}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : 
                         doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                      </p>
                      
                      <div className="w-full border-t my-2"></div>
                      
                      <div className="flex items-center justify-center space-x-1 w-full">
                        <button 
                          className="view-btn flex items-center justify-center p-1.5 text-gray-500 hover:bg-gray-100 rounded-md tooltip"
                          onClick={() => window.open(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${doc._id}/view?user_id=${currentUserId}`, '_blank')}
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
                        
                        {(doc.has_password || doc.is_password_protected) && (
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
                  
                {currentModalCategory && uploadedDocuments.filter(doc => 
                  // Check by attachment type ID (what we send when uploading)
                  (doc.attachment_type === (currentModalCategory.id || currentModalCategory._id)) ||
                  // Check by attachment type name (from backend enhancement)
                  (doc.attachment_type_name === currentModalCategory.name) ||
                  // Legacy fallbacks
                  (doc.document_type === currentModalCategory.name) ||
                  (doc.category === currentModalCategory.name)
                ).length === 0 && (
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
};

export default EmployeeAttachmentsNew;