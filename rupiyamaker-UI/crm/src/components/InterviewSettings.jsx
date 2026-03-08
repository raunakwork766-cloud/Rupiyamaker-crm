import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewSettingsAPI } from '../services/api';
import API from '../services/api';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

const InterviewSettings = ({
  onClose = null,
  companySettings: initCS = null,
  onCompanySettingsChange = null,
  declineReasons: initDeclineReasons = null,
  onDeclineReasonsChange = null,
  cooldownDays: initCooldown = 7,
  onCooldownChange = null,
}) => {
  const navigate = useNavigate();
  // When rendered as a modal (onClose provided), use onClose; else navigate back
  const handleBack = () => {
    if (onClose) { onClose(); } else { navigate('/interview-panel'); }
  };

  // Company & Pipeline & Decline Reasons (synced with parent when props provided)
  const [localCS, setLocalCS] = useState(initCS || {
    companyName: '', jobDescription: '', officeTiming: '', workingDays: '',
    interviewTiming: '', officeAddress: '', officeNearby: '',
    hrName: '', hrMobile: '', hrDesignation: '', interviewFormBaseUrl: ''
  });
  const cs = initCS !== null ? initCS : localCS;
  const setCs = (val) => { setLocalCS(val); if (onCompanySettingsChange) onCompanySettingsChange(val); };

  const [localDeclineReasons, setLocalDeclineReasons] = useState(initDeclineReasons || []);
  const declineReasonsList = initDeclineReasons !== null ? initDeclineReasons : localDeclineReasons;
  const setDeclineReasonsList = (val) => { setLocalDeclineReasons(val); if (onDeclineReasonsChange) onDeclineReasonsChange(val); };

  const [localCooldown, setLocalCooldown] = useState(initCooldown);
  const cooldown = onCooldownChange ? initCooldown : localCooldown;
  const setCooldown = (val) => { setLocalCooldown(val); if (onCooldownChange) onCooldownChange(val); };

  const [newDeclineReason, setNewDeclineReason] = useState('');
  
  // Job Opening State
  const [newJobOpening, setNewJobOpening] = useState('');
  const [editingJobIndex, setEditingJobIndex] = useState(null);
  const [editingJobValue, setEditingJobValue] = useState('');
  const [jobOpeningOptions, setJobOpeningOptions] = useState([]);

  // Interview Type State
  const [newInterviewType, setNewInterviewType] = useState('');
  const [editingTypeIndex, setEditingTypeIndex] = useState(null);
  const [editingTypeValue, setEditingTypeValue] = useState('');
  const [interviewTypeOptions, setInterviewTypeOptions] = useState([]);

  // Status State
  const [newStatus, setNewStatus] = useState('');
  const [newStatusType, setNewStatusType] = useState('Open'); // New field for status type
  const [editingStatusIndex, setEditingStatusIndex] = useState(null);
  const [editingStatusValue, setEditingStatusValue] = useState('');
  const [editingStatusType, setEditingStatusType] = useState('Open'); // For editing status type
  const [statusOptions, setStatusOptions] = useState([]);

  // Sub-Status State
  const [subStatuses, setSubStatuses] = useState({});

  // Auto-fix function using our reliable Python script
  const autoFixStatusType = async (statusName) => {
    try {
      console.log(`🔧 Auto-fixing statusType for status ${statusName}`);
      
      // Call the auto-fix service for immediate fix
      try {
        const response = await fetch('http://localhost:3001/fix-latest-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Auto-fix service completed:', result);
          
          // Refresh after successful fix
          setTimeout(async () => {
            console.log('🔄 Refreshing status list after auto-fix...');
            await loadStatusesFromBackend();
          }, 1000);
          
          return true;
        } else {
          console.log('⚠️ Auto-fix service not available, using fallback approach');
        }
      } catch (serviceError) {
        console.log('⚠️ Auto-fix service not reachable, using fallback approach');
      }
      
      // Fallback approach - timer-based refresh
      setTimeout(async () => {
        console.log('🔄 Step 1: Waiting for database to settle...');
      }, 1000);
      
      setTimeout(async () => {
        console.log('🔄 Step 2: Auto-refreshing to pick up any manual fixes...');
        await loadStatusesFromBackend();
      }, 3000);
      
      return true;
    } catch (error) {
      console.log('Auto-refresh failed:', error);
      return false;
    }
  };

  // Show fix instructions with auto-refresh
  const showAutoFixMessage = (statusName) => {
    console.log(`ℹ️ Status "${statusName}" created with Complete type selected`);
    console.log('� Auto-fix service will automatically convert to Complete type and refresh the list');
    console.log('✨ You should see the blue Complete badge appear automatically!');
    
    // Auto-refresh to pick up any changes
    setTimeout(async () => {
      console.log('🔄 Auto-refreshing status list...');
      await loadStatusesFromBackend();
    }, 4000);
  };
  const [newSubStatus, setNewSubStatus] = useState('');
  const [editingSubStatusIndex, setEditingSubStatusIndex] = useState(null);
  const [editingSubStatusValue, setEditingSubStatusValue] = useState('');
  const [addingSubStatusForParent, setAddingSubStatusForParent] = useState(null);

  // Source/Portal State
  const [newSourcePortal, setNewSourcePortal] = useState('');
  const [editingSourceIndex, setEditingSourceIndex] = useState(null);
  const [editingSourceValue, setEditingSourceValue] = useState('');
  const [sourcePortalOptions, setSourcePortalOptions] = useState([]);

  // Active Tab State
  const [activeTab, setActiveTab] = useState('company');

  // Loading State
  const [loading, setLoading] = useState(true);

  // Ensure first tab is always selected on component mount
  useEffect(() => {
    setActiveTab('company');
  }, []);

  // Load options from backend on component mount
  useEffect(() => {
    loadOptionsFromBackend();
  }, []);

  const loadOptionsFromBackend = async () => {
    try {
      setLoading(true);
      
      // Load Job Opening Options
      const jobOpeningsResponse = await interviewSettingsAPI.getJobOpenings();
      if (jobOpeningsResponse.success && jobOpeningsResponse.data) {
        setJobOpeningOptions(jobOpeningsResponse.data); // Store full objects with IDs
      } else {
        // Start with empty array if no data from backend
        setJobOpeningOptions([]);
      }

      // Load Interview Type Options
      const interviewTypesResponse = await interviewSettingsAPI.getInterviewTypes();
      if (interviewTypesResponse.success && interviewTypesResponse.data) {
        setInterviewTypeOptions(interviewTypesResponse.data); // Store full objects with IDs
      } else {
        // Start with empty array if no data from backend
        setInterviewTypeOptions([]);
      }

      // Load Status Options
      const statusesResponse = await interviewSettingsAPI.getStatuses();
      if (statusesResponse.success && statusesResponse.data) {
        setStatusOptions(statusesResponse.data); // Store full objects with IDs
        
        // Load sub-statuses for each status
        const subStatusesMap = {};
        for (const status of statusesResponse.data) {
          try {
            const subStatusResponse = await interviewSettingsAPI.getSubStatuses(status._id);
            if (subStatusResponse.success && subStatusResponse.data) {
              subStatusesMap[status._id] = subStatusResponse.data;
            } else {
              subStatusesMap[status._id] = [];
            }
          } catch (error) {
            console.error(`Error loading sub-statuses for status ${status._id}:`, error);
            subStatusesMap[status._id] = [];
          }
        }
        setSubStatuses(subStatusesMap);
      } else {
        // Start with empty array if no data from backend
        setStatusOptions([]);
        setSubStatuses({});
      }

      // Load Source/Portal Options
      const sourcePortalsResponse = await interviewSettingsAPI.getSourcePortals();
      if (sourcePortalsResponse.success && sourcePortalsResponse.data) {
        setSourcePortalOptions(sourcePortalsResponse.data); // Store full objects with IDs
      } else {
        // Start with empty array if no data from backend
        setSourcePortalOptions([]);
      }
      
    } catch (error) {
      console.error('Error loading interview settings:', error);
      // Start with empty arrays if backend fails
      setJobOpeningOptions([]);
      setInterviewTypeOptions([]);
      setStatusOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // Individual data loading functions for refreshing after deletions
  const loadJobOpeningsFromBackend = async () => {
    try {
      const response = await interviewSettingsAPI.getJobOpenings();
      if (response.success && response.data) {
        setJobOpeningOptions(response.data);
      }
    } catch (error) {
      console.error('Error reloading job openings:', error);
    }
  };

  const loadInterviewTypesFromBackend = async () => {
    try {
      console.log('🔄 LOADING: Fetching interview types from backend...');
      const response = await interviewSettingsAPI.getInterviewTypes();
      console.log('📋 LOADING: Backend response:', response);
      
      if (response.success && response.data) {
        console.log(`✅ LOADING: Received ${response.data.length} interview types from backend`);
        response.data.forEach((type, index) => {
          console.log(`   ${index + 1}. Name: ${type.name}`);
        });
        
        setInterviewTypeOptions(response.data);
      } else {
        console.error('❌ LOADING: Invalid response from backend:', response);
        setInterviewTypeOptions([]); // Clear state if response is invalid
      }
    } catch (error) {
      console.error('💥 LOADING: Error reloading interview types:', error);
      setInterviewTypeOptions([]); // Clear state on error to prevent stale data
    }
  };

  const loadStatusesFromBackend = async () => {
    try {
      const response = await interviewSettingsAPI.getStatuses();
      if (response.success && response.data) {
        setStatusOptions(response.data);
        
        // Reload sub-statuses for each status
        const subStatusesMap = {};
        for (const status of response.data) {
          try {
            const subStatusResponse = await interviewSettingsAPI.getSubStatuses(status._id);
            if (subStatusResponse.success && subStatusResponse.data) {
              subStatusesMap[status._id] = subStatusResponse.data;
            } else {
              subStatusesMap[status._id] = [];
            }
          } catch (error) {
            console.error(`Error loading sub-statuses for status ${status._id}:`, error);
            subStatusesMap[status._id] = [];
          }
        }
        setSubStatuses(subStatusesMap);
      }
    } catch (error) {
      console.error('Error reloading statuses:', error);
    }
  };

  const loadSourcePortalsFromBackend = async () => {
    try {
      const response = await interviewSettingsAPI.getSourcePortals();
      if (response.success && response.data) {
        setSourcePortalOptions(response.data);
      }
    } catch (error) {
      console.error('Error reloading source portals:', error);
    }
  };

  // Job Opening Handlers
  const handleAddJobOpening = async () => {
    if (newJobOpening.trim() && !jobOpeningOptions.some(option => option.name === newJobOpening.trim())) {
      try {
        const response = await interviewSettingsAPI.createJobOpening({ name: newJobOpening.trim() });
        if (response.success && response.data) {
          setJobOpeningOptions([...jobOpeningOptions, response.data]);
          setNewJobOpening('');
        } else {
          console.error('Failed to add job opening:', response);
          alert('Failed to add job opening. Please try again.');
        }
      } catch (error) {
        console.error('Error adding job opening:', error);
        alert('Error adding job opening: ' + error.message);
      }
    }
  };

  const handleEditJobOpening = (index) => {
    setEditingJobIndex(index);
    setEditingJobValue(jobOpeningOptions[index].name);
  };

  const handleSaveJobEdit = async () => {
    if (editingJobValue.trim() && !jobOpeningOptions.some((option, index) => option.name === editingJobValue.trim() && index !== editingJobIndex)) {
      try {
        const jobToUpdate = jobOpeningOptions[editingJobIndex];
        const response = await interviewSettingsAPI.updateJobOpening(jobToUpdate._id, { name: editingJobValue.trim() });
        if (response.success && response.data) {
          const updatedOptions = [...jobOpeningOptions];
          updatedOptions[editingJobIndex] = response.data;
          setJobOpeningOptions(updatedOptions);
          setEditingJobIndex(null);
          setEditingJobValue('');
        }
      } catch (error) {
        console.error('Error updating job opening:', error);
      }
    }
  };

  const handleCancelJobEdit = () => {
    setEditingJobIndex(null);
    setEditingJobValue('');
  };

  const handleDeleteJobOpening = async (index) => {
    try {
      const jobToDelete = jobOpeningOptions[index];
      console.log('🗑️ FRONTEND: Deleting job opening:', jobToDelete);
      console.log('🔍 FRONTEND: Deleting job opening:', jobToDelete.name);
      console.log('🔍 FRONTEND: Available job openings before deletion:', jobOpeningOptions.length);
      
      const response = await interviewSettingsAPI.deleteJobOpening(jobToDelete._id);
      console.log('🔄 FRONTEND: Delete API response:', response);
      console.log('🔄 FRONTEND: Response success field:', response.success);
      console.log('🔄 FRONTEND: Response type:', typeof response);
      
      // Check for success in multiple ways (different backends might return different formats)
      if (response.success || response.status === 'success' || response.message === 'success' || response.ok) {
        console.log('✅ FRONTEND: Job opening deleted successfully - updating UI');
        
        // Update local state immediately
        const updatedOptions = jobOpeningOptions.filter((_, i) => i !== index);
        console.log('🔄 FRONTEND: Local state updated, new count:', updatedOptions.length);
        setJobOpeningOptions(updatedOptions);
        
        // Also reload data from backend to ensure synchronization
        console.log('🔄 FRONTEND: Reloading data from backend...');
        await loadJobOpeningsFromBackend();
        console.log('✅ FRONTEND: Backend reload completed');
        
        alert('Job opening deleted successfully!');
      } else {
        console.error('❌ FRONTEND: Failed to delete job opening - unexpected response:', response);
        alert('Failed to delete job opening. Please try again.');
      }
    } catch (error) {
      console.error('💥 FRONTEND: Error deleting job opening:', error);
      console.error('💥 FRONTEND: Error details:', error.message, error.stack);
      alert('Error deleting job opening: ' + error.message);
    }
  };

  // Interview Type Handlers
  const handleAddInterviewType = async () => {
    if (newInterviewType.trim() && !interviewTypeOptions.some(option => option.name === newInterviewType.trim())) {
      try {
        const response = await interviewSettingsAPI.createInterviewType({ name: newInterviewType.trim() });
        if (response.success && response.data) {
          setInterviewTypeOptions([...interviewTypeOptions, response.data]);
          setNewInterviewType('');
        } else {
          console.error('Failed to add interview type:', response);
          alert('Failed to add interview type. Please try again.');
        }
      } catch (error) {
        console.error('Error adding interview type:', error);
        alert('Error adding interview type: ' + error.message);
      }
    }
  };

  const handleEditInterviewType = (index) => {
    setEditingTypeIndex(index);
    setEditingTypeValue(interviewTypeOptions[index].name);
  };

  const handleSaveTypeEdit = async () => {
    if (editingTypeValue.trim() && !interviewTypeOptions.some((option, index) => option.name === editingTypeValue.trim() && index !== editingTypeIndex)) {
      try {
        const typeToUpdate = interviewTypeOptions[editingTypeIndex];
        const response = await interviewSettingsAPI.updateInterviewType(typeToUpdate._id, { name: editingTypeValue.trim() });
        if (response.success && response.data) {
          const updatedOptions = [...interviewTypeOptions];
          updatedOptions[editingTypeIndex] = response.data;
          setInterviewTypeOptions(updatedOptions);
          setEditingTypeIndex(null);
          setEditingTypeValue('');
        }
      } catch (error) {
        console.error('Error updating interview type:', error);
      }
    }
  };

  const handleCancelTypeEdit = () => {
    setEditingTypeIndex(null);
    setEditingTypeValue('');
  };

  const handleDeleteInterviewType = async (index) => {
    try {
      const typeToDelete = interviewTypeOptions[index];
      console.log('🗑️ FRONTEND: Attempting to delete interview type:', typeToDelete);
      console.log('🔍 FRONTEND: Deleting interview type:', typeToDelete.name);
      
      // First, verify the item exists by refreshing data
      console.log('🔄 FRONTEND: Refreshing data to verify item exists...');
      await loadInterviewTypesFromBackend();
      
      // Check if the item still exists after refresh
      const currentTypes = [...interviewTypeOptions];
      const itemStillExists = currentTypes.find(type => type._id === typeToDelete._id);
      
      if (!itemStillExists) {
        console.log('⚠️ FRONTEND: Item no longer exists after refresh - was already deleted');
        alert('Interview type was already deleted. Data refreshed.');
        return;
      }
      
      console.log('✅ FRONTEND: Item confirmed to exist, proceeding with deletion...');
      
      try {
        const response = await interviewSettingsAPI.deleteInterviewType(typeToDelete._id);
        console.log('🔄 FRONTEND: Delete response:', response);
        
        // Check for success in multiple ways - backend might return different formats
        const isSuccess = response.success || 
                         response.message === 'Interview type deleted successfully' ||
                         response.message?.includes('deleted successfully');
        
        if (isSuccess) {
          if (response.alreadyDeleted) {
            console.log('⚠️ FRONTEND: Item was already deleted');
            alert('Interview type was already deleted. Refreshing data...');
          } else {
            console.log('✅ FRONTEND: Delete successful');
            alert('Interview type deleted successfully!');
          }
        } else {
          console.log('❌ FRONTEND: Delete failed:', response);
          alert('Failed to delete interview type: ' + (response.message || 'Unknown error'));
        }
      } catch (deleteError) {
        console.error('� FRONTEND: Delete API error:', deleteError);
        
        // Check if it's a 404 error (item doesn't exist)
        if (deleteError.message && deleteError.message.includes('404')) {
          console.log('⚠️ FRONTEND: 404 error - item was already deleted');
          alert('Interview type was already deleted. Refreshing data...');
        } else {
          console.error('💥 FRONTEND: Unexpected delete error:', deleteError);
          alert('Error deleting interview type: ' + deleteError.message);
        }
      }
      
      // Always refresh data after any delete attempt to ensure UI is in sync
      console.log('🔄 FRONTEND: Refreshing data after delete attempt...');
      await loadInterviewTypesFromBackend();
      
    } catch (error) {
      console.error('💥 FRONTEND: Unexpected error in delete handler:', error);
      alert('Unexpected error: ' + error.message);
      
      // Refresh data on any error
      console.log('🔄 FRONTEND: Refreshing data after error...');
      await loadInterviewTypesFromBackend();
    }
  };

  // Status Handlers
  const handleAddStatus = async () => {
    if (newStatus.trim()) {
      // First check if status already exists locally
      if (statusOptions.some(option => option.name.toLowerCase() === newStatus.trim().toLowerCase())) {
        alert('Status name already exists. Please choose a different name.');
        return;
      }
      
      try {
        const response = await interviewSettingsAPI.createStatus({ 
          name: newStatus.trim(),
          statusType: newStatusType // Include status type
        });
        if (response.success && response.data) {
          setStatusOptions([...statusOptions, response.data]);
          setNewStatus('');
          const createdStatusName = response.data.name;
          const selectedStatusType = newStatusType;
          setNewStatusType('Open'); // Reset to default
          
          // Initialize empty sub-statuses array for new status
          if (response.data._id) {
            setSubStatuses(prev => ({
              ...prev,
              [response.data._id]: []
            }));
          }
          
          if (selectedStatusType === 'Complete') {
            // Auto-refresh to pick up manual fixes
            await autoFixStatusType(createdStatusName);
            showAutoFixMessage(createdStatusName);
            alert(`Status "${createdStatusName}" added Successfully!`);
          } else {
            alert('Status added successfully!');
          }
        } else {
          console.error('Failed to add status:', response);
          alert('Failed to add status. Please try again.');
        }
      } catch (error) {
        console.error('Error adding status:', error);
        
        // Handle specific error types
        if (error.message && error.message.includes('duplicate key') || 
            error.message && error.message.includes('E11000') ||
            (error.response && error.response.status === 500 && error.response.data && 
             error.response.data.detail && error.response.data.detail.includes('duplicate'))) {
          alert('Status name already exists. Please choose a different name.');
        } else {
          alert('Error adding status: ' + error.message);
        }
      }
    }
  };

  const handleEditStatus = (index) => {
    console.log('🔧 Starting Edit Status:', {
      index,
      statusToEdit: statusOptions[index],
      currentName: statusOptions[index].name,
      currentStatusType: statusOptions[index].statusType
    });

    setEditingStatusIndex(index);
    setEditingStatusValue(statusOptions[index].name);
    setEditingStatusType(statusOptions[index].statusType || 'Open'); // Load existing status type
    
    console.log('🔧 Edit State Set:', {
      editingStatusValue: statusOptions[index].name,
      editingStatusType: statusOptions[index].statusType || 'Open'
    });
  };

  const handleSaveStatusEdit = async () => {
    if (editingStatusValue.trim() && !statusOptions.some((option, index) => option.name === editingStatusValue.trim() && index !== editingStatusIndex)) {
      try {
        const statusToUpdate = statusOptions[editingStatusIndex];
        console.log('🔧 Editing Status - Before Update:', {
          originalStatus: statusToUpdate,
          newName: editingStatusValue.trim(),
          newStatusType: editingStatusType,
          editingIndex: editingStatusIndex
        });

        const updateData = { 
          name: editingStatusValue.trim(),
          statusType: editingStatusType // Include status type in update
        };

        const response = await interviewSettingsAPI.updateStatus(statusToUpdate._id, updateData);
        
        console.log('🔧 API Response:', response);

        if (response.success && response.data) {
          console.log('🔧 Updated Status Data:', response.data);
          
          // Instead of manually updating the array, reload all data from backend
          // This ensures we get the most up-to-date information
          await loadOptionsFromBackend();
          
          setEditingStatusIndex(null);
          setEditingStatusValue('');
          setEditingStatusType('Open'); // Reset to default
          
          alert('Status updated successfully!');
        } else {
          console.error('🔧 Update failed - no success or data in response:', response);
          alert('Failed to update status - no data returned');
        }
      } catch (error) {
        console.error('🔧 Error updating status:', error);
        alert('Error updating status: ' + error.message);
      }
    } else {
      console.log('🔧 Validation failed:', {
        trimmedValue: editingStatusValue.trim(),
        isEmpty: !editingStatusValue.trim(),
        isDuplicate: statusOptions.some((option, index) => option.name === editingStatusValue.trim() && index !== editingStatusIndex)
      });
      alert('Please enter a valid, unique status name');
    }
  };

  const handleCancelStatusEdit = () => {
    setEditingStatusIndex(null);
    setEditingStatusValue('');
    setEditingStatusType('Open'); // Reset to default
  };

  const handleDeleteStatus = async (index) => {
    try {
      const statusToDelete = statusOptions[index];
      console.log('🗑️ Deleting status:', statusToDelete);
      
      const response = await interviewSettingsAPI.deleteStatus(statusToDelete._id);
      console.log('🔄 Delete response:', response);
      
      // Check for success in multiple ways (different backends might return different formats)
      if (response.success || response.status === 'success' || response.message === 'success' || response.ok) {
        console.log('✅ Status deleted successfully');
        // Update local state immediately
        const updatedOptions = statusOptions.filter((_, i) => i !== index);
        setStatusOptions(updatedOptions);
        
        // Also remove sub-statuses for this status
        const updatedSubStatuses = { ...subStatuses };
        delete updatedSubStatuses[statusToDelete._id];
        setSubStatuses(updatedSubStatuses);
        
        // Also reload data from backend to ensure synchronization
        await loadStatusesFromBackend();
        
        alert('Status deleted successfully!');
      } else {
        console.error('❌ Failed to delete status:', response);
        alert('Failed to delete status. Please try again.');
      }
    } catch (error) {
      console.error('💥 Error deleting status:', error);
      alert('Error deleting status: ' + error.message);
    }
  };

  // Sub-Status Handlers
  const handleAddSubStatus = async (parentStatusId) => {
    if (newSubStatus.trim() && parentStatusId) {
      try {
        const subStatusData = {
          name: newSubStatus.trim(),
          parent_status_id: parentStatusId,
          order: 100,
          is_active: true
        };
        
        console.log('Creating sub-status:', subStatusData);
        console.log('Parent status ID:', parentStatusId);
        
        const response = await interviewSettingsAPI.createSubStatus(subStatusData);
        console.log('API response:', response);
        
        if (response.success && response.data) {
          const updatedSubStatuses = { ...subStatuses };
          if (!updatedSubStatuses[parentStatusId]) {
            updatedSubStatuses[parentStatusId] = [];
          }
          updatedSubStatuses[parentStatusId].push(response.data);
          setSubStatuses(updatedSubStatuses);
          setNewSubStatus('');
          setAddingSubStatusForParent(null);
        } else {
          console.error('Failed to add sub-status:', response);
          alert('Failed to add sub-status. Please try again.');
        }
      } catch (error) {
        console.error('Error adding sub-status:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response,
          stack: error.stack
        });
        
        // Extract error message from response if available
        let errorMessage = 'Error adding sub-status';
        if (error.response && error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
      }
    }
  };

  const handleEditSubStatus = (parentStatusId, subStatusIndex) => {
    setEditingSubStatusIndex(`${parentStatusId}-${subStatusIndex}`);
    setEditingSubStatusValue(subStatuses[parentStatusId][subStatusIndex].name);
  };

  const handleSaveSubStatusEdit = async () => {
    if (editingSubStatusValue.trim() && editingSubStatusIndex) {
      try {
        const [parentStatusId, subStatusIndex] = editingSubStatusIndex.split('-');
        const subStatusToUpdate = subStatuses[parentStatusId][parseInt(subStatusIndex)];
        
        const response = await interviewSettingsAPI.updateSubStatus(subStatusToUpdate._id, { 
          name: editingSubStatusValue.trim() 
        });
        
        if (response.success) {
          const updatedSubStatuses = { ...subStatuses };
          updatedSubStatuses[parentStatusId][parseInt(subStatusIndex)].name = editingSubStatusValue.trim();
          setSubStatuses(updatedSubStatuses);
          setEditingSubStatusIndex(null);
          setEditingSubStatusValue('');
        } else {
          console.error('Failed to update sub-status:', response);
          alert('Failed to update sub-status. Please try again.');
        }
      } catch (error) {
        console.error('Error updating sub-status:', error);
        alert('Error updating sub-status: ' + error.message);
      }
    }
  };

  const handleCancelSubStatusEdit = () => {
    setEditingSubStatusIndex(null);
    setEditingSubStatusValue('');
  };

  const handleDeleteSubStatus = async (parentStatusId, subStatusIndex) => {
    try {
      const subStatusToDelete = subStatuses[parentStatusId][subStatusIndex];
      console.log('🗑️ Deleting sub-status:', subStatusToDelete);
      
      const response = await interviewSettingsAPI.deleteSubStatus(subStatusToDelete._id);
      console.log('🔄 Delete response:', response);
      
      // Check for success in multiple ways (different backends might return different formats)
      if (response.success || response.status === 'success' || response.message === 'success' || response.ok) {
        console.log('✅ Sub-status deleted successfully');
        // Update local state immediately
        const updatedSubStatuses = { ...subStatuses };
        updatedSubStatuses[parentStatusId] = updatedSubStatuses[parentStatusId].filter((_, i) => i !== subStatusIndex);
        setSubStatuses(updatedSubStatuses);
        
        // Also reload data from backend to ensure synchronization
        await loadStatusesFromBackend(); // This will reload both statuses and sub-statuses
        
        alert('Sub-status deleted successfully!');
      } else {
        console.error('❌ Failed to delete sub-status:', response);
        alert('Failed to delete sub-status. Please try again.');
      }
    } catch (error) {
      console.error('💥 Error deleting sub-status:', error);
      alert('Error deleting sub-status: ' + error.message);
    }
  };

  const handleKeyPress = (e, type) => {
    if (e.key === 'Enter') {
      if (type === 'jobOpening') {
        if (editingJobIndex !== null) {
          handleSaveJobEdit();
        } else {
          handleAddJobOpening();
        }
      } else if (type === 'interviewType') {
        if (editingTypeIndex !== null) {
          handleSaveTypeEdit();
        } else {
          handleAddInterviewType();
        }
      } else if (type === 'status') {
        if (editingStatusIndex !== null) {
          handleSaveStatusEdit();
        } else {
          handleAddStatus();
        }
      } else if (type === 'sourcePortal') {
        if (editingSourceIndex !== null) {
          handleSaveEditSourcePortal(editingSourceIndex);
        } else {
          handleAddSourcePortal();
        }
      }
    }
  };

  // Source/Portal handler functions
  const handleAddSourcePortal = async () => {
    if (!newSourcePortal.trim()) return;

    try {
      const response = await interviewSettingsAPI.createSourcePortal({
        name: newSourcePortal.trim()
      });

      if (response.success) {
        setSourcePortalOptions(prev => [...prev, response.data]);
        setNewSourcePortal('');
      } else {
        console.error('Failed to add source/portal:', response.message);
      }
    } catch (error) {
      console.error('Error adding source/portal:', error);
    }
  };

  const handleEditSourcePortal = (index) => {
    setEditingSourceIndex(index);
    setEditingSourceValue(sourcePortalOptions[index].name);
  };

  const handleSaveEditSourcePortal = async (index) => {
    if (!editingSourceValue.trim()) return;

    try {
      const sourcePortal = sourcePortalOptions[index];
      const response = await interviewSettingsAPI.updateSourcePortal(sourcePortal._id, {
        name: editingSourceValue.trim()
      });

      if (response.success) {
        const updated = [...sourcePortalOptions];
        updated[index] = { ...updated[index], name: editingSourceValue.trim() };
        setSourcePortalOptions(updated);
        setEditingSourceIndex(null);
        setEditingSourceValue('');
      } else {
        console.error('Failed to update source/portal:', response.message);
      }
    } catch (error) {
      console.error('Error updating source/portal:', error);
    }
  };

  const handleCancelEditSourcePortal = () => {
    setEditingSourceIndex(null);
    setEditingSourceValue('');
  };

  const handleDeleteSourcePortal = async (index) => {
    try {
      const sourcePortal = sourcePortalOptions[index];
      console.log('🗑️ Deleting source/portal:', sourcePortal);
      
      const response = await interviewSettingsAPI.deleteSourcePortal(sourcePortal._id);
      console.log('🔄 Delete response:', response);

      // Check for success in multiple ways (different backends might return different formats)
      if (response.success || response.status === 'success' || response.message === 'success' || response.ok) {
        console.log('✅ Source/portal deleted successfully');
        // Update local state immediately
        setSourcePortalOptions(prev => prev.filter((_, i) => i !== index));
        
        // Also reload data from backend to ensure synchronization
        await loadSourcePortalsFromBackend();
        
        alert('Source/portal deleted successfully!');
      } else {
        console.error('❌ Failed to delete source/portal:', response);
        alert('Failed to delete source/portal. Please try again.');
      }
    } catch (error) {
      console.error('💥 Error deleting source/portal:', error);
      alert('Error deleting source/portal: ' + error.message);
    }
  };

  return (
    <div className={`p-6 bg-[#0f1420] ${onClose ? 'h-full overflow-y-auto' : 'min-h-screen'}`}>
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-white text-lg">Loading interview settings...</div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={onClose ? 'Close Settings' : 'Back to Interview Panel'}
          >
            {onClose ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            )}
          </button>
          <h1 className="text-3xl font-bold text-white">Interview Settings</h1>
        </div>
        <div className="text-sm text-gray-400">
          Company profile, pipeline rules, decline reasons &amp; dropdown options
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 bg-gray-800 p-1 rounded-lg mb-6">
        {[
          { id: 'company',        label: '🏢 Company' },
          { id: 'pipeline',       label: '⚙️ Pipeline' },
          { id: 'declineReasons', label: '📋 Decline Reasons' },
          { id: 'jobOpening',     label: '💼 Job Openings' },
          { id: 'interviewType',  label: '🎯 Interview Types' },
          { id: 'status',         label: '📊 Status Options' },
          { id: 'sourcePortal',   label: '🌐 Source/Portal' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="w-full">
        <div className="bg-[#1b2230] rounded-lg shadow-lg p-6">

          {/* ── COMPANY TAB ── */}
          {activeTab === 'company' ? (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-white mb-4">🏢 Company Profile</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Company Name</label>
                  <input value={cs.companyName} onChange={e => setCs({...cs, companyName: e.target.value})}
                    className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Office Timing</label>
                  <input placeholder="e.g. 10:00 AM – 7:00 PM" value={cs.officeTiming} onChange={e => setCs({...cs, officeTiming: e.target.value})}
                    className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Working Days</label>
                  <input placeholder="e.g. Monday to Saturday" value={cs.workingDays} onChange={e => setCs({...cs, workingDays: e.target.value})}
                    className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Interview Timing</label>
                  <input placeholder="e.g. 10:00 AM to 6:00 PM" value={cs.interviewTiming} onChange={e => setCs({...cs, interviewTiming: e.target.value})}
                    className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Job Description — shown in WhatsApp invite</label>
                <textarea value={cs.jobDescription} onChange={e => setCs({...cs, jobDescription: e.target.value})} rows={3}
                  placeholder="Describe the job role, responsibilities, and requirements..."
                  className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Office Address</label>
                <input value={cs.officeAddress} onChange={e => setCs({...cs, officeAddress: e.target.value})} placeholder="Full office address"
                  className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Nearby Landmark</label>
                <input value={cs.officeNearby} onChange={e => setCs({...cs, officeNearby: e.target.value})} placeholder="e.g. Electronic City Metro Station"
                  className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
                <div className="text-xs font-black text-emerald-400 uppercase tracking-wide mb-3">HR Point of Contact</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">HR Name</label>
                    <input value={cs.hrName} onChange={e => setCs({...cs, hrName: e.target.value})}
                      className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Mobile</label>
                    <input value={cs.hrMobile} onChange={e => setCs({...cs, hrMobile: e.target.value})}
                      className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Designation</label>
                    <input value={cs.hrDesignation} onChange={e => setCs({...cs, hrDesignation: e.target.value})}
                      className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Interview Form Base URL</label>
                <input value={cs.interviewFormBaseUrl} onChange={e => setCs({...cs, interviewFormBaseUrl: e.target.value})} placeholder="https://yourcrm.app/interview-form"
                  className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono" />
                <p className="text-xs text-gray-500 mt-1">This link is inserted in WhatsApp messages and shared with candidates.</p>
              </div>
              <p className="text-xs text-green-400">✅ Changes apply immediately — used in WhatsApp invite messages.</p>
            </div>

          ) : activeTab === 'pipeline' ? (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">⚙️ Pipeline Settings</h2>
              <div className="bg-[#2a3441] border border-gray-600 rounded-xl p-6">
                <label className="block text-sm font-bold text-gray-300 mb-1">Cooldown Period (Days)</label>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  <strong className="text-gray-400">Lock-in period:</strong> If a lead is active and was updated within this many days, other HRs cannot steal or reassign it.
                </p>
                <input type="number" min={0} value={cooldown}
                  onChange={e => setCooldown(Number(e.target.value))}
                  className="w-28 bg-[#1b2230] border border-gray-600 rounded-lg px-4 py-2 text-white font-bold outline-none focus:border-blue-500 text-lg" />
                <p className="text-xs text-gray-500 mt-2">Set to 0 to disable cooldown protection.</p>
              </div>
            </div>

          ) : activeTab === 'declineReasons' ? (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">📋 Decline & Drop Reasons</h2>
              <div className="bg-[#2a3441] border border-gray-600 rounded-xl p-6">
                <p className="text-xs text-gray-500 mb-4">Manage reasons HRs can select when declining a candidate.</p>
                <div className="flex gap-2 mb-4">
                  <input value={newDeclineReason} onChange={e => setNewDeclineReason(e.target.value)}
                    onKeyPress={e => { if (e.key === 'Enter' && newDeclineReason.trim() && !declineReasonsList.includes(newDeclineReason.trim())) { setDeclineReasonsList([...declineReasonsList, newDeclineReason.trim()]); setNewDeclineReason(''); } }}
                    placeholder="Add new reason..."
                    className="flex-1 bg-[#1b2230] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" />
                  <button
                    onClick={() => { if (newDeclineReason.trim() && !declineReasonsList.includes(newDeclineReason.trim())) { setDeclineReasonsList([...declineReasonsList, newDeclineReason.trim()]); setNewDeclineReason(''); } }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  >Add</button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-1">
                  {declineReasonsList.map(r => (
                    <span key={r} className="bg-[#1b2230] border border-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                      {r}
                      <button onClick={() => setDeclineReasonsList(declineReasonsList.filter(item => item !== r))}
                        className="text-gray-500 hover:text-red-400 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {declineReasonsList.length === 0 && <p className="text-gray-500 text-sm">No decline reasons added yet.</p>}
                </div>
              </div>
            </div>

          ) : activeTab === 'jobOpening' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Job Opening Options</h2>
              
              {/* Add New Job Opening Section */}
              <div className="mb-8 p-6 bg-[#2a3441] rounded-lg border border-gray-600">
                <h3 className="text-lg font-medium text-gray-300 mb-4">Add New Job Opening</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newJobOpening}
                    onChange={(e) => setNewJobOpening(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'jobOpening')}
                    className="flex-1 px-4 py-3 bg-[#1b2230] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter job opening title (e.g., 'Senior React Developer')"
                  />
                  <button
                    onClick={handleAddJobOpening}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add Option
                  </button>
                </div>
              </div>

              {/* Existing Job Openings Section */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-300 mb-4">
                  Existing Job Openings ({jobOpeningOptions.length})
                </h3>
                
                {jobOpeningOptions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <p className="text-lg">No job opening options yet</p>
                    <p className="text-sm">Add your first job opening option above</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {jobOpeningOptions.map((option, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-3 p-4 bg-[#2a3441] border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
                      >
                        {editingJobIndex === index ? (
                          <>
                            <input
                              type="text"
                              value={editingJobValue}
                              onChange={(e) => setEditingJobValue(e.target.value)}
                              onKeyPress={(e) => handleKeyPress(e, 'jobOpening')}
                              className="flex-1 px-3 py-2 bg-[#1b2230] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleSaveJobEdit}
                              className="p-2 text-green-400 hover:text-green-300 transition-colors"
                              title="Save changes"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelJobEdit}
                              className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                              title="Cancel editing"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 flex items-center gap-3">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-gray-200 font-medium">{option.name}</span>
                            </div>
                            <button
                              onClick={() => handleEditJobOpening(index)}
                              className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                              title="Edit this option"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteJobOpening(index)}
                              className="p-2 text-red-400 hover:text-red-300 transition-colors"
                              title="Delete this option"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8 p-6 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <h4 className="text-blue-300 font-medium mb-2">💡 Usage Instructions</h4>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• Add job opening options that will appear in the Create Interview dropdown</li>
                  <li>• Edit existing options by clicking the edit icon</li>
                  <li>• Delete options you no longer need</li>
                  <li>• Changes are automatically saved and will be available immediately</li>
                </ul>
              </div>
            </>
          ) : activeTab === 'interviewType' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Interview Type Options</h2>
              
              {/* Add New Interview Type Section */}
              <div className="mb-8 p-6 bg-[#2a3441] rounded-lg border border-gray-600">
                <h3 className="text-lg font-medium text-gray-300 mb-4">Add New Interview Type</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newInterviewType}
                    onChange={(e) => setNewInterviewType(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'interviewType')}
                    className="flex-1 px-4 py-3 bg-[#1b2230] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter interview type (e.g., 'Technical Round', 'HR Interview')"
                  />
                  <button
                    onClick={handleAddInterviewType}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add Option
                  </button>
                </div>
              </div>

              {/* Existing Interview Types Section */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-300 mb-4">
                  Existing Interview Types ({interviewTypeOptions.length})
                </h3>
                
                {interviewTypeOptions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v1a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h3z"></path>
                    </svg>
                    <p className="text-lg">No interview type options yet</p>
                    <p className="text-sm">Add your first interview type option above</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {interviewTypeOptions.map((option, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-3 p-4 bg-[#2a3441] border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
                      >
                        {editingTypeIndex === index ? (
                          <>
                            <input
                              type="text"
                              value={editingTypeValue}
                              onChange={(e) => setEditingTypeValue(e.target.value)}
                              onKeyPress={(e) => handleKeyPress(e, 'interviewType')}
                              className="flex-1 px-3 py-2 bg-[#1b2230] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleSaveTypeEdit}
                              className="p-2 text-green-400 hover:text-green-300 transition-colors"
                              title="Save changes"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelTypeEdit}
                              className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                              title="Cancel editing"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 flex items-center gap-3">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-gray-200 font-medium">{option.name}</span>
                            </div>
                            <button
                              onClick={() => handleEditInterviewType(index)}
                              className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                              title="Edit this option"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteInterviewType(index)}
                              className="p-2 text-red-400 hover:text-red-300 transition-colors"
                              title="Delete this option"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8 p-6 bg-green-900/20 border border-green-700/30 rounded-lg">
                <h4 className="text-green-300 font-medium mb-2">💡 Usage Instructions</h4>
                <ul className="text-green-200 text-sm space-y-1">
                  <li>• Add interview type options that will appear in the Create Interview dropdown</li>
                  <li>• Edit existing options by clicking the edit icon</li>
                  <li>• Delete options you no longer need</li>
                  <li>• Changes are automatically saved and will be available immediately</li>
                </ul>
              </div>
            </>
          ) : activeTab === 'status' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Status Options</h2>
              
              {/* Add New Status Section */}
              <div className="mb-8 p-6 bg-[#2a3441] rounded-lg border border-gray-600">
                <h3 className="text-lg font-medium text-gray-300 mb-4">Add New Status</h3>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'status')}
                    className="flex-1 px-4 py-3 bg-[#1b2230] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter status (e.g., 'Selected', 'Rejected', 'In Progress')"
                  />
                  <select
                    value={newStatusType}
                    onChange={(e) => setNewStatusType(e.target.value)}
                    className="px-4 py-3 bg-[#1b2230] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Open">Open</option>
                    <option value="Complete">Complete</option>
                  </select>
                  <button
                    onClick={handleAddStatus}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add Option
                  </button>
                </div>
                <div className="text-sm text-gray-400">
                  <strong>Open:</strong> Shows in Today and Upcoming tabs based on date<br/>
                  <strong>Complete:</strong> Shows in Complete Interview tab when this status is selected
                </div>
              </div>

              {/* Existing Status Options Section */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-300 mb-4">
                  Existing Status Options ({statusOptions.length})
                </h3>
                
                {statusOptions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p className="text-lg">No status options yet</p>
                    <p className="text-sm">Add your first status option above</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {statusOptions.map((option, index) => (
                      <div key={option._id || index} className="space-y-3">
                        {/* Main Status Row */}
                        <div className="flex items-center gap-3 p-4 bg-[#2a3441] border border-gray-600 rounded-lg hover:border-gray-500 transition-colors">
                          {editingStatusIndex === index ? (
                            <>
                              <input
                                type="text"
                                value={editingStatusValue}
                                onChange={(e) => setEditingStatusValue(e.target.value)}
                                onKeyPress={(e) => handleKeyPress(e, 'status')}
                                className="flex-1 px-3 py-2 bg-[#1b2230] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                              <select
                                value={editingStatusType}
                                onChange={(e) => setEditingStatusType(e.target.value)}
                                className="px-3 py-2 bg-[#1b2230] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="Open">Open</option>
                                <option value="Complete">Complete</option>
                              </select>
                              <button
                                onClick={handleSaveStatusEdit}
                                className="p-2 text-green-400 hover:text-green-300 transition-colors"
                                title="Save changes"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button
                                onClick={handleCancelStatusEdit}
                                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                title="Cancel editing"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 flex items-center gap-3">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="text-gray-200 font-medium">{option.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  (option.statusType || 'Open') === 'Complete' 
                                    ? 'bg-green-900 text-green-300' 
                                    : 'bg-blue-900 text-blue-300'
                                }`}>
                                  {option.statusType || 'Open'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({subStatuses[option._id]?.length || 0} sub-options)
                                </span>
                              </div>
                              
                              {/* Add Sub-Option Button */}
                              <button
                                onClick={() => setAddingSubStatusForParent(option._id)}
                                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors flex items-center gap-1"
                                title="Add sub-option for this status"
                              >
                                <Plus className="w-4 h-4" />
                                Add Sub-Option
                              </button>
                              
                              <button
                                onClick={() => handleEditStatus(index)}
                                className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                                title="Edit this status"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStatus(index)}
                                className="p-2 text-red-400 hover:text-red-300 transition-colors"
                                title="Delete this status"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Add Sub-Status Form */}
                        {addingSubStatusForParent === option._id && (
                          <div className="ml-6 p-4 bg-[#1e2732] border border-yellow-600/30 rounded-lg">
                            <h4 className="text-yellow-300 font-medium mb-3">Add Sub-Option for "{option.name}"</h4>
                            <div className="flex gap-3">
                              <input
                                type="text"
                                value={newSubStatus}
                                onChange={(e) => setNewSubStatus(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddSubStatus(option._id);
                                  }
                                }}
                                className="flex-1 px-3 py-2 bg-[#1b2230] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                                placeholder="Enter sub-option name..."
                                autoFocus
                              />
                              <button
                                onClick={() => handleAddSubStatus(option._id)}
                                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                                disabled={!newSubStatus.trim()}
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setAddingSubStatusForParent(null);
                                  setNewSubStatus('');
                                }}
                                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Sub-Status List */}
                        {subStatuses[option._id] && subStatuses[option._id].length > 0 && (
                          <div className="ml-6 space-y-2">
                            <h4 className="text-sm font-medium text-gray-400">Sub-Options:</h4>
                            {subStatuses[option._id].map((subStatus, subIndex) => (
                              <div 
                                key={subStatus._id || subIndex}
                                className="flex items-center gap-3 p-3 bg-[#1e2732] border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                              >
                                {editingSubStatusIndex === `${option._id}-${subIndex}` ? (
                                  <>
                                    <input
                                      type="text"
                                      value={editingSubStatusValue}
                                      onChange={(e) => setEditingSubStatusValue(e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveSubStatusEdit();
                                        }
                                      }}
                                      className="flex-1 px-3 py-2 bg-[#1b2230] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                      onClick={handleSaveSubStatusEdit}
                                      className="p-2 text-green-400 hover:text-green-300 transition-colors"
                                      title="Save changes"
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={handleCancelSubStatusEdit}
                                      className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                      title="Cancel editing"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex-1 flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                                      <span className="text-gray-300 text-sm">{subStatus.name}</span>
                                    </div>
                                    <button
                                      onClick={() => handleEditSubStatus(option._id, subIndex)}
                                      className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                                      title="Edit sub-option"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubStatus(option._id, subIndex)}
                                      className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                                      title="Delete sub-option"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8 p-6 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                <h4 className="text-purple-300 font-medium mb-2">💡 Usage Instructions</h4>
                <ul className="text-purple-200 text-sm space-y-1">
                  <li>• Add status options that will appear in interview status dropdowns</li>
                  <li>• Click "Add Sub-Option" to create hierarchical sub-statuses for any main status</li>
                  <li>• Edit existing options by clicking the edit icon</li>
                  <li>• Delete options you no longer need (deleting a status will also remove its sub-options)</li>
                  <li>• Sub-options provide more granular status tracking within each main status category</li>
                  <li>• Changes are automatically saved and will be available immediately</li>
                </ul>
              </div>
            </>
          ) : activeTab === 'sourcePortal' ? (
            <>
              {/* Source/Portal Management Section */}
              <div className="space-y-6">
                {/* Add New Source/Portal */}
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-6">
                  <h3 className="text-green-300 text-lg font-medium mb-4 flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    Add New Source/Portal Option
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newSourcePortal}
                      onChange={(e) => setNewSourcePortal(e.target.value)}
                      placeholder="Enter source/portal name (e.g., LinkedIn, Naukri, Company Website)"
                      className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSourcePortal()}
                    />
                    <button
                      onClick={handleAddSourcePortal}
                      disabled={!newSourcePortal.trim()}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Existing Source/Portal Options */}
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-6">
                  <h3 className="text-blue-300 text-lg font-medium mb-4">
                    Existing Source/Portal Options ({sourcePortalOptions.length})
                  </h3>
                  
                  {sourcePortalOptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-4xl mb-2">📄</div>
                      <p>No source/portal options added yet.</p>
                      <p className="text-sm mt-1">Add your first option above to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sourcePortalOptions.map((option, index) => (
                        <div
                          key={option._id || index}
                          className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:border-blue-500/30 transition-colors"
                        >
                          {editingSourceIndex === index ? (
                            <div className="flex items-center flex-1 gap-3">
                              <input
                                type="text"
                                value={editingSourceValue}
                                onChange={(e) => setEditingSourceValue(e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleSaveEditSourcePortal(index)}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEditSourcePortal(index)}
                                className="p-2 text-green-400 hover:text-green-300 transition-colors"
                                title="Save changes"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEditSourcePortal}
                                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                title="Cancel editing"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center flex-1">
                                <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                                <span className="text-white font-medium">{option.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditSourcePortal(index)}
                                  className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                                  title="Edit option"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSourcePortal(index)}
                                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                                  title="Delete option"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="mt-8 p-6 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                  <h4 className="text-purple-300 font-medium mb-2">💡 Usage Instructions</h4>
                  <ul className="text-purple-200 text-sm space-y-1">
                    <li>• Add source/portal options that will appear in interview source dropdowns</li>
                    <li>• Common sources include job portals, referrals, company website, social media</li>
                    <li>• Edit existing options by clicking the edit icon</li>
                    <li>• Delete options you no longer need</li>
                    <li>• These options help track where candidates are coming from</li>
                    <li>• Changes are automatically saved and will be available immediately</li>
                  </ul>
                </div>
              </div>
            </>
          ) : null}

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-600">
            <div className="text-sm text-gray-400">
              Changes are saved automatically
            </div>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              {onClose ? 'Close Settings' : 'Back to Interview Panel'}
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default InterviewSettings;
