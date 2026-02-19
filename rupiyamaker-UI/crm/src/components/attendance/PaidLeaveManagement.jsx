import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

// API base URL
const BASE_URL = '/api';

const PaidLeaveManagement = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Modal states
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [leaveType, setLeaveType] = useState('paid');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BASE_URL}/employees?user_id=${user?.user_id}`);
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaveBalance = async (employeeId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${BASE_URL}/settings/leave-balance/${employeeId}?user_id=${user?.user_id}`);
      
      if (response.data.success) {
        setLeaveBalance(response.data.data);
      }
      
      // Load history
      const historyResponse = await axios.get(`${BASE_URL}/settings/leave-balance/history/${employeeId}?user_id=${user?.user_id}`);
      setLeaveHistory(historyResponse.data || []);
      
    } catch (error) {
      console.error('Error loading leave balance:', error);
      setError(error.response?.data?.detail || 'Failed to load leave balance');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    loadLeaveBalance(employee.id);
  };

  const handleAllocateLeave = async () => {
    if (!selectedEmployee || !quantity || !reason.trim()) {
      setError('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = {
        employee_id: selectedEmployee.id,
        leave_type: leaveType,
        quantity: parseInt(quantity),
        reason: reason.trim()
      };

      const response = await axios.post(
        `${BASE_URL}/settings/leave-balance/allocate?user_id=${user?.user_id}`,
        data
      );

      setSuccess(response.data.message);
      setShowAllocationModal(false);
      setQuantity('');
      setReason('');
      
      // Reload balance
      loadLeaveBalance(selectedEmployee.id);

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error allocating leave:', error);
      setError(error.response?.data?.detail || 'Failed to allocate leave');
    } finally {
      setLoading(false);
    }
  };

  const handleDeductLeave = async () => {
    if (!selectedEmployee || !quantity || !reason.trim()) {
      setError('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = {
        employee_id: selectedEmployee.id,
        leave_type: leaveType,
        quantity: parseInt(quantity),
        reason: reason.trim()
      };

      const response = await axios.post(
        `${BASE_URL}/settings/leave-balance/deduct?user_id=${user?.user_id}`,
        data
      );

      setSuccess(response.data.message);
      setShowAllocationModal(false);
      setQuantity('');
      setReason('');
      
      // Reload balance
      loadLeaveBalance(selectedEmployee.id);

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error deducting leave:', error);
      setError(error.response?.data?.detail || 'Failed to deduct leave');
    } finally {
      setLoading(false);
    }
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      paid: 'text-green-600 bg-green-100',
      earned: 'text-blue-600 bg-blue-100',
      sick: 'text-orange-600 bg-orange-100',
      casual: 'text-purple-600 bg-purple-100'
    };
    return colors[type] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold mb-2">🏖️ Paid Leave Management</h1>
        <p className="text-indigo-100">Allocate and manage employee leave balances</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          ✅ {success}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ❌ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">👥 Select Employee</h2>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => handleEmployeeSelect(employee)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedEmployee?.id === employee.id
                      ? 'bg-indigo-100 border-2 border-indigo-500'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-semibold text-gray-800">{employee.name}</div>
                  <div className="text-sm text-gray-600">{employee.department}</div>
                  <div className="text-xs text-gray-500">{employee.employee_code}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leave Balance Details */}
        <div className="lg:col-span-2">
          {selectedEmployee ? (
            <div className="space-y-6">
              {/* Employee Info Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedEmployee.name}</h2>
                    <p className="text-gray-600">{selectedEmployee.department} | {selectedEmployee.employee_code}</p>
                  </div>
                  <button
                    onClick={() => setShowAllocationModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    ➕ Allocate/Deduct Leaves
                  </button>
                </div>

                {loading && !leaveBalance ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-gray-600 mt-2">Loading leave balance...</p>
                  </div>
                ) : leaveBalance ? (
                  <>
                    {/* Leave Balance Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {/* Paid Leaves */}
                      <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg">
                        <div className="text-sm opacity-90 mb-1">Paid Leaves</div>
                        <div className="text-3xl font-bold">{leaveBalance.paid_leaves_remaining}/{leaveBalance.paid_leaves_total}</div>
                        <div className="text-xs mt-2">Used: {leaveBalance.paid_leaves_used}</div>
                      </div>

                      {/* Earned Leaves */}
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-lg">
                        <div className="text-sm opacity-90 mb-1">Earned Leaves</div>
                        <div className="text-3xl font-bold">{leaveBalance.earned_leaves_remaining}/{leaveBalance.earned_leaves_total}</div>
                        <div className="text-xs mt-2">Used: {leaveBalance.earned_leaves_used}</div>
                      </div>

                      {/* Sick Leaves */}
                      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg">
                        <div className="text-sm opacity-90 mb-1">Sick Leaves</div>
                        <div className="text-3xl font-bold">{leaveBalance.sick_leaves_remaining}/{leaveBalance.sick_leaves_total}</div>
                        <div className="text-xs mt-2">Used: {leaveBalance.sick_leaves_used}</div>
                      </div>

                      {/* Casual Leaves */}
                      <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
                        <div className="text-sm opacity-90 mb-1">Casual Leaves</div>
                        <div className="text-3xl font-bold">{leaveBalance.casual_leaves_remaining}/{leaveBalance.casual_leaves_total}</div>
                        <div className="text-xs mt-2">Used: {leaveBalance.casual_leaves_used}</div>
                      </div>
                    </div>

                    {/* Leave History */}
                    <div className="mt-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-3">📜 Leave Transaction History</h3>
                      
                      {leaveHistory.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                          No leave transactions yet
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {leaveHistory.map((entry, index) => (
                            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getLeaveTypeColor(entry.leave_type)}`}>
                                      {entry.leave_type.toUpperCase()}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                      entry.transaction_type === 'allocation' 
                                        ? 'bg-green-100 text-green-600' 
                                        : 'bg-red-100 text-red-600'
                                    }`}>
                                      {entry.transaction_type === 'allocation' ? '➕ Allocation' : '➖ Deduction'}
                                    </span>
                                    <span className="text-lg font-bold text-gray-800">{entry.quantity}</span>
                                  </div>
                                  
                                  <div className="text-sm text-gray-700 mb-2">
                                    <strong>Reason:</strong> {entry.reason}
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <span>👤 {entry.performed_by_name}</span>
                                    <span>📅 {new Date(entry.timestamp).toLocaleString()}</span>
                                    <span>Before: {entry.balance_before} → After: {entry.balance_after}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-6xl mb-4">👈</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Select an Employee</h3>
              <p className="text-gray-500">Choose an employee from the list to view and manage their leave balance</p>
            </div>
          )}
        </div>
      </div>

      {/* Allocation/Deduction Modal */}
      {showAllocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">🏖️ Manage Leaves</h3>
            
            <div className="space-y-4">
              {/* Leave Type */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="paid">Paid Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter number of leaves"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for allocation/deduction"
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAllocateLeave}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                >
                  ➕ Allocate
                </button>
                <button
                  onClick={handleDeductLeave}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-50"
                >
                  ➖ Deduct
                </button>
                <button
                  onClick={() => {
                    setShowAllocationModal(false);
                    setQuantity('');
                    setReason('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-800 py-3 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaidLeaveManagement;
