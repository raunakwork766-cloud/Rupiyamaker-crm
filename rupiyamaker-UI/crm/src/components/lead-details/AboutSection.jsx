import React, { useState, useEffect, useRef } from 'react';
import { Save, User, ChevronDown, ChevronUp } from 'lucide-react';
import { isSuperAdmin, hasPermission, getUserPermissions } from '../../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Assignment Popup Component
const AssignmentPopup = ({ isOpen, onClose, onAssign, users, title, selectedUsers = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState(
        selectedUsers.map(user => user.id || user._id || user.user_id)
    );

    const filteredUsers = users.filter(user =>
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUserToggle = (user) => {
        const userId = user._id || user.id || user.user_id;
        const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
        
        setSelectedUserIds(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleAssign = () => {
        const selectedUsersData = users
            .filter(user => selectedUserIds.includes(user._id || user.id || user.user_id))
            .map(user => ({
                id: user._id || user.id || user.user_id,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
            }));
        
        onAssign(selectedUsersData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-h-[70vh] overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                
                <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded mb-4"
                />
                
                <div className="max-h-60 overflow-y-auto mb-4">
                    {filteredUsers.map(user => {
                        const userId = user._id || user.id || user.user_id;
                        const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                        const isSelected = selectedUserIds.includes(userId);
                        
                        return (
                            <div
                                key={userId}
                                className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                                    isSelected ? 'bg-blue-100 border border-blue-300' : ''
                                }`}
                                onClick={() => handleUserToggle(user)}
                            >
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleUserToggle(user)}
                                        className="mr-2"
                                    />
                                    <span>{userName}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Assign ({selectedUserIds.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function AboutSection({ leadData, lead, onUpdate, currentUserRole }) {
    console.log('🚀 AboutSection: Component initialized with props:', {
        hasLeadData: !!leadData,
        hasLead: !!lead,
        hasOnUpdate: !!onUpdate,
        hasCurrentUserRole: !!currentUserRole
    });
    const [editableData, setEditableData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [open, setOpen] = useState(true);

    // Assignment-related state
    const [assignedTo, setAssignedTo] = useState([]);
    const [assignedTL, setAssignedTL] = useState([]);
    const [showAssignToPopup, setShowAssignToPopup] = useState(false);
    const [showAssignTLPopup, setShowAssignTLPopup] = useState(false);
    const [sameRoleUsers, setSameRoleUsers] = useState([]);
    const [seniorUsers, setSeniorUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [currentUserData, setCurrentUserData] = useState(null);

    // Handle prop naming differences between components (leadData vs lead)
    const leadInfo = leadData || lead || {};

    // Track which field is being edited to avoid duplicate saves
    const lastSavedData = useRef({});

    // Get user permissions from localStorage if not passed via props
    const userPermissions = currentUserRole?.permissions || getUserPermissions();

    // Check if user can edit all fields (super admin or has leads edit permission)
    const canEditAll = isSuperAdmin(userPermissions) || hasPermission(userPermissions, 'leads', 'edit');
    const isSuperAdminUser = isSuperAdmin(userPermissions);
    
    // State to track if alternative phone was ever saved (to prevent multiple edits by non-super admin)
    const [alternativePhoneEditHistory, setAlternativePhoneEditHistory] = useState(null);
    
    // State to track if user is currently editing alternative phone (before first blur)
    const [isEditingAlternativePhone, setIsEditingAlternativePhone] = useState(false);
    
    // Ref to track if current editing session is allowed (persists during re-renders)
    const allowEditingSession = useRef(false);

    // Helper function to determine if user can edit alternative phone
    const canEditAlternativePhone = () => {
        console.log('🔍 canEditAlternativePhone called with states:', {
            isSuperAdminUser,
            isEditingAlternativePhone,
            alternativePhoneEditHistory,
            currentAltPhone: leadInfo.alternative_phone
        });
        
        // Super admin can always edit
        if (isSuperAdminUser) {
            console.log('📱 Alternative phone edit check: Super admin - ALLOWED');
            return true;
        }
        
        // If user is currently editing, they can continue editing until they unfocus
        if (isEditingAlternativePhone) {
            console.log('📱 Alternative phone edit check: Currently editing - ALLOWED');
            return true;
        }
        
        // For initial permission check (before editing starts), check original field value
        const currentAltPhone = leadInfo.alternative_phone;
        const isOriginallyEmpty = !currentAltPhone || 
                                currentAltPhone.trim() === '' || 
                                currentAltPhone.toLowerCase() === 'n/a' || 
                                currentAltPhone.toLowerCase() === 'none' || 
                                currentAltPhone.toLowerCase() === 'null';
        
        const canEdit = isOriginallyEmpty && !alternativePhoneEditHistory;
        
        console.log('📱 Alternative phone edit check:', {
            originalValue: currentAltPhone,
            isOriginallyEmpty,
            hasEditHistory: alternativePhoneEditHistory,
            isCurrentlyEditing: isEditingAlternativePhone,
            canEdit,
            isSuperAdmin: isSuperAdminUser
        });
        
        return canEdit;
    };
    
    // Simple function to check if field should be editable (used for disabled property)
    const shouldFieldBeEditable = () => {
        // If we have an active editing session, always allow
        if (allowEditingSession.current) {
            console.log('📱 shouldFieldBeEditable: Active editing session - ALLOWED');
            return true;
        }
        
        // Super admin can always edit
        if (isSuperAdminUser) {
            console.log('📱 shouldFieldBeEditable: Super admin - ALLOWED');
            return true;
        }
        
        // Check if regular user can start editing
        const currentAltPhone = leadInfo.alternative_phone;
        const isOriginallyEmpty = !currentAltPhone || 
                                currentAltPhone.trim() === '' || 
                                currentAltPhone.toLowerCase() === 'n/a' || 
                                currentAltPhone.toLowerCase() === 'none' || 
                                currentAltPhone.toLowerCase() === 'null';
        
        const canStartEditing = isOriginallyEmpty && !alternativePhoneEditHistory;
        console.log('📱 shouldFieldBeEditable: Regular user check:', {
            isOriginallyEmpty,
            alternativePhoneEditHistory,
            canStartEditing
        });
        
        return canStartEditing;
    };

    useEffect(() => {
        console.log('🔄 AboutSection: useEffect triggered with leadInfo:', leadInfo);
        const initialData = {
            data_code: leadInfo.data_code || '',
            customer_name: [leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(' ').trim(),
            loan_type_name: leadInfo.loan_type_name || leadInfo.loan_type || '',
            phone: leadInfo.phone || '',
            alternative_phone: leadInfo.alternative_phone || '',
            pin_code: leadInfo.dynamic_fields?.address?.postal_code || leadInfo.postal_code || '',
            city: leadInfo.dynamic_fields?.address?.city || leadInfo.city || ''
        };
        console.log('📊 AboutSection: Setting initial data:', initialData);
        setEditableData(initialData);
        
        // Track alternative phone edit history
        // Check if alternative phone has ever been saved (not empty/null/none)
        const altPhone = leadInfo.alternative_phone;
        const hasAlternativePhoneBeenSaved = altPhone && 
                                            altPhone.trim() !== '' && 
                                            altPhone.toLowerCase() !== 'n/a' && 
                                            altPhone.toLowerCase() !== 'none' && 
                                            altPhone.toLowerCase() !== 'null';
        
        setAlternativePhoneEditHistory(hasAlternativePhoneBeenSaved);
        
        // Always start with editing state as false - user enters editing mode on focus
        setIsEditingAlternativePhone(false);
        
        // Reset editing session ref
        allowEditingSession.current = false;
        
        console.log('📱 Alternative phone edit history:', {
            value: altPhone,
            hasBeenSaved: hasAlternativePhoneBeenSaved,
            editingState: false,
            isSuperAdmin: isSuperAdminUser
        });
        
        // Initialize lastSavedData to the original values - this should only happen on initial load
        if (Object.keys(lastSavedData.current).length === 0) {
            lastSavedData.current = { ...initialData };
            console.log('💾 AboutSection: Set lastSavedData to:', lastSavedData.current);
        }
    }, [leadInfo]);

    // Additional useEffect to sync when leadData changes from parent (after successful save)
    useEffect(() => {
        if (leadData || lead) {
            const currentLeadInfo = leadData || lead;
            console.log('🔄 AboutSection: Parent leadData changed, syncing editable data');
            console.log('📊 AboutSection: Current leadInfo:', currentLeadInfo);
            
            const syncedData = {
                data_code: currentLeadInfo.data_code || '',
                customer_name: [currentLeadInfo.first_name, currentLeadInfo.last_name].filter(Boolean).join(' ').trim(),
                loan_type_name: currentLeadInfo.loan_type_name || currentLeadInfo.loan_type || '',
                phone: currentLeadInfo.phone || '',
                alternative_phone: currentLeadInfo.alternative_phone || '',
                pin_code: currentLeadInfo.dynamic_fields?.address?.postal_code || currentLeadInfo.postal_code || '',
                city: currentLeadInfo.dynamic_fields?.address?.city || currentLeadInfo.city || ''
            };
            
            console.log('📊 AboutSection: Synced data:', syncedData);
            console.log('📊 AboutSection: Previous editable data:', editableData);
            
            setEditableData(syncedData);
            
            // Update lastSavedData to reflect the new saved state
            lastSavedData.current = { ...syncedData };
            console.log('📊 AboutSection: Data synced with parent, lastSavedData updated');
        }
    }, [leadData, lead, leadData?.updated_at, leadData?._id]);

    // Force re-render when key data changes
    useEffect(() => {
        console.log('🔄 AboutSection: Key data changed, checking for updates...');
        const currentLeadInfo = leadData || lead || {};
        
        // Check if any field value has changed from what we currently have
        const latestData = {
            data_code: currentLeadInfo.data_code || '',
            customer_name: [currentLeadInfo.first_name, currentLeadInfo.last_name].filter(Boolean).join(' ').trim(),
            loan_type_name: currentLeadInfo.loan_type_name || currentLeadInfo.loan_type || '',
            phone: currentLeadInfo.phone || '',
            alternative_phone: currentLeadInfo.alternative_phone || '',
            pin_code: currentLeadInfo.dynamic_fields?.address?.postal_code || currentLeadInfo.postal_code || '',
            city: currentLeadInfo.dynamic_fields?.address?.city || currentLeadInfo.city || ''
        };
        
        // Check if data is different
        const hasChanges = Object.keys(latestData).some(key => 
            latestData[key] !== editableData[key]
        );
        
        if (hasChanges) {
            console.log('📊 AboutSection: Backend data has changed, updating UI');
            console.log('📊 AboutSection: Latest data from backend:', latestData);
            console.log('📊 AboutSection: Current editable data:', editableData);
            setEditableData(latestData);
            lastSavedData.current = { ...latestData };
        }
    }, [JSON.stringify(leadData), JSON.stringify(lead)]);

    // Fetch current user data and initialize assignments
    useEffect(() => {
        const fetchCurrentUserAndUsers = async () => {
            try {
                setLoadingUsers(true);
                const userId = localStorage.getItem('userId');
                const token = localStorage.getItem('token');

                // Fetch current user data
                const userResponse = await fetch(`${API_BASE_URL}/users/${userId}?user_id=${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (userResponse.ok) {
                    const currentUser = await userResponse.json();
                    setCurrentUserData(currentUser);

                    // Fetch users based on current user's role
                    await fetchRoleBasedUsers(currentUser, userId, token);
                }

                // Parse existing assignments from leadInfo
                parseExistingAssignments();
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchCurrentUserAndUsers();
    }, [leadInfo._id]);

    // Function to fetch users based on role hierarchy via API
    const fetchRoleBasedUsers = async (currentUser, userId, token) => {
        try {
            // First, get all roles to understand the hierarchy
            const rolesResponse = await fetch(`${API_BASE_URL}/roles?user_id=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!rolesResponse.ok) {
                throw new Error('Failed to fetch roles');
            }

            const roles = await rolesResponse.json();
            console.log('📋 Fetched roles:', roles);

            // Get current user's role details
            const currentUserRole = roles.find(role => role._id === currentUser.role_id);
            console.log('👤 Current user role:', currentUserRole);

            // Fetch all users
            const allUsersResponse = await fetch(`${API_BASE_URL}/users?user_id=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!allUsersResponse.ok) {
                throw new Error('Failed to fetch users');
            }

            const allUsers = await allUsersResponse.json();
            console.log('👥 Fetched all users:', allUsers);

            // Filter same role users (excluding current user)
            const sameRole = allUsers.filter(user => 
                user.role_id === currentUser.role_id && user._id !== currentUser._id
            );
            setSameRoleUsers(sameRole);
            console.log('👥 Same role users:', sameRole);

            // Get senior users based on role hierarchy
            const seniors = await getSeniorUsers(currentUserRole, roles, allUsers, userId, token);
            setSeniorUsers(seniors);
            console.log('👑 Senior users:', seniors);

        } catch (error) {
            console.error('Error fetching role-based users:', error);
        }
    };

    // Function to get senior users based on role hierarchy
    const getSeniorUsers = async (currentUserRole, allRoles, allUsers, userId, token) => {
        try {
            // Use the new role hierarchy API to get users one level above
            const response = await fetch(`${API_BASE_URL}/roles/users-one-level-above/${userId}?requesting_user_id=${userId}`, {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const usersOneLevelAbove = await response.json();
                console.log('🎯 Users one level above:', usersOneLevelAbove);
                return usersOneLevelAbove;
            } else {
                console.warn('Failed to get users one level above, using fallback');
                
                // Fallback: If current user role has a hierarchy level, get users with higher levels
                if (currentUserRole && currentUserRole.hierarchy_level !== undefined) {
                    const seniorRoles = allRoles.filter(role => 
                        role.hierarchy_level > currentUserRole.hierarchy_level
                    );
                    
                    const seniorRoleIds = seniorRoles.map(role => role._id);
                    return allUsers.filter(user => seniorRoleIds.includes(user.role_id));
                }

                // Additional fallback: try to get reporting hierarchy via department/team structure
                if (currentUserRole && currentUserRole.department_id) {
                    const departmentResponse = await fetch(`${API_BASE_URL}/departments/${currentUserRole.department_id}?user_id=${userId}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });

                    if (departmentResponse.ok) {
                        const department = await departmentResponse.json();
                        
                        // Get users who are managers/heads of this department
                        const departmentSeniors = allUsers.filter(user => {
                            const userRole = allRoles.find(role => role._id === user.role_id);
                            return userRole && (
                                userRole.name.toLowerCase().includes('manager') ||
                                userRole.name.toLowerCase().includes('head') ||
                                userRole.name.toLowerCase().includes('lead') ||
                                userRole.name.toLowerCase().includes('supervisor')
                            );
                        });

                        return departmentSeniors;
                    }
                }
            }

            return [];
        } catch (error) {
            console.error('Error getting senior users:', error);
            return [];
        }
    };

    // Parse existing assignments from lead data
    const parseExistingAssignments = () => {
        try {
            // Parse assigned_to data
            if (leadInfo.assigned_to) {
                let assignedToData = [];
                if (typeof leadInfo.assigned_to === 'string') {
                    try {
                        assignedToData = JSON.parse(leadInfo.assigned_to);
                    } catch {
                        // If it's a comma-separated string, try to match with actual users
                        const userIdsOrNames = leadInfo.assigned_to.split(',').map(item => item.trim());
                        assignedToData = userIdsOrNames.map(item => {
                            // Try to find the user by ID first, then by name
                            const user = users.find(u => u._id === item || u.username === item || 
                                `${u.first_name} ${u.last_name}`.trim() === item);
                            
                            if (user) {
                                return {
                                    id: user._id,
                                    name: `${user.first_name} ${user.last_name}`.trim()
                                };
                            } else {
                                // If no user found, use the item as both id and name (fallback)
                                return {
                                    id: item,
                                    name: item
                                };
                            }
                        });
                    }
                } else if (Array.isArray(leadInfo.assigned_to)) {
                    // If it's already an array, ensure each item has proper name from users list
                    assignedToData = leadInfo.assigned_to.map(item => {
                        if (typeof item === 'string') {
                            const user = users.find(u => u._id === item || u.username === item);
                            return {
                                id: item,
                                name: user ? `${user.first_name} ${user.last_name}`.trim() : item
                            };
                        }
                        return item; // Already an object
                    });
                }
                setAssignedTo(assignedToData);
            }

            // Parse assigned_tl data (if it exists)
            if (leadInfo.assigned_tl) {
                let assignedTLData = [];
                if (typeof leadInfo.assigned_tl === 'string') {
                    try {
                        assignedTLData = JSON.parse(leadInfo.assigned_tl);
                    } catch {
                        // If it's a comma-separated string, try to match with actual users
                        const userIdsOrNames = leadInfo.assigned_tl.split(',').map(item => item.trim());
                        assignedTLData = userIdsOrNames.map(item => {
                            // Try to find the user by ID first, then by name
                            const user = users.find(u => u._id === item || u.username === item || 
                                `${u.first_name} ${u.last_name}`.trim() === item);
                            
                            if (user) {
                                return {
                                    id: user._id,
                                    name: `${user.first_name} ${user.last_name}`.trim()
                                };
                            } else {
                                // If no user found, use the item as both id and name (fallback)
                                return {
                                    id: item,
                                    name: item
                                };
                            }
                        });
                    }
                } else if (Array.isArray(leadInfo.assigned_tl)) {
                    // If it's already an array, ensure each item has proper name from users list
                    assignedTLData = leadInfo.assigned_tl.map(item => {
                        if (typeof item === 'string') {
                            const user = users.find(u => u._id === item || u.username === item);
                            return {
                                id: item,
                                name: user ? `${user.first_name} ${user.last_name}`.trim() : item
                            };
                        }
                        return item; // Already an object
                    });
                }
                setAssignedTL(assignedTLData);
            }

            // Parse assign_report_to data
            if (leadInfo.assign_report_to) {
                let assignReportToData = [];
                if (typeof leadInfo.assign_report_to === 'string') {
                    try {
                        assignReportToData = JSON.parse(leadInfo.assign_report_to);
                    } catch {
                        // If it's a comma-separated string, try to match with actual users
                        const userIdsOrNames = leadInfo.assign_report_to.split(',').map(item => item.trim());
                        assignReportToData = userIdsOrNames.map(item => {
                            // Try to find the user by ID first, then by name
                            const user = users.find(u => u._id === item || u.username === item || 
                                `${u.first_name} ${u.last_name}`.trim() === item);
                            
                            if (user) {
                                return {
                                    id: user._id,
                                    name: `${user.first_name} ${user.last_name}`.trim()
                                };
                            } else {
                                // If no user found, use the item as both id and name (fallback)
                                return {
                                    id: item,
                                    name: item
                                };
                            }
                        });
                    }
                } else if (Array.isArray(leadInfo.assign_report_to)) {
                    // If it's already an array, ensure each item has proper name from users list
                    assignReportToData = leadInfo.assign_report_to.map(item => {
                        if (typeof item === 'string') {
                            const user = users.find(u => u._id === item || u.username === item);
                            return {
                                id: item,
                                name: user ? `${user.first_name} ${user.last_name}`.trim() : item
                            };
                        }
                        return item; // Already an object
                    });
                }
                setAssignReportTo(assignReportToData);
            }
        } catch (error) {
            console.error('Error parsing existing assignments:', error);
        }
    };

    // Handle assignment functions
    const handleAssignTo = async (selectedUsers) => {
        try {
            setIsSaving(true);
            const updateData = {
                assigned_to: selectedUsers
            };
            
            const result = await onUpdate(updateData);
            if (result !== false) {
                setAssignedTo(selectedUsers);
                setSaveMessage('✅ Assignment updated successfully');
                setTimeout(() => setSaveMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error updating assignment:', error);
            setSaveMessage('❌ Failed to update assignment');
            setTimeout(() => setSaveMessage(''), 5000);
        } finally {
            setIsSaving(false);
            setShowAssignToPopup(false);
        }
    };

    const handleAssignTL = async (selectedUsers) => {
        try {
            setIsSaving(true);
            const updateData = {
                assigned_tl: selectedUsers
            };
            
            const result = await onUpdate(updateData);
            if (result !== false) {
                setAssignedTL(selectedUsers);
                setSaveMessage('✅ TL assignment updated successfully');
                setTimeout(() => setSaveMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error updating TL assignment:', error);
            setSaveMessage('❌ Failed to update TL assignment');
            setTimeout(() => setSaveMessage(''), 5000);
        } finally {
            setIsSaving(false);
            setShowAssignTLPopup(false);
        }
    };

    const handleInputChange = (field, value) => {
        console.log('📝 AboutSection: Input changed:', field, '=', value);
        console.log('🧩 Field being changed:', field);
        console.log('🧩 New value:', value);
        console.log('🧩 Component location: lead-details/AboutSection.jsx');
        setEditableData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTestBlur = (field) => {
        console.log('🎯 AboutSection: onBlur triggered for field:', field);
        handleFieldBlur(field);
    };

    const handleFieldBlur = async (field) => {
        console.log('🔍 AboutSection: handleFieldBlur called for field:', field);
        console.log('🔍 Current value:', editableData[field]);
        console.log('🔍 Last saved value:', lastSavedData.current[field]);
        
        // Handle alternative phone editing state regardless of whether save happens
        if (field === 'alternative_phone') {
            setIsEditingAlternativePhone(false);
            console.log('🔒 Alternative phone editing stopped on blur (start of handleFieldBlur)');
        }
        
        // Get the original value from leadInfo to compare against
        let originalValue;
        switch (field) {
            case 'data_code':
                originalValue = leadInfo.data_code || '';
                break;
            case 'customer_name':
                originalValue = [leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(' ').trim();
                break;
            case 'loan_type_name':
                originalValue = leadInfo.loan_type_name || leadInfo.loan_type || '';
                break;
            case 'phone':
                originalValue = leadInfo.phone || '';
                break;
            case 'alternative_phone':
                originalValue = leadInfo.alternative_phone || '';
                break;
            case 'pin_code':
                originalValue = leadInfo.dynamic_fields?.address?.postal_code || leadInfo.postal_code || '';
                break;
            case 'city':
                originalValue = leadInfo.dynamic_fields?.address?.city || leadInfo.city || '';
                break;
            default:
                originalValue = '';
        }
        
        console.log('🔍 Original value from leadInfo:', originalValue);
        console.log('🔍 Are they equal?', editableData[field] === originalValue);
        
        // Check if value has actually changed from the last saved value OR from original
        const currentValue = String(editableData[field] || '').trim();
        const lastSavedValue = String(lastSavedData.current[field] || '').trim();
        const originalValueStr = String(originalValue || '').trim();
        
        console.log('🔍 Trimmed comparison:', {
            currentValue,
            lastSavedValue,
            originalValueStr,
            hasChangedFromLastSaved: currentValue !== lastSavedValue,
            hasChangedFromOriginal: currentValue !== originalValueStr
        });
        
        // Only save if value has changed from either the last saved value or original
        if (currentValue === lastSavedValue && currentValue === originalValueStr) {
            console.log('⏭️ AboutSection: No change detected, skipping save');
            return;
        }

        console.log('💾 AboutSection: Change detected, starting save process');
        setIsSaving(true);
        setSaveMessage('💾 Saving...');
        
        try {
            let first_name = leadInfo.first_name || '';
            let last_name = leadInfo.last_name || '';
            if (field === 'customer_name' || editableData.customer_name) {
                const parts = (editableData.customer_name || '').split(' ');
                first_name = parts[0] || '';
                last_name = parts.slice(1).join(' ') || '';
            }

            // Create proper update data structure for backend API
            const updateData = {};
            
            // Handle different field updates properly
            if (field === 'data_code') {
                updateData.data_code = String(editableData.data_code || '');
            } else if (field === 'customer_name') {
                const parts = (editableData.customer_name || '').split(' ');
                updateData.first_name = String(parts[0] || '');
                updateData.last_name = String(parts.slice(1).join(' ') || '');
            } else if (field === 'loan_type_name') {
                updateData.loan_type = String(editableData.loan_type_name || '');
                updateData.loan_type_name = String(editableData.loan_type_name || '');
            } else if (field === 'phone' && canEditAll) {
                updateData.phone = String(editableData.phone || '');
            } else if (field === 'alternative_phone' && (isSuperAdminUser || allowEditingSession.current)) {
                console.log('💾 AboutSection: Saving alternative_phone - isSuperAdmin:', isSuperAdminUser, 'hadEditingSession:', allowEditingSession.current, 'original value:', leadInfo.alternative_phone);
                updateData.alternative_phone = String(editableData.alternative_phone || '');
                
                // Stop editing mode for alternative phone when it's blurred
                setIsEditingAlternativePhone(false);
                console.log('🔒 Alternative phone editing stopped on blur');
                
                // Track that alternative phone has been saved (for non-super admin users)
                if (!isSuperAdminUser && editableData.alternative_phone && editableData.alternative_phone.trim() !== '') {
                    setAlternativePhoneEditHistory(true);
                    console.log('📱 Alternative phone edit history updated: User has now saved alternative phone once');
                }
            } else if (field === 'pin_code') {
                updateData.postal_code = String(editableData.pin_code || '');
                // Only update the specific address field we need
                updateData.dynamic_fields = {
                    address: {
                        postal_code: String(editableData.pin_code || '')
                    }
                };
            } else if (field === 'city') {
                updateData.city = String(editableData.city || '');
                // Only update the specific address field we need
                updateData.dynamic_fields = {
                    address: {
                        city: String(editableData.city || '')
                    }
                };
            }

            console.log('📤 AboutSection: Calling onUpdate with data:', updateData);
            console.log('📤 AboutSection: Field being updated:', field);
            console.log('📤 AboutSection: New value:', editableData[field]);
            console.log('📤 AboutSection: Original value was:', originalValue);
            console.log('📤 AboutSection: User permissions - canEditAll:', canEditAll);
            console.log('📤 AboutSection: leadInfo.alternative_phone:', leadInfo.alternative_phone);
            
            // Check if updateData has any fields to update
            if (Object.keys(updateData).length === 0) {
                console.log('⚠️ AboutSection: No update data to send, user may not have permission for this field');
                setSaveMessage('⚠️ No permission to update this field');
                setTimeout(() => setSaveMessage(''), 3000);
                return;
            }
            
            if (!onUpdate) {
                console.error('❌ AboutSection: onUpdate function is not provided!');
                setSaveMessage('❌ Save function not available');
                return;
            }

            const result = await onUpdate(updateData);
            console.log('📥 AboutSection: onUpdate result:', result);
            
            if (result !== false) {
                // Update the lastSavedData to current values after successful save
                lastSavedData.current[field] = editableData[field];
                console.log('✅ AboutSection: Save completed successfully for field:', field);
                console.log('✅ AboutSection: Updated lastSavedData:', lastSavedData.current);
                setSaveMessage('✅ Data saved successfully');
                setTimeout(() => setSaveMessage(''), 3000);
                
                // Force refresh component data after save to ensure we have latest from backend
                setTimeout(() => {
                    console.log('🔄 AboutSection: Refreshing component data after save');
                    // Update editableData with the latest leadInfo data
                    setEditableData({
                        data_code: leadInfo.data_code || '',
                        customer_name: [leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(' ').trim(),
                        loan_type_name: leadInfo.loan_type_name || leadInfo.loan_type || '',
                        phone: leadInfo.phone || '',
                        alternative_phone: leadInfo.alternative_phone || '',
                        pin_code: leadInfo.dynamic_fields?.address?.postal_code || leadInfo.postal_code || '',
                        city: leadInfo.dynamic_fields?.address?.city || leadInfo.city || '',
                    });
                }, 500);
            } else {
                console.log('❌ AboutSection: Save failed (onUpdate returned false)');
                setSaveMessage('❌ Failed to save data');
                setTimeout(() => setSaveMessage(''), 5000);
            }
        } catch (error) {
            console.error('❌ AboutSection: Save failed:', error);
            setSaveMessage('❌ Failed to save data: ' + (error.message || 'Unknown error'));
            setTimeout(() => setSaveMessage(''), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // Assignment Popup Component
    const AssignmentPopup = ({ isOpen, onClose, title, users, selectedUsers, onSave, loading }) => {
        const [tempSelected, setTempSelected] = useState(selectedUsers || []);

        useEffect(() => {
            setTempSelected(selectedUsers || []);
        }, [selectedUsers]);

        const handleUserToggle = (user) => {
            setTempSelected(prev => {
                const isSelected = prev.some(u => u.id === user._id);
                if (isSelected) {
                    return prev.filter(u => u.id !== user._id);
                } else {
                    return [...prev, { id: user._id, name: `${user.first_name} ${user.last_name}`.trim() }];
                }
            });
        };

        const handleSave = () => {
            onSave(tempSelected);
        };

        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-64">
                        {loading ? (
                            <div className="text-center py-4">Loading users...</div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">No users available</div>
                        ) : (
                            <div className="space-y-2">
                                {users.map(user => (
                                    <label key={user._id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={tempSelected.some(u => u.id === user._id)}
                                            onChange={() => handleUserToggle(user)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">
                                                {user.first_name} {user.last_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {user.role_name || user.designation || 'No role'}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="border border-gray-700 rounded-lg bg-white">
            <button
                className="w-full flex justify-between items-center px-5 py-4 text-left text-2xl font-semibold text-[#03b0f5] focus:outline-none"
                onClick={() => setOpen(prev => !prev)}
                type="button"
            >
                <span className="flex items-center">
                    <User className="w-7 h-7 mr-3" />
                    About
                </span>
                {open ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
            {open && (
                <div className="p-6 -mt-7">
                    <div className="flex items-center justify-between mb-2">
                        <div />
                        <div className="flex items-center space-x-4">
                            {isSaving && (
                                <div className="flex items-center text-blue-600 font-semibold text-base">
                                    <Save className="w-5 h-5 mr-2 animate-pulse" />
                                    Saving...
                                </div>
                            )}
                            {saveMessage && (
                                <div className="text-sm font-semibold">
                                    {saveMessage}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-2 border-[#03b0f5] p-5 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Lead ID - Read Only */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Lead ID</label>
                            <div className="bg-white p-3 rounded border text-green-600 font-semibold text-base">
                                {leadInfo.custom_lead_id || leadInfo._id?.slice(-8) || 'N/A'}
                            </div>
                        </div>

                        {/* Loan Type Name - Editable */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Loan Type Name</label>
                            <input
                                type="text"
                                value={editableData.loan_type_name}
                                onChange={e => handleInputChange('loan_type_name', e.target.value)}
                                onBlur={() => handleTestBlur('loan_type_name')}
                                className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                placeholder="Enter loan type name"
                            />
                        </div>

                        {/* Campaign Name - Read Only */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Campaign Name</label>
                            <div className="bg-white p-3 rounded border text-green-600 font-semibold text-base">
                                {leadInfo.campaign_name || leadInfo.source || 'N/A'}
                            </div>
                        </div>

                        {/* Data Code - Editable by all users */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Data Code</label>
                            <input
                                type="text"
                                value={editableData.data_code}
                                onChange={e => handleInputChange('data_code', e.target.value)}
                                onBlur={() => handleFieldBlur('data_code')}
                                className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                placeholder="Enter data code"
                            />
                        </div>

                        {/* Customer Name - Editable by all users, autofilled from lead */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Customer Name</label>
                            <input
                                type="text"
                                value={editableData.customer_name}
                                onChange={e => handleInputChange('customer_name', e.target.value)}
                                onBlur={() => handleFieldBlur('customer_name')}
                                className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                placeholder="Customer Name"
                            />
                        </div>

                        {/* Number - Editable only by super admin */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Number</label>
                            {canEditAll ? (
                                <input
                                    type="text"
                                    value={editableData.phone}
                                    onChange={e => handleInputChange('phone', e.target.value)}
                                    onBlur={() => handleFieldBlur('phone')}
                                    className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                    placeholder="Phone number"
                                />
                            ) : (
                                <div className="bg-white p-3 rounded border text-green-600 font-semibold text-base">
                                    {leadInfo.phone || 'N/A'}
                                </div>
                            )}
                        </div>

                        {/* Alternative Phone - Simple approach */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#ff0000", fontWeight: 600, fontSize: "24px" }}>
                                🔥 TESTING - Alternative Phone [LEAD-DETAILS VERSION] 🔥
                                {!isSuperAdminUser && alternativePhoneEditHistory && (
                                    <span className="text-sm text-orange-600 ml-2">(Editable by Super Admin only)</span>
                                )}
                            </label>
                            <div>
                                <input
                                    type="text"
                                    value={editableData.alternative_phone}
                                    onChange={e => handleInputChange('alternative_phone', e.target.value)}
                                    onFocus={() => {
                                        console.log('🔓 Alternative phone focused');
                                        const currentAltPhone = leadInfo.alternative_phone;
                                        const isOriginallyEmpty = !currentAltPhone || 
                                                                currentAltPhone.trim() === '' || 
                                                                currentAltPhone.toLowerCase() === 'n/a' || 
                                                                currentAltPhone.toLowerCase() === 'none' || 
                                                                currentAltPhone.toLowerCase() === 'null';
                                        
                                        // Only set editing mode if user has permission
                                        if (isSuperAdminUser || (isOriginallyEmpty && !alternativePhoneEditHistory)) {
                                            setIsEditingAlternativePhone(true);
                                            allowEditingSession.current = true;
                                            console.log('🔓 Edit session started');
                                        }
                                    }}
                                    onBlur={() => {
                                        console.log('📤 Alternative phone blurred');
                                        // Only save if we had permission to edit
                                        if (allowEditingSession.current) {
                                            allowEditingSession.current = false;
                                            handleFieldBlur('alternative_phone');
                                        }
                                    }}
                                    className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                    placeholder="Alternative phone"
                                />
                                {!isSuperAdminUser && !alternativePhoneEditHistory && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        ⚠️ You can edit this field only once. After saving, only Super Admin can modify it.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Pincode - Editable by all users */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Pincode</label>
                            <input
                                type="text"
                                value={editableData.pin_code}
                                onChange={e => handleInputChange('pin_code', e.target.value)}
                                onBlur={() => handleFieldBlur('pin_code')}
                                className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                placeholder="Enter pincode"
                            />
                        </div>

                        {/* City - Editable by all users */}
                        {/* City - Editable by all users */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>City</label>
                            <input
                                type="text"
                                value={editableData.city}
                                onChange={e => handleInputChange('city', e.target.value)}
                                onBlur={() => handleFieldBlur('city')}
                                className="w-full bg-white border border-gray-600 rounded px-4 py-3 text-green-600 font-semibold focus:outline-none focus:border-blue-500 text-base"
                                placeholder="Enter city"
                            />
                        </div>

                        {/* Assigned To - Same Role Users */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Assigned To</label>
                            <div className="w-full bg-white border border-gray-600 rounded px-4 py-3 min-h-[52px] flex items-center justify-between cursor-pointer hover:border-blue-500" 
                                 onClick={() => setShowAssignToPopup(true)}>
                                <div className="flex flex-wrap gap-1">
                                    {assignedTo.length === 0 ? (
                                        <span className="text-gray-500">Click to assign</span>
                                    ) : (
                                        assignedTo.map(user => (
                                            <span key={user.id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                                {user.name}
                                            </span>
                                        ))
                                    )}
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>

                        {/* Assigned TL - Senior Users */}
                        <div>
                            <label className="block text-xl font-semibold mb-2" style={{ color: "#03b0f5", fontWeight: 600 }}>Assigned TL</label>
                            <div className="w-full bg-white border border-gray-600 rounded px-4 py-3 min-h-[52px] flex items-center justify-between cursor-pointer hover:border-blue-500"
                                 onClick={() => setShowAssignTLPopup(true)}>
                                <div className="flex flex-wrap gap-1">
                                    {assignedTL.length === 0 ? (
                                        <span className="text-gray-500">Click to assign TL</span>
                                    ) : (
                                        assignedTL.map(user => (
                                            <span key={user.id} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                                {user.name}
                                            </span>
                                        ))
                                    )}
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {/* Assignment Popups */}
                    <AssignmentPopup
                        isOpen={showAssignToPopup}
                        onClose={() => setShowAssignToPopup(false)}
                        title="Assign To (Same Role Users)"
                        users={sameRoleUsers}
                        selectedUsers={assignedTo}
                        onSave={handleAssignTo}
                        loading={loadingUsers}
                    />

                    <AssignmentPopup
                        isOpen={showAssignTLPopup}
                        onClose={() => setShowAssignTLPopup(false)}
                        title="Assign TL"
                        users={seniorUsers}
                        selectedUsers={assignedTL}
                        onSave={handleAssignTL}
                        loading={loadingUsers}
                    />
                </div>
            )}
        </div>
    );
}