import React, { useState } from 'react';
import { requestLeadReassignment } from '../../utils/leadApiHelper';
import { AlertCircle } from 'lucide-react';

/**
 * Component for requesting a lead reassignment
 */
const RequestReassignmentButton = ({ 
  leadId, 
  assignableUsers = [], 
  onRequestSubmitted = () => {},
  buttonClassName = ""
}) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targetUser, setTargetUser] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  
  const userId = localStorage.getItem('userId');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await requestLeadReassignment(leadId, userId, targetUser, reason);
      setShowModal(false);
      onRequestSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit reassignment request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className={buttonClassName || "px-3 py-1.5 bg-amber-500 text-white rounded-md hover:bg-amber-600 text-xs"}
      >
        Request Reassignment
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Request Lead Reassignment</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex items-center">
                <AlertCircle size={16} className="mr-2" />
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Target User (Optional)
                </label>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Select User --</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || `${user.first_name} ${user.last_name}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  If not selected, admin will assign to appropriate user
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Reason for Reassignment
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Explain why this lead needs to be reassigned..."
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RequestReassignmentButton;
