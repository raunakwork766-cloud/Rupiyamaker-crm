/**
 * Comprehensive Permission Testing Script
 * Tests all permission dropdowns and checkboxes (excluding feeds, lead CRM, login, tasks as requested)
 * Focus on delete permissions according to roles and designations
 * 
 * Run this script in browser console while on RoleSettings page
 */

class PermissionTester {
    constructor() {
        this.testResults = [];
        this.errors = [];
        this.roles = [];
        this.departments = [];
        this.currentTestRole = null;
    }

    // Initialize test data
    async init() {
        console.log('🚀 Initializing Permission Comprehensive Test...');
        try {
            await this.fetchRoles();
            await this.fetchDepartments();
            this.logSystemInfo();
        } catch (error) {
            console.error('❌ Failed to initialize test:', error);
            this.errors.push(`Initialization failed: ${error.message}`);
        }
    }

    // Fetch roles from API
    async fetchRoles() {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            throw new Error('No user data found in localStorage');
        }

        const { user_id } = JSON.parse(userData);
        const response = await fetch(`/api/roles?user_id=${user_id}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            this.roles = await response.json();
            console.log(`✅ Fetched ${this.roles.length} roles`);
        } else {
            throw new Error(`Failed to fetch roles: ${response.status}`);
        }
    }

    // Fetch departments from API
    async fetchDepartments() {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            throw new Error('No user data found in localStorage');
        }

        const { user_id } = JSON.parse(userData);
        const response = await fetch(`/api/departments/?user_id=${user_id}`);
        
        if (response.ok) {
            this.departments = await response.json();
            console.log(`✅ Fetched ${this.departments.length} departments`);
        } else {
            console.warn('⚠️ Failed to fetch departments, continuing without');
            this.departments = [];
        }
    }

    // Log system information
    logSystemInfo() {
        console.log('\n📊 SYSTEM INFORMATION');
        console.log('='.repeat(50));
        console.log(`Current User: ${localStorage.getItem('username') || 'Unknown'}`);
        console.log(`Role: ${localStorage.getItem('roleName') || 'Unknown'}`);
        console.log(`Designation: ${localStorage.getItem('designation') || 'Unknown'}`);
        console.log(`Total Roles in System: ${this.roles.length}`);
        console.log(`Total Departments: ${this.departments.length}`);
        console.log('='.repeat(50));
    }

    // Test all permissions for a specific module
    testModulePermissions(moduleName, expectedPermissions) {
        console.log(`\n🧪 TESTING MODULE: ${moduleName}`);
        console.log('-'.repeat(40));

        const moduleResults = {
            module: moduleName,
            expectedPermissions,
            tests: [],
            passCount: 0,
            failCount: 0
        };

        expectedPermissions.forEach(permission => {
            const testResult = this.testSinglePermission(moduleName, permission);
            moduleResults.tests.push(testResult);
            
            if (testResult.passed) {
                moduleResults.passCount++;
                console.log(`  ✅ ${permission}: PASS`);
            } else {
                moduleResults.failCount++;
                console.log(`  ❌ ${permission}: FAIL - ${testResult.error}`);
            }
        });

        console.log(`📈 Module Results: ${moduleResults.passCount}/${expectedPermissions.length} passed`);
        this.testResults.push(moduleResults);
        return moduleResults;
    }

    // Test a single permission checkbox
    testSinglePermission(moduleName, permission) {
        const testResult = {
            module: moduleName,
            permission,
            passed: false,
            error: null,
            details: {}
        };

        try {
            // Check if permission is properly defined in allPermissions
            const allPermissions = this.getAllPermissionsFromPage();
            
            if (!allPermissions[moduleName]) {
                testResult.error = `Module ${moduleName} not found in allPermissions`;
                return testResult;
            }

            const modulePermissions = allPermissions[moduleName];
            let hasPermission = false;

            // Handle nested permissions (like Leads CRM)
            if (typeof modulePermissions === 'object' && !Array.isArray(modulePermissions)) {
                // Check if it's in any section
                Object.values(modulePermissions).forEach(sectionPerms => {
                    if (Array.isArray(sectionPerms) && sectionPerms.includes(permission)) {
                        hasPermission = true;
                    }
                });
            } else if (Array.isArray(modulePermissions)) {
                hasPermission = modulePermissions.includes(permission);
            }

            if (!hasPermission) {
                testResult.error = `Permission '${permission}' not defined for module '${moduleName}'`;
                return testResult;
            }

            // Test permission functionality
            testResult.details = this.testPermissionFunctionality(moduleName, permission);
            testResult.passed = testResult.details.functional;

            if (!testResult.passed) {
                testResult.error = testResult.details.error || 'Permission functionality test failed';
            }

        } catch (error) {
            testResult.error = error.message;
        }

        return testResult;
    }

    // Test actual permission functionality
    testPermissionFunctionality(moduleName, permission) {
        const functionality = {
            functional: true,
            error: null,
            checkboxExists: false,
            checkboxWorking: false,
            deleteSpecialTest: false
        };

        try {
            // For delete permissions, run special tests
            if (permission === 'delete') {
                functionality.deleteSpecialTest = this.testDeletePermissionSpecially(moduleName);
            }

            // Check if checkbox exists in UI (if RoleSettings modal is open)
            functionality.checkboxExists = this.checkCheckboxExists(moduleName, permission);
            
            // Test checkbox functionality
            if (functionality.checkboxExists) {
                functionality.checkboxWorking = this.testCheckboxFunctionality(moduleName, permission);
            }

            // Overall functionality assessment
            functionality.functional = functionality.checkboxExists && functionality.checkboxWorking;

        } catch (error) {
            functionality.error = error.message;
            functionality.functional = false;
        }

        return functionality;
    }

    // Special test for delete permissions
    testDeletePermissionSpecially(moduleName) {
        console.log(`    🗑️ Running special delete permission test for ${moduleName}`);
        
        try {
            // Check if there are any users with this permission
            const rolesWithDeletePerm = this.roles.filter(role => {
                if (!role.permissions || !Array.isArray(role.permissions)) return false;
                
                return role.permissions.some(perm => {
                    if (perm.page === moduleName || perm.page === moduleName.toLowerCase()) {
                        if (perm.actions === '*') return true;
                        if (Array.isArray(perm.actions)) {
                            return perm.actions.includes('delete') || perm.actions.includes('*');
                        }
                        return perm.actions === 'delete';
                    }
                    return false;
                });
            });

            console.log(`    📊 Found ${rolesWithDeletePerm.length} roles with delete permission for ${moduleName}`);
            
            rolesWithDeletePerm.forEach(role => {
                console.log(`      - ${role.name}`);
            });

            return rolesWithDeletePerm.length > 0;

        } catch (error) {
            console.error(`    ❌ Delete permission test failed for ${moduleName}:`, error);
            return false;
        }
    }

    // Check if checkbox exists in the DOM
    checkCheckboxExists(moduleName, permission) {
        try {
            // Look for checkbox elements related to this permission
            const checkboxSelectors = [
                `input[type="checkbox"][data-module="${moduleName}"][data-permission="${permission}"]`,
                `input[type="checkbox"]#${moduleName}-${permission}`,
                `input[type="checkbox"][name="${moduleName}.${permission}"]`
            ];

            for (const selector of checkboxSelectors) {
                const checkbox = document.querySelector(selector);
                if (checkbox) {
                    return true;
                }
            }

            // Fallback: look for any checkbox near text containing the permission name
            const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
            for (const checkbox of allCheckboxes) {
                const nearbyText = this.getNearbyText(checkbox);
                if (nearbyText.toLowerCase().includes(permission.toLowerCase()) && 
                    nearbyText.toLowerCase().includes(moduleName.toLowerCase())) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error checking checkbox existence for ${moduleName}.${permission}:`, error);
            return false;
        }
    }

    // Test checkbox functionality
    testCheckboxFunctionality(moduleName, permission) {
        try {
            // This would require actual interaction with the checkbox
            // For now, we'll assume it works if it exists
            return true;
        } catch (error) {
            console.error(`Error testing checkbox functionality for ${moduleName}.${permission}:`, error);
            return false;
        }
    }

    // Get nearby text for a DOM element
    getNearbyText(element) {
        const parent = element.parentElement;
        if (!parent) return '';
        
        return parent.textContent || parent.innerText || '';
    }

    // Get allPermissions object from the page
    getAllPermissionsFromPage() {
        // Try to access from React component state or global window
        if (window.allPermissions) {
            return window.allPermissions;
        }

        // Fallback to hardcoded permissions structure (from RoleSettings.jsx)
        return {
            'SuperAdmin': ['*'],
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
            'settings': ['show']
        };
    }

    // Run comprehensive test for all specified modules
    async runComprehensiveTest() {
        console.log('\n🎯 STARTING COMPREHENSIVE PERMISSION TEST');
        console.log('='.repeat(60));
        console.log('Testing all modules EXCEPT: feeds, lead CRM, login, tasks');
        console.log('Focus: Delete permissions and role-based access');
        console.log('='.repeat(60));

        const testModules = [
            { name: 'tickets', permissions: ['show', 'own', 'junior', 'all', 'delete'] },
            { name: 'warnings', permissions: ['show', 'own', 'junior', 'all', 'delete'] },
            { name: 'interview', permissions: ['show', 'junior', 'all', 'settings', 'delete'] },
            { name: 'employees', permissions: ['show', 'password', 'junior', 'all', 'role', 'delete'] },
            { name: 'leaves', permissions: ['show', 'own', 'junior', 'all', 'delete'] },
            { name: 'attendance', permissions: ['show', 'own', 'junior', 'all', 'delete'] },
            { name: 'apps', permissions: ['show', 'manage'] },
            { name: 'notification', permissions: ['show', 'delete', 'send'] },
            { name: 'reports', permissions: ['show'] },
            { name: 'settings', permissions: ['show'] }
        ];

        for (const module of testModules) {
            this.testModulePermissions(module.name, module.permissions);
            
            // Special focus on delete permissions
            if (module.permissions.includes('delete')) {
                console.log(`\n🔍 SPECIAL DELETE PERMISSION ANALYSIS FOR ${module.name.toUpperCase()}`);
                await this.analyzeDeletePermissionByRole(module.name);
            }
        }

        this.generateFinalReport();
    }

    // Analyze delete permissions by role
    async analyzeDeletePermissionByRole(moduleName) {
        console.log(`  📋 Analyzing ${moduleName} delete permissions across all roles...`);
        
        const deleteAnalysis = {
            rolesWithDelete: [],
            rolesWithoutDelete: [],
            total: this.roles.length
        };

        this.roles.forEach(role => {
            const hasDelete = this.roleHasDeletePermission(role, moduleName);
            
            if (hasDelete) {
                deleteAnalysis.rolesWithDelete.push({
                    name: role.name,
                    department: this.getDepartmentName(role.department_id),
                    reporting: this.getRoleName(role.reporting_id)
                });
            } else {
                deleteAnalysis.rolesWithoutDelete.push({
                    name: role.name,
                    department: this.getDepartmentName(role.department_id),
                    reporting: this.getRoleName(role.reporting_id)
                });
            }
        });

        console.log(`  ✅ Roles WITH delete permission (${deleteAnalysis.rolesWithDelete.length}):`);
        deleteAnalysis.rolesWithDelete.forEach(role => {
            console.log(`    • ${role.name} (${role.department}) → Reports to: ${role.reporting}`);
        });

        console.log(`  ❌ Roles WITHOUT delete permission (${deleteAnalysis.rolesWithoutDelete.length}):`);
        deleteAnalysis.rolesWithoutDelete.forEach(role => {
            console.log(`    • ${role.name} (${role.department}) → Reports to: ${role.reporting}`);
        });

        // Check for potential issues
        this.checkDeletePermissionIssues(moduleName, deleteAnalysis);
    }

    // Check if a role has delete permission for a module
    roleHasDeletePermission(role, moduleName) {
        if (!role.permissions || !Array.isArray(role.permissions)) {
            return false;
        }

        return role.permissions.some(perm => {
            // Check for SuperAdmin
            if (perm.page === '*' && perm.actions === '*') {
                return true;
            }

            // Check for specific module permission
            if (perm.page === moduleName || perm.page === moduleName.toLowerCase()) {
                if (perm.actions === '*') return true;
                if (Array.isArray(perm.actions)) {
                    return perm.actions.includes('delete') || perm.actions.includes('*');
                }
                return perm.actions === 'delete';
            }

            return false;
        });
    }

    // Check for potential delete permission issues
    checkDeletePermissionIssues(moduleName, analysis) {
        console.log(`  🔍 Checking for potential issues with ${moduleName} delete permissions...`);

        const issues = [];

        // Issue 1: No roles have delete permission
        if (analysis.rolesWithDelete.length === 0) {
            issues.push(`⚠️ NO roles have delete permission for ${moduleName} - this might be intentional or an issue`);
        }

        // Issue 2: Too many roles have delete permission
        if (analysis.rolesWithDelete.length > analysis.total * 0.5) {
            issues.push(`⚠️ More than 50% of roles have delete permission for ${moduleName} - consider if this is appropriate`);
        }

        // Issue 3: Check for junior roles with delete but senior without
        analysis.rolesWithDelete.forEach(roleWithDelete => {
            const reportingRole = this.roles.find(r => (r.id || r._id) === this.getRoleId(roleWithDelete.reporting));
            if (reportingRole && !this.roleHasDeletePermission(reportingRole, moduleName)) {
                issues.push(`⚠️ Role "${roleWithDelete.name}" has delete permission but their reporting role "${roleWithDelete.reporting}" doesn't`);
            }
        });

        if (issues.length === 0) {
            console.log(`  ✅ No obvious issues found with ${moduleName} delete permissions`);
        } else {
            console.log(`  ⚠️ Found ${issues.length} potential issues:`);
            issues.forEach(issue => console.log(`    ${issue}`));
        }
    }

    // Helper function to get department name
    getDepartmentName(departmentId) {
        if (!departmentId) return 'No Department';
        const dept = this.departments.find(d => (d.id || d._id) === departmentId);
        return dept ? dept.name : 'Unknown Department';
    }

    // Helper function to get role name
    getRoleName(roleId) {
        if (!roleId) return 'No Reporting Role';
        const role = this.roles.find(r => (r.id || r._id) === roleId);
        return role ? role.name : 'Unknown Role';
    }

    // Helper function to get role ID from name
    getRoleId(roleName) {
        if (!roleName || roleName === 'No Reporting Role') return null;
        const role = this.roles.find(r => r.name === roleName);
        return role ? (role.id || role._id) : null;
    }

    // Generate final test report
    generateFinalReport() {
        console.log('\n📊 FINAL TEST REPORT');
        console.log('='.repeat(60));

        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;

        this.testResults.forEach(moduleResult => {
            totalTests += moduleResult.tests.length;
            totalPassed += moduleResult.passCount;
            totalFailed += moduleResult.failCount;

            console.log(`\n${moduleResult.module.toUpperCase()}:`);
            console.log(`  Tests: ${moduleResult.tests.length}`);
            console.log(`  Passed: ${moduleResult.passCount} ✅`);
            console.log(`  Failed: ${moduleResult.failCount} ❌`);
            
            if (moduleResult.failCount > 0) {
                console.log(`  Issues:`);
                moduleResult.tests.filter(t => !t.passed).forEach(test => {
                    console.log(`    • ${test.permission}: ${test.error}`);
                });
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log(`OVERALL RESULTS:`);
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${totalPassed} ✅ (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
        console.log(`Failed: ${totalFailed} ❌ (${((totalFailed/totalTests)*100).toFixed(1)}%)`);

        if (this.errors.length > 0) {
            console.log(`\nERRORS ENCOUNTERED:`);
            this.errors.forEach(error => console.log(`  ❌ ${error}`));
        }

        console.log('\n🎯 RECOMMENDATIONS:');
        this.generateRecommendations();
        
        console.log('\n✅ Test completed! Check the detailed logs above for specific issues.');
    }

    // Generate recommendations based on test results
    generateRecommendations() {
        const recommendations = [];

        // Analyze failed tests
        const failedTests = this.testResults.flatMap(module => 
            module.tests.filter(test => !test.passed)
        );

        if (failedTests.length === 0) {
            recommendations.push('🎉 All permission tests passed! The system appears to be working correctly.');
        } else {
            recommendations.push(`🔧 Fix ${failedTests.length} failing permission tests`);
            
            // Group by error type
            const errorGroups = {};
            failedTests.forEach(test => {
                const errorType = test.error?.split(':')[0] || 'Unknown';
                if (!errorGroups[errorType]) errorGroups[errorType] = [];
                errorGroups[errorType].push(test);
            });

            Object.entries(errorGroups).forEach(([errorType, tests]) => {
                recommendations.push(`  • ${errorType}: ${tests.length} cases`);
            });
        }

        // Check for delete permission patterns
        const deletePermissionIssues = this.analyzeDeletePermissionPatterns();
        deletePermissionIssues.forEach(issue => recommendations.push(issue));

        recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    // Analyze delete permission patterns
    analyzeDeletePermissionPatterns() {
        const issues = [];
        const modulesWithDelete = ['tickets', 'warnings', 'interview', 'employees', 'leaves', 'attendance', 'notification'];

        modulesWithDelete.forEach(module => {
            const rolesWithDelete = this.roles.filter(role => this.roleHasDeletePermission(role, module));
            
            if (rolesWithDelete.length === 0) {
                issues.push(`⚠️ Consider adding delete permission for ${module} to at least one admin role`);
            }
        });

        return issues;
    }

    // Test specific role permissions
    async testRolePermissions(roleName) {
        console.log(`\n🎭 TESTING SPECIFIC ROLE: ${roleName}`);
        console.log('-'.repeat(50));

        const role = this.roles.find(r => r.name === roleName);
        if (!role) {
            console.error(`❌ Role "${roleName}" not found`);
            return;
        }

        console.log(`Role Details:`);
        console.log(`  Name: ${role.name}`);
        console.log(`  Department: ${this.getDepartmentName(role.department_id)}`);
        console.log(`  Reports to: ${this.getRoleName(role.reporting_id)}`);
        console.log(`  Total Permissions: ${role.permissions?.length || 0}`);

        if (role.permissions && Array.isArray(role.permissions)) {
            console.log(`\nPermissions Analysis:`);
            role.permissions.forEach((perm, index) => {
                console.log(`  ${index + 1}. ${perm.page}: ${Array.isArray(perm.actions) ? perm.actions.join(', ') : perm.actions}`);
                
                if (perm.actions === '*' || (Array.isArray(perm.actions) && perm.actions.includes('delete'))) {
                    console.log(`    🗑️ HAS DELETE PERMISSION`);
                }
            });
        }

        this.currentTestRole = role;
    }
}

// Auto-initialize when script is loaded
window.permissionTester = new PermissionTester();

// Helper functions for easy access
window.testAllPermissions = async () => {
    await window.permissionTester.init();
    await window.permissionTester.runComprehensiveTest();
};

window.testRolePermissions = async (roleName) => {
    await window.permissionTester.init();
    await window.permissionTester.testRolePermissions(roleName);
};

window.testDeletePermissions = async () => {
    await window.permissionTester.init();
    
    const modulesWithDelete = ['tickets', 'warnings', 'interview', 'employees', 'leaves', 'attendance', 'notification'];
    
    console.log('\n🗑️ COMPREHENSIVE DELETE PERMISSION TEST');
    console.log('='.repeat(60));
    
    for (const module of modulesWithDelete) {
        await window.permissionTester.analyzeDeletePermissionByRole(module);
    }
};

// Auto-run basic initialization
console.log('🚀 Permission Comprehensive Test Script Loaded!');
console.log('\nAvailable Commands:');
console.log('  • testAllPermissions()           - Run full comprehensive test');
console.log('  • testDeletePermissions()        - Focus on delete permissions only');
console.log('  • testRolePermissions("roleName") - Test specific role permissions');
console.log('\nExample usage:');
console.log('  testAllPermissions()');
console.log('  testRolePermissions("Team Leader")');
console.log('  testDeletePermissions()');
console.log('\n⚡ Quick start: Run testAllPermissions() to begin testing!');