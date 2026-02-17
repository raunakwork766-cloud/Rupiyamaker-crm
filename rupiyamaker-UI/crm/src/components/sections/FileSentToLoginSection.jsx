import { useState, useEffect } from 'react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const FileSentToLoginSection = ({ lead, onClose, onUpdate }) => {
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loginResponse, setLoginResponse] = useState(null);
  
  // New state for department and user selection
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [usersInDepartment, setUsersInDepartment] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Fetch departments on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/departments/?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setDepartments(data);
        
        // Find login department if it exists and select it by default
        const loginDept = data.find(dept => dept.name.toLowerCase().includes('login'));
        if (loginDept) {
          setSelectedDepartment(loginDept._id);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch users when department is selected
  useEffect(() => {
    const fetchUsersInDepartment = async () => {
      if (!selectedDepartment) {
        setUsersInDepartment([]);
        setSelectedUser('');
        return;
      }

      try {
        setLoadingUsers(true);
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/users/?department_id=${selectedDepartment}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setUsersInDepartment(data);
        
        // Select the first user by default if available
        if (data.length > 0) {
          setSelectedUser(data[0]._id);
        } else {
          setSelectedUser('');
        }
      } catch (error) {
        console.error('Error fetching users in department:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsersInDepartment();
  }, [selectedDepartment]);

  const handleSendToLogin = async () => {
    if (!lead?._id) {
      setStatus('error');
      setMessage('No lead ID available');
      return;
    }
    
    if (!selectedDepartment) {
      setStatus('error');
      setMessage('Please select a department');
      return;
    }

    setLoading(true);
    setMessage('Sending lead data to Login CRM...');

    try {
      const userId = localStorage.getItem('userId');
      
      // 🔒 ENHANCED OBLIGATION DATA TRANSFER SYSTEM
      console.log('🔒 PRE-TRANSFER: Comprehensive obligation data persistence system starting...');
      
      try {
        const obligationsUrl = `${API_BASE_URL}/leads/${lead._id}/obligations?user_id=${userId}`;
        
        // Step 1: Fetch current obligation data
        const getResponse = await fetch(obligationsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        let currentObligationData = null;
        if (getResponse.ok) {
          currentObligationData = await getResponse.json();
        }

        console.log('🔒 Current obligation data analysis:', {
          hasApiData: !!(currentObligationData && Object.keys(currentObligationData).length > 0),
          hasObligations: !!(currentObligationData?.obligations && currentObligationData.obligations.length > 0),
          hasSalary: !!currentObligationData?.salary,
          hasLoanRequired: !!currentObligationData?.loanRequired,
          hasCompanyName: !!currentObligationData?.companyName,
          hasCibilScore: !!currentObligationData?.cibilScore,
          hasTenure: !!currentObligationData?.ceTenureMonths,
          hasROI: !!currentObligationData?.ceRoi,
          fieldCount: currentObligationData ? Object.keys(currentObligationData).length : 0
        });

        // Step 2: Enhanced data structure creation for Login CRM compatibility
        if (currentObligationData && Object.keys(currentObligationData).length > 0) {
          console.log('🔒 Creating enhanced obligation data structure for Login CRM...');
          
          // Create comprehensive data structure with multiple field formats
          const enhancedObligationData = {
            // Preserve all original data
            ...currentObligationData,
            
            // Add transfer metadata for tracking
            _transferMetadata: {
              originalLeadId: lead._id,
              transferDate: new Date().toISOString(),
              sourceSystem: 'LEAD_CRM',
              targetSystem: 'LOGIN_CRM',
              version: '2.0'
            },
            
            // Ensure primary fields exist in multiple formats
            salary: currentObligationData.salary || currentObligationData.monthly_income,
            monthly_income: currentObligationData.salary || currentObligationData.monthly_income,
            
            loanRequired: currentObligationData.loanRequired || currentObligationData.loan_required,
            loan_required: currentObligationData.loanRequired || currentObligationData.loan_required,
            loan_amount: currentObligationData.loanRequired || currentObligationData.loan_amount,
            
            companyName: currentObligationData.companyName || currentObligationData.company_name,
            company_name: currentObligationData.companyName || currentObligationData.company_name,
            
            // Enhanced nested structures for maximum compatibility
            dynamic_fields: {
              ...(currentObligationData.dynamic_fields || {}),
              financial_details: {
                ...(currentObligationData.dynamic_fields?.financial_details || {}),
                monthly_income: currentObligationData.salary || currentObligationData.monthly_income,
                salary: currentObligationData.salary || currentObligationData.monthly_income,
                loan_required: currentObligationData.loanRequired ? 
                  (typeof currentObligationData.loanRequired === 'string' ? 
                    parseFloat(currentObligationData.loanRequired.replace(/[₹,]/g, '')) : 
                    currentObligationData.loanRequired) : null,
                loan_amount: currentObligationData.loanRequired ? 
                  (typeof currentObligationData.loanRequired === 'string' ? 
                    parseFloat(currentObligationData.loanRequired.replace(/[₹,]/g, '')) : 
                    currentObligationData.loanRequired) : null,
                partner_salary: currentObligationData.partnerSalary,
                yearly_bonus: currentObligationData.yearlyBonus,
                cibil_score: currentObligationData.cibilScore,
              },
              personal_details: {
                ...(currentObligationData.dynamic_fields?.personal_details || {}),
                company_name: currentObligationData.companyName || currentObligationData.company_name,
                company_type: currentObligationData.companyType,
                company_category: currentObligationData.companyCategory,
              },
              obligation_data: {
                ...(currentObligationData.dynamic_fields?.obligation_data || {}),
                salary: currentObligationData.salary,
                loanRequired: currentObligationData.loanRequired,
                companyName: currentObligationData.companyName,
                obligations: currentObligationData.obligations || [],
              }
            },
            
            // Add dynamic_details structure for new Login CRM system
            dynamic_details: {
              financial_details: {
                monthly_income: currentObligationData.salary || currentObligationData.monthly_income,
                salary: currentObligationData.salary || currentObligationData.monthly_income,
                loan_required: currentObligationData.loanRequired ? 
                  (typeof currentObligationData.loanRequired === 'string' ? 
                    parseFloat(currentObligationData.loanRequired.replace(/[₹,]/g, '')) : 
                    currentObligationData.loanRequired) : null,
                partner_salary: currentObligationData.partnerSalary,
                yearly_bonus: currentObligationData.yearlyBonus,
                cibil_score: currentObligationData.cibilScore,
              },
              personal_details: {
                company_name: currentObligationData.companyName || currentObligationData.company_name,
                company_type: currentObligationData.companyType,
                company_category: currentObligationData.companyCategory,
              }
            }
          };

          // Step 3: Create transfer backup
          const transferBackup = {
            leadId: lead._id,
            timestamp: new Date().toISOString(),
            originalData: currentObligationData,
            enhancedData: enhancedObligationData,
            leadInfo: {
              name: `${lead.first_name} ${lead.last_name}`,
              mobile: lead.mobile_number || lead.phone,
              email: lead.email
            }
          };

          // Store backup in localStorage
          localStorage.setItem(`loginTransferBackup_${lead._id}`, JSON.stringify(transferBackup));
          console.log('🔒 Transfer backup created');

          // Step 4: Save enhanced data using multiple methods
          const savePromises = [];
          
          // Method 1: Primary obligations endpoint
          savePromises.push(
            fetch(obligationsUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(enhancedObligationData)
            }).then(response => ({ 
              method: 'obligations_endpoint', 
              success: response.ok, 
              status: response.status 
            })).catch(error => ({ 
              method: 'obligations_endpoint', 
              success: false, 
              error: error.message 
            }))
          );

          // Method 2: Update lead with obligation data
          savePromises.push(
            fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                obligation_data: enhancedObligationData,
                _lastObligationUpdate: new Date().toISOString(),
                _loginTransferReady: true
              })
            }).then(response => ({ 
              method: 'lead_update', 
              success: response.ok, 
              status: response.status 
            })).catch(error => ({ 
              method: 'lead_update', 
              success: false, 
              error: error.message 
            }))
          );

          // Method 3: Backup save to alternative endpoint
          savePromises.push(
            fetch(`${API_BASE_URL}/leads/${lead._id}/backup-obligations?user_id=${userId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                ...enhancedObligationData,
                _isBackup: true,
                _backupTimestamp: new Date().toISOString()
              })
            }).then(response => ({ 
              method: 'backup_endpoint', 
              success: response.ok, 
              status: response.status 
            })).catch(error => ({ 
              method: 'backup_endpoint', 
              success: false, 
              error: error.message 
            }))
          );

          // Execute all save methods
          const results = await Promise.allSettled(savePromises);
          const successful = results
            .filter(result => result.status === 'fulfilled' && result.value.success)
            .map(result => result.value);
          
          console.log('🔒 Enhanced save results:', {
            totalAttempts: savePromises.length,
            successful: successful.length,
            successfulMethods: successful.map(s => s.method),
            allResults: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
          });
          
          if (successful.length === 0) {
            console.warn('⚠️ All obligation data save methods failed, but continuing with transfer');
          } else {
            console.log(`✅ Obligation data saved successfully using ${successful.length}/${savePromises.length} methods`);
          }
          
        } else {
          console.warn('⚠️ No obligation data found to enhance');
          
          // Create minimal structure for Login CRM compatibility
          const minimalStructure = {
            _transferMetadata: {
              originalLeadId: lead._id,
              transferDate: new Date().toISOString(),
              sourceSystem: 'LEAD_CRM',
              targetSystem: 'LOGIN_CRM',
              dataStatus: 'NO_DATA_FOUND'
            },
            obligations: [],
            dynamic_fields: { financial_details: {}, personal_details: {} },
            dynamic_details: { financial_details: {}, personal_details: {} }
          };
          
          try {
            await fetch(obligationsUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(minimalStructure)
            });
            console.log('✅ Minimal obligation structure created for Login CRM');
          } catch (error) {
            console.warn('⚠️ Failed to create minimal structure:', error.message);
          }
        }

      } catch (error) {
        console.error('⚠️ Enhanced obligation data transfer failed:', error);
        setMessage('Warning: Obligation data may need manual verification after transfer');
        
        // Create emergency backup
        try {
          const emergencyBackup = {
            leadId: lead._id,
            timestamp: new Date().toISOString(),
            leadData: lead,
            errorInfo: error.message
          };
          localStorage.setItem(`emergencyBackup_${lead._id}`, JSON.stringify(emergencyBackup));
          console.log('🚨 Emergency backup created');
        } catch (backupError) {
          console.error('🚨 Emergency backup failed:', backupError);
        }
      }
      
      setMessage('Sending lead data to Login CRM...');
      
      // Using the specialized login endpoint to properly handle sending lead to login department
      const apiUrl = `${API_BASE_URL}/lead-login/send-to-login-department/${lead._id}?user_id=${userId}`;
      
      // Create an activity for the file sent to login action
      const activityUrl = `${API_BASE_URL}/leads/${lead._id}/activities?user_id=${userId}`;
      
      // First send the lead to login department using the specialized endpoint
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          department_id: selectedDepartment,
          assigned_user_id: selectedUser || null
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Then create an activity record for this action
      const activityResponse = await fetch(activityUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          lead_id: lead._id,
          user_id: userId,
          activity_type: 'file_sent_to_login',
          description: 'File sent to login',
          details: {
            form_type: 'login',
            login_status: 'sent',
            timestamp: new Date().toISOString(),
            department_id: selectedDepartment,
            assigned_user_id: selectedUser || null
          }
        })
      });
      
      // Wait for activity creation response
      if (!activityResponse.ok) {
        console.warn('Activity creation failed, but lead was updated successfully');
      }
      
      setLoginResponse(data);
      setStatus('success');
      setMessage('Lead successfully sent to Login CRM!');
      
      // 🔍 POST-TRANSFER VERIFICATION: Verify obligation data integrity
      console.log('🔍 Starting post-transfer verification...');
      setTimeout(async () => {
        try {
          const verifyResponse = await fetch(`${API_BASE_URL}/leads/${lead._id}/obligations?user_id=${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const hasEssentialData = verifyData.salary || 
                                   verifyData.loanRequired || 
                                   verifyData.dynamic_fields?.financial_details?.monthly_income ||
                                   verifyData.dynamic_details?.financial_details?.monthly_income;
            
            console.log('🔍 Post-transfer verification results:', {
              hasEssentialData,
              hasSalary: !!verifyData.salary,
              hasLoanRequired: !!verifyData.loanRequired,
              hasDynamicFields: !!verifyData.dynamic_fields,
              hasDynamicDetails: !!verifyData.dynamic_details,
              fieldCount: Object.keys(verifyData || {}).length
            });
            
            if (!hasEssentialData) {
              console.warn('⚠️ POST-TRANSFER: Essential data missing, attempting recovery...');
              
              // Try to recover from backup
              const backup = localStorage.getItem(`loginTransferBackup_${lead._id}`);
              if (backup) {
                const parsedBackup = JSON.parse(backup);
                console.log('🔄 Attempting data recovery from backup...');
                
                const recoveryResponse = await fetch(`${API_BASE_URL}/leads/${lead._id}/obligations?user_id=${userId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({
                    ...parsedBackup.enhancedData,
                    _recoveredFromBackup: true,
                    _recoveryTimestamp: new Date().toISOString()
                  })
                });
                
                if (recoveryResponse.ok) {
                  console.log('✅ Data recovered successfully from transfer backup');
                } else {
                  console.error('❌ Data recovery failed');
                }
              } else {
                console.error('❌ No backup found for recovery');
              }
            } else {
              console.log('✅ Post-transfer verification successful - obligation data intact');
            }
          } else {
            console.error('❌ Post-transfer verification failed - could not fetch data');
          }
        } catch (verifyError) {
          console.error('❌ Post-transfer verification error:', verifyError);
        }
      }, 3000); // Verify after 3 seconds
      
      // Update lead status in local storage to track which leads have been sent to login
      const sentLeads = JSON.parse(localStorage.getItem('sentToLoginLeads') || '[]');
      if (!sentLeads.includes(lead._id)) {
        sentLeads.push(lead._id);
        localStorage.setItem('sentToLoginLeads', JSON.stringify(sentLeads));
      }
      
      // Update lead data with file_sent_to_login flag and department/user info
      if (onUpdate) {
        onUpdate({
          ...lead,
          file_sent_to_login: true,
          login_department_sent_date: new Date().toISOString(),
          login_department_id: selectedDepartment,
          login_assigned_user_id: selectedUser || null
        });
      }
      
    } catch (error) {
      console.error('Error sending lead to Login CRM:', error);
      setStatus('error');
      setMessage(`Failed to send lead to Login CRM: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-900 to-black p-4 rounded-xl shadow-2xl max-w-lg w-full border border-cyan-800">
        <h2 className="text-lg font-bold text-cyan-400 mb-3">Send Lead to Login CRM</h2>
        
        {status === 'pending' && (
          <>
            <p className="text-white text-base mb-3">
              You are about to send lead information for <span className="font-bold text-cyan-300">{lead?.first_name} {lead?.last_name}</span> to the Login CRM.
            </p>
            
            <div className="bg-gray-800 p-2 rounded-lg mb-3 border border-gray-700">
              <h3 className="text-base font-bold text-cyan-300 mb-1">Lead Summary</h3>
              <ul className="space-y-0 text-gray-300 text-sm">
                <li><span className="font-medium text-gray-400">Name:</span> {lead?.first_name} {lead?.last_name}</li>
                <li><span className="font-medium text-gray-400">Mobile:</span> {lead?.mobile_number || lead?.phone}</li>
                <li><span className="font-medium text-gray-400">Email:</span> {lead?.email || 'N/A'}</li>
                <li><span className="font-medium text-gray-400">Loan Type:</span> {lead?.loan_type_name || lead?.loan_type || 'N/A'}</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 p-2 rounded-lg mb-3 border border-gray-700">
              <h3 className="text-base font-bold text-cyan-300 mb-1">Select Department & User</h3>
              
              <div className="mb-2">
                <label className="block text-gray-400 mb-1 font-medium text-sm">Department</label>
                <select 
                  className="w-full bg-gray-900 border border-gray-700 text-white p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={loadingDepartments}
                >
                  <option value="">Select Department</option>
                  {Array.isArray(departments) && departments.map(dept => (
                    <option key={dept._id} value={dept._id}>{dept.name}</option>
                  ))}
                </select>
                {loadingDepartments && (
                  <p className="text-gray-400 mt-1 text-xs">Loading departments...</p>
                )}
              </div>
              
              {selectedDepartment && (
                <div className="mb-1">
                  <label className="block text-gray-400 mb-1 font-medium text-sm">User</label>
                  <select 
                    className="w-full bg-gray-900 border border-gray-700 text-white p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    disabled={loadingUsers || usersInDepartment.length === 0}
                  >
                    <option value="">Select User</option>
                    {usersInDepartment.map(user => (
                      <option key={user._id} value={user._id}>{user.first_name} {user.last_name}</option>
                    ))}
                  </select>
                  {loadingUsers && (
                    <p className="text-gray-400 mt-1 text-xs">Loading users...</p>
                  )}
                  {!loadingUsers && usersInDepartment.length === 0 && (
                    <p className="text-yellow-500 mt-1 text-sm">No users found in this department</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={onClose}
                className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendToLogin}
                disabled={loading || !selectedDepartment}
                className={`px-3 py-1.5 rounded-lg text-white transition text-sm ${loading || !selectedDepartment
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-600 hover:to-cyan-500'}`}
              >
                {loading ? 'Sending...' : 'Send to Login CRM'}
              </button>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-2 mb-3">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <p className="text-green-400 font-medium text-base">{message}</p>
              </div>
            </div>
            
            {loginResponse && (
              <div className="bg-gray-800 p-2 rounded-lg mb-3 border border-gray-700">
                <h3 className="text-base font-bold text-cyan-300 mb-1">Login CRM Details</h3>
                <p className="text-gray-300 text-sm">
                  Lead successfully transferred to Login CRM system.
                </p>
                <p className="text-gray-300 text-sm">
                  Department: {departments.find(d => d._id === selectedDepartment)?.name || 'N/A'}
                </p>
                <p className="text-gray-300 text-sm">
                  Assigned to: {usersInDepartment.find(u => u._id === selectedUser)?.first_name} {usersInDepartment.find(u => u._id === selectedUser)?.last_name || 'Unassigned'}
                </p>
                <p className="text-gray-400 text-sm">
                  Transfer ID: {loginResponse.transferId || loginResponse._id || 'N/A'}
                </p>
              </div>
            )}
            
            <div className="flex justify-end">
              <button 
                onClick={onClose}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-500 transition text-sm"
              >
                Close
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-2 mb-3">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <p className="text-red-400 font-medium text-base">{message}</p>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={onClose}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-500 transition text-sm"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FileSentToLoginSection;
