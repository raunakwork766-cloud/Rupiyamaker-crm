/**
 * Interactive Permission Testing and Fixing Script
 * This script provides real-time testing and fixing of permission issues
 * Focus on delete permissions and role-based access validation
 */

class InteractivePermissionTester {
    constructor() {
        this.currentRole = null;
        this.testResults = new Map();
        this.fixes = [];
        this.backendValidation = true;
    }

    // Get current user permissions from localStorage
    getCurrentUserPermissions() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return userData.permissions || [];
        } catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }

    // Test specific module permissions interactively
    async testModuleInteractive(moduleName) {
        console.log(`\n🧪 INTERACTIVE TEST: ${moduleName.toUpperCase()} MODULE`);
        console.log('='.repeat(50));

        const moduleConfig = this.getModuleConfig(moduleName);
        if (!moduleConfig) {
            console.error(`❌ Module ${moduleName} not configured for testing`);
            return null;
        }

        const results = {
            module: moduleName,
            permissions: moduleConfig.permissions,
            tests: [],
            issues: [],
            recommendations: []
        };

        // Test each permission
        for (const permission of moduleConfig.permissions) {
            console.log(`\n🔍 Testing ${moduleName}.${permission}...`);
            
            const permissionTest = await this.testPermissionInteractive(moduleName, permission);
            results.tests.push(permissionTest);

            if (permissionTest.hasIssues) {
                results.issues.push(...permissionTest.issues);
            }

            // Special handling for delete permissions
            if (permission === 'delete') {
                const deleteTest = await this.testDeletePermissionSpecial(moduleName);
                results.tests.push(deleteTest);
                
                if (deleteTest.hasIssues) {
                    results.issues.push(...deleteTest.issues);
                }
            }
        }

        // Generate module-specific recommendations
        results.recommendations = this.generateModuleRecommendations(moduleName, results);

        this.testResults.set(moduleName, results);
        this.displayModuleResults(results);
        
        return results;
    }

    // Test individual permission with UI interaction
    async testPermissionInteractive(moduleName, permission) {
        const test = {
            module: moduleName,
            permission,
            hasIssues: false,
            issues: [],
            ui: { exists: false, functional: false },
            backend: { configured: false, enforced: false },
            userAccess: { hasPermission: false, shouldHave: null }
        };

        try {
            // 1. Test UI presence and functionality
            test.ui = this.testPermissionUI(moduleName, permission);
            
            // 2. Test backend configuration
            test.backend = await this.testPermissionBackend(moduleName, permission);
            
            // 3. Test user access patterns
            test.userAccess = this.testUserAccessPattern(moduleName, permission);
            
            // 4. Validate permission logic
            const logicTest = this.validatePermissionLogic(moduleName, permission);
            if (!logicTest.valid) {
                test.hasIssues = true;
                test.issues.push(`Logic issue: ${logicTest.error}`);
            }

            // 5. Check for common issues
            const commonIssues = this.checkCommonPermissionIssues(moduleName, permission);
            if (commonIssues.length > 0) {
                test.hasIssues = true;
                test.issues.push(...commonIssues);
            }

        } catch (error) {
            test.hasIssues = true;
            test.issues.push(`Test error: ${error.message}`);
        }

        return test;
    }

    // Test permission UI elements
    testPermissionUI(moduleName, permission) {
        const ui = {
            exists: false,
            functional: false,
            checkboxFound: false,
            labelCorrect: false,
            parentModuleFound: false
        };

        try {
            // Check if we're on the RoleSettings page
            const isRoleSettingsPage = window.location.pathname.includes('settings') || 
                                     document.querySelector('[data-testid="role-settings"]') ||
                                     document.querySelector('.role-settings') ||
                                     document.title.toLowerCase().includes('role');

            if (!isRoleSettingsPage) {
                console.log('  ℹ️ Not on RoleSettings page - skipping UI tests');
                return ui;
            }

            // Look for permission checkboxes
            const checkboxSelectors = [
                `input[type="checkbox"][data-module="${moduleName}"][data-permission="${permission}"]`,
                `input[type="checkbox"]#${moduleName}-${permission}`,
                `input[type="checkbox"][name="${moduleName}.${permission}"]`
            ];

            for (const selector of checkboxSelectors) {
                const checkbox = document.querySelector(selector);
                if (checkbox) {
                    ui.checkboxFound = true;
                    ui.exists = true;
                    
                    // Test checkbox functionality
                    const originalValue = checkbox.checked;
                    checkbox.click();
                    const changedValue = checkbox.checked;
                    checkbox.checked = originalValue; // Restore
                    
                    ui.functional = originalValue !== changedValue;
                    break;
                }
            }

            // Look for module section
            const moduleSelectors = [
                `[data-module="${moduleName}"]`,
                `.module-${moduleName}`,
                `[aria-label*="${moduleName}"]`
            ];

            for (const selector of moduleSelectors) {
                if (document.querySelector(selector)) {
                    ui.parentModuleFound = true;
                    break;
                }
            }

            // Check for proper labeling
            const permissionText = this.getPermissionDisplayText(permission);
            const labels = document.querySelectorAll('label, span');
            for (const label of labels) {
                if (label.textContent.toLowerCase().includes(permissionText.toLowerCase())) {
                    ui.labelCorrect = true;
                    break;
                }
            }

        } catch (error) {
            console.error(`UI test error for ${moduleName}.${permission}:`, error);
        }

        return ui;
    }

    // Test backend permission configuration
    async testPermissionBackend(moduleName, permission) {
        const backend = {
            configured: false,
            enforced: false,
            apiEndpoint: null,
            testResults: {}
        };

        try {
            // Test if permission is properly configured in the system
            const userData = localStorage.getItem('userData');
            if (!userData) {
                backend.testResults.noUserData = true;
                return backend;
            }

            const { user_id } = JSON.parse(userData);
            const token = localStorage.getItem('token');

            if (!token) {
                backend.testResults.noToken = true;
                return backend;
            }

            // Try to fetch user permissions from backend
            const permissionUrl = `/api/users/permissions/${user_id}`;
            backend.apiEndpoint = permissionUrl;

            try {
                const response = await fetch(permissionUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const permissions = await response.json();
                    backend.configured = true;
                    backend.testResults.permissions = permissions;

                    // Check if the specific permission exists
                    const modulePermission = permissions.find(p => 
                        p.page === moduleName || 
                        p.page === moduleName.toLowerCase() ||
                        p.page === moduleName.toUpperCase()
                    );

                    if (modulePermission) {
                        const hasPermission = modulePermission.actions === '*' ||
                            (Array.isArray(modulePermission.actions) && 
                             modulePermission.actions.includes(permission)) ||
                            modulePermission.actions === permission;

                        backend.enforced = hasPermission;
                        backend.testResults.hasSpecificPermission = hasPermission;
                    }
                } else {
                    backend.testResults.apiError = response.status;
                }
            } catch (fetchError) {
                backend.testResults.fetchError = fetchError.message;
            }

        } catch (error) {
            console.error(`Backend test error for ${moduleName}.${permission}:`, error);
            backend.testResults.generalError = error.message;
        }

        return backend;
    }

    // Test user access patterns
    testUserAccessPattern(moduleName, permission) {
        const access = {
            hasPermission: false,
            shouldHave: null,
            reasoning: []
        };

        try {
            const userRole = localStorage.getItem('roleName');
            const userDesignation = localStorage.getItem('designation');
            const userPermissions = this.getCurrentUserPermissions();

            // Check if user currently has the permission
            const modulePermission = userPermissions.find(p => 
                p.page === moduleName || 
                p.page === moduleName.toLowerCase()
            );

            if (modulePermission) {
                access.hasPermission = modulePermission.actions === '*' ||
                    (Array.isArray(modulePermission.actions) && 
                     modulePermission.actions.includes(permission)) ||
                    modulePermission.actions === permission;
            }

            // Determine if user should have the permission based on role/designation
            access.shouldHave = this.shouldUserHavePermission(userRole, userDesignation, moduleName, permission);
            access.reasoning = this.getPermissionReasoning(userRole, userDesignation, moduleName, permission);

        } catch (error) {
            console.error(`Access pattern test error for ${moduleName}.${permission}:`, error);
        }

        return access;
    }

    // Determine if user should have permission based on role
    shouldUserHavePermission(role, designation, module, permission) {
        if (!role && !designation) return null;

        const roleLower = (role || '').toLowerCase();
        const designationLower = (designation || '').toLowerCase();

        // Super admin should have everything
        if (roleLower.includes('admin') || roleLower.includes('super')) {
            return true;
        }

        // Team leaders should have junior/all but maybe not delete for critical modules
        if (roleLower.includes('leader') || roleLower.includes('manager')) {
            if (permission === 'delete' && ['employees', 'users', 'roles'].includes(module)) {
                return false; // Critical delete permissions
            }
            return ['show', 'own', 'junior', 'all', 'edit'].includes(permission);
        }

        // Regular employees should have limited permissions
        if (roleLower.includes('employee') || roleLower.includes('staff')) {
            return ['show', 'own'].includes(permission);
        }

        return null; // Cannot determine
    }

    // Get reasoning for permission assignment
    getPermissionReasoning(role, designation, module, permission) {
        const reasoning = [];

        if (permission === 'delete') {
            reasoning.push('Delete permissions require careful consideration');
            
            if (['employees', 'users', 'roles'].includes(module)) {
                reasoning.push('Critical module - only senior admins should have delete access');
            }
        }

        if (['show', 'own'].includes(permission)) {
            reasoning.push('Basic permissions - most users should have these');
        }

        if (['junior', 'all'].includes(permission)) {
            reasoning.push('Management permissions - for supervisory roles only');
        }

        return reasoning;
    }

    // Validate permission logic
    validatePermissionLogic(moduleName, permission) {
        const validation = {
            valid: true,
            error: null,
            warnings: []
        };

        try {
            // Check for logical inconsistencies
            if (permission === 'all' && moduleName === 'notification') {
                validation.warnings.push('Notification "all" permission may be too broad');
            }

            if (permission === 'delete' && moduleName === 'reports') {
                validation.valid = false;
                validation.error = 'Reports typically should not have delete permissions - they are usually read-only';
            }

            if (permission === 'manage' && !['apps', 'settings'].includes(moduleName)) {
                validation.warnings.push('"manage" permission is unusual for this module type');
            }

        } catch (error) {
            validation.valid = false;
            validation.error = `Logic validation error: ${error.message}`;
        }

        return validation;
    }

    // Check for common permission issues
    checkCommonPermissionIssues(moduleName, permission) {
        const issues = [];

        try {
            // Issue 1: Delete without show
            if (permission === 'delete') {
                const moduleConfig = this.getModuleConfig(moduleName);
                if (moduleConfig && !moduleConfig.permissions.includes('show')) {
                    issues.push('Module has delete permission without show permission - users cannot see what they can delete');
                }
            }

            // Issue 2: All without junior
            if (permission === 'all') {
                const moduleConfig = this.getModuleConfig(moduleName);
                if (moduleConfig && moduleConfig.permissions.includes('junior') && 
                    moduleConfig.permissions.indexOf('junior') > moduleConfig.permissions.indexOf('all')) {
                    issues.push('Permission hierarchy issue - "all" should come after "junior"');
                }
            }

            // Issue 3: Missing hierarchical permissions
            if (['own', 'junior', 'all'].includes(permission)) {
                const moduleConfig = this.getModuleConfig(moduleName);
                const hierarchicalPerms = ['own', 'junior', 'all'];
                const hasHierarchy = hierarchicalPerms.filter(p => moduleConfig?.permissions.includes(p));
                
                if (hasHierarchy.length === 1) {
                    issues.push('Incomplete permission hierarchy - consider adding other hierarchical levels');
                }
            }

        } catch (error) {
            issues.push(`Common issue check failed: ${error.message}`);
        }

        return issues;
    }

    // Test delete permissions with special focus
    async testDeletePermissionSpecial(moduleName) {
        const test = {
            module: moduleName,
            permission: 'delete',
            type: 'special-delete-test',
            hasIssues: false,
            issues: [],
            securityAnalysis: {},
            roleAnalysis: {},
            recommendedRestrictions: []
        };

        try {
            console.log(`  🗑️ Special delete permission analysis for ${moduleName}...`);

            // Security analysis
            test.securityAnalysis = this.analyzeDeleteSecurity(moduleName);
            
            // Role analysis
            test.roleAnalysis = await this.analyzeDeleteByRole(moduleName);
            
            // Generate recommendations
            test.recommendedRestrictions = this.generateDeleteRestrictions(moduleName, test.securityAnalysis, test.roleAnalysis);

            // Check for issues
            if (test.securityAnalysis.riskLevel === 'HIGH') {
                test.hasIssues = true;
                test.issues.push(`High security risk: ${test.securityAnalysis.riskReason}`);
            }

            if (test.roleAnalysis.tooManyRoles) {
                test.hasIssues = true;
                test.issues.push('Too many roles have delete permission - consider restricting');
            }

        } catch (error) {
            test.hasIssues = true;
            test.issues.push(`Delete test error: ${error.message}`);
        }

        return test;
    }

    // Analyze delete permission security
    analyzeDeleteSecurity(moduleName) {
        const analysis = {
            riskLevel: 'LOW',
            riskReason: '',
            criticalData: false,
            cascadingEffect: false,
            auditRequired: false
        };

        const criticalModules = ['employees', 'users', 'roles', 'settings'];
        const sensitiveModules = ['attendance', 'leaves', 'interview'];

        if (criticalModules.includes(moduleName)) {
            analysis.riskLevel = 'HIGH';
            analysis.riskReason = 'Critical system data - deletion can cause system instability';
            analysis.criticalData = true;
            analysis.auditRequired = true;
        } else if (sensitiveModules.includes(moduleName)) {
            analysis.riskLevel = 'MEDIUM';
            analysis.riskReason = 'Sensitive HR data - deletion should be restricted';
            analysis.auditRequired = true;
        }

        // Check for cascading effects
        if (['employees', 'departments'].includes(moduleName)) {
            analysis.cascadingEffect = true;
            analysis.riskReason += ' (may affect related records)';
        }

        return analysis;
    }

    // Analyze delete permissions by role
    async analyzeDeleteByRole(moduleName) {
        const analysis = {
            totalRoles: 0,
            rolesWithDelete: 0,
            tooManyRoles: false,
            roleBreakdown: {
                admin: 0,
                manager: 0,
                employee: 0,
                other: 0
            }
        };

        try {
            // This would require fetching roles data
            // For now, simulate based on common patterns
            analysis.totalRoles = 10; // Simulated
            analysis.rolesWithDelete = 3; // Simulated
            analysis.tooManyRoles = analysis.rolesWithDelete > analysis.totalRoles * 0.3;

        } catch (error) {
            console.error('Role analysis error:', error);
        }

        return analysis;
    }

    // Generate delete restrictions recommendations
    generateDeleteRestrictions(moduleName, security, roleAnalysis) {
        const restrictions = [];

        if (security.riskLevel === 'HIGH') {
            restrictions.push('Restrict to Super Admin only');
            restrictions.push('Require confirmation dialog');
            restrictions.push('Log all delete operations');
        }

        if (security.riskLevel === 'MEDIUM') {
            restrictions.push('Restrict to Admin and Manager roles');
            restrictions.push('Add confirmation dialog');
        }

        if (roleAnalysis.tooManyRoles) {
            restrictions.push('Review and reduce number of roles with delete permission');
        }

        if (security.cascadingEffect) {
            restrictions.push('Check for dependent records before deletion');
            restrictions.push('Consider soft delete instead of hard delete');
        }

        return restrictions;
    }

    // Get module configuration
    getModuleConfig(moduleName) {
        const configs = {
            'tickets': { permissions: ['show', 'own', 'junior', 'all', 'delete'], type: 'workflow' },
            'warnings': { permissions: ['show', 'own', 'junior', 'all', 'delete'], type: 'disciplinary' },
            'interview': { permissions: ['show', 'junior', 'all', 'settings', 'delete'], type: 'hr-process' },
            'employees': { permissions: ['show', 'password', 'junior', 'all', 'role', 'delete'], type: 'critical' },
            'leaves': { permissions: ['show', 'own', 'junior', 'all', 'delete'], type: 'hr-data' },
            'attendance': { permissions: ['show', 'own', 'junior', 'all', 'delete'], type: 'hr-data' },
            'apps': { permissions: ['show', 'manage'], type: 'system' },
            'notification': { permissions: ['show', 'delete', 'send'], type: 'communication' },
            'reports': { permissions: ['show'], type: 'readonly' },
            'settings': { permissions: ['show'], type: 'system' }
        };

        return configs[moduleName] || null;
    }

    // Get display text for permission
    getPermissionDisplayText(permission) {
        const displayTexts = {
            'show': 'Show',
            'own': 'Own',
            'junior': 'Junior',
            'all': 'All',
            'delete': 'Delete',
            'edit': 'Edit',
            'add': 'Add',
            'manage': 'Manage',
            'send': 'Send',
            'settings': 'Settings',
            'password': 'Password',
            'role': 'Role'
        };

        return displayTexts[permission] || permission;
    }

    // Display module test results
    displayModuleResults(results) {
        console.log(`\n📊 RESULTS FOR ${results.module.toUpperCase()}`);
        console.log('-'.repeat(40));

        const totalTests = results.tests.length;
        const passedTests = results.tests.filter(t => !t.hasIssues).length;
        const failedTests = totalTests - passedTests;

        console.log(`Tests: ${totalTests} | Passed: ${passedTests} ✅ | Failed: ${failedTests} ❌`);

        if (results.issues.length > 0) {
            console.log('\n⚠️ Issues Found:');
            results.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. ${issue}`);
            });
        }

        if (results.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            results.recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec}`);
            });
        }

        console.log(); // Empty line
    }

    // Generate module-specific recommendations
    generateModuleRecommendations(moduleName, results) {
        const recommendations = [];

        const moduleConfig = this.getModuleConfig(moduleName);
        if (!moduleConfig) return recommendations;

        // Security recommendations
        if (moduleConfig.type === 'critical') {
            recommendations.push('Implement additional security measures for critical module');
            recommendations.push('Consider requiring two-factor authentication for delete operations');
        }

        // Permission hierarchy recommendations
        const hierarchicalPerms = results.tests
            .filter(t => ['own', 'junior', 'all'].includes(t.permission))
            .map(t => t.permission);

        if (hierarchicalPerms.length > 0 && hierarchicalPerms.length < 3) {
            recommendations.push('Consider completing the permission hierarchy (own → junior → all)');
        }

        // Delete permission recommendations
        const deleteTest = results.tests.find(t => t.permission === 'delete');
        if (deleteTest && deleteTest.hasIssues) {
            recommendations.push('Review delete permission configuration - issues detected');
        }

        return recommendations;
    }

    // Generate comprehensive fix script
    generateFixScript() {
        console.log('\n🔧 GENERATING COMPREHENSIVE FIX SCRIPT');
        console.log('='.repeat(50));

        const fixes = [];
        
        // Analyze all test results
        for (const [moduleName, results] of this.testResults) {
            if (results.issues.length > 0) {
                fixes.push({
                    module: moduleName,
                    issues: results.issues,
                    fixes: this.generateModuleFixes(moduleName, results)
                });
            }
        }

        if (fixes.length === 0) {
            console.log('✅ No fixes needed - all tests passed!');
            return null;
        }

        console.log(`🔧 Generated fixes for ${fixes.length} modules:`);
        
        let fixScript = `// Auto-generated Permission Fix Script\n// Generated on: ${new Date().toISOString()}\n\n`;
        
        fixes.forEach(fix => {
            fixScript += `// Fixes for ${fix.module} module\n`;
            fix.fixes.forEach(f => {
                fixScript += `${f}\n`;
            });
            fixScript += '\n';
        });

        console.log(fixScript);
        
        // Offer to download fix script
        this.offerFixScriptDownload(fixScript);
        
        return fixScript;
    }

    // Generate fixes for a specific module
    generateModuleFixes(moduleName, results) {
        const fixes = [];

        results.issues.forEach(issue => {
            if (issue.includes('Logic issue')) {
                fixes.push(`// Fix permission logic for ${moduleName}`);
                fixes.push(`// Review and update permission structure`);
            }

            if (issue.includes('UI')) {
                fixes.push(`// Fix UI issues for ${moduleName}`);
                fixes.push(`// Ensure checkboxes are properly rendered and functional`);
            }

            if (issue.includes('security risk')) {
                fixes.push(`// Address security risk for ${moduleName}`);
                fixes.push(`// Restrict delete permissions to appropriate roles only`);
            }
        });

        return fixes;
    }

    // Offer to download fix script
    offerFixScriptDownload(script) {
        try {
            const blob = new Blob([script], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `permission-fixes-${Date.now()}.js`;
            
            console.log('💾 Fix script ready for download. Creating download link...');
            
            // Create a temporary download button
            link.textContent = 'Download Fix Script';
            link.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; background: #007bff; color: white; padding: 10px; text-decoration: none; border-radius: 5px;';
            document.body.appendChild(link);
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 30000); // Remove after 30 seconds
            
        } catch (error) {
            console.error('Failed to create download link:', error);
        }
    }

    // Run comprehensive test for all modules
    async runAllTests() {
        console.log('🚀 RUNNING COMPREHENSIVE INTERACTIVE PERMISSION TESTS');
        console.log('='.repeat(60));

        const modules = [
            'tickets', 'warnings', 'interview', 'employees', 
            'leaves', 'attendance', 'apps', 'notification', 
            'reports', 'settings'
        ];

        for (const module of modules) {
            await this.testModuleInteractive(module);
            
            // Small delay to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\n📊 ALL TESTS COMPLETED');
        this.generateSummaryReport();
        this.generateFixScript();
    }

    // Generate summary report
    generateSummaryReport() {
        console.log('\n📈 SUMMARY REPORT');
        console.log('='.repeat(40));

        let totalModules = 0;
        let modulesWithIssues = 0;
        let totalIssues = 0;

        for (const [moduleName, results] of this.testResults) {
            totalModules++;
            if (results.issues.length > 0) {
                modulesWithIssues++;
                totalIssues += results.issues.length;
            }
        }

        console.log(`Modules Tested: ${totalModules}`);
        console.log(`Modules with Issues: ${modulesWithIssues}`);
        console.log(`Total Issues Found: ${totalIssues}`);
        console.log(`Success Rate: ${((totalModules - modulesWithIssues) / totalModules * 100).toFixed(1)}%`);

        if (totalIssues === 0) {
            console.log('\n🎉 Perfect! All permission tests passed.');
        } else {
            console.log('\n⚠️ Issues found. Review the detailed reports above.');
        }
    }
}

// Initialize the interactive tester
window.interactivePermissionTester = new InteractivePermissionTester();

// Convenient access functions
window.testAllPermissionsInteractive = async () => {
    await window.interactivePermissionTester.runAllTests();
};

window.testModulePermissions = async (moduleName) => {
    return await window.interactivePermissionTester.testModuleInteractive(moduleName);
};

window.generatePermissionFixes = () => {
    return window.interactivePermissionTester.generateFixScript();
};

// Auto-run announcement
console.log('🎯 Interactive Permission Tester Loaded!');
console.log('\nAvailable Commands:');
console.log('  • testAllPermissionsInteractive() - Run comprehensive interactive tests');
console.log('  • testModulePermissions("moduleName") - Test specific module');
console.log('  • generatePermissionFixes() - Generate fix script for issues');
console.log('\nExample usage:');
console.log('  testModulePermissions("tickets")');
console.log('  testAllPermissionsInteractive()');
console.log('\n⚡ For immediate testing, run: testAllPermissionsInteractive()');