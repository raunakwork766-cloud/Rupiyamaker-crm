import React, { useState, useEffect } from 'react';
import {
    Paperclip, Upload, Download, Eye, Trash2, Calendar, Lock,
    Archive, FileText, CreditCard, MapPin, Zap, DollarSign, Plus
} from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

export default function AttachmentsSection({ leadId, userId, formatDate }) {
    const [attachments, setAttachments] = useState([]);
    const [attachmentTypes, setAttachmentTypes] = useState([]);
    const [historicalAttachmentTypes, setHistoricalAttachmentTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloadingZip, setIsDownloadingZip] = useState(false);

    // Document fields with their respective states
    const [documentFields, setDocumentFields] = useState({
        cibil_report: { files: [], password: '' },
        passport_size_photo: { files: [], password: '' },
        pan_card: { files: [], password: '' },
        aadhar_card: { files: [], password: '' },
        three_months_salary_slip: { files: [], password: '' },
        salary_account_banking: { files: [], password: '' },
        bt_loan_documents: { files: [], password: '' },
        credit_card_statement: { files: [], password: '' },
        electricity_bill: { files: [], password: '' },
        form_16_26as: { files: [], password: '' },
        other_documents: { files: [], password: '' },
        next_image: { files: [], password: '' }
    });

    // Document field configurations
    const documentConfig = [
        {
            key: 'cibil_report',
            label: 'CIBIL Report',
            icon: FileText,
            description: 'Credit Information Bureau Report'
        },
        {
            key: 'passport_size_photo',
            label: 'Passport Size Photo',
            icon: Eye,
            description: 'Recent passport size photograph'
        },
        {
            key: 'pan_card',
            label: 'PAN Card',
            icon: CreditCard,
            description: 'Permanent Account Number card'
        },
        {
            key: 'aadhar_card',
            label: 'Aadhar Card',
            icon: CreditCard,
            description: 'Unique Identification Authority of India'
        },
        {
            key: 'three_months_salary_slip',
            label: '3 Months Salary Slip',
            icon: DollarSign,
            description: 'Latest 3 months salary slips'
        },
        {
            key: 'salary_account_banking',
            label: 'Salary Account Banking',
            icon: DollarSign,
            description: 'Salary account bank statements'
        },
        {
            key: 'bt_loan_documents',
            label: 'BT Loan Documents',
            icon: FileText,
            description: 'Balance Transfer loan documents'
        },
        {
            key: 'credit_card_statement',
            label: 'Credit Card Statement',
            icon: CreditCard,
            description: 'Latest credit card statements'
        },
        {
            key: 'electricity_bill',
            label: 'Electricity Bill',
            icon: Zap,
            description: 'Latest electricity bill for address proof'
        },
        {
            key: 'form_16_26as',
            label: 'Form 16 & 26AS',
            icon: FileText,
            description: 'Income tax forms and certificates'
        },
        {
            key: 'other_documents',
            label: 'Other Documents',
            icon: Paperclip,
            description: 'Additional supporting documents'
        },
        {
            key: 'next_image',
            label: 'Next Image',
            icon: Eye,
            description: 'Additional images or photos'
        }
    ];

    // Load attachment types
    useEffect(() => {
        const fetchAttachmentTypes = async () => {
            try {
                // Fetch active attachment types
                const activeResponse = await fetch(`${API_BASE_URL}/settings/attachment-types?user_id=${userId}&target_type=leads`);
                if (activeResponse.ok) {
                    const activeTypes = await activeResponse.json();
                    setAttachmentTypes(activeTypes);
                    console.log('Active attachment types loaded:', activeTypes.length);
                } else {
                    console.error('Failed to load active attachment types');
                }
                
                // Fetch all attachment types including historical/deleted ones
                const allTypesResponse = await fetch(`${API_BASE_URL}/settings/all-attachment-types?user_id=${userId}&target_type=leads`);
                if (allTypesResponse.ok) {
                    const allTypes = await allTypesResponse.json();
                    setHistoricalAttachmentTypes(allTypes);
                    console.log('All attachment types loaded (including historical):', allTypes.length);
                    
                    // Log deleted types for debugging
                    const deletedTypes = allTypes.filter(t => !t.is_active);
                    if (deletedTypes.length > 0) {
                        console.log(`Found ${deletedTypes.length} deleted attachment types:`, 
                            deletedTypes.map(t => t.name));
                    }
                } else {
                    console.error('Failed to load historical attachment types');
                }
            } catch (error) {
                console.error('Error loading attachment types:', error);
                setError('Failed to load document types');
            }
        };
        
        if (userId) {
            fetchAttachmentTypes();
        }
    }, [userId]);

    useEffect(() => {
        loadAttachments();
    }, [leadId]);

    const loadAttachments = async () => {
        try {
            setIsLoading(true);
            setError('');
            // Use /documents endpoint to get all documents for the lead
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/documents?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                const attachmentsArray = Array.isArray(data) ? data : [];
                setAttachments(attachmentsArray);

                // Organize attachments by document type - reset first to avoid duplicates
                const organizedDocs = { ...documentFields };
                // Clear existing files to prevent duplicates
                Object.keys(organizedDocs).forEach(key => {
                    organizedDocs[key].files = [];
                });
                
                // Extract all unique document types from existing attachments
                const attachmentDocTypes = new Set(attachmentsArray.map(att => att.document_type).filter(Boolean));
                
                // Ensure we have entries for all document types that have files
                // This creates dynamic entries for any document type, including historical ones
                attachmentDocTypes.forEach(docType => {
                    if (docType && !organizedDocs[docType]) {
                        // Find if this is a known historical type
                        const historicalType = historicalAttachmentTypes.find(t => t.name === docType);
                        const isHistoricalType = !attachmentTypes.some(t => t.name === docType);
                        
                        if (historicalType || docType) {
                            // Add this document type to our tracking even if it's been deleted from active types
                            organizedDocs[docType] = { 
                                files: [], 
                                password: '', 
                                isHistorical: isHistoricalType,
                                originalName: historicalType?.display_name || historicalType?.name || docType
                            };
                        }
                    }
                });

                // Add each attachment to the correct document type
                attachmentsArray.forEach(attachment => {
                    const docType = attachment.document_type || 'other_documents';
                    if (organizedDocs[docType]) {
                        // Check if file already exists to prevent duplicates
                        const existingFile = organizedDocs[docType].files.find(
                            file => file._id === attachment._id
                        );
                        if (!existingFile) {
                            // Add has_password flag to attachment if it exists
                            attachment.hasPassword = attachment.password ? true : false;
                            organizedDocs[docType].files.push(attachment);
                        }
                    } else {
                        // Fallback to "other_documents" if attachment type not defined
                        organizedDocs.other_documents.files.push(attachment);
                    }
                });
                
                setDocumentFields(organizedDocs);
            } else {
                throw new Error('Failed to load attachments');
            }
        } catch (error) {
            console.error('Error loading attachments:', error);
            setError('Failed to load attachments');
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-upload files when selected
    const handleFileChange = async (files, documentType) => {
        if (!files || files.length === 0) return;

        try {
            // Get the latest state for this document type's password
            // This is important to ensure we're using the most up-to-date state
            const currentDocFields = { ...documentFields };
            const password = currentDocFields[documentType]?.password || '';

            const formData = new FormData();
            Array.from(files).forEach(file => {
                formData.append('files', file);
            });
            formData.append('document_type', documentType);
            formData.append('category', 'general'); // Required by backend

            // Add password if provided
            console.log(`Document type: ${documentType}`);
            console.log(`Password provided: ${password ? 'Yes' : 'No'}`);

            if (password) {
                console.log('Adding password to form data');
                formData.append('password', password);
            } else {
                console.log('Not adding password - none provided');
            }

            setIsUploading(true);
            setError('');

            // Use /documents endpoint for uploading files
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/documents?user_id=${userId}`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Upload result:', result);

                // Reload attachments to get the updated list (this will prevent duplicates)
                await loadAttachments();

                setSuccess(`${files.length} file(s) uploaded successfully`);
                setTimeout(() => setSuccess(''), 3000);

                // Clear the file input after successful upload
                const fileInput = document.querySelector(`input[type="file"]`);
                if (fileInput) {
                    fileInput.value = '';
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                throw new Error(errorData.error || 'Failed to upload files');
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            setError(`Failed to upload files: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    // Download all files as ZIP
    const downloadAllAsZip = async () => {
        try {
            setIsDownloadingZip(true);
            setError(''); // Clear any previous errors

            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/attachments/download-zip?user_id=${userId}`, {
                method: 'GET',
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');

                console.log('ZIP download response:', {
                    contentType,
                    contentLength,
                    status: response.status
                });

                if (contentType && contentType.includes('application/zip')) {
                    const blob = await response.blob();

                    if (blob.size > 0) {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `lead_${leadId}_documents.zip`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                        setSuccess('ZIP file downloaded successfully');
                        setTimeout(() => setSuccess(''), 3000);
                    } else {
                        throw new Error('Downloaded ZIP file is empty');
                    }
                } else {
                    // If it's not a ZIP file, it might be an error response
                    const errorText = await response.text();
                    console.error('Unexpected response type:', errorText);
                    throw new Error('Received invalid file type instead of ZIP');
                }
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `HTTP ${response.status}: Failed to download ZIP`);
            }
        } catch (error) {
            console.error('Error downloading ZIP:', error);
            setError(`Failed to download ZIP file: ${error.message}`);
        } finally {
            setIsDownloadingZip(false);
        }
    };

    // Update password for a document type
    const updatePassword = (documentType, password) => {
        console.log(`Updating password for ${documentType} to: ${password ? '***' : 'empty'}`);

        // Use functional state update to ensure we're working with the latest state
        setDocumentFields(prev => {
            const updatedFields = {
                ...prev,
                [documentType]: {
                    ...prev[documentType],
                    password
                }
            };

            // Log the updated state (without showing the actual password in logs)
            console.log(`New state for ${documentType}: password ${password ? 'set' : 'cleared'}`);
            return updatedFields;
        });
    };

    // View file function
    const viewFile = async (attachment) => {
        try {
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/attachments/${attachment._id}/view?user_id=${userId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error('Failed to view file');
            }
        } catch (error) {
            console.error('Error viewing file:', error);
            setError('Failed to view file');
        }
    };

    // Download individual file
    const downloadFile = async (attachment) => {
        try {
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/attachments/${attachment._id}/download?user_id=${userId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = attachment.filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error('Failed to download file');
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            setError('Failed to download file');
        }
    };

    // Delete attachment function
    const deleteAttachment = async (attachmentId, documentType) => {
        if (!confirm('Are you sure you want to delete this attachment?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/attachments/${attachmentId}?user_id=${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setAttachments(prev => prev.filter(att => att._id !== attachmentId));

                // Update document fields
                setDocumentFields(prev => ({
                    ...prev,
                    [documentType]: {
                        ...prev[documentType],
                        files: prev[documentType].files.filter(file => file._id !== attachmentId)
                    }
                }));

                setSuccess('Attachment deleted successfully');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                throw new Error('Failed to delete attachment');
            }
        } catch (error) {
            console.error('Error deleting attachment:', error);
            setError('Failed to delete attachment');
        }
    };
    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (filename) => {
        if (!filename) return '📎';
        const extension = filename.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf':
                return '📄';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return '🖼️';
            case 'doc':
            case 'docx':
                return '📝';
            case 'xls':
            case 'xlsx':
                return '📊';
            default:
                return '📎';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 bg-white p-2">
            {/* Header with Download All Option */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white flex items-center">
                    <Paperclip className="w-6 h-6 mr-2" />
                    Documents & Attachments
                </h3>
                <button
                    onClick={downloadAllAsZip}
                    disabled={attachments.length === 0 || isDownloadingZip}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                >
                    <Archive className="w-4 h-4 mr-2" />
                    {isDownloadingZip ? 'Downloading...' : 'Download All as ZIP'}
                </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Document Upload Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(documentFields).map((key) => {
                    // Find the matching config, or create a generic one for historical types
                    const config = documentConfig.find(c => c.key === key) || {
                        key,
                        label: documentFields[key].originalName || key,
                        icon: Archive,
                        description: 'Historical document type'
                    };
                    
                    const Icon = config.icon;
                    const fieldData = documentFields[key];
                    
                    // Skip if it's not a predefined type and has no files
                    if (!documentConfig.some(c => c.key === key) && (!fieldData.files || fieldData.files.length === 0)) {
                        return null;
                    }

                    return (
                        <div key={key} className="bg-white p-4 rounded-lg border border-gray-700">
                            {/* Document Header */}
                            <div className="flex items-center mb-3">
                                <div className="flex items-center">
                                    <Icon className="w-5 h-5 text-blue-400 mr-2" />
                                    <h4 className="font-semibold text-black text-lg">
                                        {config.label}
                                        {fieldData.isHistorical && (
                                            <span className="ml-2 text-xs font-normal px-2 py-1 bg-yellow-700 text-white rounded-full">
                                                Deleted Type
                                            </span>
                                        )}
                                    </h4>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 mb-3">
                                {fieldData.isHistorical 
                                    ? 'This document type has been deleted but files still exist'
                                    : config.description}
                            </p>
                            
                            {/* Password Field for each document type */}
                            <div className="mb-3 flex items-center">
                                <Lock className="w-4 h-4 text-yellow-400 mr-2" />
                                <input
                                    type="password"
                                    value={fieldData.password || ''}
                                    onChange={(e) => updatePassword(config.key, e.target.value)}
                                    placeholder="Password protection (optional)"
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            
                            {/* File Input */}
                            <div className="mb-3">
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => handleFileChange(e.target.files, config.key)}
                                    className="w-full bg-gray-500 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                />
                            </div>

                            {/* Uploaded Files List */}
                            <div className="space-y-2">
                                {fieldData.files.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400 text-sm">
                                        <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>No files uploaded</p>
                                    </div>
                                ) : (
                                    fieldData.files.map((file) => (
                                        <div key={file._id || file.id || Math.random()} className="bg-gray-700 p-2 rounded border border-gray-600">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <span className="text-lg">{getFileIcon(file.filename)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white truncate">
                                                            {file.filename || 'Unknown file'}
                                                            {file.hasPassword && (
                                                                <Lock className="w-3 h-3 text-yellow-400 inline ml-1" />
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {formatFileSize(file.size)} • {file.uploaded_at && formatDate ? formatDate(file.uploaded_at) : 'Unknown date'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* File Actions */}
                                                <div className="flex space-x-1">
                                                    <button
                                                        onClick={() => viewFile(file)}
                                                        className="text-blue-400 hover:text-blue-300 p-1"
                                                        title="View file"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => downloadFile(file)}
                                                        className="text-green-400 hover:text-green-300 p-1"
                                                        title="Download file"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteAttachment(file._id, key)}
                                                        className="text-red-400 hover:text-red-300 p-1"
                                                        title="Delete file"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Upload Status */}
            {isUploading && (
                <div className="bg-blue-900/50 border border-blue-500 text-blue-200 px-4 py-3 rounded-lg flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-3"></div>
                    Uploading files...
                </div>
            )}
        </div>
    );
}
