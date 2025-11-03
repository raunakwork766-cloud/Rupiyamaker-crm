// 🔧 TEAM LEADER SELECT BUTTON PERMISSION FIX - CLEAR CACHE UTILITY
// This script helps clear cached permissions when you've changed role permissions in Settings

/**
 * How to use this script:
 * 
 * 1. Open browser console (F12)
 * 2. Paste this entire script
 * 3. Run: clearPermissionCache()
 * 4. Logout and login again
 */

function clearPermissionCache() {
    console.log('🧹 Clearing permission cache...');
    
    // Clear all permission-related data from localStorage
    const keysToRemove = [
        'userPermissions',
        'userRoleId',
        'roleName',
        'permissions'
    ];
    
    let removed = [];
    keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            removed.push(key);
        }
    });
    
    console.log('✅ Cleared:', removed.join(', '));
    console.log('⚠️  Please LOGOUT and LOGIN again to load fresh permissions');
    
    // Show alert
    alert(`✅ Permission cache cleared!\n\nCleared items:\n${removed.join('\n')}\n\nPlease LOGOUT and LOGIN again.`);
}

// Auto-clear function that can be called directly
function autoFixTeamLeaderPermissions() {
    console.log('🔧 Auto-fixing Team Leader permissions...');
    
    // Check if user is a team leader
    const designation = localStorage.getItem('designation')?.toLowerCase() || '';
    const isTeamLeader = designation.includes('team leader') || designation.includes('tl');
    
    if (isTeamLeader) {
        console.log('👤 Detected Team Leader designation');
        
        // Clear permissions
        clearPermissionCache();
        
        console.log('✅ Team Leader permission cache cleared');
        console.log('📝 Next steps:');
        console.log('   1. Logout completely');
        console.log('   2. Admin: Verify Settings → Roles and Permissions → Team Leader role');
        console.log('   3. Admin: Ensure "delete" is UNCHECKED under Leads section');
        console.log('   4. Login again');
    } else {
        console.log('ℹ️  Not a Team Leader. Current designation:', localStorage.getItem('designation'));
        console.log('💡 You can still clear cache if needed by running: clearPermissionCache()');
    }
}

// Check current permissions
function checkCurrentPermissions() {
    console.log('🔍 Current Permission Status:');
    console.log('================================');
    
    const username = localStorage.getItem('username');
    const designation = localStorage.getItem('designation');
    const role = localStorage.getItem('userRole') || localStorage.getItem('roleName');
    const permissions = localStorage.getItem('userPermissions');
    
    console.log('👤 Username:', username);
    console.log('🏷️  Designation:', designation);
    console.log('🎭 Role:', role);
    
    if (permissions) {
        try {
            const parsed = JSON.parse(permissions);
            console.log('📋 Permissions:', parsed);
            
            // Check for leads delete permission
            if (Array.isArray(parsed)) {
                const leadsPerms = parsed.find(p => p.page === 'Leads' || p.page === 'leads');
                if (leadsPerms) {
                    console.log('🔓 Leads Permissions:', leadsPerms.actions);
                    
                    if (Array.isArray(leadsPerms.actions)) {
                        const hasDelete = leadsPerms.actions.includes('delete');
                        console.log('❌ Delete Permission:', hasDelete ? '✅ YES (GRANTED)' : '❌ NO (DENIED)');
                        
                        if (hasDelete) {
                            console.warn('⚠️  WARNING: This user has DELETE permission!');
                            console.warn('💡 To remove: Settings → Roles and Permissions → [Role] → Uncheck "delete"');
                        }
                    }
                }
            } else if (typeof parsed === 'object') {
                const leadsPerms = parsed['Leads'] || parsed['leads'];
                if (leadsPerms) {
                    console.log('🔓 Leads Permissions:', leadsPerms);
                    
                    if (Array.isArray(leadsPerms)) {
                        const hasDelete = leadsPerms.includes('delete');
                        console.log('❌ Delete Permission:', hasDelete ? '✅ YES (GRANTED)' : '❌ NO (DENIED)');
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error parsing permissions:', e);
        }
    } else {
        console.log('⚠️  No permissions found in cache');
    }
    
    console.log('================================');
}

// Export functions for console use
console.log('✅ Permission Cache Utilities Loaded');
console.log('');
console.log('Available commands:');
console.log('  clearPermissionCache()          - Clear permission cache');
console.log('  autoFixTeamLeaderPermissions()  - Auto-fix for Team Leaders');
console.log('  checkCurrentPermissions()       - Check current permission status');
console.log('');
console.log('Quick Start: Run autoFixTeamLeaderPermissions()');
