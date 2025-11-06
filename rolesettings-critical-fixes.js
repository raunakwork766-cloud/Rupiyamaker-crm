/**
 * RoleSettings Critical Fixes
 * This patch addresses critical issues in the RoleSettings component
 * Apply these fixes to resolve permission handling problems
 */

// Critical Fix 1: Enhanced handlePermissionChange function
const fixedHandlePermissionChange = (module, action, checked, currentPermissions) => {
    console.log('🔧 FIXED handlePermissionChange called:', { module, action, checked });
    
    const newPermissions = { ...currentPermissions };
    
    // CRITICAL FIX: SuperAdmin handling
    if (module === 'SuperAdmin' && checked) {
        console.log('🔒 SuperAdmin selected - clearing all other permissions');
        return { 'SuperAdmin': ['*'] };
    }
    
    // CRITICAL FIX: Remove SuperAdmin when selecting other permissions
    if (module !== 'SuperAdmin' && newPermissions.SuperAdmin) {
        console.log('🔓 Removing SuperAdmin due to other permission selection');
        delete newPermissions.SuperAdmin;
    }
    
    // Initialize module permissions if not exists
    if (!newPermissions[module]) {
        newPermissions[module] = [];
    }
    
    // Get available actions for validation
    const allPermissions = {
        'SuperAdmin': ['*'],
        'tickets': ['show', 'own', 'junior', 'all', 'delete'],
        'warnings': ['show', 'own', 'junior', 'all', 'delete'],
        'interview': ['show', 'junior', 'all', 'settings', 'delete'],
        'employees': ['show', 'password', 'junior', 'all', 'role', 'delete'],
        'leaves': ['show', 'own', 'junior', 'all', 'delete'],
        'attendance': ['show', 'own', 'junior', 'all', 'delete'],
        'apps': ['show', 'manage'],
        'notification': ['show', 'delete', 'send'],
        'reports': ['show'],
        'settings': ['show']
    };
    
    let availableActions = [];
    if (module.includes('.')) {
        // Handle nested modules like "Leads CRM.Create LEAD"
        const [parentModule, section] = module.split('.');
        if (parentModule === 'Leads CRM') {
            const leadsActions = {
                'Create LEAD': ['show', 'add', 'reassignment_popup'],
                'PL & ODD LEADS': ['show', 'own', 'junior', 'all', 'assign', 'download_obligation', 'status_update', 'delete']
            };
            availableActions = leadsActions[section] || [];
        }
    } else {
        availableActions = allPermissions[module] || [];
    }
    
    // Validate action is allowed for this module
    if (!availableActions.includes(action) && action !== '*') {
        console.warn(`⚠️ Action '${action}' not allowed for module '${module}'`);
        return currentPermissions; // Return unchanged
    }
    
    if (checked) {
        // Add permission if not already present
        if (!newPermissions[module].includes(action)) {
            newPermissions[module].push(action);
            console.log(`✅ Added ${action} to ${module}`);
            
            // CRITICAL FIX: Auto-add 'show' if delete is selected without it
            if (action === 'delete' && !newPermissions[module].includes('show') && availableActions.includes('show')) {
                newPermissions[module].push('show');
                console.log(`🔧 Auto-added 'show' permission to ${module} for delete access`);
            }
        }
    } else {
        // Remove permission
        const originalLength = newPermissions[module].length;
        newPermissions[module] = newPermissions[module].filter(a => a !== action);
        console.log(`❌ Removed ${action} from ${module}. Remaining:`, newPermissions[module]);
        
        // CRITICAL FIX: Keep module with empty array instead of deleting
        // This ensures backend receives explicit "no permissions" signal
        console.log(`📝 Module ${module} kept with ${newPermissions[module].length} permissions`);
        
        // VALIDATION: Warn if removing 'show' but keeping higher permissions
        if (action === 'show' && newPermissions[module].some(p => ['own', 'junior', 'all', 'delete'].includes(p))) {
            console.warn(`⚠️ Warning: Removed 'show' from ${module} but higher permissions remain. Users may not be able to access the module.`);
        }
    }
    
    console.log('🔍 Final permissions state:', newPermissions);
    return newPermissions;
};

// Critical Fix 2: Enhanced handleSubmit with proper validation
const fixedHandleSubmit = async (formData, editingRole, updateRoleWithImmediateRefresh, message, closeModal, fetchRoles) => {
    console.log('🔧 FIXED handleSubmit called');
    console.log('🔍 DEBUG: Starting enhanced handleSubmit...');
    console.log('🔍 DEBUG: formData.permissions:', JSON.stringify(formData.permissions, null, 2));
    
    // CRITICAL FIX: Validate permissions before processing
    const validationErrors = [];
    const validationWarnings = [];
    
    // Validate each module's permissions
    Object.entries(formData.permissions).forEach(([module, permissions]) => {
        if (!Array.isArray(permissions)) {
            validationErrors.push(`Invalid permissions format for module: ${module}`);
            return;
        }
        
        // Check for delete without show (except SuperAdmin)
        if (module !== 'SuperAdmin' && permissions.includes('delete') && !permissions.includes('show')) {
            validationWarnings.push(`Module ${module} has delete permission without show permission`);
        }
        
        // Check for critical module delete permissions
        const criticalModules = ['employees', 'users', 'roles', 'settings'];
        if (criticalModules.includes(module) && permissions.includes('delete')) {
            validationWarnings.push(`SECURITY: ${module} has delete permission - ensure this role is for trusted admins only`);
        }
    });
    
    // Show validation errors
    if (validationErrors.length > 0) {
        console.error('❌ Validation errors:', validationErrors);
        message.error(`Validation failed: ${validationErrors.join(', ')}`);
        return;
    }
    
    // Show validation warnings
    if (validationWarnings.length > 0) {
        console.warn('⚠️ Validation warnings:', validationWarnings);
        validationWarnings.forEach(warning => {
            message.warning(warning, 3);
        });
    }
    
    // Convert permissions object back to array format for backend
    const permissionsArray = [];
    
    // CRITICAL FIX: Handle SuperAdmin properly
    if (formData.permissions.SuperAdmin && formData.permissions.SuperAdmin.length > 0) {
        permissionsArray.push({
            page: "*",
            actions: "*"
        });
        console.log('🔒 SuperAdmin permissions configured');
    } else {
        // Collect all Leads CRM permissions for backward compatibility
        const leadsPermissions = new Set();
        
        // Handle regular and nested permissions
        Object.keys(formData.permissions).forEach(module => {
            const permissions = formData.permissions[module];
            
            console.log(`🔍 DEBUG: Processing module "${module}" with permissions:`, permissions);
            
            // CRITICAL FIX: Always process permissions, even empty arrays
            if (!Array.isArray(permissions)) {
                console.warn(`⚠️ Skipping invalid permissions for ${module}:`, permissions);
                return;
            }
            
            // Check if it's a nested permission (e.g., "Leads CRM.Create LEAD")
            if (module.includes('.')) {
                const [parentModule, section] = module.split('.');
                
                // CRITICAL FIX: Always save nested permissions, even if empty
                const pageName = parentModule === 'Leads CRM' ? 'leads' : parentModule.toLowerCase();
                const formattedPage = `${pageName}.${section.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_')}`;
                
                console.log(`🔍 DEBUG: Nested permission - page: "${formattedPage}", actions:`, permissions);
                
                permissionsArray.push({
                    page: formattedPage,
                    actions: permissions // Keep empty arrays for explicit denial
                });
                
                // Collect permissions for unified "leads" entry (only non-empty permissions)
                if (parentModule === 'Leads CRM' && permissions.length > 0) {
                    permissions.forEach(perm => leadsPermissions.add(perm));
                }
            } else {
                // CRITICAL FIX: Save all permissions, including empty arrays
                console.log(`🔍 DEBUG: Regular permission - page: "${module}", actions:`, permissions);
                permissionsArray.push({
                    page: module,
                    actions: permissions // Keep empty arrays!
                });
            }
        });
        
        // Add unified "leads" permission for backward compatibility
        if (leadsPermissions.size > 0) {
            const leadsArray = Array.from(leadsPermissions);
            console.log(`🔍 DEBUG: Adding unified leads permissions:`, leadsArray);
            permissionsArray.push({
                page: "leads",
                actions: leadsArray
            });
        }
    }
    
    console.log('🔍 DEBUG: Final permissionsArray BEFORE submitData:', JSON.stringify(permissionsArray, null, 2));
    
    // CRITICAL FIX: Additional validation of backend format
    if (permissionsArray.length === 0 && Object.keys(formData.permissions).length > 0) {
        console.error('❌ No permissions were converted to backend format');
        message.error('Error: Failed to process permissions for backend submission');
        return;
    }
    
    const submitData = {
        ...formData,
        permissions: permissionsArray
    };
    
    console.log('🔍 DEBUG: Complete submitData:', JSON.stringify(submitData, null, 2));
    
    try {
        // Use the new immediate refresh system
        console.log('🚀 Using immediate permission refresh system...');
        console.log('📤 Submitting to backend...');
        
        const roleId = editingRole ? (editingRole.id || editingRole._id) : null;
        console.log('🔍 DEBUG: Role ID:', roleId);
        console.log('🔍 DEBUG: Edit mode:', !!editingRole);
        
        const result = await updateRoleWithImmediateRefresh(submitData, roleId);
        
        console.log('✅ Role updated with immediate permission refresh:', result);
        message.success(`Role ${editingRole ? 'updated' : 'created'} successfully! Permissions applied immediately.`);
        
        closeModal();
        fetchRoles();
        
    } catch (error) {
        console.error('❌ Error saving role:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response
        });
        
        // CRITICAL FIX: Better error handling
        let errorMessage = 'Failed to save role';
        if (error.message.includes('validation')) {
            errorMessage = 'Validation error: ' + error.message;
        } else if (error.message.includes('permission')) {
            errorMessage = 'Permission error: ' + error.message;
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error: Please check your connection';
        }
        
        message.error(errorMessage);
    }
};

// Critical Fix 3: Enhanced module toggle with validation
const fixedHandleModuleToggle = (module, checked, currentPermissions) => {
    console.log('🔧 FIXED handleModuleToggle called:', { module, checked });
    
    const newPermissions = { ...currentPermissions };
    
    // Get available actions for this module
    const allPermissions = {
        'SuperAdmin': ['*'],
        'tickets': ['show', 'own', 'junior', 'all', 'delete'],
        'warnings': ['show', 'own', 'junior', 'all', 'delete'],
        'interview': ['show', 'junior', 'all', 'settings', 'delete'],
        'employees': ['show', 'password', 'junior', 'all', 'role', 'delete'],
        'leaves': ['show', 'own', 'junior', 'all', 'delete'],
        'attendance': ['show', 'own', 'junior', 'all', 'delete'],
        'apps': ['show', 'manage'],
        'notification': ['show', 'delete', 'send'],
        'reports': ['show'],
        'settings': ['show']
    };
    
    if (checked) {
        // Select all permissions for this module
        if (module.includes('.')) {
            // Handle nested modules
            const [parentModule, section] = module.split('.');
            if (parentModule === 'Leads CRM') {
                const leadsActions = {
                    'Create LEAD': ['show', 'add', 'reassignment_popup'],
                    'PL & ODD LEADS': ['show', 'own', 'junior', 'all', 'assign', 'download_obligation', 'status_update', 'delete']
                };
                const sectionActions = leadsActions[section];
                if (sectionActions) {
                    newPermissions[module] = [...sectionActions];
                    console.log(`✅ Selected all permissions for nested ${module}:`, newPermissions[module]);
                }
            }
        } else {
            // Regular module
            const moduleData = allPermissions[module];
            if (typeof moduleData === 'object' && !Array.isArray(moduleData)) {
                console.log(`${module} is a nested module, skipping parent toggle`);
            } else if (Array.isArray(moduleData)) {
                newPermissions[module] = [...moduleData];
                console.log(`✅ Selected all permissions for ${module}:`, newPermissions[module]);
                
                // CRITICAL FIX: Warn about delete permissions for critical modules
                if (['employees', 'users', 'roles', 'settings'].includes(module) && moduleData.includes('delete')) {
                    console.warn(`⚠️ WARNING: Selected delete permission for critical module ${module}`);
                }
            }
        }
    } else {
        // Deselect all permissions for this module
        // CRITICAL FIX: Keep module with empty array instead of deleting
        newPermissions[module] = [];
        console.log(`❌ Deselected all permissions for ${module}, keeping with empty array`);
    }
    
    console.log('🔍 Updated permissions:', newPermissions);
    return newPermissions;
};

// Critical Fix 4: Permission descriptions with security warnings
const enhancedPermissionDescriptions = {
    '*': '⭐ Super Admin - Complete system access with all permissions',
    'show': '👁️ Show - Can see the module in navigation menu',
    'own': '👤 Own Only - Can only manage their own records',
    'junior': '🔸 Manager Level - Can manage subordinate records + own',
    'all': '🔑 Admin Level - Can manage all records',
    'settings': '⚙️ Settings - Can manage module settings and configurations',
    'delete': '🗑️ Delete - Can delete records in this module ⚠️ USE WITH CAUTION',
    'add': '➕ Add - Can create new records',
    'edit': '✏️ Edit - Can modify existing records',
    'assign': '👥 Assign - Can assign records to other users',
    'reassignment_popup': '🔄 Reassignment Popup - Can view and interact with reassignment popup window',
    'download_obligation': '📥 Download - Can download obligation documents',
    'status_update': '🔄 Status Update - Can update record status',
    'view_other': '👀 View Others - Can view other users records (deprecated)',
    'post': '📝 Post - Can create and publish content',
    'channel': '📺 Channel - Can manage communication channels',
    'password': '🔑 Password - Can manage user passwords ⚠️ SENSITIVE',
    'role': '👤 Role - Can assign and manage user roles ⚠️ SENSITIVE',
    'manage': '⚖️ Manage - Can manage and configure the module',
    'send': '📤 Send - Can send notifications or messages'
};

// Critical Fix 5: Permission validation utility
const validatePermissionSecurity = (module, action) => {
    const securityChecks = {
        warnings: [],
        errors: [],
        isSecure: true
    };
    
    // Critical module checks
    const criticalModules = ['employees', 'users', 'roles', 'settings'];
    if (criticalModules.includes(module)) {
        if (action === 'delete') {
            securityChecks.warnings.push(`DELETE permission on ${module} - only for trusted admins`);
        }
        if (action === 'role' || action === 'password') {
            securityChecks.warnings.push(`${action.toUpperCase()} permission on ${module} - highly sensitive`);
        }
    }
    
    // Logic checks
    if (action === 'delete' && module === 'reports') {
        securityChecks.errors.push('Reports should not have delete permissions - they are typically read-only');
        securityChecks.isSecure = false;
    }
    
    return securityChecks;
};

// Export all fixes
const RoleSettingsFixes = {
    fixedHandlePermissionChange,
    fixedHandleSubmit,
    fixedHandleModuleToggle,
    enhancedPermissionDescriptions,
    validatePermissionSecurity,
    
    // Apply all fixes to window object for immediate use
    applyFixes() {
        window.fixedHandlePermissionChange = fixedHandlePermissionChange;
        window.fixedHandleSubmit = fixedHandleSubmit;
        window.fixedHandleModuleToggle = fixedHandleModuleToggle;
        window.enhancedPermissionDescriptions = enhancedPermissionDescriptions;
        window.validatePermissionSecurity = validatePermissionSecurity;
        
        console.log('✅ All RoleSettings fixes applied to window object');
        console.log('🔧 Use fixedHandlePermissionChange(), fixedHandleSubmit(), etc.');
    },
    
    // Test all fixes
    testFixes() {
        console.log('🧪 TESTING ALL ROLESETTINGS FIXES');
        
        const tests = [
            {
                name: 'Permission Change - Add Delete',
                test: () => {
                    const result = fixedHandlePermissionChange('tickets', 'delete', true, {});
                    return result.tickets && result.tickets.includes('delete') && result.tickets.includes('show');
                }
            },
            {
                name: 'Permission Change - Remove Permission',
                test: () => {
                    const result = fixedHandlePermissionChange('tickets', 'delete', false, {tickets: ['show', 'delete']});
                    return result.tickets && !result.tickets.includes('delete') && result.tickets.length === 1;
                }
            },
            {
                name: 'Module Toggle - Select All',
                test: () => {
                    const result = fixedHandleModuleToggle('tickets', true, {});
                    return result.tickets && result.tickets.length === 5; // show, own, junior, all, delete
                }
            },
            {
                name: 'Module Toggle - Deselect All',
                test: () => {
                    const result = fixedHandleModuleToggle('tickets', false, {tickets: ['show', 'delete']});
                    return result.tickets && result.tickets.length === 0;
                }
            },
            {
                name: 'Security Validation',
                test: () => {
                    const result = validatePermissionSecurity('employees', 'delete');
                    return result.warnings.length > 0;
                }
            }
        ];
        
        const results = tests.map(test => {
            try {
                const passed = test.test();
                console.log(`${passed ? '✅' : '❌'} ${test.name}: ${passed ? 'PASS' : 'FAIL'}`);
                return { name: test.name, passed };
            } catch (error) {
                console.log(`❌ ${test.name}: ERROR - ${error.message}`);
                return { name: test.name, passed: false, error: error.message };
            }
        });
        
        const passedCount = results.filter(r => r.passed).length;
        console.log(`\n📊 FIXES TEST RESULTS: ${passedCount}/${tests.length} passed`);
        
        return results;
    }
};

// Auto-apply fixes
window.RoleSettingsFixes = RoleSettingsFixes;
RoleSettingsFixes.applyFixes();

console.log('🛠️ RoleSettings Critical Fixes Loaded!');
console.log('\nFixed Functions Available:');
console.log('  • fixedHandlePermissionChange()     - Enhanced permission handling');
console.log('  • fixedHandleSubmit()               - Enhanced form submission');
console.log('  • fixedHandleModuleToggle()         - Enhanced module selection');
console.log('  • validatePermissionSecurity()      - Security validation');
console.log('\nCommands:');
console.log('  • RoleSettingsFixes.testFixes()     - Test all fixes');
console.log('  • RoleSettingsFixes.applyFixes()    - Re-apply fixes');

// Auto-run test
setTimeout(() => {
    console.log('\n🧪 Running automatic fix tests...');
    RoleSettingsFixes.testFixes();
}, 1000);