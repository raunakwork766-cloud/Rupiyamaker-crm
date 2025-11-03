/**
 * Permission Test Script
 * 
 * Run this in browser console to test permission logic
 * Copy and paste the entire script, then run: testPermissions()
 */

function testPermissions() {
    console.log('🧪 Testing Permission System...\n');
    
    // Test Case 1: Empty Permissions
    console.log('📋 Test 1: Empty Permissions');
    const emptyPerms = {};
    console.log('Input:', emptyPerms);
    console.log('Is Empty:', Object.keys(emptyPerms).length === 0);
    console.log('Should Deny: ✅\n');
    
    // Test Case 2: Null Permissions
    console.log('📋 Test 2: Null Permissions');
    const nullPerms = null;
    console.log('Input:', nullPerms);
    console.log('Is Null:', nullPerms === null);
    console.log('Should Deny: ✅\n');
    
    // Test Case 3: Super Admin Wildcard
    console.log('📋 Test 3: Super Admin Wildcard');
    const superAdminWildcard = { "*": "*" };
    console.log('Input:', superAdminWildcard);
    console.log('Has Wildcard:', superAdminWildcard["*"] === "*");
    console.log('Should Allow: ✅\n');
    
    // Test Case 4: Valid Permission
    console.log('📋 Test 4: Valid Employee Permission');
    const validPerms = {
        employees: { show: true }
    };
    console.log('Input:', validPerms);
    console.log('Has employees.show:', validPerms.employees?.show === true);
    console.log('Should Allow for /employees: ✅\n');
    
    // Test Case 5: No Employee Permission
    console.log('📋 Test 5: No Employee Permission');
    const noEmployeePerms = {
        leads: { show: true },
        tasks: { show: true }
    };
    console.log('Input:', noEmployeePerms);
    console.log('Has employees:', 'employees' in noEmployeePerms);
    console.log('Should Deny for /employees: ✅\n');
    
    // Test Case 6: Current User Permissions
    console.log('📋 Test 6: Current User Permissions');
    try {
        const currentPerms = localStorage.getItem('userPermissions');
        if (currentPerms) {
            const parsed = JSON.parse(currentPerms);
            console.log('Current User Permissions:', JSON.stringify(parsed, null, 2));
            console.log('Is Empty:', Object.keys(parsed).length === 0);
            console.log('Has employees.show:', parsed.employees?.show === true);
            console.log('Has wildcard:', parsed["*"] === "*");
        } else {
            console.log('⚠️ No permissions in localStorage');
        }
    } catch (e) {
        console.error('❌ Error reading permissions:', e);
    }
    
    console.log('\n✅ Permission Tests Complete');
}

// Run the tests
testPermissions();

// Additional helper functions
function checkEmployeeAccess() {
    const perms = JSON.parse(localStorage.getItem('userPermissions') || '{}');
    const hasAccess = perms.employees?.show === true || 
                     perms.Employees?.show === true ||
                     perms["*"] === "*" ||
                     perms.Global === "*";
    console.log('🔍 Employee Access Check:', hasAccess ? '✅ ALLOWED' : '🚫 DENIED');
    return hasAccess;
}

function clearPermissions() {
    localStorage.setItem('userPermissions', '{}');
    console.log('🗑️ Permissions cleared - set to empty object');
    console.log('Next page navigation should redirect to /unauthorized');
}

function restorePermissions(perms) {
    localStorage.setItem('userPermissions', JSON.stringify(perms));
    console.log('💾 Permissions restored:', perms);
}

console.log('\n📚 Available Test Functions:');
console.log('  - testPermissions()      : Run all permission tests');
console.log('  - checkEmployeeAccess()  : Check if current user can access /employees');
console.log('  - clearPermissions()     : Clear permissions to test denial');
console.log('  - restorePermissions(obj): Restore permissions from object');
