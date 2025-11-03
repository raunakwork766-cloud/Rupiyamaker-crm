import React, { useState, useEffect } from 'react';
import { fetchPendingReassignmentLeads, approveLeadReassignment, requestLeadReassignment } from '../../utils/leadApiHelper';
import { canApproveLeadReassignment } from '../../utils/permissions';
import { Check, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

/**
 * Component for handling lead reassignment requests
 */
const ReassignmentPanel = ({ userPermissions, onLeadAction }) => {
  const [pendingReassignments, setPendingReassignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  const userId = localStorage.getItem('userId');
  const canApprove = canApproveLeadReassignment(userPermissions);

  // Fetch pending reassignment leads
  const loadReassignments = async () => {
    if (!canApprove) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchPendingReassignmentLeads(userId, page, pageSize);
      setPendingReassignments(data.items || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      setError('Failed to load reassignment requests');
      console.error('Failed to load reassignment requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load reassignments when component mounts or page changes
  useEffect(() => {
    loadReassignments();
  }, [page, canApprove]);

  // Handle approval of reassignment request
  const handleApprove = async (leadId) => {
    setLoading(true);
    try {
      await approveLeadReassignment(leadId, userId);
      // Refresh the list
      loadReassignments();
      // Notify parent component (if needed)
      if (onLeadAction) onLeadAction('reassign_approved', leadId);
    } catch (err) {
      setError('Failed to approve reassignment');
      console.error('Failed to approve reassignment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle rejection (just remove from the list for now)
  const handleReject = (leadId) => {
    // For now, just remove it from the UI list
    setPendingReassignments(pendingReassignments.filter(lead => lead._id !== leadId));
    if (onLeadAction) onLeadAction('reassign_rejected', leadId);
  };

  // Navigation
  const goToPrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const goToNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  // If user doesn't have permission, don't render anything
  if (!canApprove) return null;

  return (
    <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-cyan-600 text-white flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pending Lead Reassignment Requests</h3>
        <button 
          onClick={loadReassignments}
          disabled={loading}
          className="p-2 hover:bg-cyan-700 rounded-full"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 border-l-4 border-red-500">
          {error}
        </div>
      )}

      {pendingReassignments.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          No pending reassignment requests
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Assignee</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target User</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Code</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingReassignments.map((lead) => (
                  <tr key={lead._id} className="hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <div className="text-sm font-medium text-gray-900">
                        {lead.name || lead.customer_name || 'Unnamed Lead'}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {lead._id?.slice(-6) || 'N/A'}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900">{lead.requestor_name || 'Unknown'}</td>
                    <td className="py-2 px-4 text-sm text-gray-900">{lead.assigned_user_name || 'Unassigned'}</td>
                    <td className="py-2 px-4 text-sm text-gray-900">{lead.target_user_name || 'Not specified'}</td>
                    <td className="py-2 px-4">
                      {lead.reassignment_new_data_code ? (
                        <div className="text-sm">
                          <div className="text-gray-500 line-through">{lead.data_code || 'None'}</div>
                          <div className="text-green-600 font-medium">→ {lead.reassignment_new_data_code}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No change</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      {lead.reassignment_new_campaign_name ? (
                        <div className="text-sm">
                          <div className="text-gray-500 line-through">{lead.campaign_name || 'None'}</div>
                          <div className="text-green-600 font-medium">→ {lead.reassignment_new_campaign_name}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No change</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={lead.reassignment_reason}>
                        {lead.reassignment_reason || 'No reason provided'}
                      </div>
                    </td>
                    <td className="py-2 px-4 flex space-x-2">
                      <button
                        onClick={() => handleApprove(lead._id)}
                        className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        disabled={loading}
                        title="Approve reassignment"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleReject(lead._id)}
                        className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        disabled={loading}
                        title="Reject reassignment"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between items-center">
              <button
                onClick={goToPrevPage}
                disabled={page === 1 || loading}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={page === totalPages || loading}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReassignmentPanel;
