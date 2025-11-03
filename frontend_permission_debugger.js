/**
 * Frontend Lead Delete Permission Debugger
 * Use this in browser console to debug permission issues
 */

window.debugLeadPermissions = {
    
    // Check current user permissions
    checkCurrentUserPermissions() {
        console.log('🔍 CURRENT USER PERMISSIONS DEBUG');
        console.log('================================');
        
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        const userPermissions = localStorage.getItem('userPermissions');
        const userData = localStorage.getItem('userData');
        
        console.log('📋 Stored Data:');
        console.log('  - userId:', userId);
        console.log('  - token:', token ? 'Present' : 'Missing');
        console.log('  - userPermissions:', userPermissions);
        
        if (userData) {
            try {
                const parsedUserData = JSON.parse(userData);
                console.log('  - userData:', parsedUserData);
            } catch (e) {
                console.log('  - userData: Error parsing JSON');
            }
        }
        
        if (userPermissions) {
            try {
                const parsedPermissions = JSON.parse(userPermissions);
                console.log('📋 Parsed Permissions:');
                console.log(parsedPermissions);
                
                // Check for leads permissions specifically
                const leadsPermissions = parsedPermissions.find(p => 
                    p.page === 'Leads' || p.page === 'leads' || p.page === 'Lead'
                );
                
                if (leadsPermissions) {
                    console.log('✅ Found Leads Permissions:');
                    console.log('  - page:', leadsPermissions.page);
                    console.log('  - actions:', leadsPermissions.actions);
                    console.log('  - actions type:', typeof leadsPermissions.actions);
                    
                    const hasDeletePermission = 
                        leadsPermissions.actions === '*' ||
                        (Array.isArray(leadsPermissions.actions) && 
                         (leadsPermissions.actions.includes('delete') || leadsPermissions.actions.includes('*'))) ||
                        leadsPermissions.actions === 'delete';
                    
                    console.log('  - has delete permission:', hasDeletePermission);
                } else {
                    console.log('❌ No Leads Permissions Found');
                    console.log('Available permission pages:', parsedPermissions.map(p => p.page));
                }
            } catch (e) {
                console.log('❌ Error parsing userPermissions:', e);
            }
        }
        
        return {
            userId,
            hasToken: !!token,
            permissions: userPermissions ? JSON.parse(userPermissions) : null,
            userData: userData ? JSON.parse(userData) : null
        };
    },
    
    // Test delete permission for a specific lead
    async testDeletePermission(leadId) {
        console.log(`🧪 TESTING DELETE PERMISSION FOR LEAD: ${leadId}`);
        console.log('================================================');
        
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        
        if (!userId || !token) {
            console.error('❌ Missing userId or token');
            return false;
        }
        
        try {
            // First check backend permissions
            console.log('🔍 Checking backend permissions...');
            const permResponse = await fetch(`https://rupiyamaker.com:8049/users/permissions/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (permResponse.ok) {
                const backendPermissions = await permResponse.json();
                console.log('📋 Backend Permissions:', backendPermissions);
                
                const leadsPermissions = backendPermissions.find(p => 
                    p.page === 'Leads' || p.page === 'leads'
                );
                
                if (leadsPermissions) {
                    console.log('✅ Leads Permissions Found:', leadsPermissions);
                    const hasDelete = leadsPermissions.actions === '*' || 
                        (Array.isArray(leadsPermissions.actions) && 
                         (leadsPermissions.actions.includes('delete') || leadsPermissions.actions.includes('*')));
                    console.log('🔐 Has Delete Permission:', hasDelete);
                } else {
                    console.log('❌ No Leads Permissions in Backend Response');
                }
            } else {
                console.error('❌ Failed to fetch backend permissions:', permResponse.status);
            }
            
            // Test actual delete request (dry run - will show what would happen)
            console.log('🧪 Testing actual DELETE request...');
            const deleteUrl = `https://rupiyamaker.com:8049/leads/${leadId}?user_id=${userId}`;
            console.log('📝 DELETE URL:', deleteUrl);
            
            // Don't actually delete - just test the headers and show what would be sent
            console.log('📤 Request Headers that would be sent:');
            console.log('  - Authorization: Bearer ' + (token ? token.substring(0, 20) + '...' : 'Missing'));
            console.log('  - Content-Type: application/json');
            console.log('  - X-User-ID:', userId);
            
            console.log('⚠️  To actually test delete (DANGEROUS), run: window.debugLeadPermissions.actualDeleteTest("' + leadId + '")');
            
            return true;
        } catch (error) {
            console.error('❌ Error testing delete permission:', error);
            return false;
        }
    },
    
    // Actual delete test (dangerous - will actually attempt to delete)
    async actualDeleteTest(leadId) {
        console.log(`⚠️  ACTUAL DELETE TEST FOR LEAD: ${leadId}`);
        console.log('======================================');
        console.log('🚨 WARNING: This will attempt to actually delete the lead!');
        
        if (!confirm(`Are you sure you want to test deleting lead ${leadId}? This action cannot be undone!`)) {
            console.log('❌ Test cancelled by user');
            return;
        }
        
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`https://rupiyamaker.com:8049/leads/${leadId}?user_id=${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                }
            });
            
            console.log('📤 Response Status:', response.status, response.statusText);
            
            if (response.ok) {
                console.log('✅ DELETE SUCCESS');
                const result = await response.json();
                console.log('📋 Response:', result);
            } else {
                console.log('❌ DELETE FAILED');
                const errorText = await response.text();
                console.log('📋 Error Response:', errorText);
                
                if (response.status === 403) {
                    console.log('🔐 Permission Issue Detected');
                    this.suggestPermissionFix();
                }
            }
        } catch (error) {
            console.error('❌ Network Error:', error);
        }
    },
    
    // Suggest permission fixes
    suggestPermissionFix() {
        console.log('\n🔧 PERMISSION FIX SUGGESTIONS:');
        console.log('===============================');
        console.log('');
        console.log('1. Check if user has delete permission:');
        console.log('   db.users.find({"_id": ObjectId("USER_ID")}, {"permissions": 1, "role": 1})');
        console.log('');
        console.log('2. Required permission formats:');
        console.log('   {"page": "Leads", "actions": "*"}  # Full admin');
        console.log('   {"page": "Leads", "actions": ["delete"]}  # Specific delete');
        console.log('   {"page": "*", "actions": "*"}  # Super admin');
        console.log('');
        console.log('3. Check if user created the lead:');
        console.log('   db.leads.find({"_id": ObjectId("LEAD_ID")}, {"created_by": 1})');
        console.log('');
        console.log('4. Update user permissions:');
        console.log('   db.users.updateOne(');
        console.log('     {"_id": ObjectId("USER_ID")},');
        console.log('     {"$push": {"permissions": {"page": "Leads", "actions": ["delete"]}}}');
        console.log('   )');
    },
    
    // Get permission summary
    getPermissionSummary() {
        const data = this.checkCurrentUserPermissions();
        
        if (!data.permissions) {
            return 'No permissions found';
        }
        
        const leadsPerms = data.permissions.find(p => 
            p.page === 'Leads' || p.page === 'leads'
        );
        
        if (!leadsPerms) {
            return 'No leads permissions found';
        }
        
        const hasDelete = 
            leadsPerms.actions === '*' ||
            (Array.isArray(leadsPerms.actions) && 
             (leadsPerms.actions.includes('delete') || leadsPerms.actions.includes('*'))) ||
            leadsPerms.actions === 'delete';
        
        return {
            hasLeadsPermission: true,
            canDelete: hasDelete,
            actions: leadsPerms.actions,
            recommendation: hasDelete ? 'Should be able to delete leads' : 'Cannot delete leads - missing delete permission'
        };
    }
};

// Auto-run basic check when loaded
console.log('🚀 Lead Permission Debugger Loaded');
console.log('Available commands:');
console.log('  - window.debugLeadPermissions.checkCurrentUserPermissions()');
console.log('  - window.debugLeadPermissions.testDeletePermission("leadId")');
console.log('  - window.debugLeadPermissions.getPermissionSummary()');
console.log('');
console.log('Quick Summary:', window.debugLeadPermissions.getPermissionSummary());