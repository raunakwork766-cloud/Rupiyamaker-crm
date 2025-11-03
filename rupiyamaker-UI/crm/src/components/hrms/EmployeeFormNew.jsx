import React, { useState, useEffect, useRef } from 'react';
import { message, Modal } from 'antd';
import dayjs from 'dayjs';
import hrmsService from '../../services/hrmsService';
import { getMediaUrl, getProfilePictureUrlWithCacheBusting } from '../../utils/mediaUtils';
import { isSuperAdmin, getUserPermissions } from '../../utils/permissions';
import './EmployeeFormNew.css';

const EmployeeForm = ({
    employee = null,
    onFinish,
    onCancel,
    loading,
    disableSuccessModal = false // New prop to disable success modal
}) => {
    const [formData, setFormData] = useState({
        // Profile Photo
        profile_photo: employee?.profile_photo || '',
        
        // Employee Information
        employee_id: employee?.employee_id ? `RM${employee.employee_id}` : '',
        first_name: employee?.first_name || '',
        last_name: employee?.last_name || '',
        phone: employee?.phone || '',
        alternate_phone: employee?.alternate_phone || '',
        email: employee?.email || '',
        work_email: employee?.work_email || '',
        dob: employee?.dob ? dayjs(employee.dob).format('YYYY-MM-DD') : '',
        pan_number: employee?.pan_number || '',
        aadhaar_number: employee?.aadhaar_number || '',
        highest_qualification: employee?.highest_qualification || '',
        experience_level: employee?.experience_level || '',
        gender: employee?.gender || '',
        marital_status: employee?.marital_status || '',
        nationality: employee?.nationality || 'Indian',
        blood_group: employee?.blood_group || '',
        
        // Address Information
        current_address: employee?.current_address?.address || '',
        current_city: employee?.current_address?.city || employee?.current_city || '',
        current_state: employee?.current_address?.state || '',
        current_pincode: employee?.current_address?.pincode || '',
        same_as_current: false,
        
        // Emergency Contacts - handle both schema formats
        emergency_contact_1_name: employee?.emergency_contacts?.[0]?.name || employee?.emergency_contact_name || '',
        emergency_contact_1_phone: employee?.emergency_contacts?.[0]?.phone || employee?.emergency_contact_phone || '',
        emergency_contact_1_relation: employee?.emergency_contacts?.[0]?.relationship || employee?.emergency_contacts?.[0]?.relation || employee?.emergency_contact_relationship || employee?.emergency_contact_relation || '',
        emergency_contact_2_name: employee?.emergency_contacts?.[1]?.name || '',
        emergency_contact_2_phone: employee?.emergency_contacts?.[1]?.phone || '',
        emergency_contact_2_relation: employee?.emergency_contacts?.[1]?.relationship || employee?.emergency_contacts?.[1]?.relation || '',
        
        // Employment Details
        joining_date: employee?.joining_date ? dayjs(employee.joining_date).format('YYYY-MM-DD') : '',
        monthly_salary: employee?.salary || '',
        monthly_target: employee?.monthly_target || '',
        incentive: employee?.incentive || '',
        department_id: employee?.department_id || '',
        role_id: employee?.role_id || '',
        designation: employee?.designation || '',
        salary_account_number: employee?.salary_account_number || '',
        salary_ifsc_code: employee?.salary_ifsc_code || '',
        salary_bank_name: employee?.salary_bank_name || '',
        
        // Login Credentials
        username: employee?.username || '',
        password: ''
    });

    const [imageUrl, setImageUrl] = useState(getProfilePictureUrlWithCacheBusting(employee?.profile_photo));
    const [imageFile, setImageFile] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [createdPassword, setCreatedPassword] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const [forceRender, setForceRender] = useState(0); // Force re-render counter
    const [phoneCheckTimeout, setPhoneCheckTimeout] = useState(null);

    // Update form data when employee prop changes (for editing)
    useEffect(() => {
        console.log('🔄 EmployeeFormNew: useEffect triggered');
        console.log('🔄 EmployeeFormNew: Employee prop:', employee);
        console.log('🔄 EmployeeFormNew: Refresh key:', employee?._refreshKey);
        console.log('🔄 EmployeeFormNew: Current formData before update:', formData);
        
        if (employee) {
            console.log('🔄 EmployeeFormNew: Employee prop changed, updating form data:', employee);
            console.log('🔄 EmployeeFormNew: Refresh key:', employee?._refreshKey);
            
            const newFormData = {
                // Profile Photo
                profile_photo: employee?.profile_photo || '',
                
                // Employee Information
                employee_id: employee?.employee_id ? `RM${employee.employee_id}` : '',
                first_name: employee?.first_name || '',
                last_name: employee?.last_name || '',
                phone: employee?.phone || '',
                alternate_phone: employee?.alternate_phone || '',
                email: employee?.email || '',
                work_email: employee?.work_email || '',
                dob: employee?.dob ? dayjs(employee.dob).format('YYYY-MM-DD') : '',
                pan_number: employee?.pan_number || '',
                aadhaar_number: employee?.aadhaar_number || '',
                highest_qualification: employee?.highest_qualification || '',
                experience_level: employee?.experience_level || '',
                gender: employee?.gender || '',
                marital_status: employee?.marital_status || '',
                nationality: employee?.nationality || 'Indian',
                blood_group: employee?.blood_group || '',
                
                // Address Information
                current_address: employee?.current_address?.address || '',
                current_city: employee?.current_address?.city || employee?.current_city || '',
                current_state: employee?.current_address?.state || '',
                current_pincode: employee?.current_address?.pincode || '',
                same_as_current: false,
                
                // Emergency Contacts - handle both schema formats
                emergency_contact_1_name: employee?.emergency_contacts?.[0]?.name || employee?.emergency_contact_name || '',
                emergency_contact_1_phone: employee?.emergency_contacts?.[0]?.phone || employee?.emergency_contact_phone || '',
                emergency_contact_1_relation: employee?.emergency_contacts?.[0]?.relationship || employee?.emergency_contacts?.[0]?.relation || employee?.emergency_contact_relationship || employee?.emergency_contact_relation || '',
                emergency_contact_2_name: employee?.emergency_contacts?.[1]?.name || '',
                emergency_contact_2_phone: employee?.emergency_contacts?.[1]?.phone || '',
                emergency_contact_2_relation: employee?.emergency_contacts?.[1]?.relationship || employee?.emergency_contacts?.[1]?.relation || '',
                
                // Employment Details
                joining_date: employee?.joining_date ? dayjs(employee.joining_date).format('YYYY-MM-DD') : '',
                monthly_salary: employee?.salary || '',
                monthly_target: employee?.monthly_target || '',
                incentive: employee?.incentive || '',
                department_id: employee?.department_id || '',
                role_id: employee?.role_id || '',
                designation: employee?.designation || '',
                salary_account_number: employee?.salary_account_number || '',
                salary_ifsc_code: employee?.salary_ifsc_code || '',
                salary_bank_name: employee?.salary_bank_name || '',
                
                // Login Credentials
                username: employee?.username || '',
                password: ''
            };
            
            console.log('🔄 EmployeeFormNew: New form data to be set:', newFormData);
            setFormData(newFormData);
            
            // Force a re-render to ensure form inputs reflect the new data
            setForceRender(prev => prev + 1);
            
            // Update image URL
            const newImageUrl = getProfilePictureUrlWithCacheBusting(employee?.profile_photo);
            console.log('🔄 EmployeeFormNew: Updating image URL:', newImageUrl);
            setImageUrl(newImageUrl);
            
            console.log('✅ EmployeeFormNew: Form data updated with fresh employee data');
            console.log('✅ EmployeeFormNew: Force render triggered:', forceRender + 1);
            
            // Additional debugging
            setTimeout(() => {
                console.log('🔍 Form data state after update:', formData);
                console.log('🔍 Sample field values:', {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone: formData.phone
                });
            }, 100);
        } else {
            console.log('⚠️ EmployeeFormNew: No employee prop provided');
        }
    }, [employee, employee?._refreshKey]); // Also respond to refresh key changes

    const isEditing = !!employee;
    const userPermissions = getUserPermissions();

    // Create refs for required fields to enable auto-focus
    const firstNameRef = useRef(null);
    const lastNameRef = useRef(null);
    const phoneRef = useRef(null);
    const emailRef = useRef(null);
    const joiningDateRef = useRef(null);
    const usernameRef = useRef(null);
    const passwordRef = useRef(null);
    const isUserSuperAdmin = isSuperAdmin(userPermissions);
    
    // Check if user has permission to view/edit employee passwords
    const hasPasswordPermission = () => {
        // Super admin always has access
        if (isUserSuperAdmin) {
            return true;
        }
        
        // Check for specific "employees" "password" permission
        try {
            // Check if user has employees permission with password action
            return userPermissions?.employees?.password === true || 
                   userPermissions?.Employees?.password === true ||
                   userPermissions?.employees?.includes?.('password') ||
                   userPermissions?.Employees?.includes?.('password');
        } catch (error) {
            console.error('Error checking password permission:', error);
            return false;
        }
    };
    
    // Check if user has permission to view/edit employee roles
    const hasRolePermission = () => {
        // Super admin always has access
        if (isUserSuperAdmin) {
            return true;
        }
        
        // Check for specific "employees" "role" permission
        try {
            // Check if user has employees permission with role action
            return userPermissions?.employees?.role === true || 
                   userPermissions?.Employees?.role === true ||
                   userPermissions?.employees?.includes?.('role') ||
                   userPermissions?.Employees?.includes?.('role');
        } catch (error) {
            console.error('Error checking role permission:', error);
            return false;
        }
    };
    
    // Password field should be shown for users with password permission or super admins
    const shouldShowPasswordField = hasPasswordPermission();
    
    // Role field should be shown for users with role permission or super admins
    const shouldShowRoleField = hasRolePermission();
    
    // For editing, show password field to users with password permission or super admins
    const shouldShowPasswordFieldForEditing = isEditing && hasPasswordPermission();
    
    // For editing, show role field to users with role permission or super admins
    const shouldShowRoleFieldForEditing = isEditing && hasRolePermission();
    
    // Auto-show password when editing (so users with permission can see current password)
    useEffect(() => {
        if (isEditing && hasPasswordPermission()) {
            setShowPassword(true); // Show password by default when editing
        }
    }, [isEditing]);
    
    // Debug logging
    console.log('🔐 EmployeeFormNew: Password field visibility check:', {
        isEditing,
        isUserSuperAdmin,
        hasPasswordPermission: hasPasswordPermission(),
        shouldShowPasswordField,
        shouldShowPasswordFieldForEditing,
        userPermissions,
        employee: employee?._id
    });

    // Debug logging for role permission
    console.log('👑 EmployeeFormNew: Role field visibility check:', {
        isEditing,
        isUserSuperAdmin,
        hasRolePermission: hasRolePermission(),
        shouldShowRoleField,
        shouldShowRoleFieldForEditing,
        userPermissions,
        employee: employee?._id
    });

    // Function to fetch employee password (for users with password permission)
    const fetchEmployeePassword = async (employeeId) => {
        try {
            console.log('🔐 Fetching employee password for authorized user...', { employeeId });
            const response = await hrmsService.getEmployeePassword(employeeId);
            console.log('🔐 Password fetch response:', response);
            
            if (response && response.data && response.data.password) {
                const password = response.data.password;
                console.log('✅ Employee password found:', password);
                
                // Check if password is a special message (legacy hash, etc.)
                if (password.startsWith('[') && password.endsWith(']')) {
                    // This is a special message like "[Legacy Hash - Cannot Display]"
                    setCurrentPassword(password);
                    setFormData(prev => ({
                        ...prev,
                        password: '' // Don't set the special message in form data
                    }));
                    console.log('⚠️ Special password message:', password);
                } else {
                    // This is a regular decrypted password
                    setCurrentPassword(password);
                    setFormData(prev => ({
                        ...prev,
                        password: password
                    }));
                    console.log('✅ Employee password set in form data:', password);
                }
            } else {
                console.log('⚠️ No password found in response:', response);
                // Set empty password if no password found
                setCurrentPassword('');
                setFormData(prev => ({
                    ...prev,
                    password: ''
                }));
            }
        } catch (error) {
            console.error('❌ Error fetching employee password:', error);
            console.log('❌ Error details:', error.message, error.response);
            
            // Don't set any placeholder - leave field empty if API fails
            console.log('ℹ️ Password field will remain empty due to API error');
            setCurrentPassword('');
            setFormData(prev => ({
                ...prev,
                password: ''
            }));
        }
    };

    useEffect(() => {
        console.log('🔍 useEffect: Checking password fetch conditions:', {
            isEditing,
            hasPasswordPermission: hasPasswordPermission(),
            employee: employee,
            employeeId: employee?._id,
            shouldFetch: isEditing && hasPasswordPermission() && employee?._id
        });
        
        fetchDropdownData();
        // Fetch employee password if editing and user has password permission
        if (isEditing && hasPasswordPermission() && employee?._id) {
            console.log('🔐 useEffect: Calling fetchEmployeePassword for employee:', employee._id);
            fetchEmployeePassword(employee._id);
        } else {
            console.log('❌ useEffect: Not fetching password. Conditions not met:', {
                isEditing,
                hasPasswordPermission: hasPasswordPermission(),
                hasEmployeeId: !!employee?._id
            });
        }
    }, [isEditing, employee?._id]);

    // Update form data when employee prop changes
    useEffect(() => {
        if (employee) {
            console.log('🎯 EmployeeFormNew received employee data:', employee);
            console.log('📋 Employee fields available for mapping:', {
                basic: {
                    employee_id: employee?.employee_id,
                    first_name: employee?.first_name,
                    last_name: employee?.last_name,
                    email: employee?.email,
                    phone: employee?.phone,
                    alternate_phone: employee?.alternate_phone,
                    work_email: employee?.work_email
                },
                personal: {
                    dob: employee?.dob,
                    gender: employee?.gender,
                    marital_status: employee?.marital_status,
                    nationality: employee?.nationality,
                    blood_group: employee?.blood_group,
                    pan_number: employee?.pan_number,
                    aadhaar_number: employee?.aadhaar_number,
                    highest_qualification: employee?.highest_qualification,
                    experience_level: employee?.experience_level
                },
                addresses: {
                    current_address: employee?.current_address,
                    current_city: employee?.current_city
                },
                emergency: {
                    emergency_contacts: employee?.emergency_contacts,
                    emergency_contact_name: employee?.emergency_contact_name,
                    emergency_contact_phone: employee?.emergency_contact_phone,
                    emergency_contact_relationship: employee?.emergency_contact_relationship
                },
                employment: {
                    joining_date: employee?.joining_date,
                    salary: employee?.salary,
                    monthly_target: employee?.monthly_target,
                    incentive: employee?.incentive,
                    department_id: employee?.department_id,
                    role_id: employee?.role_id,
                    designation: employee?.designation,
                    salary_account_number: employee?.salary_account_number,
                    salary_ifsc_code: employee?.salary_ifsc_code,
                    salary_bank_name: employee?.salary_bank_name
                }
            });
            
            const mappedFormData = {
                // Profile Photo
                profile_photo: employee?.profile_photo || '',
                
                // Employee Information
                employee_id: employee?.employee_id ? `RM${employee.employee_id}` : '',
                first_name: employee?.first_name || '',
                last_name: employee?.last_name || '',
                phone: employee?.phone || '',
                alternate_phone: employee?.alternate_phone || '',
                email: employee?.email || '',
                work_email: employee?.work_email || '',
                dob: employee?.dob ? dayjs(employee.dob).format('YYYY-MM-DD') : '',
                pan_number: employee?.pan_number || '',
                aadhaar_number: employee?.aadhaar_number || '',
                highest_qualification: employee?.highest_qualification || '',
                experience_level: employee?.experience_level || '',
                gender: employee?.gender || '',
                marital_status: employee?.marital_status || '',
                nationality: employee?.nationality || 'Indian',
                blood_group: employee?.blood_group || '',
                
                // Address Information
                current_address: employee?.current_address?.address || '',
                current_city: employee?.current_address?.city || employee?.current_city || '',
                current_state: employee?.current_address?.state || '',
                current_pincode: employee?.current_address?.pincode || '',
                same_as_current: false,
                
                // Emergency Contacts - handle both schema formats
                emergency_contact_1_name: employee?.emergency_contacts?.[0]?.name || employee?.emergency_contact_name || '',
                emergency_contact_1_phone: employee?.emergency_contacts?.[0]?.phone || employee?.emergency_contact_phone || '',
                emergency_contact_1_relation: employee?.emergency_contacts?.[0]?.relationship || employee?.emergency_contacts?.[0]?.relation || employee?.emergency_contact_relationship || employee?.emergency_contact_relation || '',
                emergency_contact_2_name: employee?.emergency_contacts?.[1]?.name || '',
                emergency_contact_2_phone: employee?.emergency_contacts?.[1]?.phone || '',
                emergency_contact_2_relation: employee?.emergency_contacts?.[1]?.relationship || employee?.emergency_contacts?.[1]?.relation || '',
                
                // Employment Details
                joining_date: employee?.joining_date ? dayjs(employee.joining_date).format('YYYY-MM-DD') : '',
                monthly_salary: employee?.salary || '',
                monthly_target: employee?.monthly_target || '',
                incentive: employee?.incentive || '',
                department_id: employee?.department_id || '',
                role_id: employee?.role_id || '',
                designation: employee?.designation || '',
                salary_account_number: employee?.salary_account_number || '',
                salary_ifsc_code: employee?.salary_ifsc_code || '',
                salary_bank_name: employee?.salary_bank_name || '',
                
                // Login Credentials
                username: employee?.username || '',
                password: ''
            };
            
            console.log('🔍 Mapped form data that will be set:', mappedFormData);
            console.log('✅ Setting form data with mapped values');
            
            setFormData(mappedFormData);
            
            // Update image URL with cache-busting
            setImageUrl(getProfilePictureUrlWithCacheBusting(employee?.profile_photo));
        } else {
            console.log('❌ No employee data provided, generating new ID');
            // Reset form for new employee and auto-generate employee ID
            generateNextEmployeeId();
        }
    }, [employee]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (phoneCheckTimeout) {
                clearTimeout(phoneCheckTimeout);
            }
        };
    }, [phoneCheckTimeout]);

    // Listen for password updates from navbar change password feature
    useEffect(() => {
        const handlePasswordUpdate = (event) => {
            const { userId } = event.detail;
            console.log('🔐 Password update event received:', userId);
            
            // If this form is showing the same user who updated their password, refresh the password
            if (employee?._id === userId && isEditing && hasPasswordPermission()) {
                console.log('🔄 Refreshing password for current employee after update');
                setTimeout(() => {
                    fetchEmployeePassword(employee._id);
                }, 1000); // Small delay to ensure backend has processed the update
            }
        };

        window.addEventListener('passwordUpdated', handlePasswordUpdate);
        
        return () => {
            window.removeEventListener('passwordUpdated', handlePasswordUpdate);
        };
    }, [employee?._id, isEditing]);

    // Function to generate next employee ID
    const generateNextEmployeeId = async () => {
        try {
            // Get all employees to find the next ID
            const response = await hrmsService.getAllEmployees();
            if (response && response.data) {
                // Find the highest employee_id number
                let maxId = 0;
                response.data.forEach(emp => {
                    if (emp.employee_id) {
                        const numericId = parseInt(emp.employee_id);
                        if (!isNaN(numericId) && numericId > maxId) {
                            maxId = numericId;
                        }
                    }
                });
                
                // Next ID
                const nextId = (maxId + 1).toString().padStart(3, '0');
                
                setFormData({
                    profile_photo: '',
                    employee_id: `RM${nextId}`,
                    first_name: '',
                    last_name: '',
                    phone: '',
                    alternate_phone: '',
                    email: '',
                    work_email: '',
                    dob: '',
                    pan_number: '',
                    aadhaar_number: '',
                    highest_qualification: '',
                    experience_level: '',
                    gender: '',
                    marital_status: '',
                    nationality: 'Indian',
                    blood_group: '',
                    current_address: '',
                    current_city: '',
                    current_state: '',
                    current_pincode: '',
                    same_as_current: false,
                    emergency_contact_1_name: '',
                    emergency_contact_1_phone: '',
                    emergency_contact_1_relation: '',
                    emergency_contact_2_name: '',
                    emergency_contact_2_phone: '',
                    emergency_contact_2_relation: '',
                    joining_date: '',
                    monthly_salary: '',
                    monthly_target: '',
                    incentive: '',
                    department_id: '',
                    role_id: '',
                    designation: '',
                    salary_account_number: '',
                    salary_ifsc_code: '',
                    salary_bank_name: '',
                    username: '',
                    password: ''
                });
            } else {
                // If no employees exist, start with RM001
                setFormData({
                    profile_photo: '',
                    employee_id: 'RM001',
                    first_name: '',
                    last_name: '',
                    phone: '',
                    alternate_phone: '',
                    email: '',
                    work_email: '',
                    dob: '',
                    pan_number: '',
                    aadhaar_number: '',
                    highest_qualification: '',
                    experience_level: '',
                    gender: '',
                    marital_status: '',
                    nationality: 'Indian',
                    blood_group: '',
                    current_address: '',
                    current_city: '',
                    current_state: '',
                    current_pincode: '',
                    same_as_current: false,
                    emergency_contact_1_name: '',
                    emergency_contact_1_phone: '',
                    emergency_contact_1_relation: '',
                    emergency_contact_2_name: '',
                    emergency_contact_2_phone: '',
                    emergency_contact_2_relation: '',
                    joining_date: '',
                    monthly_salary: '',
                    monthly_target: '',
                    incentive: '',
                    department_id: '',
                    role_id: '',
                    designation: '',
                    salary_account_number: '',
                    salary_ifsc_code: '',
                    salary_bank_name: '',
                    username: '',
                    password: ''
                });
            }
            setImageUrl(null);
        } catch (error) {
            console.error('Error generating employee ID:', error);
            // Fallback to RM001 if there's an error
            setFormData({
                profile_photo: '',
                employee_id: 'RM001',
                first_name: '',
                last_name: '',
                phone: '',
                alternate_phone: '',
                email: '',
                work_email: '',
                dob: '',
                pan_number: '',
                aadhaar_number: '',
                highest_qualification: '',
                experience_level: '',
                gender: '',
                marital_status: '',
                nationality: 'Indian',
                blood_group: '',
                current_address: '',
                current_city: '',
                current_state: '',
                current_pincode: '',
                same_as_current: false,
                emergency_contact_1_name: '',
                emergency_contact_1_phone: '',
                emergency_contact_1_relation: '',
                emergency_contact_2_name: '',
                emergency_contact_2_phone: '',
                emergency_contact_2_relation: '',
                joining_date: '',
                monthly_salary: '',
                monthly_target: '',
                incentive: '',
                department_id: '',
                role_id: '',
                designation: '',
                salary_account_number: '',
                salary_ifsc_code: '',
                salary_bank_name: '',
                username: '',
                password: ''
            });
            setImageUrl(null);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const [departmentsRes, rolesRes, designationsRes] = await Promise.all([
                hrmsService.getDepartments(),
                hrmsService.getRoles(),
                hrmsService.getDesignations()
            ]);

            // Extract departments
            let departmentsData = [];
            if (departmentsRes?.data) {
                departmentsData = Array.isArray(departmentsRes.data) ? departmentsRes.data : departmentsRes.data.departments || [];
            } else if (Array.isArray(departmentsRes)) {
                departmentsData = departmentsRes;
            }

            // Extract roles
            let rolesData = [];
            if (rolesRes?.data) {
                rolesData = Array.isArray(rolesRes.data) ? rolesRes.data : rolesRes.data.roles || [];
            } else if (Array.isArray(rolesRes)) {
                rolesData = rolesRes;
            }

            // Extract designations
            let designationsData = [];
            if (designationsRes?.data) {
                designationsData = Array.isArray(designationsRes.data) ? designationsRes.data : designationsRes.data.designations || [];
            } else if (Array.isArray(designationsRes)) {
                designationsData = designationsRes;
            }

            setDepartments(departmentsData.filter(dept => dept && dept.name));
            setRoles(rolesData.filter(role => role && role.name));
            setDesignations(designationsData.filter(designation => designation && designation.name));

        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
            message.error('Failed to load form data');
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            let processedValue = value;
            
            // Fields that should be converted to uppercase for alphabetic text (EXCLUDE dropdown fields)
            const uppercaseFields = [
                'first_name', 'last_name', 'nationality', 'blood_group',
                'current_address', 'current_city', 'current_state',
                'emergency_contact_1_name', 'emergency_contact_1_relation',
                'emergency_contact_2_name', 'emergency_contact_2_relation',
                'designation', 'salary_bank_name'
            ];

            // Convert alphabetic text to uppercase for specified fields (EXCLUDE dropdowns)
            if (uppercaseFields.includes(name)) {
                processedValue = value.toUpperCase();
            }
            
            // Apply specific validations and formatting for unique fields
            switch (name) {
                case 'phone':
                case 'alternate_phone':
                    // Allow only numbers, limit to 10 digits
                    processedValue = value.replace(/\D/g, '').slice(0, 10);
                    
                    // Real-time validation for phone number length
                    if (name === 'phone') {
                        if (processedValue.length > 0 && processedValue.length < 10) {
                            setValidationErrors(prevErrors => ({
                                ...prevErrors,
                                phone: `Mobile number must be 10 digits (${processedValue.length} digits entered)`
                            }));
                        } else if (processedValue.length === 10) {
                            setValidationErrors(prevErrors => {
                                const newErrors = { ...prevErrors };
                                delete newErrors.phone;
                                return newErrors;
                            });
                        }
                    }
                    break;
                    
                case 'pan_number':
                    // Format PAN: AAAAA9999A (5 letters, 4 digits, 1 letter)
                    // Convert to uppercase and allow only valid PAN characters
                    processedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                    // Basic PAN pattern validation (not enforced, just formatting)
                    if (processedValue.length > 5) {
                        // Ensure positions 6-9 are digits
                        const letters1 = processedValue.slice(0, 5).replace(/[^A-Z]/g, '');
                        const digits = processedValue.slice(5, 9).replace(/[^0-9]/g, '');
                        const letter2 = processedValue.slice(9, 10).replace(/[^A-Z]/g, '');
                        processedValue = letters1 + digits + letter2;
                    }
                    break;
                    
                case 'aadhaar_number':
                    // Allow only numbers, limit to 12 digits
                    processedValue = value.replace(/\D/g, '').slice(0, 12);
                    break;
                    
                case 'password':
                    // Password validation - minimum 3 characters
                    if (processedValue.length > 0 && processedValue.length < 3) {
                        setValidationErrors(prevErrors => ({
                            ...prevErrors,
                            password: `Password is too short (${processedValue.length} characters). Minimum 3 characters required.`
                        }));
                    } else if (processedValue.length >= 3) {
                        setValidationErrors(prevErrors => {
                            const newErrors = { ...prevErrors };
                            delete newErrors.password;
                            return newErrors;
                        });
                    }
                    break;
                    
                default:
                    // No special processing for other fields
                    break;
            }
            
            setFormData(prev => {
                const newData = { ...prev, [name]: processedValue };
                
                // Clear previous validation errors for this field
                setValidationErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors[name];
                    delete newErrors.phone_conflict;
                    
                    // Clear "required" error if field now has value
                    if (processedValue.trim()) {
                        delete newErrors[name];
                    }
                    
                    return newErrors;
                });
                
                // Real-time validation for phone number conflicts
                if (name === 'phone' && newData.alternate_phone && processedValue === newData.alternate_phone) {
                    message.warning('⚠️ Primary mobile number cannot be the same as alternate mobile number');
                    setValidationErrors(prevErrors => ({
                        ...prevErrors,
                        phone_conflict: 'Numbers cannot be the same',
                        phone: 'Same as alternate number',
                        alternate_phone: 'Same as primary number'
                    }));
                } else if (name === 'alternate_phone' && newData.phone && processedValue === newData.phone) {
                    message.warning('⚠️ Alternate mobile number cannot be the same as primary mobile number');
                    setValidationErrors(prevErrors => ({
                        ...prevErrors,
                        phone_conflict: 'Numbers cannot be the same',
                        phone: 'Same as alternate number',
                        alternate_phone: 'Same as primary number'
                    }));
                } else {
                    // Clear phone conflict errors if numbers are now different
                    setValidationErrors(prevErrors => {
                        const newErrors = { ...prevErrors };
                        delete newErrors.phone_conflict;
                        if (name === 'phone' || name === 'alternate_phone') {
                            delete newErrors.phone;
                            delete newErrors.alternate_phone;
                        }
                        return newErrors;
                    });
                    
                    // Check for database duplicates for phone numbers (debounced)
                    if ((name === 'phone' || name === 'alternate_phone') && processedValue.length === 10) {
                        // Clear existing timeout
                        if (phoneCheckTimeout) {
                            clearTimeout(phoneCheckTimeout);
                        }
                        
                        // Set new timeout for debounced check
                        const timeoutId = setTimeout(() => {
                            checkPhoneUniqueness(name, processedValue);
                        }, 500); // Wait 500ms after user stops typing
                        
                        setPhoneCheckTimeout(timeoutId);
                    }
                }
                
                return newData;
            });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file
            const isImage = file.type.startsWith('image/');
            const isValidSize = file.size / 1024 / 1024 < 2; // 2MB limit

            if (!isImage) {
                message.error('Please select a valid image file');
                return;
            }

            if (!isValidSize) {
                message.error('Image size must be less than 2MB');
                return;
            }

            setImageFile(file);
            
            // Create preview URL
            const reader = new FileReader();
            reader.onload = () => setImageUrl(reader.result);
            reader.readAsDataURL(file);
        }
    };

    // Debounced function to check phone number uniqueness in real-time
    const checkPhoneUniqueness = async (fieldName, phoneNumber) => {
        try {
            console.log(`🔍 Checking ${fieldName} uniqueness for: ${phoneNumber}`);
            
            const response = await hrmsService.getAllEmployees();
            if (!response || !response.data) {
                console.log('⚠️ Could not fetch employees for phone validation');
                return;
            }

            const existingEmployees = response.data;
            
            // For editing, exclude the current employee from the check
            const employeesToCheck = employee 
                ? existingEmployees.filter(emp => emp._id !== employee._id)
                : existingEmployees;

            let isDuplicate = false;
            let errorMessage = '';

            if (fieldName === 'phone') {
                // Check if phone number exists as primary or alternate number
                const existingEmployee = employeesToCheck.find(emp => 
                    (emp.phone && emp.phone === phoneNumber) ||
                    (emp.alternate_phone && emp.alternate_phone === phoneNumber)
                );
                if (existingEmployee) {
                    isDuplicate = true;
                    const employeeName = `${existingEmployee.first_name || ''} ${existingEmployee.last_name || ''}`.trim();
                    const empId = existingEmployee.employee_id ? ` (ID: ${existingEmployee.employee_id})` : '';
                    errorMessage = `Mobile number ${phoneNumber} is already registered with ${employeeName}${empId}`;
                }
            } else if (fieldName === 'alternate_phone') {
                // Check if alternate phone exists as primary or alternate number
                const existingEmployee = employeesToCheck.find(emp => 
                    (emp.phone && emp.phone === phoneNumber) ||
                    (emp.alternate_phone && emp.alternate_phone === phoneNumber)
                );
                if (existingEmployee) {
                    isDuplicate = true;
                    const employeeName = `${existingEmployee.first_name || ''} ${existingEmployee.last_name || ''}`.trim();
                    const empId = existingEmployee.employee_id ? ` (ID: ${existingEmployee.employee_id})` : '';
                    errorMessage = `Alternate number ${phoneNumber} is already registered with ${employeeName}${empId}`;
                }
            }

            if (isDuplicate) {
                setValidationErrors(prevErrors => ({
                    ...prevErrors,
                    [fieldName]: errorMessage
                }));
            } else {
                // Clear the error if number is unique
                setValidationErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors[fieldName];
                    // Also clear any related duplicate errors
                    if (fieldName === 'phone') {
                        delete newErrors.phone_duplicate;
                    } else if (fieldName === 'alternate_phone') {
                        delete newErrors.alternate_phone_duplicate;
                    }
                    return newErrors;
                });
            }

        } catch (error) {
            console.error('❌ Error checking phone uniqueness:', error);
        }
    };

    // Validation function to check for duplicate field values
    const validateUniqueFields = async () => {
        try {
            console.log('🔍 Validating unique fields...');
            
            // If no unique fields are provided, skip validation entirely
            const hasUniqueFieldsToCheck = formData.phone || formData.alternate_phone || formData.pan_number || formData.aadhaar_number;
            if (!hasUniqueFieldsToCheck) {
                console.log('✅ No unique fields to validate, skipping check');
                return true;
            }
            
            const response = await hrmsService.getAllEmployees();
            
            if (!response || !response.data) {
                console.log('⚠️ Could not fetch employees for validation, allowing submission');
                return true; // Continue with submission if we can't validate
            }

            const existingEmployees = response.data;
            console.log(`📊 Checking against ${existingEmployees.length} existing employees`);

            // For editing, exclude the current employee from the check
            const employeesToCheck = employee 
                ? existingEmployees.filter(emp => emp._id !== employee._id)
                : existingEmployees;

            console.log('📝 Form data to validate:', {
                phone: formData.phone,
                alternate_phone: formData.alternate_phone,
                pan_number: formData.pan_number,
                aadhaar_number: formData.aadhaar_number
            });

            // Only validate fields that have values
            // Check mobile number uniqueness
            if (formData.phone && formData.phone.trim()) {
                const existingEmployee = employeesToCheck.find(emp => 
                    emp.phone && emp.phone === formData.phone
                );
                if (existingEmployee) {
                    const employeeName = `${existingEmployee.first_name || ''} ${existingEmployee.last_name || ''}`.trim();
                    const empId = existingEmployee.employee_id ? ` (ID: ${existingEmployee.employee_id})` : '';
                    message.error(`❌ Mobile number ${formData.phone} is already registered with ${employeeName}${empId}`);
                    return false;
                }
            }

            // Check alternate mobile number uniqueness
            if (formData.alternate_phone && formData.alternate_phone.trim()) {
                const existingEmployee = employeesToCheck.find(emp => 
                    (emp.alternate_phone && emp.alternate_phone === formData.alternate_phone) ||
                    (emp.phone && emp.phone === formData.alternate_phone)
                );
                if (existingEmployee) {
                    const employeeName = `${existingEmployee.first_name || ''} ${existingEmployee.last_name || ''}`.trim();
                    const empId = existingEmployee.employee_id ? ` (ID: ${existingEmployee.employee_id})` : '';
                    message.error(`❌ Alternate mobile number ${formData.alternate_phone} is already registered with ${employeeName}${empId}`);
                    return false;
                }

                // Also check if alternate phone is same as primary phone
                if (formData.alternate_phone === formData.phone) {
                    message.error('❌ Alternate mobile number cannot be the same as primary mobile number');
                    return false;
                }
            }

            // Check PAN card uniqueness
            if (formData.pan_number && formData.pan_number.trim()) {
                const panExists = employeesToCheck.some(emp => 
                    emp.pan_number && emp.pan_number.toUpperCase() === formData.pan_number.toUpperCase()
                );
                if (panExists) {
                    message.error(`❌ PAN card number ${formData.pan_number.toUpperCase()} is already registered with another employee`);
                    return false;
                }
            }

            // Check Aadhar card uniqueness
            if (formData.aadhaar_number && formData.aadhaar_number.trim()) {
                const aadhaarExists = employeesToCheck.some(emp => 
                    emp.aadhaar_number && emp.aadhaar_number === formData.aadhaar_number
                );
                if (aadhaarExists) {
                    message.error(`❌ Aadhar card number ${formData.aadhaar_number} is already registered with another employee`);
                    return false;
                }
            }

            console.log('✅ All unique field validations passed');
            return true;

        } catch (error) {
            console.error('❌ Error validating unique fields:', error);
            console.log('⚠️ Validation error occurred, allowing submission to proceed');
            // Don't block submission due to validation errors - let backend handle it
            return true;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('🚀 EmployeeFormNew: handleSubmit function triggered!');
        console.log(`📋 SUBMISSION MODE: ${isEditing ? '✏️  EDITING EMPLOYEE' : '➕ CREATING NEW EMPLOYEE'}`);
        console.log(`📋 Employee ID: ${employee?._id || 'N/A'}`);
        console.log('🚀 Current formData:', formData);
        console.log('🚀 onFinish function available:', typeof onFinish);
        console.log('🚀 Current loading state:', loading);
        
        // Prevent multiple submissions
        if (loading) {
            console.log('⚠️ Already submitting, ignoring duplicate submission');
            return;
        }

        // Validate required fields - different requirements for new vs editing
        let requiredFields;
        
        if (isEditing) {
            // For editing, only basic fields are required - unique fields are optional
            requiredFields = ['first_name', 'last_name'];
            console.log('📝 Editing existing employee - only first_name and last_name are required');
        } else {
            // For new employees, these fields are required
            requiredFields = ['first_name', 'last_name', 'phone', 'joining_date', 'username', 'password'];
            console.log('📝 New employee creation - all fields including phone, username and password are required');
        }
        
        // Special validation for password field - only validate if the field is visible to the user
        let fieldsToValidate = [...requiredFields];
        if (!shouldShowPasswordField && !isEditing) {
            // If password field is not shown to user for new employee, don't require it in validation
            fieldsToValidate = fieldsToValidate.filter(field => field !== 'password');
            console.log('📝 Password field validation skipped for new employee with no password permission');
        }
        
        const missingFields = fieldsToValidate.filter(field => !formData[field] || !formData[field].trim());

        console.log('🚀 Required fields check:', { requiredFields: fieldsToValidate, missingFields, isEditing, formDataKeys: Object.keys(formData) });

        if (missingFields.length > 0) {
            console.log('❌ Missing required fields:', missingFields);
            console.log('❌ VALIDATION FAILED - Missing fields, stopping submission');
            
            // For editing mode, be more informative about what's actually required
            if (isEditing) {
                console.log('ℹ️  EDITING MODE: Only first_name and last_name are required. Other fields are optional.');
            } else {
                console.log('ℹ️  NEW EMPLOYEE MODE: All specified fields are required.');
            }
            
            // Set validation errors for missing fields
            const newValidationErrors = {};
            missingFields.forEach(field => {
                newValidationErrors[field] = 'This field is required';
            });
            setValidationErrors(newValidationErrors);
            
            // Focus on the first missing required field
            const firstMissingField = missingFields[0];
            const fieldRefMap = {
                'first_name': firstNameRef,
                'last_name': lastNameRef,
                'phone': phoneRef,
                'email': emailRef,
                'joining_date': joiningDateRef,
                'username': usernameRef,
                'password': passwordRef
            };
            
            const fieldRef = fieldRefMap[firstMissingField];
            if (fieldRef && fieldRef.current) {
                fieldRef.current.focus();
                fieldRef.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Add visual highlight to the focused field
                fieldRef.current.style.animation = 'pulse 2s ease-in-out';
                setTimeout(() => {
                    if (fieldRef.current) {
                        fieldRef.current.style.animation = '';
                    }
                }, 2000);
            }
            
            // Format field names for better display
            const formattedFields = missingFields.map(field => {
                switch(field) {
                    case 'first_name': return 'First Name';
                    case 'last_name': return 'Last Name';
                    case 'phone': return 'Phone Number';
                    case 'email': return 'Email Address';
                    case 'joining_date': return 'Joining Date';
                    case 'username': return 'Username';
                    case 'password': return 'Password';
                    default: return field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            });
            
            // Show specific message for the focused field
            const focusedFieldName = formattedFields[0];
            message.error({
                content: `❌ Please fill in the "${focusedFieldName}" field. ${missingFields.length > 1 ? `${missingFields.length - 1} other field(s) also required.` : ''}`,
                duration: 4
            });
            return;
        }
        
        console.log('✅ VALIDATION PASSED - Required fields check complete');

        // Additional validation for phone number length and password strength
        const additionalValidationErrors = {};
        
        // Phone number validation
        if (formData.phone && formData.phone.length !== 10) {
            additionalValidationErrors.phone = formData.phone.length < 10 
                ? `Mobile number must be 10 digits (${formData.phone.length} digits entered)`
                : 'Mobile number exceeds 10 digits';
        }
        
        // Password validation - only if password field is visible and has value
        if (shouldShowPasswordField && !isEditing && formData.password && formData.password.length < 3) {
            additionalValidationErrors.password = `Password is too short (${formData.password.length} characters). Minimum 3 characters required.`;
        }
        
        if (Object.keys(additionalValidationErrors).length > 0) {
            console.log('❌ Additional validation errors:', additionalValidationErrors);
            setValidationErrors(additionalValidationErrors);
            
            // Focus on the first error field
            const firstErrorField = Object.keys(additionalValidationErrors)[0];
            const fieldRefMap = {
                'phone': phoneRef,
                'password': passwordRef
            };
            
            const fieldRef = fieldRefMap[firstErrorField];
            if (fieldRef && fieldRef.current) {
                fieldRef.current.focus();
            }
            
            message.error('❌ Please fix the validation errors before submitting');
            return;
        }

        // Check for validation errors before proceeding
        if (Object.keys(validationErrors).length > 0) {
            console.log('❌ Validation errors present:', validationErrors);
            console.log('❌ VALIDATION FAILED - Validation errors exist, stopping submission');
            message.error('❌ Please fix the validation errors before submitting');
            return;
        }
        
        console.log('✅ VALIDATION PASSED - No validation errors');

        // Run comprehensive validation for unique fields before final submission
        const isUniqueFieldsValid = await validateUniqueFields();
        if (!isUniqueFieldsValid) {
            console.log('❌ Unique fields validation failed');
            return;
        }

        // Validate email format only if email is provided
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && formData.email.trim() && !emailRegex.test(formData.email)) {
            console.log('❌ Invalid email format:', formData.email);
            console.log('❌ EMAIL VALIDATION FAILED - Invalid format, stopping submission');
            message.error('❌ Please enter a valid email address');
            return;
        }
        
        console.log('✅ EMAIL VALIDATION PASSED');

        // Validate phone format only if phone is provided
        const phoneRegex = /^[0-9]{10}$/;
        if (formData.phone && formData.phone.trim() && !phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
            console.log('❌ Invalid phone format:', formData.phone);
            console.log('❌ PHONE VALIDATION FAILED - Invalid format, stopping submission');
            message.error('❌ Please enter a valid 10-digit phone number');
            return;
        }

        // Validate alternate phone if provided
        if (formData.alternate_phone && formData.alternate_phone.trim()) {
            if (!phoneRegex.test(formData.alternate_phone.replace(/[\s\-\(\)]/g, ''))) {
                console.log('❌ Invalid alternate phone format:', formData.alternate_phone);
                console.log('❌ ALTERNATE PHONE VALIDATION FAILED - Invalid format, stopping submission');
                message.error('❌ Please enter a valid 10-digit alternate phone number');
                return;
            }
            if (formData.phone && formData.phone.trim() && formData.alternate_phone === formData.phone) {
                console.log('❌ Alternate phone same as primary phone');
                console.log('❌ PHONE DUPLICATION VALIDATION FAILED - Same as primary, stopping submission');
                message.error('❌ Alternate phone number cannot be the same as primary phone number');
                return;
            }
        }
        
        console.log('✅ PHONE VALIDATION PASSED');

        // Validate PAN number format if provided
        if (formData.pan_number && formData.pan_number.trim()) {
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(formData.pan_number)) {
                console.log('❌ Invalid PAN format:', formData.pan_number);
                console.log('❌ PAN VALIDATION FAILED - Invalid format, stopping submission');
                message.error('❌ Please enter a valid PAN number (format: AAAAA9999A)');
                return;
            }
        }

        // Validate Aadhar number format if provided
        if (formData.aadhaar_number && formData.aadhaar_number.trim()) {
            const aadhaarRegex = /^[0-9]{12}$/;
            if (!aadhaarRegex.test(formData.aadhaar_number)) {
                console.log('❌ Invalid Aadhar format:', formData.aadhaar_number);
                console.log('❌ AADHAAR VALIDATION FAILED - Invalid format, stopping submission');
                message.error('❌ Please enter a valid 12-digit Aadhar number');
                return;
            }
        }
        
        console.log('✅ PAN & AADHAAR VALIDATION PASSED');

        // Validate password strength if provided
        if (formData.password && formData.password.trim() && formData.password.length < 3) {
            console.log('❌ Password too short:', formData.password.length);
            console.log('❌ PASSWORD VALIDATION FAILED - Too short, stopping submission');
            message.error('❌ Password must be at least 3 characters long');
            return;
        }
        
        console.log('✅ PASSWORD VALIDATION PASSED');

        // Validate unique fields only if they are provided (mobile, alternate mobile, PAN, Aadhar)
        const hasUniqueFields = formData.phone || formData.alternate_phone || formData.pan_number || formData.aadhaar_number;
        if (hasUniqueFields) {
            console.log('🔍 Starting unique field validation...');
            const uniqueFieldsValid = await validateUniqueFields();
            if (!uniqueFieldsValid) {
                console.log('❌ Unique field validation failed');
                console.log('❌ UNIQUE FIELDS VALIDATION FAILED - Stopping submission');
                return;
            }
            console.log('✅ Unique field validation passed');
        } else {
            console.log('✅ No unique fields provided, skipping validation');
        }
        
        console.log('🎉 ALL VALIDATIONS PASSED - Proceeding to API submission');
        console.log('📊 Final form data before API call:', formData);

        try {
            // Strip RM prefix from employee_id for backend storage (only if employee_id exists)
            const employeeIdForBackend = formData.employee_id 
                ? (formData.employee_id.startsWith('RM') 
                    ? formData.employee_id.substring(2) 
                    : formData.employee_id)
                : '';

            // Format data for the API - START WITH MINIMAL REQUIRED FIELDS ONLY
            const submissionData = {
                // Always required fields
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
            };

            // For new employees, add required username and password
            if (!isEditing) {
                // Username is REQUIRED - must be provided
                if (formData.username && formData.username.trim()) {
                    submissionData.username = formData.username.trim();
                } else {
                    // Auto-generate username from first name and last name if empty
                    const autoUsername = `${formData.first_name.toLowerCase()}.${formData.last_name.toLowerCase()}`.replace(/[^a-z.]/g, '');
                    submissionData.username = autoUsername;
                    console.log('🔧 Auto-generated username:', autoUsername);
                }
                
                // Password is REQUIRED - must be provided  
                if (formData.password && formData.password.trim()) {
                    submissionData.password = formData.password.trim();
                } else {
                    // Generate a default password if empty (since it's now required)
                    const defaultPassword = 'Welcome@123';
                    submissionData.password = defaultPassword;
                    console.log('🔧 Auto-generated password for required field');
                }
                
                // Email - now required field, must be included
                if (formData.email && formData.email.trim()) {
                    submissionData.email = formData.email.trim();
                }
                // Email is now required, so it should always be provided
                
                // Joining Date - now required field, must be included
                if (formData.joining_date && formData.joining_date.trim()) {
                    submissionData.joining_date = formData.joining_date;
                }
                // Joining date is now required, so it should always be provided
                
                // Username - now required field, must be included
                submissionData.username = submissionData.username; // Already added above in the employee creation logic
                
                // Password - now required field, must be included  
                submissionData.password = submissionData.password; // Already added above in the employee creation logic
                
                // Basic defaults for new employees
                submissionData.is_active = true;
                submissionData.login_enabled = false;
                submissionData.is_employee = true;
                submissionData.employee_status = 'active';
                submissionData.onboarding_status = 'pending';
                submissionData.crm_access = false;
                submissionData.employment_type = 'full-time';
                
                console.log('✅ Creating minimal new employee with required fields only');
            } else {
                // For editing existing employees, be flexible - only update fields that have values
                console.log('✅ Updating existing employee - only sending fields with values');
                if (formData.username && formData.username.trim()) {
                    submissionData.username = formData.username.trim();
                }
            }

            console.log('📤 MINIMAL Submitting employee data:', submissionData);
            console.log('📤 MINIMAL Submission data keys:', Object.keys(submissionData));
            console.log('📤 MINIMAL Full submission data JSON:', JSON.stringify(submissionData, null, 2));

            console.log('📤 MINIMAL Submitting employee data:', submissionData);
            console.log('📤 MINIMAL Submission data keys:', Object.keys(submissionData));
            console.log('📤 MINIMAL Full submission data JSON:', JSON.stringify(submissionData, null, 2));

            // Debug: Log the exact API call that will be made
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
            
            console.log('🔍 Checking localStorage for user data:');
            console.log('🔍 currentUser:', currentUser);
            console.log('🔍 userData:', userData);
            console.log('🔍 userInfo:', userInfo);
            console.log('🔍 authUser:', authUser);
            console.log('🔍 localStorage keys:', Object.keys(localStorage));
            
            // Try to get user ID from multiple possible sources
            let userId = currentUser.id || currentUser._id || 
                        userData.id || userData._id || 
                        userInfo.id || userInfo._id ||
                        authUser.id || authUser._id;
                        
            console.log('🔍 Resolved userId:', userId);
            
            const apiUrl = `${window.location.origin}/api/users/employees?user_id=${userId || 'unknown'}`;
            console.log('🌐 API URL:', apiUrl);
            console.log('🔑 User ID:', userId);
            console.log('📤 Request Headers:', {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            });

            // Final validation before API call - different for new vs editing
            if (!submissionData.first_name || !submissionData.first_name.trim()) {
                console.error('❌ Missing first_name:', submissionData.first_name);
                message.error('❌ First name is required');
                return;
            }
            if (!submissionData.last_name || !submissionData.last_name.trim()) {
                console.error('❌ Missing last_name:', submissionData.last_name);
                message.error('❌ Last name is required');
                return;
            }
            
            // Username is only required for new employees
            if (!isEditing && (!submissionData.username || !submissionData.username.trim())) {
                console.error('❌ Missing username for new employee:', submissionData.username);
                message.error('❌ Username is required for new employees');
                return;
            }
            
            if (!userId) {
                console.error('❌ Missing current user ID from all sources');
                console.error('❌ Available localStorage keys:', Object.keys(localStorage));
                console.error('❌ Token exists:', !!localStorage.getItem('token'));
                message.error('❌ User session invalid. Please login again.');
                return;
            }
            
            console.log('✅ Final validation passed, proceeding with API call...');
            console.log(`✅ Validation mode: ${isEditing ? 'EDITING (flexible)' : 'NEW EMPLOYEE (strict)'}`);
            
            // Add other fields only if they have actual values (not empty strings)
            if (formData.phone && formData.phone.trim()) submissionData.phone = formData.phone.trim();
            if (formData.alternate_phone && formData.alternate_phone.trim()) submissionData.alternate_phone = formData.alternate_phone.trim();
            if (formData.email && formData.email.trim()) submissionData.email = formData.email.trim();
            if (formData.work_email && formData.work_email.trim()) submissionData.work_email = formData.work_email.trim();
            if (formData.dob && formData.dob.trim()) submissionData.dob = formData.dob;
            if (formData.pan_number && formData.pan_number.trim()) submissionData.pan_number = formData.pan_number.toUpperCase();
            if (formData.aadhaar_number && formData.aadhaar_number.trim()) submissionData.aadhaar_number = formData.aadhaar_number;
            if (formData.highest_qualification && formData.highest_qualification.trim()) submissionData.highest_qualification = formData.highest_qualification;
            if (formData.experience_level && formData.experience_level.trim()) submissionData.experience_level = formData.experience_level;
            if (formData.gender && formData.gender.trim()) submissionData.gender = formData.gender;
            if (formData.marital_status && formData.marital_status.trim()) submissionData.marital_status = formData.marital_status;
            if (formData.nationality && formData.nationality.trim()) submissionData.nationality = formData.nationality;
            if (formData.blood_group && formData.blood_group.trim()) submissionData.blood_group = formData.blood_group;
            if (formData.current_city && formData.current_city.trim()) submissionData.current_city = formData.current_city;

            console.log('✅ All fields included in submission data');

            // Address Information - only include if any address field has value
            if (formData.current_address || formData.current_city || formData.current_state || formData.current_pincode) {
                submissionData.current_address = {
                    address: formData.current_address || '',
                    city: formData.current_city || '',
                    state: formData.current_state || '',
                    pincode: formData.current_pincode || '',
                    country: 'India',
                    address_type: 'current'
                };
            }

            // Emergency Contacts - only include if provided
            const emergencyContacts = [];
            if (formData.emergency_contact_1_name && formData.emergency_contact_1_phone) {
                emergencyContacts.push({
                    name: formData.emergency_contact_1_name,
                    phone: formData.emergency_contact_1_phone,
                    relationship: formData.emergency_contact_1_relation || ''
                });
            }
            if (formData.emergency_contact_2_name && formData.emergency_contact_2_phone) {
                emergencyContacts.push({
                    name: formData.emergency_contact_2_name,
                    phone: formData.emergency_contact_2_phone,
                    relationship: formData.emergency_contact_2_relation || ''
                });
            }
            if (emergencyContacts.length > 0) {
                submissionData.emergency_contacts = emergencyContacts;
                // Legacy fields for backward compatibility
                submissionData.emergency_contact_name = formData.emergency_contact_1_name;
                submissionData.emergency_contact_phone = formData.emergency_contact_1_phone;
                submissionData.emergency_contact_relation = formData.emergency_contact_1_relation;
                submissionData.emergency_contact_relationship = formData.emergency_contact_1_relation;
            }

            // Employment Details - only if provided and not empty
            if (formData.joining_date && formData.joining_date.trim()) submissionData.joining_date = formData.joining_date;
            if (formData.designation && formData.designation.trim()) submissionData.designation = formData.designation;
            if (formData.department_id && formData.department_id.trim()) submissionData.department_id = formData.department_id;
            // Only include role_id if user has role permission
            if (formData.role_id && formData.role_id.trim() && hasRolePermission()) submissionData.role_id = formData.role_id;
            if (formData.monthly_salary && String(formData.monthly_salary).trim()) submissionData.salary = parseFloat(formData.monthly_salary);
            if (formData.monthly_target && String(formData.monthly_target).trim()) submissionData.monthly_target = parseFloat(formData.monthly_target);
            if (formData.incentive && formData.incentive.trim()) submissionData.incentive = formData.incentive;

            // Banking Details - only if provided and not empty
            if (formData.salary_account_number && formData.salary_account_number.trim()) submissionData.salary_account_number = formData.salary_account_number;
            if (formData.salary_ifsc_code && formData.salary_ifsc_code.trim()) submissionData.salary_ifsc_code = formData.salary_ifsc_code;
            if (formData.salary_bank_name && formData.salary_bank_name.trim()) submissionData.salary_bank_name = formData.salary_bank_name;

            // Profile photo - only if provided
            if (formData.profile_photo) submissionData.profile_photo = formData.profile_photo;

            // Password is already handled in the new employee section above
            // For editing, add password only if provided
            if (isEditing && formData.password && formData.password.trim()) {
                submissionData.password = formData.password;
            }
            
            console.log('📤 Submitting employee data:', submissionData);
            console.log('📋 Submission data keys:', Object.keys(submissionData));
            console.log('� Role permission check:', {
                hasRolePermission: hasRolePermission(),
                roleIdInForm: formData.role_id,
                roleIdInSubmission: submissionData.role_id,
                includeRoleInSubmission: !!(formData.role_id && formData.role_id.trim() && hasRolePermission())
            });
            console.log('�📤 Full submission data JSON:', JSON.stringify(submissionData, null, 2));
            console.log('🔄 EmployeeFormNew: About to call onFinish...');
            console.log('🔍 Form state:', { isEditing, employee, formData });
            console.log('🔍 onFinish function type:', typeof onFinish);
            console.log('🔍 imageFile:', imageFile);

            try {
                console.log('🔄 Calling onFinish...');
                const result = await onFinish(submissionData, imageFile);
                console.log('✅ EmployeeFormNew: onFinish completed successfully, result:', result);
                
                // For editing, ensure we have the updated data before showing success modal
                if (isEditing) {
                    console.log('✅ EmployeeFormNew: Edit completed, preparing success modal');
                    // Wait a bit for state updates to complete
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
                
            } catch (onFinishError) {
                console.error('❌ Error in onFinish call:', onFinishError);
                throw onFinishError; // Re-throw to be caught by outer try-catch
            }
            
            // Show success modal for both new and editing cases (only if not disabled)
            if (!disableSuccessModal) {
                const passwordToShow = !isEditing && shouldShowPasswordField ? formData.password : null;
                
                console.log('🎉 Setting success modal data:', {
                    isEditing,
                    firstName: submissionData.first_name,
                    lastName: submissionData.last_name,
                    employeeId: submissionData.employee_id,
                    hasImage: !!imageFile,
                    passwordToShow
                });
                
                // Set success data and show modal - FOR BOTH NEW AND EDITING
                setSuccessData({
                    isEditing,
                    firstName: submissionData.first_name,
                    lastName: submissionData.last_name,
                    employeeId: submissionData.employee_id,
                    hasImage: !!imageFile
                });
                setCreatedPassword(passwordToShow);
                
                // Clear validation errors on success
                setValidationErrors({});
                
                console.log('🔄 About to show success modal...');
                console.log('🔄 Current showSuccessModal state before:', showSuccessModal);
                
                setShowSuccessModal(true);
                
                console.log('✅ Success modal should now be visible');
                console.log(`✅ Success modal set for: ${isEditing ? 'EDITING' : 'NEW EMPLOYEE'}`);
                console.log('✅ Form submission completed successfully');
                console.log('✅ Validation errors cleared');
                
                // Force a state check after a short delay
                setTimeout(() => {
                    console.log('🔍 Success modal state check:', showSuccessModal);
                    console.log('🔍 Success data state:', successData);
                    
                    // Alert removed - using custom popup in EmployeeDetails instead
                    // if (isEditing) {
                    //     alert(`Employee Updated Successfully!\n\nEmployee: ${submissionData.first_name} ${submissionData.last_name}\nEmployee ID: ${submissionData.employee_id ? `RM${submissionData.employee_id}` : 'Will be assigned'}`);
                    // }
                }, 100);
            } else {
                console.log('✅ Success modal disabled - parent component will handle success notification');
                // Clear validation errors on success even when modal is disabled
                setValidationErrors({});
            }
            
        } catch (error) {
            console.error('❌ EmployeeFormNew: Form submission error:', error);
            
            // Enhanced error handling with specific messages
            let errorMessage = 'Failed to submit form';
            
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                const status = error.response.status;
                
                console.log('🔍 Error response:', { status, errorData });
                
                // Handle specific error codes and messages
                if (status === 400) {
                    // Bad Request - usually validation errors
                    if (errorData.detail) {
                        if (errorData.detail.includes('username') && errorData.detail.includes('already exists')) {
                            errorMessage = '❌ Username already exists. Please choose a different username.';
                        } else if (errorData.detail.includes('email') && errorData.detail.includes('already exists')) {
                            errorMessage = '❌ Email address already exists. Please use a different email.';
                        } else if (errorData.detail.includes('employee_id') && errorData.detail.includes('already exists')) {
                            errorMessage = '❌ Employee ID already exists. Please use a different ID.';
                        } else {
                            errorMessage = `❌ Validation Error: ${errorData.detail}`;
                        }
                    } else {
                        errorMessage = '❌ Invalid data provided. Please check all fields.';
                    }
                } else if (status === 404) {
                    // Not Found
                    errorMessage = isEditing 
                        ? '❌ Employee not found. The employee may have been deleted.'
                        : '❌ Required resource not found. Please try again.';
                } else if (status === 409) {
                    // Conflict - duplicate data
                    errorMessage = '❌ Duplicate data found. Please check email, username, or employee ID.';
                } else if (status === 422) {
                    // Unprocessable Entity - validation errors
                    console.log('🔍 422 Error Details:', errorData);
                    if (errorData.detail && Array.isArray(errorData.detail)) {
                        console.log('🔍 Validation Errors Array:', errorData.detail);
                        const fieldErrors = errorData.detail.map(err => {
                            const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
                            const msg = err.msg || 'Invalid value';
                            console.log(`🔍 Field error: ${field} - ${msg}`);
                            return `${field}: ${msg}`;
                        }).join(', ');
                        errorMessage = `❌ Validation Error: ${fieldErrors}`;
                    } else if (errorData.detail) {
                        console.log('🔍 Single validation error:', errorData.detail);
                        errorMessage = `❌ Validation Error: ${errorData.detail}`;
                    } else {
                        console.log('🔍 422 error with no detail field');
                        errorMessage = '❌ Data validation failed. Please check all fields.';
                    }
                } else if (status === 403) {
                    // Forbidden
                    errorMessage = '❌ Access denied. You do not have permission to perform this action.';
                } else if (status === 500) {
                    // Internal Server Error
                    errorMessage = '❌ Server error occurred. Please try again later.';
                } else {
                    // Generic error message for other status codes
                    errorMessage = errorData.detail || errorData.message || `❌ Error ${status}: ${errorMessage}`;
                }
            } else if (error.message) {
                // Network or other errors
                if (error.message.includes('Network')) {
                    errorMessage = '❌ Network error. Please check your connection and try again.';
                } else if (error.message.includes('timeout')) {
                    errorMessage = '❌ Request timeout. Please try again.';
                } else {
                    errorMessage = `❌ Error: ${error.message}`;
                }
            } else {
                // Fallback error message
                errorMessage = isEditing 
                    ? '❌ Failed to update employee. Please try again.'
                    : '❌ Failed to create employee. Please try again.';
            }
            
            message.error(errorMessage);
        } finally {
            // Loading state is managed by parent component
            console.log('✅ Form submission attempt completed');
        }
    };

    return (
        <>
            <style>
                {`
                    @keyframes pulse {
                        0% {
                            transform: scale(1);
                            box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.7);
                            border-color: #ff4d4f;
                        }
                        50% {
                            transform: scale(1.02);
                            box-shadow: 0 0 0 10px rgba(255, 77, 79, 0.2);
                            border-color: #ff4d4f;
                        }
                        100% {
                            transform: scale(1);
                            box-shadow: 0 0 0 0 rgba(255, 77, 79, 0);
                            border-color: #ff4d4f;
                        }
                    }
                    
                    .employee-form-container .required-field-error {
                        border-color: #ff4d4f !important;
                        background-color: #fff2f0 !important;
                    }
                    
                    .employee-form-container .required-field-label {
                        color: #ff4d4f !important;
                        font-weight: bold !important;
                    }
                    
                    .employee-form-container .error-message {
                        color: #ff4d4f;
                        font-size: 12px;
                        margin-top: 2px;
                    }
                `}
            </style>
            <div className="employee-form-container">
            <div className="form-card">
                <form key={`form-${employee?._id}-${employee?._refreshKey}-${forceRender}`} onSubmit={handleSubmit}>
                    {/* Debug Info - only show in console */}
                    <div style={{display: 'none'}}>
                        {console.log('🎯 FORM RENDER - Current formData:', formData)}
                        {console.log('🎯 FORM RENDER - Employee data:', employee)}
                        {console.log('🎯 FORM RENDER - Force render key:', forceRender)}
                    </div>
                    {/* Profile Photo */}
                    <div className="section">
                        <div className="form-row">
                            <div>
                                <label>Profile Photo</label>
                                <div className="photo-upload">
                                    <div className="photo-circle">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt="Profile" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                                        ) : (
                                            <span>👤</span>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        accept="image/png, image/jpeg"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>

                    {/* Employee Information */}
                    <div className="section">
                        <div className="section-title">
                            <span>👤</span>Employee Information
                        </div>
                        
                        <div className="form-row">
                            <div>
                                <label>Employee ID</label>
                                <input 
                                    type="text" 
                                    name="employee_id"
                                    value={formData.employee_id}
                                    readOnly
                                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed', color: '#666' }}
                                />
                            </div>
                            <div>
                                <label className={validationErrors.first_name ? 'required-field-label' : ''}>First Name *</label>
                                <input      
                                    ref={firstNameRef}
                                    type="text" 
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                    placeholder="First Name" 
                                    required
                                    className={`form-input ${validationErrors.first_name ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.first_name && (
                                    <div className="error-message">
                                        {validationErrors.first_name}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={validationErrors.last_name ? 'required-field-label' : ''}>Last Name *</label>
                                <input 
                                    ref={lastNameRef}
                                    type="text" 
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                    placeholder="Last Name" 
                                    required
                                    className={`form-input ${validationErrors.last_name ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.last_name && (
                                    <div className="error-message">
                                        {validationErrors.last_name}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label className={validationErrors.phone ? 'required-field-label' : ''}>Mobile Number *</label>
                                <input 
                                    ref={phoneRef}
                                    type="tel" 
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="10-digit mobile number" 
                                    pattern="[0-9]{10}"
                                    maxLength="10"
                                    required
                                    style={{
                                        borderColor: validationErrors.phone ? '#ff4d4f' : '',
                                        backgroundColor: validationErrors.phone ? '#fff2f0' : ''
                                    }}
                                    className={`form-input ${validationErrors.phone ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.phone && (
                                    <div className="error-message">
                                        {validationErrors.phone}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={validationErrors.alternate_phone ? 'required-field-label' : ''}>Alternate Number</label>
                                <input 
                                    type="tel" 
                                    name="alternate_phone"
                                    value={formData.alternate_phone}
                                    onChange={handleInputChange}
                                    placeholder="10-digit alternate number"
                                    pattern="[0-9]{10}"
                                    maxLength="10"
                                    className={`form-input ${validationErrors.alternate_phone ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.alternate_phone && (
                                    <div className="error-message">
                                        {validationErrors.alternate_phone}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={validationErrors.email ? 'required-field-label' : ''}>Personal Email</label>
                                <input 
                                    ref={emailRef}
                                    type="email" 
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Personal Email"
                                    className={`form-input ${validationErrors.email ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.email && (
                                    <div className="error-message">
                                        {validationErrors.email}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Work Email</label>
                                <input 
                                    type="email" 
                                    name="work_email"
                                    value={formData.work_email}
                                    onChange={handleInputChange}
                                    placeholder="Work Email"
                                />
                            </div>
                            <div>
                                <label>Employee DOB</label>
                                <input 
                                    type="date" 
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className={validationErrors.pan_number ? 'required-field-label' : ''}>PAN Number</label>
                                <input 
                                    type="text" 
                                    name="pan_number"
                                    value={formData.pan_number}
                                    onChange={handleInputChange}
                                    placeholder="AAAAA9999A (e.g., ABCDE1234F)"
                                    pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                                    maxLength="10"
                                    style={{ textTransform: 'uppercase' }}
                                    className={`form-input ${validationErrors.pan_number ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.pan_number && (
                                    <div className="error-message">
                                        {validationErrors.pan_number}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label className={validationErrors.aadhaar_number ? 'required-field-label' : ''}>Aadhaar Number</label>
                                <input 
                                    type="text" 
                                    name="aadhaar_number"
                                    value={formData.aadhaar_number}
                                    onChange={handleInputChange}
                                    placeholder="12-digit Aadhar number"
                                    pattern="[0-9]{12}"
                                    maxLength="12"
                                    className={`form-input ${validationErrors.aadhaar_number ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.aadhaar_number && (
                                    <div className="error-message">
                                        {validationErrors.aadhaar_number}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Current City (Living In)</label>
                                <input 
                                    type="text" 
                                    name="current_city"
                                    value={formData.current_city}
                                    onChange={handleInputChange}
                                    placeholder="Current City"
                                />
                            </div>
                            <div>
                                <label>Highest Qualification</label>
                                <select 
                                    name="highest_qualification"
                                    value={formData.highest_qualification}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Qualification</option>
                                    <option value="10th">10th</option>
                                    <option value="12th">12th</option>
                                    <option value="Diploma">Diploma</option>
                                    <option value="Bachelor's">Bachelor's</option>
                                    <option value="Master's">Master's</option>
                                    <option value="PhD">PhD</option>
                                </select>
                            </div>
                            <div>
                                <label>Experience</label>
                                <select 
                                    name="experience_level"
                                    value={formData.experience_level}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Experience</option>
                                    <option value="Fresher">Fresher</option>
                                    <option value="Experienced">Experienced</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Gender</label>
                                <select 
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label>Marital Status</label>
                                <select 
                                    name="marital_status"
                                    value={formData.marital_status}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Status</option>
                                    <option value="single">Single</option>
                                    <option value="married">Married</option>
                                    <option value="divorced">Divorced</option>
                                    <option value="widowed">Widowed</option>
                                </select>
                            </div>
                            <div>
                                <label>Nationality</label>
                                <input 
                                    type="text" 
                                    name="nationality"
                                    value={formData.nationality}
                                    onChange={handleInputChange}
                                    placeholder="Nationality"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                           
                            <div></div>
                            <div></div>
                        </div>

                        <div className="form-row full">
                            <div>
                                <label>Current Address</label>
                                <textarea 
                                    rows="4" 
                                    name="current_address"
                                    value={formData.current_address}
                                    onChange={handleInputChange}
                                    placeholder="Current Address"
                                />
                            </div>
                        </div>

                        {/* Emergency Contacts */}
                        <div className="form-row">
                            <div>
                                <label>1st Emergency Contact Name</label>
                                <input 
                                    type="text" 
                                    name="emergency_contact_1_name"
                                    value={formData.emergency_contact_1_name}
                                    onChange={handleInputChange}
                                    placeholder="Contact Name"
                                />
                            </div>
                            <div>
                                <label>Contact Mobile Number</label>
                                <input 
                                    type="tel" 
                                    name="emergency_contact_1_phone"
                                    value={formData.emergency_contact_1_phone}
                                    onChange={handleInputChange}
                                    placeholder="Contact Mobile"
                                />
                            </div>
                            <div>
                                <label>Contact Relation</label>
                                <select 
                                    name="emergency_contact_1_relation"
                                    value={formData.emergency_contact_1_relation}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Relation</option>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Brother">Brother</option>
                                    <option value="Sister">Sister</option>
                                    <option value="Friend">Friend</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label>2nd Emergency Contact Name</label>
                                <input 
                                    type="text" 
                                    name="emergency_contact_2_name"
                                    value={formData.emergency_contact_2_name}
                                    onChange={handleInputChange}
                                    placeholder="Contact Name"
                                />
                            </div>
                            <div>
                                <label>Contact Mobile Number</label>
                                <input 
                                    type="tel" 
                                    name="emergency_contact_2_phone"
                                    value={formData.emergency_contact_2_phone}
                                    onChange={handleInputChange}
                                    placeholder="Contact Mobile"
                                />
                            </div>
                            <div>
                                <label>Contact Relation</label>
                                <select 
                                    name="emergency_contact_2_relation"
                                    value={formData.emergency_contact_2_relation}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Relation</option>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Brother">Brother</option>
                                    <option value="Sister">Sister</option>
                                    <option value="Friend">Friend</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Employment Details */}
                    <div className="section">
                        <div className="section-title">
                            <span>💼</span>Employment Details
                        </div>
                        
                        <div className="form-row">
                            <div>
                                <label className={validationErrors.joining_date ? 'required-field-label' : ''}>Date of Joining *</label>
                                <input 
                                    ref={joiningDateRef}
                                    type="date" 
                                    name="joining_date"
                                    value={formData.joining_date}
                                    onChange={handleInputChange}
                                    required
                                    className={`form-input ${validationErrors.joining_date ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.joining_date && (
                                    <div className="error-message">
                                        {validationErrors.joining_date}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label>Monthly Salary</label>
                                <input 
                                    type="number" 
                                    name="monthly_salary"
                                    value={formData.monthly_salary}
                                    onChange={handleInputChange}
                                    placeholder="₹ Monthly Salary"
                                />
                            </div>
                            <div>
                                <label>Monthly Target</label>
                                <input 
                                    type="number" 
                                    name="monthly_target"
                                    value={formData.monthly_target}
                                    onChange={handleInputChange}
                                    placeholder="₹ Monthly Target"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Incentive</label>
                                <input 
                                    type="text" 
                                    name="incentive"
                                    value={formData.incentive}
                                    onChange={handleInputChange}
                                    placeholder="Incentive"
                                />
                            </div>
                            <div>
                                <label>Department</label>
                                <select 
                                    name="department_id"
                                    value={formData.department_id}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Department</option>
                                    {departments.map(dept => (
                                        <option key={dept._id || dept.id} value={dept._id || dept.id}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Role field - only show if user has role permission */}
                            {shouldShowRoleField && (
                                <div>
                                    <label>Role</label>
                                    <select 
                                        name="role_id"
                                        value={formData.role_id}
                                        onChange={handleInputChange}
                                    >
                                        <option value="" disabled>Select Role</option>
                                        {roles.map(role => (
                                            <option key={role._id || role.id} value={role._id || role.id}>
                                                {role.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {/* Show message if role field is hidden due to permissions */}
                            {!shouldShowRoleField && (
                                <div>
                                    <label>Role</label>
                                    <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#f5f5f5',
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '4px',
                                        color: '#666',
                                        fontStyle: 'italic',
                                        fontSize: '14px'
                                    }}>
                                        For Role Update, Contact your senior.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Designation</label>
                                <select 
                                    name="designation"
                                    value={formData.designation}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled>Select Designation</option>
                                    {designations.map(designation => (
                                        <option key={designation.id} value={designation.name}>
                                            {designation.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>Salary Account Number</label>
                                <input 
                                    type="text" 
                                    name="salary_account_number"
                                    value={formData.salary_account_number}
                                    onChange={handleInputChange}
                                    placeholder="Salary Account Number"
                                />
                            </div>
                            <div>
                                <label>Salary IFSC Code</label>
                                <input 
                                    type="text" 
                                    name="salary_ifsc_code"
                                    value={formData.salary_ifsc_code}
                                    onChange={handleInputChange}
                                    placeholder="Salary IFSC Code"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Salary Bank Name</label>
                                <input 
                                    type="text" 
                                    name="salary_bank_name"
                                    value={formData.salary_bank_name}
                                    onChange={handleInputChange}
                                    placeholder="Salary Bank Name"
                                />
                            </div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>

                    {/* Login Credentials */}
                    <div className="section">
                        <div className="section-title">
                            <span>🔒</span>Login Credentials
                        </div>
                        
                        <div className="form-row">
                            <div>
                                <label className={validationErrors.username ? 'required-field-label' : ''}>Username *</label>
                                <input 
                                    ref={usernameRef}
                                    type="text" 
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    placeholder="Username" 
                                    required
                                    className={`form-input ${validationErrors.username ? 'required-field-error' : ''}`}
                                />
                                {validationErrors.username && (
                                    <div className="error-message">
                                        {validationErrors.username}
                                    </div>
                                )}
                            </div>
                            {/* Password field for creating new employees (users with password permission or superadmin) */}
                            {shouldShowPasswordField && !isEditing && (
                                <div>
                                    <label className={validationErrors.password ? 'required-field-label' : ''}>Password *</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            ref={passwordRef}
                                            type={showPassword ? "text" : "password"} 
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            placeholder="Password" 
                                            required
                                            minLength="3"
                                            style={{ paddingRight: '40px' }}
                                            className={`form-input ${validationErrors.password ? 'required-field-error' : ''}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: '10px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                color: '#666'
                                            }}
                                            title={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    {validationErrors.password && (
                                        <div className="error-message">
                                            {validationErrors.password}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Password field for editing employees (users with password permission or superadmin) */}
                            {(() => {
                                console.log('🔍 Password field rendering check:', {
                                    shouldShowPasswordFieldForEditing,
                                    isEditing,
                                    isUserSuperAdmin,
                                    currentPassword,
                                    formDataPassword: formData.password
                                });
                                return shouldShowPasswordFieldForEditing;
                            })() && (
                                <div>
                                    <label>
                                        Current Password {
                                            currentPassword 
                                                ? currentPassword.startsWith('[') 
                                                    ? `(${currentPassword})` 
                                                    : '(Loaded - Decrypted)'
                                                : '(Loading...)'
                                        }
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            placeholder={
                                                currentPassword 
                                                    ? currentPassword.startsWith('[')
                                                        ? "Enter new password "
                                                        : "Current password shown - modify to change"
                                                    : "Loading current password..."
                                            }
                                            minLength="3"
                                            style={{ paddingRight: '40px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: '10px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                color: '#666'
                                            }}
                                            title={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>

                                </div>
                            )}
                            <div></div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="button-group">
                        {onCancel && (
                            <button type="button" className="cancel" onClick={onCancel}>
                                Cancel
                            </button>
                        )}
                        <button 
                            type="button" 
                            className="submit" 
                            disabled={loading}
                            onClick={async (e) => {
                                console.log('�🚨🚨 BUTTON CLICKED - UPDATE EMPLOYEE 🚨🚨🚨');

                                console.log('🔘 Current loading state:', loading);
                                console.log('🔘 Is editing mode:', isEditing);
                                
                                if (loading) {
                                    console.log('⚠️ Button click ignored - loading in progress');

                                    return;
                                }
                                
                                e.preventDefault();
                                e.stopPropagation();
                                
                                try {
                                    console.log('🔘 About to call handleSubmit...');
                                    await handleSubmit(e);
                                    console.log('🔘 handleSubmit completed successfully');
                                } catch (error) {
                                    console.error('🔘 ERROR in button onClick:', error);
                                    message.error(`Update failed: ${error.message}`);
                                }
                            }}
                        >
                            {loading ? 'Saving...' : (isEditing ? 'Update Employee' : 'Create Employee')}
                        </button>
                    </div>
                </form>
            </div>
            
            {/* Success Modal */}
            <Modal
                title={successData?.isEditing ? 'Employee Updated Successfully' : 'Employee Created Successfully'}
                open={showSuccessModal}
                onOk={() => {
                    setShowSuccessModal(false);
                    setSuccessData(null);
                    setCreatedPassword(null);
                }}
                onCancel={() => {
                    setShowSuccessModal(false);
                    setSuccessData(null);
                    setCreatedPassword(null);
                }}
                centered
                okText="OK"
                cancelButtonProps={{ style: { display: 'none' } }}
            >
                {successData && (
                    <div>
                        <p>The employee data has been {successData.isEditing ? 'updated' : 'created'} successfully.</p>
                        <p><strong>Employee:</strong> {successData.firstName} {successData.lastName}</p>
                        <p><strong>Employee ID:</strong> {successData.employeeId ? `RM${successData.employeeId}` : 'Will be assigned'}</p>
                        {successData.hasImage && <p><strong>Profile picture:</strong> {successData.isEditing ? 'Updated' : 'Uploaded'}</p>}
                        {createdPassword && (
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
                                    <strong>Password:</strong> <span style={{ backgroundColor: '#fff', padding: '2px 4px', border: '1px solid #d9d9d9' }}>{createdPassword}</span>
                                </p>
                                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                                    ⚠️ Please save this password securely. It will not be shown again.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            </div>
        </>
    );
};

export default EmployeeForm;
