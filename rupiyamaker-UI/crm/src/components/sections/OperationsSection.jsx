import React, { useState, useEffect, useRef } from "react";
import { message } from "antd";
import axios from 'axios';
import { hasPermission, getUserPermissions } from '../../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// LoginPersonPopup component for selecting multiple login persons
function LoginPersonPopup({ onClose, onSelect, users = [], selectedPersons = [] }) {
  const [searchName, setSearchName] = useState("");
  const [tempSelectedPersons, setTempSelectedPersons] = useState(selectedPersons);

  // Create a list of users for login person selection - filter by login department and include designations
  const availableUsers = users.length > 0 
    ? users
        .filter(user => {
          // Filter to show only users from login department
          const userDepartment = user.department_name || user.department || '';
          return userDepartment.toLowerCase().includes('login');
        })
        .map(user => ({
          id: user.id || user._id || user.user_id,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.id,
          designation: user.designation || user.designation_name || user.role_name || 'No designation',
          department: user.department_name || user.department || 'No department'
        }))
    : []; // Empty array if no API data

  const [filteredUsers, setFilteredUsers] = useState(availableUsers);

  useEffect(() => {
    setFilteredUsers(availableUsers); // Update when availableUsers changes
  }, [availableUsers]);

  useEffect(() => {
    if (searchName.trim() === "") {
      setFilteredUsers(availableUsers);
    } else {
      setFilteredUsers(
        availableUsers.filter((user) =>
          user.name.toLowerCase().includes(searchName.toLowerCase())
        )
      );
    }
  }, [searchName, users, availableUsers]); // Added availableUsers dependency

  const handleConfirmSelection = () => {
    onSelect(tempSelectedPersons);
    onClose();
  };

  const toggleUserSelection = (selectedUser) => {
    setTempSelectedPersons(prev => {
      const isSelected = prev.some(person => person.id === selectedUser.id);
      if (isSelected) {
        // Remove user
        return prev.filter(person => person.id !== selectedUser.id);
      } else {
        // Add user
        return [...prev, selectedUser];
      }
    });
  };

  const isUserSelected = (userId) => {
    return tempSelectedPersons.some(person => person.id === userId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      <div className="bg-white backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[90%] max-w-md mx-auto relative">
        <div className="flex items-center mb-4 p-3">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-lg text-black">Select Login Department Persons</h3>
          <p className="text-sm text-gray-600 mt-1">Choose employees from the login department with their designations</p>
        </div>

        <div className="mb-4 p-3">
          <label className="block font-bold text-gray-700 mb-2">
            Search Login Persons
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 border border-cyan-400 rounded text-black font-bold"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search login department employees..."
            />
            {searchName && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchName("")}
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Selected persons count */}
        {tempSelectedPersons.length > 0 && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm text-blue-800 font-semibold">
              {tempSelectedPersons.length} person(s) selected
            </span>
          </div>
        )}

        <ul className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg">
          {availableUsers.length > 0 ? (
            filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                                  <li
                    key={user.id || user.name}
                    className="p-3 border-b last:border-b-0 cursor-pointer text-black transition hover:bg-gray-100 flex items-center"
                    onClick={() => toggleUserSelection(user)}
                  >
                    <div className="flex items-center flex-1">
                      <input
                        type="checkbox"
                        checked={isUserSelected(user.id)}
                        onChange={() => toggleUserSelection(user)}
                        className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="w-10 h-10 rounded-full bg-[#00bcd4] text-white flex items-center justify-center mr-3 flex-shrink-0 font-semibold">
                        {user.name.split(' ')
                          .map(part => part[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-black">{user.name}</span>
                        <span className="text-sm text-gray-600">{user.designation}</span>
                        <span className="text-xs text-gray-500">{user.department}</span>
                      </div>
                    </div>
                  </li>
              ))
            ) : (
              searchName.trim() !== "" && (
                <li className="p-3 text-gray-500 text-center">No matching users found in login department.</li>
              )
            )
          ) : (
            <li className="p-3 text-gray-500 text-center">Loading login department users...</li>
          )}
        </ul>

        <div className="flex justify-end gap-4 mt-4 p-3">
          <button
            className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition"
            onClick={handleConfirmSelection}
          >
            Confirm Selection ({tempSelectedPersons.length})
          </button>
          <button
            className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-2xl font-bold"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function OperationsSection({ lead, onSave, canEdit = true }) {
  // For safety, ensure lead has default values to prevent errors
  const safetyLead = lead || {};

  // Refs for cursor management
  const percentageInputRef = useRef(null);

  // State for operations fields editing
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // State for form data (operations fields)
  const [formData, setFormData] = useState({
    login_sent_date: safetyLead.login_sent_date || new Date().toISOString().split('T')[0],
    login_person: safetyLead.login_person || [], // Changed to array for multiple persons
    channel_name: safetyLead.channel_name || '',
    los_number: safetyLead.los_number || '',
    amount_approved: safetyLead.amount_approved || '',
    amount_disbursed: safetyLead.amount_disbursed || '',
    internal_top: safetyLead.internal_top || '',
    cashback_to_customer: safetyLead.cashback_to_customer || '',
    net_disbursement_amount: safetyLead.net_disbursement_amount || '',
    rate_percentage: safetyLead.rate_percentage || '',
    tenure_given: safetyLead.tenure_given || '',
    pf_and_insurance: safetyLead.pf_and_insurance || '',
    disbursement_date: safetyLead.disbursement_date || ''
  });

  // State for dropdowns and popup
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [showLoginPersonPopup, setShowLoginPersonPopup] = useState(false);
  const [channelOptions, setChannelOptions] = useState([]);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [assignableUsers, setAssignableUsers] = useState([]); // Same naming as AboutSection
  const [showChannelTooltip, setShowChannelTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Label styling (matching LoginFormSection)
  const labelClass = "block font-bold mb-2 uppercase";
  const labelStyle = { color: "black", fontWeight: 650, fontSize: "15px" };

  // Refs for dropdown click outside detection
  const channelDropdownRef = useRef(null);

  // Utility functions for formatting (matching login.html)
  const formatIndianCurrency = (num) => {
    if (!num) return '';
    
    // Remove any existing formatting
    let cleanNum = num.toString().replace(/[^\d]/g, '');
    if (!cleanNum) return '';
    
    // Convert to Indian format (lakhs system)
    let formatted = '';
    let numStr = cleanNum;
    
    if (numStr.length <= 3) {
      formatted = numStr;
    } else if (numStr.length <= 5) {
      formatted = numStr.slice(0, -3) + ',' + numStr.slice(-3);
    } else if (numStr.length <= 7) {
      formatted = numStr.slice(0, -5) + ',' + numStr.slice(-5, -3) + ',' + numStr.slice(-3);
    } else if (numStr.length <= 9) {
      formatted = numStr.slice(0, -7) + ',' + numStr.slice(-7, -5) + ',' + numStr.slice(-5, -3) + ',' + numStr.slice(-3);
    } else {
      // For numbers larger than crores
      let groups = [];
      let remaining = numStr;
      
      // First group of 3 digits from right
      groups.unshift(remaining.slice(-3));
      remaining = remaining.slice(0, -3);
      
      // Then groups of 2 digits
      while (remaining.length > 0) {
        if (remaining.length <= 2) {
          groups.unshift(remaining);
          break;
        } else {
          groups.unshift(remaining.slice(-2));
          remaining = remaining.slice(0, -2);
        }
      }
      
      formatted = groups.join(',');
    }
    
    return 'Rs ' + formatted;
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en', { month: 'short' });
    const year = date.getFullYear();
    
    // Add ordinal suffix
    let dayWithSuffix;
    if (day >= 11 && day <= 13) {
      dayWithSuffix = day + 'th';
    } else {
      switch (day % 10) {
        case 1: dayWithSuffix = day + 'st'; break;
        case 2: dayWithSuffix = day + 'nd'; break;
        case 3: dayWithSuffix = day + 'rd'; break;
        default: dayWithSuffix = day + 'th';
      }
    }
    
    return `${dayWithSuffix} ${month} ${year}`;
  };

  const formatDateTimeDisplay = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en', { month: 'short' });
    const year = date.getFullYear();
    
    // Format time in 12-hour format
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    minutes = minutes < 10 ? '0' + minutes : minutes;
    const timeString = `${hours}:${minutes} ${ampm}`;
    
    // Add ordinal suffix
    let dayWithSuffix;
    if (day >= 11 && day <= 13) {
      dayWithSuffix = day + 'th';
    } else {
      switch (day % 10) {
        case 1: dayWithSuffix = day + 'st'; break;
        case 2: dayWithSuffix = day + 'nd'; break;
        case 3: dayWithSuffix = day + 'rd'; break;
        default: dayWithSuffix = day + 'th';
      }
    }
    
    return `${dayWithSuffix} ${month} ${year} ${timeString}`;
  };

  // Permission check for channel access
  const canAccessChannel = () => {
    const userPermissions = getUserPermissions();
    
    // Check for specific login channel permission
    const hasSpecificPermission = hasPermission(userPermissions, 'login', 'channel');
    
    // Check for superadmin permission (page "*" and actions "*")
    const hasSuperAdminPermission = hasPermission(userPermissions, '*', '*');
    
    return hasSpecificPermission || hasSuperAdminPermission;
  };

  // Channel tooltip helper functions
  const handleChannelTooltipEnter = (channelName, event) => {
    if (event && event.target) {
      const rect = event.target.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      setTooltipPosition({
        top: rect.top + scrollTop - 10, // Position above the icon
        left: rect.left + scrollLeft - 250 // Position to the left of icon (tooltip width is 256px)
      });
    }
    setShowChannelTooltip(channelName);
  };

  const handleChannelTooltipLeave = () => {
    setShowChannelTooltip(null);
  };

  // Get channel description from API data
  const getChannelDescription = (channelName) => {
    console.log('🔍 Looking for description for channel:', channelName);
    console.log('📋 Available channelOptions:', channelOptions);
    
    // Find the channel object in channelOptions
    const channelObject = channelOptions.find(option => {
      const optionName = typeof option === 'string' ? option : option.name;
      console.log('🔍 Comparing:', optionName, 'with', channelName);
      return optionName === channelName;
    });
    
    console.log('📦 Found channel object:', channelObject);
    
    if (channelObject && typeof channelObject === 'object') {
      if (channelObject.description && channelObject.description.trim()) {
        console.log('✅ Found description:', channelObject.description);
        // Return the actual description from the database
        return channelObject.description;
      } else {
        console.log('⚠️ Channel object exists but no description field or empty');
      }
    }
    
    // Fallback if no description available
    console.log('❌ Using fallback description for:', channelName);
    return `Channel: ${channelName}\nNo description available\nContact admin to add description`;
  };

  // State for filtered options
  const filteredChannelOptions = channelOptions.filter(option => {
    // Handle both string (legacy) and object (new) formats
    const channelName = typeof option === 'string' ? option : option.name;
    const isActive = typeof option === 'string' ? true : (option.is_active !== false); // Default to true if not specified
    
    return channelName && 
           isActive && 
           channelName.toLowerCase().includes(channelSearchQuery.toLowerCase());
  });

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowChannelDropdown(false);
        setChannelSearchQuery('');
        setShowChannelTooltip(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get user_id from localStorage
        const userData = localStorage.getItem('userData');
        if (!userData) {
          console.error('No user data found');
          return;
        }
        
        const { user_id } = JSON.parse(userData);
        
        // Load channel names with user_id parameter - only if user has permission
        if (canAccessChannel()) {
          try {
            const BASE_URL = '/api';
            const response = await axios.get(`${BASE_URL}/settings/channel-names?user_id=${user_id}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
              }
            });
            
            console.log('🔍 Channel API Response:', response.data);
            
            // SettingsPage API returns array of channel objects with {name, description, is_active}
            if (Array.isArray(response.data)) {
              console.log('📋 Channel data is array:', response.data);
              setChannelOptions(response.data);
            } else if (response.data.channel_names && Array.isArray(response.data.channel_names)) {
              console.log('📋 Channel data has channel_names property:', response.data.channel_names);
              setChannelOptions(response.data.channel_names);
            } else {
              console.log('⚠️ Unexpected channel data format:', response.data);
            }
          } catch (error) {
            console.error('❌ Channel API failed:', error);
          }
        }

        // Load assignable users using the exact same logic as AboutSection
        await fetchAssignableUsers();

      } catch (error) {
        console.error('Error loading dropdown data:', error);
      }
    };

    loadData();
  }, []);

  // Fetch assignable users from API - enhanced to get users with department and designation info
  const fetchAssignableUsers = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/leads/assignment-options?user_id=${userId}&show_all_users=true`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Get all users with enhanced information
        let allUsers = [];
        
        // If we have departments data, get users from all departments to find login department
        if (data.departments && data.departments.length > 0) {
          for (const dept of data.departments) {
            try {
              const deptResponse = await fetch(`${API_BASE_URL}/leads/assignment-options?user_id=${userId}&department_id=${dept.id}&show_all_users=true`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (deptResponse.ok) {
                const deptData = await deptResponse.json();
                if (deptData.users && deptData.users.length > 0) {
                  // Add department info to each user
                  const usersWithDept = deptData.users.map(user => ({
                    ...user,
                    department_name: dept.name || dept.department_name || 'Unknown Department',
                    department_id: dept.id
                  }));
                  allUsers.push(...usersWithDept);
                }
              }
            } catch (error) {
              console.error(`Error fetching users for department ${dept.name}:`, error);
            }
          }
        }
        
        // If no users from departments, use the direct users array
        if (allUsers.length === 0 && data.users) {
          allUsers = data.users;
        }
        
        setAssignableUsers(allUsers);
      }
    } catch (error) {
      console.error('Error fetching assignable users:', error);
      // Set some default users if API fails
      setAssignableUsers([]);
    }
  };

  // Handle channel selection
  const handleChannelSelect = (channel) => {
    // Extract channel name from object or use string directly
    const channelName = typeof channel === 'string' ? channel : channel.name;
    handleInputChange('channel_name', channelName);
    setShowChannelDropdown(false);
    setChannelSearchQuery('');
    setShowChannelTooltip(null);
    // Immediately save when channel is selected
    handleInputBlur('channel_name', channelName);
  };

  // Handle login person selection from popup
  const handleLoginPersonSelect = (selectedPersons) => {
    const personIds = selectedPersons.map(person => person.id);
    handleInputChange('login_person', personIds);
    setShowLoginPersonPopup(false);
    // Immediately save when login persons are selected
    handleInputBlur('login_person', personIds);
  };

  // Helper function to get person names by IDs - enhanced to show designation
  const getPersonNamesByIds = (personIds) => {
    if (!personIds || !Array.isArray(personIds) || personIds.length === 0) return 'No persons selected';
    
    const names = personIds.map(personId => {
      const person = assignableUsers.find(p => p.id === personId || p._id === personId);
      if (person) {
        const name = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim();
        const designation = person.designation || person.designation_name || person.role_name || '';
        return designation ? `${name} (${designation})` : name;
      }
      return 'Unknown Person';
    });
    
    return names.join(', ');
  };

  // Helper function to get person objects by IDs for popup - enhanced with designation
  const getPersonObjectsByIds = (personIds) => {
    if (!personIds || !Array.isArray(personIds)) return [];
    
    return personIds.map(personId => {
      const person = assignableUsers.find(p => p.id === personId || p._id === personId);
      return person ? {
        id: person.id || person._id,
        name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
        designation: person.designation || person.designation_name || person.role_name || 'No designation',
        department: person.department_name || person.department || 'No department'
      } : { 
        id: personId, 
        name: 'Unknown Person', 
        designation: 'Unknown', 
        department: 'Unknown' 
      };
    });
  };

  // Remove a selected person (like in login.html)
  const removeSelectedPerson = (personId) => {
    const updatedPersons = formData.login_person.filter(id => id !== personId);
    handleInputChange('login_person', updatedPersons);
    handleInputBlur('login_person', updatedPersons);
  };

  // Operations fields for display and editing - removed icons from labels
  const operationsFields = [
    { label: 'Login Sent Date', key: 'login_sent_date', type: 'date', readOnly: true },
    { label: 'Login Person', key: 'login_person', type: 'popup' },
    ...(canAccessChannel() ? [{ label: 'Channel Name', key: 'channel_name', type: 'dropdown' }] : []),
    { label: 'LOS Number', key: 'los_number' },
    { label: 'Amount Approved', key: 'amount_approved', type: 'currency' },
    { label: 'Amount Disbursed', key: 'amount_disbursed', type: 'currency' },
    { label: 'Internal TOP', key: 'internal_top', type: 'currency' },
    { label: 'Cashback to Customer', key: 'cashback_to_customer', type: 'currency' },
    { label: 'Net Disbursement Amount', key: 'net_disbursement_amount', type: 'currency', readOnly: true },
    { label: 'Rate %', key: 'rate_percentage', type: 'percentage' },
    { label: 'Tenure Given', key: 'tenure_given', type: 'months' },
    { label: 'PF and Insurance', key: 'pf_and_insurance', type: 'currency' },
    { label: 'Disbursement Date', key: 'disbursement_date', type: 'date' }
  ];

  // Handle special key events for percentage input
  const handlePercentageKeyDown = (e) => {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const value = input.value;
    const numericPart = value.replace('%', '');
    
    // Prevent cursor from moving past the numeric part
    if (e.key === 'ArrowRight' && cursorPos >= numericPart.length) {
      e.preventDefault();
    }
    
    // If user tries to type after %, move cursor to end of numbers
    if (cursorPos > numericPart.length && /\d/.test(e.key)) {
      e.preventDefault();
      input.setSelectionRange(numericPart.length, numericPart.length);
      handleInputChange('rate_percentage', numericPart + e.key);
    }
  };

  // Handle form input changes (auto-save on change with debounce)
  const handleInputChange = (field, value) => {
    // Fields that should not be converted to uppercase (numeric, dates, currency)
    const excludeFromUppercase = [
      'amount_approved', 'amount_disbursed', 'internal_top', 'cashback_to_customer',
      'net_disbursement_amount', 'rate_percentage', 'tenure_given', 'pf_and_insurance',
      'login_sent_date', 'disbursement_date'
    ];

    let processedValue = value;
    
    // Apply minimal formatting during typing to allow natural input
    if (field === 'rate_percentage') {
      // Handle percentage input with proper cursor positioning
      let numValue = value.replace('%', '');
      
      // Store current cursor position before formatting
      const currentInput = percentageInputRef.current;
      const cursorPos = currentInput ? currentInput.selectionStart : 0;
      
      if (/^\d*\.?\d*$/.test(numValue) && numValue !== '') {
        processedValue = numValue + '%'; // Auto-add % during typing
        
        // Restore cursor position after React updates
        setTimeout(() => {
          if (percentageInputRef.current && document.activeElement === percentageInputRef.current) {
            const newCursorPos = Math.min(cursorPos, numValue.length);
            percentageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      } else if (numValue === '') {
        processedValue = '';
      } else {
        processedValue = value; // Let them type, we'll fix on blur
      }
    } else if (field === 'tenure_given') {
      // Allow typing numbers, don't add months suffix during typing
      let numValue = value.replace(/\s*months?$/i, '');
      if (/^\d*$/.test(numValue) || numValue === '') {
        processedValue = numValue; // Don't add suffix during typing
      } else {
        processedValue = value; // Let them type, we'll fix on blur
      }
    } else if (['amount_approved', 'amount_disbursed', 'internal_top', 'cashback_to_customer'].includes(field)) {
      // For currency fields, allow natural typing with minimal formatting
      if (value === '') {
        processedValue = '';
      } else {
        // Extract only numbers for validation but keep original for editing
        const numbers = value.replace(/[^\d]/g, '');
        if (numbers) {
          // Only format if the value looks complete or if it's getting long
          if (value.endsWith(' ') || numbers.length >= 4) {
            processedValue = formatIndianCurrency(numbers);
          } else {
            processedValue = numbers; // Let them type numbers naturally
          }
        } else {
          processedValue = value; // Let them type, we'll fix on blur
        }
      }
    } else if (field === 'pf_and_insurance') {
      // For PF & Insurance, allow natural typing
      if (value === '') {
        processedValue = '';
      } else if (value.includes(' ') && !value.includes(' & ')) {
        // When they type space, format first amount and add "&"
        const parts = value.split(' ');
        const firstPart = parts[0];
        
        if (/^\d+$/.test(firstPart)) {
          const formatted = formatIndianCurrency(firstPart);
          processedValue = formatted + ' & ';
        } else {
          processedValue = value;
        }
      } else {
        processedValue = value; // Allow natural typing
      }
    } else if (!excludeFromUppercase.includes(field) && typeof value === 'string') {
      // Convert to uppercase for text fields (mainly los_number)
      processedValue = value.toUpperCase();
    }

    setFormData(prev => {
      const updated = { ...prev, [field]: processedValue };
      
      // Auto-calculate Net Disbursement when Amount Disbursed or Internal Top changes
      if (field === 'amount_disbursed' || field === 'internal_top') {
        const amountDisbursedText = (field === 'amount_disbursed' ? processedValue : updated.amount_disbursed) || '';
        const internalTopText = (field === 'internal_top' ? processedValue : updated.internal_top) || '';
        
        const amountDisbursed = parseFloat(amountDisbursedText.replace(/[^\d]/g, '')) || 0;
        const internalTop = parseFloat(internalTopText.replace(/[^\d]/g, '')) || 0;
        const netDisbursement = amountDisbursed - internalTop;
        
        if (netDisbursement > 0) {
          updated.net_disbursement_amount = formatIndianCurrency(netDisbursement.toString());
        } else if (netDisbursement === 0 && (amountDisbursed > 0 || internalTop > 0)) {
          updated.net_disbursement_amount = 'Rs 0';
        } else {
          updated.net_disbursement_amount = '';
        }
      }
      
      // Debounce the auto-save to avoid too many API calls
      if (window.autoSaveTimeout) {
        clearTimeout(window.autoSaveTimeout);
      }
      window.autoSaveTimeout = setTimeout(() => {
        autoSave(updated);
      }, 1000); // Wait 1 second after user stops typing
      return updated;
    });
  };

  // Handle input blur - save immediately when user leaves the field and apply final formatting
  const handleInputBlur = (field, value) => {
    // Prevent multiple simultaneous saves
    if (isSaving) return;

    // Clear any pending timeout
    if (window.autoSaveTimeout) {
      clearTimeout(window.autoSaveTimeout);
    }

    let finalValue = value;
    
    // Apply final formatting on blur
    if (field === 'rate_percentage') {
      let numValue = value.replace('%', '');
      if (numValue && /^\d*\.?\d*$/.test(numValue)) {
        finalValue = numValue + '%';
      }
    } else if (field === 'tenure_given') {
      let numValue = value.replace(/\s*months?$/i, '');
      if (numValue && /^\d+$/.test(numValue)) {
        const suffix = parseInt(numValue) === 1 ? ' month' : ' months';
        finalValue = numValue + suffix;
      }
    } else if (['amount_approved', 'amount_disbursed', 'internal_top', 'cashback_to_customer'].includes(field)) {
      if (value && !value.startsWith('Rs ')) {
        const numbers = value.replace(/[^\d]/g, '');
        if (numbers) {
          finalValue = formatIndianCurrency(numbers);
        }
      }
    } else if (field === 'pf_and_insurance') {
      // Format both amounts on blur for PF & Insurance
      if (value.includes(' & ')) {
        const parts = value.split(' & ');
        let formattedParts = [];
        
        parts.forEach(part => {
          const numbers = part.replace(/[^\d]/g, '');
          if (numbers) {
            formattedParts.push(formatIndianCurrency(numbers));
          } else if (part.startsWith('Rs ')) {
            formattedParts.push(part);
          }
        });
        
        if (formattedParts.length === 2) {
          finalValue = formattedParts.join(' & ');
        }
      } else {
        // Single amount
        const numbers = value.replace(/[^\d]/g, '');
        if (numbers) {
          finalValue = formatIndianCurrency(numbers);
        }
      }
    }

    // Update form data immediately
    const updated = { ...formData, [field]: finalValue };
    setFormData(updated);

    // Call parent onSave callback immediately for instant sync
    if (typeof onSave === 'function') {
      console.log(`🔄 Calling parent onSave for field ${field} with value:`, finalValue);
      onSave(field, finalValue);
    }

    // Also trigger full auto-save to backend
    autoSave(updated);
  };

  // Auto-save function
  const autoSave = async (updatedFormData) => {
    // Prevent multiple simultaneous saves
    if (isSaving) return;

    try {
      setIsSaving(true);
      const operationsData = {
        login_sent_date: updatedFormData.login_sent_date,
        login_person: updatedFormData.login_person,
        channel_name: updatedFormData.channel_name,
        los_number: updatedFormData.los_number,
        amount_approved: updatedFormData.amount_approved,
        amount_disbursed: updatedFormData.amount_disbursed,
        internal_top: updatedFormData.internal_top,
        cashback_to_customer: updatedFormData.cashback_to_customer,
        net_disbursement_amount: updatedFormData.net_disbursement_amount,
        rate_percentage: updatedFormData.rate_percentage,
        tenure_given: updatedFormData.tenure_given,
        pf_and_insurance: updatedFormData.pf_and_insurance,
        disbursement_date: updatedFormData.disbursement_date
      };

      const userId = localStorage.getItem('userId') || '';

      console.log('💾 Saving operations data:', operationsData);

      const response = await fetch(`${API_BASE_URL}/lead-login/update-operations/${lead._id}?user_id=${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify(operationsData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update operations data: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('💾 Operations data updated successfully:', result);

      // Show success indicator instead of popup message
      setSaveSuccess(true);
      setSaveMessage('Operations data updated successfully');
      setTimeout(() => {
        setSaveSuccess(false);
        setSaveMessage('');
      }, 2000);
    } catch (error) {
      console.error('Error updating operations data:', error);
      setSaveMessage(`Failed to update operations data: ${error.message}`);
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-7 rounded-2xl border-2 border-cyan-400/70 bg-white shadow-2xl text-[1.1rem] relative overflow-hidden">
      <div className="absolute -right-12 -top-10 w-40 h-40 bg-white rounded-full blur-2xl" />
      <div className="absolute -left-16 top-20 w-28 h-28 bg-white rounded-full blur-2xl" />

      <div className="flex items-center justify-between mb-4 z-10 relative min-h-[24px]">
        <div></div> {/* Empty spacer */}
        {/* Fixed-position save indicator that maintains consistent space */}
        <div className="flex items-center gap-2 h-6 w-20 justify-end">
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>
              <span className="text-sm text-cyan-500">Saving...</span>
            </>
          ) : saveSuccess ? (
            <>
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-green-500">Saved</span>
            </>
          ) : saveMessage && saveMessage.includes('Failed') ? (
            <>
              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-sm text-red-500">Failed</span>
            </>
          ) : (
            <div className="h-4 w-4"></div> // Invisible placeholder to maintain space
          )}
        </div>
      </div>

      {/* 3-column grid for operations fields only */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 font-bold z-10 relative">
        {/* Operations fields, all editable */}
        {operationsFields.map(({ label, key, type, readOnly }) => {
          const isFieldReadOnly = readOnly || !canEdit;
          return (
          <div className="flex flex-col gap-2" key={key}>
            <label className={labelClass} style={labelStyle}>
              {label}
            </label>
            {key === 'channel_name' ? (
              <div className="relative w-full dropdown-container" ref={channelDropdownRef}>
                <div
                  className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold cursor-pointer flex items-center justify-between transition-all duration-300 focus-within:border-[#0097a7] focus-within:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                    isFieldReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  onClick={() => !isFieldReadOnly && setShowChannelDropdown(!showChannelDropdown)}
                  onBlur={() => {
                    if (formData[key]) {
                      handleInputBlur(key, formData[key]);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span>{formData[key] || 'Select Channel'}</span>
                    {formData[key] && (
                      <div className="relative">
                        <svg
                          className="w-4 h-4 text-blue-500 hover:text-blue-700 cursor-help"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          onMouseEnter={(e) => handleChannelTooltipEnter(`selected_${formData[key]}`, e)}
                          onMouseLeave={handleChannelTooltipLeave}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        {showChannelTooltip === `selected_${formData[key]}` && (
                          <div className="absolute left-0 bottom-full mb-2 w-64 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-50 p-3">
                            <div className="whitespace-pre-wrap">
                              {getChannelDescription(formData[key])}
                            </div>
                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-[#00bcd4]" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 8 4 4 4-4"/>
                  </svg>
                </div>
                {showChannelDropdown && !isFieldReadOnly && (
                  <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                    <div className="p-3 border-b border-gray-200">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search channels..."
                          value={channelSearchQuery}
                          onChange={(e) => setChannelSearchQuery(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#00bcd4]"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredChannelOptions.length > 0 ? (
                        filteredChannelOptions.map((option) => {
                          const channelName = typeof option === 'string' ? option : option.name;
                          const channelKey = typeof option === 'string' ? option : option.name;
                          return (
                            <div
                              key={channelKey}
                              className="px-4 py-2 text-md font-bold text-green-600 hover:bg-gray-100 cursor-pointer flex items-center justify-between relative"
                              onClick={() => handleChannelSelect(option)}
                            >
                              <span>{channelName}</span>
                              <div className="relative ml-2">
                                <svg
                                  className="w-4 h-4 text-blue-500 hover:text-blue-700 cursor-help"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  onMouseEnter={(e) => handleChannelTooltipEnter(channelName, e)}
                                  onMouseLeave={handleChannelTooltipLeave}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>

                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-4 py-2 text-sm text-gray-500">No channels found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : type === 'popup' ? (
              <div className="relative w-full dropdown-container">
                <div
                  className={`w-full p-3 border-2 border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold cursor-pointer flex items-center justify-between transition-all duration-300 focus-within:border-[#0097a7] focus-within:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                    isFieldReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  onClick={() => !isFieldReadOnly && setShowLoginPersonPopup(true)}
                >
                  <span>
                    {formData[key] && Array.isArray(formData[key]) && formData[key].length > 0 ? 
                      `${formData[key].length} person(s) selected`
                      : 'Click to select login department persons'
                    }
                  </span>
                  <svg className="w-4 h-4 text-[#00bcd4]" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 8 4 4 4-4"/>
                  </svg>
                </div>
                
                {/* Selected persons tags display (like login.html) */}
                {formData[key] && Array.isArray(formData[key]) && formData[key].length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getPersonObjectsByIds(formData[key]).map((person) => (
                      <div key={person.id} className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        <span className="mr-2">{person.name}</span>
                        {!isFieldReadOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSelectedPerson(person.id);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold ml-1"
                            type="button"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : type === 'date' ? (
              <div className="relative">
                <input
                  type="date"
                  value={formData[key] ? new Date(formData[key]).toISOString().split('T')[0] : ''}
                  onChange={(e) => isFieldReadOnly ? null : handleInputChange(key, e.target.value)}
                  onBlur={(e) => isFieldReadOnly ? null : handleInputBlur(key, e.target.value)}
                  readOnly={isFieldReadOnly}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id={`${key}_hidden`}
                />
                <input
                  type="text"
                  value={formData[key] ? 
                    (key === 'login_sent_date' ? 
                      formatDateTimeDisplay(formData[key]) : 
                      formatDateDisplay(formData[key])
                    ) : ''}
                  readOnly
                  onClick={() => !isFieldReadOnly && document.getElementById(`${key}_hidden`).showPicker()}
                  className={`w-full p-3 border-2 border-[#00bcd4] rounded-md text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] cursor-pointer ${
                    isFieldReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder={key === 'login_sent_date' ? 'Login sent date and time' : 'Select date'}
                />
              </div>
            ) : type === 'currency' || type === 'percentage' || type === 'months' ? (
              <input
                ref={key === 'rate_percentage' ? percentageInputRef : null}
                type="text"
                value={formData[key] || ''}
                onChange={(e) => isFieldReadOnly ? null : handleInputChange(key, e.target.value)}
                onBlur={(e) => isFieldReadOnly ? null : handleInputBlur(key, e.target.value)}
                onKeyDown={key === 'rate_percentage' ? handlePercentageKeyDown : null}
                className={`w-full p-3 border-2 border-[#00bcd4] rounded-md text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  isFieldReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder={isFieldReadOnly ? "Read-only: No edit permission" : `Enter ${label.toLowerCase()}`}
                disabled={isFieldReadOnly}
              />
            ) : (
              <input
                type="text"
                value={formData[key] || ''}
                onChange={(e) => isFieldReadOnly ? null : handleInputChange(key, e.target.value)}
                onBlur={(e) => isFieldReadOnly ? null : handleInputBlur(key, e.target.value)}
                className={`w-full p-3 border-2 border-[#00bcd4] rounded-md text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  isFieldReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder={isFieldReadOnly ? "Read-only: No edit permission" : `Enter ${label.toLowerCase()}`}
                disabled={isFieldReadOnly}
              />
            )}
          </div>
        )})}
      </div>

      <div className="flex justify-between items-center mt-6 z-10 relative">
        <div className="text-sm text-gray-500 italic">
          Operations data for this lead.
        </div>
      </div>

      {/* LoginPersonPopup */}
      {showLoginPersonPopup && (
        <LoginPersonPopup
          onClose={() => setShowLoginPersonPopup(false)}
          onSelect={handleLoginPersonSelect}
          users={assignableUsers}
          selectedPersons={getPersonObjectsByIds(formData.login_person || [])}
        />
      )}

      {/* Channel Tooltip Portal - Renders outside dropdown */}
      {showChannelTooltip && !showChannelTooltip.startsWith('selected_') && (
        <div 
          className="fixed w-64 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-[9999] p-3 pointer-events-none" 
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <div className="whitespace-pre-wrap">
            {getChannelDescription(showChannelTooltip)}
          </div>
          <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}
