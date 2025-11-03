import React, { useState, useEffect } from 'react';
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canViewOwn,
  getCurrentUserId,
  getUserPermissions,
  isSuperAdmin 
} from '../utils/permissions';

const PermissionTest = () => {
  const [userData, setUserData] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    // Get data from localStorage
    const storedUserData = localStorage.getItem('userData');
    const storedPermissions = localStorage.getItem('userPermissions');
    
    if (storedUserData) {
      try {
        setUserData(JSON.parse(storedUserData));
      } catch (e) {
        console.error('Error parsing userData:', e);
      }
    }
    
    if (storedPermissions) {
      try {
        setUserPermissions(JSON.parse(storedPermissions));
      } catch (e) {
        console.error('Error parsing userPermissions:', e);
      }
    }
    
    // Run permission tests
    const results = {
      getCurrentUserId: getCurrentUserId(),
      getUserPermissions: getUserPermissions(),
      isSuperAdmin: isSuperAdmin(),
      warnings: {
        permissionLevel: getPermissionLevel('warnings'),
        canViewAll: canViewAll('warnings'),
        canViewJunior: canViewJunior('warnings'),
        canViewOwn: canViewOwn('warnings')
      },
      users: {
        permissionLevel: getPermissionLevel('users'),
        canViewAll: canViewAll('users'),
        canViewJunior: canViewJunior('users'),
        canViewOwn: canViewOwn('users')
      },
      attendance: {
        permissionLevel: getPermissionLevel('attendance'),
        canViewAll: canViewAll('attendance'),
        canViewJunior: canViewJunior('attendance'),
        canViewOwn: canViewOwn('attendance')
      },
      leaves: {
        permissionLevel: getPermissionLevel('leaves'),
        canViewAll: canViewAll('leaves'),
        canViewJunior: canViewJunior('leaves'),
        canViewOwn: canViewOwn('leaves')
      }
    };
    
    setTestResults(results);
    
    // Log everything to console
    console.log('=== PERMISSION TEST RESULTS ===');
    console.log('userData:', userData);
    console.log('userPermissions:', userPermissions);
    console.log('testResults:', results);
    console.log('===============================');
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Permission System Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Data */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">User Data</h2>
          <pre className="text-sm bg-white p-3 rounded border overflow-auto max-h-40">
            {JSON.stringify(userData, null, 2)}
          </pre>
        </div>
        
        {/* User Permissions */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">User Permissions</h2>
          <pre className="text-sm bg-white p-3 rounded border overflow-auto max-h-40">
            {JSON.stringify(userPermissions, null, 2)}
          </pre>
        </div>
        
        {/* Test Results */}
        <div className="bg-blue-50 p-4 rounded-lg md:col-span-2">
          <h2 className="text-lg font-semibold mb-3 text-blue-700">Permission Test Results</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">General</h3>
              <ul className="text-sm space-y-1">
                <li><strong>User ID:</strong> {testResults.getCurrentUserId}</li>
                <li><strong>Is Super Admin:</strong> {testResults.isSuperAdmin ? '✅ Yes' : '❌ No'}</li>
              </ul>
            </div>
            
            {['warnings', 'users', 'attendance', 'leaves'].map(module => (
              <div key={module}>
                <h3 className="font-medium mb-2 capitalize">{module} Module</h3>
                <ul className="text-sm space-y-1">
                  <li><strong>Level:</strong> {testResults[module]?.permissionLevel}</li>
                  <li><strong>View All:</strong> {testResults[module]?.canViewAll ? '✅' : '❌'}</li>
                  <li><strong>View Junior:</strong> {testResults[module]?.canViewJunior ? '✅' : '❌'}</li>
                  <li><strong>View Own:</strong> {testResults[module]?.canViewOwn ? '✅' : '❌'}</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">Instructions</h3>
        <p className="text-sm text-yellow-700">
          Open your browser's developer console (F12) to see detailed permission logs. 
          Check the console output for the complete permission analysis.
        </p>
      </div>
    </div>
  );
};

export default PermissionTest;
