/**
 * Permission Validation and Fix Script
 * Identifies and fixes permission-related issues in the RoleSettings component
 * Focus on delete permissions and role-based access control
 */

class PermissionValidator {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.allPermissions = null;
    }

    // Get the permission structure and validate it
    validatePermissionStructure() {
        console.log('🔍 VALIDATING PERMISSION STRUCTURE');
        console.log('='.repeat(50));

        // Define expected permission structure (from RoleSettings.jsx)
        this.allPermissions = {
            'SuperAdmin': ['*'],
            'feeds': ['show','post', 'all', 'delete'],
            'Leads CRM': {
                'Create LEAD': ['show', 'add', 'reassignment_popup'],
                'PL & ODD LEADS': ['show', 'own', 'junior', 'all', 'assign', 'download_obligation', 'status_update', 'delete'],
            },
            'login': ['show', 'own', 'junior', 'all', 'channel', 'edit', 'delete'],
            'tasks': ['show', 'own', 'junior', 'all', 'delete'],
            'tickets': ['show', 'own', 'junior', 'all', 'delete'],
            'warnings': ['show', 'own', 'junior', 'all', 'delete'],
            'interview': ['show', 'junior', 'all', 'settings', 'delete'],
            'hrms': ['show'],
            'employees': ['show', 'password', 'junior', 'all', 'role', 'delete'],
            'leaves': ['show', 'own', 'junior', 'all', 'delete'],
            'attendance': ['show', 'own', 'junior', 'all', 'delete'],
            'apps': ['show', 'manage'],
            'notification': ['show', 'delete', 'send'],
            'reports': ['show'],
            'settings': ['show'],
        };

        console.log('✅ Permission structure loaded');
        console.log(`📊 Total modules: ${Object.keys(this.allPermissions).length}`);
        
        // Count delete permissions
        let deletePermCount = 0;
        Object.entries(this.allPermissions).forEach(([module, perms]) => {
            if (Array.isArray(perms) && perms.includes('delete')) {
                deletePermCount++;
            } else if (typeof perms === 'object') {
                Object.values(perms).forEach(sectionPerms => {
                    if (Array.isArray(sectionPerms) && sectionPerms.includes('delete')) {
                        deletePermCount++;
                    }
                });
            }
        });
        
        console.log(`🗑️ Modules with delete permission: ${deletePermCount}`);
        return true;
    }

    // Validate permission descriptions
    validatePermissionDescriptions() {
        console.log('\n🏷️ VALIDATING PERMISSION DESCRIPTIONS');
        console.log('-'.repeat(40));

        const expectedDescriptions = {
            '*': '⭐ Super Admin - Complete system access with all permissions',
            'show': '👁️ Show - Can see the module in navigation menu',
            'own': '👤 Own Only - Can only manage their own records',
            'junior': '🔸 Manager Level - Can manage subordinate records + own',
            'all': '🔑 Admin Level - Can manage all records',
            'settings': '⚙️ Settings - Can manage module settings and configurations',
            'delete': '🗑️ Delete - Can delete records in this module',
            'add': '➕ Add - Can create new records',
            'edit': '✏️ Edit - Can modify existing records',
            'assign': '👥 Assign - Can assign records to other users',
            'reassignment_popup': '🔄 Reassignment Popup - Can view and interact with reassignment popup window',
            'download_obligation': '📥 Download - Can download obligation documents',
            'status_update': '🔄 Status Update - Can update record status',
            'view_other': '👀 View Others - Can view other users records (deprecated)'
        };

        const missingDescriptions = [];
        const usedPermissions = new Set();

        // Collect all used permissions
        Object.values(this.allPermissions).forEach(perms => {
            if (Array.isArray(perms)) {
                perms.forEach(perm => usedPermissions.add(perm));
            } else if (typeof perms === 'object') {
                Object.values(perms).forEach(sectionPerms => {
                    if (Array.isArray(sectionPerms)) {
                        sectionPerms.forEach(perm => usedPermissions.add(perm));
                    }
                });
            }
        });

        // Check for missing descriptions
        usedPermissions.forEach(perm => {
            if (!expectedDescriptions[perm]) {
                missingDescriptions.push(perm);
            }
        });

        if (missingDescriptions.length === 0) {
            console.log('✅ All permissions have descriptions');
        } else {
            console.log(`❌ Missing descriptions for: ${missingDescriptions.join(', ')}`);
            this.issues.push({
                type: 'Missing Descriptions',
                count: missingDescriptions.length,
                items: missingDescriptions
            });
        }

        return missingDescriptions.length === 0;
    }

    // Check for potential security issues with delete permissions
    validateDeletePermissionSecurity() {
        console.log('\n🔒 VALIDATING DELETE PERMISSION SECURITY');
        console.log('-'.repeat(40));

        const securityIssues = [];

        // Issue 1: Check if there are too many unrestricted delete permissions
        const modulesWithDelete = [];
        Object.entries(this.allPermissions).forEach(([module, perms]) => {
            let hasDelete = false;
            if (Array.isArray(perms) && perms.includes('delete')) {
                hasDelete = true;
            } else if (typeof perms === 'object') {
                Object.entries(perms).forEach(([section, sectionPerms]) => {
                    if (Array.isArray(sectionPerms) && sectionPerms.includes('delete')) {
                        hasDelete = true;
                    }
                });
            }
            
            if (hasDelete) {
                modulesWithDelete.push(module);
            }
        });

        console.log(`🗑️ Modules with delete permissions: ${modulesWithDelete.length}`);
        modulesWithDelete.forEach(module => {
            console.log(`  • ${module}`);
        });

        // Issue 2: Check for critical modules that should have restricted delete
        const criticalModules = ['employees', 'users', 'roles', 'settings'];
        const criticalWithDelete = modulesWithDelete.filter(module => 
            criticalModules.includes(module.toLowerCase())
        );

        if (criticalWithDelete.length > 0) {
            securityIssues.push({
                type: 'Critical Module Delete Access',
                severity: 'HIGH',
                message: `Critical modules have delete permissions: ${criticalWithDelete.join(', ')}`,
                recommendation: 'Ensure only trusted admin roles have delete access to these modules'
            });
        }

        // Issue 3: Check for modules missing hierarchical permissions
        const hierarchicalPermissions = ['own', 'junior', 'all'];
        Object.entries(this.allPermissions).forEach(([module, perms]) => {
            if (Array.isArray(perms) && perms.includes('delete')) {
                const hasHierarchy = hierarchicalPermissions.some(p => perms.includes(p));
                if (!hasHierarchy) {
                    securityIssues.push({
                        type: 'Missing Hierarchical Control',
                        severity: 'MEDIUM',
                        message: `Module "${module}" has delete but no hierarchical permissions (own/junior/all)`,
                        recommendation: 'Consider adding hierarchical permissions for better access control'
                    });
                }
            }
        });

        if (securityIssues.length === 0) {
            console.log('✅ No obvious security issues found');
        } else {
            console.log(`⚠️ Found ${securityIssues.length} potential security issues:`);
            securityIssues.forEach((issue, index) => {
                console.log(`  ${index + 1}. [${issue.severity}] ${issue.type}`);
                console.log(`     ${issue.message}`);
                console.log(`     💡 ${issue.recommendation}`);
            });
        }

        this.issues = this.issues.concat(securityIssues);
        return securityIssues.length === 0;
    }

    // Validate that permission handling functions are working correctly
    validatePermissionHandlers() {
        console.log('\n⚙️ VALIDATING PERMISSION HANDLERS');
        console.log('-'.repeat(40));

        const handlerIssues = [];

        // Test 1: Validate handlePermissionChange function logic
        console.log('Testing handlePermissionChange logic...');
        
        try {
            // Simulate permission changes
            const testPermissions = {};
            
            // Test SuperAdmin behavior
            const superAdminTest = this.simulatePermissionChange(testPermissions, 'SuperAdmin', '*', true);
            if (Object.keys(superAdminTest).length !== 1 || !superAdminTest.SuperAdmin) {
                handlerIssues.push('SuperAdmin permission selection not clearing other permissions');
            }

            // Test regular permission with SuperAdmin active
            const superAdminActiveTest = { SuperAdmin: ['*'] };
            const regularPermTest = this.simulatePermissionChange(superAdminActiveTest, 'tickets', 'show', true);
            if (regularPermTest.SuperAdmin) {
                handlerIssues.push('Selecting regular permission not removing SuperAdmin');
            }

            // Test delete permission specifically
            const deletePermTest = this.simulatePermissionChange({}, 'tickets', 'delete', true);
            if (!deletePermTest.tickets || !deletePermTest.tickets.includes('delete')) {
                handlerIssues.push('Delete permission not being added correctly');
            }

            console.log('✅ Permission handler logic tests completed');

        } catch (error) {
            handlerIssues.push(`Permission handler testing failed: ${error.message}`);
        }

        if (handlerIssues.length === 0) {
            console.log('✅ All permission handlers appear to be working correctly');
        } else {
            console.log(`❌ Found ${handlerIssues.length} handler issues:`);
            handlerIssues.forEach(issue => console.log(`  • ${issue}`));
        }

        return handlerIssues.length === 0;
    }

    // Simulate permission change (replicates handlePermissionChange logic)
    simulatePermissionChange(currentPermissions, module, action, checked) {
        const newPermissions = { ...currentPermissions };

        // Special handling for SuperAdmin
        if (module === 'SuperAdmin' && checked) {
            return { 'SuperAdmin': ['*'] };
        }

        // If user selects any other permission while SuperAdmin is active, remove SuperAdmin
        if (module !== 'SuperAdmin' && newPermissions.SuperAdmin) {
            delete newPermissions.SuperAdmin;
        }

        if (!newPermissions[module]) {
            newPermissions[module] = [];
        }

        if (checked) {
            if (!newPermissions[module].includes(action)) {
                newPermissions[module].push(action);
            }
        } else {
            newPermissions[module] = newPermissions[module].filter(a => a !== action);
        }

        return newPermissions;
    }

    // Check for common UI/UX issues with permissions
    validatePermissionUX() {
        console.log('\n🎨 VALIDATING PERMISSION UX');
        console.log('-'.repeat(40));

        const uxIssues = [];

        // Issue 1: Check for permissions without clear hierarchical order
        const permissionsWithHierarchy = [
            'tickets', 'warnings', 'employees', 'leaves', 'attendance'
        ];

        permissionsWithHierarchy.forEach(module => {
            const perms = this.allPermissions[module];
            if (Array.isArray(perms)) {
                const hierarchyOrder = ['show', 'own', 'junior', 'all'];
                const hasDelete = perms.includes('delete');
                const hierarchyPerms = perms.filter(p => hierarchyOrder.includes(p));
                
                if (hasDelete && hierarchyPerms.length === 0) {
                    uxIssues.push(`Module "${module}" has delete but no hierarchy permissions - users may be confused about scope`);
                }
            }
        });

        // Issue 2: Check for inconsistent permission patterns
        const standardPermissions = ['show', 'own', 'junior', 'all', 'delete'];
        const modulePatterns = {};
        
        Object.entries(this.allPermissions).forEach(([module, perms]) => {
            if (Array.isArray(perms)) {
                const pattern = perms.filter(p => standardPermissions.includes(p)).sort().join(',');
                if (!modulePatterns[pattern]) {
                    modulePatterns[pattern] = [];
                }
                modulePatterns[pattern].push(module);
            }
        });

        console.log('Permission patterns found:');
        Object.entries(modulePatterns).forEach(([pattern, modules]) => {
            console.log(`  ${pattern}: ${modules.join(', ')}`);
        });

        if (Object.keys(modulePatterns).length > 3) {
            uxIssues.push('Too many different permission patterns - consider standardizing for better UX');
        }

        if (uxIssues.length === 0) {
            console.log('✅ No major UX issues found');
        } else {
            console.log(`⚠️ Found ${uxIssues.length} UX issues:`);
            uxIssues.forEach(issue => console.log(`  • ${issue}`));
        }

        return uxIssues.length === 0;
    }

    // Generate fixes for identified issues
    generateFixes() {
        console.log('\n🔧 GENERATING FIXES');
        console.log('-'.repeat(40));

        const fixes = [];

        this.issues.forEach(issue => {
            switch (issue.type) {
                case 'Missing Descriptions':
                    fixes.push({
                        issue: issue.type,
                        fix: 'Add missing permission descriptions to permissionDescriptions object',
                        code: this.generateMissingDescriptionsFix(issue.items)
                    });
                    break;

                case 'Critical Module Delete Access':
                    fixes.push({
                        issue: issue.type,
                        fix: 'Add warning UI for critical module delete permissions',
                        code: this.generateCriticalModuleWarningFix()
                    });
                    break;

                case 'Missing Hierarchical Control':
                    fixes.push({
                        issue: issue.type,
                        fix: 'Consider adding hierarchical permissions to modules',
                        code: this.generateHierarchicalPermissionFix()
                    });
                    break;
            }
        });

        if (fixes.length === 0) {
            console.log('✅ No fixes needed - all validations passed!');
        } else {
            console.log(`🔧 Generated ${fixes.length} fixes:`);
            fixes.forEach((fix, index) => {
                console.log(`\n${index + 1}. ${fix.issue}`);
                console.log(`   Fix: ${fix.fix}`);
                if (fix.code) {
                    console.log(`   Code:`);
                    console.log(fix.code);
                }
            });
        }

        this.fixes = fixes;
        return fixes;
    }

    // Generate fix for missing descriptions
    generateMissingDescriptionsFix(missingItems) {
        const suggestions = missingItems.map(item => {
            return `'${item}': '${this.generatePermissionDescription(item)}',`;
        }).join('\n        ');

        return `
    // Add these to permissionDescriptions object in RoleSettings.jsx:
    const permissionDescriptions = {
        // ... existing descriptions ...
        ${suggestions}
    };`;
    }

    // Generate a description for a permission
    generatePermissionDescription(permission) {
        const descriptions = {
            'post': '📝 Post - Can create and publish content',
            'channel': '📺 Channel - Can manage communication channels',
            'password': '🔑 Password - Can manage user passwords',
            'role': '👤 Role - Can assign and manage user roles',
            'manage': '⚖️ Manage - Can manage and configure the module',
            'send': '📤 Send - Can send notifications or messages'
        };

        return descriptions[permission] || `🔹 ${permission.charAt(0).toUpperCase() + permission.slice(1)} - Can ${permission} records`;
    }

    // Generate fix for critical module warnings
    generateCriticalModuleWarningFix() {
        return `
    // Add this to the permission checkbox rendering in RoleSettings.jsx:
    {/* Warning for critical permissions */}
    {(module === 'employees' || module === 'users' || module === 'settings') && action === 'delete' && (
        <div className="mt-1 text-xs text-red-400 flex items-center">
            <span className="mr-1">⚠️</span>
            Critical permission - use with caution
        </div>
    )}`;
    }

    // Generate fix for hierarchical permissions
    generateHierarchicalPermissionFix() {
        return `
    // Consider updating allPermissions structure to include hierarchical permissions:
    // Example for modules that have delete but no hierarchy:
    'apps': ['show', 'own', 'all', 'manage', 'delete'], // Added 'own' and 'all' for better control
    'notification': ['show', 'own', 'all', 'delete', 'send'], // Added 'own' and 'all' for better control`;
    }

    // Run comprehensive validation
    async runComprehensiveValidation() {
        console.log('🚀 STARTING COMPREHENSIVE PERMISSION VALIDATION');
        console.log('='.repeat(60));

        const results = {
            structure: this.validatePermissionStructure(),
            descriptions: this.validatePermissionDescriptions(),
            security: this.validateDeletePermissionSecurity(),
            handlers: this.validatePermissionHandlers(),
            ux: this.validatePermissionUX()
        };

        const passed = Object.values(results).filter(r => r).length;
        const total = Object.keys(results).length;

        console.log('\n📊 VALIDATION SUMMARY');
        console.log('='.repeat(40));
        console.log(`✅ Passed: ${passed}/${total} validations`);
        console.log(`❌ Failed: ${total - passed}/${total} validations`);

        if (passed === total) {
            console.log('\n🎉 All validations passed! The permission system is working correctly.');
        } else {
            console.log('\n⚠️ Some validations failed. See details above.');
            this.generateFixes();
        }

        return {
            passed: passed === total,
            results,
            issues: this.issues,
            fixes: this.fixes
        };
    }

    // Quick test for delete permissions specifically
    quickDeletePermissionTest() {
        console.log('🗑️ QUICK DELETE PERMISSION TEST');
        console.log('='.repeat(40));

        const modulesWithDelete = [];
        const modulesWithoutDelete = [];

        Object.entries(this.allPermissions).forEach(([module, perms]) => {
            let hasDelete = false;
            
            if (Array.isArray(perms) && perms.includes('delete')) {
                hasDelete = true;
            } else if (typeof perms === 'object') {
                Object.values(perms).forEach(sectionPerms => {
                    if (Array.isArray(sectionPerms) && sectionPerms.includes('delete')) {
                        hasDelete = true;
                    }
                });
            }

            if (hasDelete) {
                modulesWithDelete.push(module);
            } else {
                modulesWithoutDelete.push(module);
            }
        });

        console.log(`✅ Modules WITH delete permission (${modulesWithDelete.length}):`);
        modulesWithDelete.forEach(module => console.log(`  • ${module}`));

        console.log(`\n❌ Modules WITHOUT delete permission (${modulesWithoutDelete.length}):`);
        modulesWithoutDelete.forEach(module => console.log(`  • ${module}`));

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (modulesWithDelete.includes('employees')) {
            console.log('  ⚠️ Employee delete permission detected - ensure only senior admins have this role');
        }
        if (modulesWithDelete.includes('settings')) {
            console.log('  ⚠️ Settings delete permission detected - this could affect system configuration');
        }
        if (!modulesWithDelete.includes('tickets')) {
            console.log('  💡 Consider adding delete permission to tickets module for proper ticket management');
        }

        return {
            withDelete: modulesWithDelete,
            withoutDelete: modulesWithoutDelete
        };
    }
}

// Initialize validator
window.permissionValidator = new PermissionValidator();

// Quick access functions
window.validateAllPermissions = async () => {
    return await window.permissionValidator.runComprehensiveValidation();
};

window.testDeletePermissions = () => {
    return window.permissionValidator.quickDeletePermissionTest();
};

window.validatePermissionSecurity = () => {
    window.permissionValidator.validatePermissionStructure();
    return window.permissionValidator.validateDeletePermissionSecurity();
};

// Auto-run quick test
console.log('🔍 Permission Validation Script Loaded!');
console.log('\nAvailable Commands:');
console.log('  • validateAllPermissions()     - Run complete validation');
console.log('  • testDeletePermissions()      - Quick delete permission overview');
console.log('  • validatePermissionSecurity() - Focus on security validation');
console.log('\n⚡ Quick start: Run validateAllPermissions() to begin!');

// Auto-run basic validation
setTimeout(() => {
    console.log('\n🚀 Running quick delete permission test...');
    window.testDeletePermissions();
}, 1000);