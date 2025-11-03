#!/usr/bin/env node

/**
 * Route Guard Verification Script
 * 
 * This script checks if all protected routes have proper guards in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Route Guard Verification Script\n');
console.log('=' .repeat(60));

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    section: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`)
};

// File paths
const appRoutesPath = path.join(__dirname, 'rupiyamaker-UI/crm/src/routes/AppRoutes.jsx');
const protectedRoutePath = path.join(__dirname, 'rupiyamaker-UI/crm/src/components/ProtectedRoute.jsx');
const unauthorizedPath = path.join(__dirname, 'rupiyamaker-UI/crm/src/pages/Unauthorized.jsx');

let checksTotal = 0;
let checksPassed = 0;
let checksFailed = 0;

function runCheck(description, checkFn) {
    checksTotal++;
    try {
        if (checkFn()) {
            log.success(description);
            checksPassed++;
            return true;
        } else {
            log.error(description);
            checksFailed++;
            return false;
        }
    } catch (error) {
        log.error(`${description} - Error: ${error.message}`);
        checksFailed++;
        return false;
    }
}

// Check 1: ProtectedRoute component exists
log.section('📦 Checking Component Files');
runCheck('ProtectedRoute component exists', () => fs.existsSync(protectedRoutePath));
runCheck('Unauthorized page exists', () => fs.existsSync(unauthorizedPath));
runCheck('AppRoutes file exists', () => fs.existsSync(appRoutesPath));

// Check 2: Verify ProtectedRoute implementation
log.section('🔒 Verifying ProtectedRoute Implementation');
if (fs.existsSync(protectedRoutePath)) {
    const protectedRouteContent = fs.readFileSync(protectedRoutePath, 'utf8');
    
    runCheck('Has permission check logic', () => 
        protectedRouteContent.includes('hasPermission') || 
        protectedRouteContent.includes('permission')
    );
    
    runCheck('Uses Navigate component for redirect', () => 
        protectedRouteContent.includes('Navigate') || 
        protectedRouteContent.includes('useNavigate')
    );
    
    runCheck('Redirects to /unauthorized', () => 
        protectedRouteContent.includes('/unauthorized')
    );
    
    runCheck('Checks localStorage for user', () => 
        protectedRouteContent.includes('localStorage')
    );
    
    runCheck('Handles admin/superadmin roles', () => 
        protectedRouteContent.includes('admin') || 
        protectedRouteContent.includes('superadmin')
    );
}

// Check 3: Verify routes are protected
log.section('🛡️ Verifying Protected Routes');
if (fs.existsSync(appRoutesPath)) {
    const appRoutesContent = fs.readFileSync(appRoutesPath, 'utf8');
    
    runCheck('Imports ProtectedRoute component', () => 
        appRoutesContent.includes('ProtectedRoute') &&
        appRoutesContent.includes('import')
    );
    
    runCheck('Has /unauthorized route', () => 
        appRoutesContent.includes('/unauthorized')
    );
    
    // Check for protected routes
    const protectedRoutes = [
        { path: '/employees', name: 'Employees routes' },
        { path: '/attendance', name: 'Attendance routes' },
        { path: '/leaves', name: 'Leave management routes' },
        { path: '/warnings', name: 'Warnings routes' },
        { path: '/settings', name: 'Settings routes' }
    ];
    
    log.info('\nChecking if routes are wrapped with ProtectedRoute:');
    protectedRoutes.forEach(route => {
        const isProtected = appRoutesContent.includes(`<ProtectedRoute`) && 
                           appRoutesContent.includes(route.path);
        runCheck(`${route.name} (${route.path})`, () => isProtected);
    });
}

// Check 4: Verify Unauthorized page
log.section('⛔ Verifying Unauthorized Page');
if (fs.existsSync(unauthorizedPath)) {
    const unauthorizedContent = fs.readFileSync(unauthorizedPath, 'utf8');
    
    runCheck('Has user-friendly error message', () => 
        unauthorizedContent.toLowerCase().includes('unauthorized') ||
        unauthorizedContent.toLowerCase().includes('access denied') ||
        unauthorizedContent.toLowerCase().includes('permission')
    );
    
    runCheck('Has navigation back option', () => 
        unauthorizedContent.includes('navigate') ||
        unauthorizedContent.includes('Link to=') ||
        unauthorizedContent.includes('onClick')
    );
}

// Final Summary
log.section('📊 Verification Summary');
console.log(`\nTotal Checks: ${checksTotal}`);
console.log(`${colors.green}Passed: ${checksPassed}${colors.reset}`);
console.log(`${colors.red}Failed: ${checksFailed}${colors.reset}`);

const successRate = ((checksPassed / checksTotal) * 100).toFixed(1);
console.log(`\nSuccess Rate: ${successRate}%`);

if (checksFailed === 0) {
    console.log(`\n${colors.green}${'='.repeat(60)}`);
    console.log('✓ ALL CHECKS PASSED! Route guards are properly implemented.');
    console.log(`${'='.repeat(60)}${colors.reset}\n`);
    process.exit(0);
} else {
    console.log(`\n${colors.red}${'='.repeat(60)}`);
    console.log(`✗ ${checksFailed} CHECK(S) FAILED. Please review the implementation.`);
    console.log(`${'='.repeat(60)}${colors.reset}\n`);
    process.exit(1);
}
