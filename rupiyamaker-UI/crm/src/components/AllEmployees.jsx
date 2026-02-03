import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Button,
    message,
    Modal
} from 'antd';
import { PlusOutlined, UserOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { Search, Filter, User, Building, Calendar, Clock, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import EmployeeForm from '../components/hrms/EmployeeFormNew';
import StatusModal from '../components/hrms/StatusModal';
import PasswordManagementModal from '../components/hrms/PasswordManagementModal';
import EmployeeDetails from './EmployeeDetails';
import { formatDate, formatDateTime } from '../utils/dateUtils';

// Import both old and new permission systems for compatibility
import { hasPermission, getUserPermissions } from '../utils/permissions';
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId 
} from '../utils/permissions';

import hrmsService from '../services/hrmsService';
import { getMediaUrl, getProfilePictureUrlWithCacheBusting } from '../utils/mediaUtils';

const { confirm } = Modal;

// CSS Styles for the toggle switches
const toggleStyles = `
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    user-select: none;
  }
  
  .switch input[type="checkbox"] {
    appearance: none;
    width: 48px;
    height: 26px;
    border-radius: 9999px;
    background: #d73f3f;
    position: relative;
    box-shadow: inset 0 0 0 2px #2a2f36;
    transition: background 0.25s ease, box-shadow 0.25s ease;
    cursor: pointer;
  }
  
  .switch input[type="checkbox"]::before {
    content: "";
    position: absolute;
    width: 22px;
    height: 22px;
    left: 2px;
    top: 2px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transition: transform 0.35s cubic-bezier(0.2,0.8,0.2,1), width 0.15s ease, height 0.15s ease;
  }
  
  .switch input[type="checkbox"]:active::before {
    width: 24px;
    height: 20px;
  }
  
  .switch input[type="checkbox"]:checked {
    background: #3fb950;
    box-shadow: inset 0 0 0 2px rgba(63,185,80,0.55), 0 0 12px rgba(63,185,80,0.35);
  }
  
  .switch input[type="checkbox"]:checked::before {
    transform: translateX(22px);
  }
  
  .switch .state {
    font-size: 0.9rem;
    min-width: 48px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  
  .switch .state.on {
    color: #3fb950;
  }
  
  .switch .state.off {
    color: #d73f3f;
  }
  
  .switch .state.mixed {
    color: #58a6ff;
  }
  
  /* Disabled toggle styles */
  .switch input[type="checkbox"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .switch input[type="checkbox"]:disabled::before {
    opacity: 0.5;
  }
  
  .switch:has(input:disabled) .state {
    opacity: 0.5;
    color: #6c757d !important;
  }
  
  .th-flex {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .tenure {
    color: #9ca3af;
    font-size: 0.85rem;
  }
  
  /* Sticky header styles */
  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .table-container {
    max-height: 70vh;
    overflow-y: auto;
    overflow-x: auto;
  }
  
  /* Fixed widths for first 3 columns - NOT sticky, scroll away normally */
  .table-container table thead th:first-child,
  .table-container table tbody td:first-child {
    width: 50px;
    min-width: 50px;
  }
  
  .table-container table thead th:nth-child(2),
  .table-container table tbody td:nth-child(2) {
    width: 80px;
    min-width: 80px;
  }
  
  .table-container table thead th:nth-child(3),
  .table-container table tbody td:nth-child(3) {
    width: 110px;
    min-width: 110px;
  }
  
  /* Sticky fourth column (Employee Name) - Sticks at left edge (left: 0) */
  .table-container table thead th:nth-child(4) {
    position: sticky !important;
    left: 0 !important;
    top: 0 !important;
    background: white !important;
    width: 200px;
    min-width: 200px;
  }
  
  .table-container table tbody td:nth-child(4) {
    position: sticky !important;
    left: 0 !important;
    background: rgb(0, 0, 0) !important;
    width: 200px;
    min-width: 200px;
  }
  
  /* Uppercase styling for table data - comprehensive coverage */
  .table-container table tbody td {
    text-transform: uppercase !important;
  }
  
  .table-container table tbody td * {
    text-transform: uppercase !important;
  }
  
  .table-container table tbody td span {
    text-transform: uppercase !important;
  }
  
  .table-container table tbody td div {
    text-transform: uppercase !important;
  }
  
  /* Exclude certain elements that shouldn't be uppercase */
  .table-container table tbody td .switch .state,
  .table-container table tbody td button,
  .table-container table tbody td .tenure,
  .table-container table tbody td .state.on,
  .table-container table tbody td .state.off,
  .table-container table tbody td .state.mixed {
    text-transform: none !important;
  }
`;

// Add styles to head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = toggleStyles;
  document.head.appendChild(styleSheet);
}

const AllEmployees = () => {
    const [activeTab, setActiveTab] = useState('active');
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter popup states (matching LeadCRM structure) - Enhanced for multiple selections
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState('department');
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [selectedDesignations, setSelectedDesignations] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);
    
    // Search states for filter options
    const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
    const [designationSearchTerm, setDesignationSearchTerm] = useState('');
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    
    // Filter options from settings
    const [allDepartments, setAllDepartments] = useState([]);
    const [allRoles, setAllRoles] = useState([]);
    const [allDesignations, setAllDesignations] = useState([]);
    const [filterDataLoading, setFilterDataLoading] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null);
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [onboardingModalVisible, setOnboardingModalVisible] = useState(false);
    const [statusModalLoading, setStatusModalLoading] = useState(false);
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState(null);
    const [formKey, setFormKey] = useState(Date.now()); // Add key to force form refresh
    const [masterStatusState, setMasterStatusState] = useState({ checked: false, label: 'Off' });
    const [masterAccessState, setMasterAccessState] = useState({ checked: false, label: 'Off' });
    const [masterOTPState, setMasterOTPState] = useState({ checked: false, label: 'Off' });
    
    // Add department and role mapping states
    const [departments, setDepartments] = useState({});
    const [roles, setRoles] = useState({});
    const [departmentsLoading, setDepartmentsLoading] = useState(false);
    
    // Table horizontal scroll controls
    const tableScrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    
    // State for custom confirmation modal
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        content: '',
        onOk: null,
        onCancel: null,
        loading: false
    });

    // Scroll functions for horizontal table navigation
    const updateScrollButtons = useCallback(() => {
        if (tableScrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
        }
    }, []);

    const scrollTable = useCallback((direction) => {
        if (tableScrollRef.current) {
            const scrollAmount = 300;
            tableScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            setTimeout(updateScrollButtons, 100);
        }
    }, [updateScrollButtons]);

    // Custom confirmation function
    const showConfirm = (config) => {
        setConfirmModal({
            visible: true,
            title: config.title || 'Confirm',
            content: config.content || 'Are you sure?',
            onOk: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    if (config.onOk) {
                        await config.onOk();
                    }
                } catch (error) {
                    console.error('❌ Error in confirm modal OK handler:', error);
                } finally {
                    // Always close the modal after OK action
                    setConfirmModal({
                        visible: false,
                        title: '',
                        content: '',
                        onOk: null,
                        onCancel: null,
                        loading: false
                    });
                }
            },
            onCancel: () => {
                if (config.onCancel) {
                    config.onCancel();
                }
                // Close the modal after Cancel action
                setConfirmModal({
                    visible: false,
                    title: '',
                    content: '',
                    onOk: null,
                    onCancel: null,
                    loading: false
                });
            },
            loading: false
        });
    };

    // Simplified permission checking using new 3-type system
    const permissionLevel = getPermissionLevel('users');
    const currentUserId = getCurrentUserId();
    
    // Permission check functions  
    const canUserViewAll = () => canViewAll('users');
    const canUserViewJunior = () => canViewJunior('users');
    const canUserCreate = () => canCreate('users');
    const canUserEdit = (recordOwnerId) => canEdit('users', recordOwnerId);
    const canUserDelete = (recordOwnerId) => canDelete('users', recordOwnerId);

    // Debug permissions
    const debugPerms = {
        canViewAll: canUserViewAll(),
        canViewJunior: canUserViewJunior(),
        canEdit: canUserEdit()
    };

    // FORCE ENABLE FOR TESTING - Remove this later
    const canEditEmployees = true; // Temporarily force to true for testing
    // const canEditEmployees = canUserEdit() || canUserViewJunior() || canUserViewAll(); // Original line

    // Load employees based on active tab
    useEffect(() => {
        fetchEmployees();
    }, [activeTab]);

    // Load departments and roles on component mount
    useEffect(() => {
        fetchDepartmentsAndRoles();
        fetchFilterData(); // Load filter data for the popup
    }, []);

    // Set up scroll listener for table navigation buttons
    useEffect(() => {
        updateScrollButtons();
        const tableContainer = tableScrollRef.current;
        if (tableContainer) {
            tableContainer.addEventListener('scroll', updateScrollButtons);
            return () => {
                tableContainer.removeEventListener('scroll', updateScrollButtons);
            };
        }
    }, [updateScrollButtons]);

    // Update scroll buttons when employees data changes
    useEffect(() => {
        setTimeout(updateScrollButtons, 100);
    }, [employees, updateScrollButtons]);

    const fetchDepartmentsAndRoles = async () => {
        setDepartmentsLoading(true);
        try {
            // Fetch departments and roles in parallel
            const [deptResponse, roleResponse] = await Promise.all([
                hrmsService.getDepartments(),
                hrmsService.getRoles()
            ]);

            console.log('🏢 Raw departments response:', deptResponse);
            console.log('👥 Raw roles response:', roleResponse);

            // Create lookup objects for quick access
            const departmentLookup = {};
            const roleLookup = {};

            if (deptResponse && deptResponse.data) {
                deptResponse.data.forEach(dept => {
                    departmentLookup[dept._id] = dept.name;
                });
            }

            if (roleResponse && roleResponse.data) {
                roleResponse.data.forEach(role => {
                    // Handle both _id and id field names for roles
                    const roleId = role._id || role.id;
                    if (roleId) {
                        roleLookup[roleId] = role.name;
                    }
                });
            }

            setDepartments(departmentLookup);
            setRoles(roleLookup);
            
            console.log('📋 Loaded departments lookup:', departmentLookup);
            console.log('👥 Loaded roles lookup:', roleLookup);
            console.log('🔍 Total departments loaded:', Object.keys(departmentLookup).length);
            console.log('🔍 Total roles loaded:', Object.keys(roleLookup).length);
        } catch (error) {
            console.error('❌ Error fetching departments and roles:', error);
            message.error('Failed to load departments and roles');
        } finally {
            setDepartmentsLoading(false);
        }
    };

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            // Get all employees using the working API
            const response = await hrmsService.getAllEmployees();

            if (!response || !response.data) {
                console.error('❌ Invalid response from getAllEmployees:', response);
                setEmployees([]);
                return;
            }

            // Process all employees first to normalize their status
            const allEmployeesProcessed = response.data.map(employee => {
                // Default to active unless explicitly set to inactive
                const isExplicitlyInactive = employee.employee_status === false || 
                                           employee.employee_status === 'false' || 
                                           employee.employee_status === 'inactive' || 
                                           employee.employee_status === 'Inactive' || 
                                           employee.employee_status === 0 || 
                                           employee.employee_status === '0';
                
                const normalizedStatus = isExplicitlyInactive ? 'inactive' : 'active';
                
                // Debug log employee data
                console.log(`👤 Employee ${employee.first_name} ${employee.last_name}:`, {
                    department_id: employee.department_id,
                    role_id: employee.role_id,
                    department_name: employee.department_name,
                    role_name: employee.role_name,
                    designation: employee.designation,
                    position: employee.position
                });
                
                return {
                    ...employee,
                    employee_status: normalizedStatus,
                    department_name: employee.department_name || '-',
                    role_name: employee.role_name || '-'
                };
            });

            // Filter based on the active tab
            const filteredEmployees = allEmployeesProcessed.filter(employee => {
                if (activeTab === 'active') {
                    return employee.employee_status === 'active';
                } else if (activeTab === 'inactive') {
                    return employee.employee_status === 'inactive';
                }
                return true; // Show all if no specific tab
            });

            // Sort employees: RM007 first, then others by employee_id
            const sortedEmployees = filteredEmployees.sort((a, b) => {
                // Check if either employee is RM007
                const aIsRM007 = a.employee_id === '007' || a.employee_id === 7;
                const bIsRM007 = b.employee_id === '007' || b.employee_id === 7;
                
                // If one is RM007, put it first
                if (aIsRM007 && !bIsRM007) return -1;
                if (!aIsRM007 && bIsRM007) return 1;
                
                // If both are RM007 or neither is RM007, sort by employee_id
                const aId = parseInt(a.employee_id) || 0;
                const bId = parseInt(b.employee_id) || 0;
                return aId - bId;
            });

            setEmployees(sortedEmployees);
        } catch (error) {
            console.error('❌ Error fetching employees:', error);
            message.error('Failed to fetch employees. Please check your connection.');
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch filter data from settings (departments, roles, designations)
    const fetchFilterData = async () => {
        try {
            setFilterDataLoading(true);
            console.log('📋 AllEmployees: Fetching filter data from settings...');
            
            const [departmentsRes, rolesRes, designationsRes] = await Promise.all([
                hrmsService.getDepartments(),
                hrmsService.getRoles(),
                hrmsService.getDesignations()
            ]);

            console.log('📋 AllEmployees: Raw departments response:', departmentsRes);
            console.log('📋 AllEmployees: Raw roles response:', rolesRes);
            console.log('📋 AllEmployees: Raw designations response:', designationsRes);

            // Process departments
            if (departmentsRes && departmentsRes.success && departmentsRes.data) {
                let departments;
                if (Array.isArray(departmentsRes.data)) {
                    // Handle array of strings or objects
                    departments = departmentsRes.data
                        .map(dept => {
                            if (typeof dept === 'string') return dept;
                            if (typeof dept === 'object') return dept.name || dept.department_name || dept.value;
                            return null;
                        })
                        .filter(dept => dept && dept.trim() !== '')
                        .sort();
                } else {
                    console.warn('📋 AllEmployees: Departments data is not an array:', departmentsRes.data);
                    departments = [];
                }
                setAllDepartments(departments);
                console.log('📋 AllEmployees: Processed departments:', departments);
            } else {
                console.warn('📋 AllEmployees: No departments data received:', departmentsRes);
                setAllDepartments([]);
            }

            // Process roles
            if (rolesRes && rolesRes.success && rolesRes.data) {
                let roles;
                if (Array.isArray(rolesRes.data)) {
                    // Handle array of strings or objects
                    roles = rolesRes.data
                        .map(role => {
                            if (typeof role === 'string') return role;
                            if (typeof role === 'object') return role.role_name || role.name || role.value;
                            return null;
                        })
                        .filter(role => role && role.trim() !== '')
                        .sort();
                } else {
                    console.warn('📋 AllEmployees: Roles data is not an array:', rolesRes.data);
                    roles = [];
                }
                setAllRoles(roles);
                console.log('📋 AllEmployees: Processed roles:', roles);
            } else {
                console.warn('📋 AllEmployees: No roles data received:', rolesRes);
                setAllRoles([]);
            }

            // Process designations
            if (designationsRes && designationsRes.success && designationsRes.data) {
                let designations;
                if (Array.isArray(designationsRes.data)) {
                    // Handle array of strings or objects
                    designations = designationsRes.data
                        .map(designation => {
                            if (typeof designation === 'string') return designation;
                            if (typeof designation === 'object') return designation.name || designation.designation_name || designation.value;
                            return null;
                        })
                        .filter(designation => designation && designation.trim() !== '')
                        .sort();
                } else {
                    console.warn('📋 AllEmployees: Designations data is not an array:', designationsRes.data);
                    designations = [];
                }
                setAllDesignations(designations);
                console.log('📋 AllEmployees: Processed designations:', designations);
            } else {
                console.warn('📋 AllEmployees: No designations data received:', designationsRes);
                setAllDesignations([]);
            }

        } catch (error) {
            console.error('📋 AllEmployees: Error fetching filter data:', error);
            // Set empty arrays on error to prevent UI issues
            setAllDepartments([]);
            setAllRoles([]);
            setAllDesignations([]);
        } finally {
            setFilterDataLoading(false);
        }
    };

    const handleTabChange = (key) => {
        setActiveTab(key);
    };

    // Get complete filter options from settings (not just current employee data)
    const getFilterOptions = (category) => {
        switch (category) {
            case 'department':
                return allDepartments;
            case 'designation':
                return allDesignations;
            case 'role':
                return allRoles;
            default:
                return [];
        }
    };

    // Get total active filter count (updated for multiple selections)
    const getActiveFilterCount = () => {
        let count = 0;
        if (selectedDepartments.length > 0) count += selectedDepartments.length;
        if (selectedDesignations.length > 0) count += selectedDesignations.length;
        if (selectedRoles.length > 0) count += selectedRoles.length;
        return count;
    };

    // Get filter count for specific category (updated for multiple selections)
    const getFilterCategoryCount = (category) => {
        switch (category) {
            case 'department':
                return selectedDepartments.length;
            case 'designation':
                return selectedDesignations.length;
            case 'role':
                return selectedRoles.length;
            default:
                return 0;
        }
    };

    // Clear all filters (updated for multiple selections)
    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedDepartments([]);
        setSelectedDesignations([]);
        setSelectedRoles([]);
        setDepartmentSearchTerm('');
        setDesignationSearchTerm('');
        setRoleSearchTerm('');
        setShowFilterPopup(false);
    };

    const handleRowClick = (employee, e) => {
        // Prevent row click when clicking on action buttons or toggles
        if (e.target.closest('button') || 
            e.target.closest('.action-button') || 
            e.target.closest('.switch') ||
            e.target.closest('input[type="checkbox"]') ||
            e.target.classList.contains('toggle-active') ||
            e.target.classList.contains('toggle-access') ||
            e.target.classList.contains('toggle-otp')) {
            return;
        }
        
        // Since the /users/ API returns complete data, we can use it directly
        setSelectedEmployeeForDetails(employee);
    };

    const handleBackToTable = () => {
        setSelectedEmployeeForDetails(null);
    };

    const showEmployeeForm = (employee = null) => {
        setSelectedEmployee(employee);
        setFormVisible(true);
        // Refresh form key to force re-rendering and ID regeneration for new employees
        if (!employee) {
            setFormKey(Date.now());
        }
    };

    const handleFormCancel = () => {
        setFormVisible(false);
        setSelectedEmployee(null);
    };

    const handleFormSubmit = async (values, photoFile) => {
        setFormLoading(true);
        try {
            // Ensure new employees are created with active status by default
            const employeeData = {
                ...values,
                employee_status: values.employee_status || 'active' // Default to active if not specified
            };

            let response;
            let employeeId;

            // Create or update employee using updated APIs
            if (selectedEmployee) {
                // Update existing employee
                response = await hrmsService.updateEmployee(selectedEmployee._id, employeeData);
                employeeId = selectedEmployee._id;
                
                // Show success message and popup for updates
                message.success('Employee updated successfully');
                
                // Show detailed success modal for updates
                Modal.success({
                    title: 'Employee Updated Successfully',
                    content: (
                        <div>
                            <p>The employee data has been updated successfully.</p>
                            <p><strong>Employee:</strong> {employeeData.first_name} {employeeData.last_name}</p>
                            <p><strong>Employee ID:</strong> {employeeData.employee_id ? `RM${employeeData.employee_id}` : 'N/A'}</p>
                            {photoFile && <p><strong>Profile picture:</strong> Updated</p>}
                        </div>
                    ),
                    okText: 'OK',
                    centered: true
                });

                // Upload photo separately if provided for updates
                if (photoFile && employeeId) {
                    await hrmsService.uploadEmployeePhoto(employeeId, photoFile);
                    message.success('Profile photo updated successfully');
                    // Refresh employee list to show updated profile photo
                    await fetchEmployees();
                    // Refresh navbar profile photo if it's the current user
                    if (window.refreshNavbarProfilePhoto) {
                        await window.refreshNavbarProfilePhoto();
                    }
                }
            } else {
                // Create new employee
                
                // Create employee using the working API endpoint
                response = await hrmsService.createEmployee(employeeData);
                
                employeeId = response.data?.id || response.data?._id;
                
                // Show success message and popup for creation
                if (photoFile && employeeId) {
                    await hrmsService.uploadEmployeePhoto(employeeId, photoFile);
                    message.success('Employee created successfully with photo');
                    // Refresh employee list to show new profile photo
                    await fetchEmployees();
                    // Refresh navbar profile photo if it's the current user
                    if (window.refreshNavbarProfilePhoto) {
                        await window.refreshNavbarProfilePhoto();
                    }
                } else {
                    message.success('Employee created successfully');
                }
                
                // Show detailed success modal for creation
                Modal.success({
                    title: 'Employee Created Successfully',
                    content: (
                        <div>
                            <p>The new employee has been created successfully.</p>
                            <p><strong>Employee:</strong> {employeeData.first_name} {employeeData.last_name}</p>
                            <p><strong>Employee ID:</strong> {employeeData.employee_id ? `RM${employeeData.employee_id}` : 'Will be assigned'}</p>
                            {photoFile && <p><strong>Profile picture:</strong> Uploaded</p>}
                            {employeeData.password && (
                                <div style={{ 
                                    marginTop: '15px', 
                                    padding: '10px', 
                                    backgroundColor: '#f6ffed', 
                                    border: '1px solid #b7eb8f', 
                                    borderRadius: '4px' 
                                }}>
                                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#52c41a' }}>
                                        🔐 Login Credentials Created:
                                    </p>
                                    <p style={{ margin: '0', fontFamily: 'monospace' }}>
                                        <strong>Password:</strong> <span style={{ backgroundColor: '#fff', padding: '2px 4px', border: '1px solid #d9d9d9' }}>{employeeData.password}</span>
                                    </p>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                                        
                                    </p>
                                </div>
                            )}
                        </div>
                    ),
                    okText: 'OK',
                    centered: true
                });
            }

            // Close form and refresh data
            setFormVisible(false);
            setSelectedEmployee(null);
            setFormKey(Date.now()); // Refresh form key for next new employee
            await fetchEmployees(); // Refresh the employee list

            return response;
        } catch (error) {
            console.error('❌ Error submitting employee form:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Error stack:', error.stack);
            
            // Show detailed error message
            if (error.message) {
                message.error(`Failed to save employee: ${error.message}`);
            } else {
                message.error('Failed to save employee data. Please check the console for details.');
            }
            throw error;
        } finally {
            setFormLoading(false);
        }
    };

    const showStatusModal = (employee) => {
        setSelectedEmployee(employee);
        setStatusModalVisible(true);
    };

    const showOnboardingModal = (employee) => {
        setSelectedEmployee(employee);
        setOnboardingModalVisible(true);
    };

    const handleStatusUpdate = async (values) => {
        setStatusModalLoading(true);
        try {
            // Ensure the status is properly formatted for the API
            const statusValue = values.status === 'active' ? 'active' : 'inactive';
            
            await hrmsService.updateEmployeeStatus(
                selectedEmployee._id,
                statusValue,
                values.remark
            );

            message.success('Employee status updated successfully');
            setStatusModalVisible(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error updating status:', error);
            message.error('Failed to update employee status');
        } finally {
            setStatusModalLoading(false);
        }
    };

    // Temporary function to test inactive employees - you can call this from browser console
    const testInactiveEmployees = async () => {
        try {
            const response = await hrmsService.getEmployees('all');
            const employees = response.data;
            
            // Set first employee to inactive for testing
            if (employees.length > 0) {
                await hrmsService.updateEmployeeStatus(employees[0]._id, 'inactive', 'Testing inactive status');
                fetchEmployees();
            }
        } catch (error) {
            console.error('Error testing inactive employees:', error);
        }
    };

    // Make the test function available globally for testing
    window.testInactiveEmployees = testInactiveEmployees;

    const handleOnboardingUpdate = async (values) => {
        setStatusModalLoading(true);
        try {
            await hrmsService.updateOnboardingStatus(
                selectedEmployee._id,
                values.status,
                values.remark
            );

            message.success('Onboarding status updated successfully');
            setOnboardingModalVisible(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error updating onboarding status:', error);
            message.error('Failed to update onboarding status');
        } finally {
            setStatusModalLoading(false);
        }
    };

    const handlePasswordManagement = (employee) => {
        setSelectedEmployeeForPassword(employee);
        setPasswordModalVisible(true);
    };

    const handlePasswordModalClose = () => {
        setPasswordModalVisible(false);
        setSelectedEmployeeForPassword(null);
    };

    const handlePasswordUpdateSuccess = () => {
        // Refresh employee list if needed
        fetchEmployees();
    };

    const handleOTPRequiredChange = async (employee, otpRequired) => {
        const employeeId = employee._id;
        
        try {
            // Update OTP requirement via API
            await hrmsService.updateOTPRequired(employeeId, otpRequired);
            
            // Log activity for OTP requirement change
            await hrmsService.logEmployeeActivity(employeeId, {
                action: otpRequired ? 'otp_enabled' : 'otp_disabled',
                description: `OTP requirement ${otpRequired ? 'enabled' : 'disabled'}`,
                timestamp: new Date().toISOString()
            });
            
            // Show toast notification
            message.success(`OTP requirement ${otpRequired ? 'enabled' : 'disabled'} successfully`);
            
            // Update local state without fetching all employees again
            // This preserves scroll position and prevents page reload
            setEmployees(prevEmployees => 
                prevEmployees.map(emp => 
                    emp._id === employeeId 
                        ? { ...emp, otp_required: otpRequired }
                        : emp
                )
            );
        } catch (error) {
            console.error('Error updating OTP requirement:', error);
            message.error('Failed to update OTP requirement');
        }
    };

    const handleDeleteEmployee = async (employee) => {
        try {
            // Check if employee is Super Admin - prevent deletion
            const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
            if (employee.role_id === SUPER_ADMIN_ROLE_ID) {
                message.error('Cannot delete Super Admin employees!');
                return;
            }
            
            // For testing - let's try without confirmation first
            if (window.confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
                
                setLoading(true);
                
                try {
                    // Try to delete the employee
                    const result = await hrmsService.deleteEmployee(employee._id);
                    
                    // Update local state immediately
                    setEmployees(prevEmployees => {
                        const newEmployees = prevEmployees.filter(emp => emp._id !== employee._id);
                        return newEmployees;
                    });
                    
                    message.success('Employee deleted successfully!');
                    
                } catch (deleteError) {
                    
                    // Fallback: Set employee status to inactive
                    await hrmsService.updateEmployeeStatus(employee._id, 'inactive', 'Employee marked as deleted');
                    
                    // Update local state to remove from active list
                    setEmployees(prevEmployees => {
                        const newEmployees = prevEmployees.filter(emp => emp._id !== employee._id);
                        return newEmployees;
                    });
                    
                    message.success('Employee marked as inactive (deleted) successfully!');
                }
            }
            
        } catch (error) {
            console.error('❌ Error deleting employee:', error);
            console.error('❌ Error response:', error.response);
            console.error('❌ Error data:', error.response?.data);
            
            if (error.response?.status === 403) {
                message.error('You do not have permission to delete employees');
            } else if (error.response?.status === 404) {
                message.error('Employee not found');
            } else {
                message.error('Failed to delete employee: ' + (error.response?.data?.detail || error.message));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLoginEnabledChange = async (employee, isEnabled) => {
        const employeeId = employee._id;
        
        try {
            // Update login enabled status
            await hrmsService.updateLoginEnabled(employeeId, isEnabled);
            
            // If login is disabled, cascade disable OTP requirement only (not employee status)
            if (!isEnabled) {
                // Disable OTP requirement if it was enabled
                if (employee.otp_required) {
                    await hrmsService.updateOTPRequired(employeeId, false);
                    await hrmsService.logEmployeeActivity(employeeId, {
                        action: 'otp_disabled',
                        description: 'OTP requirement disabled due to login access removal',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Log activity for login status change
            await hrmsService.logEmployeeActivity(employeeId, {
                action: isEnabled ? 'login_enabled' : 'login_disabled',
                description: `Login access ${isEnabled ? 'enabled' : 'disabled'}`,
                timestamp: new Date().toISOString()
            });
            
            // Show toast notification
            message.success(`Login access ${isEnabled ? 'enabled' : 'disabled'} successfully`);
            
            // Update local state without fetching all employees again
            // This preserves scroll position and prevents page reload
            setEmployees(prevEmployees => 
                prevEmployees.map(emp => 
                    emp._id === employeeId 
                        ? { ...emp, login_enabled: isEnabled }
                        : emp
                )
            );
        } catch (error) {
            console.error('Error updating login access:', error);
            message.error('Failed to update login access');
        }
    };

    const handleEmployeeStatusChange = async (employee, isActive) => {
        const newStatus = isActive ? 'active' : 'inactive';
        const employeeId = employee._id;
        
        try {
            // Update status via API
            await hrmsService.updateEmployeeStatus(employeeId, newStatus, `Status changed to ${newStatus}`);
            
            // If status is set to inactive, cascade disable login and OTP
            if (!isActive) {
                // Disable login if it was enabled
                if (employee.login_enabled) {
                    await hrmsService.updateLoginEnabled(employeeId, false);
                    await hrmsService.logEmployeeActivity(employeeId, {
                        action: 'login_disabled',
                        description: 'Login access disabled due to inactive status',
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Disable OTP requirement if it was enabled
                if (employee.otp_required) {
                    await hrmsService.updateOTPRequired(employeeId, false);
                    await hrmsService.logEmployeeActivity(employeeId, {
                        action: 'otp_disabled',
                        description: 'OTP requirement disabled due to inactive status',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Log activity for employee status change
            await hrmsService.logEmployeeActivity(employeeId, {
                action: isActive ? 'status_activated' : 'status_deactivated',
                description: `Employee status changed to ${newStatus}`,
                timestamp: new Date().toISOString()
            });
            
            // Show toast notification
            message.success(`Employee status updated to ${newStatus}`);
            
            // Update local state without fetching all employees again
            // This preserves scroll position and prevents page reload
            if (newStatus === activeTab) {
                // Employee stays in current tab - update their status
                setEmployees(prevEmployees => 
                    prevEmployees.map(emp => 
                        emp._id === employeeId 
                            ? { ...emp, employee_status: newStatus }
                            : emp
                    )
                );
            } else {
                // Employee moves to different tab - remove from current view
                // This removes the row without affecting scroll position
                setEmployees(prevEmployees => 
                    prevEmployees.filter(emp => emp._id !== employeeId)
                );
            }
        } catch (error) {
            console.error('Error updating status:', error);
            message.error('Failed to update employee status');
        }
    };

    // Compute master status state
    const computeMasterStatusState = () => {
        
        // Filter out super admins from the calculation
        const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
        const nonSuperAdminEmployees = employees.filter(emp => emp.role_id !== SUPER_ADMIN_ROLE_ID);
        
        if (nonSuperAdminEmployees.length === 0) {
            setMasterStatusState({ checked: false, label: 'Off' });
            return;
        }

        const activeCount = nonSuperAdminEmployees.filter(emp => emp.employee_status === 'active').length;
        
        if (activeCount === 0) {
            setMasterStatusState({ checked: false, label: 'Off' });
        } else if (activeCount === nonSuperAdminEmployees.length) {
            setMasterStatusState({ checked: true, label: 'On' });
        } else {
            setMasterStatusState({ checked: false, label: 'Mixed' });
        }
    };

    // Compute master access state
    const computeMasterAccessState = () => {
        // Filter out super admins from the calculation
        const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
        const nonSuperAdminEmployees = employees.filter(emp => emp.role_id !== SUPER_ADMIN_ROLE_ID);
        
        if (nonSuperAdminEmployees.length === 0) {
            setMasterAccessState({ checked: false, label: 'Off' });
            return;
        }

        const accessCount = nonSuperAdminEmployees.filter(emp => emp.login_enabled).length;
        
        if (accessCount === 0) {
            setMasterAccessState({ checked: false, label: 'Off' });
        } else if (accessCount === nonSuperAdminEmployees.length) {
            setMasterAccessState({ checked: true, label: 'On' });
        } else {
            setMasterAccessState({ checked: false, label: 'Mixed' });
        }
    };

    // Compute master OTP state
    const computeMasterOTPState = () => {
        // Filter out super admins from the calculation
        const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
        const nonSuperAdminEmployees = employees.filter(emp => emp.role_id !== SUPER_ADMIN_ROLE_ID);
        
        if (nonSuperAdminEmployees.length === 0) {
            setMasterOTPState({ checked: false, label: 'Off' });
            return;
        }

        const otpCount = nonSuperAdminEmployees.filter(emp => emp.otp_required === true).length;
        
        if (otpCount === 0) {
            setMasterOTPState({ checked: false, label: 'Off' });
        } else if (otpCount === nonSuperAdminEmployees.length) {
            setMasterOTPState({ checked: true, label: 'On' });
        } else {
            setMasterOTPState({ checked: false, label: 'Mixed' });
        }
    };

    // Handle master status toggle - SIMPLIFIED FOR TESTING
    const handleMasterStatusToggle = () => {
        console.log('🔄 Master Status Toggle clicked! Current state:', masterStatusState);
        
        try {
            console.log('🔄 Testing custom confirm function...');
            
            // Determine the target state based on current master state
            let targetStatus;
            let actionText;
            
            if (masterStatusState.label === 'On') {
                // If all are currently active, turn them off
                targetStatus = false;
                actionText = 'deactivate all employees';
            } else {
                // If all are off or mixed, turn them on
                targetStatus = true;
                actionText = 'activate all employees';
            }
            
            console.log('🔄 About to show custom confirm dialog...');
            
            // Show custom confirmation modal
            showConfirm({
                title: 'Bulk Status Update',
                content: `Are you sure you want to ${actionText}? This will affect all employees except super admins.`,
                onOk: async () => {
                    try {
                        console.log(`🔄 Executing bulk status update to: ${targetStatus}`);
                        const response = await hrmsService.bulkUpdateUserStatus(targetStatus);
                        
                        if (response.success) {
                            message.success(`Successfully ${targetStatus ? 'activated' : 'deactivated'} ${response.data.modified_count} employees`);
                            
                            // Refresh the employee list to reflect changes
                            await fetchEmployees();
                        } else {
                            throw new Error(response.message || 'Bulk update failed');
                        }
                    } catch (error) {
                        console.error('❌ Bulk status update failed:', error);
                        message.error(`Failed to update employee status: ${error.message}`);
                    }
                },
                onCancel: () => {
                    console.log('❌ Bulk status update cancelled');
                }
            });
            
            console.log('🔄 Custom confirm dialog should have been shown');
            
        } catch (error) {
            console.error('❌ Error in handleMasterStatusToggle:', error);
        }
    };

    // Handle master access toggle
    const handleMasterAccessToggle = () => {
        console.log('🔄 Master Access Toggle clicked! Current state:', masterAccessState);
        
        try {
            console.log('🔄 Testing custom access confirm function...');
            
            // Determine the target state based on current master state
            let targetLoginEnabled;
            let actionText;
            
            if (masterAccessState.label === 'On') {
                // If all are currently enabled, turn them off
                targetLoginEnabled = false;
                actionText = 'disable login access for all employees';
            } else {
                // If all are off or mixed, turn them on
                targetLoginEnabled = true;
                actionText = 'enable login access for all employees';
            }
            
            console.log('🔄 About to show custom access confirm dialog...');
            
            // Show custom confirmation modal
            showConfirm({
                title: 'Bulk Login Access Update',
                content: `Are you sure you want to ${actionText}? This will affect all employees except super admins.`,
                onOk: async () => {
                    try {
                        console.log(`🔄 Executing bulk login access update to: ${targetLoginEnabled}`);
                        const response = await hrmsService.bulkUpdateLoginAccess(targetLoginEnabled);
                        
                        if (response.success) {
                            message.success(`Successfully ${targetLoginEnabled ? 'enabled' : 'disabled'} login access for ${response.data.modified_count} employees`);
                            
                            // Refresh the employee list to reflect changes
                            await fetchEmployees();
                        } else {
                            throw new Error(response.message || 'Bulk update failed');
                        }
                    } catch (error) {
                        console.error('❌ Bulk login access update failed:', error);
                        message.error(`Failed to update login access: ${error.message}`);
                    }
                },
                onCancel: () => {
                    console.log('❌ Bulk login access update cancelled');
                }
            });
            
        } catch (error) {
            console.error('❌ Error in handleMasterAccessToggle:', error);
        }
    };

    // Handle master OTP toggle
    const handleMasterOTPToggle = () => {
        console.log('🔄 Master OTP Toggle clicked! Current state:', masterOTPState);
        
        try {
            console.log('🔄 Testing custom OTP confirm function...');
            
            // Determine the target state based on current master state
            let targetOtpRequired;
            let actionText;
            
            if (masterOTPState.label === 'On') {
                // If all are currently required, turn them off
                targetOtpRequired = false;
                actionText = 'disable OTP requirement for all employees';
            } else {
                // If all are off or mixed, turn them on
                targetOtpRequired = true;
                actionText = 'enable OTP requirement for all employees';
            }
            
            console.log('🔄 About to show custom OTP confirm dialog...');
            
            // Show custom confirmation modal
            showConfirm({
                title: 'Bulk OTP Requirement Update',
                content: `Are you sure you want to ${actionText}? This will affect all employees except super admins.`,
                onOk: async () => {
                    try {
                        console.log(`🔄 Executing bulk OTP requirement update to: ${targetOtpRequired}`);
                        const response = await hrmsService.bulkUpdateOTPRequirement(targetOtpRequired);
                        
                        if (response.success) {
                            message.success(`Successfully ${targetOtpRequired ? 'enabled' : 'disabled'} OTP requirement for ${response.data.modified_count} employees`);
                            
                            // Refresh the employee list to reflect changes
                            await fetchEmployees();
                        } else {
                            throw new Error(response.message || 'Bulk update failed');
                        }
                    } catch (error) {
                        console.error('❌ Bulk OTP requirement update failed:', error);
                        message.error(`Failed to update OTP requirement: ${error.message}`);
                    }
                },
                onCancel: () => {
                    console.log('❌ Bulk OTP requirement update cancelled');
                }
            });
            
        } catch (error) {
            console.error('❌ Error in handleMasterOTPToggle:', error);
        }
    };

    // Format joining date like in the HTML example
    const formatJoiningDate = (dateString) => {
        if (!dateString) return '-';
        
        const formattedDate = formatDate(dateString);
        
        // Calculate days since joining
        const date = new Date(dateString);
        const today = new Date();
        const msPerDay = 24*60*60*1000;
        const days = Math.max(0, Math.floor((today - date) / msPerDay));
        
        return {
            formatted: formattedDate,
            days
        };
    };

    // Update master states when employees change
    useEffect(() => {
        console.log('🔄 useEffect triggered - employees changed, count:', employees.length);
        console.log('🔄 canEditEmployees:', canEditEmployees);
        computeMasterStatusState();
        computeMasterAccessState();
        computeMasterOTPState();
    }, [employees]);

    const handleEmployeeUpdateInDetails = async (updatedEmployeeData) => {
        console.log('🔄 AllEmployees: handleEmployeeUpdateInDetails called with:', updatedEmployeeData);
        console.log('🔄 AllEmployees: Current selectedEmployeeForDetails:', selectedEmployeeForDetails);
        
        // Refresh the employee table
        console.log('🔄 AllEmployees: Refreshing employee table...');
        await fetchEmployees();
        console.log('✅ AllEmployees: Employee table refreshed');
        
        // If we have a selected employee for details, we should update it with fresh data
        if (selectedEmployeeForDetails) {
            try {
                // If we have the updated data, use it directly to avoid unnecessary API calls
                if (updatedEmployeeData && updatedEmployeeData._id === selectedEmployeeForDetails._id) {
                    console.log('🔄 AllEmployees: Using provided updated data');
                    console.log('✅ AllEmployees: Updated selected employee with fresh data');
                    setSelectedEmployeeForDetails(updatedEmployeeData);
                    return;
                }
                
                // Otherwise, fetch the updated employee data to keep the details view in sync
                console.log('🔄 AllEmployees: Fetching updated employee data from server...');
                const response = await hrmsService.getEmployees('all');
                const updatedEmployee = response.data.find(emp => emp._id === selectedEmployeeForDetails._id);
                
                if (updatedEmployee) {
                    // Process the updated employee data the same way we do in fetchEmployees
                    const isExplicitlyInactive = updatedEmployee.employee_status === false || 
                                               updatedEmployee.employee_status === 'false' || 
                                               updatedEmployee.employee_status === 'inactive' || 
                                               updatedEmployee.employee_status === 'Inactive' || 
                                               updatedEmployee.employee_status === 0 || 
                                               updatedEmployee.employee_status === '0';
                    
                    const normalizedStatus = isExplicitlyInactive ? 'inactive' : 'active';
                    
                    // Get department and role names
                    let departmentName = '-';
                    let roleName = '-';

                    if (updatedEmployee.department_id) {
                        try {
                            const departmentsResponse = await hrmsService.getDepartments();
                            const department = departmentsResponse.data.find(
                                (dept) => dept._id === updatedEmployee.department_id
                            );
                            departmentName = department ? department.name : '-';
                        } catch (error) {
                            console.error('Error fetching departments:', error);
                        }
                    }

                    if (updatedEmployee.role_id) {
                        try {
                            const rolesResponse = await hrmsService.getRoles();
                            const role = rolesResponse.data.find(
                                (role) => role._id === updatedEmployee.role_id
                            );
                            roleName = role ? role.name : '-';
                        } catch (error) {
                            console.error('Error fetching roles:', error);
                        }
                    }

                    // Update the selected employee with all the processed data
                    const processedEmployee = {
                        ...updatedEmployee,
                        department_name: departmentName,
                        role_name: roleName,
                        employee_status: normalizedStatus,
                        normalized_status: normalizedStatus
                    };
                    
                    console.log('🔄 AllEmployees: Updated selected employee with fresh data');
                    setSelectedEmployeeForDetails(processedEmployee);
                }
            } catch (error) {
                console.error('Error fetching updated employee data:', error);
            }
        }
    };

    return (
        <>
            {selectedEmployeeForDetails ? (
                <EmployeeDetails
                    employee={selectedEmployeeForDetails}
                    onBack={handleBackToTable}
                    onEmployeeUpdate={handleEmployeeUpdateInDetails}
                />
            ) : (
                <div style={{ 
                    padding: '2rem',
                    background: 'black',
                    color: '#c9d1d9',
                    fontFamily: 'Arial, sans-serif',
                    minHeight: '100vh'
                }}>
                    <div style={{ background: 'black', borderRadius: '8px', padding: '1.5rem' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'flex-end', 
                            alignItems: 'center', 
                            marginBottom: '1rem'
                        }}>
                            {canEditEmployees && (
                                <Button
                                    style={{
                                        background: '#58a6ff',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                    icon={<PlusOutlined />}
                                    onClick={() => showEmployeeForm()}
                                >
                                    + Add Employee
                                </Button>
                            )}
                        </div>

                        {/* Header with tabs and search/filter (matching LeadCRM style) */}
                        <div className="flex justify-between items-center mb-6 px-2">
                            {/* Left side - Tabs */}
                            <div style={{ 
                                display: 'flex', 
                                background: 'black', 
                                borderRadius: '8px', 
                                overflow: 'hidden'
                            }}>
                                <button
                                    onClick={() => handleTabChange('active')}
                                    style={{
                                        textAlign: 'center',
                                        padding: '0.75rem 2rem',
                                        cursor: 'pointer',
                                        color: activeTab === 'active' ? '#fff' : '#58a6ff',
                                        background: activeTab === 'active' ? '#58a6ff' : 'black',
                                        border: 'none',
                                        fontSize: '1rem',
                                        transition: 'background 0.2s ease',
                                        whiteSpace: 'nowrap'
                                    }}
                                    className={`tab ${activeTab === 'active' ? 'active' : ''}`}
                                >
                                    Active Employees
                                </button>
                                <button
                                    onClick={() => handleTabChange('inactive')}
                                    style={{
                                        textAlign: 'center',
                                        padding: '0.75rem 2rem',
                                        cursor: 'pointer',
                                        color: activeTab === 'inactive' ? '#fff' : '#58a6ff',
                                        background: activeTab === 'inactive' ? '#58a6ff' : 'black',
                                        border: 'none',
                                        fontSize: '1rem',
                                        transition: 'background 0.2s ease',
                                        whiteSpace: 'nowrap'
                                    }}
                                    className={`tab ${activeTab === 'inactive' ? 'active' : ''}`}
                                >
                                    Inactive Employees
                                </button>
                            </div>

                            {/* Right side - Filter and Search (matching LeadCRM) */}
                            <div className="flex items-center gap-3">
                                {/* Filter Button (matching LeadCRM) */}
                                <button
                                    className={`px-5 py-3 rounded-lg font-bold shadow transition relative flex items-center gap-3 text-base ${getActiveFilterCount() > 0
                                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                                        : 'bg-gray-600 text-white hover:bg-gray-700'
                                        }`}
                                    onClick={() => setShowFilterPopup(true)}
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                        />
                                    </svg>
                                    Filter
                                    {getActiveFilterCount() > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                                            {getActiveFilterCount()}
                                        </span>
                                    )}
                                </button>

                                {/* Search Box (matching LeadCRM) */}
                                <div className="relative w-[320px]">
                                    <input
                                        type="text"
                                        placeholder="Search employees..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full py-3 pl-10 pr-4 bg-[#1b2230] text-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base placeholder-gray-500"
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg
                                            className="w-5 h-5 text-gray-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            ></path>
                                        </svg>
                                    </div>
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        

                {loading ? (
                    <div className="text-center py-20" style={{ background: 'black', color: '#c9d1d9' }}>
                        <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span className="text-xl font-semibold text-gray-400">Loading Employees...</span>
                        </div>
                    </div>
                ) : employees.length > 0 ? (
                    <div className="relative">
                        {/* Horizontal scroll buttons */}
                        {canScrollLeft && (
                            <button
                                onClick={() => scrollTable('left')}
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                style={{ 
                                    backgroundColor: 'rgba(37, 99, 235, 1)',
                                    zIndex: 9999
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                aria-label="Scroll left"
                            >
                                <ChevronLeft className="w-9 h-9" />
                            </button>
                        )}
                        
                        {canScrollRight && (
                            <button
                                onClick={() => scrollTable('right')}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                style={{ 
                                    backgroundColor: 'rgba(37, 99, 235, 1)',
                                    zIndex: 9999
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                aria-label="Scroll right"
                            >
                                <ChevronRight className="w-9 h-9" />
                            </button>
                        )}
                        
                        <div 
                            ref={tableScrollRef}
                            className="table-container rounded-lg bg-black overflow-auto"
                            onScroll={updateScrollButtons}
                        >
                            <table className="min-w-full w-full bg-black" style={{ borderCollapse: 'collapse' }}>
                            <thead className="bg-white sticky-header">
                                <tr>
                                    <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Employee ID
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Joining Date
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Employee Name
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Gender
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Designation
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Department
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Highest Qualification
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Current City
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Experience
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        <div className="th-flex">
                                            <span>Status</span>
                                            <div 
                                                className="switch"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (canEditEmployees) {
                                                        console.log('🔄 Master Status Toggle clicked!');
                                                        handleMasterStatusToggle();
                                                    }
                                                }}
                                                style={{ cursor: canEditEmployees ? 'pointer' : 'not-allowed' }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={masterStatusState.label === 'On'}
                                                    onChange={() => {}} // Prevent default checkbox behavior
                                                    disabled={!canEditEmployees}
                                                    style={{ pointerEvents: 'none' }} // Disable direct clicks on checkbox
                                                />
                                                <span className={`state ${masterStatusState.label.toLowerCase()}`}>
                                                    {masterStatusState.label}
                                                </span>
                                            </div>
                                        </div>
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        <div className="th-flex">
                                            <span>Login</span>
                                            <div 
                                                className="switch"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (canEditEmployees) {
                                                        console.log('🔄 Master Access Toggle clicked!');
                                                        handleMasterAccessToggle();
                                                    }
                                                }}
                                                style={{ cursor: canEditEmployees ? 'pointer' : 'not-allowed' }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={masterAccessState.label === 'On'}
                                                    onChange={() => {}} // Prevent default checkbox behavior
                                                    disabled={!canEditEmployees}
                                                    style={{ pointerEvents: 'none' }} // Disable direct clicks on checkbox
                                                />
                                                <span className={`state ${masterAccessState.label.toLowerCase()}`}>
                                                    {masterAccessState.label}
                                                </span>
                                            </div>
                                        </div>
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md text-nowrap font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        <div className="th-flex">
                                            <span>OTP Required</span>
                                            <div 
                                                className="switch"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (canEditEmployees) {
                                                        console.log('🔄 Master OTP Toggle clicked!');
                                                        handleMasterOTPToggle();
                                                    }
                                                }}
                                                style={{ cursor: canEditEmployees ? 'pointer' : 'not-allowed' }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={masterOTPState.label === 'On'}
                                                    onChange={() => {}} // Prevent default checkbox behavior
                                                    disabled={!canEditEmployees}
                                                    style={{ pointerEvents: 'none' }} // Disable direct clicks on checkbox
                                                />
                                                <span className={`state ${masterOTPState.label.toLowerCase()}`}>
                                                    {masterOTPState.label}
                                                </span>
                                            </div>
                                        </div>
                                    </th>
                                    <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-black">
                                {employees.filter(employee => {
                                    // Apply dropdown filters first (updated for multiple selections)
                                    if (selectedDepartments.length > 0 && !selectedDepartments.includes(employee.department)) return false;
                                    if (selectedDesignations.length > 0 && !selectedDesignations.includes(employee.designation)) return false;
                                    if (selectedRoles.length > 0 && !selectedRoles.includes(employee.role)) return false;
                                    
                                    // If no search term, show employees that pass dropdown filters
                                    if (!searchTerm) return true;
                                    
                                    const searchLower = searchTerm.toLowerCase();
                                    
                                    // Search in employee ID (with RM prefix)
                                    const employeeIdWithRM = employee.employee_id ? `rm${employee.employee_id}` : '';
                                    if (employeeIdWithRM.includes(searchLower)) return true;
                                    
                                    // Search in employee ID (without RM prefix)
                                    const employeeId = employee.employee_id ? employee.employee_id.toString() : '';
                                    if (employeeId.includes(searchLower)) return true;
                                    
                                    // Search in name
                                    const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase();
                                    if (fullName.includes(searchLower)) return true;
                                    
                                    // Search in department
                                    const department = (employee.department || '').toLowerCase();
                                    if (department.includes(searchLower)) return true;
                                    
                                    // Search in role
                                    const role = (employee.role || '').toLowerCase();
                                    if (role.includes(searchLower)) return true;
                                    
                                    // Search in designation
                                    const designation = (employee.designation || '').toLowerCase();
                                    if (designation.includes(searchLower)) return true;
                                    
                                    // Search in current city
                                    const currentCity = (employee.current_city || '').toLowerCase();
                                    if (currentCity.includes(searchLower)) return true;
                                    
                                    return false;
                                }).map((employee, index) => {
                                    const joinDate = formatJoiningDate(employee.joining_date);
                                    const isActive = employee.employee_status === 'active';
                                    const loginEnabled = employee.login_enabled;
                                    const otpRequired = employee.otp_required === true;
                                    
                                    return (
                                        <tr
                                            key={employee._id}
                                            onClick={(e) => handleRowClick(employee, e)}
                                            className="hover:bg-gray-900/50 transition cursor-pointer"
                                        >
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {index + 1}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {employee.employee_id ? `RM${employee.employee_id}` : 'No ID'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {joinDate !== '-' ? (
                                                    <>
                                                        <span>{joinDate.formatted}</span>
                                                        <br />
                                                        <small className="tenure">{joinDate.days} days</small>
                                                    </>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                        {employee.profile_photo ? (
                                                            <img 
                                                                src={getProfilePictureUrlWithCacheBusting(employee.profile_photo)} 
                                                                alt={`${employee.first_name} ${employee.last_name}`}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    // Fallback to initials if image fails to load
                                                                    e.target.style.display = 'none';
                                                                    e.target.nextSibling.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <span style={{ display: employee.profile_photo ? 'none' : 'flex' }}>
                                                            {employee.first_name ? employee.first_name.charAt(0).toUpperCase() : "?"}
                                                        </span>
                                                    </div>
                                                    <span>{`${employee.first_name || ''} ${employee.last_name || ''}`}</span>
                                                </div>
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {employee.gender || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {employee.designation || employee.position || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {departments[employee.department_id] || employee.department_name || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {roles[employee.role_id] || employee.role_name || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {employee.highest_qualification || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {employee.current_city || employee.city || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {employee.experience_level || 'Not Specified'}
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                <label className="switch">
                                                    <input 
                                                        type="checkbox" 
                                                        className="toggle-active" 
                                                        checked={isActive}
                                                        onChange={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            console.log('🔄 Status toggle clicked:', e.target.checked);
                                                            handleEmployeeStatusChange(employee, e.target.checked);
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                    />
                                                    <span className={`state ${isActive ? 'on' : 'off'}`}>
                                                        {isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </label>
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                <label className="switch">
                                                    <input 
                                                        type="checkbox" 
                                                        className="toggle-access" 
                                                        checked={loginEnabled}
                                                        disabled={!isActive}
                                                        onChange={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            console.log('🔄 Login Access toggle clicked:', e.target.checked);
                                                            handleLoginEnabledChange(employee, e.target.checked);
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                    />
                                                    <span className={`state ${loginEnabled ? 'on' : 'off'}`}>
                                                        {loginEnabled ? 'On' : 'Off'}
                                                    </span>
                                                </label>
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                <label className="switch">
                                                    <input 
                                                        type="checkbox" 
                                                        className="toggle-otp" 
                                                        checked={otpRequired}
                                                        disabled={!loginEnabled || !isActive}
                                                        onChange={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            console.log('🔄 OTP toggle clicked:', e.target.checked);
                                                            handleOTPRequiredChange(employee, e.target.checked);
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                    />
                                                    <span className={`state ${otpRequired ? 'on' : 'off'}`}>
                                                        {otpRequired ? 'On' : 'Off'}
                                                    </span>
                                                </label>
                                            </td>
                                            <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                {(() => {
                                                    const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
                                                    const isSuperAdmin = employee.role_id === SUPER_ADMIN_ROLE_ID;
                                                    
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                console.log('🗑️ Delete button clicked!', employee);
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (!isSuperAdmin) {
                                                                    handleDeleteEmployee(employee);
                                                                }
                                                            }}
                                                            disabled={isSuperAdmin}
                                                            className={`rounded-full p-2 transition-all duration-200 flex items-center justify-center ${
                                                                isSuperAdmin 
                                                                    ? 'text-gray-400 cursor-not-allowed opacity-50' 
                                                                    : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                                            }`}
                                                            style={{ 
                                                                backgroundColor: isSuperAdmin 
                                                                    ? 'rgba(156, 163, 175, 0.1)' 
                                                                    : 'rgba(239, 68, 68, 0.1)',
                                                                border: isSuperAdmin 
                                                                    ? '1px solid rgba(156, 163, 175, 0.3)' 
                                                                    : '1px solid rgba(239, 68, 68, 0.3)'
                                                            }}
                                                            title={isSuperAdmin ? "Cannot delete Super Admin" : "Delete Employee"}
                                                        >
                                                            <DeleteOutlined style={{ fontSize: '16px' }} />
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20" style={{ background: 'black', color: '#c9d1d9' }}>
                        <div className="text-gray-400 text-lg">
                            {activeTab === 'active' ? 'No active employees found' : 'No inactive employees found'}
                        </div>
                    </div>
                )}
            </div>

            {/* Employee Form Modal */}
            <Modal
                title={null}
                open={formVisible}
                onCancel={handleFormCancel}
                width={920}
                footer={null}
                destroyOnHidden={true}
                centered
                closable={true}
                closeIcon={
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '15px',
                        zIndex: 9999,
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                        ×
                    </div>
                }
                styles={{
                    body: { padding: 0 },
                    header: { display: 'none' },
                    mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' }
                }}
            >
                <EmployeeForm
                    key={formKey}
                    employee={selectedEmployee}
                    onFinish={handleFormSubmit}
                    onCancel={handleFormCancel}
                    loading={formLoading}
                />
            </Modal>

            {/* Status Update Modal */}
            <StatusModal
                open={statusModalVisible}
                title="Update Employee Status"
                confirmLoading={statusModalLoading}
                onCancel={() => setStatusModalVisible(false)}
                onSubmit={handleStatusUpdate}
                type="status"
                currentValue={selectedEmployee?.employee_status}
            />

            {/* Onboarding Update Modal */}
            <StatusModal
                open={onboardingModalVisible}
                title="Update Onboarding Status"
                confirmLoading={statusModalLoading}
                onCancel={() => setOnboardingModalVisible(false)}
                onSubmit={handleOnboardingUpdate}
                type="onboarding"
                currentValue={selectedEmployee?.onboarding_status}
            />

            {/* Password Management Modal */}
            <PasswordManagementModal
                visible={passwordModalVisible}
                onCancel={handlePasswordModalClose}
                employee={selectedEmployeeForPassword}
                onSuccess={handlePasswordUpdateSuccess}
            />

            {/* Custom Confirmation Modal */}
            <Modal
                title={confirmModal.title}
                open={confirmModal.visible}
                onOk={confirmModal.onOk}
                onCancel={confirmModal.onCancel}
                okText="Yes, Update All"
                cancelText="Cancel"
                okType="primary"
                confirmLoading={confirmModal.loading}
                maskClosable={false}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: '16px' }} />
                    <span>{confirmModal.content}</span>
                </div>
            </Modal>

            {/* Filter Popup (matching LeadCRM style) */}
            {showFilterPopup && (
                <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-[1000]">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg p-1 w-[700px] max-w-[90vw] h-[550px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold text-white">Filter Employees</h2>
                            <div className="flex items-center gap-3">
                                {filterDataLoading && (
                                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                                        <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                        <span>Loading filters...</span>
                                    </div>
                                )}
                                {process.env.NODE_ENV === 'development' && (
                                    <button
                                        onClick={fetchFilterData}
                                        className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                                        disabled={filterDataLoading}
                                    >
                                        Reload
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowFilterPopup(false)}
                                    className="text-gray-400 hover:text-white text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
                            {/* Debug Information */}
                            {process.env.NODE_ENV === 'development' && (
                                <div className="col-span-3 bg-gray-800 p-2 rounded text-xs text-gray-400 mb-2">
                                    <strong>Debug Info:</strong><br />
                                    Departments ({allDepartments.length}): {JSON.stringify(allDepartments.slice(0, 3))}<br />
                                    Roles ({allRoles.length}): {JSON.stringify(allRoles.slice(0, 3))}<br />
                                    Designations ({allDesignations.length}): {JSON.stringify(allDesignations.slice(0, 3))}<br />
                                    Loading: {filterDataLoading.toString()}
                                </div>
                            )}

                            {/* Left side - Filter Categories */}
                            <div className="col-span-1 border-r border-gray-600 pr-4">
                                <h3 className="text-base font-medium text-gray-300 mb-4">Filter Categories</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setSelectedFilterCategory('department')}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedFilterCategory === 'department'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Building className="w-5 h-5" />
                                                <span className="text-base">Department</span>
                                            </div>
                                            {getFilterCategoryCount('department') > 0 && (
                                                <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                                                    {getFilterCategoryCount('department')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('designation')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'designation'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                Designation
                                            </div>
                                            {getFilterCategoryCount('designation') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('designation')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilterCategory('role')}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'role'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Role
                                            </div>
                                            {getFilterCategoryCount('role') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('role')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Middle section - Filter Options */}
                            <div className="col-span-2 overflow-y-auto">
                                {/* Department Filter */}
                                {selectedFilterCategory === 'department' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-lg font-semibold text-white">Department Filter</h4>
                                            {selectedDepartments.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedDepartments([])}
                                                    className="text-sm text-red-400 hover:text-red-300"
                                                >
                                                    Clear ({selectedDepartments.length})
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Search input for departments */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search departments..."
                                                value={departmentSearchTerm}
                                                onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                            />
                                            {departmentSearchTerm && (
                                                <button
                                                    onClick={() => setDepartmentSearchTerm('')}
                                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-2 max-h-72 overflow-y-auto">
                                            {getFilterOptions('department')
                                                .filter(dept => dept.toLowerCase().includes(departmentSearchTerm.toLowerCase()))
                                                .length > 0 ? (
                                                getFilterOptions('department')
                                                    .filter(dept => dept.toLowerCase().includes(departmentSearchTerm.toLowerCase()))
                                                    .map((dept) => (
                                                    <label key={dept} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3441] cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            value={dept}
                                                            checked={selectedDepartments.includes(dept)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedDepartments([...selectedDepartments, dept]);
                                                                } else {
                                                                    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                        />
                                                        <span className="text-gray-300">{dept}</span>
                                                    </label>
                                                ))
                                            ) : (
                                                <div className="p-3 text-gray-400 text-center">
                                                    {filterDataLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                            Loading departments...
                                                        </div>
                                                    ) : departmentSearchTerm ? (
                                                        `No departments found for "${departmentSearchTerm}"`
                                                    ) : (
                                                        'No departments available'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Designation Filter */}
                                {selectedFilterCategory === 'designation' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-lg font-semibold text-white">Designation Filter</h4>
                                            {selectedDesignations.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedDesignations([])}
                                                    className="text-sm text-red-400 hover:text-red-300"
                                                >
                                                    Clear ({selectedDesignations.length})
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Search input for designations */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search designations..."
                                                value={designationSearchTerm}
                                                onChange={(e) => setDesignationSearchTerm(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                            />
                                            {designationSearchTerm && (
                                                <button
                                                    onClick={() => setDesignationSearchTerm('')}
                                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-2 max-h-72 overflow-y-auto">
                                            {getFilterOptions('designation')
                                                .filter(designation => designation.toLowerCase().includes(designationSearchTerm.toLowerCase()))
                                                .length > 0 ? (
                                                getFilterOptions('designation')
                                                    .filter(designation => designation.toLowerCase().includes(designationSearchTerm.toLowerCase()))
                                                    .map((designation) => (
                                                    <label key={designation} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3441] cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            value={designation}
                                                            checked={selectedDesignations.includes(designation)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedDesignations([...selectedDesignations, designation]);
                                                                } else {
                                                                    setSelectedDesignations(selectedDesignations.filter(d => d !== designation));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                        />
                                                        <span className="text-gray-300">{designation}</span>
                                                    </label>
                                                ))
                                            ) : (
                                                <div className="p-3 text-gray-400 text-center">
                                                    {filterDataLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                            Loading designations...
                                                        </div>
                                                    ) : designationSearchTerm ? (
                                                        `No designations found for "${designationSearchTerm}"`
                                                    ) : (
                                                        'No designations available'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Role Filter */}
                                {selectedFilterCategory === 'role' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-lg font-semibold text-white">Role Filter</h4>
                                            {selectedRoles.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedRoles([])}
                                                    className="text-sm text-red-400 hover:text-red-300"
                                                >
                                                    Clear ({selectedRoles.length})
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Search input for roles */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search roles..."
                                                value={roleSearchTerm}
                                                onChange={(e) => setRoleSearchTerm(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                            />
                                            {roleSearchTerm && (
                                                <button
                                                    onClick={() => setRoleSearchTerm('')}
                                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-2 max-h-72 overflow-y-auto">
                                            {getFilterOptions('role')
                                                .filter(role => role.toLowerCase().includes(roleSearchTerm.toLowerCase()))
                                                .length > 0 ? (
                                                getFilterOptions('role')
                                                    .filter(role => role.toLowerCase().includes(roleSearchTerm.toLowerCase()))
                                                    .map((role) => (
                                                    <label key={role} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3441] cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            value={role}
                                                            checked={selectedRoles.includes(role)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedRoles([...selectedRoles, role]);
                                                                } else {
                                                                    setSelectedRoles(selectedRoles.filter(r => r !== role));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                        />
                                                        <span className="text-gray-300">{role}</span>
                                                    </label>
                                                ))
                                            ) : (
                                                <div className="p-3 text-gray-400 text-center">
                                                    {filterDataLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                            Loading roles...
                                                        </div>
                                                    ) : roleSearchTerm ? (
                                                        `No roles found for "${roleSearchTerm}"`
                                                    ) : (
                                                        'No roles available'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer with action buttons */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-600">
                            <button
                                onClick={clearAllFilters}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Clear All Filters
                            </button>
                            <button
                                onClick={() => setShowFilterPopup(false)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </div>
            )}
        </>
    );
};

export default AllEmployees;