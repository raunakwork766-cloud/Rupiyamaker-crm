import { useState, useEffect, useRef } from "react";
import { isSuperAdmin, getUserPermissions } from '../../utils/permissions';
import { formatDateTimeIST } from '../../utils/timezoneUtils';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// AssignPopup component for selecting assignees
function AssignPopup({ onClose, onSelect, assignableUsers = [] }) {
  const [assigneeName, setAssigneeName] = useState("");

  // Use the assignableUsers from API, fallback to dummy data if empty
  const dummyAssignees = [
  ];

  // Create a list of users with both ID, name, and designation from API data, or use dummy data
  const availableUsers = assignableUsers.length > 0 
    ? assignableUsers.map(user => ({
        id: user.id || user._id || user.user_id,
        name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.id,
        designation: user.designation || user.title || user.role || ''
      }))
    : dummyAssignees;

  const [filteredAssignees, setFilteredAssignees] = useState(availableUsers);

  useEffect(() => {
    // If assigneeName is empty, show all available users
    if (assigneeName.trim() === "") {
      setFilteredAssignees(availableUsers);
    } else {
      // Otherwise, filter based on input (search both name and designation)
      setFilteredAssignees(
        availableUsers.filter((user) =>
          user.name.toLowerCase().includes(assigneeName.toLowerCase()) ||
          (user.designation && user.designation.toLowerCase().includes(assigneeName.toLowerCase()))
        )
      );
    }
  }, [assigneeName, assignableUsers]); // Depend on assigneeName and assignableUsers to re-filter

  const handleAssign = () => {
    if (assigneeName) {
      // Find the user object that matches the typed name
      const selectedUser = availableUsers.find(user => 
        user.name.toLowerCase() === assigneeName.toLowerCase()
      );
      if (selectedUser) {
        onSelect(selectedUser);
      } else {
        // If no exact match found, create a user object with the typed name
        onSelect({ id: assigneeName.toLowerCase().replace(/\s+/g, '_'), name: assigneeName });
      }
    }
    // Optionally, clear the input after assigning
    setAssigneeName("");
    onClose(); // Close the popup after assigning
  };

  const selectAssignee = (selectedUser) => {
    setAssigneeName(selectedUser.name); // Set the selected name in the input
    onSelect(selectedUser); // Pass the selected user object to the parent
    onClose(); // Close the popup
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
          <h3 className="font-bold text-lg text-black">Assign Lead</h3>
        </div>

        <div className="mb-4 p-3">
          <label className="block font-bold text-gray-700 mb-2">
            Assign to
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
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Search by name or designation"
            />
            {assigneeName && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                onClick={() => setAssigneeName("")}
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Always show the list, filtered or full */}
        <ul className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg">
          {filteredAssignees.length > 0 ? (
            filteredAssignees.map((user) => (
              <li
                key={user.id || user.name}
                className="p-3 border-b last:border-b-0 cursor-pointer text-black transition hover:bg-gray-100 flex items-center"
                onClick={() => selectAssignee(user)}
              >
                {/* Profile icon with initials or avatar */}
                <div className="w-8 h-8 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3 flex-shrink-0">
                  {user.name.split(' ')
                    .map(part => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{user.name}</div>
                  {user.designation && (
                    <div className="text-sm text-gray-500 font-normal">{user.designation}</div>
                  )}
                </div>
              </li>
            ))
          ) : (
            assigneeName.trim() !== "" && ( // Only show "No results" if user typed something and no results
              <li className="p-3 text-gray-500 text-center">No matching assignees found.</li>
            )
          )}
        </ul>

        <div className="flex justify-end gap-4 mt-4 p-3">
          <button
            className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition"
            onClick={handleAssign}
          >
            Assign
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

export default function AboutSection({ lead, onSave, canEdit = true }) {
  // For dummy data, ensure lead has default values to prevent errors
  const safetyLead = lead || {};
  const hasPendingReassignment =
    String(lead?.reassignment_status || '').toLowerCase() === 'pending' ||
    String(lead?.reassignment_request_status || '').toLowerCase() === 'pending';
  const isReassignmentLocked = Boolean(
    lead?.is_reassignment_locked ||
    lead?.reassignment_locked ||
    lead?.reassignment_pending ||
    hasPendingReassignment
  );
  const canEditAssignedLead = canEdit && !isReassignmentLocked;
  
  // State for dropdown options
  const [loanTypes, setLoanTypes] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [dataCodes, setDataCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // User permissions state
  const [canEditAlternateNumber, setCanEditAlternateNumber] = useState(false);
  const [isUserSuperAdmin, setIsUserSuperAdmin] = useState(false);
  const [canViewDataCode, setCanViewDataCode] = useState(false);
  
  // Auto-save feedback state
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Label styling (matching LoginFormSection)
  const labelClass = "block font-semibold mb-1 uppercase tracking-wide";
  const labelStyle = { color: "#374151", fontWeight: 600, fontSize: "11px" };
  
  // Validation states
  const [validationErrors, setValidationErrors] = useState({});
  
  // Duplicate checking states
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState(null);
  
  // Assigned To and Assign TL states and popups
  const [assignedTo, setAssignedTo] = useState([]);
  const [assignReportTo, setAssignReportTo] = useState([]);
  const [showAssignReportToPopup, setShowAssignReportToPopup] = useState(false);

  useEffect(() => {
    if (!canEditAssignedLead && showAssignReportToPopup) {
      setShowAssignReportToPopup(false);
    }
  }, [canEditAssignedLead, showAssignReportToPopup]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // for super admin Created By dropdown
  const [departments, setDepartments] = useState([]); // for super admin Team Name dropdown
  const [createdBySearch, setCreatedBySearch] = useState('');
  const [showCreatedByDropdown, setShowCreatedByDropdown] = useState(false);
  const [createdByUserId, setCreatedByUserId] = useState(null); // track selected user id for created_by update
  const [selectedCreatedByDisplayName, setSelectedCreatedByDisplayName] = useState(null); // display name after selection
  const [selectedCreatedDate, setSelectedCreatedDate] = useState(null); // local state for super admin date edit (avoids useEffect overwrite)
  const [teamNameSearch, setTeamNameSearch] = useState('');
  const [showTeamNameDropdown, setShowTeamNameDropdown] = useState(false);
  
  // Dropdown search functionality states
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [showDataCodeDropdown, setShowDataCodeDropdown] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [campaignSearchTerm, setCampaignSearchTerm] = useState('');
  const [dataCodeSearchTerm, setDataCodeSearchTerm] = useState('');
  const [showAssignInlineDropdown, setShowAssignInlineDropdown] = useState(false);
  const [assignInlineSearch, setAssignInlineSearch] = useState('');
  const campaignDropdownRef = useRef(null);
  const assignInlineDropdownRef = useRef(null);

  // Close Campaign/Source dropdown on outside click
  useEffect(() => {
    if (!showCampaignDropdown) return;
    const handler = (e) => {
      if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(e.target)) {
        setShowCampaignDropdown(false);
        setCampaignSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCampaignDropdown]);

  // Close Assign Lead inline dropdown on outside click
  useEffect(() => {
    if (!showAssignInlineDropdown) return;
    const handler = (e) => {
      if (assignInlineDropdownRef.current && !assignInlineDropdownRef.current.contains(e.target)) {
        setShowAssignInlineDropdown(false);
        setAssignInlineSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssignInlineDropdown]);
  
  // Helper function to safely extract field values from lead data
  const extractFieldValue = (fieldName) => {
    if (!lead) return "";
    
    switch (fieldName) {
      case 'id':
        return lead.custom_lead_id || lead.id || "";
      
      case 'productName':
        return lead.loan_type_name || lead.loan_type || lead.productName || "";
      
      case 'loanTypeId':
        return lead.loan_type_id || "";
      
      case 'loan_type':
        return lead.loan_type || "";
      
      case 'loan_type_id':
        return lead.loan_type_id || "";
      
      case 'loan_type_name':
        return lead.loan_type_name || lead.loan_type || "";
      
      case 'campaignName':
        return lead.campaign_name || lead.campaignName || "";
      
      case 'dataCode':
        return lead.data_code || lead.dataCode || "";
      
      case 'customerName':
        // Try multiple sources for customer name
        if (lead.name) return lead.name;
        const firstName = lead.first_name || '';
        const lastName = lead.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || lead.customerName || "";
      
      case 'mobileNumber':
        return lead.mobile_number || lead.phone || lead.mobileNumber || "";
      
      case 'alternateNumber':
        return lead.alternative_phone || 
               lead.alternate_phone || 
               lead.alternateNumber || 
               lead.alternate_number || "";
      
      case 'pincode_city':
        return lead.pincode_city || "";
      
      case 'createdDate':
        return lead.created_at || lead.created_date || "";
      
      default:
        return "";
    }
  };

  // Initialize fields state with a lazy initializer to avoid calling extractFieldValue before it's defined
  const [fields, setFields] = useState(() => ({
    id: lead?.custom_lead_id || lead?.id || "",
    productName: lead?.loan_type_name || lead?.loan_type || lead?.productName || "",
    loanTypeId: lead?.loan_type_id || "",
    loan_type: lead?.loan_type || "",
    loan_type_id: lead?.loan_type_id || "",
    loan_type_name: lead?.loan_type_name || lead?.loan_type || "",
    campaignName: lead?.campaign_name || lead?.campaignName || "",
    dataCode: lead?.data_code || lead?.dataCode || "",
    customerName: (() => {
      if (lead?.name) return lead.name;
      const firstName = lead?.first_name || '';
      const lastName = lead?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || lead?.customerName || "";
    })(),
    mobileNumber: lead?.mobile_number || lead?.phone || lead?.mobileNumber || "",
    alternateNumber: lead?.alternative_phone || lead?.alternate_phone || lead?.alternateNumber || lead?.alternate_number || "",
    pincode_city: lead?.pincode_city || "",
    createdDate: lead?.created_at || lead?.created_date || "",
  }));
  
  // Update local state if the lead prop changes from parent
  useEffect(() => {
    // For dummy data, ensure we don't crash if lead prop is undefined
    if (lead) {
      console.log('📊 AboutSection: Updating fields from lead data:', lead);
      
      // CRITICAL FIX: Preserve existing field values when updating from lead
      // This prevents fields from being cleared when one field is updated
      setFields(prevFields => {
        return {
          id: extractFieldValue('id') || prevFields.id,
          productName: extractFieldValue('productName') || prevFields.productName,
          loanTypeId: extractFieldValue('loanTypeId') || prevFields.loanTypeId,
          loan_type: extractFieldValue('loan_type') || prevFields.loan_type,
          loan_type_id: extractFieldValue('loan_type_id') || prevFields.loan_type_id,
          loan_type_name: extractFieldValue('loan_type_name') || prevFields.loan_type_name,
          campaignName: extractFieldValue('campaignName') || prevFields.campaignName,
          dataCode: extractFieldValue('dataCode') || prevFields.dataCode,
          customerName: extractFieldValue('customerName') || prevFields.customerName,
          mobileNumber: extractFieldValue('mobileNumber') || prevFields.mobileNumber,
          alternateNumber: extractFieldValue('alternateNumber') || prevFields.alternateNumber,
          pincode_city: extractFieldValue('pincode_city') || prevFields.pincode_city,
          createdDate: extractFieldValue('createdDate') || prevFields.createdDate,
        };
      });
      
      console.log('📊 AboutSection: Fields updated to:', {
        id: extractFieldValue('id'),
        productName: extractFieldValue('productName'),
        campaignName: extractFieldValue('campaignName'),
        dataCode: extractFieldValue('dataCode'),
        customerName: extractFieldValue('customerName'),
        mobileNumber: extractFieldValue('mobileNumber'),
        alternateNumber: extractFieldValue('alternateNumber'),
        pincode_city: extractFieldValue('pincode_city'),
      });
      
      // 🔍 Detailed debugging for campaign_name and data_code
      console.log('🔍 Campaign Name Debug:', {
        'lead.campaign_name': lead.campaign_name,
        'lead.campaignName': lead.campaignName,
        'extracted': extractFieldValue('campaignName')
      });
      console.log('🔍 Data Code Debug:', {
        'lead.data_code': lead.data_code,
        'lead.dataCode': lead.dataCode,
        'extracted': extractFieldValue('dataCode')
      });
      
      // Parse assigned to data
      if (lead.assigned_to) {
        let assignedToData = [];
        try {
          console.log('Raw assigned_to data:', lead.assigned_to);
          
          if (typeof lead.assigned_to === 'string') {
            // Try to parse as JSON first
            try {
              assignedToData = JSON.parse(lead.assigned_to);
            } catch {
              // If not JSON, treat as comma-separated string
              assignedToData = lead.assigned_to.split(',').map(name => ({
                id: name.trim().toLowerCase().replace(/\s+/g, '_'),
                name: name.trim()
              }));
            }
          } else if (Array.isArray(lead.assigned_to)) {
            // For array of strings or IDs
            assignedToData = lead.assigned_to.map(user => {
              if (typeof user === 'string') {
                // If it's just an ID, look it up in assignableUsers if available
                const foundUser = assignableUsers.find(u => 
                  u.id === user || u._id === user || u.user_id === user
                );
                
                if (foundUser) {
                  return {
                    id: foundUser.id || foundUser._id || foundUser.user_id,
                    name: foundUser.name || foundUser.username || 
                          `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim()
                  };
                }
                
                // If not found, just use the ID as both id and name
                return {
                  id: user,
                  name: user
                };
              } else if (typeof user === 'object') {
                // If it's already an object, just format it consistently
                return {
                  id: user.id || user._id || user.user_id || user.name?.toLowerCase().replace(/\s+/g, '_'),
                  name: user.name || user.username || 
                        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.id || 'Unknown User'
                };
              }
              
              // Fallback
              return {
                id: String(user),
                name: String(user)
              };
            });
          }
        } catch (error) {
          console.error('Error parsing assigned_to data:', error);
          assignedToData = [];
        }
        
        console.log('Processed assignedToData:', assignedToData);
        setAssignedTo(assignedToData);
        
        // Initialize assignReportTo with assign_report_to data from lead
        let assignReportToData = [];
        try {
          if (lead.assign_report_to) {
            console.log('Raw assign_report_to data:', lead.assign_report_to);
            
            if (typeof lead.assign_report_to === 'string') {
              try {
                // Try to parse as JSON
                assignReportToData = JSON.parse(lead.assign_report_to);
              } catch {
                // If not JSON, treat as comma-separated string
                assignReportToData = lead.assign_report_to.split(',').map(name => ({
                  id: name.trim().toLowerCase().replace(/\s+/g, '_'),
                  name: name.trim()
                }));
              }
            } else if (Array.isArray(lead.assign_report_to)) {
              // For array of strings or IDs
              assignReportToData = lead.assign_report_to.map(user => {
                if (typeof user === 'string') {
                  // If it's just an ID, look it up in assignableUsers if available
                  const foundUser = assignableUsers.find(u => 
                    u.id === user || u._id === user || u.user_id === user
                  );
                  
                  if (foundUser) {
                    return {
                      id: foundUser.id || foundUser._id || foundUser.user_id,
                      name: foundUser.name || foundUser.username || 
                            `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim()
                    };
                  }
                  
                  // If not found, just use the ID as both id and name
                  return {
                    id: user,
                    name: user
                  };
                } else if (typeof user === 'object') {
                  // If it's already an object, just format it consistently
                  return {
                    id: user.id || user._id || user.user_id || user.name?.toLowerCase().replace(/\s+/g, '_'),
                    name: user.name || user.username || 
                          `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.id || 'Unknown User'
                  };
                }
                
                // Fallback
                return {
                  id: String(user),
                  name: String(user)
                };
              });
            }
          }
        } catch (error) {
          console.error('Error parsing assign_report_to data:', error);
          assignReportToData = [];
        }
        
        console.log('Processed assignReportToData:', assignReportToData);
        setAssignReportTo(assignReportToData);
        
        // Try to update with proper names if we have user IDs but missing names
        if (assignableUsers.length > 0) {
          updateAssignedUsersWithNames(lead.assigned_to, lead.assign_report_to, assignableUsers);
        }
      }
    }
  }, [lead]);

  // Fetch dropdown data on component mount
  useEffect(() => {
    fetchLoanTypes();
    fetchCampaigns();
    fetchDataCodes();
    fetchAssignableUsers();
    checkUserPermissions();
    checkDataCodePermission();
    fetchAllUsersForSuperAdmin();
    fetchDepartments();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowProductDropdown(false);
        setShowCampaignDropdown(false);
        setShowDataCodeDropdown(false);
        setShowCreatedByDropdown(false);
        setProductSearchTerm('');
        setCampaignSearchTerm('');
        setDataCodeSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch user details by IDs
  const fetchUserDetailsByIds = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      
      // Convert to array if not already
      const idsArray = Array.isArray(userIds) ? userIds : [userIds];
      
      // Make a request to get user details
      const response = await fetch(`${API_BASE_URL}/users/details`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_ids: idsArray,
          requesting_user_id: userId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('User details fetched:', data);
        return data.users || [];
      }
      
      console.warn('Failed to fetch user details:', await response.text());
      return [];
    } catch (error) {
      console.error('Error fetching user details:', error);
      return [];
    }
  };
  
  // Fetch assignable users from API (using users-one-level-above for hierarchy)
  const fetchAssignableUsers = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/roles/users-one-level-above/${userId}?requesting_user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Senior users fetched for Assigned TL:', data);
        
        // The API returns an array of users directly
        const users = Array.isArray(data) ? data : [];
        
        // ✅ FILTER: Only show active employees in assignment dropdowns
        const activeUsers = users.filter(user => 
          user.employee_status !== 'inactive' && user.is_active !== false
        );
        
        // Format users to include name and designation
        const formattedUsers = activeUsers.map(user => ({
          id: user._id || user.id,
          _id: user._id || user.id,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User',
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          designation: user.designation,
          role_name: user.role_name,
          email: user.email,
          phone: user.phone
        }));
        
        setAssignableUsers(formattedUsers);
        
        // After getting assignable users, refresh the assigned users with proper names
        if (lead) {
          updateAssignedUsersWithNames(lead.assigned_to, lead.assign_report_to, formattedUsers);
        }
      } else {
        console.warn('Failed to fetch senior users, response:', await response.text());
        setAssignableUsers([]);
      }
    } catch (error) {
      console.error('Error fetching senior users:', error);
      // Set empty array if API fails
      setAssignableUsers([]);
    }
  };

  // Fetch all users (for super admin Created By dropdown)
  const fetchAllUsersForSuperAdmin = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        const users = Array.isArray(data) ? data : (data.users || data.items || []);
        setAllUsers(users.map(u => ({
          id: u._id || u.id,
          name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'Unknown',
          department: u.department_name || u.department || '',
          role_name: u.role_name || u.role || ''
        })));
      }
    } catch (e) { console.warn('fetchAllUsersForSuperAdmin failed:', e); }
  };

  // Fetch departments (for super admin Team Name dropdown)
  const fetchDepartments = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/departments/?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : (data.departments || data.items || []));
      }
    } catch (e) { console.warn('fetchDepartments failed:', e); }
  };

  // Function to update assigned users with proper names from the available users list
  const updateAssignedUsersWithNames = async (assignedToData, assignReportToData, availableUsers) => {
    if (!assignedToData && !assignReportToData) return;
    
    try {
      // Extract unique IDs that need to be looked up
      const assignedIds = Array.isArray(assignedToData) ? 
        assignedToData.filter(id => typeof id === 'string') : [];
        
      const reportToIds = Array.isArray(assignReportToData) ? 
        assignReportToData.filter(id => typeof id === 'string') : [];
        
      const allIds = [...new Set([...assignedIds, ...reportToIds])];
      
      // First try to match IDs with available users
      const idToUserMap = {};
      for (const user of availableUsers) {
        const userId = user.id || user._id || user.user_id;
        if (userId) {
          idToUserMap[userId] = user;
        }
      }
      
      // For IDs not found in available users, fetch from API
      const missingIds = allIds.filter(id => !idToUserMap[id]);
      if (missingIds.length > 0) {
        const fetchedUsers = await fetchUserDetailsByIds(missingIds);
        for (const user of fetchedUsers) {
          const userId = user.id || user._id || user.user_id;
          if (userId) {
            idToUserMap[userId] = user;
          }
        }
      }
      
      // Update assignedTo state if needed
      if (Array.isArray(assignedToData) && assignedToData.length > 0) {
        const updatedAssignedTo = assignedToData.map(user => {
          if (typeof user === 'string') {
            if (idToUserMap[user]) {
              // Use the mapped user
              return {
                id: user,
                name: idToUserMap[user].name || 
                      `${idToUserMap[user].first_name || ''} ${idToUserMap[user].last_name || ''}`.trim() || 
                      user
              };
            }
            return { id: user, name: user }; // Fallback
          }
          return user; // Already an object
        });
        
        setAssignedTo(updatedAssignedTo);
      }
      
      // Update assignReportTo state if needed
      if (Array.isArray(assignReportToData) && assignReportToData.length > 0) {
        const updatedAssignReportTo = assignReportToData.map(user => {
          if (typeof user === 'string') {
            if (idToUserMap[user]) {
              // Use the mapped user
              return {
                id: user,
                name: idToUserMap[user].name || 
                      `${idToUserMap[user].first_name || ''} ${idToUserMap[user].last_name || ''}`.trim() || 
                      user
              };
            }
            return { id: user, name: user }; // Fallback
          }
          return user; // Already an object
        });
        
        setAssignReportTo(updatedAssignReportTo);
      }
    } catch (error) {
      console.error('Error updating assigned users with names:', error);
    }
  };

  // Check user permissions for alternate number editing and superadmin status
  const checkUserPermissions = () => {
    const userRole = localStorage.getItem('userRole');
    const userDepartment = localStorage.getItem('userDepartment');
    const userPermissions = getUserPermissions();
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    // Check if user is superadmin with specific permissions
    let isSuperAdminUser = false;
    
    // Check for Super Admin role with wildcard permissions
    if (userData.role_name === 'Super Admin' || userRole === 'Super Admin') {
      isSuperAdminUser = true;
    }
    
    // Use isSuperAdmin utility which handles both array and object permission formats
    if (!isSuperAdminUser && isSuperAdmin(userPermissions)) {
      isSuperAdminUser = true;
    }
    
    // Also check role-based permissions in userData (original array format from backend)
    if (!isSuperAdminUser && userData.permissions && Array.isArray(userData.permissions)) {
      const hasSuperAdminPermissions = userData.permissions.some(perm => 
        perm.page === "*" && perm.actions === "*"
      );
      if (hasSuperAdminPermissions) {
        isSuperAdminUser = true;
      }
    }
    
    setIsUserSuperAdmin(isSuperAdminUser);
    
    // Only Super Admin can edit mobile number and alternate number (still requires canEdit prop)
    if (isSuperAdminUser) {
      setCanEditAlternateNumber(canEdit);
      return;
    }
    
    // For non-super admin users, alternate number can only be edited if it's empty in ORIGINAL data
    const originalAlternateNumber = getOriginalValue('alternateNumber') || '';
    const isOriginalAlternateNumberEmpty = !originalAlternateNumber || 
                                   originalAlternateNumber.trim() === '' || 
                                   originalAlternateNumber.toLowerCase() === 'none' ||
                                   originalAlternateNumber.toLowerCase() === 'null';
    
    // Also require canEdit prop — non-edit-permission users can never edit alternate number
    setCanEditAlternateNumber(isOriginalAlternateNumberEmpty && canEdit);
  };

  // Check if user has permission to view the Data Code field (leads.pl_&_odd_leads → view_data_code)
  const checkDataCodePermission = () => {
    try {
      const userPermissions = getUserPermissions();

      // Super admin always has access
      if (isSuperAdmin(userPermissions)) {
        setCanViewDataCode(true);
        return;
      }

      const userRole = localStorage.getItem('userRole');
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      if (userData.role_name === 'Super Admin' || userRole === 'Super Admin') {
        setCanViewDataCode(true);
        return;
      }

      // Check from normalized localStorage permissions (object format set at login)
      const plOddPerms =
        userPermissions['leads.pl_&_odd_leads'] ||
        userPermissions['leads.pl_odd_leads'] ||
        userPermissions['leads_pl_&_odd_leads'] ||
        userPermissions['leads_pl_odd_leads'];

      if (plOddPerms) {
        if (plOddPerms === '*') {
          setCanViewDataCode(true);
          return;
        }
        if (typeof plOddPerms === 'object' && !Array.isArray(plOddPerms) && plOddPerms.view_data_code === true) {
          setCanViewDataCode(true);
          return;
        }
        if (Array.isArray(plOddPerms) && plOddPerms.includes('view_data_code')) {
          setCanViewDataCode(true);
          return;
        }
      }

      // Also check from userData.role.permissions (raw backend array format)
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role?.permissions && Array.isArray(user.role.permissions)) {
        const plOddPermission = user.role.permissions.find(p =>
          p.page === 'leads.pl_&_odd_leads' ||
          p.page === 'leads.pl_odd_leads' ||
          p.page === 'leads_pl_&_odd_leads' ||
          p.page === 'leads_pl_odd_leads'
        );
        if (plOddPermission && plOddPermission.actions) {
          const actions = Array.isArray(plOddPermission.actions)
            ? plOddPermission.actions
            : [plOddPermission.actions];
          if (actions.includes('view_data_code')) {
            setCanViewDataCode(true);
            return;
          }
        }
      }

      setCanViewDataCode(false);
    } catch (error) {
      console.error('Error checking data code permission:', error);
      setCanViewDataCode(false);
    }
  };

  // Fetch loan types from API
  const fetchLoanTypes = async () => {
    try {
      const userId = localStorage.getItem('userId');
      // NOTE: trailing slash required — FastAPI redirects /loan-types → /loan-types/
      // and the redirect drops the /api prefix when behind reverse proxy
      const response = await fetch(`${API_BASE_URL}/loan-types/?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLoanTypes(data.items || data.loan_types || data || []);
      }
    } catch (error) {
      console.error('Error fetching loan types:', error);
    }
  };

  // Fetch campaigns from API
  const fetchCampaigns = async () => {
    try {
      const userId = localStorage.getItem('userId');
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

  // Fetch data codes from API
  const fetchDataCodes = async () => {
    try {
      const userId = localStorage.getItem('userId');
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
  
  // Check mobile number for duplicates
  const checkMobileNumber = async (mobileNumber, loanTypeName = null) => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return null;

      let url = `/api/leads/check-phone/${encodeURIComponent(mobileNumber)}?user_id=${userId}`;

      // Add loan type parameter if provided
      if (loanTypeName) {
        url += `&loan_type_name=${encodeURIComponent(loanTypeName)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // If leads are found, check reassignment eligibility for the first lead
      if (data && data.found && data.leads && data.leads.length > 0) {
        try {
          const leadId = data.leads[0].id;
          const eligibilityUrl = `/api/leads/${leadId}/reassignment-eligibility?user_id=${userId}`;
          
          const eligibilityResponse = await fetch(eligibilityUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (eligibilityResponse.ok) {
            const eligibilityData = await eligibilityResponse.json();
            
            // Add reassignment eligibility data to the response
            data.can_reassign = eligibilityData.can_reassign;
            data.reassignment_reason = eligibilityData.reason;
            data.days_elapsed = eligibilityData.days_elapsed;
            data.reassignment_period = eligibilityData.reassignment_period;
            data.days_remaining = eligibilityData.days_remaining;
            data.is_manager_permission_required = eligibilityData.is_manager_permission_required;
            
            // If eligibility response includes lead data, merge it with existing lead data
            if (eligibilityData.lead) {
              data.leads[0] = { ...data.leads[0], ...eligibilityData.lead };
            }
          }
        } catch (eligibilityError) {
          console.error('Error checking reassignment eligibility:', eligibilityError);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error checking mobile number for duplicates:', error);
      return null;
    }
  };

  // Filter functions for dropdown search
  const getFilteredLoanTypes = () => {
    if (!productSearchTerm) return loanTypes;
    return loanTypes.filter(loanType => 
      loanType.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  };

  const getFilteredCampaigns = () => {
    if (!campaignSearchTerm) return campaigns;
    return campaigns.filter(campaign => 
      campaign.name.toLowerCase().includes(campaignSearchTerm.toLowerCase())
    );
  };

  const getFilteredDataCodes = () => {
    if (!dataCodeSearchTerm) return dataCodes;
    return dataCodes.filter(dataCode => 
      dataCode.name.toLowerCase().includes(dataCodeSearchTerm.toLowerCase())
    );
  };

  // Function to check number duplicates
  const checkNumberDuplicate = async (number, fieldType) => {
    // Skip duplicate check if we're editing the same lead's existing number
    if ((fieldType === 'mobileNumber' && number === lead?.mobile_number) ||
        (fieldType === 'alternateNumber' && number === lead?.alternative_phone)) {
      return;
    }

    try {
      setIsCheckingDuplicate(true);
      const duplicateCheck = await checkMobileNumber(number, fields.loan_type || fields.productName);
      
      if (duplicateCheck && duplicateCheck.found) {
        setDuplicateCheckResult(duplicateCheck);
        
        const leadCount = duplicateCheck.leads ? duplicateCheck.leads.length : 0;
        const firstLead = leadCount > 0 ? duplicateCheck.leads[0] : null;
        
        let errorMessage = `⚠️ This number is already registered`;
        if (firstLead) {
          errorMessage += ` (Lead ID: ${firstLead.custom_lead_id || firstLead.id})`;
          if (firstLead.name) {
            errorMessage += ` - ${firstLead.name}`;
          }
        }
        
        setValidationErrors(prev => ({
          ...prev,
          [fieldType]: errorMessage
        }));
        
        // Show warning in save status
        setSaveStatus(`⚠️ Duplicate ${fieldType === 'mobileNumber' ? 'mobile' : 'alternate'} number found`);
        setTimeout(() => setSaveStatus(''), 5000);
        
      } else {
        // Clear any existing duplicate errors
        setValidationErrors(prev => ({ ...prev, [fieldType]: null }));
        setDuplicateCheckResult(null);
      }
    } catch (error) {
      console.error(`Error checking ${fieldType} for duplicates:`, error);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleChange = (field, value) => {
    console.log(`📝 AboutSection: Input changed - ${field}: ${value}`);
    
    // Convert text fields to uppercase (exclude numeric fields)
    let processedValue = value;
    
    // Handle specific field validations
    if (field === 'alternateNumber') {
      // Only allow numbers, limit to 10 digits
      processedValue = value.replace(/\D/g, '').slice(0, 10);
      
      // Check if alternate number is the same as mobile number
      if (processedValue && processedValue === fields.mobileNumber) {
        setValidationErrors(prev => ({
          ...prev,
          alternateNumber: 'Alternate number cannot be the same as mobile number'
        }));
        return; // Don't update the field if it matches mobile number
      }
      
      // Only validate when field is complete (10 digits) - no real-time validation during typing
      if (processedValue.length === 10) {
        setValidationErrors(prev => ({ ...prev, alternateNumber: null }));
        
        // Check for duplicates if number is valid and complete
        checkNumberDuplicate(processedValue, 'alternateNumber');
      } else if (processedValue.length === 0) {
        // Clear errors when field is empty
        setValidationErrors(prev => ({ ...prev, alternateNumber: null }));
      }
    } else if (field === 'mobileNumber') {
      // Only allow numbers, limit to 10 digits
      processedValue = value.replace(/\D/g, '').slice(0, 10);
      
      // Validate mobile number format
      const mobileValidation = validateMobileNumber(processedValue);
      if (!mobileValidation.isValid) {
        setValidationErrors(prev => ({
          ...prev,
          mobileNumber: mobileValidation.error
        }));
      } else {
        setValidationErrors(prev => ({ ...prev, mobileNumber: null }));
        
        // Check for duplicates if number is valid and complete
        if (processedValue.length === 10) {
          checkNumberDuplicate(processedValue, 'mobileNumber');
        }
      }
      
      // If mobile number changes and matches alternate number, clear alternate number
      if (processedValue && processedValue === fields.alternateNumber) {
        setFields(prev => ({ ...prev, alternateNumber: '' }));
        setValidationErrors(prev => ({           ...prev, 
          alternateNumber: 'Alternate number cleared as it matched mobile number' 
        }));
        // Clear the validation error after 3 seconds
        setTimeout(() => {
          setValidationErrors(prev => ({ ...prev, alternateNumber: null }));
        }, 3000);
      }
      
      // Re-validate alternate number if mobile number changes
      if (fields.alternateNumber && processedValue === fields.alternateNumber) {
        setValidationErrors(prev => ({
          ...prev,
          alternateNumber: 'Alternate number cannot be the same as mobile number'
        }));
      } else if (fields.alternateNumber && processedValue !== fields.alternateNumber) {
        // Clear the error if they're now different
        setValidationErrors(prev => ({ ...prev, alternateNumber: null }));
      }
    } else if (typeof value === 'string' && !['mobileNumber', 'alternateNumber', 'createdDate'].includes(field)) {
      processedValue = value.toUpperCase();
    }
    
    // Update local state immediately for responsive UI
    const updatedFields = { ...fields, [field]: processedValue };
    
    // Handle loan type selection - update all loan type related fields
    if (field === 'productName') {
      const selectedLoanType = loanTypes.find(lt => lt.name === processedValue);
      if (selectedLoanType) {
        console.log(`📝 AboutSection: Loan type selected, updating all loan type fields`);
        updatedFields.loanTypeId = selectedLoanType._id;
        
        // Update all three fields in the state
        setFields({
          ...updatedFields,
          loan_type: value,           // Update loan_type
          loan_type_id: selectedLoanType._id,  // Update loan_type_id
          loan_type_name: value       // Update loan_type_name
        });
        
        // Also add the loan_type fields to the updatedFields for the parent component
        updatedFields.loan_type = value;
        updatedFields.loan_type_id = selectedLoanType._id;
        updatedFields.loan_type_name = value;
        
        return; // Exit early as we've already set the fields
      }
    }
    
    setFields(updatedFields);
    
    // Note: We only save to backend/parent on blur, not on every keystroke
    // This ensures responsive UI while preventing excessive API calls
  };
  
  // Enhanced auto-save function that triggers when a field loses focus (onBlur)
  const handleBlur = async (field, value) => {
    console.log(`🔍 AboutSection: handleBlur called for field: ${field}, value: ${value}`);
    console.log(`🔍 Current field value: ${fields[field]}`);
    console.log(`🔍 Original lead value: ${getOriginalValue(field)}`);
    
    // Get the original value from the lead data to compare against
    const originalValue = getOriginalValue(field);
    
    // Additional validation before saving
    if (field === 'alternateNumber') {
      // Check if alternate number is the same as mobile number
      if (value && value === fields.mobileNumber) {
        setValidationErrors(prev => ({
          ...prev,
          alternateNumber: 'Alternate number cannot be the same as mobile number'
        }));
        setSaveStatus('❌ Save failed: Duplicate number');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      
      // Check if alternate number is valid (10 digits starting with 6-9)
      if (value && (value.length !== 10 || !/^[6-9]/.test(value))) {
        setValidationErrors(prev => ({
          ...prev,
          alternateNumber: 'Alternate number must be 10 digits starting with 6, 7, 8, or 9'
        }));
        setSaveStatus('❌ Save failed: Invalid number format');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
    }
    
    // Check for duplicate number errors before saving
    if ((field === 'mobileNumber' || field === 'alternateNumber') && 
        validationErrors[field] && 
        validationErrors[field].includes('already registered')) {
      setSaveStatus('❌ Save failed: Duplicate number detected');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    
    // Only save if the value has actually changed from the original
    if (value === originalValue) {
      console.log(`⏭️ AboutSection: No change detected for ${field}, skipping save`);
      return;
    }
    
    console.log(`💾 AboutSection: Change detected for ${field}, saving...`);
    setIsSaving(true);
    setSaveStatus('💾 Saving...');
    
    try {
      // Update local state first to ensure UI reflects change immediately
      setFields(prev => ({ ...prev, [field]: value }));
      
      // Build minimal update payload - only send the field being changed
      let updatePayload = {};
      
      // Map fields to appropriate API fields
      const apiFieldMap = {
        id: 'custom_lead_id',
        productName: 'loan_type',
        loanTypeId: 'loan_type_id',
        campaignName: 'campaign_name',
        dataCode: 'data_code',
        customerName: 'name',
        mobileNumber: 'mobile_number',
        alternateNumber: 'alternative_phone',
        pincode_city: 'pincode_city',
        createdDate: 'override_created_at',
        createdByName: 'created_by_name',
        teamName: 'department_name',
        createdById: 'override_created_by_id',
      };

      const apiField = apiFieldMap[field] || field;

      // Handle createdByName field - send both name and user id for super admin
      if (field === 'createdByName') {
        updatePayload = { created_by_name: value };
        if (createdByUserId) {
          updatePayload.override_created_by_id = createdByUserId;
        }
      }
      // Handle customerName field - split into first_name and last_name
      else if (field === 'customerName') {
        const nameParts = value.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        updatePayload = {
          name: value,
          first_name: firstName,
          last_name: lastName
        };
        
        console.log(`📝 AboutSection: Splitting customer name "${value}" into first: "${firstName}", last: "${lastName}"`);
      }
      // Handle loan type fields - need to update multiple related fields
      else if (field === 'productName') {
        const selectedLoanType = loanTypes.find(lt => lt.name === value);
        if (selectedLoanType) {
          updatePayload = {
            loan_type_id: selectedLoanType._id,
            loan_type: value,
            loan_type_name: value
          };
          console.log(`📡 AboutSection: Updating all loan type fields together`);
        } else {
          updatePayload = { [apiField]: value };
        }
      }
      // For all other fields, send minimal payload
      else {
        updatePayload = { [apiField]: value };
      }

      console.log(`📤 AboutSection: Update payload for ${field}:`, updatePayload);
      
      // Try parent onSave first (if available)
      // Otherwise fallback to direct API call for backward compatibility
      let savedViaParent = false;
      if (onSave && typeof onSave === 'function') {
        try {
          console.log(`📡 AboutSection: Calling parent onSave`);
          const result = onSave(updatePayload);
          if (result instanceof Promise) {
            await result;
          }
          savedViaParent = true;
          console.log(`✅ AboutSection: Saved via parent callback`);
        } catch (error) {
          console.warn(`⚠️ AboutSection: Parent onSave failed, falling back to direct API:`, error);
        }
      }
      
      // Fallback to direct API call if no parent callback or if it failed
      if (!savedViaParent && lead?._id) {
        console.log(`📡 AboutSection: Using direct API call (backward compatibility)`);
        await saveToAPI(field, value, updatePayload);
      }
      
      // CRITICAL FIX: Keep the field value visible in UI after save
      // The local state was already updated at the start, so ensure it persists
      setFields(prev => ({ ...prev, [field]: value }));
      console.log(`✅ AboutSection: Confirmed ${field} value in UI: ${value}`);
      
      // Show success message
      setSaveStatus('✅ Saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
      
    } catch (error) {
      console.error(`❌ AboutSection: Error saving ${field}:`, error);
      setSaveStatus('❌ Save failed');
      setTimeout(() => setSaveStatus(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Dedicated handler for Created By dropdown selection (avoids async setState race condition)
  const handleCreatedBySelect = async (userId, userName, userDepartment) => {
    setSelectedCreatedByDisplayName(userName);
    setCreatedBySearch('');
    setShowCreatedByDropdown(false);
    setCreatedByUserId(userId);
    // Build payload directly with the userId we have right now (no async state read)
    const updatePayload = { created_by_name: userName, override_created_by_id: userId };
    setIsSaving(true);
    setSaveStatus('💾 Saving...');
    try {
      setFields(prev => ({ ...prev, createdByName: userName }));
      let savedViaParent = false;
      if (onSave && typeof onSave === 'function') {
        try {
          const result = onSave(updatePayload);
          if (result instanceof Promise) await result;
          savedViaParent = true;
        } catch (e) { console.warn('Parent onSave failed for createdBy:', e); }
      }
      if (!savedViaParent && lead?._id) {
        await saveToAPI('createdByName', userName, updatePayload);
      }
      setSaveStatus('✅ Saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
      if (userDepartment) {
        setTimeout(() => handleBlur('teamName', userDepartment), 100);
      }
    } catch (error) {
      console.error('Error saving createdBy:', error);
      setSaveStatus('❌ Save failed');
      setTimeout(() => setSaveStatus(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Dedicated handler for Lead Date & Time change (avoids useEffect overwrite and stale comparison issues)
  const handleCreatedDateChange = async (utcISO) => {
    setSelectedCreatedDate(utcISO);
    const updatePayload = { override_created_at: utcISO };
    setIsSaving(true);
    setSaveStatus('💾 Saving...');
    try {
      setFields(prev => ({ ...prev, createdDate: utcISO }));
      let savedViaParent = false;
      if (onSave && typeof onSave === 'function') {
        try {
          const result = onSave(updatePayload);
          if (result instanceof Promise) await result;
          savedViaParent = true;
        } catch (e) { console.warn('Parent onSave failed for createdDate:', e); }
      }
      if (!savedViaParent && lead?._id) {
        await saveToAPI('createdDate', utcISO, updatePayload);
      }
      setSaveStatus('✅ Saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving createdDate:', error);
      setSaveStatus('❌ Save failed');
      setTimeout(() => setSaveStatus(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to validate mobile numbers
  const validateMobileNumber = (number) => {
    if (!number) return { isValid: true, error: null }; // Empty is allowed
    
    // Check if it's exactly 10 digits
    if (number.length !== 10) {
      return { 
        isValid: false, 
        error: `Number must be 10 digits (${number.length} digits entered)` 
      };
    }
    
    // Check if it starts with 6, 7, 8, or 9
    if (!/^[6-9]/.test(number)) {
      return { 
        isValid: false, 
        error: 'Number must start with 6, 7, 8, or 9' 
      };
    }
    
    return { isValid: true, error: null };
  };

  // Helper function to get the original value from lead data
  const getOriginalValue = (field) => {
    // Use the same extraction logic as extractFieldValue
    return extractFieldValue(field);
  };

  // Enhanced function to save about data to backend API
  const saveToAPI = async (field, value, updatePayload = null) => {
    if (!lead?._id) {
      console.warn('AboutSection: No lead ID available, cannot save to API');
      return false;
    }

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.warn('AboutSection: No user ID available');
        return false;
      }

      // Determine if this is a login lead by checking for original_lead_id field
      const isLoginLead = !!lead.original_lead_id || !!lead.login_created_at;
      const apiUrl = isLoginLead 
        ? `/api/lead-login/login-leads/${lead._id}?user_id=${userId}`
        : `/api/leads/${lead._id}?user_id=${userId}`;
      
      console.log(`📡 AboutSection: Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);

      // Use provided updatePayload if available
      if (updatePayload) {
        console.log(`📡 AboutSection: Using pre-built updatePayload:`, updatePayload);
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(updatePayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`✅ AboutSection: Successfully saved ${field} via updatePayload:`, responseData);
        
        // Fetch updated lead data to refresh the UI and keep it in sync
        try {
          const refreshResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (refreshResponse.ok) {
            const updatedLeadData = await refreshResponse.json();
            console.log('✅ AboutSection: Fetched updated lead data after updatePayload save:', updatedLeadData);
            
            // Update ALL fields in local state with fresh data from backend
            // CRITICAL: Only update fields that exist in response, preserve current values for others
            setFields(prevFields => ({
              ...prevFields,
              id: updatedLeadData.custom_lead_id || updatedLeadData.id || prevFields.id,
              productName: updatedLeadData.loan_type || prevFields.productName,
              loanTypeId: updatedLeadData.loan_type_id || prevFields.loanTypeId,
              loan_type: updatedLeadData.loan_type || prevFields.loan_type,
              loan_type_id: updatedLeadData.loan_type_id || prevFields.loan_type_id,
              loan_type_name: updatedLeadData.loan_type_name || updatedLeadData.loan_type || prevFields.loan_type_name,
              campaignName: updatedLeadData.campaign_name || prevFields.campaignName,
              dataCode: updatedLeadData.data_code || prevFields.dataCode,
              customerName: updatedLeadData.name || prevFields.customerName,
              mobileNumber: updatedLeadData.mobile_number || updatedLeadData.phone || prevFields.mobileNumber,
              alternateNumber: updatedLeadData.alternative_phone || updatedLeadData.alternate_phone || prevFields.alternateNumber,
            }));
            console.log(`✅ AboutSection: Updated all fields in UI after updatePayload save`);
          }
        } catch (refreshError) {
          console.error(`⚠️ AboutSection: Error refreshing after updatePayload save:`, refreshError);
        }
        
        return true;
      }
      
      // Fallback: Build update payload from scratch (backward compatibility)
      console.log(`⚠️ AboutSection: No updatePayload provided, building from field/value`);
      
      // Map fields to appropriate API fields
      const apiFieldMap = {
        id: 'custom_lead_id',
        productName: 'loan_type',
        loanTypeId: 'loan_type_id',
        campaignName: 'campaign_name',
        dataCode: 'data_code',
        customerName: 'name',
        mobileNumber: 'mobile_number',
        alternateNumber: 'alternative_phone'
      };

      const apiField = apiFieldMap[field] || field;
      let updateData = {};

      // Handle customerName field - split into first_name and last_name
      if (field === 'customerName') {
        const nameParts = value.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        updateData = {
          name: value,
          first_name: firstName,
          last_name: lastName
        };
        
        console.log(`📝 AboutSection: Splitting customer name "${value}" into first: "${firstName}", last: "${lastName}"`);
        
        // Immediately update local lead object to reflect changes in UI
        if (lead) {
          lead.name = value;
          lead.first_name = firstName;
          lead.last_name = lastName;
        }
        
        // Also update local fields state to ensure UI reflects the change immediately
        setFields(prev => ({
          ...prev,
          customerName: value,
          // Also add first_name and last_name if they're used elsewhere in UI
          first_name: firstName,
          last_name: lastName
        }));
      }
      // Handle nested fields
      else if (apiField.includes('.')) {
        const parts = apiField.split('.');
        if (parts[0] === 'dynamic_fields') {
          updateData = {
            dynamic_fields: {
              ...lead.dynamic_fields,
              [parts[1]]: {
                ...lead.dynamic_fields?.[parts[1]],
                [parts[2]]: value
              }
            }
          };
        }
      } else {
        updateData = { [apiField]: value };
      }

      console.log(`📡 AboutSection: Making API call to update ${field}:`, updateData);

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`✅ AboutSection: Successfully saved ${field} to API:`, responseData);
      
      // Fetch updated lead data to refresh the UI
      try {
        const refreshResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (refreshResponse.ok) {
          const updatedLeadData = await refreshResponse.json();
          console.log('✅ AboutSection: Fetched updated lead data after field update:', updatedLeadData);
          
          // Update ALL fields in local state with fresh data from backend
          // This ensures UI stays in sync with database
          // CRITICAL: Only update fields that exist in response, preserve current values for others
          setFields(prevFields => ({
            ...prevFields,
            id: updatedLeadData.custom_lead_id || updatedLeadData.id || prevFields.id,
            productName: updatedLeadData.loan_type || prevFields.productName,
            loanTypeId: updatedLeadData.loan_type_id || prevFields.loanTypeId,
            loan_type: updatedLeadData.loan_type || prevFields.loan_type,
            loan_type_id: updatedLeadData.loan_type_id || prevFields.loan_type_id,
            loan_type_name: updatedLeadData.loan_type_name || updatedLeadData.loan_type || prevFields.loan_type_name,
            campaignName: updatedLeadData.campaign_name || prevFields.campaignName,
            dataCode: updatedLeadData.data_code || prevFields.dataCode,
            customerName: updatedLeadData.name || prevFields.customerName,
            mobileNumber: updatedLeadData.mobile_number || updatedLeadData.phone || prevFields.mobileNumber,
            alternateNumber: updatedLeadData.alternative_phone || updatedLeadData.alternate_phone || prevFields.alternateNumber,
          }));
          console.log(`✅ AboutSection: Updated all fields in UI with fresh data from server`);
        }
      } catch (refreshError) {
        console.error(`Error refreshing lead data after updating ${field}:`, refreshError);
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ AboutSection: Error saving ${field} to API:`, error);
      return false;
    }
  };

  // Function to remove an assignee from Assigned TL field
  const handleRemoveAssignReportTo = (userToRemove) => {
    if (!canEditAssignedLead) return;
    const updatedAssignReportTo = assignReportTo.filter((user) => 
      (typeof user === 'object' ? user.id : user) !== (typeof userToRemove === 'object' ? userToRemove.id : userToRemove)
    );
    setAssignReportTo(updatedAssignReportTo);
    
    // Auto-save the updated assignment
    saveAssignedToAPI(assignedTo, updatedAssignReportTo);
  };
  
  // Function to add an assignee to Assigned TL field
  const handleAddAssignReportTo = (newAssigneeUser) => {
    if (!canEditAssignedLead) return;
    const newUserId = typeof newAssigneeUser === 'object' ? newAssigneeUser.id : newAssigneeUser;
    const newUserName = typeof newAssigneeUser === 'object' ? newAssigneeUser.name : newAssigneeUser;
    
    // Check if user is already assigned
    const isAlreadyAssigned = assignReportTo.some(assignedUser => {
      if (typeof assignedUser === 'object' && typeof newAssigneeUser === 'object') {
        return assignedUser.id === newAssigneeUser.id;
      } else if (typeof assignedUser === 'string' && typeof newAssigneeUser === 'string') {
        return assignedUser === newAssigneeUser;
      } else {
        // Mixed types - compare by name
        const assignedName = typeof assignedUser === 'object' ? assignedUser.name : assignedUser;
        return assignedName === newUserName;
      }
    });

    if (!isAlreadyAssigned) {
      const updatedAssignReportTo = [...assignReportTo, newAssigneeUser];
      setAssignReportTo(updatedAssignReportTo);
      
      // Auto-save the updated assignment
      saveAssignedToAPI(assignedTo, updatedAssignReportTo);
    }
  };

  // Function to save assigned to data to backend API
  const saveAssignedToAPI = async (assignedToData, assignReportToData = []) => {
    if (!lead?._id) {
      console.warn('No lead ID available, cannot save assigned to data');
      return;
    }

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID available');
        return;
      }

      // Determine if this is a login lead by checking for original_lead_id field
      const isLoginLead = !!lead.original_lead_id || !!lead.login_created_at;
      const apiUrl = isLoginLead 
        ? `/api/lead-login/login-leads/${lead._id}?user_id=${userId}`
        : `/api/leads/${lead._id}?user_id=${userId}`;
      
      console.log(`📡 AboutSection (Assignment): Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);

      
      // Extract IDs for assignedTo
      const assignedToIds = assignedToData.map(user => {
        if (typeof user === 'object') {
          // Try to get the ID from different possible properties
          return user.id || user._id || user.user_id || user.name?.toLowerCase().replace(/\s+/g, '_');
        } else {
          return user;
        }
      }).filter(id => id); // Remove any empty values
      
      // Extract IDs for assignReportTo
      const assignReportToIds = assignReportToData.map(user => {
        if (typeof user === 'object') {
          // Try to get the ID from different possible properties
          return user.id || user._id || user.user_id || user.name?.toLowerCase().replace(/\s+/g, '_');
        } else {
          return user;
        }
      }).filter(id => id); // Remove any empty values

      // Send both fields as separate arrays to the backend
      // Make sure we're sending proper strings, not arrays with square brackets as strings
      const updateData = {
        assigned_to: assignedToIds.length > 0 ? assignedToIds.map(id => String(id).replace(/[\[\]']/g, '')) : null, // Send null if empty array
        assign_report_to: assignReportToIds.length > 0 ? assignReportToIds.map(id => String(id).replace(/[\[\]']/g, '')) : null // Send null if empty array
      };

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Assigned to data saved to API successfully');
      
      // Fetch updated lead data to refresh the UI
      try {
        const refreshResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (refreshResponse.ok) {
          const updatedLeadData = await refreshResponse.json();
          console.log('Fetched updated lead data:', updatedLeadData);
          
          // Update local state with fresh data from backend
          if (updatedLeadData.assigned_to) {
            updateAssignedUsersWithNames(updatedLeadData.assigned_to, updatedLeadData.assign_report_to, assignableUsers);
          }
        }
      } catch (refreshError) {
        console.error("Error refreshing lead data:", refreshError);
      }
      
      // Update parent component if onSave is provided
      if (onSave) {
        const updatedLead = {
          ...lead,
          assigned_to: assignedToIds,
          assign_report_to: assignReportToIds
        };
        
        try {
          const result = onSave(updatedLead);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          console.error("Error updating lead data in parent:", error);
        }
      }
      
    } catch (error) {
      console.error('Error saving assigned to data to API:', error);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-cyan-300/40 bg-white shadow-md text-[0.9rem] relative overflow-visible">
      <div className="absolute -right-12 -top-10 w-40 h-40 bg-white rounded-full blur-2xl" />
      <div className="absolute -left-16 top-20 w-28 h-28 bg-white rounded-full blur-2xl" />
      
      {/* Auto-save status indicator */}
      {(isSaving || saveStatus) && (
        <div className="absolute top-4 right-4 z-20">
          <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${
            isSaving ? 'bg-blue-100 text-blue-700 border border-blue-300' :
            saveStatus.includes('✅') ? 'bg-green-100 text-green-700 border border-green-300' :
            'bg-red-100 text-red-700 border border-red-300'
          }`}>
            {isSaving && (
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{saveStatus}</span>
          </div>
        </div>
      )}
      
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-bold text-cyan-300 text-sm z-10 relative">
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>LEAD ID</label>
            <input
              className="w-full p-2 border border-[#00bcd4] rounded-md bg-gray-100 text-green-600 text-md font-bold cursor-not-allowed"
              value={fields.id}
              readOnly={true}
              placeholder="Lead ID (Read-only)"
              title="Lead ID cannot be modified"
            />
          </div>

          {/* Date and Time Field */}
          {(() => {
            const isLoginLead = !!(lead?.original_lead_id || lead?.login_created_at);
            // Helper to format date with AM/PM in IST
            const formatAMPM = (dateStr) => {
              if (!dateStr) return 'N/A';
              try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'N/A';
                const IST_TZ = 'Asia/Kolkata';
                const day = date.toLocaleString('en-IN', { timeZone: IST_TZ, day: '2-digit' });
                const month = date.toLocaleString('en-IN', { timeZone: IST_TZ, month: '2-digit' });
                const year = date.toLocaleString('en-IN', { timeZone: IST_TZ, year: 'numeric' });
                const time = date.toLocaleString('en-US', { timeZone: IST_TZ, hour: 'numeric', minute: '2-digit', hour12: true });
                return `${day}-${month}-${year}  ${time}`;
              } catch {
                return 'N/A';
              }
            };

            if (isLoginLead) {
              // Login CRM: show when file was sent to Login Department — always read-only
              const loginDate = lead?.login_date || lead?.login_created_at;
              return (
                <div className="flex flex-col gap-1">
                  <label className={labelClass} style={labelStyle}>LOGIN DATE & TIME</label>
                  <input
                    className="w-full p-2 border border-[#00bcd4] rounded-md bg-gray-100 text-green-600 text-md font-bold cursor-not-allowed"
                    value={formatAMPM(loginDate)}
                    readOnly={true}
                    placeholder="Login date and time"
                    title="Date & time when file was sent to Login Department (IST)"
                  />
                </div>
              );
            }

            // Lead CRM: show original lead creation date
            return (
              <div className="flex flex-col gap-1">
                <label className={labelClass} style={labelStyle}>LEAD DATE & TIME</label>
                {isUserSuperAdmin ? (
                  <input
                    type="datetime-local"
                    className="w-full p-2 border border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold cursor-pointer"
                    value={(() => {
                      const dateStr = selectedCreatedDate || fields.createdDate;
                      if (!dateStr) return '';
                      const date = new Date(dateStr);
                      if (isNaN(date.getTime())) return '';
                      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
                      return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
                    })()}
                    onChange={e => {
                      if (!e.target.value) return;
                      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
                      const utcISO = new Date(new Date(e.target.value + ':00.000Z').getTime() - IST_OFFSET_MS).toISOString();
                      setSelectedCreatedDate(utcISO);
                    }}
                    onBlur={e => {
                      if (!e.target.value) return;
                      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
                      const utcISO = new Date(new Date(e.target.value + ':00.000Z').getTime() - IST_OFFSET_MS).toISOString();
                      handleCreatedDateChange(utcISO);
                    }}
                    title="Super Admin can edit lead creation date & time (IST)"
                  />
                ) : (
                  <input
                    className="w-full p-2 border border-[#00bcd4] rounded-md bg-gray-100 text-green-600 text-md font-bold cursor-not-allowed"
                    value={formatAMPM(lead?.created_at)}
                    readOnly={true}
                    placeholder="Date & Time (Read-only)"
                    title="Lead creation date and time (IST) — only Super Admin can edit"
                  />
                )}
              </div>
            );
          })()}

          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>PRODUCT NAME</label>
            <div className="w-full p-2 border border-[#00bcd4] rounded-md bg-gray-100 text-green-600 text-md font-bold cursor-not-allowed select-none">
              {fields.productName || "—"}
            </div>
          </div>

          {/* Created By Field - with inline team tag */}
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>CREATED BY</label>
            {isUserSuperAdmin ? (
              <div className="relative dropdown-container">
                <div className="w-full flex items-center gap-1 border border-[#00bcd4] rounded-md bg-white px-2 py-1 min-h-[40px] flex-wrap cursor-text" onClick={() => document.getElementById('createdByInput')?.focus()}>
                  <input
                    id="createdByInput"
                    type="text"
                    className="flex-1 min-w-[80px] bg-transparent text-green-600 text-md font-bold outline-none py-1"
                    value={createdBySearch !== '' ? createdBySearch : (() => {
                      if (selectedCreatedByDisplayName) return selectedCreatedByDisplayName;
                      const n = lead?.creator_name || lead?.created_by_name;
                      if (n) return typeof n === 'object' ? (n.name || '') : n;
                      if (lead?.created_by) return typeof lead.created_by === 'object' ? (lead.created_by.name || '') : '';
                      return '';
                    })()}
                    placeholder="Search user..."
                    onChange={e => { setCreatedBySearch(e.target.value); setShowCreatedByDropdown(true); }}
                    onFocus={() => setShowCreatedByDropdown(true)}
                  />
                  {!createdBySearch && (() => {
                    const tn = lead?.department_name
                      ? (typeof lead.department_name === 'object' ? lead.department_name.name : lead.department_name)
                      : (lead?.team_name ? (typeof lead.team_name === 'object' ? lead.team_name.name : lead.team_name) : null);
                    return tn && tn !== 'N/A' ? (
                      <span className="px-2 py-0.5 bg-[#03B0F5] text-white text-xs font-bold rounded-full flex-shrink-0">{tn}</span>
                    ) : null;
                  })()}
                </div>
                {showCreatedByDropdown && (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                    {allUsers
                      .filter(u => !createdBySearch || u.name.toLowerCase().includes(createdBySearch.toLowerCase()))
                      .slice(0, 30)
                      .map(u => (
                        <div
                          key={u.id}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800"
                          onMouseDown={e => {
                            e.preventDefault();
                            handleCreatedBySelect(u.id, u.name, u.department);
                          }}
                        >
                          <div className="font-bold">{u.name}</div>
                          {(u.role_name || u.department) && (
                            <div className="text-xs text-gray-400">{u.role_name}{u.department ? ` · ${u.department}` : ''}</div>
                          )}
                        </div>
                      ))}
                    {allUsers.filter(u => !createdBySearch || u.name.toLowerCase().includes(createdBySearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full p-2 border border-[#00bcd4] rounded-md bg-gray-100 min-h-[40px] flex items-center gap-2 flex-wrap">
                <span className="text-green-600 text-md font-bold">
                  {(() => {
                    const n = lead?.creator_name || lead?.created_by_name;
                    if (n) return typeof n === 'object' ? (n.name || n.first_name || 'Unknown') : n;
                    if (lead?.created_by) return typeof lead.created_by === 'object' ? (lead.created_by.name || lead.created_by.first_name || 'Unknown') : '';
                    return 'N/A';
                  })()}
                </span>
                {(() => {
                  const tn = lead?.department_name
                    ? (typeof lead.department_name === 'object' ? lead.department_name.name : lead.department_name)
                    : (lead?.team_name ? (typeof lead.team_name === 'object' ? lead.team_name.name : lead.team_name) : null);
                  return tn && tn !== 'N/A' ? (
                    <span className="px-2 py-0.5 bg-[#03B0F5] text-white text-xs font-bold rounded-full">{tn}</span>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>SOURCE NAME</label>
            <div ref={campaignDropdownRef} className="relative w-full">
              <div
                className={`w-full p-2 border border-[#00bcd4] rounded-md text-green-600 text-md font-bold min-h-[40px] flex items-center cursor-pointer transition-all duration-300 hover:border-[#0097a7] ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                onClick={() => {
                  if (canEdit) {
                    setShowProductDropdown(false);
                    setShowDataCodeDropdown(false);
                    setShowCampaignDropdown(prev => !prev);
                  }
                }}
              >
                <span className={fields.campaignName ? 'text-green-600 font-bold' : 'text-gray-400 font-normal text-sm'}>
                  {fields.campaignName || 'Select Source'}
                </span>
                <div className="ml-auto flex-shrink-0">
                  <svg className={`w-5 h-5 text-green-600 transition-transform duration-200 ${showCampaignDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              {showCampaignDropdown && canEdit && (
                <div className="absolute z-[500] top-full left-0 right-0 mt-1 bg-white border-2 border-[#00bcd4] rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input
                        autoFocus
                        type="text"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#03B0F5] text-black"
                        placeholder="Search source..."
                        value={campaignSearchTerm}
                        onChange={e => setCampaignSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {getFilteredCampaigns().length > 0 ? (
                      getFilteredCampaigns().map(campaign => (
                        <div
                          key={campaign._id}
                          className={`px-3 py-2.5 cursor-pointer text-sm font-medium transition-colors ${fields.campaignName === campaign.name ? 'bg-[#03B0F5] text-white font-bold' : 'hover:bg-[#e0f7fa] text-black'}`}
                          onClick={() => {
                            handleChange("campaignName", campaign.name);
                            handleBlur("campaignName", campaign.name);
                            setShowCampaignDropdown(false);
                            setCampaignSearchTerm('');
                          }}
                        >
                          {campaign.name}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-5 text-gray-400 text-sm">
                        {campaignSearchTerm ? `No results for "${campaignSearchTerm}"` : 'No sources available'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {canViewDataCode && (
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>DATA CODE</label>
            <div className="relative w-full dropdown-container">
              <div
                className={`w-full p-2 border border-[#00bcd4] rounded-md text-green-600 text-md font-bold min-h-[40px] flex flex-wrap gap-2 items-center cursor-pointer transition-all duration-300 focus-within:border-[#0097a7] focus-within:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                onClick={() => {
                  if (canEdit) {
                    setShowProductDropdown(false);
                    setShowCampaignDropdown(false);
                    setShowDataCodeDropdown(!showDataCodeDropdown);
                  }
                }}
              >
                {(fields.dataCode ? fields.dataCode.split(',').map(s => s.trim()).filter(Boolean) : []).length === 0 && (
                  <span className="text-gray-400 font-normal text-sm">Click to select data codes</span>
                )}
                {(fields.dataCode ? fields.dataCode.split(',').map(s => s.trim()).filter(Boolean) : []).map(code => (
                  <div
                    key={code}
                    className="flex items-center gap-2 bg-[#03B0F5] text-white pl-2 pr-1 py-1 rounded-md text-sm"
                  >
                    <div className="w-5 h-5 rounded-full bg-white text-[#03B0F5] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {code.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold">{code}</span>
                    {canEdit && (
                      <button
                        type="button"
                        className="text-white hover:text-red-200 ml-1 text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const codes = fields.dataCode.split(',').map(s => s.trim()).filter(c => c && c !== code);
                          const newVal = codes.join(', ');
                          handleChange("dataCode", newVal);
                          handleBlur("dataCode", newVal);
                        }}
                      >×</button>
                    )}
                  </div>
                ))}
                {canEdit && (fields.dataCode ? fields.dataCode.split(',').map(s => s.trim()).filter(Boolean) : []).length > 0 && (
                  <button
                    type="button"
                    className="w-6 h-6 rounded-full bg-[#03B0F5] hover:bg-cyan-700 text-white flex items-center justify-center text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProductDropdown(false);
                      setShowCampaignDropdown(false);
                      setShowDataCodeDropdown(!showDataCodeDropdown);
                    }}
                  >+</button>
                )}
              </div>
              {showDataCodeDropdown && canEdit && (
                <div className="absolute w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50 mt-1">
                  <div className="p-3 border-b border-gray-200">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#00bcd4]"
                      placeholder="Search data codes..."
                      value={dataCodeSearchTerm}
                      onChange={(e) => setDataCodeSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {getFilteredDataCodes().length > 0 ? (
                      getFilteredDataCodes().map(dataCode => {
                        const selected = fields.dataCode ? fields.dataCode.split(',').map(s => s.trim()).filter(Boolean).includes(dataCode.name) : false;
                        return (
                          <div
                            key={dataCode._id}
                            className={`px-4 py-2 text-md font-bold text-green-600 hover:bg-gray-100 cursor-pointer flex items-center justify-between ${selected ? 'bg-[#e0f7fa]' : ''}`}
                            onClick={() => {
                              const codes = fields.dataCode ? fields.dataCode.split(',').map(s => s.trim()).filter(Boolean) : [];
                              const newVal = selected
                                ? codes.filter(c => c !== dataCode.name).join(', ')
                                : [...codes, dataCode.name].join(', ');
                              handleChange("dataCode", newVal);
                              handleBlur("dataCode", newVal);
                              setDataCodeSearchTerm('');
                            }}
                          >
                            <span>{dataCode.name}</span>
                            {selected && <span className="text-[#00bcd4] text-lg">✓</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">No data codes found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>CUSTOMER NAME</label>
            <input
              className={`w-full p-2 border border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              value={fields.customerName}
              onChange={e => canEdit && handleChange("customerName", e.target.value.toLocaleUpperCase())}
              onBlur={e => canEdit && handleBlur("customerName", e.target.value.toLocaleUpperCase())}
              readOnly={!canEdit}
              placeholder={!canEdit ? "Read-only: No edit permission" : "Enter customer name"}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>MOBILE NUMBER</label>
            <div className="flex-1">
              <input
                className={`w-full p-2 border rounded-md text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  (!canEdit || !isUserSuperAdmin) ? 'bg-gray-100 cursor-not-allowed border-[#00bcd4]' : 
                  validationErrors.mobileNumber ? 'border-red-500 bg-red-50' : 'border-[#00bcd4] bg-white'
                }`}
                value={fields.mobileNumber}
                onChange={e => (canEdit && isUserSuperAdmin) && handleChange("mobileNumber", e.target.value)}
                onBlur={e => (canEdit && isUserSuperAdmin) && handleBlur("mobileNumber", e.target.value)}
                readOnly={!canEdit || !isUserSuperAdmin}
                placeholder={!isUserSuperAdmin ? "Super Admin only" : "Enter 10-digit mobile number"}
                maxLength="10"
                pattern="[0-9]{10}"
                title={!isUserSuperAdmin ? "Only Super Admin can edit mobile number" : "Enter mobile number"}
              />
              {validationErrors.mobileNumber && (
                <div className="text-red-500 text-sm mt-1 font-normal">
                  {validationErrors.mobileNumber}
                </div>
              )}
              {isCheckingDuplicate && (
                <div className="text-blue-500 text-sm mt-1 font-normal flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Checking for duplicates...
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>ALTERNATE NUMBER</label>
            <div className="flex-1">
              <input
                className={`w-full p-2 border rounded-md text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  !canEditAlternateNumber ? 'bg-gray-100 cursor-not-allowed border-[#00bcd4]' : 
                  validationErrors.alternateNumber ? 'border-red-500 bg-red-50' : 'border-[#00bcd4] bg-white'
                }`}
                value={fields.alternateNumber}
                onChange={e => canEditAlternateNumber && handleChange("alternateNumber", e.target.value)}
                onBlur={e => canEditAlternateNumber && handleBlur("alternateNumber", e.target.value)}
                readOnly={!canEditAlternateNumber}
                placeholder={!canEditAlternateNumber ? 
                  (isUserSuperAdmin ? "Enter 10-digit alternate number" : "Super Admin only") : 
                  "Enter 10-digit alternate number"
                }
                maxLength="10"
                pattern="[0-9]{10}"
                title={!canEditAlternateNumber ? 
                  (isUserSuperAdmin ? "Enter alternate number" : "Only Super Admin can edit alternate number") : 
                  "Enter alternate number"
                }
              />
              {validationErrors.alternateNumber && (
                <div className="text-red-500 text-sm mt-1 font-normal">
                  {validationErrors.alternateNumber}
                </div>
              )}
              {isCheckingDuplicate && (
                <div className="text-blue-500 text-sm mt-1 font-normal flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Checking for duplicates...
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>PINCODE & CITY</label>
            <div className="relative w-full">
              <input
                className={`w-full p-2 pr-10 border border-[#00bcd4] rounded-md bg-white text-green-600 text-md font-bold transition-all duration-300 focus:border-[#0097a7] focus:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] ${
                  !canEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                value={fields.pincode_city}
                onChange={e => canEdit && handleChange("pincode_city", e.target.value)}
                onBlur={e => canEdit && handleBlur("pincode_city", e.target.value)}
                readOnly={!canEdit}
                placeholder={!canEdit ? "Read-only: No edit permission" : "Pincode & City"}
              />
              <button
                type="button"
                onClick={() => {
                  const location = fields.pincode_city || '';
                  if (location.trim()) {
                    window.open(`https://www.google.com/maps/search/${encodeURIComponent(location)}`, '_blank');
                  } else {
                    window.open('https://www.google.com/maps', '_blank');
                  }
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-[#00bcd4] hover:bg-[#0097a7] text-white rounded-md transition-all duration-200 flex items-center justify-center"
                title="Search on Google Maps"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} style={labelStyle}>ASSIGNED Lead</label>
            <div ref={assignInlineDropdownRef} className="relative w-full">
              <div
                className={`w-full p-2 border border-[#00bcd4] rounded-md text-green-600 text-md font-bold min-h-[40px] flex flex-wrap gap-2 items-center transition-all duration-300 ${canEditAssignedLead ? 'bg-white cursor-pointer hover:border-[#0097a7]' : 'bg-gray-100 cursor-not-allowed'}`}
                onClick={() => { if (canEditAssignedLead) setShowAssignInlineDropdown(prev => !prev); }}
              >
                {assignReportTo.length === 0 && (
                  <span className="text-gray-400 font-normal text-sm">Click to select assignee(s)</span>
                )}
                {assignReportTo.map((assignee) => {
                  const displayName = typeof assignee === 'object' ? assignee.name : assignee;
                  const uniqueKey = typeof assignee === 'object' ? assignee.id || assignee.name : assignee;
                  return (
                    <div key={uniqueKey} className="flex items-center gap-2 bg-[#03B0F5] text-white pl-2 pr-1 py-1 rounded-md text-sm">
                      <div className="w-5 h-5 rounded-full bg-white text-[#03B0F5] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        {displayName.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span className="text-xs font-bold">{displayName}</span>
                      {canEditAssignedLead && (
                        <button type="button" className="text-white hover:text-red-200 ml-1 text-sm" onClick={(e) => { e.stopPropagation(); handleRemoveAssignReportTo(assignee); }}>×</button>
                      )}
                    </div>
                  );
                })}
                <div className="ml-auto flex-shrink-0">
                  <svg className={`w-5 h-5 text-green-600 transition-transform duration-200 ${showAssignInlineDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              {showAssignInlineDropdown && canEditAssignedLead && (() => {
                const assignedIds = assignReportTo.map(a => typeof a === 'object' ? a.id : a);
                const available = assignableUsers
                  .filter(u => !assignedIds.includes(u.id || u._id || u.user_id))
                  .map(u => ({
                    id: u.id || u._id || u.user_id,
                    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '',
                    designation: u.designation || '',
                  }));
                const filtered = available.filter(u =>
                  !assignInlineSearch ||
                  u.name.toLowerCase().includes(assignInlineSearch.toLowerCase()) ||
                  (u.designation || '').toLowerCase().includes(assignInlineSearch.toLowerCase())
                );
                return (
                  <div className="absolute z-[500] top-full left-0 right-0 mt-1 bg-white border-2 border-[#00bcd4] rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          autoFocus
                          type="text"
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#03B0F5] text-black"
                          placeholder="Search by name or designation..."
                          value={assignInlineSearch}
                          onChange={e => setAssignInlineSearch(e.target.value.toUpperCase())}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filtered.length > 0 ? filtered.map(u => (
                        <div
                          key={u.id}
                          className="group flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#e0f7fa] transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleAddAssignReportTo(u); }}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#03B0F5] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">
                            {u.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'}
                          </div>
                          <div className="flex flex-col flex-grow min-w-0">
                            <span className="text-sm font-medium text-black truncate">{u.name}</span>
                            {u.designation && <span className="text-xs text-gray-500 truncate">{u.designation}</span>}
                          </div>
                          <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">+</div>
                        </div>
                      )) : (
                        <div className="text-center py-5 text-gray-400 text-sm">
                          {assignInlineSearch ? 'No matching users found' : 'No users available'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}