// Fix for Status Management Tab issue
import React, { useState, useEffect, useRef } from 'react';
import useTabWithHistory from '../hooks/useTabWithHistory';
import {
    Settings,
    Plus,
    Edit,
    Trash2,
    Upload,
    Search,
    Building,
    CreditCard,
    Code,
    Users,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    X,
    Shield,
    Lock,
    Paperclip,
    Clock,
    Save,
    Award,
    ChevronDown,
    ChevronUp,
    GripVertical,
    Menu,
    Mail,
    HelpCircle,
    Bell
} from 'lucide-react';
import axios from 'axios';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

import { 
  getUserPermissions, 
  isSuperAdmin, 
  hasPermission,
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId 
} from '../utils/permissions';
import StatusManagementTab from './StatusManagementTab';
import AttendanceSettingsTab from './attendance/AttendanceSettingsTab';
import DesignationManagement from './DesignationManagement';
import DepartmentSettings from './settings/DepartmentSettings';
import RoleSettings from './settings/RoleSettings';
import DesignationSettings from './settings/DesignationSettings';
import PopupModalSettings from './settings/PopupModalSettings';
import { hrmsService } from '../services/hrmsService';

// Tab Management Dropdown Component
const TabManageDropdown = ({ tabs, activeTab, setActiveTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Filter to show only the main tabs that go in the dropdown: campaigns, dataCodes, bankNames, channelNames, companyData, statuses, importantQuestions
    const manageTabs = tabs.filter(tab => 
        ['campaigns', 'dataCodes', 'bankNames', 'channelNames', 'companyData', 'statuses', 'importantQuestions'].includes(tab.id)
    );
    
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    const isManageTabActive = ['campaigns', 'dataCodes', 'bankNames', 'channelNames', 'companyData', 'statuses', 'importantQuestions'].includes(activeTab);
    
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isManageTabActive
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white text-black hover:bg-black hover:text-white border border-black'
                }`}
            >
                <Menu size={16} />
                <span>Dropdown Management</span>
                <ChevronDown 
                    size={16} 
                    className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>
            
            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="p-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 py-2 mb-1">
                            Data Management
                        </div>
                        
                        {/* Data Management Tabs */}
                        {manageTabs
                            .filter(tab => ['campaigns', 'dataCodes', 'bankNames', 'channelNames', 'companyData'].includes(tab.id))
                            .map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                                        activeTab === tab.id 
                                            ? 'bg-blue-600 text-white' 
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    <tab.icon size={16} className="text-blue-400" />
                                    <span className="text-sm font-medium">{tab.label}</span>
                                </button>
                            ))}
                        
                        <hr className="border-gray-700 my-2" />
                        
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 py-2 mb-1">
                            System Management
                        </div>
                        
                        {/* System Management Tabs */}
                        {manageTabs
                            .filter(tab => ['statuses', 'importantQuestions'].includes(tab.id))
                            .map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                                        activeTab === tab.id 
                                            ? 'bg-blue-600 text-white' 
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    <tab.icon size={16} className="text-blue-400" />
                                    <span className="text-sm font-medium">{tab.label}</span>
                                </button>
                            ))}
                    </div>
                </div>
            )}
            
            {/* Click outside to close */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

// Core Management Dropdown Component
const CoreManageDropdown = ({ tabs, activeTab, setActiveTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Filter to show only the core management tabs: departments, designations, roles, emailSettings, adminEmails
    const coreManageTabs = tabs.filter(tab => 
        ['departments', 'designations', 'roles', 'emailSettings', 'adminEmails'].includes(tab.id)
    );
    
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    const isCoreManageTabActive = ['departments', 'designations', 'roles', 'emailSettings', 'adminEmails'].includes(activeTab);
    
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isCoreManageTabActive
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'bg-white text-black hover:bg-black hover:text-white border border-black'
                }`}
            >
                <Building size={16} />
                <span>Core Management</span>
                <ChevronDown 
                    size={16} 
                    className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>
            
            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="p-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 py-2 mb-1">
                            Organizational Structure
                        </div>
                        
                        {/* Core Management Tabs */}
                        {coreManageTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                                    activeTab === tab.id 
                                        ? 'bg-green-600 text-white' 
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                <tab.icon size={16} className="text-green-400" />
                                <span className="text-sm font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Click outside to close */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

// Other Management Dropdown Component
const OtherManageDropdown = ({ tabs, activeTab, setActiveTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Filter to show only the other management tabs: attachmentTypes, excelUpload, attendance
    const otherManageTabs = tabs.filter(tab => 
        ['attachmentTypes', 'excelUpload', 'attendance', 'popupModals'].includes(tab.id)
    );
    
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    const isOtherManageTabActive = ['attachmentTypes', 'excelUpload', 'attendance', 'popupModals'].includes(activeTab);
    
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isOtherManageTabActive
                        ? 'bg-purple-500 text-white shadow-lg'
                        : 'bg-white text-black hover:bg-black hover:text-white border border-black'
                }`}
            >
                <Settings size={16} />
                <span>Other</span>
                <ChevronDown 
                    size={16} 
                    className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>
            
            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="p-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 py-2 mb-1">
                            Additional Settings
                        </div>
                        
                        {/* Other Management Tabs */}
                        {otherManageTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                                    activeTab === tab.id 
                                        ? 'bg-purple-600 text-white' 
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                <tab.icon size={16} className="text-purple-400" />
                                <span className="text-sm font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Click outside to close */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

const SettingsPage = () => {
    // State management
    const [activeTab, setActiveTab] = useTabWithHistory('section', 'campaigns', { localStorageKey: 'settingsPageTab' });
    const [loading, setLoading] = useState(false);
    const [user_id] = useState(localStorage.getItem('userId') || '');
    const [userPermissions, setUserPermissions] = useState({});
    const [hasSettingsAccess, setHasSettingsAccess] = useState(false);
    const [error, setError] = useState(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);

    // Data states
    const [campaignNames, setCampaignNames] = useState([]);
    const [dataCodes, setDataCodes] = useState([]);
    const [bankNames, setBankNames] = useState([]);
    const [channelNames, setChannelNames] = useState([]);
    const [companyData, setCompanyData] = useState([]);
    const [attachmentTypes, setAttachmentTypes] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [roles, setRoles] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [emailSettings, setEmailSettings] = useState([]);
    const [adminEmails, setAdminEmails] = useState([]);
    const [importantQuestions, setImportantQuestions] = useState([]);
    const [mistakeTypes, setMistakeTypes] = useState([]);
    const [warningActions, setWarningActions] = useState([]);
    const [warningTypes, setWarningTypes] = useState([]);
    
    // Attachment type filter and delete state
    const [attachmentTypeFilter, setAttachmentTypeFilter] = useState('leads');
    const [deletingItems, setDeletingItems] = useState(new Set());
    // Attachment type drag-reorder & inline-edit state
    const [atDragIdx, setAtDragIdx]           = useState(null);
    const [atDragOverIdx, setAtDragOverIdx]   = useState(null);
    const [atInlineEditing, setAtInlineEditing] = useState(null); // { id, value }
    const [atQuickAddName, setAtQuickAddName] = useState('');
    const [atQuickAddTarget, setAtQuickAddTarget] = useState('leads');
    // Category-based settings UI (matching premium_document_upload.html settings popup)
    const [atDraftCategories, setAtDraftCategories] = useState([]);
    const atDraftCategoriesRef = useRef([]); // always up-to-date ref for async callbacks
    const [atCatCollapsed, setAtCatCollapsed] = useState({});
    const [atDraftDirty, setAtDraftDirty] = useState(false);
    const [atSaving, setAtSaving] = useState(false);
    const pendingDraftRef = useRef(null); // queued draft when a save is already in-flight
    const [atNewCatInput, setAtNewCatInput] = useState('');
    const [atNewDocInputs, setAtNewDocInputs] = useState({});
    const [atNewDocTargets, setAtNewDocTargets] = useState({});
    const [atCatDragIdx, setAtCatDragIdx] = useState(null);
    const [atCatDragOverIdx, setAtCatDragOverIdx] = useState(null);
    const [atDocDrag, setAtDocDrag] = useState(null);
    const [atDocDragOver, setAtDocDragOver] = useState(null);
    const [atDraftKey, setAtDraftKey] = useState(0);
    const [atDescPopover, setAtDescPopover] = useState(null); // 'catIdx-docIdx'
    const [attendanceSettings, setAttendanceSettings] = useState({
        check_in_time: '10:00',
        check_out_time: '19:00',
        required_working_hours: 8.0,
        late_check_in_threshold: '10:30',
        early_check_out_threshold: '18:30',
        geo_location_required: true,
        photo_required: true,
        working_days: [0, 1, 2, 3, 4, 5], // Monday to Saturday
        half_day_rules: {
            late_check_in: true,
            early_check_out: true,
            insufficient_hours: true
        },
        attendance_editable_by_admin: true,
        date_time_format: 'DD MMMM YYYY, HH:mm'
    });

    // Status management states
    const [selectedDepartment, setSelectedDepartment] = useState('leads');
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showSubStatusModal, setShowSubStatusModal] = useState(false);
    const [statusModalType, setStatusModalType] = useState('add');
    const [subStatusModalType, setSubStatusModalType] = useState('add');

    // States for editing and modals
    const [editingStatus, setEditingStatus] = useState(null);
    const [editingSubStatus, setEditingSubStatus] = useState(null);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState(''); // 'add' or 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    
    // Custom dropdown states for department selection in designation modal
    const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
    const [selectedModalDepartment, setSelectedModalDepartment] = useState(null);
    const [expandedDepartments, setExpandedDepartments] = useState(new Set());
    const [showingSubDepartments, setShowingSubDepartments] = useState(false);
    
    // Permission states for roles
    const [selectedPermissions, setSelectedPermissions] = useState({});
    const [permissionType, setPermissionType] = useState('no_permission');
    
    // State to track which permission sections are expanded/collapsed (default all collapsed)
    const [expandedPermissionSections, setExpandedPermissionSections] = useState({
        // Explicitly set all sections to false to ensure they're closed
        'Global': false,
        'Feeds': false,
        'Tasks': false,
        'Attendance': false,
        'Tickets': false,
        'Leads': false,
        'Leaves': false,
        'Admin': false,
        'Employees': false
    });
    
    // Simplified permission structure with only show, own, junior, all
    const allPermissions = {
      'Global': ['show', 'all'],
      'Feeds': ['show', 'own', 'junior', 'all'],
      'Leads': ['show', 'own', 'junior', 'all', 'assign'],
      'Login': ['show', 'own', 'junior', 'all'],
      'Tasks': ['show', 'own', 'junior', 'all'],
      'Tickets': ['show', 'own', 'junior', 'all'],
      'HRMS Employees': ['show', 'own', 'junior', 'all'],
      'Leaves': ['show', 'own', 'junior', 'all'],
      'Attendance': ['show', 'own', 'junior', 'all'],
      'Warnings': ['show', 'own', 'junior', 'all'],
      'Users': ['show', 'own', 'junior', 'all'],
      'Charts': ['show', 'own', 'junior', 'all'],
      'Apps': ['show', 'own', 'junior', 'all'],
      'Settings': ['show', 'own', 'junior', 'all'],
      'Interview Panel': ['show'],
      'Reports': ['show']
    };
    
    // Permission descriptions for UI
    const permissionDescriptions = {
      'show': '👁️ Show - Can see the module in navigation menu',
      'own': '👤 Own Only - Can only manage their own records',
      'junior': '🔸 Manager Level - Can manage subordinate records + own',
      'all': '🔑 Admin Level - Can manage all records'
    };

    // Company data pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalCompanies, setTotalCompanies] = useState(0);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

    // Search and file upload states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeUploads, setActiveUploads] = useState(new Map());

    // Bank filter states
    const [availableBanks, setAvailableBanks] = useState([]);
    const [bankStats, setBankStats] = useState([]); // [{bank_name, count, last_updated}]
    const [selectedBankFilter, setSelectedBankFilter] = useState('');
    const [showBankDeleteModal, setShowBankDeleteModal] = useState(false);
    const [bankToDelete, setBankToDelete] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankSearchQuery, setBankSearchQuery] = useState('');
    // Inline Excel upload in Company Data tab
    const [showInlineUpload, setShowInlineUpload] = useState(false);

    const BASE_URL = API_BASE_URL;
    
    
    // Permission handling functions
    const handlePermissionChange = (page, action, isChecked) => {
        setSelectedPermissions(prev => {
            const newPermissions = { ...prev };
            if (!newPermissions[page]) {
                newPermissions[page] = [];
            }
            
            // Ensure newPermissions[page] is an array
            if (!Array.isArray(newPermissions[page])) {
                newPermissions[page] = [];
            }
            
            if (isChecked) {
                if (!newPermissions[page].includes(action)) {
                    newPermissions[page] = [...newPermissions[page], action];
                }
            } else {
                newPermissions[page] = newPermissions[page].filter(a => a !== action);
                if (newPermissions[page].length === 0) {
                    delete newPermissions[page];
                }
            }
            
            return newPermissions;
        });
    };

    const handlePageWildcard = (page, isChecked) => {
        setSelectedPermissions(prev => {
            const newPermissions = { ...prev };
            if (isChecked) {
                newPermissions[page] = ['*'];
            } else {
                delete newPermissions[page];
            }
            return newPermissions;
        });
    };

    const isPermissionChecked = (page, action) => {
        return selectedPermissions[page] && 
            Array.isArray(selectedPermissions[page]) && 
            selectedPermissions[page].includes(action);
    };

    const isPageWildcard = (page) => {
        return selectedPermissions[page] && 
            Array.isArray(selectedPermissions[page]) && 
            selectedPermissions[page].includes('*');
    };

    // Function to toggle permission section expansion
    const togglePermissionSection = (sectionName) => {
        setExpandedPermissionSections(prev => {
            const newState = {
                ...prev,
                [sectionName]: !prev[sectionName]
            };
            
            // Auto-scroll to show expanded section content
            if (!prev[sectionName] && sectionName) {
                setTimeout(() => {
                    // Find the scrollable content container in the roles modal
                    const scrollContainer = document.querySelector('.fixed.inset-0 .flex-1.overflow-y-auto');
                    const sectionElement = document.querySelector(`[data-section="${sectionName}"]`);
                    
                    if (scrollContainer && sectionElement) {
                        // Calculate the position to scroll to show the section properly
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const sectionRect = sectionElement.getBoundingClientRect();
                        const scrollTop = scrollContainer.scrollTop;
                        
                        // Calculate target scroll position (section position relative to container)
                        const targetScrollTop = scrollTop + sectionRect.top - containerRect.top - 50; // 50px offset from top
                        
                        scrollContainer.scrollTo({
                            top: targetScrollTop,
                            behavior: 'smooth'
                        });
                        
                        // Add additional scroll after expansion animation
                        setTimeout(() => {
                            scrollContainer.scrollBy({
                                top: 200, // Additional scroll to show expanded content
                                behavior: 'smooth'
                            });
                        }, 300);
                    }
                }, 100);
            }
            
            return newState;
        });
    };

    // Function to close modal and reset states
    const handleCloseModal = () => {
        setShowModal(false);
        // Reset activeTab to warningData when closing modal
        if (activeTab === 'mistakeType' || activeTab === 'warningAction') {
            setActiveTab('warningData');
        }
        // Reset department dropdown states
        setShowDepartmentDropdown(false);
        setSelectedModalDepartment(null);
        setExpandedDepartments(new Set());
        setShowingSubDepartments(false);
        // Explicitly close all sections
        setExpandedPermissionSections({
            'Global': false,
            'Feeds': false,
            'Tasks': false,
            'Attendance': false,
            'Tickets': false,
            'Leads': false,
            'Leaves': false,
            'Admin': false,
            'Employees': false
        });
        setFormData({});
        setEditingItem(null);
        // Force sections closed with timeout
        setTimeout(() => setExpandedPermissionSections({
            'Global': false,
            'Feeds': false,
            'Tasks': false,
            'Attendance': false,
            'Tickets': false,
            'Leads': false,
            'Leaves': false,
            'Admin': false,
            'Employees': false
        }), 50);
    };

    // Tab configuration
    const tabs = [
        { id: 'campaigns', label: 'Campaign Names', icon: Users, color: 'blue' },
        { id: 'dataCodes', label: 'Data Codes', icon: Code, color: 'green' },
        { id: 'bankNames', label: 'Bank Names', icon: CreditCard, color: 'purple' },
        { id: 'channelNames', label: 'Channel Names', icon: Building, color: 'amber' },
        { id: 'companyData', label: 'Company Data', icon: Building, color: 'orange' },
        { id: 'attachmentTypes', label: 'Attachment Types', icon: Paperclip, color: 'pink' },
        { id: 'excelUpload', label: 'Company Data Excel', icon: FileSpreadsheet, color: 'red' },
        { id: 'departments', label: 'Departments', icon: Building, color: 'cyan' },
        { id: 'designations', label: 'Designations', icon: Award, color: 'rose' },
        { id: 'roles', label: 'Roles & Permissions', icon: Users, color: 'indigo' },
        { id: 'emailSettings', label: 'Email Settings', icon: Mail, color: 'emerald' },
        { id: 'adminEmails', label: 'Admin Emails', icon: Shield, color: 'red' },
        { id: 'statuses', label: 'Status Management', icon: CheckCircle, color: 'teal' },
        { id: 'attendance', label: 'Attendance Settings', icon: Clock, color: 'emerald' },
        { id: 'popupModals', label: 'Popup Modal Alerts', icon: Bell, color: 'violet' },
        { id: 'importantQuestions', label: 'Important Questions', icon: HelpCircle, color: 'violet' }
    ];

    // Helper functions for department hierarchy
    const getParentDepartments = () => {
        return departments.filter(dept => !dept.parent_id);
    };

    const getSubDepartments = (parentId) => {
        return departments.filter(dept => 
            (dept.parent_id === parentId) || 
            (typeof dept.parent_id === 'object' && dept.parent_id && (dept.parent_id._id === parentId || dept.parent_id.id === parentId))
        );
    };

    const hasSubDepartments = (departmentId) => {
        return getSubDepartments(departmentId).length > 0;
    };

    const getDepartmentById = (departmentId) => {
        return departments.find(dept => (dept._id || dept.id) === departmentId);
    };

    // Filter attachment types by target type
    const getFilteredAttachmentTypes = () => {
        if (!attachmentTypeFilter) return attachmentTypes;
        return attachmentTypes.filter(item => 
            item.target_type === attachmentTypeFilter
        );
    };

    // Same category definitions as Attachments.jsx (leads tab)
    const ATTACHMENT_DOCUMENT_CATEGORIES = [
        { id: 'kyc',        title: 'PERSONAL IDENTIFICATION (KYC)',  keywords: ['cibil', 'pan', 'aadhaar', 'aadhar', 'voter', 'driving licen', 'passport', 'kyc', 'id proof', 'identity'] },
        { id: 'employment', title: 'EMPLOYMENT PROOFS',              keywords: ['salary slip', 'offer letter', 'employment', 'form 16', 'appointment letter', 'experience letter', 'increment'] },
        { id: 'financial',  title: 'FINANCIAL STATEMENTS',           keywords: ['bank statement', 'itr', 'income tax', 'financial', 'account statement'] },
    ];

    // Build category-based draft structure from flat attachment types list
    // Falls back to keyword matching (same as Attachments.jsx leads tab) when category field is empty
    const buildDraftCategories = (types) => {
        if (!types || types.length === 0) return [];
        const catMap = new Map();
        // Pre-populate standard categories in the correct order
        ATTACHMENT_DOCUMENT_CATEGORIES.forEach(c => catMap.set(c.title, []));

        const sorted = [...types].sort((a, b) => (a.sort_number || 999) - (b.sort_number || 999));
        sorted.forEach(t => {
            let cat = (t.category || '').trim().toUpperCase();
            if (!cat) {
                // Keyword fallback — same logic as leads Attachments.jsx
                const lname = t.name.toLowerCase();
                const matched = ATTACHMENT_DOCUMENT_CATEGORIES.find(c =>
                    c.keywords.some(kw => lname.includes(kw))
                );
                cat = matched ? matched.title : 'OTHER DOCUMENTS';
            }
            if (!catMap.has(cat)) catMap.set(cat, []);
            catMap.get(cat).push({ ...t });
        });

        // Drop empty standard-category buckets
        return [...catMap.entries()]
            .filter(([, docs]) => docs.length > 0)
            .map(([title, docs]) => ({ title, docs }));
    };

    // Complete permissions structure (updated with lowercase keys)
    const PERMISSION_STRUCTURE = {
        'global': {
            'show': 'Section visibility in menu (not visible without this unless user is admin)',
            'wildcard': 'Full system access (*) - Super admin rights'
        },
        'feeds': {
            'show': 'Displays the Feeds section in the menu',
            'feeds': 'Allows viewing posts only (post creation option not shown)',
            'post': 'Grants access to the post creation component',
            'wildcard': 'Allows deletion of any post or comment (*)'
        },
        'leads': {
            'show': 'Displays the Lead section in the menu',
            'create': 'Grants access to create new leads',
            'assign': 'Admin-level access to the reassignment section',
            'own': 'View only leads created or owned by the user',
            'view_other': 'View leads where user is listed under assign_report_to',
            'all': 'View all leads in the system',
            'junior': 'View leads assigned to junior users',
            'wildcard': 'Full access to all lead features (*)'
        },
        'login': {
            'show': 'Displays the Login section in the menu',
            'own': 'View only the user\'s login activity',
            'view_other': 'View login activity of users assigned under assign_report_to',
            'all': 'View login activity of all users',
            'junior': 'View login records of junior users',
            'wildcard': 'Full access to all login records (*)'
        },
        'tasks': {
            'show': 'Displays the Tasks section in the menu',
            'create': 'Grants permission to create new tasks',
            'edit_others': 'Allows editing tasks created by others',
            'wildcard': 'Full access to all task features (*)'
        },
        'tickets': {
            'show': 'Displays the Tickets section in the menu',
            'own': 'View only tickets raised by the user',
            'junior': 'View tickets raised by other users',
            'wildcard': 'Full access to all ticket features (*)'
        },
        'hrms': {
            'show': 'Displays the HRMS section in the menu',
            'wildcard': 'Full access to all HRMS features (*)'
        },
        'employees': {
            'employees_show': 'View the employee list',
            'employees_edit': 'Edit employee information',
            'employees_create': 'Add new employees',
            'employees_delete': 'Delete employees (recommended only for admin roles)',
            'all_employees': 'Full view/edit/delete permissions for all employees',
            'wildcard': 'Full access to all employee features (*)'
        },
        'leaves': {
            'leaves_show': 'Display the leaves section',
            'leaves_own': 'View only the user leave requests and their status',
            'leave_admin': 'Admin access to manage and approve/reject leave requests',
            'leaves_create': 'Permission to apply for leave',
            'junior': 'View own leave requests + subordinate employees\' leave requests (hierarchical access)',
            'edit': 'Edit and approve all leave requests (full admin access)',
            'wildcard': 'Full access to all leave features (*)'
        },
        'attendance': {
            'attendance_show': 'Display attendance section in the menu',
            'attendance_own': 'View only the user attendance records',
            'attendance_admin': 'Admin access to view or manage attendance of all users',
            'attendance_edit': 'Allows editing of attendance (recommended for HR or admin)',
            'attendance_mark': 'Permission to manually mark attendance',
            'junior': 'View own attendance + subordinate employees\' attendance (hierarchical access)',
            'wildcard': 'Full access to all attendance features (*)'
        },
        'warnings': {
            'show': 'Displays the Warnings section in the menu',
            'warnings_own': 'View only the warnings received by the user',
            'warnings_admin': 'Admin-level access to view all warnings',
            'wildcard': 'Full access to all warning features (*)'
        },
        'charts': {
            'show': 'Displays the Charts section in the menu'
        },
        'apps': {
            'show': 'Displays the Apps section in the menu',
            'wildcard': 'Full access to all apps features (*)'
        },
        'settings': {
            'show': 'Displays the Settings section in the menu',
            'edit': 'Grants access to add, edit, or delete settings',
            'wildcard': 'Full access to all settings features (*)'
        }
    };

    // Check permissions on component mount
    useEffect(() => {
        try {
            // Debug user_id retrieval
            console.log('SettingsPage: User ID from localStorage:', user_id);
            console.log('SettingsPage: All localStorage items:', {
                userId: localStorage.getItem('userId'),
                user_id: localStorage.getItem('user_id'), // Check both variants
                userPermissions: localStorage.getItem('userPermissions'),
                token: localStorage.getItem('token')
            });

            const permissions = getUserPermissions();
            setUserPermissions(permissions);

            // Check if user is super admin or has settings permissions
            const isSuper = isSuperAdmin(permissions);
            const hasSettingsView = hasPermission(permissions, 'settings', 'view') || 
                                   hasPermission(permissions, 'settings', 'show');

            console.log('Settings permission check:', {
                isSuper,
                hasSettingsView,
                permissions,
                user_id,
                userPermissionsRaw: localStorage.getItem('userPermissions')
            });

            setHasSettingsAccess(isSuper || hasSettingsView);
            setPermissionsLoaded(true);
        } catch (error) {
            console.error('Error checking permissions:', error);
            setError('Error loading permissions: ' + error.message);
            // Default to allowing access if there's an error with permissions
            setHasSettingsAccess(true);
            setPermissionsLoaded(true);
        }
    }, []);

    // Close bank dropdown when clicking outside
    useEffect(() => {
        if (!showBankDropdown) return;
        const handler = (e) => {
            if (!e.target.closest('[data-bank-dropdown]')) setShowBankDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showBankDropdown]);

    // Load data on component mount (only if has access)
    useEffect(() => {
        if (hasSettingsAccess) {
            loadAllData();
        }
    }, [hasSettingsAccess]);

    // Load data for active tab
    useEffect(() => {
        switch (activeTab) {
            case 'campaigns':
                loadCampaignNames();
                break;
            case 'dataCodes':
                loadDataCodes();
                break;
            case 'bankNames':
                loadBankNames();
                break;
            case 'companyData':
                setCurrentPage(1); // Reset to first page when switching to this tab
                loadCompanyData(1, itemsPerPage);
                loadAvailableBanks();
                loadBankStats();
                break;
            case 'attachmentTypes':
                loadAttachmentTypes();
                break;
            case 'departments':
                loadDepartments();
                break;
            case 'designations':
                loadDesignations();
                break;
            case 'roles':
                loadRoles();
                break;
            case 'emailSettings':
                loadEmailSettings();
                break;
            case 'adminEmails':
                loadAdminEmails();
                break;
            case 'statuses':
                // Add a check to prevent loading in a loop
                const now = Date.now();
                const lastLoaded = window.lastStatusesLoadedAt || 0;
                if (now - lastLoaded > 5000) { // Only reload if more than 5 seconds passed
                    window.lastStatusesLoadedAt = now;
                    loadStatuses();
                } else {
                    console.log("Skipping status reload - loaded recently");
                }
                break;
            case 'attendance':
                loadAttendanceSettings();
                break;
            case 'importantQuestions':
                loadImportantQuestions();
                break;

        }
    }, [activeTab]);

    // Handle Escape key press to close modal and prevent body scroll
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && showModal) {
                handleCloseModal();
            }
        };

        const handleClickOutside = (event) => {
            // Close department dropdown if clicking outside
            if (showDepartmentDropdown && !event.target.closest('.relative')) {
                setShowDepartmentDropdown(false);
                setSelectedModalDepartment(null);
            }
        };

        if (showModal) {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('click', handleClickOutside);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClickOutside);
            // Restore body scroll when modal is closed
            document.body.style.overflow = 'unset';
        };
    }, [showModal, showDepartmentDropdown]);

    // Handle textarea resizing for important questions
    useEffect(() => {
        if (showModal && modalType && activeTab === 'importantQuestions') {
            setTimeout(() => {
                const textarea = document.querySelector('textarea[placeholder="e.g., Has customer provided all required documents?"]');
                if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = (textarea.scrollHeight) + 'px';
                }
            }, 200);
        }
    }, [showModal, modalType, activeTab]);

    // Enhanced scrolling capability for permissions modal
    useEffect(() => {
        if (showModal && activeTab === 'roles') {
            // The new modal structure handles scrolling automatically
            // No manual intervention needed
        }
    }, [showModal, activeTab, expandedPermissionSections]);

    // API calls
    const loadAllData = async () => {
        await Promise.all([
            loadCampaignNames(),
            loadDataCodes(),
            loadBankNames(),
            loadChannelNames(),
            loadCompanyData(1, 50),
            loadAvailableBanks(),
            loadBankStats(),
            loadAttachmentTypes(),
            loadDepartments(),
            loadDesignations(),
            loadRoles(),
            loadEmailSettings(),
            loadAdminEmails(),
            loadAttendanceSettings(),
            loadStatuses(),
            loadImportantQuestions()
        ]);
    };

    const loadCampaignNames = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/campaign-names?user_id=${user_id}`);
            setCampaignNames(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error loading campaign names:', error);
            setCampaignNames([]);
        }
    };

    const loadDataCodes = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/data-codes?user_id=${user_id}`);
            setDataCodes(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error loading data codes:', error);
            setDataCodes([]);
        }
    };

    const loadBankNames = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/bank-names?user_id=${user_id}`);
            setBankNames(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error loading bank names:', error);
            setBankNames([]);
        }
    };

    const loadChannelNames = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/channel-names?user_id=${user_id}`);
            setChannelNames(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error loading channel names:', error);
            setChannelNames([]);
        }
    };

    const loadCompanyData = async (page = currentPage, perPage = itemsPerPage) => {
        try {
            setIsLoadingCompanies(true);
            const offset = (page - 1) * perPage;
            
            let url = `${BASE_URL}/settings/company-data?user_id=${user_id}&limit=${perPage}&offset=${offset}`;
            if (selectedBankFilter) {
                url += `&bank_name=${encodeURIComponent(selectedBankFilter)}`;
            }
            
            const response = await axios.get(url);
            
            if (response.data && Array.isArray(response.data)) {
                setCompanyData(response.data);
                
                // If this is the first page, get total count for pagination
                if (page === 1 || offset === 0) {
                    // Get total count without pagination
                    let countUrl = `${BASE_URL}/settings/company-data?user_id=${user_id}`;
                    if (selectedBankFilter) {
                        countUrl += `&bank_name=${encodeURIComponent(selectedBankFilter)}`;
                    }
                    const countResponse = await axios.get(countUrl);
                    setTotalCompanies(countResponse.data?.length || 0);
                }
            } else {
                console.warn('Invalid company data response:', response.data);
                setCompanyData([]);
                setTotalCompanies(0);
            }
        } catch (error) {
            console.error('Error loading company data:', error);
            setCompanyData([]);
            setTotalCompanies(0);
        } finally {
            setIsLoadingCompanies(false);
        }
    };

    const loadAvailableBanks = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/banks?user_id=${user_id}`);
            setAvailableBanks(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error loading banks:', error);
            setAvailableBanks([]);
        }
    };

    const loadBankStats = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/banks-stats?user_id=${user_id}`);
            setBankStats(response.data || []);
        } catch (error) {
            console.error('Error loading bank stats:', error);
        }
    };

    const handleBankFilterChange = async (bankName) => {
        setSelectedBankFilter(bankName);
        setCurrentPage(1); // Reset to first page when filtering
        await loadCompanyData(1, itemsPerPage);
    };

    const handleDeleteByBank = async () => {
        if (!bankToDelete) return;

        const deletingBank = bankToDelete;
        // Close modal immediately
        setShowBankDeleteModal(false);
        setBankToDelete('');

        try {
            const response = await axios.delete(`${BASE_URL}/settings/company-data/delete-by-bank/${encodeURIComponent(deletingBank)}?user_id=${user_id}`);

            if (response.data.success) {
                // Optimistically remove from state immediately
                setBankStats(prev => prev.filter(s => s.bank_name !== deletingBank));
                if (selectedBankFilter === deletingBank) {
                    setSelectedBankFilter('');
                }
                setCurrentPage(1);
                // Reload company data (without the deleted bank filter)
                await loadCompanyData(1, itemsPerPage);
                await loadAvailableBanks();
                await loadBankStats();
                alert(`Successfully deleted ${response.data.deleted_count} companies for bank "${deletingBank}"`);
            } else {
                alert(`Delete failed: ${response.data.message}`);
            }
        } catch (error) {
            console.error('Error deleting companies by bank:', error);
            alert('Error deleting companies: ' + (error.response?.data?.detail || error.message));
        }
    };

    const loadAttachmentTypes = async () => {
        try {
            const result = await hrmsService.getAllAttachmentTypes();
            if (result.success) {
                const processedAttachmentTypes = result.data.map(item => {
                    const processedItem = {...item};
                    if (processedItem._id && !processedItem.id) processedItem.id = processedItem._id;
                    else if (processedItem.id && !processedItem._id) processedItem._id = processedItem.id;
                    return processedItem;
                });
                setAttachmentTypes(processedAttachmentTypes);
                const freshDraft = buildDraftCategories(processedAttachmentTypes);
                const freshTitles = new Set(freshDraft.map(c => c.title));
                // Preserve any empty categories (headings with no docs yet) from current draft
                const currentDraft = atDraftCategoriesRef.current || [];
                const emptyCats = currentDraft.filter(c => c.docs.length === 0 && !freshTitles.has(c.title));
                // Also restore empty cats saved to localStorage (survives hard refresh)
                const storedEmpty = (() => { try { return JSON.parse(localStorage.getItem('rupiyame_empty_attachment_cats') || '[]'); } catch { return []; } })();
                const stillStoredEmpty = storedEmpty.filter(t => !freshTitles.has(t));
                // Update localStorage — remove any that now have docs in DB
                localStorage.setItem('rupiyame_empty_attachment_cats', JSON.stringify(stillStoredEmpty));
                const allEmptyTitles = new Set([...emptyCats.map(c => c.title), ...stillStoredEmpty]);
                const mergedEmpty = [...allEmptyTitles].map(t => ({ title: t, docs: [] }));
                const merged = mergedEmpty.length > 0 ? [...freshDraft, ...mergedEmpty] : freshDraft;
                setAtDraftCategories(merged);
                atDraftCategoriesRef.current = merged;
                setAtDraftDirty(false);
            }
        } catch (error) {
            console.error('Error loading attachment types:', error);
        }
    };

    const loadDepartments = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/departments?user_id=${user_id}`);
            const raw = response.data.departments || response.data;
            const departmentsData = Array.isArray(raw) ? raw : [];
            console.log('Loaded departments:', departmentsData);
            setDepartments(departmentsData);
        } catch (error) {
            console.error('Error loading departments:', error);
            setDepartments([]);
        }
    };

    const loadDesignations = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/designations?user_id=${user_id}`);
            const designationsData = response.data.designations || response.data;
            
            // Make sure each designation has both _id and id properties for compatibility
            const processedDesignations = designationsData.map(designation => {
                const normalizedDesignation = {...designation};
                
                // Ensure both _id and id properties exist
                if (normalizedDesignation._id && !normalizedDesignation.id) {
                    normalizedDesignation.id = normalizedDesignation._id;
                } else if (normalizedDesignation.id && !normalizedDesignation._id) {
                    normalizedDesignation._id = normalizedDesignation.id;
                }
                
                return normalizedDesignation;
            });
            
            console.log('Loaded designations:', processedDesignations);
            setDesignations(processedDesignations);
        } catch (error) {
            console.error('Error loading designations:', error);
        }
    };

    const loadRoles = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/roles?user_id=${user_id}`);
            const rolesData = response.data.roles || response.data;
            
            // Make sure each role has both _id and id properties for compatibility
            const processedRoles = rolesData.map(role => {
                const normalizedRole = {...role};
                
                // Ensure both _id and id properties exist
                if (normalizedRole._id && !normalizedRole.id) {
                    normalizedRole.id = normalizedRole._id;
                } else if (normalizedRole.id && !normalizedRole._id) {
                    normalizedRole._id = normalizedRole.id;
                }
                
                console.log('Processed role:', normalizedRole);
                return normalizedRole;
            });
            
            setRoles(processedRoles);
            console.log('Loaded roles:', processedRoles);
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    const loadEmailSettings = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/otp/email-settings?user_id=${user_id}`);
            const emailSettingsData = Array.isArray(response.data) ? response.data : (Array.isArray(response.data?.data) ? response.data.data : []);
            console.log('Loaded email settings:', emailSettingsData);
            setEmailSettings(emailSettingsData);
        } catch (error) {
            console.error('Error loading email settings:', error);
            setEmailSettings([]);
        }
    };

    const loadAdminEmails = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/otp/admin-emails?user_id=${user_id}`);
            const adminEmailsData = Array.isArray(response.data) ? response.data : (Array.isArray(response.data?.data) ? response.data.data : []);
            console.log('Loaded admin emails:', adminEmailsData);
            setAdminEmails(adminEmailsData);
        } catch (error) {
            console.error('Error loading admin emails:', error);
            setAdminEmails([]);
        }
    };

    const loadImportantQuestions = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/important-questions?user_id=${user_id}`);
            const raw = response.data?.questions || response.data;
            const questionsData = Array.isArray(raw) ? raw : [];
            console.log('Loaded important questions:', questionsData);
            setImportantQuestions(questionsData);
        } catch (error) {
            console.error('Error loading important questions:', error);
            setImportantQuestions([]);
        }
    };

    // Mistake types management functions
    const loadMistakeTypes = async () => {
        try {
            console.log('📥 Loading mistake types from API...');
            const response = await axios.get(`${API_BASE_URL}/warnings/mistake-types/list?user_id=${localStorage.getItem('userId')}`);
            const typesData = response.data?.mistake_types || response.data || [];
            console.log('📋 Loaded mistake types (raw):', typesData);
            // Ensure each type has an id field
            const typesWithIds = typesData.map(type => {
                const mappedType = {
                    ...type,
                    id: type.id || type._id
                };
                console.log('Mapped mistake type:', mappedType);
                return mappedType;
            });
            console.log('✅ Setting mistake types state:', typesWithIds);
            setMistakeTypes(typesWithIds);
        } catch (error) {
            console.error('❌ Error loading mistake types:', error);
            setMistakeTypes([]);
        }
    };

    // Warning actions management functions
    const loadWarningActions = async () => {
        try {
            console.log('📥 Loading warning actions from API...');
            const response = await axios.get(`${API_BASE_URL}/warnings/warning-actions/list?user_id=${localStorage.getItem('userId')}`);
            const actionsData = response.data?.warning_actions || response.data || [];
            console.log('📋 Loaded warning actions (raw):', actionsData);
            // Ensure each action has an id field
            const actionsWithIds = actionsData.map(action => {
                const mappedAction = {
                    ...action,
                    id: action.id || action._id
                };
                console.log('Mapped warning action:', mappedAction);
                return mappedAction;
            });
            console.log('✅ Setting warning actions state:', actionsWithIds);
            setWarningActions(actionsWithIds);
        } catch (error) {
            console.error('❌ Error loading warning actions:', error);
            setWarningActions([]);
        }
    };

    // Status management functions
    const loadStatuses = async () => {
        console.log("Loading statuses from: ${BASE_URL}/admin/statuses");

        try {
            const response = await axios.get(`${API_BASE_URL}/leads/admin/statuses?user_id=${localStorage.getItem('user_id')}`);
            const statusesData = response.data;
            
            // Ensure we always set an array
            if (Array.isArray(statusesData)) {
                setStatuses(statusesData);
            } else if (statusesData && Array.isArray(statusesData.statuses)) {
                setStatuses(statusesData.statuses);
            } else if (statusesData && Array.isArray(statusesData.data)) {
                setStatuses(statusesData.data);
            } else {
                console.warn('Unexpected statuses API response structure:', statusesData);
                setStatuses([]);
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
            setStatuses([]);
        }
    };

    const createStatus = async (statusData) => {
        console.log("Creating status with data:", statusData);

        console.log("Creating status with data:", statusData);

        console.log("Creating status:", statusData);

        try {
            const response = await axios.post(`${API_BASE_URL}/leads/admin/statuses?user_id=${user_id}`, statusData);
            if (response.status === 201) {
                await loadStatuses(); // Reload statuses
                return true;
            }
        } catch (error) {
            console.error('Error creating status:', error);
            alert('Failed to create status');
        }
        return false;
    };

const updateStatus = async (statusId, statusData) => {
    console.log("Updating status:", statusId, statusData);

    try {
        // Use the correct user_id from localStorage - same as used in loadStatuses
        const correctUserId = localStorage.getItem('userId');
        
        if (!correctUserId) {
            console.error('Error: No user_id found in localStorage');
            alert('Authentication error: Please log in again');
            return false;
        }
        
        // Use the same URL format as other status calls
        const response = await axios.put(
            `${API_BASE_URL}/leads/admin/statuses/${statusId}?user_id=${correctUserId}`, 
            statusData
        );
        
        if (response.status === 200 || response.status === 201) {
            console.log("Status updated successfully:", response.data);
            await loadStatuses(); // Reload statuses
            return true;
        }
    } catch (error) {
        console.error('Error updating status:', error);
        // More detailed error logging
        if (error.response) {
            console.error('Error response:', {
                status: error.response.status,
                headers: error.response.headers,
                data: error.response.data
            });
        }
        alert(`Failed to update status: ${error.response?.data?.detail || error.message}`);
    }
    return false;
};
    const deleteStatus = async (statusId) => {
        console.log("Deleting status with ID:", statusId);

        console.log("Deleting status with ID:", statusId);

        console.log("Deleting status:", statusId);

        try {
            const response = await axios.delete(`${API_BASE_URL}/leads/admin/statuses/${statusId}?user_id=${localStorage.getItem('user_id')}`);
            if (response.status === 200) {
                await loadStatuses(); // Reload statuses
                return true;
            }
        } catch (error) {
            console.error('Error deleting status:', error);
            alert('Failed to delete status');
        }
        return false;
    };

    const deleteSubStatusFromArray = async (statusId, subStatus, index) => {
        try {
            const status = statuses.find(s => (s._id || s.id) === statusId);
            if (!status) return false;

            // Remove sub-status from array
            const updatedSubStatuses = [...(status.sub_statuses || [])];
            updatedSubStatuses.splice(index, 1);

            // Update the status with new sub-statuses array
            return await updateStatus(statusId, {
                sub_statuses: updatedSubStatuses
            });
        } catch (error) {
            console.error('Error deleting sub-status:', error);
            alert('Failed to delete sub-status');
        }
        return false;
    };

    // Sub-Status CRUD Operations
    const createSubStatus = async (subStatusData) => {
        console.log("Creating sub-status with data:", subStatusData);
        try {
            const response = await axios.post(`${API_BASE_URL}/leads/admin/sub-statuses?user_id=${user_id}`, subStatusData);
            if (response.status === 201) {
                await loadStatuses(); // Reload statuses to get updated sub-statuses
                return true;
            }
        } catch (error) {
            console.error('Error creating sub-status:', error);
            alert('Failed to create sub-status');
        }
        return false;
    };

    const updateSubStatus = async (subStatusId, subStatusData) => {
        console.log("Updating sub-status:", subStatusId, subStatusData);
        try {
            const response = await axios.put(`${API_BASE_URL}/leads/admin/sub-statuses/${subStatusId}?user_id=${user_id}`, subStatusData);
            if (response.status === 200) {
                await loadStatuses(); // Reload statuses to get updated sub-statuses
                return true;
            }
        } catch (error) {
            console.error('Error updating sub-status:', error);
            alert('Failed to update sub-status');
        }
        return false;
    };

    const deleteSubStatus = async (subStatusId) => {
        console.log("Deleting sub-status with ID:", subStatusId);
        try {
            const response = await axios.delete(`${API_BASE_URL}/leads/admin/sub-statuses/${subStatusId}?user_id=${user_id}`);
            if (response.status === 200) {
                await loadStatuses(); // Reload statuses to get updated sub-statuses
                return true;
            }
        } catch (error) {
            console.error('Error deleting sub-status:', error);
            alert('Failed to delete sub-status');
        }
        return false;
    };

    // CRUD operations
    const handleAdd = (type) => {
        setModalType('add');
        setEditingItem(null);
        
        // Update activeTab when adding mistake types or warning actions
        if (type === 'mistakeType' || type === 'warningAction') {
            setActiveTab(type);
        }
        
        // Initialize form data with default values based on type
        if (type === 'attachmentTypes') {
            setFormData({
                name: '',
                target_type: 'employees',
                sort_number: '',
                description: '',
                is_active: true
            });
        } else if (type === 'roles') {
            setFormData({
                name: '',
                department_id: null,
                reporting_ids: []  // Changed from reporting_id to reporting_ids (array)
            });
        } else if (type === 'emailSettings') {
            setFormData({
                email: '',
                password: '',
                smtp_server: 'smtp.gmail.com',
                smtp_port: 587,
                use_ssl: true,
                is_active: true,
                purpose: 'otp'
            });
        } else if (type === 'importantQuestions') {
            setFormData({
                question: '',
                type: 'checkbox',
                mandatory: true,
                is_active: true
            });
        } else if (type === 'mistakeType') {
            setFormData({
                value: '',
                label: '',
                is_active: true
            });
        } else if (type === 'warningAction') {
            setFormData({
                value: '',
                label: '',
                is_active: true
            });
        } else {
            setFormData({});
        }
        
        // Reset permissions when adding a new role
        if (type === 'roles') {
            setSelectedPermissions({});
            setPermissionType('no_permission');
            // Force all sections to be collapsed
            setExpandedPermissionSections({
                'Global': false,
                'Feeds': false,
                'Tasks': false,
                'Attendance': false,
                'Tickets': false,
                'Leads': false,
                'Leaves': false,
                'Admin': false,
                'Employees': false
            });
            setTimeout(() => setExpandedPermissionSections({
                'Global': false,
                'Feeds': false,
                'Tasks': false,
                'Attendance': false,
                'Tickets': false,
                'Leads': false,
                'Leaves': false,
                'Admin': false,
                'Employees': false
            }), 0);
        }
        
        setShowModal(true);
    };

    const handleEdit = (item, type) => {
        // Make a copy of the item to avoid reference issues
        const itemCopy = {...item};
        
        // Ensure both id and _id are available
        if (itemCopy._id && !itemCopy.id) {
            itemCopy.id = itemCopy._id;
        } else if (itemCopy.id && !itemCopy._id) {
            itemCopy._id = itemCopy.id;
        }
        
        // Handle backward compatibility for reporting_id -> reporting_ids migration
        if (type === 'roles') {
            if (!itemCopy.reporting_ids && itemCopy.reporting_id) {
                // Convert old single reporting_id to new array format
                itemCopy.reporting_ids = [itemCopy.reporting_id];
            } else if (!itemCopy.reporting_ids) {
                itemCopy.reporting_ids = [];
            }
            // Remove any empty strings from reporting_ids
            itemCopy.reporting_ids = (itemCopy.reporting_ids || []).filter(id => id);
        }
        
        console.log('Editing item:', itemCopy);
        
        setModalType('edit');
        setEditingItem(itemCopy);
        setFormData(itemCopy);
        
        // If editing an important question, schedule a resize of the textarea after the modal is opened
        if (type === 'importantQuestions') {
            setTimeout(() => {
                const textarea = document.querySelector('textarea[placeholder="e.g., Has customer provided all required documents?"]');
                if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = (textarea.scrollHeight) + 'px';
                }
            }, 100);
        }
        
        // If editing mistake type or warning action, populate the form fields correctly
        if (type === 'mistakeType' || type === 'warningAction') {
            setActiveTab(type);  // Set the activeTab to show correct form fields
            setFormData({
                value: itemCopy.value || '',
                label: itemCopy.label || itemCopy.value || '',
                is_active: itemCopy.is_active !== false
            });
        }
        
        // Initialize permissions when editing a role
        if (type === 'roles' && itemCopy.permissions) {
            // Format existing permissions into selectedPermissions structure
            const permissionMap = {};
            
            // If permissions exist, set type to 'select'
            const hasPermissions = Array.isArray(itemCopy.permissions) && itemCopy.permissions.length > 0;
            setPermissionType(hasPermissions ? 'select' : 'no_permission');
            
            // Map permissions array to our format
            if (hasPermissions) {
                itemCopy.permissions.forEach(perm => {
                    if (perm.page && perm.actions) {
                        permissionMap[perm.page] = perm.actions;
                    }
                });
            }
            
            setSelectedPermissions(permissionMap);
            // Explicitly close all sections when editing
            setExpandedPermissionSections({
                'Global': false,
                'Feeds': false,
                'Tasks': false,
                'Attendance': false,
                'Tickets': false,
                'Leads': false,
                'Leaves': false,
                'Admin': false,
                'Employees': false
            });
            // Force closure with timeout to ensure state updates properly
            setTimeout(() => setExpandedPermissionSections({
                'Global': false,
                'Feeds': false,
                'Tasks': false,
                'Attendance': false,
                'Tickets': false,
                'Leads': false,
                'Leaves': false,
                'Admin': false,
                'Employees': false
            }), 0);
        }
        
        setShowModal(true);
    };

    const handleDelete = async (id, type) => {
        console.log('🗑️ handleDelete called:', { id, type });
        
        if (!id) {
            console.error('❌ Cannot delete - no ID provided');
            alert('Cannot delete this item - no ID found');
            return;
        }
        
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        // Check if item is already being deleted
        if (deletingItems.has(id)) return;
        
        // Add item to deleting set to prevent double-clicking
        setDeletingItems(prev => new Set(prev).add(id));

        try {
            if (type === 'attachmentTypes') {
                // Use hrmsService for attachment types
                await hrmsService.deleteAttachmentType(id);
                loadAttachmentTypes();
                alert('Attachment type deleted successfully!');
                return;
            }

            if (type === 'emailSettings') {
                // Use OTP API for email settings
                await axios.delete(`${BASE_URL}/otp/email-settings/${id}?user_id=${user_id}`);
                loadEmailSettings();
                alert('Email setting deleted successfully!');
                return;
            }

            if (type === 'adminEmails') {
                // Use OTP API for admin emails
                await axios.delete(`${BASE_URL}/otp/admin-emails/${id}?user_id=${user_id}`);
                loadAdminEmails();
                alert('Admin email deleted successfully!');
                return;
            }

            if (type === 'importantQuestions') {
                // Use important questions API
                await axios.delete(`${BASE_URL}/important-questions/${id}?user_id=${user_id}`);
                loadImportantQuestions();
                alert('Important question deleted successfully!');
                return;
            }

            let endpoint;
            switch (type) {
                case 'campaigns':
                    endpoint = `/settings/campaign-names/${id}`;
                    break;
                case 'dataCodes':
                    endpoint = `/settings/data-codes/${id}`;
                    break;
                case 'bankNames':
                    endpoint = `/settings/bank-names/${id}`;
                    break;
                case 'channelNames':
                    endpoint = `/settings/channel-names/${id}`;
                    break;
                case 'companyData':
                    endpoint = `/settings/company-data/${id}`;
                    break;
                case 'departments':
                    endpoint = `/departments/${id}`;
                    break;
                case 'designations':
                    endpoint = `/designations/${id}`;
                    break;
                case 'roles':
                    endpoint = `/roles/${id}`;
                    console.log('Delete role with ID:', id);
                    break;
                case 'mistakeType':
                    endpoint = `/warnings/mistake-types/${id}`;
                    console.log('🎯 Deleting mistake type:', endpoint);
                    break;
                case 'warningAction':
                    endpoint = `/warnings/warning-actions/${id}`;
                    console.log('🎯 Deleting warning action:', endpoint);
                    break;
            }

            console.log('🌐 Making DELETE request to:', `${BASE_URL}${endpoint}?user_id=${user_id}`);
            await axios.delete(`${BASE_URL}${endpoint}?user_id=${user_id}`);
            
            console.log('✅ Delete successful, reloading data...');

            // Reload data
            switch (type) {
                case 'campaigns':
                    loadCampaignNames();
                    break;
                case 'dataCodes':
                    loadDataCodes();
                    break;
                case 'bankNames':
                    loadBankNames();
                    break;
                case 'channelNames':
                    loadChannelNames();
                    break;
                case 'companyData':
                    setCurrentPage(1);
                    loadCompanyData(1, itemsPerPage);
                    loadAvailableBanks();
                    break;
                case 'departments':
                    loadDepartments();
                    break;
                case 'designations':
                    loadDesignations();
                    break;
                case 'roles':
                    loadRoles();
                    break;
                case 'emailSettings':
                    loadEmailSettings();
                    break;
                case 'importantQuestions':
                    loadImportantQuestions();
                    break;
                case 'mistakeType':
                    console.log('🔄 Reloading mistake types...');
                    await loadMistakeTypes();
                    break;
                case 'warningAction':
                    console.log('🔄 Reloading warning actions...');
                    await loadWarningActions();
                    break;
            }

            alert('Item deleted successfully!');
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Error deleting item: ' + (error.response?.data?.detail || error.message));
        } finally {
            // Remove item from deleting set
            setDeletingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            let endpoint, data;

            switch (activeTab) {
                case 'campaigns':
                    endpoint = modalType === 'add'
                        ? `/settings/campaign-names`
                        : `/settings/campaign-names/${editingItem.id}`;
                    data = {
                        name: formData.name,
                        description: formData.description,
                        is_active: formData.is_active !== false
                    };
                    break;
                case 'dataCodes':
                    endpoint = modalType === 'add'
                        ? `/settings/data-codes`
                        : `/settings/data-codes/${editingItem.id}`;
                    data = {
                        name: formData.name,
                        description: formData.description,
                        is_active: formData.is_active !== false
                    };
                    break;
                case 'bankNames':
                    endpoint = modalType === 'add'
                        ? `/settings/bank-names`
                        : `/settings/bank-names/${editingItem.id}`;
                    data = {
                        name: formData.name,
                        is_active: formData.is_active !== false
                    };
                    break;
                case 'channelNames':
                    endpoint = modalType === 'add'
                        ? `/settings/channel-names`
                        : `/settings/channel-names/${editingItem.id}`;
                    data = {
                        name: formData.name,
                        description: formData.description,
                        is_active: formData.is_active !== false
                    };
                    break;
                case 'attachmentTypes':
                    // Handle attachment types with hrmsService
                    const attachmentData = {
                        name: formData.name,
                        target_type: formData.target_type,
                        sort_number: formData.sort_number || 1,
                        description: formData.description,
                        is_active: formData.is_active !== false
                    };
                    
                    if (modalType === 'add') {
                        await hrmsService.createAttachmentType(attachmentData);
                    } else {
                        // Use _id if available, fallback to id
                        const attachmentTypeId = editingItem?._id || editingItem?.id;
                        if (!attachmentTypeId) {
                            throw new Error('No valid ID found for attachment type');
                        }
                        await hrmsService.updateAttachmentType(attachmentTypeId, attachmentData);
                    }
                    
                    setShowModal(false);
                    loadAttachmentTypes();
                    alert(`Attachment type ${modalType === 'add' ? 'created' : 'updated'} successfully!`);
                    setLoading(false);
                    return; // Exit early for attachment types
                case 'emailSettings':
                    // Handle email settings with OTP API
                    const emailData = {
                        email: formData.email,
                        password: formData.password,
                        smtp_server: formData.smtp_server,
                        smtp_port: formData.smtp_port,
                        use_ssl: formData.use_ssl !== false,
                        is_active: formData.is_active !== false,
                        purpose: formData.purpose || 'otp'
                    };
                    
                    if (modalType === 'add') {
                        await axios.post(`${BASE_URL}/otp/email-settings?user_id=${user_id}`, emailData);
                    } else {
                        // Use _id if available, fallback to id
                        const emailSettingId = editingItem?._id || editingItem?.id;
                        if (!emailSettingId) {
                            throw new Error('No valid ID found for email setting');
                        }
                        await axios.put(`${BASE_URL}/otp/email-settings/${emailSettingId}?user_id=${user_id}`, emailData);
                    }
                    
                    setShowModal(false);
                    loadEmailSettings();
                    alert(`Email setting ${modalType === 'add' ? 'created' : 'updated'} successfully!`);
                    setLoading(false);
                    return; // Exit early for email settings
                case 'departments':
                    endpoint = modalType === 'add'
                        ? `/departments`
                        : `/departments/${editingItem.id}`;
                    data = {
                        name: formData.name,
                        description: formData.description,
                        parent_id: formData.parent_id,
                        is_active: formData.is_active !== false
                    };
                    break;
                case 'designations':
                    endpoint = modalType === 'add'
                        ? `/designations`
                        : `/designations/${editingItem.id}`;
                    data = {
                        name: formData.name,
                        description: formData.description,
                        department_id: formData.department_id,
                        is_active: formData.is_active !== false
                    };
                    break;
                case 'roles':
                    // Use _id if available, fallback to id
                    const roleId = editingItem?._id || editingItem?.id;
                    endpoint = modalType === 'add'
                        ? `/roles/`  // Add trailing slash for POST requests
                        : `/roles/${roleId}`;
                    
                    console.log('Role endpoint:', endpoint, 'Role ID:', roleId);
                    
                    // Format permissions for API with lowercase conversion
                    let formattedPermissions = [];
                    
                    if (permissionType === 'select') {
                        // Convert from selectedPermissions object to API format with lowercase
                        formattedPermissions = Object.entries(selectedPermissions).map(([page, actions]) => ({
                            page: page.toLowerCase(), // Convert page to lowercase
                            actions: Array.isArray(actions) 
                                ? actions.map(action => action.toLowerCase()) // Convert actions to lowercase
                                : [actions.toLowerCase()] // Handle single action as array
                        }));
                    }
                    
                    // Validate department_id - ensure it's a valid ObjectId string or null
                    let departmentId = formData.department_id;
                    if (departmentId === '' || departmentId === undefined) {
                        departmentId = null;
                    }
                    
                    // Validate reporting_ids - ensure it's an array of valid ObjectId strings
                    // Filter out empty strings and null values
                    let reportingIds = (formData.reporting_ids || []).filter(id => id && id.trim() !== '');
                    
                    data = {
                        name: formData.name,
                        department_id: departmentId,
                        reporting_ids: reportingIds,  // Changed from reporting_id to reporting_ids (array)
                        permissions: formattedPermissions
                    };
                    
                    console.log('Role data to save:', data);
                    console.log('Form data department_id:', formData.department_id);
                    console.log('Form data reporting_ids:', formData.reporting_ids);
                    console.log('Available departments:', departments);
                    break;
                case 'adminEmails':
                    // Handle admin emails with OTP API
                    const adminEmailData = {
                        name: formData.name,
                        email: formData.email,
                        department: formData.department || null,
                        role: formData.role || 'Admin',
                        receive_otp: formData.receive_otp !== false,
                        receive_notifications: formData.receive_notifications !== false,
                        is_active: formData.is_active !== false
                    };
                    
                    if (modalType === 'add') {
                        await axios.post(`${BASE_URL}/otp/admin-emails?user_id=${user_id}`, adminEmailData);
                    } else {
                        // Use _id if available, fallback to id
                        const adminEmailId = editingItem?._id || editingItem?.id;
                        if (!adminEmailId) {
                            throw new Error('No valid ID found for admin email');
                        }
                        await axios.put(`${BASE_URL}/otp/admin-emails/${adminEmailId}?user_id=${user_id}`, adminEmailData);
                    }
                    
                    setShowModal(false);
                    loadAdminEmails();
                    alert(`Admin email ${modalType === 'add' ? 'created' : 'updated'} successfully!`);
                    setLoading(false);
                    return; // Exit early for admin emails
                case 'importantQuestions':
                    // Handle important questions
                    const questionData = {
                        question: formData.question,
                        type: formData.type || 'checkbox',
                        mandatory: formData.mandatory !== false,
                        is_active: formData.is_active !== false
                    };
                    
                    if (modalType === 'add') {
                        await axios.post(`${BASE_URL}/important-questions?user_id=${user_id}`, questionData);
                    } else {
                        // Use _id if available, fallback to id
                        const questionId = editingItem?._id || editingItem?.id;
                        if (!questionId) {
                            throw new Error('No valid ID found for important question');
                        }
                        await axios.put(`${BASE_URL}/important-questions/${questionId}?user_id=${user_id}`, questionData);
                    }
                    
                    setShowModal(false);
                    loadImportantQuestions();
                    alert(`Important question ${modalType === 'add' ? 'created' : 'updated'} successfully!`);
                    setLoading(false);
                    return; // Exit early for important questions
                case 'mistakeType':
                    // Handle mistake types
                    const mistakeTypeData = {
                        value: formData.value,
                        label: formData.label || formData.value,
                        is_active: formData.is_active !== false
                    };
                    
                    const mistakeTypeId = editingItem?._id || editingItem?.id;
                    
                    // If no ID (editing a default), treat as create; otherwise update
                    if (modalType === 'add' || !mistakeTypeId) {
                        await axios.post(`${API_BASE_URL}/warnings/mistake-types?user_id=${localStorage.getItem('userId')}`, mistakeTypeData);
                    } else {
                        await axios.put(`${API_BASE_URL}/warnings/mistake-types/${mistakeTypeId}?user_id=${localStorage.getItem('userId')}`, mistakeTypeData);
                    }
                    
                    setShowModal(false);
                    setActiveTab('warningData');  // Reset to main tab to show the tables
                    await loadMistakeTypes();
                    alert(`Mistake type ${modalType === 'add' || !mistakeTypeId ? 'created' : 'updated'} successfully!`);
                    setLoading(false);
                    return;
                case 'warningAction':
                    // Handle warning actions
                    const warningActionData = {
                        value: formData.value,
                        label: formData.label || formData.value,
                        is_active: formData.is_active !== false
                    };
                    
                    const warningActionId = editingItem?._id || editingItem?.id;
                    
                    // If no ID (editing a default), treat as create; otherwise update
                    if (modalType === 'add' || !warningActionId) {
                        await axios.post(`${API_BASE_URL}/warnings/warning-actions?user_id=${localStorage.getItem('userId')}`, warningActionData);
                    } else {
                        await axios.put(`${API_BASE_URL}/warnings/warning-actions/${warningActionId}?user_id=${localStorage.getItem('userId')}`, warningActionData);
                    }
                    
                    setShowModal(false);
                    setActiveTab('warningData');  // Reset to main tab to show the tables
                    await loadWarningActions();
                    alert(`Warning action ${modalType === 'add' || !warningActionId ? 'created' : 'updated'} successfully!`);
                    setLoading(false);
                    return;
            }

            if (modalType === 'add') {
                await axios.post(`${BASE_URL}${endpoint}?user_id=${user_id}`, data);
            } else {
                await axios.put(`${BASE_URL}${endpoint}?user_id=${user_id}`, data);
            }

            setShowModal(false);
            loadAllData();
            alert(`${modalType === 'add' ? 'Created' : 'Updated'} successfully!`);
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error saving: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Excel upload
    const handleFileUpload = async () => {
        if (!uploadFile) {
            alert('Please select a file first');
            return;
        }

        // Check file size and warn user for large files
        const fileSizeMB = (uploadFile.size / (1024 * 1024)).toFixed(2);
        console.log(`File size: ${fileSizeMB} MB`);

        // Validate file type
        const validExtensions = ['.xlsx', '.xls'];
        const fileExtension = uploadFile.name.toLowerCase().substring(uploadFile.name.lastIndexOf('.'));
        if (!validExtensions.includes(fileExtension)) {
            alert('Please select a valid Excel file (.xlsx or .xls)');
            return;
        }

        try {
            setLoading(true);
            setUploadProgress(0);
            
            const startTime = Date.now();
            const formData = new FormData();
            formData.append('file', uploadFile);

            console.log(`🚀 Starting INSTANT upload of ${uploadFile.name} (${fileSizeMB} MB)...`);

            // INSTANT upload - returns immediately with upload ID
            const response = await axios.post(
                `${BASE_URL}/settings/upload-excel?user_id=${user_id}`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 30000, // 30 seconds for upload only
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setUploadProgress(percentCompleted);
                    }
                }
            );

            const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⚡ Upload completed in ${uploadTime}s! Processing in background...`);

            // Show instant success message
            alert(`🚀 Upload Complete in ${uploadTime}s!\n\n` +
                  `File: ${uploadFile.name} (${fileSizeMB} MB)\n` +
                  `Status: Processing in background\n` +
                  `Upload ID: ${response.data.upload_id}\n\n` +
                  `You can continue working while processing happens in the background!`);

            // Reset upload UI
            setUploadFile(null);
            setUploadProgress(0);

            // Start polling for progress updates
            if (response.data.upload_id) {
                startProgressPolling(response.data.upload_id, uploadFile.name);
            }
            
        } catch (error) {
            console.error('Error uploading file:', error);
            
            let errorMessage = 'Error uploading file: ';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += 'Upload timeout. Please try with a smaller file.';
            } else if (error.response?.status === 413) {
                errorMessage += 'File too large. Maximum size is 500 MB.';
            } else if (error.response?.status === 422) {
                errorMessage += 'Invalid file format. Please ensure you have the required columns: COMPANY NAME, CATEGORIES, BANK.';
            } else {
                errorMessage += error.response?.data?.detail || error.message || 'Unknown error occurred.';
            }
            
            alert(errorMessage);
            
        } finally {
            setLoading(false);
        }
    };

    const startProgressPolling = (uploadId, filename) => {
        console.log(`🔄 Starting progress polling for ${filename} (ID: ${uploadId})`);
        
        // Add to active uploads
        setActiveUploads(prev => new Map(prev.set(uploadId, {
            filename,
            status: 'processing',
            progress: 0,
            startTime: Date.now()
        })));

        const pollInterval = setInterval(async () => {
            try {
                const response = await axios.get(
                    `${BASE_URL}/settings/upload-status/${uploadId}?user_id=${user_id}`,
                    { timeout: 5000 }
                );

                const status = response.data;
                console.log(`📊 Progress for ${filename}:`, status);

                // Update active uploads
                setActiveUploads(prev => {
                    const updated = new Map(prev);
                    if (updated.has(uploadId)) {
                        updated.set(uploadId, {
                            ...updated.get(uploadId),
                            status: status.status,
                            progress: status.progress_percent || 0,
                            message: status.message
                        });
                    }
                    return updated;
                });

                // Check if completed or failed
                if (status.status === 'completed') {
                    clearInterval(pollInterval);
                    
                    // Show completion notification
                    const stats = status.result?.stats || {};
                    const processingTime = status.end_time && status.start_time ? 
                        ((new Date(status.end_time) - new Date(status.start_time)) / 1000).toFixed(1) : 'N/A';
                    
                    alert(`🎉 Processing Complete!\n\n` +
                          `File: ${filename}\n` +
                          `Processing Time: ${processingTime}s\n\n` +
                          `Results:\n` +
                          `• Valid Records: ${stats.valid_records_processed || 0}\n` +
                          `• New Companies: ${stats.created || 0}\n` +
                          `• Updated Companies: ${stats.updated || 0}\n` +
                          `• Errors Skipped: ${stats.errors_skipped || 0}\n` +
                          `• Success Rate: ${stats.success_rate_percent || 0}%`);

                    // Remove from active uploads
                    setActiveUploads(prev => {
                        const updated = new Map(prev);
                        updated.delete(uploadId);
                        return updated;
                    });

                    // Reload data
                    setCurrentPage(1);
                    loadCompanyData(1, itemsPerPage);
                    loadAvailableBanks();

                } else if (status.status === 'failed') {
                    clearInterval(pollInterval);
                    
                    alert(`❌ Processing Failed!\n\n` +
                          `File: ${filename}\n` +
                          `Error: ${status.error || status.message}\n\n` +
                          `Please try again or contact support.`);

                    // Remove from active uploads
                    setActiveUploads(prev => {
                        const updated = new Map(prev);
                        updated.delete(uploadId);
                        return updated;
                    });
                }

            } catch (error) {
                console.error('Error polling progress:', error);
                // Continue polling - might be temporary network issue
            }
        }, 2000); // Poll every 2 seconds

        // Stop polling after 10 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
            setActiveUploads(prev => {
                const updated = new Map(prev);
                updated.delete(uploadId);
                return updated;
            });
        }, 600000);
    };

    // Company search
    const handleCompanySearch = async () => {
        if (!searchQuery.trim()) {
            alert('Please enter a company name to search');
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post(
                `${BASE_URL}/settings/search-companies?user_id=${user_id}`,
                {
                    company_name: searchQuery,
                    similarity_threshold: 0.8
                }
            );
            setSearchResults(response.data);
        } catch (error) {
            console.error('Error searching companies:', error);
            alert('Error searching companies: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Attendance settings functions
    const loadAttendanceSettings = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/settings/attendance-settings?user_id=${user_id}`);
            if (response.data && response.data.data) {
                setAttendanceSettings(response.data.data);
            }
        } catch (error) {
            console.error('Error loading attendance settings:', error);
        }
    };

    const updateAttendanceSettings = async (updatedSettings) => {
        try {
            setLoading(true);
            const response = await axios.put(
                `${BASE_URL}/settings/attendance-settings?user_id=${user_id}`,
                updatedSettings
            );
            
            if (response.data && response.data.settings) {
                setAttendanceSettings(response.data.settings);
                alert('Attendance settings updated successfully!');
            }
        } catch (error) {
            console.error('Error updating attendance settings:', error);
            alert('Error updating attendance settings: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Email Settings Table Render Function
    const renderEmailSettingsTable = () => (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Email Settings for OTP</h3>
                    <p className="text-sm text-gray-300 mt-1">
                        Configure email accounts that will be used to send OTP codes to users
                    </p>
                </div>
                {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                    <button
                        onClick={() => handleAdd('emailSettings')}
                        className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-green-600 hover:to-green-700 transition-all"
                    >
                        <Plus size={16} />
                        Add Email Account
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">SMTP Server</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Port</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">SSL</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Purpose</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {emailSettings.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                                    No email settings configured. Click "Add Email Account" to configure an email for sending OTP codes.
                                </td>
                            </tr>
                        ) : (
                            emailSettings.map((setting) => (
                                <tr key={setting._id || setting.id} className="hover:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                                        {setting.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                        {setting.smtp_server}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                        {setting.smtp_port}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            setting.use_ssl 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {setting.use_ssl ? 'SSL' : 'No SSL'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {setting.purpose || 'OTP'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            setting.is_active 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {setting.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                        {setting.created_at ? new Date(setting.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                            <button
                                                onClick={() => handleEdit(setting, 'emailSettings')}
                                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                            >
                                                <Edit size={14} />
                                                Edit
                                            </button>
                                        )}
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                            <button
                                                onClick={() => handleDelete(setting._id || setting.id, 'emailSettings')}
                                                className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {emailSettings.length > 0 && (
                <div className="bg-gray-800 px-6 py-3 border-t border-gray-700">
                    <p className="text-sm text-gray-400">
                        <strong>Note:</strong> Only one email setting can be active at a time for OTP delivery. 
                        The active setting will be used to send OTP codes to users.
                    </p>
                </div>
            )}
        </div>
    );

    // Admin Emails Table Render Function
    const renderAdminEmailsTable = () => (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Admin Emails for OTP Reception</h3>
                    <p className="text-sm text-gray-300 mt-1">
                        Configure admin email addresses that will receive OTP codes when employees request login. 
                        Employees will need to contact admin to get their OTP codes.
                    </p>
                </div>
                {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                    <button
                        onClick={() => handleAdd('adminEmails')}
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-red-600 hover:to-red-700 transition-all"
                    >
                        <Plus size={16} />
                        Add Admin Email
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {adminEmails.length === 0 ? (
                            <tr>
                                <td colSpan="2" className="px-6 py-8 text-center text-gray-400">
                                    No admin emails configured. Click "Add Admin Email" to configure admin emails for OTP reception.
                                </td>
                            </tr>
                        ) : (
                            adminEmails.map((adminEmail) => (
                                <tr key={adminEmail._id || adminEmail.id} className="hover:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                        {adminEmail.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                            <button
                                                onClick={() => handleEdit(adminEmail, 'adminEmails')}
                                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                            >
                                                <Edit size={14} />
                                                Edit
                                            </button>
                                        )}
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                            <button
                                                onClick={() => handleDelete(adminEmail._id || adminEmail.id, 'adminEmails')}
                                                className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {adminEmails.length > 0 && (
                <div className="bg-gray-800 px-6 py-3 border-t border-gray-700">
                    <p className="text-sm text-gray-400">
                        <strong>🔐 Security Note:</strong> OTP codes will be sent to all active admin emails with "Receive OTP" enabled. 
                        Employees will need to contact these admins to get their OTP codes for login.
                    </p>
                </div>
            )}
        </div>
    );

    // Important Questions Table Render Function
    const renderImportantQuestionsTable = () => (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Important Questions Management</h3>
                    <p className="text-sm text-gray-300 mt-1">
                        Configure important questions that will be displayed during lead processing and validation
                    </p>
                </div>
                {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                    <button
                        onClick={() => handleAdd('importantQuestions')}
                        className="bg-gradient-to-r from-violet-500 to-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-violet-600 hover:to-violet-700 transition-all"
                    >
                        <Plus size={16} />
                        Add Question
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Question</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Mandatory</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Display Order</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {importantQuestions.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                                    No important questions configured. Click "Add Question" to create important questions for lead processing.
                                </td>
                            </tr>
                        ) : (
                            importantQuestions.map((question) => (
                                <tr key={question._id || question.id} className="hover:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4 text-white">
                                        <div className="max-w-md whitespace-pre-wrap">
                                            <p className="font-medium" style={{ whiteSpace: 'pre-wrap' }}>
                                                {question.question}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {question.type || 'checkbox'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            question.mandatory 
                                                ? 'bg-red-100 text-red-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {question.mandatory ? 'Required' : 'Optional'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            question.is_active 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {question.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {question.display_order || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                        {question.created_at ? new Date(question.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                            <button
                                                onClick={() => handleEdit(question, 'importantQuestions')}
                                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                            >
                                                <Edit size={14} />
                                                Edit
                                            </button>
                                        )}
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                            <button
                                                onClick={() => handleDelete(question._id || question.id, 'importantQuestions')}
                                                className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {importantQuestions.length > 0 && (
                <div className="bg-gray-800 px-6 py-3 border-t border-gray-700">
                    <p className="text-sm text-gray-400">
                        <strong>💡 Note:</strong> Important questions are displayed during lead processing to ensure critical information is validated. 
                        Active questions will appear in the lead validation workflow. Questions are displayed in order of their display order.
                    </p>
                </div>
            )}
        </div>
    );

    const renderWarningDataTables = () => (
        <div className="space-y-6">
            {/* Mistake Types Table */}
            <div className="bg-black rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Mistake Types</h3>
                        <p className="text-sm text-gray-300 mt-1">
                            Configure mistake types that will be available in the warning system dropdown
                        </p>
                    </div>
                    {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                        <button
                            onClick={() => handleAdd('mistakeType')}
                            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-orange-600 hover:to-orange-700 transition-all"
                        >
                            <Plus size={16} />
                            Add Mistake Type
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Value</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Display Label</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-900 divide-y divide-gray-700">
                            {mistakeTypes.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                        No mistake types configured. Click "Add Mistake Type" to create options for the mistake type dropdown.
                                    </td>
                                </tr>
                            ) : (
                                mistakeTypes.map((type) => (
                                    <tr key={type._id || type.id || type.value} className="hover:bg-gray-800 transition-colors">
                                        <td className="px-6 py-4 text-white">
                                            <p className="font-medium">{type.value}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {type.label || type.value}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                type.is_active !== false
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {type.is_active !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {type.created_at ? new Date(type.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                                <button
                                                    onClick={() => handleEdit(type, 'mistakeType')}
                                                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                                    title="Edit this mistake type"
                                                >
                                                    <Edit size={14} />
                                                    Edit
                                                </button>
                                            )}
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                                <button
                                                    onClick={() => {
                                                        const id = type._id || type.id;
                                                        if (!id) {
                                                            alert('Cannot delete default items. You can edit them to create a custom version.');
                                                            return;
                                                        }
                                                        handleDelete(id, 'mistakeType');
                                                    }}
                                                    className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                                                    title={type._id || type.id ? "Delete this mistake type" : "Cannot delete default items"}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Warning Actions Table */}
            <div className="bg-black rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Warning Actions</h3>
                        <p className="text-sm text-gray-300 mt-1">
                            Configure warning action types that will be available in the warning system dropdown
                        </p>
                    </div>
                    {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                        <button
                            onClick={() => handleAdd('warningAction')}
                            className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-red-600 hover:to-red-700 transition-all"
                        >
                            <Plus size={16} />
                            Add Warning Action
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Value</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Display Label</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-900 divide-y divide-gray-700">
                            {warningActions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                        No warning actions configured. Click "Add Warning Action" to create options for the warning action dropdown.
                                    </td>
                                </tr>
                            ) : (
                                warningActions.map((action) => (
                                    <tr key={action._id || action.id || action.value} className="hover:bg-gray-800 transition-colors">
                                        <td className="px-6 py-4 text-white">
                                            <p className="font-medium">{action.value}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {action.label || action.value}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                action.is_active !== false
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {action.is_active !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {action.created_at ? new Date(action.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                                <button
                                                    onClick={() => handleEdit(action, 'warningAction')}
                                                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                                    title="Edit this warning action"
                                                >
                                                    <Edit size={14} />
                                                    Edit
                                                </button>
                                            )}
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                                <button
                                                    onClick={() => {
                                                        const id = action._id || action.id;
                                                        if (!id) {
                                                            alert('Cannot delete default items. You can edit them to create a custom version.');
                                                            return;
                                                        }
                                                        handleDelete(id, 'warningAction');
                                                    }}
                                                    className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                                                    title={action._id || action.id ? "Delete this warning action" : "Cannot delete default items"}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderWarningTypesTable = () => (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Warning Types Management</h3>
                    <p className="text-sm text-gray-300 mt-1">
                        Configure warning and mistake types that will be available in the warning system dropdowns
                    </p>
                </div>
                {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                    <button
                        onClick={() => handleAdd('warningData')}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-orange-600 hover:to-orange-700 transition-all"
                    >
                        <Plus size={16} />
                        Add Warning Type
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Warning Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Display Label</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {warningTypes.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                    No warning types configured. Click "Add Warning Type" to create warning types for the warning system.
                                </td>
                            </tr>
                        ) : (
                            warningTypes.map((type) => (
                                <tr key={type._id || type.id || type.value} className="hover:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4 text-white">
                                        <p className="font-medium">{type.value}</p>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        {type.label || type.value}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            type.is_active !== false
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {type.is_active !== false ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                        {type.created_at ? new Date(type.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                            <button
                                                onClick={() => handleEdit(type, 'warningData')}
                                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                            >
                                                <Edit size={14} />
                                                Edit
                                            </button>
                                        )}
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                            <button
                                                onClick={() => handleDelete(type._id || type.id, 'warningData')}
                                                className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {warningTypes.length > 0 && (
                <div className="bg-gray-800 px-6 py-3 border-t border-gray-700">
                    <p className="text-sm text-gray-400">
                        <strong>💡 Note:</strong> Warning types are displayed in the warning system dropdowns when creating or editing warnings. 
                        Active types will appear in the warning/mistake type dropdown options.
                    </p>
                </div>
            )}
        </div>
    );

    // Render functions
    const renderTabContent = () => {
        switch (activeTab) {
            case 'campaigns':
                return renderDataTable(campaignNames, 'campaigns', ['name', 'description', 'is_active']);
            case 'dataCodes':
                return renderDataTable(dataCodes, 'dataCodes', ['name', 'description', 'is_active']);
            case 'bankNames':
                return renderDataTable(bankNames, 'bankNames', ['name', 'is_active']);
            case 'channelNames':
                return renderDataTable(channelNames, 'channelNames', ['name', 'description', 'is_active']);
            case 'companyData':
                return renderCompanyDataTable();
            case 'attachmentTypes':
                return renderAttachmentTypesTable();
            case 'excelUpload':
                return renderExcelUpload();
            case 'departments':
                try {
                    return <DepartmentSettings />;
                } catch (error) {
                    console.error('Error rendering DepartmentSettings:', error);
                    return <div className="p-4 text-red-500">Error loading departments. Please refresh the page.</div>;
                }
            case 'designations':
                try {
                    return <DesignationSettings />;
                } catch (error) {
                    console.error('Error rendering DesignationSettings:', error);
                    return <div className="p-4 text-red-500">Error loading designations. Please refresh the page.</div>;
                }
            case 'roles':
                try {
                    return <RoleSettings />;
                } catch (error) {
                    console.error('Error rendering RoleSettings:', error);
                    return <div className="p-4 text-red-500">Error loading roles. Please refresh the page.</div>;
                }
            case 'emailSettings':
                return renderEmailSettingsTable();
            case 'adminEmails':
                return renderAdminEmailsTable();
            case 'statuses':
                // Add a check to prevent loading in a loop
                {
                    const now = Date.now();
                    const lastLoaded = window.lastStatusesLoadedAt || 0;
                    if (now - lastLoaded > 5000) { // Only reload if more than 5 seconds passed
                        window.lastStatusesLoadedAt = now;
                        loadStatuses();
                    } else {
                        console.log("Skipping status reload - loaded recently");
                    }
                }
                return (
                    <StatusManagementTab
                        statuses={statuses}
                        selectedDepartment={selectedDepartment}
                        setSelectedDepartment={setSelectedDepartment}
                        showStatusModal={showStatusModal}
                        setShowStatusModal={setShowStatusModal}
                        showSubStatusModal={showSubStatusModal}
                        setShowSubStatusModal={setShowSubStatusModal}
                        statusModalType={statusModalType}
                        setStatusModalType={setStatusModalType}
                        subStatusModalType={subStatusModalType}
                        setSubStatusModalType={setSubStatusModalType}
                        editingStatus={editingStatus}
                        setEditingStatus={setEditingStatus}
                        editingSubStatus={editingSubStatus}
                        setEditingSubStatus={setEditingSubStatus}
                        selectedStatus={selectedStatus}
                        setSelectedStatus={setSelectedStatus}
                        createStatus={createStatus}
                        updateStatus={updateStatus}
                        deleteStatus={deleteStatus}
                        deleteSubStatusFromArray={deleteSubStatusFromArray}
                        createSubStatus={createSubStatus}
                        updateSubStatus={updateSubStatus}
                        deleteSubStatus={deleteSubStatus}
                    />
                );
            case 'attendance':
                return <AttendanceSettingsTab userId={user_id} />;
            case 'popupModals':
                return <PopupModalSettings userId={user_id} />;
            case 'importantQuestions':
                return renderImportantQuestionsTable();
            default:
                return null;
        }
    };

    const renderDataTable = (data, type, columns) => (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-black flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                    {tabs.find(t => t.id === type)?.label || type}
                </h3>
                {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                    <button
                        onClick={() => handleAdd(type)}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-blue-600 hover:to-blue-700 transition-all"
                    >
                        <Plus size={16} />
                        Add New
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-black">
                        <tr>
                            {columns.map(col => (
                                <th key={col} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    {col.replace('_', ' ')}
                                </th>
                            ))}
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                        {data.map((item, index) => (
                            <tr key={item._id || item.id || index} className="hover:bg-black">
                                {columns.map(col => (
                                    <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                        {col === 'is_active' ? (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item[col] ? 'bg-green-100 text-white' : 'bg-black text-white'
                                                }`}>
                                                {item[col] ? 'Active' : 'Inactive'}
                                            </span>
                                        ) : (
                                            item[col] || '-'
                                        )}
                                    </td>
                                ))}
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex gap-2">
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'edit')) && (
                                            <button
                                                onClick={() => handleEdit(item, type)}
                                                className="text-white hover:text-white"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                        {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                            <button
                                                onClick={() => handleDelete(item._id || item.id, type)}
                                                className="text-white hover:text-white"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderAttachmentTypesTable = () => {
        // ── Draft mutation helpers (auto-save on every change) ──
        const saveWithDraft = async (draftCats) => {
            if (atSaving) {
                // Queue this draft — will be picked up after current save finishes
                pendingDraftRef.current = draftCats;
                return;
            }
            setAtSaving(true);
            try {
                const draftDocs = [];
                draftCats.forEach((cat, catIdx) => {
                    cat.docs.forEach((doc, docIdx) => {
                        draftDocs.push({ ...doc, category: cat.title, sort_number: catIdx * 100 + docIdx + 1 });
                    });
                });
                const originalIds = new Set(attachmentTypes.map(t => t._id || t.id));
                const draftIds = new Set(draftDocs.filter(d => !d._isNew && (d._id || d.id)).map(d => d._id || d.id));
                for (const id of originalIds) {
                    if (!draftIds.has(id)) await hrmsService.deleteAttachmentType(id).catch(console.error);
                }
                for (const doc of draftDocs.filter(d => d._isNew)) {
                    await hrmsService.createAttachmentType({
                        name: doc.name, target_type: doc.target_type || 'leads',
                        sort_number: doc.sort_number, description: doc.description || '',
                        is_active: doc.is_active !== false, category: doc.category,
                        is_primary: doc.is_primary !== false
                    }).catch(console.error);
                }
                for (const doc of draftDocs.filter(d => !d._isNew && (d._id || d.id))) {
                    await hrmsService.updateAttachmentType(doc._id || doc.id, {
                        name: doc.name, target_type: doc.target_type,
                        sort_number: doc.sort_number, description: doc.description || '',
                        is_active: doc.is_active !== false, category: doc.category,
                        is_primary: doc.is_primary !== false
                    }).catch(console.error);
                }
                await loadAttachmentTypes();
                setAtDraftDirty(false);
            } catch (e) {
                console.error('Error auto-saving attachment settings:', e);
                setAtDraftDirty(true);
            } finally {
                setAtSaving(false);
                // If a newer draft was queued while we were saving, process it now
                if (pendingDraftRef.current) {
                    const next = pendingDraftRef.current;
                    pendingDraftRef.current = null;
                    saveWithDraft(next);
                }
            }
        };
        const updateDraft = (updater) => {
            const next = updater(JSON.parse(JSON.stringify(atDraftCategories)));
            atDraftCategoriesRef.current = next;
            setAtDraftCategories(next);
            saveWithDraft(next);
        };

        const toggleCatCollapse = (catTitle) => {
            setAtCatCollapsed(prev => ({ ...prev, [catTitle]: !prev[catTitle] }));
        };

        const renameCategory = (catIdx, val) => {
            if (!val.trim()) return;
            const oldTitle = atDraftCategories[catIdx].title;
            const newTitle = val.trim().toUpperCase();
            // Update localStorage for empty cat if it was stored there
            try {
                const stored = JSON.parse(localStorage.getItem('rupiyame_empty_attachment_cats') || '[]');
                const updated = stored.map(t => t === oldTitle ? newTitle : t);
                localStorage.setItem('rupiyame_empty_attachment_cats', JSON.stringify(updated));
            } catch {}
            updateDraft(draft => {
                draft[catIdx].title = newTitle;
                draft[catIdx].docs.forEach(d => { d.category = newTitle; });
                return draft;
            });
        };

        const deleteCategory = (catIdx) => {
            if (!window.confirm(`Delete "${atDraftCategories[catIdx].title}" and all its documents?`)) return;
            const title = atDraftCategories[catIdx].title;
            // Remove from localStorage if it was an empty cat
            try {
                const stored = JSON.parse(localStorage.getItem('rupiyame_empty_attachment_cats') || '[]');
                localStorage.setItem('rupiyame_empty_attachment_cats', JSON.stringify(stored.filter(t => t !== title)));
            } catch {}
            updateDraft(draft => { draft.splice(catIdx, 1); return draft; });
        };

        const renameDoc = (catIdx, docIdx, val) => {
            if (!val.trim()) return;
            updateDraft(draft => { draft[catIdx].docs[docIdx].name = val.trim().toUpperCase(); return draft; });
        };

        const changeDocPrimary = (catIdx, docIdx, isPrimary) => {
            updateDraft(draft => { draft[catIdx].docs[docIdx].is_primary = isPrimary; return draft; });
        };

        const deleteDoc = (catIdx, docIdx) => {
            if (!window.confirm(`Delete "${atDraftCategories[catIdx].docs[docIdx].name}"?`)) return;
            updateDraft(draft => { draft[catIdx].docs.splice(docIdx, 1); return draft; });
        };

        const addDocToCategory = (catIdx) => {
            const val = (atNewDocInputs[catIdx] || '').trim().toUpperCase();
            if (!val) return;
            const targetType = attachmentTypeFilter || 'leads';
            updateDraft(draft => {
                draft[catIdx].docs.push({
                    name: val,
                    target_type: targetType,
                    is_active: true,
                    is_primary: true,
                    category: draft[catIdx].title,
                    sort_number: draft[catIdx].docs.length + 1,
                    _isNew: true
                });
                return draft;
            });
            setAtNewDocInputs(prev => ({ ...prev, [catIdx]: '' }));
        };

        const addCategory = () => {
            const val = atNewCatInput.trim().toUpperCase();
            if (!val) return;
            // Persist to localStorage so it survives hard refresh
            try {
                const stored = JSON.parse(localStorage.getItem('rupiyame_empty_attachment_cats') || '[]');
                if (!stored.includes(val)) localStorage.setItem('rupiyame_empty_attachment_cats', JSON.stringify([...stored, val]));
            } catch {}
            updateDraft(draft => { draft.push({ title: val, docs: [] }); return draft; });
            setAtNewCatInput('');
        };

        // ── Category drag/drop ──
        const handleCatDrop = (targetIdx) => {
            if (atCatDragIdx === null || atCatDragIdx === targetIdx) {
                setAtCatDragIdx(null); setAtCatDragOverIdx(null); return;
            }
            updateDraft(draft => {
                const [moved] = draft.splice(atCatDragIdx, 1);
                draft.splice(targetIdx, 0, moved);
                return draft;
            });
            setAtCatDragIdx(null); setAtCatDragOverIdx(null);
        };

        // ── Doc drag/drop (within same category) ──
        const handleDocDrop = (targetCatIdx, targetDocIdx) => {
            if (!atDocDrag) { setAtDocDragOver(null); return; }
            const { catIdx: srcCatIdx, docIdx: srcDocIdx } = atDocDrag;
            if (srcCatIdx !== targetCatIdx || srcDocIdx === targetDocIdx) {
                setAtDocDrag(null); setAtDocDragOver(null); return;
            }
            updateDraft(draft => {
                const [moved] = draft[targetCatIdx].docs.splice(srcDocIdx, 1);
                draft[targetCatIdx].docs.splice(targetDocIdx, 0, moved);
                return draft;
            });
            setAtDocDrag(null); setAtDocDragOver(null);
        };

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* ── Header ── */}
                <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 bg-gray-50">
                    <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                        <Settings size={18} className="text-blue-600" />
                        DOCUMENT SETTINGS
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {atSaving && (
                            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase flex items-center gap-1"><Save size={9} className="animate-pulse" /> Saving...</span>
                        )}
                        {/* Filter tabs */}
                        <div className="flex rounded overflow-hidden border border-gray-200 shadow-sm">
                            {[['leads', 'Leads'], ['employees', 'Employees']].map(([val, label]) => (
                                <button
                                    key={val}
                                    onClick={() => setAttachmentTypeFilter(val)}
                                    className={`px-2.5 py-1 text-[10px] font-bold transition ${
                                        attachmentTypeFilter === val ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                                >{label}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Content ── */}
                <div key={atDraftKey} className="p-4 bg-gray-50/50 max-h-[70vh] overflow-y-auto">
                    {atDraftCategories.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                            No attachment types found. Add a category below to get started.
                        </div>
                    ) : (
                        atDraftCategories.map((cat, catIdx) => {
                            // Apply target type filter to docs display
                            const visibleDocs = attachmentTypeFilter
                                ? cat.docs.filter(d => d.target_type === attachmentTypeFilter)
                                : cat.docs;
                            // Hide category if filtered and no docs match
                            if (attachmentTypeFilter && visibleDocs.length === 0 && cat.docs.length > 0 && cat.docs.every(d => d.target_type !== attachmentTypeFilter)) return null;

                            const isCollapsed = atCatCollapsed[cat.title] === true; // default = expanded
                            const isCatDragOver = atCatDragOverIdx === catIdx;
                            const isCatBeingDragged = atCatDragIdx === catIdx;

                            return (
                                <div
                                    key={`cat-${catIdx}-${cat.title}`}
                                    draggable
                                    onDragStart={e => { setAtCatDragIdx(catIdx); e.stopPropagation(); setTimeout(() => {}, 0); }}
                                    onDragOver={e => { e.preventDefault(); setAtCatDragOverIdx(catIdx); e.stopPropagation(); }}
                                    onDragEnd={() => { setAtCatDragIdx(null); setAtCatDragOverIdx(null); }}
                                    onDrop={e => { e.preventDefault(); e.stopPropagation(); handleCatDrop(catIdx); }}
                                    className={`mb-3 bg-gray-100/70 p-3 border border-gray-200 rounded-lg shadow-sm transition
                                        ${isCatDragOver ? 'border-t-4 border-t-blue-500' : ''}
                                        ${isCatBeingDragged ? 'opacity-50' : ''}`}
                                >
                                    {/* Category header */}
                                    <div className={`flex items-center justify-between ${!isCollapsed ? 'pb-1 border-b border-gray-300 mb-3' : ''} text-gray-800`}>
                                        <div className="flex items-center gap-2 cursor-grab flex-1 mr-2 min-w-0">
                                            <GripVertical size={16} className="text-gray-400 shrink-0" />
                                            <span className="font-black text-sm uppercase shrink-0">{catIdx + 1}.</span>
                                            <input
                                                key={`cat-input-${cat.title}`}
                                                type="text"
                                                defaultValue={cat.title}
                                                onBlur={e => renameCategory(catIdx, e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                                className="font-black text-sm uppercase tracking-tight bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-blue-400 focus:bg-white rounded px-1 transition text-gray-800 min-w-0"
                                            />
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                                <button
                                                    onClick={() => deleteCategory(catIdx)}
                                                    className="text-gray-400 hover:text-red-500 transition p-1.5 rounded hover:bg-white w-7 h-7 flex items-center justify-center"
                                                    title="Delete category"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleCatCollapse(cat.title)}
                                                className="text-gray-500 hover:text-blue-600 transition p-1.5 rounded hover:bg-white w-7 h-7 flex items-center justify-center border border-transparent hover:border-gray-200"
                                                title={isCollapsed ? 'Expand' : 'Collapse'}
                                            >
                                                {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Docs inside category (when expanded) */}
                                    {!isCollapsed && (
                                        <div className="pl-6 pr-1">
                                            {visibleDocs.length === 0 && (
                                                <div className="text-[11px] text-gray-400 italic py-2 text-center">No documents in this section yet.</div>
                                            )}
                                            {visibleDocs.map((doc) => {
                                                const docIdx = cat.docs.indexOf(doc);
                                                const isPrim = doc.is_primary !== false;
                                                const isDocDragOver = atDocDragOver?.catIdx === catIdx && atDocDragOver?.docIdx === docIdx;
                                                const isDocBeingDragged = atDocDrag?.catIdx === catIdx && atDocDrag?.docIdx === docIdx;
                                                return (
                                                    <div
                                                        key={`doc-${doc._id || doc.id || `new-${catIdx}-${docIdx}`}`}
                                                        draggable
                                                        onDragStart={e => { setAtDocDrag({ catIdx, docIdx }); e.stopPropagation(); }}
                                                        onDragOver={e => { e.preventDefault(); setAtDocDragOver({ catIdx, docIdx }); e.stopPropagation(); }}
                                                        onDragEnd={() => { setAtDocDrag(null); setAtDocDragOver(null); }}
                                                        onDrop={e => { e.preventDefault(); e.stopPropagation(); handleDocDrop(catIdx, docIdx); }}
                                                        className={`flex items-center justify-between p-2 lg:p-2.5 bg-white border border-gray-200 rounded-md mb-1.5 cursor-grab active:cursor-grabbing hover:border-blue-300 transition
                                                            ${isDocDragOver ? 'border-t-2 border-t-blue-500' : ''}
                                                            ${isDocBeingDragged ? 'opacity-40' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-1 pr-2 min-w-0">
                                                            <GripVertical size={14} className="text-gray-300 shrink-0" />
                                                            <input
                                                                key={`doc-input-${doc._id || doc.id || `${catIdx}-${docIdx}`}`}
                                                                type="text"
                                                                defaultValue={doc.name}
                                                                onBlur={e => renameDoc(catIdx, docIdx, e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                                                className="text-[11px] lg:text-xs font-bold text-gray-700 bg-transparent border-none outline-none w-full truncate focus:ring-1 focus:ring-blue-400 focus:bg-white rounded px-1 transition uppercase"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${doc.target_type === 'employees' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                {doc.target_type === 'employees' ? 'EMP' : 'LEAD'}
                                                            </span>
                                                            <select
                                                                value={isPrim ? 'primary' : 'extra'}
                                                                onChange={e => changeDocPrimary(catIdx, docIdx, e.target.value === 'primary')}
                                                                className={`text-[9px] font-bold px-1.5 py-1 rounded border outline-none cursor-pointer ${isPrim ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                                            >
                                                                <option value="primary">OUTSIDE (DEFAULT)</option>
                                                                <option value="extra">EXTRA DOC</option>
                                                            </select>
                                                            {/* Info / Description icon */}
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setAtDescPopover(atDescPopover === `${catIdx}-${docIdx}` ? null : `${catIdx}-${docIdx}`)}
                                                                    className={`w-5 h-5 flex items-center justify-center rounded transition ${doc.description ? 'text-blue-500 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                                                                    title={doc.description ? `Info: ${doc.description}` : 'Add info / description'}
                                                                >
                                                                    <HelpCircle size={10} />
                                                                </button>
                                                                {atDescPopover === `${catIdx}-${docIdx}` && (
                                                                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-blue-200 rounded-lg shadow-xl p-2.5 w-56">
                                                                        <div className="text-[9px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">ℹ Description (shown to users)</div>
                                                                        <textarea
                                                                            autoFocus
                                                                            defaultValue={doc.description || ''}
                                                                            onBlur={e => {
                                                                                const desc = e.target.value.trim();
                                                                                updateDraft(draft => { draft[catIdx].docs[docIdx].description = desc; return draft; });
                                                                                setAtDescPopover(null);
                                                                            }}
                                                                            onKeyDown={e => { if (e.key === 'Escape') setAtDescPopover(null); }}
                                                                            rows={3}
                                                                            placeholder="What is this document for?"
                                                                            className="w-full text-[10px] text-gray-900 border border-gray-200 rounded px-2 py-1 outline-none resize-none focus:border-blue-300"
                                                                        />
                                                                        <p className="text-[9px] text-gray-400 mt-1">Click outside to save &amp; close</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'delete')) && (
                                                                <button
                                                                    onClick={() => deleteDoc(catIdx, docIdx)}
                                                                    className="text-gray-400 hover:text-red-500 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition"
                                                                    title="Delete document type"
                                                                >
                                                                    <Trash2 size={10} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {/* Add doc input row */}
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 border-dashed">
                                                    <input
                                                        type="text"
                                                        value={atNewDocInputs[catIdx] || ''}
                                                        onChange={e => setAtNewDocInputs(prev => ({ ...prev, [catIdx]: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') addDocToCategory(catIdx); }}
                                                        placeholder="NEW DOC TITLE..."
                                                        className="text-[10px] font-bold px-2 py-1.5 rounded border border-gray-300 outline-none flex-1 uppercase shadow-inner focus:border-blue-400 bg-white text-gray-800 placeholder-gray-400"
                                                    />
                                                    <button
                                                        onClick={() => addDocToCategory(catIdx)}
                                                        className="bg-gray-800 hover:bg-black text-white px-3 py-1.5 rounded text-[10px] font-bold shadow-sm uppercase shrink-0 transition"
                                                    >
                                                        ADD DOC
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Add category row */}
                    {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'settings', 'create')) && (
                        <div className="p-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center gap-2 bg-gray-50/50 mt-4 hover:border-blue-400 transition">
                            <input
                                type="text"
                                value={atNewCatInput}
                                onChange={e => setAtNewCatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
                                placeholder="NEW CATEGORY HEADING..."
                                className="text-[11px] font-bold px-3 py-2 rounded border border-gray-300 outline-none flex-1 uppercase shadow-inner focus:border-blue-400 bg-white text-gray-800 placeholder-gray-400"
                            />
                            <button
                                onClick={addCategory}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-[11px] font-bold shadow-sm uppercase shrink-0 transition"
                            >
                                Add Category
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Footer: Auto-save note ── */}
                <div className="p-2 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
                    <span className="text-[9px] text-gray-400 italic">✓ Changes are saved automatically</span>
                </div>
            </div>
        );
    };

    const renderCompanyDataTable = () => {
        const totalPages = Math.ceil(totalCompanies / itemsPerPage);
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalCompanies);

        const handlePageChange = (newPage) => {
            if (newPage >= 1 && newPage <= totalPages) {
                setCurrentPage(newPage);
                loadCompanyData(newPage, itemsPerPage);
            }
        };

        const handleItemsPerPageChange = (newItemsPerPage) => {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
            loadCompanyData(1, newItemsPerPage);
        };

        return (
            <div className="space-y-6">
                {/* Inline Excel Upload Section (collapsible) */}
                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                    <button
                        onClick={() => setShowInlineUpload(!showInlineUpload)}
                        className="w-full p-4 flex items-center justify-between text-white hover:bg-gray-700 transition-colors"
                    >
                        <span className="flex items-center gap-2 font-semibold text-base">
                            <Upload className="text-blue-400" size={20} />
                            Upload Company Data Excel
                        </span>
                        {showInlineUpload ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </button>
                    {showInlineUpload && (
                        <div className="p-5 border-t border-gray-700">
                            {activeUploads.size > 0 && (
                                <div className="mb-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                    <h4 className="text-blue-400 font-medium mb-2 text-sm">🔄 Active Processing ({activeUploads.size})</h4>
                                    {Array.from(activeUploads.entries()).map(([uploadId, upload]) => (
                                        <div key={uploadId} className="mb-2 last:mb-0">
                                            <div className="flex justify-between text-xs text-blue-200 mb-1">
                                                <span>{upload.filename}</span>
                                                <span>{upload.progress}%</span>
                                            </div>
                                            <div className="bg-blue-800 rounded-full h-1.5">
                                                <div
                                                    className="bg-gradient-to-r from-blue-400 to-green-400 h-1.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${upload.progress}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-blue-300 mt-0.5">{upload.message || upload.status}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <label
                                        htmlFor="inline-file-upload"
                                        className="cursor-pointer flex items-center gap-2 bg-gray-700 border border-gray-600 hover:border-blue-500 text-gray-200 px-4 py-2.5 rounded-lg transition-colors"
                                    >
                                        <FileSpreadsheet size={18} className="text-blue-400 flex-shrink-0" />
                                        <span className="truncate text-sm">
                                            {uploadFile ? uploadFile.name : 'Choose Excel file (.xlsx, .xls)'}
                                        </span>
                                    </label>
                                    <input
                                        id="inline-file-upload"
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            setUploadFile(file);
                                        }}
                                        className="hidden"
                                    />
                                </div>
                                {uploadFile && (
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {uploadProgress > 0 && (
                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                <div className="w-24 bg-gray-600 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={handleFileUpload}
                                            disabled={loading}
                                            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 shadow text-sm font-medium"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={16} />
                                                    Upload
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setUploadFile(null); setUploadProgress(0); }}
                                            className="text-gray-400 hover:text-red-400 transition-colors p-1"
                                            title="Remove file"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Required columns: COMPANY NAME, CATEGORIES, BANK</p>
                        </div>
                    )}
                </div>

                {/* Bank Management - Searchable Dropdown with Table */}
                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700" style={{ overflow: 'visible' }}>
                    <div className="p-5 border-b border-gray-700 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Building className="text-orange-400" size={20} />
                            Bank Management
                            {bankStats.length > 0 && (
                                <span style={{fontSize: 11, fontWeight: 600, color: '#a1a1aa', marginLeft: 4}}>
                                    {bankStats.length} banks · {bankStats.reduce((s, b) => s + b.count, 0).toLocaleString()} total
                                </span>
                            )}
                        </h3>
                        {selectedBankFilter && (
                            <button
                                onClick={() => {
                                    setSelectedBankFilter('');
                                    setCurrentPage(1);
                                    loadCompanyData(1, itemsPerPage);
                                }}
                                className="flex items-center gap-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-gray-600"
                            >
                                <X size={14} />
                                Clear Filter
                            </button>
                        )}
                    </div>
                    <div className="p-4">
                        {/* Searchable trigger input */}
                        <div style={{ position: 'relative' }} data-bank-dropdown>
                            <div
                                onClick={() => setShowBankDropdown(v => !v)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: '#0d0d10', border: `1px solid ${showBankDropdown ? '#f97316' : '#3f3f46'}`,
                                    borderRadius: showBankDropdown ? '8px 8px 0 0' : 8,
                                    padding: '8px 12px', cursor: 'pointer', transition: 'border-color 0.15s',
                                    userSelect: 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Building size={14} style={{ color: '#f97316', flexShrink: 0 }} />
                                    {selectedBankFilter ? (
                                        <span style={{ color: '#f97316', fontWeight: 600, fontSize: 13 }}>{selectedBankFilter}</span>
                                    ) : (
                                        <span style={{ color: '#71717a', fontSize: 13 }}>
                                            {bankStats.length === 0 ? 'No banks available' : `Select a bank to filter... (${bankStats.length} banks)`}
                                        </span>
                                    )}
                                </div>
                                <svg width="12" height="8" viewBox="0 0 12 8" style={{ color: '#71717a', transition: 'transform 0.2s', transform: showBankDropdown ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                                    <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>

                            {/* Dropdown panel */}
                            {showBankDropdown && bankStats.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                                    background: '#09090b', border: '1px solid #27272a', borderTop: 'none',
                                    borderRadius: '0 0 8px 8px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)',
                                    maxHeight: 340, display: 'flex', flexDirection: 'column',
                                }}>
                                    {/* Search inside dropdown */}
                                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #1f1f22', flexShrink: 0 }}>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={bankSearchQuery}
                                                onChange={e => setBankSearchQuery(e.target.value)}
                                                placeholder="Search banks..."
                                                style={{
                                                    width: '100%', boxSizing: 'border-box',
                                                    background: '#111115', border: '1px solid #27272a', borderRadius: 6,
                                                    padding: '5px 8px 5px 26px', color: '#fff',
                                                    fontFamily: 'inherit', fontSize: 12, outline: 'none',
                                                }}
                                            />
                                            {bankSearchQuery && (
                                                <button onClick={() => setBankSearchQuery('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                                    <X size={11} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Table header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', padding: '6px 10px', borderBottom: '1px solid #1f1f22', flexShrink: 0 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#52525b' }}>Bank Name</span>
                                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#52525b', textAlign: 'right' }}>Entries</span>
                                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#52525b', textAlign: 'right', paddingRight: 4 }}>Last Updated</span>
                                        <span></span>
                                    </div>

                                    {/* Bank rows */}
                                    <div style={{ overflowY: 'auto', flex: 1 }}>
                                        {(() => {
                                            const maxCount = Math.max(...bankStats.map(s => s.count));
                                            const filtered = bankStats.filter(s =>
                                                !bankSearchQuery || s.bank_name.toLowerCase().includes(bankSearchQuery.toLowerCase())
                                            );
                                            if (filtered.length === 0) return (
                                                <div style={{ padding: '16px', textAlign: 'center', color: '#52525b', fontSize: 12 }}>No banks match your search</div>
                                            );
                                            return filtered.map(stat => {
                                                const pct = maxCount > 0 ? Math.round((stat.count / maxCount) * 100) : 0;
                                                const isSelected = selectedBankFilter === stat.bank_name;
                                                return (
                                                    <div
                                                        key={stat.bank_name}
                                                        style={{
                                                            display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px',
                                                            padding: '7px 10px', alignItems: 'center',
                                                            borderBottom: '1px solid #111115', cursor: 'pointer',
                                                            background: isSelected ? 'rgba(249,115,22,0.12)' : 'transparent',
                                                            borderLeft: isSelected ? '2px solid #f97316' : '2px solid transparent',
                                                            transition: 'background 0.1s',
                                                        }}
                                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#111115'; }}
                                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                        onClick={() => {
                                                            handleBankFilterChange(isSelected ? '' : stat.bank_name);
                                                            setShowBankDropdown(false);
                                                            setBankSearchQuery('');
                                                        }}
                                                    >
                                                        {/* Bank Name + bar */}
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#f97316' : '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {stat.bank_name}
                                                            </div>
                                                            <div style={{ height: 2, background: '#1f1f22', borderRadius: 2, marginTop: 3, overflow: 'hidden', maxWidth: 180 }}>
                                                                <div style={{ height: '100%', background: isSelected ? '#f97316' : '#0ea5e9', width: `${pct}%`, borderRadius: 2 }} />
                                                            </div>
                                                        </div>
                                                        {/* Count */}
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#f97316' : '#0ea5e9', textAlign: 'right' }}>
                                                            {stat.count.toLocaleString()}
                                                        </div>
                                                        {/* Date */}
                                                        <div style={{ fontSize: 10, color: '#71717a', textAlign: 'right', paddingRight: 4 }}>
                                                            {stat.last_updated ? new Date(stat.last_updated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                        </div>
                                                        {/* Delete */}
                                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setBankToDelete(stat.bank_name); setShowBankDeleteModal(true); setShowBankDropdown(false); }}
                                                                title={`Delete ${stat.bank_name}`}
                                                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 3, opacity: 0.4, display: 'flex', borderRadius: 4 }}
                                                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                                onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search Section */}
                <div className="bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Search className="text-green-400" size={20} />
                        Search Similar Companies
                    </h3>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCompanySearch()}
                                placeholder="Enter company name to search..."
                                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 pr-9 focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    title="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleCompanySearch}
                            disabled={loading}
                            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 shadow-lg"
                        >
                            <Search size={16} />
                            Search
                        </button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-white text-sm">{searchResults.length} result(s) found:</h4>
                                <button
                                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    <X size={12} /> Close
                                </button>
                            </div>
                            <div className="space-y-2">
                                {searchResults.map((result, index) => (
                                    <div key={index} className="bg-gray-700 p-3 rounded-lg border border-gray-600">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-white text-sm">{result.company_name}</p>
                                                <p className="text-xs text-gray-300 mt-0.5">Categories: {result.categories.join(', ')}</p>
                                                <p className="text-xs text-gray-300">Banks: {result.bank_names.join(', ')}</p>
                                            </div>
                                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-medium ml-3 flex-shrink-0">
                                                {result.similarity_percentage}% match
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Company Data Table */}
                <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
                    {/* Header with pagination controls */}
                    <div className="p-6 border-b border-gray-700 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Building className="text-orange-400" size={24} />
                                Company Data 
                                {selectedBankFilter && ` - ${selectedBankFilter}`}
                            </h3>
                            <p className="text-sm text-gray-300 mt-1">
                                Showing {startItem}-{endItem} of {totalCompanies} companies
                            </p>
                        </div>
                        
                        {/* Items per page selector */}
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-gray-300">
                                Show:
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
                                    className="ml-2 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                </select>
                                per page
                            </label>
                        </div>
                    </div>

                    {/* Loading indicator */}
                    {isLoadingCompanies && (
                        <div className="p-6 text-center">
                            <div className="inline-flex items-center gap-2 text-gray-300">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                Loading companies...
                            </div>
                        </div>
                    )}

                    {!isLoadingCompanies && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Company Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Categories
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Bank Names
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {companyData.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Building size={48} className="text-gray-600" />
                                                    <div>
                                                        <p className="text-lg font-medium">
                                                            {selectedBankFilter ? 
                                                                `No companies found for bank "${selectedBankFilter}"` : 
                                                                'No company data available'
                                                            }
                                                        </p>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {!selectedBankFilter && 'Upload an Excel file to get started.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        companyData.map((company, index) => (
                                            <tr key={company.id || index} className="hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-white">
                                                    <div className="flex items-center gap-2">
                                                        <Building size={16} className="text-orange-400 flex-shrink-0" />
                                                        <span className="truncate">{company.company_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(company.categories || []).map((category, idx) => (
                                                            <span key={idx} className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                                {category}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(company.bank_names || []).map((bank, idx) => (
                                                            <span key={idx} className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                                {bank}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <button
                                                        onClick={() => handleDelete(company.id, 'companyData')}
                                                        className="text-red-400 hover:text-red-300 transition-colors p-1 rounded hover:bg-red-900/20"
                                                        title="Delete this company"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!isLoadingCompanies && totalPages > 1 && (
                        <div className="bg-gray-900 px-6 py-4 border-t border-gray-700">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="text-sm text-gray-300">
                                    Showing {startItem} to {endItem} of {totalCompanies} results
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {/* First page button */}
                                    <button
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="First page"
                                    >
                                        ««
                                    </button>
                                    
                                    {/* Previous page button */}
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Previous page"
                                    >
                                        ‹
                                    </button>

                                    {/* Page numbers */}
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                                    currentPage === pageNum
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}

                                    {/* Next page button */}
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Next page"
                                    >
                                        ›
                                    </button>
                                    
                                    {/* Last page button */}
                                    <button
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Last page"
                                    >
                                        »»
                                    </button>

                                    {/* Go to page input */}
                                    <div className="flex items-center gap-2 ml-4">
                                        <span className="text-sm text-gray-300">Go to:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max={totalPages}
                                            value={currentPage}
                                            onChange={(e) => {
                                                const page = parseInt(e.target.value);
                                                if (page >= 1 && page <= totalPages) {
                                                    handlePageChange(page);
                                                }
                                            }}
                                            className="w-16 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bank Delete Confirmation Modal */}
                {showBankDeleteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
                            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                                <AlertCircle size={24} />
                                ⚠️ Confirm Bulk Delete
                            </h3>
                            <p className="text-gray-300 mb-6">
                                Are you sure you want to delete <strong>ALL</strong> companies for bank <strong className="text-orange-400">"{bankToDelete}"</strong>?
                                <br /><br />
                                <span className="text-red-400">This action will permanently remove all company records associated with this bank and cannot be undone.</span>
                            </p>
                            <div className="flex gap-4 justify-end">
                                <button
                                    onClick={() => {
                                        setShowBankDeleteModal(false);
                                        setBankToDelete('');
                                    }}
                                    className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteByBank}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Delete All
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderExcelUpload = () => {
        // Check if user has permission to upload Excel files (create permission)
        // For now, also allow if user has any admin permissions as fallback
        const canUpload = isSuperAdmin(userPermissions) ||
            hasPermission(userPermissions, 'settings', 'create');

        if (!canUpload) {
            return (
                <div className="bg-black rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Upload Excel File</h3>
                    <div className="bg-black border border-black rounded-lg p-4 text-center">
                        <Lock className="h-8 w-8 text-white mx-auto mb-2" />
                        <p className="text-white">You don't have permission to upload Excel files.</p>
                        <p className="text-sm text-white mt-1">Required permission: settings.create</p>
                        <div className="mt-2 text-xs text-white">
                            <p>Debug info:</p>
                            <p>Super Admin: {isSuperAdmin(userPermissions) ? 'Yes' : 'No'}</p>
                            <p>Settings Create: {hasPermission(userPermissions, 'settings', 'create') ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-black rounded-xl shadow-lg p-6">
               
                
                {/* Active Uploads Status */}
                {activeUploads.size > 0 && (
                    <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-3">🔄 Active Processing ({activeUploads.size})</h4>
                        {Array.from(activeUploads.entries()).map(([uploadId, upload]) => (
                            <div key={uploadId} className="mb-3 last:mb-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm text-blue-200">{upload.filename}</span>
                                    <span className="text-xs text-blue-300">{upload.progress}%</span>
                                </div>
                                <div className="bg-blue-800 rounded-full h-2">
                                    <div
                                        className="bg-gradient-to-r from-blue-400 to-green-400 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${upload.progress}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-blue-300 mt-1">{upload.message || upload.status}</p>
                            </div>
                        ))}
                    </div>
                )}
                
               

                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                    <Upload size={48} className="mx-auto text-gray-400 mb-4" />

                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            setUploadFile(file);
                            if (file) {
                                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                                console.log(`Selected file: ${file.name} (${sizeMB} MB)`);
                            }
                        }}
                        className="hidden"
                        id="file-upload"
                    />

                    <label
                        htmlFor="file-upload"
                        className="cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2 hover:from-blue-600 hover:to-blue-700 transition-all"
                    >
                        <FileSpreadsheet size={20} />
                        Choose Excel File (.xlsx, .xls)
                    </label>

                    {uploadFile && (
                        <div className="mt-6 bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-left">
                                    <p className="text-white font-medium">📁 {uploadFile.name}</p>
                                    <p className="text-sm text-gray-400">
                                        Size: {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                                        {uploadFile.size > 100 * 1024 * 1024 ? (
                                            <span className="text-yellow-400 ml-2">⚡ Will process in background</span>
                                        ) : (
                                            <span className="text-green-400 ml-2">⚡ Ready for instant upload</span>
                                        )}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setUploadFile(null)}
                                    className="text-red-400 hover:text-red-300"
                                    title="Remove file"
                                >
                                    ✕
                                </button>
                            </div>

                            {uploadProgress > 0 && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                                        <span>Upload Progress</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="bg-gray-700 rounded-full h-3">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleFileUpload}
                                disabled={loading}
                                className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                                    loading
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                                }`}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                                        Uploading...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <Upload size={16} />
                                        ⚡ INSTANT Upload & Background Processing
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>

               
            </div>
        );
    };

    const renderRolesTable = () => (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-black flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Roles & Permissions</h3>
                {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'roles', 'create')) && (
                    <button
                        onClick={() => handleAdd('roles')}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:from-blue-600 hover:to-blue-700 transition-all"
                    >
                        <Plus size={16} />
                        Add Role
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/6">
                                Role Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/6">
                                Department
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/6">
                                Reporting To
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-2/6">
                                Permissions
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/6">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {Array.isArray(roles) && roles.map((role, index) => {
                            // Ensure role has an ID (for debugging)
                            const roleId = role._id || role.id;
                            
                            // Find department name
                            const departmentName = departments.find(d => 
                                (d._id || d.id) === role.department_id
                            )?.name || '-';
                            
                            // Find reporting role name
                            const reportingRoleName = roles.find(r => 
                                (r._id || r.id) === role.reporting_id
                            )?.name || '-';
                            
                            return (
                                <tr key={roleId || index} className="hover:bg-gray-800 transition-colors">
                                    <td className="px-4 py-4 text-sm font-medium text-white">
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                            {role.name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-300">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            departmentName !== '-' 
                                                ? 'bg-blue-100 text-blue-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {departmentName}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-300">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            reportingRoleName !== '-' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {reportingRoleName}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-300">
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                            {role.permissions && role.permissions.length > 0 ? (
                                                <>
                                                    {role.permissions.slice(0, 2).map((perm, idx) => (
                                                        <span key={idx} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                                                            {perm.page}: {Array.isArray(perm.actions) ? perm.actions.join(',') : perm.actions}
                                                        </span>
                                                    ))}
                                                    {role.permissions.length > 2 && (
                                                        <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-xs font-medium">
                                                            +{role.permissions.length - 2} more
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-gray-500 text-xs italic">No permissions</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex gap-2">
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'roles', 'edit')) && (
                                                <button
                                                    onClick={() => handleEdit(role, 'roles')}
                                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                                    title="Edit Role"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                            {(isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'roles', 'delete')) && (
                                                <button
                                                    onClick={() => handleDelete(roleId, 'roles')}
                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                    title="Delete Role"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {(!Array.isArray(roles) || roles.length === 0) && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                    No roles found. Click "Add Role" to create one.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Rendering Modal Functions

    const renderModal = () => {
        if (!showModal) return null;

        // Special handling for roles and permissions modal
        if (activeTab === 'roles') {
            return (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-start justify-center pt-4 pb-4"
                    onClick={(e) => {
                        // Close modal if clicking on backdrop
                        if (e.target === e.currentTarget) {
                            handleCloseModal();
                        }
                    }}
                    style={{ height: '100vh', overflowY: 'auto' }}
                >
                    <div 
                        className="bg-white rounded-xl w-full max-w-4xl mx-4 text-black shadow-2xl flex flex-col"
                        style={{ maxHeight: 'calc(100vh - 2rem)', minHeight: '80vh' }}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        {/* Fixed Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white sticky top-0 z-10 rounded-t-xl">
                            <h3 id="modal-title" className="text-lg font-bold text-black">
                                {modalType === 'add' ? 'Add' : 'Edit'} {tabs.find(t => t.id === activeTab)?.label}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Role Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Department</label>
                                    <select
                                        value={formData.department_id || ''}
                                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value || null })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    >
                                        <option value="">Select Department</option>
                                        {Array.isArray(departments) && departments.map(dept => (
                                            <option key={dept._id || dept.id} value={dept._id || dept.id}>{dept.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Multiple Reporting Roles Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Reporting Roles</label>
                                    <div className="space-y-2">
                                        {/* Display selected reporting roles */}
                                        {(formData.reporting_ids || []).map((reportingId, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <select
                                                    value={reportingId}
                                                    onChange={(e) => {
                                                        const newReportingIds = [...(formData.reporting_ids || [])];
                                                        newReportingIds[index] = e.target.value;
                                                        setFormData({ ...formData, reporting_ids: newReportingIds });
                                                    }}
                                                    className="flex-1 border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                                >
                                                    <option value="">Select Reporting Role</option>
                                                    {roles.filter(r => {
                                                        const roleId = r._id || r.id;
                                                        const editingId = editingItem?._id || editingItem?.id;
                                                        // Don't show current role or already selected roles
                                                        return roleId !== editingId && 
                                                               !(formData.reporting_ids || []).includes(roleId) || 
                                                               roleId === reportingId;
                                                    }).map(role => {
                                                        const roleId = role._id || role.id;
                                                        return (
                                                            <option key={roleId} value={roleId}>{role.name}</option>
                                                        );
                                                    })}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newReportingIds = (formData.reporting_ids || []).filter((_, i) => i !== index);
                                                        setFormData({ ...formData, reporting_ids: newReportingIds });
                                                    }}
                                                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {/* Add new reporting role button */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newReportingIds = [...(formData.reporting_ids || []), ''];
                                                setFormData({ ...formData, reporting_ids: newReportingIds });
                                            }}
                                            className="w-full border-2 border-dashed border-gray-400 rounded-lg px-3 py-2 text-black hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="text-xl">+</span>
                                            <span>Add Reporting Role</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Permission Selection */}
                                <div className="space-y-3 mt-4">
                                    <label className="block text-sm font-medium text-black">Permissions</label>
                                    
                                    {/* Permission Type Selection */}
                                    <div className="flex gap-4">
                                        <label className="flex items-center text-black">
                                            <input
                                                type="radio"
                                                name="permissionType"
                                                value="no_permission"
                                                checked={permissionType === 'no_permission'}
                                                onChange={(e) => setPermissionType(e.target.value)}
                                                className="mr-2"
                                            />
                                            No Permission
                                        </label>
                                        <label className="flex items-center text-black">
                                            <input
                                                type="radio"
                                                name="permissionType"
                                                value="select"
                                                checked={permissionType === 'select'}
                                                onChange={(e) => setPermissionType(e.target.value)}
                                                className="mr-2"
                                            />
                                            Select Permissions
                                        </label>
                                    </div>
                                    
                                    {/* Permission Checkboxes - only show if "Select Permissions" is chosen */}
                                    {permissionType === 'select' && (
                                        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                                            <div className="text-xs text-gray-600 mb-4 flex items-center justify-between">
                                                <span>Select individual permissions (all sections are fully scrollable):</span>
                                                {Object.values(expandedPermissionSections).some(expanded => expanded) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const scrollContainer = document.querySelector('.fixed.inset-0 .flex-1.overflow-y-auto');
                                                            if (scrollContainer) {
                                                                scrollContainer.scrollTo({
                                                                    top: scrollContainer.scrollHeight,
                                                                    behavior: 'smooth'
                                                                });
                                                            }
                                                        }}
                                                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                                    >
                                                        Scroll to Bottom ↓
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-3" style={{ paddingBottom: '300px' }}>
                                                {Object.entries(allPermissions).map(([page, actions], index, array) => {
                                                    const isExpanded = expandedPermissionSections[page] === true;
                                                    const hasWildcard = isPageWildcard(page);
                                                    const shouldShowIndividualPermissions = isExpanded && !hasWildcard;
                                                    const isLastSection = index === array.length - 1;
                                                
                                                return (
                                                <div 
                                                    key={page} 
                                                    data-section={page}
                                                    className="border border-gray-200 rounded-lg bg-white"
                                                    style={{ 
                                                        marginBottom: isLastSection ? '200px' : '12px'
                                                    }}
                                                >
                                                    <div className={`flex items-center justify-between p-3 ${
                                                        expandedPermissionSections[page] ? 'border-b border-gray-200' : ''
                                                    }`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePermissionSection(page)}
                                                            className="flex items-center gap-2 font-semibold text-black hover:text-blue-600 transition-colors"
                                                        >
                                                            <ChevronDown 
                                                                className={`w-4 h-4 transform transition-transform ${
                                                                    expandedPermissionSections[page] ? 'rotate-0' : '-rotate-90'
                                                                }`} 
                                                            />
                                                            <span>{page.charAt(0).toUpperCase() + page.slice(1)}</span>
                                                        </button>
                                                        <label className="flex items-center text-sm text-black">
                                                            <input
                                                                type="checkbox"
                                                                checked={isPageWildcard(page)}
                                                                onChange={(e) => handlePageWildcard(page, e.target.checked)}
                                                                className="mr-1"
                                                            />
                                                            All ({page} *)
                                                        </label>
                                                    </div>
                                                    {/* Individual permissions - ONLY show if section is explicitly expanded */}
                                                    {expandedPermissionSections[page] && (
                                                        <div 
                                                            className="grid grid-cols-2 gap-2 p-3"
                                                            style={{ 
                                                                paddingBottom: isLastSection ? '150px' : '12px'
                                                            }}
                                                        >
                                                            {!isPageWildcard(page) && actions.filter(action => action !== '*').map((action) => (
                                                                <label key={action} className="flex items-center text-sm text-black mb-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isPermissionChecked(page, action)}
                                                                        onChange={(e) => handlePermissionChange(page, action, e.target.checked)}
                                                                        className="mr-2"
                                                                    />
                                                                    {action}
                                                                </label>
                                                            ))}
                                                            {isPageWildcard(page) && (
                                                                <div className="text-gray-500 italic">All permissions selected via wildcard (*)</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Fixed Footer */}
                        <div className="border-t border-gray-200 p-6 bg-white sticky bottom-0 rounded-b-xl">
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-black border border-black rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {modalType === 'add' ? 'Add' : 'Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Default modal for other tabs
        return (
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-[9999] overflow-y-auto"
                onClick={(e) => {
                    // Close modal if clicking on backdrop
                    if (e.target === e.currentTarget) {
                        handleCloseModal();
                    }
                }}
            >
                <div 
                    className="bg-white rounded-xl w-full max-w-4xl mx-auto my-8 text-black shadow-2xl"
                    style={{ minHeight: 'calc(100vh - 4rem)' }}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    {/* Fixed Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
                        <h3 id="modal-title" className="text-lg font-bold text-black">
                            {modalType === 'add' ? 'Add' : 'Edit'} {tabs.find(t => t.id === activeTab)?.label}
                        </h3>
                        <button
                            onClick={handleCloseModal}
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors"
                            aria-label="Close modal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                        <div className="space-y-4">
                        {/* Dynamic form fields based on active tab */}
                        {activeTab === 'campaigns' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        rows="3"
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'dataCodes' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        rows="3"
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'bankNames' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Bank Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'channelNames' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Channel Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        rows="3"
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'attachmentTypes' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Attachment Type Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., Aadhar Card, PAN Card, Resume"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Target Type *</label>
                                    <select
                                        value={formData.target_type || 'employees'}
                                        onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    >
                                        <option value="employees">Employees</option>
                                        <option value="leads">Leads</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Sort Number *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.sort_number || ''}
                                        onChange={(e) => setFormData({ ...formData, sort_number: parseInt(e.target.value) || '' })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="Enter sort order (1, 2, 3, etc.)"
                                    />
                                    <p className="text-xs text-gray-600 mt-1">
                                        Sort order within the target type. Must be unique (e.g., 1, 2, 3, etc.)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        rows="3"
                                        placeholder="Brief description of this attachment type"
                                    />
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="attachment-active"
                                        checked={formData.is_active !== false}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <label htmlFor="attachment-active" className="text-sm text-black">Active</label>
                                </div>
                            </>
                        )}

                        {activeTab === 'departments' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Department Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        rows="3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Parent Department</label>
                                    <select
                                        value={formData.parent_id || ''}
                                        onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    >
                                        <option value="">No Parent</option>
                                        {departments.filter(d => (d._id || d.id) !== (editingItem?._id || editingItem?.id)).map(dept => {
                                            const deptId = dept._id || dept.id;
                                            console.log(`Department option: ${dept.name}, ID: ${deptId}`);
                                            return (
                                                <option key={deptId} value={deptId}>{dept.name}</option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </>
                        )}

                        {activeTab === 'designations' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Name of Designation *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., Senior Manager, Team Lead, Developer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Reports To</label>
                                    <div className="relative">
                                        <div
                                            className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black cursor-pointer bg-white flex justify-between items-center"
                                            onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                                        >
                                            <span className="flex-1">
                                                {formData.department_id ? 
                                                    getDepartmentById(formData.department_id)?.name || 'Select Department'
                                                    : 'Select Department'
                                                }
                                            </span>
                                            <ChevronDown 
                                                size={16} 
                                                className={`transform transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} 
                                            />
                                        </div>
                                        
                                        {showDepartmentDropdown && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-auto">
                                                {/* Search Box */}
                                                <div className="p-2 border-b border-gray-100">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search departments..."
                                                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                
                                                <div className="py-1">
                                                    <div 
                                                        className="px-3 py-2 text-gray-500 hover:bg-yellow-50 cursor-pointer bg-yellow-100 border-b border-gray-100"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setFormData({ ...formData, department_id: '' });
                                                            setShowDepartmentDropdown(false);
                                                            setExpandedDepartments(new Set());
                                                        }}
                                                    >
                                                        -- No Department --
                                                        <div className="text-xs text-gray-400">No department assignment</div>
                                                    </div>
                                                    
                                                    {getParentDepartments().map(dept => {
                                                        const deptId = dept._id || dept.id;
                                                        const hasSubDepts = hasSubDepartments(deptId);
                                                        const isExpanded = expandedDepartments.has(deptId);
                                                        const subDepts = getSubDepartments(deptId);
                                                        
                                                        return (
                                                            <div key={deptId} className="border-b border-gray-100 last:border-b-0">
                                                                {/* Parent Department Row */}
                                                                <div className="flex items-center hover:bg-gray-50">
                                                                    {/* Arrow button - small, only for departments with sub-departments */}
                                                                    <div className="w-8 flex justify-center">
                                                                        {hasSubDepts ? (
                                                                            <button
                                                                                type="button"
                                                                                className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    console.log('Toggling expansion for:', dept.name, 'Currently expanded:', isExpanded);
                                                                                    const newExpanded = new Set(expandedDepartments);
                                                                                    if (isExpanded) {
                                                                                        newExpanded.delete(deptId);
                                                                                    } else {
                                                                                        newExpanded.add(deptId);
                                                                                    }
                                                                                    setExpandedDepartments(newExpanded);
                                                                                }}
                                                                                title={isExpanded ? 'Collapse sub-departments' : 'Show sub-departments'}
                                                                            >
                                                                                <svg 
                                                                                    className={`w-3 h-3 transform transition-transform text-gray-600 ${isExpanded ? 'rotate-90' : ''}`}
                                                                                    fill="none" 
                                                                                    stroke="currentColor" 
                                                                                    viewBox="0 0 24 24"
                                                                                >
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                                </svg>
                                                                            </button>
                                                                        ) : (
                                                                            <div className="w-6 h-6 flex items-center justify-center">
                                                                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                                                                    <path d="M10 2v20l-5.5-5.5L10 2z"/>
                                                                                    <rect x="12" y="9" width="10" height="6" rx="1"/>
                                                                                </svg>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* Main clickable area for selecting the department */}
                                                                    <div
                                                                        className={`flex-1 px-3 py-3 cursor-pointer hover:bg-blue-50 flex items-center transition-colors ${
                                                                            formData.department_id === deptId ? 'bg-blue-100 text-blue-700' : 'text-black'
                                                                        }`}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            console.log('Selecting main department:', dept.name, deptId);
                                                                            // Always select the main department when clicking the text area
                                                                            setFormData({ ...formData, department_id: deptId });
                                                                            setShowDepartmentDropdown(false);
                                                                            setExpandedDepartments(new Set());
                                                                        }}
                                                                    >
                                                                        <span className="flex-1 font-medium">{dept.name}</span>
                                                                        {hasSubDepts && (
                                                                            <span className="text-xs text-gray-500 ml-2">
                                                                                {subDepts.length} sub-department{subDepts.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Sub-departments */}
                                                                {hasSubDepts && isExpanded && (
                                                                    <div className="bg-gray-50">
                                                                        {subDepts.map(subDept => {
                                                                            const subDeptId = subDept._id || subDept.id;
                                                                            return (
                                                                                <div
                                                                                    key={subDeptId}
                                                                                    className={`px-6 py-2 cursor-pointer hover:bg-blue-50 flex items-center border-l-4 border-blue-200 ${
                                                                                        formData.department_id === subDeptId ? 'bg-blue-100 text-blue-700 border-blue-500' : 'text-gray-700'
                                                                                    }`}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        console.log('Selecting sub-department:', subDept.name, subDeptId);
                                                                                        setFormData({ ...formData, department_id: subDeptId });
                                                                                        setShowDepartmentDropdown(false);
                                                                                        setExpandedDepartments(new Set());
                                                                                    }}
                                                                                >
                                                                                    <span className="flex-1 text-sm">→ {subDept.name}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Message</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        rows="3"
                                        placeholder="Description or message about this designation"
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'emailSettings' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Email Address *</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., otp@yourcompany.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Email Password *</label>
                                    <input
                                        type="password"
                                        value={formData.password || ''}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="Enter email password"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">SMTP Server *</label>
                                    <input
                                        type="text"
                                        value={formData.smtp_server || 'smtp.gmail.com'}
                                        onChange={(e) => setFormData({ ...formData, smtp_server: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., smtp.gmail.com, smtp.outlook.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">SMTP Port *</label>
                                    <input
                                        type="number"
                                        value={formData.smtp_port || 587}
                                        onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., 587, 465, 25"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Purpose</label>
                                    <select
                                        value={formData.purpose || 'otp'}
                                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    >
                                        <option value="otp">OTP (One-Time Password)</option>
                                        
                                        <option value="general">None</option>
                                    </select>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="email-use-ssl"
                                        checked={formData.use_ssl !== false}
                                        onChange={(e) => setFormData({ ...formData, use_ssl: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <label htmlFor="email-use-ssl" className="text-sm text-black">Use SSL/TLS</label>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-800 mb-2">Common SMTP Settings:</h4>
                                    <div className="text-sm text-blue-700 space-y-1">
                                        <p><strong>Gmail:</strong> smtp.gmail.com, Port 587 (SSL)</p>
                                        <p><strong>Outlook:</strong> smtp.live.com, Port 587 (SSL)</p>
                                        <p><strong>Yahoo:</strong> smtp.mail.yahoo.com, Port 587 (SSL)</p>
                                        <p><strong>Custom Domain:</strong> Check with your hosting provider</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'adminEmails' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Admin Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., John Doe"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Email Address *</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., admin@yourcompany.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Department</label>
                                    <input
                                        type="text"
                                        value={formData.department || ''}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., IT, HR, Admin"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Role</label>
                                    <input
                                        type="text"
                                        value={formData.role || 'Admin'}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., Admin, Super Admin, Manager"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="admin-receive-otp"
                                            checked={formData.receive_otp !== false}
                                            onChange={(e) => setFormData({ ...formData, receive_otp: e.target.checked })}
                                            className="mr-2"
                                        />
                                        <label htmlFor="admin-receive-otp" className="text-sm text-black">
                                            <strong>Receive OTP Codes</strong> - This admin will receive OTP codes when employees request login
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="admin-receive-notifications"
                                            checked={formData.receive_notifications !== false}
                                            onChange={(e) => setFormData({ ...formData, receive_notifications: e.target.checked })}
                                            className="mr-2"
                                        />
                                        <label htmlFor="admin-receive-notifications" className="text-sm text-black">
                                            <strong>Receive Notifications</strong> - This admin will receive general system notifications
                                        </label>
                                    </div>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-amber-800 mb-2">🔐 Security Note:</h4>
                                    <div className="text-sm text-amber-700 space-y-1">
                                        <p><strong>Centralized OTP Security:</strong> OTP codes will be sent to admin emails instead of individual users.</p>
                                        <p><strong>Employee Process:</strong> Employees will need to contact admins to get their OTP codes for login.</p>
                                        <p><strong>Admin Responsibility:</strong> Admins should verify employee identity before sharing OTP codes.</p>
                                        <p><strong>Email Setup:</strong> Ensure admin emails are properly configured and monitored.</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'importantQuestions' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Question Text *</label>
                                    <textarea
                                        value={formData.question || ''}
                                        onChange={(e) => {
                                            setFormData({ ...formData, question: e.target.value });
                                            // Auto-resize the textarea
                                            e.target.style.height = 'auto';
                                            e.target.style.height = (e.target.scrollHeight) + 'px';
                                        }}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder="e.g., Has customer provided all required documents?"
                                        rows="3"
                                        style={{ minHeight: '80px', resize: 'vertical' }}
                                        required
                                    />
                                    <p className="mt-1 text-sm text-gray-500">
                                        You can write multi-line questions. Line breaks will be preserved when displayed.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Question Type *</label>
                                    <select
                                        value={formData.type || 'checkbox'}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    >
                                        <option value="checkbox">Checkbox (Yes/No)</option>
                                        <option value="text">Text Input</option>
                                        <option value="select">Dropdown Select</option>
                                        <option value="radio">Radio Button</option>
                                    </select>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="mandatory"
                                        checked={formData.mandatory !== false}
                                        onChange={(e) => setFormData({ ...formData, mandatory: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <label htmlFor="mandatory" className="text-sm font-medium text-black">
                                        <strong>Mandatory Question</strong> - Must be answered before proceeding
                                    </label>
                                </div>
                                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-violet-800 mb-2">💡 Usage Information:</h4>
                                    <div className="text-sm text-violet-700 space-y-1">
                                        <p><strong>Lead Processing:</strong> Questions appear during lead validation workflow.</p>
                                        <p><strong>Quality Control:</strong> Ensures critical information is checked before advancing leads.</p>
                                        <p><strong>Compliance:</strong> Helps maintain consistent verification processes.</p>
                                        <p><strong>Ordering:</strong> Questions display in the order of their display order value.</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {(activeTab === 'mistakeType' || activeTab === 'warningAction') && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">
                                        {activeTab === 'mistakeType' ? 'Mistake Type' : 'Warning Action'} Value *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.value || ''}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder={activeTab === 'mistakeType' ? 'e.g., Late Arrival, Abuse, Early Leave' : 'e.g., Verbal Warning, Written Warning'}
                                        required
                                    />
                                    <p className="mt-1 text-sm text-gray-500">
                                        This will appear in the {activeTab === 'mistakeType' ? 'mistake type' : 'warning action'} dropdown when issuing warnings.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Display Label *</label>
                                    <input
                                        type="text"
                                        value={formData.label || ''}
                                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                        className="w-full border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                        placeholder={formData.value || 'Same as value above'}
                                        required
                                    />
                                    <p className="mt-1 text-sm text-gray-500">
                                        The display name shown in the dropdown (usually same as value).
                                    </p>
                                </div>
                                <div className={`${activeTab === 'mistakeType' ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
                                    <h4 className="font-semibold text-orange-800 mb-2">💡 Usage Information:</h4>
                                    <div className="text-sm text-orange-700 space-y-1">
                                        <p><strong>Warning System:</strong> Types appear in the warning/mistake type dropdown.</p>
                                        <p><strong>Consistency:</strong> Ensures standardized warning categorization across the system.</p>
                                        <p><strong>Flexibility:</strong> Easily add or modify warning types as needed.</p>
                                        <p><strong>Ordering:</strong> Types display in alphabetical order by default.</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Active status checkbox for all items */}
                        <div className="flex items-center">
                            <label className="block text-sm font-medium text-black mr-3">Status</label>
                            <select
                                value={formData.is_active !== false ? 'active' : 'inactive'}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                                className="w-40 border border-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Deactivate</option>
                            </select>
                        </div>
                        </div>
                    </div>
                    
                    {/* Fixed Footer */}
                    <div className="flex gap-3 p-6 border-t border-gray-200 bg-white sticky bottom-0">
                        <button
                            onClick={handleCloseModal}
                            className="flex-1 bg-gray-200 text-black py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="max-w-md w-full bg-black rounded-lg shadow-lg p-8 text-center">
                    <AlertCircle className="h-16 w-16 text-white mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
                    <p className="text-white mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (!permissionsLoaded) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white">Loading permissions...</p>
                </div>
            </div>
        );
    }

    // Access denied component
    if (!hasSettingsAccess) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="max-w-md w-full bg-black rounded-lg shadow-lg p-8 text-center">
                    <Lock className="h-16 w-16 text-white mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-white mb-4">
                        You don't have permission to access the Settings page.
                        Please contact your administrator if you need access.
                    </p>
                    <div className="bg-black border border-black rounded-lg p-4">
                        <div className="flex items-center">
                            <Shield className="h-5 w-5 text-white mr-2" />
                            <span className="text-sm text-white">
                                Required permission: <code className="bg-black px-2 py-1 rounded">settings.view</code>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="bg-black shadow-sm border-b border-black">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <Settings className="h-8 w-8 text-white mr-3" />
                            <h1 className="text-2xl font-bold text-white">Settings Management</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
                
                {/* Tab Management Dropdown and Tab Buttons */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {/* Tab Management Dropdown as first button */}
                    <TabManageDropdown 
                        tabs={tabs}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                    
                    {/* Core Management Dropdown as second button */}
                    <CoreManageDropdown 
                        tabs={tabs}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                    
                    {/* Other Management Dropdown as third button */}
                    <OtherManageDropdown 
                        tabs={tabs}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                </div>

                {/* Content */}
                <div className="space-y-6">
                    {renderTabContent()}
                </div>
            </div>

            {/* Modal */}
            {renderModal()}
        </div>
    );
};

export default SettingsPage;
