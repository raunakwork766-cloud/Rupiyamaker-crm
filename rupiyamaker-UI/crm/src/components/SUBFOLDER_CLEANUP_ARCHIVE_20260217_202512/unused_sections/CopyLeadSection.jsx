import { useState } from 'react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const CopyLeadSection = ({ leadData, lead, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('');

  // Use leadData or lead prop (for backward compatibility)
  const currentLead = leadData || lead;

  // Early return if no lead is provided
  if (!currentLead) {
    console.error('CopyLeadSection: No lead provided');
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gradient-to-b from-gray-900 to-black p-8 rounded-xl shadow-2xl max-w-lg w-full border border-cyan-800">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6">Error</h2>
          <p className="text-red-400 mb-6 text-center">No lead selected for copying</p>
          <div className="flex justify-center">
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyLead = async () => {
    setLoading(true);
    
    try {
      // Debug information
      console.log('CopyLeadSection - Lead object:', currentLead);
      console.log('CopyLeadSection - Lead._id:', currentLead._id);
      console.log('CopyLeadSection - Lead.id:', currentLead.id);
      
      // Validate that lead exists and has an ID
      if (!currentLead || (!currentLead._id && !currentLead.id)) {
        throw new Error('No lead selected or lead ID missing');
      }

      const userId = localStorage.getItem('userId');
      const apiUrl = `${API_BASE_URL}/leads/copy?user_id=${userId}`;
      
      // Get the lead ID (could be _id or id depending on the source)
      const leadId = currentLead._id || currentLead.id;
      
        // For the copy API, we'll send the lead ID and specify what to copy
        const copyData = {
          lead_id: leadId,
          copy_options: {
            keep_custom_lead_id: true,
            copy_activities: true,
            copy_attachments: true,
            copy_tasks: true,
            copy_remarks: true,
            copy_obligations: true,
            preserve_original_metadata: true,  // Copy exact created_by, assigned_to, etc.
            preserve_assigned_to: true,        // Keep original assigned_to values
            preserve_created_by: true,         // Keep original created_by values
            preserve_all_fields: true,         // Copy ALL fields exactly as they are
            preserve_status: true,             // Copy original status too
            add_copy_activity: true            // Add "Lead copied by" activity
          },
          // Don't override any values - keep everything as original
          override_values: {}
        };      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(copyData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get the newly created lead ID from the response
      const responseData = await response.json();
      const newLeadId = responseData.lead_id || responseData._id || responseData.id;
      
      setStatus('success');
      setMessage('Lead copied with all original details preserved!');
      
    } catch (error) {
      console.error('Error copying lead:', error);
      setStatus('error');
      setMessage(`Failed to copy lead: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-900 to-black p-8 rounded-xl shadow-2xl max-w-lg w-full border border-cyan-800">
        <h2 className="text-2xl font-bold text-cyan-400 mb-6">Copy Lead</h2>
        
        {status === 'pending' && (
        <>
          <p className="text-white mb-6 text-center">
            Copy this lead with ALL original details?
          </p>
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
            <p className="text-blue-400 text-sm">
              ✓ ALL fields will be copied exactly (created_by, assigned_to, status, dates, etc.)<br/>
              ✓ Activities, attachments, tasks, and remarks will be included<br/>
              ✓ A new activity "Lead copied by [your name]" will be added<br/>
              ✓ Everything will remain exactly as the original lead
            </p>
          </div>            {message && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
                <p className="text-yellow-400">{message}</p>
              </div>
            )}
            
            <div className="flex justify-center space-x-4 mt-8">
              <button 
                onClick={onClose}
                className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleCopyLead}
                disabled={loading}
                className={`px-5 py-2 rounded-lg text-white transition ${loading 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-600 hover:to-cyan-500'}`}
              >
                {loading ? 'Copying...' : 'Copy Lead'}
              </button>
            </div>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <p className="text-green-400 font-medium">{message}</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={onClose}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-500 transition"
              >
                Close
              </button>
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <p className="text-red-400 font-medium">{message}</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={onClose}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-500 transition"
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

export default CopyLeadSection;
