/**
 * Enhanced Permission Validation and Fixes for RoleSettings
 * This script addresses critical issues with permission handling and validation
 */

// Enhanced permission validation functions
const EnhancedPermissionValidator = {
    
    // Critical fix for permission handling
    validateAndFixPermissions(formData) {
        console.log('🔍 VALIDATING PERMISSIONS BEFORE SUBMIT');
        
        const validationResults = {
            isValid: true,
            errors: [],
            warnings: [],
            fixes: [],
            sanitizedPermissions: {}
        };

        try {
            // Fix 1: Ensure empty permissions arrays are handled correctly
            Object.keys(formData.permissions).forEach(module => {
                const permissions = formData.permissions[module];
                
                // Critical Fix: Don't skip empty arrays - they indicate explicit "no permissions"
                if (!Array.isArray(permissions)) {
                    validationResults.errors.push(`Module ${module} has invalid permissions format`);
                    validationResults.isValid = false;
                    return;
                }

                // Fix 2: Validate delete permissions have proper hierarchical context
                if (permissions.includes('delete')) {
                    const hierarchicalPerms = ['show', 'own', 'junior', 'all'];
                    const hasHierarchy = hierarchicalPerms.some(p => permissions.includes(p));
                    
                    if (!hasHierarchy) {
                        validationResults.warnings.push(
                            `Module ${module} has delete permission without proper hierarchical access (show, own, junior, or all)`
                        );
                        validationResults.fixes.push(`Add 'show' permission to ${module} for proper access control`);
                    }
                }

                // Fix 3: Ensure logical permission order
                const permissionOrder = ['show', 'own', 'junior', 'all', 'settings', 'delete'];
                const sortedPermissions = permissions.sort((a, b) => {
                    const indexA = permissionOrder.indexOf(a);
                    const indexB = permissionOrder.indexOf(b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                });

                validationResults.sanitizedPermissions[module] = sortedPermissions;
            });

            // Fix 4: Critical module validation
            const criticalModules = ['employees', 'users', 'roles', 'settings'];
            criticalModules.forEach(module => {
                if (validationResults.sanitizedPermissions[module]?.includes('delete')) {
                    validationResults.warnings.push(
                        `SECURITY WARNING: ${module} module has delete permission - ensure only trusted admins have this role`
                    );
                }
            });

            // Fix 5: SuperAdmin validation
            if (formData.permissions.SuperAdmin) {
                // Clear all other permissions if SuperAdmin is selected
                validationResults.sanitizedPermissions = { SuperAdmin: ['*'] };
                validationResults.fixes.push('SuperAdmin selected - cleared all other permissions');
            }

        } catch (error) {
            validationResults.isValid = false;
            validationResults.errors.push(`Validation error: ${error.message}`);
        }

        return validationResults;
    },

    // Enhanced handleSubmit with comprehensive validation
    enhancedHandleSubmit(originalFormData, editingRole) {
        console.log('🚀 ENHANCED SUBMIT WITH VALIDATION');
        
        // Step 1: Validate permissions
        const validation = this.validateAndFixPermissions(originalFormData);
        
        if (!validation.isValid) {
            console.error('❌ VALIDATION FAILED:', validation.errors);
            return {
                success: false,
                errors: validation.errors,
                warnings: validation.warnings
            };
        }

        // Step 2: Use sanitized permissions
        const formData = {
            ...originalFormData,
            permissions: validation.sanitizedPermissions
        };

        // Step 3: Convert to backend format with enhanced logic
        const permissionsArray = this.convertToBackendFormat(formData.permissions);
        
        // Step 4: Final validation of backend format
        const backendValidation = this.validateBackendFormat(permissionsArray);
        
        if (!backendValidation.isValid) {
            console.error('❌ BACKEND FORMAT VALIDATION FAILED:', backendValidation.errors);
            return {
                success: false,
                errors: backendValidation.errors,
                warnings: [...validation.warnings, ...backendValidation.warnings]
            };
        }

        const submitData = {
            ...formData,
            permissions: permissionsArray
        };

        console.log('✅ VALIDATION PASSED - Ready for submission');
        console.log('📤 Final submit data:', JSON.stringify(submitData, null, 2));
        
        return {
            success: true,
            submitData,
            warnings: validation.warnings,
            fixes: validation.fixes
        };
    },

    // Enhanced permission conversion with better error handling
    convertToBackendFormat(permissions) {
        const permissionsArray = [];
        
        try {
            // Handle SuperAdmin first
            if (permissions.SuperAdmin && permissions.SuperAdmin.length > 0) {
                permissionsArray.push({
                    page: "*",
                    actions: "*"
                });
                return permissionsArray; // SuperAdmin overrides everything
            }

            // Collect all Leads CRM permissions for backward compatibility
            const leadsPermissions = new Set();
            
            // Process each module
            Object.keys(permissions).forEach(module => {
                const modulePermissions = permissions[module];
                
                if (!Array.isArray(modulePermissions)) {
                    console.warn(`⚠️ Skipping invalid permissions for ${module}:`, modulePermissions);
                    return;
                }

                // Handle nested permissions (e.g., "Leads CRM.Create LEAD")
                if (module.includes('.')) {
                    const [parentModule, section] = module.split('.');
                    
                    // Format page name correctly
                    const pageName = parentModule === 'Leads CRM' ? 'leads' : parentModule.toLowerCase();
                    const formattedPage = `${pageName}.${section.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_')}`;
                    
                    // CRITICAL FIX: Always save permissions, even empty arrays
                    permissionsArray.push({
                        page: formattedPage,
                        actions: modulePermissions // Keep empty arrays!
                    });
                    
                    // Collect for unified leads permission
                    if (parentModule === 'Leads CRM' && modulePermissions.length > 0) {
                        modulePermissions.forEach(perm => leadsPermissions.add(perm));
                    }
                } else {
                    // Handle regular flat permissions
                    // CRITICAL FIX: Save all permissions, including empty ones for explicit denial
                    permissionsArray.push({
                        page: module,
                        actions: modulePermissions
                    });
                }
            });
            
            // Add unified leads permission for backward compatibility
            if (leadsPermissions.size > 0) {
                permissionsArray.push({
                    page: "leads",
                    actions: Array.from(leadsPermissions)
                });
            }

        } catch (error) {
            console.error('❌ Error converting permissions to backend format:', error);
            throw error;
        }

        return permissionsArray;
    },

    // Validate backend format
    validateBackendFormat(permissionsArray) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        try {
            if (!Array.isArray(permissionsArray)) {
                validation.isValid = false;
                validation.errors.push('Permissions array is not valid');
                return validation;
            }

            // Validate each permission object
            permissionsArray.forEach((perm, index) => {
                if (!perm.page || (!perm.actions && perm.actions !== '')) {
                    validation.errors.push(`Permission ${index} missing required fields`);
                    validation.isValid = false;
                }

                // Check for duplicate pages
                const duplicates = permissionsArray.filter(p => p.page === perm.page);
                if (duplicates.length > 1) {
                    validation.warnings.push(`Duplicate permissions found for page: ${perm.page}`);
                }
            });

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Backend validation error: ${error.message}`);
        }

        return validation;
    },

    // Enhanced permission change handler with validation
    enhancedHandlePermissionChange(currentPermissions, module, action, checked) {
        console.log(`🔄 ENHANCED PERMISSION CHANGE: ${module}.${action} = ${checked}`);
        
        try {
            const newPermissions = { ...currentPermissions };
            
            // Critical Fix 1: SuperAdmin handling
            if (module === 'SuperAdmin' && checked) {
                console.log('🔒 SuperAdmin selected - clearing all other permissions');
                return { 'SuperAdmin': ['*'] };
            }
            
            // Critical Fix 2: Remove SuperAdmin when selecting other permissions
            if (module !== 'SuperAdmin' && newPermissions.SuperAdmin) {
                console.log('🔓 Removing SuperAdmin due to other permission selection');
                delete newPermissions.SuperAdmin;
            }
            
            // Initialize module if needed
            if (!newPermissions[module]) {
                newPermissions[module] = [];
            }
            
            // Critical Fix 3: Handle permission changes correctly
            if (checked) {
                // Add permission if not already present
                if (!newPermissions[module].includes(action)) {
                    newPermissions[module].push(action);
                    console.log(`✅ Added ${action} to ${module}`);
                }
            } else {
                // Remove permission
                newPermissions[module] = newPermissions[module].filter(a => a !== action);
                console.log(`❌ Removed ${action} from ${module}`);
                
                // CRITICAL FIX: Keep empty arrays instead of deleting modules
                // This ensures backend knows about explicit permission denial
                console.log(`📝 Module ${module} now has ${newPermissions[module].length} permissions`);
            }
            
            // Critical Fix 4: Validate permission hierarchy
            if (action === 'delete' && checked) {
                const hasShow = newPermissions[module].includes('show');
                if (!hasShow) {
                    console.warn(`⚠️ Adding delete permission to ${module} without show permission`);
                    // Optionally auto-add show permission
                    // newPermissions[module].push('show');
                }
            }
            
            console.log('🔍 Final permissions state:', newPermissions);
            return newPermissions;
            
        } catch (error) {
            console.error('❌ Error in enhanced permission change:', error);
            return currentPermissions; // Return original on error
        }
    },

    // Test permission functionality
    testPermissionFunctionality() {
        console.log('🧪 TESTING PERMISSION FUNCTIONALITY');
        
        const tests = [
            {
                name: 'SuperAdmin Override',
                test: () => {
                    const result = this.enhancedHandlePermissionChange({tickets: ['show']}, 'SuperAdmin', '*', true);
                    return Object.keys(result).length === 1 && result.SuperAdmin;
                }
            },
            {
                name: 'Regular Permission Addition',
                test: () => {
                    const result = this.enhancedHandlePermissionChange({}, 'tickets', 'delete', true);
                    return result.tickets && result.tickets.includes('delete');
                }
            },
            {
                name: 'Permission Removal',
                test: () => {
                    const result = this.enhancedHandlePermissionChange({tickets: ['show', 'delete']}, 'tickets', 'delete', false);
                    return result.tickets && !result.tickets.includes('delete') && result.tickets.includes('show');
                }
            },
            {
                name: 'Empty Array Preservation',
                test: () => {
                    const result = this.enhancedHandlePermissionChange({tickets: ['delete']}, 'tickets', 'delete', false);
                    return result.tickets && Array.isArray(result.tickets) && result.tickets.length === 0;
                }
            },
            {
                name: 'Backend Format Conversion',
                test: () => {
                    const input = { tickets: ['show', 'delete'], warnings: [] };
                    const result = this.convertToBackendFormat(input);
                    return Array.isArray(result) && result.length === 2;
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
        console.log(`\n📊 TEST RESULTS: ${passedCount}/${tests.length} passed`);
        
        return results;
    },

    // Generate permission validation report
    generateValidationReport(roles) {
        console.log('📋 GENERATING PERMISSION VALIDATION REPORT');
        
        const report = {
            totalRoles: roles.length,
            rolesWithIssues: 0,
            issues: [],
            recommendations: [],
            securityWarnings: []
        };

        try {
            roles.forEach(role => {
                const roleIssues = [];
                
                if (!role.permissions || !Array.isArray(role.permissions)) {
                    roleIssues.push('Invalid permissions format');
                } else {
                    // Check each permission
                    role.permissions.forEach(perm => {
                        // Check for delete permissions without proper access
                        if (perm.actions === 'delete' || 
                            (Array.isArray(perm.actions) && perm.actions.includes('delete'))) {
                            
                            const hasShow = perm.actions === '*' || 
                                (Array.isArray(perm.actions) && perm.actions.includes('show'));
                            
                            if (!hasShow) {
                                roleIssues.push(`${perm.page} has delete without show permission`);
                            }

                            // Security warning for critical modules
                            const criticalModules = ['employees', 'users', 'roles', 'settings'];
                            if (criticalModules.includes(perm.page)) {
                                report.securityWarnings.push(
                                    `Role "${role.name}" has delete permission for critical module: ${perm.page}`
                                );
                            }
                        }
                    });
                }

                if (roleIssues.length > 0) {
                    report.rolesWithIssues++;
                    report.issues.push({
                        role: role.name,
                        issues: roleIssues
                    });
                }
            });

            // Generate recommendations
            if (report.rolesWithIssues > 0) {
                report.recommendations.push('Review roles with permission issues');
            }
            
            if (report.securityWarnings.length > 0) {
                report.recommendations.push('Review delete permissions for critical modules');
            }

        } catch (error) {
            console.error('Error generating validation report:', error);
        }

        return report;
    }
};

// Monkey patch for RoleSettings component (if needed)
const patchRoleSettings = () => {
    // Store original functions
    const originalHandlePermissionChange = window.handlePermissionChange;
    const originalHandleSubmit = window.handleSubmit;

    // Enhanced implementations available globally
    window.enhancedHandlePermissionChange = EnhancedPermissionValidator.enhancedHandlePermissionChange;
    window.enhancedHandleSubmit = EnhancedPermissionValidator.enhancedHandleSubmit;
    window.validateAndFixPermissions = EnhancedPermissionValidator.validateAndFixPermissions;

    console.log('✅ RoleSettings enhanced functions are now available globally');
};

// Auto-initialize
window.EnhancedPermissionValidator = EnhancedPermissionValidator;

// Quick test function
window.testPermissionValidation = () => {
    return EnhancedPermissionValidator.testPermissionFunctionality();
};

// Validation report generator
window.generatePermissionReport = (roles) => {
    return EnhancedPermissionValidator.generateValidationReport(roles || []);
};

console.log('🛠️ Enhanced Permission Validator Loaded!');
console.log('\nAvailable Functions:');
console.log('  • testPermissionValidation()              - Test all validation functions');
console.log('  • generatePermissionReport(roles)         - Generate validation report for roles');
console.log('  • EnhancedPermissionValidator.*           - Access all validation functions');
console.log('\nRecommended Usage:');
console.log('  1. Run testPermissionValidation() to verify functionality');
console.log('  2. Use enhancedHandleSubmit() instead of regular handleSubmit()');
console.log('  3. Run generatePermissionReport() to identify issues');

// Auto-run basic test
setTimeout(() => {
    console.log('\n🧪 Running automatic validation test...');
    window.testPermissionValidation();
}, 1000);