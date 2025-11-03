import React, { useState, useEffect } from 'react';
import { interviewsAPI } from '../services/api';

const InterviewHistory = ({ interviewId, isOpen, onClose, inline = false }) => {
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  // Load history when component mounts or interview changes
  useEffect(() => {
    if (interviewId && isOpen) {
      loadHistory();
    }
  }, [interviewId, isOpen]);

  // Function to load history from API
  const loadHistory = async () => {
    if (!interviewId || isLoadingHistory) return;

    setIsLoadingHistory(true);
    try {
      console.log("Loading history for interview:", interviewId);
      const response = await interviewsAPI.getHistory(interviewId);
      console.log("History API response:", response);

      // Handle response structure: response should have { success: true, data: [...] }
      const historyArray = response.data || response.history || response || [];
      console.log("History array:", historyArray);

      // Update history data with enhanced processing for new response format
      const processedHistory = historyArray.map((item, index) => {
        const createdAt = new Date(item.created_at);
        const date = createdAt.toLocaleDateString();
        const time = createdAt.toLocaleTimeString();
        
        return {
          id: item.id || item._id || index,
          date: date,
          time: time,
          createdBy: item.created_by_name || 'Unknown User',
          actionType: item.action_type || 'activity',
          changes: item.action || item.description || 'Activity performed',
          rawData: item
        };
      });

      console.log("Processed history:", processedHistory);
      setHistoryData(processedHistory);
      setError('');
    } catch (error) {
      console.error("Failed to load history:", error);
      setError('Failed to load history: ' + error.message);
      setHistoryData([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  // Inline mode - render without modal wrapper, same style as EditTask
  if (inline) {
    return (
      <div className="mt-4 max-h-[350px] overflow-y-auto">
        {isLoadingHistory ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading history...</p>
          </div>
        ) : historyData && historyData.length > 0 ? (
          <div className="overflow-hidden border border-gray-200 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                    #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                    Activity & Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyData.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.createdBy}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 break-words">
                      <div className="flex items-center gap-2">
                        {/* Action type indicator */}
                        {item.actionType === 'created' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            📝 CREATED
                          </span>
                        )}
                        {item.actionType === 'status_changed' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            🔄 STATUS
                          </span>
                        )}
                        {item.actionType === 'comment_added' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            💬 COMMENT
                          </span>
                        )}
                        {item.actionType === 'field_changed' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            ✏️ FIELD CHANGED
                          </span>
                        )}
                        {item.actionType === 'updated' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            ✏️ UPDATED
                          </span>
                        )}
                        {item.actionType === 'scheduled' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                            📅 SCHEDULED
                          </span>
                        )}
                        {item.actionType === 'rescheduled' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            🔄 RESCHEDULED
                          </span>
                        )}
                        {!['created', 'status_changed', 'comment_added', 'field_changed', 'updated', 'scheduled', 'rescheduled'].includes(item.actionType) && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            ❓ ACTIVITY
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm uppercase font-medium">
                        {item.changes}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            No history available for this interview.
          </div>
        )}
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Modal mode - render with modal wrapper (same table style but in modal)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Interview History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingHistory ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading history...</p>
            </div>
          ) : historyData && historyData.length > 0 ? (
            <div className="overflow-hidden border border-gray-200 rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                      #
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                      Created By
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                      Activity & Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyData.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.createdBy}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 break-words">
                        <div className="flex items-center gap-2">
                          {/* Action type indicator */}
                          {item.actionType === 'created' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              📝 CREATED
                            </span>
                          )}
                          {item.actionType === 'status_changed' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              🔄 STATUS
                            </span>
                          )}
                          {item.actionType === 'comment_added' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              💬 COMMENT
                            </span>
                          )}
                          {item.actionType === 'field_changed' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              ✏️ FIELD CHANGED
                            </span>
                          )}
                          {item.actionType === 'updated' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              ✏️ UPDATED
                            </span>
                          )}
                          {item.actionType === 'scheduled' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                              📅 SCHEDULED
                            </span>
                          )}
                          {item.actionType === 'rescheduled' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              🔄 RESCHEDULED
                            </span>
                          )}
                          {!['created', 'status_changed', 'comment_added', 'field_changed', 'updated', 'scheduled', 'rescheduled'].includes(item.actionType) && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ❓ ACTIVITY
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm uppercase font-medium">
                          {item.changes}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <h3 className="text-lg font-medium mb-2">No history available</h3>
              <p>This interview has no recorded activities yet.</p>
            </div>
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewHistory;
