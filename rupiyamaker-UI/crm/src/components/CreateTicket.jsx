import React, { useState, useRef, useEffect } from 'react';
import API from '../services/api';
import { toast } from 'react-toastify';
import { formatDateTime } from '../utils/dateUtils';

// AssignPopup component for assigning tasks to users
function AssignPopup({ onClose, onSelect }) {
  const [assigneeName, setAssigneeName] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        // Use the new getAssignableUsers method specifically for ticket assignments
        const response = await API.tickets.getAssignableUsers();
        
        // Handle the response structure: { users: [...] }
        if (response && response.users && Array.isArray(response.users)) {
          // Extract user names and IDs from the response
          const usersList = response.users.map(user => ({
            id: user.user_id || user._id || user.id,
            name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            email: user.email || '',
            role: user.role || '',
            designation: user.designation || user.role || user.job_title || ''
          }));
          
          // Filter out entries with empty names
          setUsers(usersList.filter(user => user.name));
        } else if (response && Array.isArray(response)) {
          // Fallback: Handle direct array response
          const usersList = response.map(user => ({
            id: user.user_id || user._id || user.id,
            name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            email: user.email || '',
            role: user.role || '',
            designation: user.designation || user.role || user.job_title || ''
          }));
          
          // Filter out entries with empty names
          setUsers(usersList.filter(user => user.name));
        }
      } catch (error) {
        console.error("Failed to fetch assignable users:", error);
        // Fallback to regular users API if the ticket-specific endpoint fails
        try {
          const fallbackResponse = await API.users.getUsers();
          if (fallbackResponse && Array.isArray(fallbackResponse)) {
            const usersList = fallbackResponse.map(user => ({
              id: user._id || user.id,
              name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
              email: user.email || '',
              role: user.role || '',
              designation: user.designation || user.role || user.job_title || ''
            }));
            setUsers(usersList.filter(user => user.name));
          }
        } catch (fallbackError) {
          console.error("Failed to fetch users (fallback):", fallbackError);
          // Use dummy data as last resort
          setUsers([
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const [filteredAssignees, setFilteredAssignees] = useState([]);

  useEffect(() => {
    // If assigneeName is empty, show all users
    if (assigneeName.trim() === "") {
      setFilteredAssignees(users);
    } else {
      // Otherwise, filter based on input (searching in name and designation)
      setFilteredAssignees(
        users.filter((user) =>
          user.name.toLowerCase().includes(assigneeName.toLowerCase()) ||
          (user.designation && user.designation.toLowerCase().includes(assigneeName.toLowerCase()))
        )
      );
    }
  }, [assigneeName, users]); // Depend on assigneeName and users to re-filter

  const handleAssign = () => {
    if (assigneeName) {
      // Find the user with matching name
      const selectedUser = users.find(user => user.name.toLowerCase() === assigneeName.toLowerCase());
      if (selectedUser) {
        // Pass both id and name to parent
        onSelect({ id: selectedUser.id, name: selectedUser.name });
      } else {
        // If no exact match, just pass the name as entered by user
        onSelect({ name: assigneeName });
      }
    }
    // Clear the input after assigning
    setAssigneeName("");
    onClose(); // Close the popup after assigning
  };

  const selectAssignee = (selectedUser) => {
    // Pass both id and name to parent
    onSelect(selectedUser);
    onClose(); // Close the popup
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent"
    >
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[80%] max-w-xl mx-auto relative">
        <div className="flex items-center mb-4 bg-white bg-opacity-90 p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-lg text-black">Assign Ticket</h3>
        </div>

        <div className="mb-4 bg-white bg-opacity-90 p-3 rounded-md">
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
              placeholder="Search or enter assignee name"
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

        {/* Show loading or the list */}
        {isLoading ? (
          <div className="text-center p-4 bg-white bg-opacity-90 rounded-lg">
            Loading users...
          </div>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90">
            {filteredAssignees.length > 0 ? (
              filteredAssignees.map((user) => (
                <li
                  key={user.id}
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
                  <div className="flex flex-col">
                    <span className="text-black font-medium">{user.name}</span>
                    {user.designation && (
                      <span className="text-gray-600 text-sm">{user.designation}</span>
                    )}
                  </div>
                </li>
              ))
            ) : (
              assigneeName.trim() !== "" && (
                <li className="p-3 text-gray-500 text-center">No matching assignees found.</li>
              )
            )}
          </ul>
        )}

        <div className="flex justify-end gap-4 mt-4 bg-white bg-opacity-90 p-3 rounded-b-xl">
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

function getCurrentDateTimeString() {
  return formatDateTime(new Date());
}

export default function CreateTicket({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    createdBy: "",
    subject: "",
    details: "",
    assignedTo: [],
    assignedUserIds: [], // Store user IDs for API calls
    priority: "medium", // Default priority
    attachment: null,
    attachmentName: "",
    selectedFiles: []
  });
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState(getCurrentDateTimeString());
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const detailsRef = useRef(null);

  // Effect for auto-resizing the details textarea
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.style.height = "auto";
      detailsRef.current.style.height = detailsRef.current.scrollHeight + "px";
    }
  }, [form.details]);
  
  // Get current user from localStorage
  useEffect(() => {
    try {
      const userName = localStorage.getItem('userName');
      const userFirstName = localStorage.getItem('userFirstName');
      const userLastName = localStorage.getItem('userLastName');
      
      // Check for userName first as it's likely the most complete format
      if (userName) {
        setForm(prev => ({ ...prev, createdBy: userName }));
        return;
      }
      
      // Check for first and last name combination
      if (userFirstName && userLastName) {
        setForm(prev => ({ ...prev, createdBy: `${userFirstName} ${userLastName}` }));
        return;
      }
      if (userFirstName) {
        setForm(prev => ({ ...prev, createdBy: userFirstName }));
        return;
      }
      
      // Check for a full user object
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          // Return user info in order of most likely to contain a full name
          if (parsedUser.name) {
            setForm(prev => ({ ...prev, createdBy: parsedUser.name }));
            return;
          }
          if (parsedUser.fullName) {
            setForm(prev => ({ ...prev, createdBy: parsedUser.fullName }));
            return;
          }
          if (parsedUser.firstName && parsedUser.lastName) {
            setForm(prev => ({ ...prev, createdBy: `${parsedUser.firstName} ${parsedUser.lastName}` }));
            return;
          }
          if (parsedUser.firstName) {
            setForm(prev => ({ ...prev, createdBy: parsedUser.firstName }));
            return;
          }
          if (parsedUser.username) {
            setForm(prev => ({ ...prev, createdBy: parsedUser.username }));
            return;
          }
          if (parsedUser.email) {
            setForm(prev => ({ ...prev, createdBy: parsedUser.email }));
            return;
          }
        } catch (parseError) {
          console.log("Error parsing user data:", parseError);
        }
      }
      
      setForm(prev => ({ ...prev, createdBy: "Current User" }));
    } catch (error) {
      console.log("Error getting current user:", error);
      setForm(prev => ({ ...prev, createdBy: "Current User" }));
    }
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleChange("attachment", file);
      handleChange("attachmentName", file.name);
      
      // Also maintain compatibility with the old files array
      const files = Array.from(event.target.files);
      setForm(prev => ({
        ...prev,
        selectedFiles: [...prev.selectedFiles, ...files]
      }));
    }
  };

  // Function to remove an assignee
  const handleRemoveAssignee = (nameToRemove) => {
    setForm((prevForm) => ({
      ...prevForm,
      assignedTo: prevForm.assignedTo.filter((assignee) => 
        typeof assignee === 'string' 
          ? assignee !== nameToRemove 
          : assignee.name !== nameToRemove
      ),
      assignedUserIds: prevForm.assignedUserIds.filter((id, index) => {
        const assignee = prevForm.assignedTo[index];
        return typeof assignee === 'string' 
          ? assignee !== nameToRemove 
          : assignee.name !== nameToRemove;
      })
    }));
  };

  // Function to add an assignee from the popup
  const handleAddAssignee = (newAssignee) => {
    setForm((prevForm) => {
      // Get name from string or object
      const assigneeName = typeof newAssignee === 'string' ? newAssignee : newAssignee.name;
      const assigneeId = typeof newAssignee === 'string' ? null : newAssignee.id;
      
      // Check if name already exists in assignedTo
      const nameExists = prevForm.assignedTo.some(existing => {
        if (typeof existing === 'string') {
          return existing === assigneeName;
        } else {
          return existing.name === assigneeName;
        }
      });
      
      // Only add if not already present
      if (!nameExists) {
        return {
          ...prevForm,
          assignedTo: [...prevForm.assignedTo, newAssignee],
          assignedUserIds: assigneeId ? [...(prevForm.assignedUserIds || []), assigneeId] : prevForm.assignedUserIds || []
        };
      }
      return prevForm; // If already present, don't update
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form data
    if (!form.subject || !form.details) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      // Prepare ticket data for API
      const ticketData = {
        subject: form.subject,
        description: form.details,
        priority: form.priority || "medium",
        assigned_users: form.assignedUserIds.length > 0 ? form.assignedUserIds : []
      };

      // If files need to be uploaded, we'd handle that here
      // This would involve a separate API call for file upload

      if (onSubmit) {
        // Pass the data in the format expected by the parent component
        onSubmit({
          createdBy: form.createdBy,
          subject: form.subject,
          details: form.details,
          priority: form.priority,
          assignedTo: form.assignedTo,
          assignedUserIds: form.assignedUserIds,
          files: form.selectedFiles,
        });
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to create ticket");
    }

    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
      <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl mx-auto space-y-2 max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        <h2 className="text-xl font-bold text-blue-500 mb-4">ADD TICKET</h2>
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={currentDateTime}
                  readOnly
                />
              </div>
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1" htmlFor="createdBy">
                  Created By
                </label>
                <input
                  id="createdBy"
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={form.createdBy}
                  onChange={(e) => handleChange("createdBy", e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div className="mt-4">
              <label
                className="block font-bold text-gray-700 mb-1"
                htmlFor="subject"
              >
                Subject
              </label>
              <input
                id="subject"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={form.subject}
                onChange={(e) => handleChange("subject", e.target.value.toUpperCase())}
                placeholder="Enter subject"
                required
              />
            </div>

            <div className="mt-4">
              <label
                className="block font-bold text-gray-700 mb-1"
                htmlFor="details"
              >
                Ticket Details
              </label>
              <textarea
                ref={detailsRef}
                id="details"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none overflow-hidden"
                rows={3}
                value={form.details}
                onChange={(e) => handleChange("details", e.target.value.toUpperCase())}
                placeholder="Enter ticket details..."
                required
                style={{
                  minHeight: "3rem",
                  maxHeight: "400px",
                  transition: "height 0.2s",
                }}
              />
            </div>

            {/* <div className="mt-4">
              <label
                className="block font-bold text-gray-700 mb-1"
                htmlFor="priority"
              >
                Priority
              </label>
              <select
                id="priority"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={form.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div> */}

            <div className="flex flex-col items-start mt-4">
              <label className="block font-bold text-gray-700 mb-2">
                Attachment
              </label>
              <label className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow cursor-pointer hover:bg-cyan-600 transition">
                Photo/PDF
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  multiple
                />
              </label>
              {form.attachmentName && (
                <span className="mt-2 text-green-700 font-semibold text-sm">
                  Uploaded: {form.attachmentName}
                </span>
              )}
              {form.selectedFiles.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {form.selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index}`}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <span className="text-sm text-black">{file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modified Assignee Section for multiple assignees */}
            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">
                Assignee
              </label>
              <div className="flex flex-wrap items-center gap-2 border border-cyan-400 rounded-md bg-white p-1 pr-2 min-h-[42px]">
                {/* Display all assigned names as pills */}
                {form.assignedTo.map((assignee, index) => {
                  // Get name based on whether assignee is a string or object
                  const assigneeName = typeof assignee === 'string' ? assignee : assignee.name;
                  
                  return (
                    <div
                      key={index} // Using index as key since we might have duplicate names
                      className="bg-blue-100 text-blue-800 py-1 px-3 rounded-md flex items-center"
                    >
                      {/* Profile icon with initials */}
                      <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-2 text-xs flex-shrink-0">
                        {assigneeName.split(' ')
                          .map(part => part[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <span>{assigneeName}</span>
                      <button
                        type="button"
                        className="ml-2 text-blue-500 hover:text-blue-700"
                        onClick={() => handleRemoveAssignee(assigneeName)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="text-blue-600 font-medium hover:text-blue-800 ml-auto" // Pushed to the right
                  onClick={() => setShowAssignPopup(true)}
                >
                  + Add more
                </button>
              </div>
            </div>
            {/* End of Modified Assignee Section */}

            <div className="flex gap-4 mt-6">
              <button
                type="button"
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition text-lg"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg"
              >
                Add Ticket
              </button>
            </div>
          </form>
      </div>
      
      {/* Assign Popup */}
      {showAssignPopup && (
        <AssignPopup
          onClose={() => setShowAssignPopup(false)}
          onSelect={(user) => {
            handleAddAssignee(user);
            setShowAssignPopup(false);
          }}
        />
      )}
    </div>
  );
}