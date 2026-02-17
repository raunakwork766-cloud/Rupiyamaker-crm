import React, { useRef, useState, useEffect } from "react";

export default function Attachments({ leadId, userId }) {
  // State for notifications
  const [notification, setNotification] = useState(null);
  
  // Show a notification
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
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
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [showPasswordFor, setShowPasswordFor] = useState({});

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
      const response = await fetch(`${BASE_URL}/leads/${leadId}/documents?user_id=${currentUserId}`);
      if (response.ok) {
        const documents = await response.json();
        setUploadedDocuments(documents);
        
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

  // Load attachment types on component mount
  useEffect(() => {
    if (currentUserId) {
      loadAttachmentTypes();
    }
  }, [currentUserId]);

  // Load uploaded documents when leadId changes
  useEffect(() => {
    if (leadId && !loadingTypes && currentUserId) {
      loadUploadedDocuments();
    }
  }, [leadId, loadingTypes, currentUserId]);

  // Handler for dynamic file input changes
  const handleFileChange = (attachmentKey) => (e) => {
    const files = Array.from(e.target.files);
    setDynamicFiles(prev => ({
      ...prev,
      [attachmentKey]: files
    }));
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

      const response = await fetch(`${BASE_URL}/leads/${leadId}/documents?user_id=${currentUserId}`, {
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
        
        // Clear the uploaded files and reload documents
        const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
        setDynamicFiles(prev => ({
          ...prev,
          [key]: []
        }));
        
        // Reset file input
        if (dynamicRefs[key]?.current) {
          dynamicRefs[key].current.value = '';
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

  // Handler for removing a file
  const handleRemoveFile = (attachmentKey, index) => {
    setDynamicFiles(prev => ({
      ...prev,
      [attachmentKey]: prev[attachmentKey].filter((_, i) => i !== index)
    }));
  };

  // Render file previews or names
  const renderFileNames = (files, attachmentKey) => {
    if (!files || files.length === 0) {
      return <span className="text-sm text-gray-500">No file selected</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {files.map((file, idx) => {
          const isImage = file.type.startsWith("image/");
          return (
            <div
              key={idx}
              className="relative w-24 h-24 flex items-center justify-center bg-gray-100 rounded-lg border border-neutral-700 p-2"
            >
              <button
                className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 text-sm z-10"
                onClick={() => handleRemoveFile(attachmentKey, idx)}
                title="Remove file"
              >
                <i className="fas fa-times"></i>
              </button>
              {isImage ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <i className="fas fa-file text-gray-700 text-xl"></i>
                  <span className="text-xs text-gray-700 break-all">{file.name}</span>
                </div>
              )}
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
  
  // Render uploaded documents for each attachment type
  const renderUploadedDocuments = (attachmentType) => {
    const typeDocuments = uploadedDocuments.filter(doc => 
      doc.document_type === attachmentType.name
    );

    if (typeDocuments.length === 0) {
      return null;
    }

    return (
      <div className="mt-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Uploaded Documents:</h4>
        <div className="flex flex-wrap gap-3">
          {typeDocuments.map((doc, idx) => (
            <div key={idx} className="bg-green-100 border border-green-300 rounded-lg p-3 w-full">
              {/* Document header with file info */}
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="flex items-center gap-2 cursor-pointer" 
                  onClick={() => handleDownload(doc._id)}
                  title="Click to download"
                >
                  <i className="fas fa-file text-green-600 text-lg"></i>
                  <span className="text-sm font-medium text-green-700 hover:underline">
                    {doc.filename || doc.file_name || 'Unnamed file'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(`${BASE_URL}/leads/${leadId}/attachments/${doc._id}/view?user_id=${currentUserId}`, '_blank')}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100"
                    title="View document"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  <button
                    onClick={() => handleDownload(doc._id)}
                    className="text-green-600 hover:text-green-800 p-1 rounded-full hover:bg-green-100"
                    title="Download document"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                  {doc.has_password && (
                    <button
                      onClick={() => togglePasswordVisibility(doc._id, doc.document_type)}
                      className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100"
                      title={showPasswordFor[doc._id] ? "Hide password" : "Show password"}
                    >
                      <i className={`fas ${showPasswordFor[doc._id] ? 'fa-eye-slash' : 'fa-lock'}`}></i>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Password indicator section */}
              {doc.has_password && showPasswordFor[doc._id] && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <div className="flex items-center text-sm">
                    <i className="fas fa-info-circle text-yellow-600 mr-2"></i>
                    <span className="text-yellow-800">
                      This document is password protected. Use the password below when prompted after opening the file:
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 ml-6 italic">
                    Tip: Click the copy button to copy the password to your clipboard
                  </div>
                  <div className="mt-2 p-2 bg-gray-100 border border-gray-200 rounded flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <i className="fas fa-key text-gray-600 mr-2"></i>
                      <span className="text-gray-800 font-mono font-medium">
                        {getDocumentPassword(doc)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <button 
                        className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 mr-1"
                        onClick={() => {
                          const password = getDocumentPassword(doc);
                          if (password && !password.includes("not available")) {
                            navigator.clipboard.writeText(password);
                            showNotification("Password copied to clipboard!", "success");
                          } else {
                            showNotification("No password available to copy", "warning");
                          }
                        }}
                        title="Copy password to clipboard"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded whitespace-nowrap">
                        Required for this file
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Show loading state while attachment types are being loaded
  if (loadingTypes) {
    return (
      <div className="mb-8 form-section">
        <div className="mb-6">
          <div className="mb-2 text-2xl font-bold text-sky-400">Attachments</div>
          <div className="flex items-center justify-center p-8">
            <div className="text-lg text-gray-600">Loading attachment types...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if userId is not available
  if (!currentUserId || currentUserId === 'default_user') {
    return (
      <div className="mb-8 form-section">
        <div className="mb-6">
          <div className="mb-2 text-2xl font-bold text-sky-400">Attachments</div>
          <div className="flex items-center justify-center p-8">
            <div className="text-lg text-red-600">
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
    <div className="mb-8 form-section">
      <div className="mb-6">
        <div className="mb-2 text-2xl font-bold text-sky-400">Attachments</div>
        
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
        
        {/* Dynamic attachment types */}
        <div className="flex flex-wrap gap-4 p-4 mb-4 border rounded-lg bg-grey/50 border-neutral-700">
          {/* Display active attachment types */}
          {attachmentTypes.map((attachmentType) => {
            const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
            const files = dynamicFiles[key] || [];
            const inputRef = dynamicRefs[key];
            const password = dynamicPasswords[key] || '';
            
            return (
              <div key={attachmentType.id || attachmentType._id} className="form-group flex-1 min-w-[220px]">
                <label className="block mb-2 text-lg font-bold" style={{ color: "#03b0f5" }}>
                  {attachmentType.name}
                </label>
                
                {/* Password field for this attachment type */}
                <div className="mb-2 relative">
                  <input
                    type="password"
                    className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                    value={password}
                    onChange={(e) => handlePasswordChange(key, e.target.value)}
                    placeholder="Password (optional)"
                  />
                  {password && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-blue-500 text-white px-1 py-0.5 rounded">
                      Password Set
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mb-2">
                  <label className="inline-block px-4 py-2 bg-[#03b0f5] text-white font-semibold rounded-lg shadow cursor-pointer hover:bg-sky-500 transition">
                    Choose Files
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={handleFileChange(key)}
                      ref={inputRef}
                    />
                  </label>
                  
                  {files.length > 0 && (
                    <button
                      onClick={() => handleUpload(attachmentType, files)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {isLoading ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
                
                <div className="mt-2">
                  {renderFileNames(files, key)}
                </div>
                
                {/* Show uploaded documents */}
                {renderUploadedDocuments(attachmentType)}
                
                {/* Show description if available */}
                {attachmentType.description && (
                  <div className="mt-2 text-sm text-gray-600">
                    {attachmentType.description}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Display historical attachment types that have files */}
          {historicalAttachmentTypes
            .filter(type => !attachmentTypes.some(active => active.name === type.name))
            .map(attachmentType => {
              const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
              const files = dynamicFiles[key] || [];
              const inputRef = dynamicRefs[key];
              const password = dynamicPasswords[key] || '';
              
              // Check if there are any uploaded documents for this type
              const hasUploadedDocuments = uploadedDocuments.some(doc => 
                doc.document_type === attachmentType.name
              );
              
              // Only show if there are uploaded documents
              if (!hasUploadedDocuments) return null;
              
              return (
                <div key={attachmentType.id || attachmentType._id} className="form-group flex-1 min-w-[220px] border border-yellow-400 rounded-lg p-4">
                  <label className="block mb-2 text-lg font-bold flex items-center" style={{ color: "#03b0f5" }}>
                    {attachmentType.name}
                    <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full">
                      Deleted Type
                    </span>
                  </label>
                  
                  {/* Password field for this attachment type */}
                  <div className="mb-2">
                    <input
                      type="password"
                      className="w-full px-3 py-2 text-black border rounded-lg border-neutral-700 focus:outline-none focus:border-sky-400"
                      value={password}
                      onChange={(e) => handlePasswordChange(key, e.target.value)}
                      placeholder="Password (optional)"
                    />
                  </div>
                  
                  <div className="flex gap-2 mb-2">
                    <label className="inline-block px-4 py-2 bg-[#03b0f5] text-white font-semibold rounded-lg shadow cursor-pointer hover:bg-sky-500 transition">
                      Choose Files
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        onChange={handleFileChange(key)}
                        ref={inputRef}
                      />
                    </label>
                    
                    {files.length > 0 && (
                      <button
                        onClick={() => handleUpload(attachmentType, files)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {isLoading ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    {renderFileNames(files, key)}
                  </div>
                  
                  {/* Show uploaded documents */}
                  {renderUploadedDocuments(attachmentType)}
                  
                  <div className="mt-2 text-sm text-yellow-500">
                    This document type has been deleted but existing files are still available.
                  </div>
                </div>
              );
            }).filter(Boolean)}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-end gap-4 mt-4 form-actions">
        <button
          type="button"
          className="px-5 py-2 text-lg font-bold text-white rounded-lg btn btn-secondary bg-gray-500 hover:bg-gray-600"
          onClick={loadUploadedDocuments}
          disabled={isLoading}
        >
          Refresh Documents
        </button>
        <button
          type="button"
          className="px-5 py-2 text-lg font-bold text-white rounded-lg btn btn-primary bg-sky-400 hover:bg-sky-500"
          onClick={handleSaveAll}
          disabled={isLoading || Object.values(dynamicFiles).every(files => files.length === 0)}
        >
          {isLoading ? 'Uploading...' : 'Upload All Files'}
        </button>
        <div className="text-xs text-gray-500 italic ml-2 self-end">
          * Each attachment type has its own password field for secure uploads
        </div>
      </div>
      
      {/* Notification for password information */}
      {notification && (
        <div className={`mt-4 p-3 rounded-lg shadow-md ${notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          <div className="flex items-center">
            {notification.type === 'error' ? (
              <i className="fas fa-exclamation-circle mr-2"></i>
            ) : (
              <i className="fas fa-check-circle mr-2"></i>
            )}
            <span className="text-sm">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
