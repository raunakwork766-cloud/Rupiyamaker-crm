import React, { useState, useEffect } from 'react';
import { requestLeadReassignment } from '../../utils/leadApiHelper';
import { AlertCircle, Search, X } from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

/**
 * Enhanced component for requesting a lead reassignment with data_code and campaign_name changes
 */
const EnhancedRequestReassignmentButton = ({ 
  leadId, 
  assignableUsers = [], 
  onRequestSubmitted = () => {},
  buttonClassName = "",
  currentDataCode = "",
  currentCampaignName = ""
}) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targetUser, setTargetUser] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  
  // New fields for data_code and campaign_name
  const [dataCode, setDataCode] = useState(currentDataCode);
  const [campaignName, setCampaignName] = useState(currentCampaignName);
  const [campaigns, setCampaigns] = useState([]);
  const [dataCodes, setDataCodes] = useState([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [dataCodeSearch, setDataCodeSearch] = useState("");
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [showDataCodeDropdown, setShowDataCodeDropdown] = useState(false);
  
  const userId = localStorage.getItem('userId');

  // Fetch campaigns from API (same as AboutSection.jsx)
  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/campaign-names?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns(data || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      // Set some default campaigns if API fails
      setCampaigns([
        { _id: '1', name: 'Digital Marketing' },
        { _id: '2', name: 'Social Media' },
        { _id: '3', name: 'Email Campaign' },
        { _id: '4', name: 'Referral Program' }
      ]);
    }
  };

  // Fetch data codes from API (same as AboutSection.jsx)
  const fetchDataCodes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/data-codes?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDataCodes(data || []);
      }
    } catch (error) {
      console.error('Error fetching data codes:', error);
      // Set some default data codes if API fails
      setDataCodes([
        { _id: '1', name: 'DC001' },
        { _id: '2', name: 'DC002' },
        { _id: '3', name: 'DC003' },
        { _id: '4', name: 'DC004' }
      ]);
    }
  };

  useEffect(() => {
    if (showModal) {
      fetchCampaigns();
      fetchDataCodes();
    }
  }, [showModal]);

  // Filter campaigns based on search
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  // Filter data codes based on search
  const filteredDataCodes = dataCodes.filter(dataCode =>
    dataCode.name.toLowerCase().includes(dataCodeSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Enhanced API call with data_code and campaign_name
      const params = new URLSearchParams({
        lead_id: leadId,
        target_user_id: targetUser,
        reason: reason,
        user_id: userId
      });

      // Add optional fields only if they're different from current values
      if (dataCode && dataCode !== currentDataCode) {
        params.append('data_code', dataCode);
      }
      
      if (campaignName && campaignName !== currentCampaignName) {
        params.append('campaign_name', campaignName);
      }

      const response = await fetch(`${API_BASE_URL}/reassignment/request?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setShowModal(false);
        onRequestSubmitted(true);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit reassignment request');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit reassignment request');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTargetUser("");
    setReason("");
    setDataCode(currentDataCode);
    setCampaignName(currentCampaignName);
    setCampaignSearch("");
    setDataCodeSearch("");
    setError(null);
  };

  const handleModalClose = () => {
    setShowModal(false);
    resetForm();
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
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Request Lead Reassignment</h3>
              <button
                onClick={handleModalClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to User *
                </label>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a user</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id || user._id} value={user.id || user._id}>
                      {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Code Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Code (Optional)
                </label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search data codes..."
                      value={dataCodeSearch}
                      onChange={(e) => {
                        setDataCodeSearch(e.target.value);
                        setShowDataCodeDropdown(true);
                      }}
                      onFocus={() => setShowDataCodeDropdown(true)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {showDataCodeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredDataCodes.length > 0 ? (
                        filteredDataCodes.map((code) => (
                          <div
                            key={code._id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              setDataCode(code.name);
                              setDataCodeSearch(code.name);
                              setShowDataCodeDropdown(false);
                            }}
                          >
                            {code.name}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500">No data codes found</div>
                      )}
                    </div>
                  )}
                </div>
                {dataCode && (
                  <div className="mt-1 text-sm text-gray-600">
                    Current: {currentDataCode || 'None'} → New: {dataCode}
                  </div>
                )}
              </div>

              {/* Campaign Name Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name (Optional)
                </label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search campaigns..."
                      value={campaignSearch}
                      onChange={(e) => {
                        setCampaignSearch(e.target.value);
                        setShowCampaignDropdown(true);
                      }}
                      onFocus={() => setShowCampaignDropdown(true)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {showCampaignDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredCampaigns.length > 0 ? (
                        filteredCampaigns.map((campaign) => (
                          <div
                            key={campaign._id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              setCampaignName(campaign.name);
                              setCampaignSearch(campaign.name);
                              setShowCampaignDropdown(false);
                            }}
                          >
                            {campaign.name}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500">No campaigns found</div>
                      )}
                    </div>
                  )}
                </div>
                {campaignName && (
                  <div className="mt-1 text-sm text-gray-600">
                    Current: {currentCampaignName || 'None'} → New: {campaignName}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Reassignment *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Please provide a reason for this reassignment request..."
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading || !targetUser || !reason}
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showCampaignDropdown || showDataCodeDropdown) && (
        <div 
          className="fixed inset-0 z-5"
          onClick={() => {
            setShowCampaignDropdown(false);
            setShowDataCodeDropdown(false);
          }}
        />
      )}
    </>
  );
};

export default EnhancedRequestReassignmentButton;
