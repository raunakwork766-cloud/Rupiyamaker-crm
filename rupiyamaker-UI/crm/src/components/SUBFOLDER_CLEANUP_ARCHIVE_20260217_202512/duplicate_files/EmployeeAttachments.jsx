import React, { useState, useEffect, useRef } from 'react';
import { Button, message, Modal, Select, Input, Checkbox } from 'antd';
import { Archive, RefreshCw, Download, Eye, Trash2, Paperclip } from 'lucide-react';
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
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    // Show notification function
    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            setNotification(null);
        }, 5000);
    };

    useEffect(() => {
        fetchAttachments();
        fetchAttachmentTypes();
    }, [employeeId]);

    };

    // Function to trigger auto-upload (like lead attachments)
    const triggerAutoUpload = (attachmentType) => {
        console.log('🔥 Triggering auto-upload for:', attachmentType.name);
        
        // Create a hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '*/*';
        
        // Handle file selection and auto-upload
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                console.log('🔥 Files selected for auto-upload:', files.map(f => f.name));
                
                const attachmentKey = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
                
                // Show uploading notification
                showNotification(`Auto-uploading ${files.length} file(s) for ${attachmentType.name}...`, 'info');
                
                try {
                    // Trigger auto-upload immediately
                    await handleUpload(attachmentType, files, attachmentKey);
                } catch (error) {
                    console.error('Error in auto-upload:', error);
                    showNotification('Auto-upload failed: ' + error.message, 'error');
                }
            }
        };
        
        // Trigger the file picker
        input.click();
    };

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

    const handleDownload = async (attachment) => {
        try {
            console.log('🔽 Starting download for attachment:', attachment.original_file_name);
            const response = await hrmsService.downloadEmployeeAttachment(employeeId, attachment.id || attachment._id);
            console.log('🔽 Download response:', response);
            
            // The response.data is already a blob when using responseType: 'blob'
            const blob = response.data;
            console.log('🔽 Blob details:', { size: blob.size, type: blob.type });
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = attachment.original_file_name || attachment.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            console.log('🔽 File download triggered successfully');
            message.success(`Downloaded: ${attachment.original_file_name || attachment.file_name}`);
        } catch (error) {
            console.error('Error downloading attachment:', error);
            message.error('Failed to download attachment');
        }
    };

    const handleDelete = async (attachment) => {
        Modal.confirm({
            title: 'Delete Attachment',
            content: `Are you sure you want to delete "${attachment.original_file_name || attachment.file_name}"?`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await hrmsService.deleteEmployeeAttachment(employeeId, attachment.id || attachment._id);
                    message.success('Attachment deleted successfully');
                    fetchAttachments();
                } catch (error) {
                    console.error('Error deleting attachment:', error);
                    message.error('Failed to delete attachment');
                }
            }
        });
    };

    // Helper function to get file icon based on file type
    const getFileIcon = (fileType) => {
        if (!fileType) return '📄';
        
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('image')) return '🖼️';
        if (fileType.includes('video')) return '🎥';
        if (fileType.includes('audio')) return '🎵';
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📊';
        if (fileType.includes('zip') || fileType.includes('archive')) return '📦';
        
        return '📄';
    };

    // Helper function to format file size
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const handleBulkDownload = async () => {
        if (attachments.length === 0) {
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
            const passwordInfo = [];
            let downloadedCount = 0;
            let failedCount = 0;

            // Create folders for different attachment types
            const attachmentsByType = {};
            attachments.forEach(attachment => {
                const type = attachment.attachment_type_name || 'Other';
                if (!attachmentsByType[type]) {
                    attachmentsByType[type] = [];
                }
                attachmentsByType[type].push(attachment);
            });

            // Download each attachment and add to ZIP
            for (const [attachmentType, typeAttachments] of Object.entries(attachmentsByType)) {
                const folder = zip.folder(attachmentType);
                
                for (const attachment of typeAttachments) {
                    try {
                        console.log('🔽 Downloading attachment:', attachment.original_file_name);
                        
                        // Fetch the file from the server
                        const response = await hrmsService.downloadEmployeeAttachment(employeeId, attachment.id || attachment._id);
                        
                        if (response.data) {
                            const blob = response.data;
                            const filename = attachment.original_file_name || attachment.file_name || `attachment_${attachment.id || attachment._id}`;
                            
                            // Add file to the appropriate folder in ZIP
                            folder.file(filename, blob);
                            downloadedCount++;

                            // If the attachment is password protected, add it to password info
                            if (attachment.is_password_protected) {
                                passwordInfo.push({
                                    folder: attachmentType,
                                    filename: filename,
                                    password: attachment.password || "Password not stored - check with uploader",
                                    description: attachment.description || "No description provided"
                                });
                            }
                        } else {
                            console.error(`No data received for ${attachment.original_file_name || attachment.id}`);
                            failedCount++;
                        }
                    } catch (error) {
                        console.error(`Error downloading ${attachment.original_file_name || attachment.id}:`, error);
                        failedCount++;
                    }
                }
            }

            // Create password information file if there are password-protected files
            if (passwordInfo.length > 0) {
                let passwordText = "PASSWORD INFORMATION FOR DOWNLOADED ATTACHMENTS\n";
                passwordText += "=" + "=".repeat(50) + "\n\n";
                passwordText += `Generated on: ${new Date().toLocaleString()}\n`;
                passwordText += `Employee ID: ${employeeId}\n\n`;
                
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
                        passwordText += `  Password: ${file.password}\n`;
                        if (file.description && file.description !== "No description provided") {
                            passwordText += `  Description: ${file.description}\n`;
                        }
                        passwordText += "\n";
                    });
                    passwordText += "\n";
                });

                passwordText += "\nIMPORTANT NOTES:\n";
                passwordText += "- Keep this file secure and delete it after use\n";
                passwordText += "- Some files may not require passwords despite being listed\n";
                passwordText += "- If 'Password not stored' is shown, contact the person who uploaded the file\n";
                passwordText += "- This file contains sensitive information - handle with care\n";

                // Add password file to the root of the ZIP
                zip.file("PASSWORDS.txt", passwordText);
            }

            // Generate and download the ZIP file
            if (downloadedCount > 0) {
                const zipBlob = await zip.generateAsync({ type: "blob" });
                const zipFilename = `Employee_${employeeId}_Attachments_${new Date().toISOString().split('T')[0]}.zip`;
                saveAs(zipBlob, zipFilename);

                let successMessage = `Successfully downloaded ${downloadedCount} attachment(s) as ZIP archive.`;
                if (passwordInfo.length > 0) {
                    successMessage += ` Password information is included in PASSWORDS.txt file.`;
                }
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
        <div className="space-y-4">
            {/* Upload Section */}
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
                    <Upload
                        beforeUpload={handleFileSelect}
                        showUploadList={false}
                        multiple={false}
                    >
                        <Button 
                            type="primary" 
                            icon={<UploadIcon className="w-4 h-4" />}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Upload File
                        </Button>
                    </Upload>
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

            {/* Attachments List */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading attachments...</p>
                </div>
            ) : attachments.length > 0 ? (
                <div className="space-y-3">
                    {attachments.map((attachment) => (
                        <div
                            key={attachment.id || attachment._id}
                            className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">{getFileIcon(attachment.file_type)}</span>
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            {attachment.original_file_name || attachment.file_name}
                                        </h4>
                                        <div className="text-sm text-gray-500 space-x-2">
                                            <span>{attachment.attachment_type_name || 'Unknown Type'}</span>
                                            <span>•</span>
                                            <span>{formatFileSize(attachment.file_size)}</span>
                                            <span>•</span>
                                            <span>Uploaded by {attachment.created_by_name || 'Unknown'}</span>
                                            {attachment.is_password_protected && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-orange-600 font-medium">🔒 Password Protected</span>
                                                </>
                                            )}
                                            {attachment.description && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-blue-600">{attachment.description}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        size="small"
                                        icon={<Download className="w-4 h-4" />}
                                        onClick={() => handleDownload(attachment)}
                                        className="text-blue-600 hover:text-blue-700"
                                    />
                                    <Button
                                        size="small"
                                        danger
                                        icon={<Trash2 className="w-4 h-4" />}
                                        onClick={() => handleDelete(attachment)}
                                        className="text-red-600 hover:text-red-700"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Show Available Attachment Types in Cards like Lead Attachments */}
                    {attachmentTypes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{attachmentTypes.map((type) => {
                                // Find uploaded documents for this type
                                const typeDocuments = attachments.filter(doc => 
                                    doc.attachment_type_name === type.name || 
                                    doc.document_type === type.name
                                );
                                
                                return (
                                    <div
                                        key={type._id || type.id}
                                        className="border border-gray-200 rounded-xl bg-white p-6 transition-all duration-200 hover:shadow-lg hover:border-blue-300"
                                    >
                                        <h2 className="text-md font-semibold text-gray-700 mb-4">
                                            {type.name}
                                        </h2>
                                        
                                        {typeDocuments.length === 0 ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-center h-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                                                    <div className="text-center">
                                                        <span className="text-2xl text-gray-400">📄</span>
                                                        <p className="text-xs text-gray-500 mt-1">No files uploaded</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => triggerAutoUpload(type)}
                                                    className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                                                >
                                                    📁 Select {type.name} Files
                                                </button>
                                                <p className="text-xs text-gray-500 text-center">
                                                    Files will auto-upload when selected
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                                    <div className="flex items-center space-x-3">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                                                        </svg>
                                                        <div>
                                                            <h3 className="font-bold text-gray-800 text-sm">
                                                                {typeDocuments.length} File{typeDocuments.length !== 1 ? 's' : ''} Uploaded
                                                            </h3>
                                                            <p className="text-xs text-gray-500">Ready to view or download</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button 
                                                        onClick={() => triggerAutoUpload(type)}
                                                        className="flex-1 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                                                    >
                                                        📁 Add More Files
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            // Show files for this type
                                                            console.log('Manage files for:', type.name, typeDocuments);
                                                        }}
                                                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                                                    >
                                                        Manage
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <Paperclip className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No attachment types configured</p>
                            <p className="text-sm text-gray-400 mt-1">Contact administrator to set up attachment types</p>
                        </div>
                    )}
                    
                    {/* Show uploaded files separately if any exist */}
                    {attachments.length > 0 && (
                        <div className="border-t pt-6">
                            <h4 className="text-lg font-semibold text-gray-800 mb-4">Uploaded Files</h4>
                            <div className="space-y-3">
                                {attachments.map((attachment) => (
                                    <div
                                        key={attachment.id || attachment._id}
                                        className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <span className="text-2xl">{getFileIcon(attachment.file_type)}</span>
                                                <div>
                                                    <h4 className="font-medium text-gray-900">
                                                        {attachment.original_file_name || attachment.file_name}
                                                    </h4>
                                                    <div className="text-sm text-gray-500 space-x-2">
                                                        <span>{attachment.attachment_type_name || 'Unknown Type'}</span>
                                                        <span>•</span>
                                                        <span>{formatFileSize(attachment.file_size)}</span>
                                                        <span>•</span>
                                                        <span>Uploaded by {attachment.created_by_name || 'Unknown'}</span>
                                                        {attachment.is_password_protected && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-orange-600 font-medium">🔒 Password Protected</span>
                                                            </>
                                                        )}
                                                        {attachment.description && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-blue-600">{attachment.description}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    icon={<Download className="w-4 h-4" />}
                                                    onClick={() => handleDownload(attachment)}
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    Download
                                                </Button>
                                                <Button
                                                    icon={<Eye className="w-4 h-4" />}
                                                    onClick={() => window.open(`/api/hrms/employees/${employeeId}/attachments/${attachment.id || attachment._id}/view?user_id=${userData._id}`, '_blank')}
                                                    className="text-green-600 hover:text-green-700"
                                                >
                                                    View
                                                </Button>
                                                <Button
                                                    icon={<Trash2 className="w-4 h-4" />}
                                                    onClick={() => handleDelete(attachment)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmployeeAttachments;
