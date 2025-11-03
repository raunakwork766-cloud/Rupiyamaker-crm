import React, { useState, useEffect, useRef } from 'react';
import { Button, message } from 'antd';
import { Archive, RefreshCw } from 'lucide-react';
import { saveAs } from 'file-saver';
import hrmsService from '../../services/hrmsService';
import JSZip from 'jszip';

const EmployeeAttachments = ({ employeeId }) => {
    const [attachments, setAttachments] = useState([]);
    const [attachmentTypes, setAttachmentTypes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [debugInfo, setDebugInfo] = useState({
        attachmentsResponse: null,
        attachmentTypesResponse: null,
        lastFetch: null
    });

    // Dynamic states for each attachment type (like lead attachments)
    const [dynamicFiles, setDynamicFiles] = useState({});
    const [dynamicRefs, setDynamicRefs] = useState({});
    const [dynamicPasswords, setDynamicPasswords] = useState({});
    const [isUploading, setIsUploading] = useState(false);
    const [notification, setNotification] = useState(null);
    
    // Modal state (like lead attachments)
    const [showModal, setShowModal] = useState(false);
    const [currentModalCategory, setCurrentModalCategory] = useState(null);
    const modalRef = useRef(null);
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    // Show notification function
    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            setNotification(null);
        }, 5000);
    };

    // Function to open modal (like lead attachments)
    const openModal = (attachmentType) => {
        console.log('🔥 Opening modal for:', attachmentType.name);
        setCurrentModalCategory(attachmentType);
        setShowModal(true);
    };

    // Function to close modal (like lead attachments)
    const closeModal = () => {
        console.log('🔥 Closing modal');
        setShowModal(false);
        setTimeout(() => {
            setCurrentModalCategory(null);
        }, 300);
    };

    useEffect(() => {
        fetchAttachments();
        fetchAttachmentTypes();
    }, [employeeId]);

    // Create refs for each attachment type when attachment types change
    useEffect(() => {
        const newRefs = {};
        attachmentTypes.forEach(type => {
            const key = type.name.toLowerCase().replace(/\s+/g, '_');
            newRefs[key] = React.createRef();
        });
        setDynamicRefs(newRefs);
    }, [attachmentTypes]);

    const fetchAttachments = async () => {
        try {
            setLoading(true);
            console.log('🔍 EmployeeAttachments: Fetching attachments for employee:', employeeId);
            const response = await hrmsService.getEmployeeAttachments(employeeId);
            console.log('📦 EmployeeAttachments: Response received:', response);
            setAttachments(response.data || []);
            console.log('✅ EmployeeAttachments: Attachments set:', response.data || []);
            
            // Store debug info
            setDebugInfo(prev => ({
                ...prev,
                attachmentsResponse: response,
                lastFetch: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ EmployeeAttachments: Error fetching attachments:', error);
            setAttachments([]);
            setDebugInfo(prev => ({
                ...prev,
                attachmentsResponse: { error: error.message },
                lastFetch: new Date().toISOString()
            }));
        } finally {
            setLoading(false);
        }
    };

    const fetchAttachmentTypes = async () => {
        try {
            console.log('🔍 EmployeeAttachments: Fetching attachment types for employees...');
            const response = await hrmsService.getEmployeeAttachmentTypes();
            console.log('📦 EmployeeAttachments: Attachment types response:', response);
            
            if (response.success && response.data && Array.isArray(response.data)) {
                setAttachmentTypes(response.data);
                console.log('✅ EmployeeAttachments: Attachment types set successfully:', response.data.length, 'types');
                console.log('📋 EmployeeAttachments: Attachment types details:', response.data.map(type => ({
                    name: type.name,
                    target_type: type.target_type,
                    id: type._id || type.id
                })));
            } else {
                console.warn('⚠️ EmployeeAttachments: No attachment types received or invalid response');
                setAttachmentTypes([]);
            }
            
            // Store debug info
            setDebugInfo(prev => ({
                ...prev,
                attachmentTypesResponse: response,
                lastFetch: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ EmployeeAttachments: Error fetching attachment types:', error);
            // Fallback attachment types
            console.log('🔄 EmployeeAttachments: Using fallback attachment types');
            const fallbackTypes = [
                { _id: 'resume', name: 'Resume/CV', target_type: 'Employees' },
                { _id: 'id_proof', name: 'ID Proof', target_type: 'Employees' },
                { _id: 'address_proof', name: 'Address Proof', target_type: 'Employees' },
                { _id: 'education', name: 'Education Certificate', target_type: 'Employees' },
                { _id: 'experience', name: 'Experience Letter', target_type: 'Employees' },
                { _id: 'other', name: 'Other', target_type: 'Employees' }
            ];
            setAttachmentTypes(fallbackTypes);
            
            // Store debug info
            setDebugInfo(prev => ({
                ...prev,
                attachmentTypesResponse: { error: error.message, fallback: true, data: fallbackTypes },
                lastFetch: new Date().toISOString()
            }));
        }
    };

    // Handle password change for specific attachment type
    const handlePasswordChange = (attachmentKey, value) => {
        setDynamicPasswords(prev => ({
            ...prev,
            [attachmentKey]: value
        }));
    };

    // Handle file change with auto-upload (like lead attachments)
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
                await handleUpload(attachmentType, files, attachmentKey);
            } catch (error) {
                console.error('Error in handleFileChange:', error);
                showNotification('Upload failed: ' + error.message, 'error');
            }
        } else {
            console.error('Attachment type not found for key:', attachmentKey);
            console.log('Available attachment types:', attachmentTypes.map(t => t.name));
        }
    };

    // Handle upload for specific attachment type
    const handleUpload = async (attachmentType, files, attachmentKey) => {
        if (!employeeId || !files.length) {
            showNotification('Missing required information: employeeId or files', 'error');
            return;
        }

        try {
            setIsUploading(true);
            
            // Get password for this specific attachment type
            const password = dynamicPasswords[attachmentKey] || '';
            
            // Upload each file individually (matching hrmsService expectations)
            for (let file of files) {
                await hrmsService.uploadEmployeeAttachment(
                    employeeId,
                    file,
                    attachmentType._id || attachmentType.id,
                    '', // description
                    !!password, // isPasswordProtected
                    password
                );
            }

            showNotification(`Successfully uploaded ${files.length} file(s) for ${attachmentType.name}`, 'success');
            
            // Clear the files and refresh attachments
            setDynamicFiles(prev => ({
                ...prev,
                [attachmentKey]: []
            }));
            
            // Clear the file input
            const inputRef = dynamicRefs[attachmentKey];
            if (inputRef?.current) {
                inputRef.current.value = '';
            }
            
            // Refresh attachments list
            fetchAttachments();
            
        } catch (error) {
            console.error('Error uploading files:', error);
            showNotification('Failed to upload files: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle download for individual attachment
    const handleDownload = async (attachmentId) => {
        try {
            console.log('🔽 Downloading attachment:', attachmentId);
            const response = await hrmsService.downloadEmployeeAttachment(employeeId, attachmentId);
            
            if (response.success && response.data) {
                // Create blob URL and trigger download
                const blob = response.data;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                
                // Try to get filename from the attachment
                const attachment = attachments.find(att => (att._id || att.id) === attachmentId);
                const filename = attachment?.original_file_name || attachment?.file_name || `attachment_${attachmentId}`;
                a.download = filename;
                
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showNotification('Download started successfully', 'success');
            } else {
                showNotification('Failed to download attachment', 'error');
            }
        } catch (error) {
            console.error('Download error:', error);
            showNotification('Error downloading attachment: ' + error.message, 'error');
        }
    };

    // Handle delete for individual attachment
    const handleDelete = async (attachmentId) => {
        if (!confirm('Are you sure you want to delete this attachment? This action cannot be undone.')) {
            return;
        }
        
        try {
            console.log('🗑️ Deleting attachment:', attachmentId);
            const response = await hrmsService.deleteEmployeeAttachment(employeeId, attachmentId);
            
            if (response.success) {
                showNotification('Attachment deleted successfully', 'success');
                
                // Refresh attachments list
                fetchAttachments();
                
                // Close modal if no more attachments in this category
                const remainingAttachments = attachments.filter(att => 
                    (att._id || att.id) !== attachmentId &&
                    (att.attachment_type_name === currentModalCategory?.name || att.document_type === currentModalCategory?.name)
                );
                
                if (remainingAttachments.length === 0) {
                    closeModal();
                }
            } else {
                showNotification('Failed to delete attachment', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showNotification('Error deleting attachment: ' + error.message, 'error');
        }
    };

    const handleBulkDownload = async () => {
        if (!attachments || attachments.length === 0) {
            message.warning('No attachments to download');
            return;
        }

        console.log('🔽 Starting frontend bulk download for employee:', employeeId);
        console.log('🔽 Attachments count:', attachments.length);

        try {
            setBulkDownloading(true);
            message.info('Preparing download... This may take a moment.');

            // Create JSZip instance directly
            const zip = new JSZip();
            
            if (!zip || typeof zip.file !== 'function') {
                message.error('Failed to initialize ZIP library');
                setBulkDownloading(false);
                return;
            }
            
            let downloadedCount = 0;
            let failedCount = 0;

            for (let attachment of attachments) {
                try {
                    console.log('🔽 Downloading attachment:', attachment.original_file_name);
                    
                    const response = await hrmsService.downloadEmployeeAttachment(employeeId, attachment.id || attachment._id);
                    const blob = response.data;
                    
                    const fileName = attachment.original_file_name || `attachment_${attachment.id || attachment._id}`;
                    console.log('🔽 Adding to ZIP:', fileName);
                    
                    zip.file(fileName, blob);
                    downloadedCount++;
                    
                } catch (error) {
                    console.error('🔽 Failed to download attachment:', attachment.original_file_name, error);
                    failedCount++;
                }
            }

            if (downloadedCount > 0) {
                console.log('🔽 Generating ZIP file...');
                const zipContent = await zip.generateAsync({ type: 'blob' });
                
                const timestamp = new Date().toISOString().split('T')[0];
                const zipFileName = `employee_${employeeId}_attachments_${timestamp}.zip`;
                
                console.log('🔽 Saving ZIP file:', zipFileName);
                saveAs(zipContent, zipFileName);
                
                let successMessage = `Successfully downloaded ${downloadedCount} attachment(s)`;
                if (failedCount > 0) {
                    successMessage += ` ${failedCount} attachment(s) failed to download.`;
                }
                
                message.success(successMessage);
            } else {
                message.error('No attachments could be downloaded');
            }

        } catch (error) {
            console.error('🔽 Error creating bulk download:', error);
            message.error(`Failed to create bulk download: ${error.message || 'Unknown error'}`);
        } finally {
            setBulkDownloading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with action buttons */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Attachments</h3>
                <div className="flex space-x-2">
                    <Button
                        onClick={() => setShowDebug(!showDebug)}
                        title="Toggle debug information"
                        className="text-gray-600 hover:text-gray-700 border-gray-600 hover:border-gray-700"
                    >
                        {showDebug ? '🐛 Hide Debug' : '🐛 Debug'}
                    </Button>
                    <Button
                        icon={<RefreshCw className="w-4 h-4" />}
                        onClick={() => {
                            console.log('🔄 Manual refresh clicked for attachments');
                            fetchAttachments();
                            fetchAttachmentTypes();
                        }}
                        loading={loading}
                        title="Refresh attachments"
                        className="text-blue-600 hover:text-blue-700 border-blue-600 hover:border-blue-700"
                    >
                        Refresh
                    </Button>
                    <Button
                        icon={<Archive className="w-4 h-4" />}
                        onClick={handleBulkDownload}
                        loading={bulkDownloading}
                        disabled={attachments.length === 0}
                        className="text-green-600 hover:text-green-700 border-green-600 hover:border-green-700"
                    >
                        {bulkDownloading ? 'Creating ZIP...' : `Download All Files (${attachments.length})`}
                    </Button>
                </div>
            </div>

            {/* Debug Panel */}
            {showDebug && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-gray-800">🐛 Debug Information</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <h5 className="font-medium text-gray-700">Attachment Types API Response:</h5>
                            <div className="bg-white p-3 rounded border text-xs overflow-auto max-h-40">
                                <pre>{JSON.stringify(debugInfo.attachmentTypesResponse, null, 2)}</pre>
                            </div>
                        </div>
                        <div>
                            <h5 className="font-medium text-gray-700">Attachments API Response:</h5>
                            <div className="bg-white p-3 rounded border text-xs overflow-auto max-h-40">
                                <pre>{JSON.stringify(debugInfo.attachmentsResponse, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                    <div className="text-xs text-gray-600">
                        Employee ID: {employeeId} | Last Fetch: {debugInfo.lastFetch}
                    </div>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div className={`notification p-3 rounded-lg border ${
                    notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                    notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                    notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                    <i className={`fas ${
                        notification.type === 'success' ? 'fa-check-circle' :
                        notification.type === 'error' ? 'fa-times-circle' :
                        notification.type === 'warning' ? 'fa-exclamation-triangle' :
                        'fa-info-circle'
                    } mr-2`}></i>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Attachment Types Grid - Exact copy of lead attachments style */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading attachments...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Display active attachment types */}
                    {attachmentTypes.map((attachmentType, index) => {
                        const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
                        const files = dynamicFiles[key] || [];
                        const inputRef = dynamicRefs[key];
                        const password = dynamicPasswords[key] || '';
                        
                        // Find uploaded documents for this type
                        const typeDocuments = attachments.filter(doc => 
                            doc.attachment_type_name === attachmentType.name ||
                            doc.document_type === attachmentType.name
                        );
                        
                        return (
                            <div 
                                key={attachmentType.id || attachmentType._id} 
                                className="border border-gray-200 rounded-xl bg-white p-6 transition-all duration-200 hover:shadow-lg"
                                data-category={attachmentType.name}
                            >
                                <h2 className="text-md font-semibold text-gray-700 mb-3">
                                    {attachmentType.name}
                                </h2>
                                
                                {typeDocuments.length === 0 ? (
                                    <div className="upload-box space-y-3">
                                        <input 
                                            type="password"
                                            placeholder="Password (optional)"
                                            className="password-input w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={password}
                                            onChange={(e) => handlePasswordChange(key, e.target.value)}
                                            disabled={isUploading}
                                        />
                                        <div className="relative">
                                            <input 
                                                type="file"
                                                multiple
                                                ref={inputRef}
                                                onChange={handleFileChange(key)}
                                                className="file-input block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                                disabled={isUploading}
                                            />
                                            {isUploading && (
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
                                    <div className="summary-box space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
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
                                            <div className="flex space-x-2">
                                                <button 
                                                    className="view-manage-btn text-sm font-semibold text-blue-600 hover:text-blue-800"
                                                    onClick={() => openModal(attachmentType)}
                                                >
                                                    Manage
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <input 
                                                type="password"
                                                placeholder="Password (optional)"
                                                className="password-input w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={password}
                                                onChange={(e) => handlePasswordChange(key, e.target.value)}
                                                disabled={isUploading}
                                            />
                                            <input 
                                                type="file"
                                                multiple
                                                ref={inputRef}
                                                onChange={handleFileChange(key)}
                                                className="file-input block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                                disabled={isUploading}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload All Button */}
            <div className="flex justify-end">
                <p className="text-xs text-gray-500 text-right mt-2">
                    * Each attachment type has its own password field for secure uploads
                </p>
            </div>

            {/* Modal for managing attachments (like lead attachments) */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div 
                        ref={modalRef}
                        className={`bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden transition-all duration-300 ${
                            showModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
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
                                {currentModalCategory && attachments
                                    .filter(attachment => 
                                        attachment.attachment_type_name === currentModalCategory.name ||
                                        attachment.document_type === currentModalCategory.name
                                    )
                                    .map((attachment, idx) => (
                                        <div 
                                            key={idx} 
                                            className="file-card flex flex-col items-center p-3 text-center rounded-lg bg-white border"
                                            data-id={attachment._id || attachment.id}
                                        >
                                            <div className="relative">
                                                {attachment.file_name?.toLowerCase().endsWith('.pdf') || attachment.original_file_name?.toLowerCase().endsWith('.pdf') ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                                                    </svg>
                                                ) : attachment.file_name?.match(/\.(jpg|jpeg|png|gif)$/i) || attachment.original_file_name?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                )}
                                                
                                                {attachment.is_password_protected && (
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
                                                {attachment.original_file_name || attachment.file_name || `Document ${idx + 1}`}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {attachment.file_size ? `${(attachment.file_size / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                                            </p>
                                            
                                            <div className="w-full border-t my-2"></div>
                                            
                                            <div className="flex items-center justify-center space-x-1 w-full">
                                                <button 
                                                    className="view-btn flex items-center justify-center p-1.5 text-gray-500 hover:bg-gray-100 rounded-md tooltip"
                                                    onClick={() => window.open(`/api/hrms/employees/${employeeId}/attachments/${attachment._id || attachment.id}/view?user_id=${userData._id}`, '_blank')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                                    </svg>
                                                    <span className="tooltiptext">View</span>
                                                </button>
                                                
                                                <button 
                                                    className="download-btn flex items-center justify-center p-1.5 text-gray-500 hover:bg-gray-100 rounded-md tooltip"
                                                    onClick={() => handleDownload(attachment._id || attachment.id)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                                    </svg>
                                                    <span className="tooltiptext">Download</span>
                                                </button>
                                                
                                                {attachment.is_password_protected && (
                                                    <button 
                                                        className="copy-password-btn flex items-center justify-center p-1.5 text-blue-600 hover:bg-blue-100 rounded-md tooltip"
                                                        onClick={() => {
                                                            if (attachment.password) {
                                                                navigator.clipboard.writeText(attachment.password);
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
                                                    onClick={() => handleDelete(attachment._id || attachment.id)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                    </svg>
                                                    <span className="tooltiptext">Delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                {currentModalCategory && attachments.filter(attachment => 
                                    attachment.attachment_type_name === currentModalCategory.name ||
                                    attachment.document_type === currentModalCategory.name
                                ).length === 0 && (
                                    <p className="text-gray-500 col-span-full text-center">No files uploaded for this category yet.</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-5 border-t bg-gray-50 rounded-b-xl">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Upload More Files</label>
                            <p className="text-xs text-gray-500 mb-3">Select files to auto-upload</p>
                            {isUploading && (
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
                                                onChange={handleFileChange(currentModalCategory.name.toLowerCase().replace(/\s+/g, '_'))}
                                                className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer flex-grow" 
                                            />
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    id="modalPasswordInput" 
                                                    type="password" 
                                                    placeholder="Password (optional)" 
                                                    value={dynamicPasswords[currentModalCategory.name.toLowerCase().replace(/\s+/g, '_')] || ''}
                                                    onChange={(e) => handlePasswordChange(
                                                        currentModalCategory.name.toLowerCase().replace(/\s+/g, '_'), 
                                                        e.target.value
                                                    )}
                                                    className="w-full sm:w-auto px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                                    disabled={isUploading}
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
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500">Files will be uploaded automatically when selected.</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeAttachments;