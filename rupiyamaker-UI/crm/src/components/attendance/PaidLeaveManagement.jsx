import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = '/api';

const PaidLeaveManagement = () => {
  const [user] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch { return null; }
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');

  // Modal
  const [modalEmp, setModalEmp] = useState(null);
  const [leaveType, setLeaveType] = useState('paid');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const uid = user?.user_id || user?._id;

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const empRes = await axios.get(`${BASE_URL}/users/?user_id=${uid}`);
      const empList = Array.isArray(empRes.data) ? empRes.data : (empRes.data.users || empRes.data.data || []);
      const employees = empList.filter(e => e.is_employee !== false);

      const balResults = await Promise.allSettled(
        employees.map(emp =>
          axios.get(`${BASE_URL}/settings/leave-balance/${emp._id || emp.id}?user_id=${uid}`)
            .then(r => r.data?.data || null)
        )
      );

      setRows(employees.map((emp, i) => ({
        employee: emp,
        balance: balResults[i].status === 'fulfilled' ? balResults[i].value : null
      })));
    } catch (e) {
      setError('Failed to load data: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const openModal = (emp) => { setModalEmp(emp); setLeaveType('paid'); setQuantity(''); setReason(''); };

  const handleAction = async (action) => {
    if (!modalEmp || !quantity || !reason.trim()) { setError('Please fill all fields'); return; }
    setModalLoading(true); setError(null);
    try {
      const res = await axios.post(
        `${BASE_URL}/settings/leave-balance/${action === 'allocate' ? 'allocate' : 'deduct'}?user_id=${uid}`,
        { employee_id: modalEmp._id || modalEmp.id, leave_type: leaveType, quantity: parseInt(quantity), reason: reason.trim() }
      );
      setSuccess(res.data.message || `${action === 'allocate' ? 'Allocated' : 'Deducted'} successfully`);
      setModalEmp(null);
      setTimeout(() => setSuccess(null), 3000);
      loadAll();
    } catch (e) {
      setError(e.response?.data?.detail || `Failed to ${action}`);
    } finally { setModalLoading(false); }
  };

  const filtered = rows.filter(({ employee: e }) => {
    const q = search.toLowerCase();
    return `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(q)
      || (e.employee_code || e.emp_id || '').toLowerCase().includes(q)
      || (e.department_name || e.department || '').toLowerCase().includes(q);
  });

  const HDR_COLS = [
    { label: 'Paid Leave',    bg: '#1a6b2a', rKey: 'paid_leaves_remaining',   tKey: 'paid_leaves_total',   uKey: 'paid_leaves_used',   color: 'text-green-400' },
    { label: 'Earned Leave',  bg: '#1565c0', rKey: 'earned_leaves_remaining', tKey: 'earned_leaves_total', uKey: 'earned_leaves_used', color: 'text-blue-400' },
    { label: 'Sick Leave',    bg: '#b35900', rKey: 'sick_leaves_remaining',   tKey: 'sick_leaves_total',   uKey: 'sick_leaves_used',   color: 'text-orange-400' },
    { label: 'Casual Leave',  bg: '#5e1b8a', rKey: 'casual_leaves_remaining', tKey: 'casual_leaves_total', uKey: 'casual_leaves_used', color: 'text-purple-400' },
    { label: 'Grace Leave',   bg: '#7b1fa2', rKey: 'grace_leaves_remaining',  tKey: 'grace_leaves_total',  uKey: 'grace_leaves_used',  color: 'text-pink-400' },
  ];

  return (
    <div className="p-4 bg-gray-950 min-h-screen">
      <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-6 py-4 rounded-lg mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏖️ Leave Management</h1>
          <p className="text-indigo-200 text-sm mt-1">View & manage all employee leave balances</p>
        </div>
        <button onClick={loadAll} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">🔄 Refresh</button>
      </div>

      {success && <div className="bg-green-900 border border-green-500 text-green-300 px-4 py-2 rounded mb-3 text-sm">✅ {success}</div>}
      {error && <div className="bg-red-900 border border-red-500 text-red-300 px-4 py-2 rounded mb-3 text-sm flex justify-between">❌ {error}<button className="ml-2 underline text-xs" onClick={() => setError(null)}>✕</button></div>}

      <div className="mb-3">
        <input type="text" placeholder="🔍 Search name, emp ID, department..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-96 bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm bg-black border-collapse" style={{ minWidth: '1100px' }}>
          <thead>
            <tr style={{ backgroundColor: '#03b0f5' }}>
              <th rowSpan={2} className="px-3 py-2 text-left font-bold text-white border border-gray-400 min-w-[140px]">Employee</th>
              <th rowSpan={2} className="px-3 py-2 text-left font-bold text-white border border-gray-400 min-w-[90px]">Emp ID</th>
              <th rowSpan={2} className="px-3 py-2 text-left font-bold text-white border border-gray-400 min-w-[110px]">Department</th>
              {HDR_COLS.map(c => (
                <th key={c.label} colSpan={3} className="px-2 py-2 text-center font-bold text-white border border-gray-400" style={{ backgroundColor: c.bg }}>{c.label}</th>
              ))}
              <th rowSpan={2} className="px-3 py-2 text-center font-bold text-white border border-gray-400 min-w-[80px]">Action</th>
            </tr>
            <tr>
              {HDR_COLS.map(c => (
                <React.Fragment key={c.label}>
                  <th className="px-2 py-1 text-center font-semibold text-white text-xs border border-gray-400 min-w-[60px]" style={{ backgroundColor: c.bg }}>Allotted</th>
                  <th className="px-2 py-1 text-center font-semibold text-white text-xs border border-gray-400 min-w-[50px]" style={{ backgroundColor: c.bg }}>Used</th>
                  <th className="px-2 py-1 text-center font-semibold text-white text-xs border border-gray-400 min-w-[65px]" style={{ backgroundColor: c.bg }}>Remaining</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={19} className="text-center py-12 text-gray-400">⏳ Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={19} className="text-center py-12 text-gray-500">No employees found</td></tr>}
            {filtered.map(({ employee: e, balance: b }, idx) => {
              const name = `${e.first_name || ''} ${e.last_name || ''}`.trim();
              const code = e.employee_code || e.emp_id || `EMP-${(e._id || e.id || '').slice(-6)}`;
              return (
                <tr key={e._id || e.id} className={`${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900'} hover:bg-gray-800 transition-colors`}>
                  <td className="px-3 py-3 font-semibold text-white border border-gray-700">{name}</td>
                  <td className="px-3 py-3 text-blue-300 text-xs border border-gray-700">{code}</td>
                  <td className="px-3 py-3 text-gray-400 text-xs border border-gray-700">{e.department_name || e.department || '—'}</td>
                  {HDR_COLS.map(c => {
                    const rem = b?.[c.rKey];
                    const tot = b?.[c.tKey];
                    const used = b?.[c.uKey] ?? 0;
                    const remNum = parseFloat(rem);
                    const totNum = parseFloat(tot);
                    const pct = totNum > 0 ? remNum / totNum : 1;
                    const remColor = pct > 0.5 ? c.color : pct > 0.2 ? 'text-yellow-400' : 'text-red-400';
                    return (
                      <React.Fragment key={c.label}>
                        <td className="px-2 py-3 text-center border border-gray-700 text-gray-300 text-xs">{tot ?? '—'}</td>
                        <td className="px-2 py-3 text-center border border-gray-700 text-orange-300 text-xs font-semibold">{used}</td>
                        <td className="px-2 py-3 text-center border border-gray-700">
                          <span className={`font-bold text-sm ${remColor}`}>{rem ?? '—'}</span>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-2 py-3 text-center border border-gray-700">
                    <button onClick={() => openModal(e)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors">✏️ Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-gray-600 text-xs mt-2">Showing {filtered.length} of {rows.length} employees</p>

      {/* Modal */}
      {modalEmp && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-1">✏️ Manage Leaves</h3>
            <p className="text-gray-400 text-sm mb-4">{modalEmp.first_name} {modalEmp.last_name} · {modalEmp.employee_code || modalEmp.emp_id || ''}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-1">Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500">
                  <option value="paid">Paid Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="grace">Grace Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-1">Quantity</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                  placeholder="Number of leaves"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-1">Reason *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Reason for allocation / deduction" rows={3}
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleAction('allocate')} disabled={modalLoading}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50">➕ Allocate</button>
                <button onClick={() => handleAction('deduct')} disabled={modalLoading}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50">➖ Deduct</button>
                <button onClick={() => setModalEmp(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-semibold text-sm transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaidLeaveManagement;
