/**
 * 🔍 INSTANT PERMISSION DIAGNOSTIC TOOL
 * 
 * Copy this entire script and paste it into the browser console (F12)
 * while logged in as RM018 or any user
 * 
 * This will instantly show if permissions are the problem
 */

(function() {
    console.clear();
    console.log('%c🔐 PERMISSION DIAGNOSTIC TOOL', 'font-size: 20px; color: #4CAF50; font-weight: bold;');
    console.log('%c=========================================', 'color: #2196F3;');
    
    // Get all auth data
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const permissionsStr = localStorage.getItem('userPermissions');
    
    console.log('\n📋 AUTHENTICATION STATUS:');
    console.log('├─ User ID:', userId || '❌ NOT FOUND');
    console.log('├─ Token exists:', token ? '✅ YES' : '❌ NO');
    console.log('└─ Token length:', token ? token.length : 0);
    
    // Parse permissions
    let permissions = null;
    try {
        permissions = permissionsStr ? JSON.parse(permissionsStr) : null;
    } catch (e) {
        console.error('❌ ERROR parsing permissions:', e);
    }
    
    console.log('\n🔑 PERMISSIONS ANALYSIS:');
    console.log('├─ Permissions string:', permissionsStr || '❌ NOT FOUND');
    console.log('├─ Parsed permissions:', permissions);
    console.log('├─ Type:', typeof permissions);
    console.log('├─ Is null:', permissions === null);
    console.log('├─ Is empty object:', permissions && typeof permissions === 'object' && Object.keys(permissions).length === 0);
    console.log('└─ Keys:', permissions ? Object.keys(permissions) : []);
    
    // Check specific permissions
    console.log('\n📊 PERMISSION CHECKS:');
    
    // Check employees permission
    const hasEmployeesShow = permissions?.employees?.show === true;
    const hasEmployeesAny = permissions?.employees !== undefined;
    const hasEmployeesCapital = permissions?.Employees?.show === true;
    const hasWildcard = permissions?.['*'] === '*';
    const hasGlobalWildcard = permissions?.Global === '*' || permissions?.global === '*';
    
    console.log('Employees Permissions:');
    console.log('├─ employees.show:', hasEmployeesShow ? '✅ YES' : '❌ NO');
    console.log('├─ Employees.show (capital):', hasEmployeesCapital ? '✅ YES' : '❌ NO');
    console.log('├─ employees exists:', hasEmployeesAny ? '✅ YES' : '❌ NO');
    console.log('├─ Wildcard (*):', hasWildcard ? '✅ YES' : '❌ NO');
    console.log('└─ Global wildcard:', hasGlobalWildcard ? '✅ YES' : '❌ NO');
    
    // Determine access
    const shouldHaveAccess = hasEmployeesShow || hasEmployeesCapital || hasWildcard || hasGlobalWildcard;
    
    console.log('\n🎯 ACCESS VERDICT:');
    if (!token || !userId) {
        console.log('%c❌ NOT AUTHENTICATED - Should redirect to LOGIN', 'color: #f44336; font-weight: bold; font-size: 14px;');
    } else if (!permissions || (typeof permissions === 'object' && Object.keys(permissions).length === 0)) {
        console.log('%c🚫 NO PERMISSIONS - Should redirect to UNAUTHORIZED page', 'color: #ff9800; font-weight: bold; font-size: 14px;');
        console.log('%cExpected: /unauthorized page with lock icon', 'color: #ff9800;');
    } else if (shouldHaveAccess) {
        console.log('%c✅ HAS PERMISSION - Should access Employees page', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    } else {
        console.log('%c🚫 NO EMPLOYEE PERMISSION - Should redirect to UNAUTHORIZED', 'color: #ff9800; font-weight: bold; font-size: 14px;');
    }
    
    // Show all permissions
    if (permissions && Object.keys(permissions).length > 0) {
        console.log('\n📜 ALL PERMISSIONS:');
        console.log(JSON.stringify(permissions, null, 2));
    }
    
    // Test functions
    console.log('\n🛠️ AVAILABLE TEST COMMANDS:');
    console.log('Type these commands in console to test:');
    console.log('');
    console.log('testEmptyPermissions()  - Test with empty permissions');
    console.log('testWithPermissions()   - Test with employees permission');
    console.log('clearAndReload()        - Clear permissions and reload');
    console.log('showCurrentState()      - Show this diagnostic again');
    
    // Define test functions globally
    window.testEmptyPermissions = function() {
        console.log('🧪 Setting empty permissions...');
        localStorage.setItem('userPermissions', '{}');
        console.log('✅ Done! Navigate to /employees to test');
        console.log('Expected: Should redirect to /unauthorized');
    };
    
    window.testWithPermissions = function() {
        console.log('🧪 Setting employees permissions...');
        localStorage.setItem('userPermissions', JSON.stringify({
            employees: { show: true }
        }));
        console.log('✅ Done! Navigate to /employees to test');
        console.log('Expected: Should show employees page');
    };
    
    window.clearAndReload = function() {
        console.log('🗑️ Clearing permissions and reloading...');
        localStorage.setItem('userPermissions', '{}');
        setTimeout(() => location.reload(), 500);
    };
    
    window.showCurrentState = function() {
        location.reload();
    };
    
    console.log('\n%c=========================================', 'color: #2196F3;');
    console.log('%c✅ Diagnostic Complete', 'color: #4CAF50; font-weight: bold;');
    console.log('%c=========================================', 'color: #2196F3;');
    
    // Return summary object
    return {
        userId,
        hasToken: !!token,
        permissions,
        isEmpty: !permissions || Object.keys(permissions).length === 0,
        canAccessEmployees: shouldHaveAccess,
        verdict: !token || !userId ? 'NOT_AUTHENTICATED' : 
                !permissions || Object.keys(permissions).length === 0 ? 'NO_PERMISSIONS' :
                shouldHaveAccess ? 'HAS_ACCESS' : 'NO_ACCESS'
    };
})();
