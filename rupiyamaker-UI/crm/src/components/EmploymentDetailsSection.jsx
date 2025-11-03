// Employment Details Section Component
const EmploymentDetailsSection = ({ employee, onUpdate }) => {
    const [fields, setFields] = useState({
        employee_id: employee.employee_id || '',
        joining_date: employee.joining_date || '',
        department_id: employee.department_id || '',
        department_name: employee.department_name || '',
        role_id: employee.role_id || '',
        role_name: employee.role_name || '',
        employee_status: employee.employee_status || '',
        salary: employee.salary || '',
        work_location: employee.work_location || '',
        mac_addresses: employee.mac_addresses || employee.mac_address ? 
            (Array.isArray(employee.mac_addresses) ? employee.mac_addresses : [employee.mac_address]) : []
    });

    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [newMacAddress, setNewMacAddress] = useState('');
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(false);

    // Fetch roles and departments on component mount
    useEffect(() => {
        const fetchRolesAndDepartments = async () => {
            try {
                console.log('🚀 Starting to fetch roles and departments...');
                setLoadingRoles(true);
                setLoadingDepartments(true);
                
                const [rolesResult, departmentsResult] = await Promise.all([
                    hrmsService.getRoles(),
                    hrmsService.getDepartments()
                ]);
                
                console.log('📊 Raw roles result:', rolesResult);
                console.log('📊 Raw departments result:', departmentsResult);
                
                // Extract roles from nested response structure
                let rolesData = [];
                if (rolesResult && rolesResult.data) {
                    if (Array.isArray(rolesResult.data)) {
                        rolesData = rolesResult.data;
                    } else if (rolesResult.data.roles && Array.isArray(rolesResult.data.roles)) {
                        rolesData = rolesResult.data.roles;
                    }
                } else if (Array.isArray(rolesResult)) {
                    rolesData = rolesResult;
                }
                
                // Extract departments from nested response structure  
                let departmentsData = [];
                if (departmentsResult && departmentsResult.data) {
                    if (Array.isArray(departmentsResult.data)) {
                        departmentsData = departmentsResult.data;
                    } else if (departmentsResult.data.departments && Array.isArray(departmentsResult.data.departments)) {
                        departmentsData = departmentsResult.data.departments;
                    }
                } else if (Array.isArray(departmentsResult)) {
                    departmentsData = departmentsResult;
                }
                
                console.log('🔍 Processed roles data:', rolesData);
                console.log('🔍 Processed departments data:', departmentsData);
                
                setRoles(rolesData);
                setDepartments(departmentsData);
                
                if (departmentsData.length === 0) {
                    console.warn('⚠️ No departments loaded - this may indicate an API issue');
                }
                
                if (rolesData.length > 0 || departmentsData.length > 0) {
                    console.log(`✅ Successfully loaded ${rolesData.length} roles and ${departmentsData.length} departments`);
                }
                
            } catch (error) {
                console.error('❌ Error fetching roles and departments:', error);
                message.error('Failed to load roles and departments. Please refresh the page or contact support.');
                // Set empty arrays on error to prevent map errors
                setRoles([]);
                setDepartments([]);
            } finally {
                setLoadingRoles(false);
                setLoadingDepartments(false);
                console.log('🏁 Finished loading roles and departments');
            }
        };

        fetchRolesAndDepartments();
    }, []);

    // Update local state if the employee prop changes from parent
    useEffect(() => {
        console.log('🔄 EmploymentDetails: Employee prop changed, checking for updates');
        const newFields = {
            employee_id: employee.employee_id || '',
            joining_date: employee.joining_date || '',
            department_id: employee.department_id || '',
            department_name: employee.department_name || '',
            role_id: employee.role_id || '',
            role_name: employee.role_name || '',
            employee_status: employee.employee_status || '',
            salary: employee.salary || '',
            work_location: employee.work_location || '',
            mac_addresses: employee.mac_addresses || employee.mac_address ? 
                (Array.isArray(employee.mac_addresses) ? employee.mac_addresses : [employee.mac_address]) : []
        };
        
        let hasChanges = false;
        for (const key in newFields) {
            if (JSON.stringify(newFields[key]) !== JSON.stringify(fields[key])) {
                hasChanges = true;
                break;
            }
        }
        
        if (hasChanges) {
            console.log('🔄 EmploymentDetails: Updates detected, syncing local state with props');
            setFields(newFields);
        }
    }, [employee, fields]);

    // Handle field changes
    const handleChange = (field, value) => {
        console.log(`🔤 EmploymentDetails: field ${field} changed to: ${value}`);
        setFields(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleRoleChange = async (roleId) => {
        console.log('👑 Role change initiated:', roleId);
        
        const selectedRole = Array.isArray(roles) ? roles.find(role => (role._id || role.id) === roleId) : null;
        const roleName = selectedRole ? (selectedRole.name || selectedRole.role_name || '') : '';
        
        console.log('👑 Selected role:', selectedRole);
        console.log('👑 Role name:', roleName);
        
        setFields(prev => ({
            ...prev,
            role_id: roleId,
            role_name: roleName
        }));

        try {
            console.log('👑 Updating role in backend...');
            await onUpdate({ 
                role_id: roleId,
                role_name: roleName
            });
            console.log('✅ Role updated successfully');
            message.success('Role updated successfully');
        } catch (error) {
            console.error('❌ Error updating role:', error);
            message.error('Failed to update role');
            setFields(prev => ({
                ...prev,
                role_id: employee.role_id || '',
                role_name: employee.role_name || ''
            }));
        }
    };

    const handleDepartmentChange = async (departmentId) => {
        console.log('🏢 Department change initiated:', departmentId);
        
        const selectedDepartment = Array.isArray(departments) ? departments.find(dept => (dept._id || dept.id) === departmentId) : null;
        const departmentName = selectedDepartment ? (selectedDepartment.name || selectedDepartment.department_name || '') : '';
        
        console.log('🏢 Selected department:', selectedDepartment);
        console.log('🏢 Department name:', departmentName);
        
        setFields(prev => ({
            ...prev,
            department_id: departmentId,
            department_name: departmentName
        }));

        try {
            console.log('🏢 Updating department in backend...');
            await onUpdate({ 
                department_id: departmentId,
                department_name: departmentName
            });
            console.log('✅ Department updated successfully');
            message.success('Department updated successfully');
        } catch (error) {
            console.error('❌ Error updating department:', error);
            message.error('Failed to update department');
            setFields(prev => ({
                ...prev,
                department_id: employee.department_id || '',
                department_name: employee.department_name || ''
            }));
        }
    };
    
    const handleAddMacAddress = async () => {
        if (!newMacAddress) {
            message.error('Please enter a MAC address');
            return;
        }
        
        // Validate MAC address format
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(newMacAddress)) {
            message.error('Invalid MAC address format. Please use XX:XX:XX:XX:XX:XX');
            return;
        }
        
        try {
            // Check if MAC address already exists
            if (fields.mac_addresses.includes(newMacAddress)) {
                message.warning('This MAC address already exists');
                return;
            }
            
            // Create a new array with the new MAC address
            const updatedMacAddresses = [...fields.mac_addresses, newMacAddress];
            
            // Update in backend
            await onUpdate({ mac_addresses: updatedMacAddresses });
            
            // Update local state
            setFields(prev => ({
                ...prev,
                mac_addresses: updatedMacAddresses
            }));
            
            // Clear input field
            setNewMacAddress('');
            
            message.success('MAC address added successfully');
        } catch (error) {
            console.error('❌ Error adding MAC address:', error);
            message.error('Failed to add MAC address');
        }
    };
    
    const handleRemoveMacAddress = async (macToRemove) => {
        try {
            // Filter out the MAC address to remove
            const updatedMacAddresses = fields.mac_addresses.filter(mac => mac !== macToRemove);
            
            // Update in backend
            await onUpdate({ mac_addresses: updatedMacAddresses });
            
            // Update local state
            setFields(prev => ({
                ...prev,
                mac_addresses: updatedMacAddresses
            }));
            
            message.success('MAC address removed');
        } catch (error) {
            console.error('❌ Error removing MAC address:', error);
            message.error('Failed to remove MAC address');
        }
    };

    const handleBlur = async (field, value) => {
        console.log(`🎯 EmploymentDetails: onBlur - field: ${field}, value: ${value}, original: ${employee[field]}`);
        if (value !== employee[field]) {
            console.log(`📤 EmploymentDetails: Saving change for ${field}: ${employee[field]} → ${value}`);
            try {
                // Convert date strings to ISO format if needed
                let processedValue = value;
                if (field === 'joining_date' && value) {
                    // Ensure date is in ISO format
                    processedValue = new Date(value).toISOString().split('T')[0];
                }
                
                await onUpdate({ [field]: processedValue });
                console.log(`✅ EmploymentDetails: Successfully updated ${field}`);
            } catch (error) {
                console.error(`❌ EmploymentDetails: Error updating ${field}:`, error);
                // Revert on error
                setFields(prev => ({
                    ...prev,
                    [field]: employee[field] || ''
                }));
            }
        } else {
            console.log(`ℹ️ EmploymentDetails: No change for ${field}, skipping save`);
        }
    };

    // Handle designation update from EmployeeDesignation component
    const handleDesignationUpdate = async (designationData) => {
        console.log('🏢 Designation update received:', designationData);
        
        try {
            // Update in backend through parent component
            await onUpdate(designationData);
            console.log('✅ Designation updated successfully');
        } catch (error) {
            console.error('❌ Error updating designation:', error);
            message.error('Failed to update designation');
        }
    };

    return (
        <div className="p-6 bg-white">
            {/* Designation Component */}
            <EmployeeDesignation employee={employee} onSave={handleDesignationUpdate} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">EMPLOYEE ID</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base bg-gray-100 cursor-not-allowed"
                        value={fields.employee_id}
                        readOnly
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">JOINING DATE</div>
                    <input
                        type="date"
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.joining_date}
                        onChange={e => handleChange("joining_date", e.target.value)}
                        onBlur={e => handleBlur("joining_date", e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">DEPARTMENT</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.department_id || ''}
                        onChange={e => handleDepartmentChange(e.target.value)}
                        disabled={loadingDepartments}
                    >
                        <option value="">
                            {loadingDepartments ? 'Loading departments...' : 'Select Department'}
                        </option>
                        {Array.isArray(departments) && departments.length > 0 ? (
                            departments.map(dept => (
                                <option key={dept._id || dept.id} value={dept._id || dept.id}>
                                    {dept.name || dept.department_name || 'Unnamed Department'}
                                </option>
                            ))
                        ) : (
                            !loadingDepartments && (
                                <option value="" disabled>
                                    No departments available
                                </option>
                            )
                        )}
                    </select>
                    {loadingDepartments && (
                        <div className="text-sm text-gray-500">Loading departments...</div>
                    )}
                    {!loadingDepartments && (!Array.isArray(departments) || departments.length === 0) && (
                        <div className="text-sm text-red-500">
                            No departments found. Please check backend connection.
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">ROLE</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.role_id}
                        onChange={e => handleRoleChange(e.target.value)}
                        disabled={loadingRoles}
                    >
                        <option value="">
                            {loadingRoles ? 'Loading roles...' : 'Select Role'}
                        </option>
                        {Array.isArray(roles) && roles.length > 0 ? (
                            roles.map(role => (
                                <option key={role._id || role.id} value={role._id || role.id}>
                                    {role.name || role.role_name || 'Unnamed Role'}
                                </option>
                            ))
                        ) : (
                            !loadingRoles && (
                                <option value="" disabled>
                                    No roles available
                                </option>
                            )
                        )}
                    </select>
                    {loadingRoles && (
                        <div className="text-sm text-gray-500">Loading roles...</div>
                    )}
                    {!loadingRoles && (!Array.isArray(roles) || roles.length === 0) && (
                        <div className="text-sm text-red-500">
                            No roles found. Please check backend connection.
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">STATUS</div>
                    <select
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.employee_status}
                        onChange={e => handleChange("employee_status", e.target.value)}
                        onBlur={e => handleBlur("employee_status", e.target.value)}
                    >
                        <option value="">Select Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">SALARY</div>
                    <input
                        type="number"
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.salary}
                        onChange={e => handleChange("salary", e.target.value)}
                        onBlur={e => handleBlur("salary", e.target.value)}
                        placeholder="Enter salary"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">WORK LOCATION</div>
                    <input
                        className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold w-full text-base"
                        value={fields.work_location}
                        onChange={e => handleChange("work_location", e.target.value)}
                        onBlur={e => handleBlur("work_location", e.target.value)}
                        placeholder="Enter work location"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-lg text-[#03b0f5] font-bold">MAC ADDRESSES</div>
                    <div className="flex gap-2">
                        <input
                            className="text-[#0db45c] border border-black rounded px-3 py-2 font-bold flex-1 text-base"
                            placeholder="Enter MAC address"
                            value={newMacAddress}
                            onChange={e => setNewMacAddress(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddMacAddress();
                                }
                            }}
                            pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                            title="Please enter a valid MAC address format (AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)"
                        />
                        <button 
                            className="bg-[#03b0f5] text-white px-3 py-2 rounded font-bold"
                            onClick={handleAddMacAddress}
                        >
                            Add
                        </button>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                        Format: 00:1A:2B:3C:4D:5E
                    </div>
                    
                    {/* List of MAC addresses */}
                    {fields.mac_addresses && fields.mac_addresses.length > 0 ? (
                        <div className="mt-2 border rounded p-2 bg-gray-50">
                            <ul className="space-y-1">
                                {fields.mac_addresses.map((mac, index) => (
                                    <li key={index} className="flex justify-between items-center">
                                        <span className="text-gray-800">{mac}</span>
                                        <button 
                                            onClick={() => handleRemoveMacAddress(mac)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 mt-2">
                            No MAC addresses added yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
