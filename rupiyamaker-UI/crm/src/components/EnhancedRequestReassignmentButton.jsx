import React, { useState, useEffect } from 'react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Helper function to get user ID
const getUserId = () => {
  const userData = JSON.parse(localStorage.getItem('userData'));
  return userData?.id || userData?.user_id;
};

const EnhancedRequestReassignmentButton = ({ 
  leadData, 
  onSuccess, 
  className = "flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg" 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [dataCodes, setDataCodes] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedDataCode, setSelectedDataCode] = useState('');
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [filteredDataCodes, setFilteredDataCodes] = useState([]);
  const [campaignSearchTerm, setCampaignSearchTerm] = useState('');
  const [dataCodeSearchTerm, setDataCodeSearchTerm] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch campaigns and data codes when modal opens
  useEffect(() => {
    if (showModal) {
      fetchCampaigns();
      fetchDataCodes();
      
      // Set current values as defaults
      setSelectedCampaign(leadData?.campaign_name || '');
      setSelectedDataCode(leadData?.data_code || '');
    }
  }, [showModal, leadData]);

  // Filter campaigns based on search term
  useEffect(() => {
    if (campaignSearchTerm) {
      setFilteredCampaigns(
        campaigns.filter(campaign =>
          campaign.toLowerCase().includes(campaignSearchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredCampaigns(campaigns);
    }
  }, [campaigns, campaignSearchTerm]);

  // Filter data codes based on search term
  useEffect(() => {
    if (dataCodeSearchTerm) {
      setFilteredDataCodes(
        dataCodes.filter(code =>
          code.toLowerCase().includes(dataCodeSearchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredDataCodes(dataCodes);
    }
  }, [dataCodes, dataCodeSearchTerm]);

  const fetchCampaigns = async () => {
    try {
      const userId = getUserId();
      const response = await fetch(`${API_BASE_URL}/settings/campaign-names?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaign_names || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchDataCodes = async () => {
    try {
      const userId = getUserId();
      const response = await fetch(`${API_BASE_URL}/settings/data-codes?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setDataCodes(data.data_codes || []);
      }
    } catch (error) {
      console.error('Error fetching data codes:', error);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for reassignment');
      return;
    }

    setLoading(true);

    try {
      const userId = getUserId();
      const requestBody = {
        reason: reason.trim(),
        data_code: selectedDataCode !== leadData?.data_code ? selectedDataCode : undefined,
        campaign_name: selectedCampaign !== leadData?.campaign_name ? selectedCampaign : undefined
      };

      // Remove undefined values
      Object.keys(requestBody).forEach(key => 
        requestBody[key] === undefined && delete requestBody[key]
      );

      const response = await fetch(
        `${API_BASE_URL}/reassignment/request?user_id=${userId}&lead_id=${leadData.id}&target_user_id=${userId}&reason=${encodeURIComponent(reason)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (leadData.has_assign_permission) {
          alert('Lead assigned to you successfully!');
        } else {
          alert('Lead reassignment request submitted successfully!');
        }
        
        setShowModal(false);
        if (onSuccess) onSuccess();
      } else if (response.status === 403) {
        const data = await response.json();
        alert(data.message || 'This lead is not eligible for reassignment yet. Please try again later.');
      } else if (response.status === 409) {
        const data = await response.json();
        alert(data.message || 'This lead already has a pending reassignment request.');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error submitting reassignment request:', error);
      alert('Error submitting reassignment request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return selectedCampaign !== (leadData?.campaign_name || '') || 
           selectedDataCode !== (leadData?.data_code || '');
  };

  return (
    <>
      <button
        className={className}
        onClick={() => setShowModal(true)}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        Request Reassignment
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-green-500 text-white p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Request Lead Reassignment</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Current Information */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2">Current Lead Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Customer:</span>
                    <span className="ml-2 font-medium">{leadData?.name || leadData?.customer_name || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Mobile:</span>
                    <span className="ml-2 font-medium">{leadData?.mobile_number || leadData?.phone || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Campaign:</span>
                    <span className="ml-2 font-medium">{leadData?.campaign_name || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Data Code:</span>
                    <span className="ml-2 font-medium">{leadData?.data_code || 'Not set'}</span>
                  </div>
                </div>
              </div>

              {/* Campaign Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={campaignSearchTerm || selectedCampaign}
                    onChange={(e) => {
                      setCampaignSearchTerm(e.target.value);
                      setSelectedCampaign(e.target.value);
                    }}
                    placeholder="Search or select campaign..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {campaignSearchTerm && filteredCampaigns.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredCampaigns.map((campaign, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setCampaignSearchTerm('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100"
                        >
                          {campaign}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Code Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={dataCodeSearchTerm || selectedDataCode}
                    onChange={(e) => {
                      setDataCodeSearchTerm(e.target.value);
                      setSelectedDataCode(e.target.value);
                    }}
                    placeholder="Search or select data code..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {dataCodeSearchTerm && filteredDataCodes.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredDataCodes.map((code, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedDataCode(code);
                            setDataCodeSearchTerm('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Changes Preview */}
              {hasChanges() && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-800 mb-2">Proposed Changes:</h5>
                  <div className="space-y-2 text-sm">
                    {selectedCampaign !== (leadData?.campaign_name || '') && (
                      <div className="flex items-center">
                        <span className="text-blue-600 font-medium">Campaign:</span>
                        <span className="ml-2 text-gray-600">{leadData?.campaign_name || 'Not set'}</span>
                        <span className="mx-2 text-blue-500">→</span>
                        <span className="text-blue-800 font-medium">{selectedCampaign}</span>
                      </div>
                    )}
                    {selectedDataCode !== (leadData?.data_code || '') && (
                      <div className="flex items-center">
                        <span className="text-blue-600 font-medium">Data Code:</span>
                        <span className="ml-2 text-gray-600">{leadData?.data_code || 'Not set'}</span>
                        <span className="mx-2 text-blue-500">→</span>
                        <span className="text-blue-800 font-medium">{selectedDataCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Reassignment *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a detailed reason for requesting this reassignment..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !reason.trim()}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                    </svg>
                  )}
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EnhancedRequestReassignmentButton;
