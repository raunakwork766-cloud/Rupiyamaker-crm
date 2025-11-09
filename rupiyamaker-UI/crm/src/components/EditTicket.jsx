import { useState, useEffect, useRef } from "react";
import API from '../services/api';
import { toast } from 'react-toastify';
import { API_BASE_URL, buildApiUrl, buildMediaUrl } from '../config/api';
import { formatDateTime } from '../utils/dateUtils';

// AssignPopup component for assigning tickets to users
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
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[90%] max-w-5xl mx-auto relative">
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
              assigneeName.trim() !== "" ? (
                <li className="p-3 text-gray-500 text-center">No matching assignees found.</li>
              ) : null
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

export default function EditTicket({ ticket: initialTicket, onSave, onClose }) {
  // Restructure backend ticket data to fit UI format
  const formatTicketForUI = (backendTicket) => {
    console.log("Backend ticket data:", backendTicket);
    console.log("Backend attachments:", backendTicket.attachments);
    
    return {
      id: backendTicket._id || backendTicket.id,
      createdBy: backendTicket.created_by_name || "Unknown",
      status: backendTicket.status?.toUpperCase() || "OPEN",
      subject: backendTicket.subject || "",
      message: backendTicket.description || "",
      assign: Array.isArray(backendTicket.assigned_users_details) && backendTicket.assigned_users_details.length > 0
        ? backendTicket.assigned_users_details.map(user => user.name).join(", ")
        : "Unassigned",
      // For internal use
      assigned_users: backendTicket.assigned_users || [],
      assignedTo: Array.isArray(backendTicket.assigned_users_details) 
        ? backendTicket.assigned_users_details.map(user => ({
            id: user.user_id || user._id || user.id, 
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
          }))
        : [],
      priority: backendTicket.priority || "medium",
      created_by: backendTicket.created_by || "",
      // For comments and attachments
      comments: backendTicket.comments 
        ? backendTicket.comments.map(comment => ({
            user: comment.created_by_name || "Unknown",
            text: comment.content,
            time: new Date(comment.created_at).toLocaleString()
          })) 
        : [],
      attachments: backendTicket.attachments 
        ? backendTicket.attachments.map(attachment => {
            console.log("Processing attachment:", attachment);
            
            // Check if file_path is absolute server path or relative path
            let fileUrl;
            if (attachment.file_path) {
              if (attachment.file_path.startsWith('http')) {
                fileUrl = attachment.file_path;
              } else if (attachment.file_path.startsWith('/')) {
                // Extract just the filename from the absolute path
                const filename = attachment.file_path.split('/').pop();
                fileUrl = buildMediaUrl(`media/tickets/${filename}`);
              } else {
                // Assume it's already a relative path
                fileUrl = buildMediaUrl(attachment.file_path);
              }
            } else {
              fileUrl = ''; // Fallback if no file_path
            }
              
            return {
              id: attachment.attachment_id,
              name: attachment.filename,
              url: fileUrl,
              isFromBackend: true,
              size: attachment.file_size,
              mimeType: attachment.mime_type,
              uploadedBy: attachment.uploaded_by,
              uploadedAt: attachment.uploaded_at
            };
          }) 
        : [],
      removedAttachments: [],
      newAttachments: [],
      newComment: "",
      showAttachments: backendTicket.attachments && backendTicket.attachments.length > 0
    };
  };

  const [ticket, setTicket] = useState(formatTicketForUI(initialTicket));
  const [isOpen, setIsOpen] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState(getCurrentDateTimeString());
  const [showComments, setShowComments] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [backendHistoryLoaded, setBackendHistoryLoaded] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all'); // Filter state for history

  // Reference for textarea to auto-resize
  const messageRef = useRef(null);

  // Load backend history when component mounts
  useEffect(() => {
    const loadBackendHistory = async () => {
      if (!backendHistoryLoaded && ticket.id) {
        setIsLoadingHistory(true);
        try {
          console.log("🔄 Loading ticket history for ID:", ticket.id);
          const response = await API.tickets.getHistory(ticket.id);
          console.log("📋 Backend history response:", response);
          
          if (response && response.history && Array.isArray(response.history)) {
            // Convert backend history to frontend format
            const backendHistory = response.history.map((item, index) => ({
              id: item.id || `history-${Date.now()}-${index}`,
              user: (item.user || "UNKNOWN USER").toUpperCase(),
              action: item.action || "Unknown Action",
              time: item.time ? new Date(item.time) : new Date(),
              details: item.details || "",
              isFromBackend: true
            }));
            
            console.log("✅ Processed history items:", backendHistory);
            setHistoryItems(backendHistory);
            setBackendHistoryLoaded(true);
          } else {
            console.warn("⚠️ Invalid history response format:", response);
            setHistoryItems([]);
            setBackendHistoryLoaded(true);
          }
        } catch (error) {
          console.error("❌ Failed to load ticket history:", error);
          // Set empty array instead of dummy data to indicate no history available
          setHistoryItems([]);
          setBackendHistoryLoaded(true);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    };

    loadBackendHistory();
  }, [ticket.id, backendHistoryLoaded, initialTicket]);

  // Function to refresh history from backend
  const refreshHistory = async () => {
    try {
      if (!ticket.id) {
        console.warn("⚠️ No ticket ID available for history refresh");
        return;
      }
      
      console.log("🔄 Refreshing ticket history for ID:", ticket.id);
      const response = await API.tickets.getHistory(ticket.id);
      console.log("📋 Refreshed history response:", response);
      
      if (response && response.history && Array.isArray(response.history)) {
        const backendHistory = response.history.map((item, index) => ({
          id: item.id || `history-${Date.now()}-${index}`,
          user: (item.user || "UNKNOWN USER").toUpperCase(),
          action: item.action || "Unknown Action",
          time: item.time ? new Date(item.time) : new Date(),
          details: item.details || "",
          isFromBackend: true
        }));
        
        console.log("✅ Updated history items:", backendHistory);
        setHistoryItems(backendHistory);
      } else {
        console.warn("⚠️ Invalid refreshed history format:", response);
        setHistoryItems([]);
      }
    } catch (error) {
      console.error("❌ Failed to refresh ticket history:", error);
      // Keep existing history on refresh failure
    }
  };

  // Effect for auto-resizing the message textarea
  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = messageRef.current.scrollHeight + "px";
    }
  }, [ticket.message]);

  // Function to handle form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("Submitting updated ticket with data:", {
        newAttachments: ticket.newAttachments,
        attachmentsToRemove: ticket.removedAttachments
      });
      
      // Prepare data for the API
      const ticketData = {
        subject: ticket.subject,
        description: ticket.message,
        priority: ticket.priority || "medium",
        status: ticket.status.toLowerCase(),
        assigned_users: ticket.assigned_users || [],
      };

      // Validate required fields
      if (!ticketData.subject.trim()) {
        setError("Subject is required");
        return;
      }
      if (!ticketData.description.trim()) {
        setError("Message is required");
        return;
      }

      // Handle attachments if there are new ones or removed ones
      if (ticket.newAttachments?.length > 0) {
        console.log("Found new attachments to upload:", ticket.newAttachments.map(a => a.name));
      }
      
      // For now, we're just passing the whole ticket object to the parent
      // which will handle the API call
      if (onSave) {
        console.log("Calling onSave with new attachments:", ticket.newAttachments);
        await onSave({
          ...ticket,
          _id: ticket.id, // Ensure we have _id for the API
          // Include attachment info for API handling
          attachmentsToRemove: ticket.removedAttachments.filter(att => att.id).map(att => att.id),
          newAttachments: ticket.newAttachments
        });
        
        // Refresh history from backend after successful update
        setTimeout(async () => {
          await refreshHistory();
        }, 500); // Small delay to ensure backend has processed the update
      }
      
      // Exit edit mode after successful update
      setIsEditing(false);
      
      toast.success("Ticket updated successfully");
    } catch (err) {
      console.error("Error updating ticket:", err);
      setError("Failed to update ticket");
      toast.error("Failed to update ticket");
      
      // Log failed update attempt
      addHistoryItem("Failed to update ticket", "Update operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    console.log("Selected files for attachment:", files.map(f => f.name));
    
    if (files.length > 0) {
      const newAttachments = files
        .filter((file) => file.type.startsWith("image/") || file.type === "application/pdf")
        .map((file) => ({
          file,
          name: file.name,
          url: URL.createObjectURL(file),
          isNew: true,
          isFromBackend: false  // Explicitly mark as not from backend
        }));
      
      console.log("Created new attachment objects:", newAttachments);
      
      setTicket((prev) => {
        const updatedTicket = {
          ...prev,
          attachments: [...prev.attachments, ...newAttachments],
          newAttachments: [...prev.newAttachments, ...newAttachments],
          showAttachments: true,
        };
        console.log("Updated ticket with new attachments:", updatedTicket.newAttachments);
        return updatedTicket;
      });
    }
  };
 
  // Handle field change - no uppercase conversion during typing (voice typing compatibility)
  const handleChange = (field, value) => {
    setTicket((prev) => ({ ...prev, [field]: value }));
  };

  // Handle blur - apply uppercase when user leaves the field
  const handleBlur = (field) => {
    const excludeFromUppercase = ['id', 'assignTo', 'priority', 'status', 'ticketNumber'];
    if (excludeFromUppercase.includes(field) || typeof ticket[field] !== 'string') {
      return;
    }
    setTicket((prev) => ({ ...prev, [field]: prev[field].toUpperCase() }));
  };
 
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't submit if comment is empty or already loading
    if (!ticket.newComment.trim() || isSubmittingComment) {
      return false;
    }
    
    setIsSubmittingComment(true);
    
    // Store the comment text before clearing it
    const commentText = ticket.newComment.trim();
    
    // Clear the input immediately for better UX
    setTicket((prev) => ({
      ...prev,
      newComment: "",
    }));
    
    try {
      // Call API to add comment
      await API.tickets.addComment(ticket.id, commentText);
      
      // Add comment to local state for immediate display
      const now = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      
      const newComment = {
        user: ticket.createdBy || "You", 
        text: commentText, 
        time: now
      };
      
      setTicket((prev) => ({
        ...prev,
        comments: [newComment, ...prev.comments],
      }));
      
      // Refresh history from backend to get the new comment entry
      setTimeout(async () => {
        await refreshHistory();
      }, 500); // Small delay to ensure backend has processed the comment
      
      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      
      // Restore the comment text if there was an error
      setTicket((prev) => ({
        ...prev,
        newComment: commentText,
      }));
      
      // Log failed comment attempt
      addHistoryItem("Failed to add comment", "Comment submission failed");
      
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
    
    return false; // Prevent any further event propagation
  };
 
  const handleClose = () => {
    // Log if user was in edit mode when closing
    if (isEditing) {
      addHistoryItem("Cancelled editing", "Exited edit mode without saving changes");
    }
    
    setIsOpen(false); // Close the modal locally
    if (onClose) onClose(); // Call the parent onClose if provided
  };

  // Function to add history item (for immediate UI feedback, backend tracks automatically)
  const addHistoryItem = (action, details = "") => {
    const currentUser = ticket.createdBy || "Current User"; // You can get the actual current user from authentication context
    const newHistoryItem = {
      id: Date.now(),
      user: currentUser,
      action: action,
      time: new Date(),
      details: details,
      isFromBackend: false
    };
    setHistoryItems(prev => [newHistoryItem, ...prev]);
  };

  // Function to handle completing ticket (closing it)
  const handleCompleteTicket = async () => {
    try {
      setIsLoading(true);
      
      // Update ticket status to 'closed' - ONLY send status field
      const ticketData = {
        status: 'closed'
      };
      
      await API.tickets.updateTicket(ticket.id, ticketData);
      toast.success("Ticket closed successfully");
      
      // Update local state
      const updatedTicket = {
        ...ticket,
        status: 'CLOSED'
      };
      setTicket(updatedTicket);
      
      // Call parent onSave callback to trigger tab switching and data refresh
      if (onSave) {
        const formattedTicket = {
          ...updatedTicket,
          status: 'closed', // lowercase for TicketPage compatibility
          _id: ticket.id || ticket._id,
          id: ticket.id || ticket._id
        };
        await onSave(formattedTicket);
      }
      
      // Refresh history from backend to get the new entry
      setTimeout(async () => {
        await refreshHistory();
      }, 500);
      
    } catch (error) {
      console.error("Error completing ticket:", error);
      toast.error("Failed to close ticket");
      addHistoryItem("Failed to close ticket", "Close operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle failing ticket
  const handleFailTicket = async () => {
    try {
      setIsLoading(true);
      
      // Update ticket status to 'failed' - ONLY send status field
      const ticketData = {
        status: 'failed'
      };
      
      await API.tickets.updateTicket(ticket.id, ticketData);
      toast.success("Ticket marked as failed");
      
      // Update local state
      const updatedTicket = {
        ...ticket,
        status: 'FAILED'
      };
      setTicket(updatedTicket);
      
      // Call parent onSave callback to trigger tab switching and data refresh
      if (onSave) {
        const formattedTicket = {
          ...updatedTicket,
          status: 'failed', // lowercase for TicketPage compatibility
          _id: ticket.id || ticket._id,
          id: ticket.id || ticket._id
        };
        await onSave(formattedTicket);
      }
      
      // Refresh history from backend to get the new entry
      setTimeout(async () => {
        await refreshHistory();
      }, 500);
      
    } catch (error) {
      console.error("Error failing ticket:", error);
      toast.error("Failed to mark ticket as failed");
      addHistoryItem("Failed to mark ticket as failed", "Fail operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle reopening ticket (from closed or failed status)
  const handleReopenTicket = async () => {
    try {
      setIsLoading(true);
      
      // Update ticket status to 'open' - ONLY send status field
      const ticketData = {
        status: 'open'
      };
      
      await API.tickets.updateTicket(ticket.id, ticketData);
      toast.success("Ticket reopened successfully");
      
      // Update local state
      const updatedTicket = {
        ...ticket,
        status: 'OPEN'
      };
      setTicket(updatedTicket);
      
      // Call parent onSave callback to trigger tab switching and data refresh
      if (onSave) {
        const formattedTicket = {
          ...updatedTicket,
          status: 'open', // lowercase for TicketPage compatibility
          _id: ticket.id || ticket._id,
          id: ticket.id || ticket._id
        };
        await onSave(formattedTicket);
      }
      
      // Refresh history from backend to get the new entry
      setTimeout(async () => {
        await refreshHistory();
      }, 500);
      
    } catch (error) {
      console.error("Error reopening ticket:", error);
      toast.error("Failed to reopen ticket");
      addHistoryItem("Failed to reopen ticket", "Reopen operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle status completion/opening (DEPRECATED - keeping for backward compatibility)
  const handleStatusToggle = async () => {
    const newStatus = ticket.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    const oldStatus = ticket.status;
    
    try {
      setIsLoading(true);
      
      if (newStatus === 'CLOSED') {
        // Close the ticket
        await API.tickets.closeTicket(ticket.id);
        toast.success("Ticket closed successfully");
      } else {
        // Reopen the ticket
        await API.tickets.reopenTicket(ticket.id);
        toast.success("Ticket reopened successfully");
      }
      
      // Update local state
      const updatedTicket = {
        ...ticket,
        status: newStatus
      };
      setTicket(updatedTicket);
      
      // Call parent onSave callback to trigger tab switching and data refresh
      // Format the ticket data correctly for the parent component
      if (onSave) {
        const formattedTicket = {
          ...updatedTicket,
          status: newStatus.toLowerCase(), // Convert to lowercase for TicketPage compatibility
          _id: ticket.id || ticket._id,
          id: ticket.id || ticket._id
        };
        await onSave(formattedTicket);
      }
      
      // Refresh history from backend to get the new entry
      setTimeout(async () => {
        await refreshHistory();
      }, 500); // Small delay to ensure backend has processed the action
      
    } catch (error) {
      console.error("Error toggling ticket status:", error);
      toast.error(`Failed to ${newStatus === 'CLOSED' ? 'close' : 'reopen'} ticket`);
      
      // Log failed attempt
      addHistoryItem(
        `Failed to ${newStatus === 'CLOSED' ? 'close' : 'reopen'} ticket`,
        "Status change operation failed"
      );
    } finally {
      setIsLoading(false);
    }
  };
 
  const toggleComments = () => {
    setShowComments(!showComments);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    setShowComments(false);
  };

  // Function to remove an assignee
  const handleRemoveAssignee = (nameToRemove) => {
    setTicket((prevTicket) => {
      // Filter out the removed assignee from assignedTo
      const updatedAssignedTo = prevTicket.assignedTo.filter(assignee => {
        if (typeof assignee === 'string') {
          return assignee !== nameToRemove;
        } else {
          return assignee.name !== nameToRemove;
        }
      });
      
      // Filter out the corresponding assigned_users entry
      const updatedAssignedUserIds = prevTicket.assigned_users.filter((id, index) => {
        const assignee = prevTicket.assignedTo[index];
        if (typeof assignee === 'string') {
          return assignee !== nameToRemove;
        } else {
          return assignee.name !== nameToRemove;
        }
      });
      
      // Get names for display
      const assigneeNames = updatedAssignedTo.map(a => 
        typeof a === 'string' ? a : a.name
      );
      
      // Add to history with more detail
      const remainingAssignees = assigneeNames.length > 0 ? assigneeNames.join(', ') : 'Unassigned';
      addHistoryItem("Removed assignee", `Removed: ${nameToRemove}. Current assignees: ${remainingAssignees}`);
      
      return {
        ...prevTicket,
        assignedTo: updatedAssignedTo,
        assign: assigneeNames.join(", "),
        assigned_users: updatedAssignedUserIds
      };
    });
  };

  // Function to add an assignee from the popup
  const handleAddAssignee = (newAssignee) => {
    setTicket((prevTicket) => {
      // Get name from string or object
      const assigneeName = typeof newAssignee === 'string' ? newAssignee : newAssignee.name;
      const assigneeId = typeof newAssignee === 'string' ? null : newAssignee.id;
      
      // Check if name already exists in assignedTo
      const nameExists = prevTicket.assignedTo.some(existing => {
        if (typeof existing === 'string') {
          return existing === assigneeName;
        } else {
          return existing.name === assigneeName;
        }
      });
      
      // Only add if not already present
      if (!nameExists) {
        const updatedAssignedTo = [...prevTicket.assignedTo, newAssignee];
        const updatedAssignedUserIds = assigneeId 
          ? [...(prevTicket.assigned_users || []), assigneeId]
          : prevTicket.assigned_users || [];
        
        // Get names for display
        const assigneeNames = updatedAssignedTo.map(a => 
          typeof a === 'string' ? a : a.name
        );
        
        // Add to history with current assignee list
        addHistoryItem("Added assignee", `Added: ${assigneeName}. Current assignees: ${assigneeNames.join(', ')}`);
        
        return {
          ...prevTicket,
          assignedTo: updatedAssignedTo,
          assign: assigneeNames.join(", "),
          assigned_users: updatedAssignedUserIds
        };
      }
      return prevTicket;
    });
  };
 
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
      <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-5xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        <h2 className="text-xl font-bold text-blue-500 mb-4">EDIT TICKET</h2>
        
          <form onSubmit={handleEditSubmit}>
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
                  value={ticket.createdBy}
                  onChange={(e) => handleChange("createdBy", e.target.value)}
                  required
                  readOnly
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
                className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold ${!isEditing ? 'bg-gray-100' : ''}`}
                value={ticket.subject}
                onChange={(e) => handleChange("subject", e.target.value)}
                onBlur={() => handleBlur("subject")}
                placeholder="Enter subject"
                required
                readOnly={!isEditing}
              />
            </div>

            <div className="mt-4">
              <label
                className="block font-bold text-gray-700 mb-1"
                htmlFor="message"
              >
                Ticket Details
              </label>
              <textarea
                ref={messageRef}
                id="message"
                className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none overflow-hidden ${!isEditing ? 'bg-gray-100' : ''}`}
                rows={3}
                value={ticket.message}
                onChange={(e) => handleChange("message", e.target.value)}
                onBlur={() => handleBlur("message")}
                placeholder="Enter ticket details..."
                required
                readOnly={!isEditing}
                style={{
                  minHeight: "3rem",
                  maxHeight: "400px",
                  transition: "height 0.2s",
                }}
              />
            </div>
            <div className="flex flex-col items-start mt-4">
              <label className="block font-bold text-gray-700 mb-2">
                Attachment
              </label>
              <label className={`inline-flex items-center px-4 py-2 font-bold rounded-lg shadow transition ${isEditing ? 'bg-cyan-500 text-white cursor-pointer hover:bg-cyan-600' : 'bg-gray-400 text-gray-600 cursor-not-allowed'}`}>
                Photo/PDF
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleAttachmentChange}
                  multiple
                  disabled={!isEditing}
                />
              </label>
              
              {/* Display existing attachments with a clear heading */}
              <h4 className="font-semibold text-gray-700 mt-4 mb-2 w-full">
                {ticket.attachments.filter(a => a.isFromBackend).length > 0 
                  ? "Previous Attachments" 
                  : ""}
              </h4>
              
              {/* Show previous attachments from the backend */}
              {ticket.attachments.filter(a => a.isFromBackend).length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-4 w-full">
                  {ticket.attachments
                    .filter(attachment => attachment.isFromBackend)
                    .map((attachment, index) => (
                    <div key={`backend-${index}`} className="flex items-center bg-gray-100 p-2 rounded-lg relative border-2 border-blue-200">
                      {attachment.url && (attachment.url.match(/\.(jpeg|jpg|gif|png)$/i) || (attachment.mimeType && attachment.mimeType.startsWith('image/'))) ? (
                        <img
                          src={attachment.url}
                          alt={`Preview ${index}`}
                          className="w-20 h-20 object-cover rounded-lg mr-2"
                          onError={(e) => {
                            console.error("Image failed to load:", attachment.url);
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/80x80?text=Error";
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded-lg mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="text-sm text-black font-medium truncate">{attachment.name}</span>
                        <div className="flex flex-col">
                          <a 
                            href={attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View
                          </a>
                          {attachment.uploadedAt && (
                            <span className="text-xs text-gray-500">
                              Uploaded: {new Date(attachment.uploadedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          onClick={() => {
                            setTicket(prev => ({
                              ...prev,
                              attachments: prev.attachments.filter(a => a !== attachment),
                              removedAttachments: [...(prev.removedAttachments || []), attachment]
                            }));
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Show newly added attachments with a separate heading */}
              <h4 className="font-semibold text-gray-700 mt-4 mb-2 w-full">
                {ticket.attachments.filter(a => !a.isFromBackend).length > 0 
                  ? "New Attachments" 
                  : ""}
              </h4>
              
              {/* Display newly added attachments */}
              {ticket.attachments.filter(a => !a.isFromBackend).length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-4 w-full">
                  {ticket.attachments
                    .filter(attachment => !attachment.isFromBackend)
                    .map((attachment, index) => (
                    <div key={`new-${index}`} className="flex items-center bg-gray-100 p-2 rounded-lg relative border-2 border-green-200">
                      {attachment.url && attachment.url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                        <img
                          src={attachment.url}
                          alt={`Preview ${index}`}
                          className="w-20 h-20 object-cover rounded-lg mr-2"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/80x80?text=Error";
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded-lg mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="text-sm text-black font-medium truncate">{attachment.name}</span>
                        <div className="flex flex-col">
                          <a 
                            href={attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Preview
                          </a>
                          <span className="text-xs text-green-600">
                            New file - not yet uploaded
                          </span>
                        </div>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          onClick={() => {
                            setTicket(prev => ({
                              ...prev,
                              attachments: prev.attachments.filter(a => a !== attachment),
                              newAttachments: prev.newAttachments.filter(a => a !== attachment)
                            }));
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              
              {/* Show message when no attachments exist */}
              {ticket.attachments.length === 0 && (
                <div className="mt-2 p-4 bg-gray-100 rounded-lg text-gray-500 text-center w-full">
                  No attachments available. Add some using the button above.
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
                {ticket.assignedTo && ticket.assignedTo.map((assignee, index) => {
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
                      {isEditing && (
                        <button
                          type="button"
                          className="ml-2 text-blue-500 hover:text-blue-700"
                          onClick={() => handleRemoveAssignee(assigneeName)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
                {isEditing && (
                  <button
                    type="button"
                    className="text-blue-600 font-medium hover:text-blue-800 ml-auto" // Pushed to the right
                    onClick={() => setShowAssignPopup(true)}
                  >
                    + Add more
                  </button>
                )}
              </div>
            </div>
            {/* End of Modified Assignee Section */}

            {/* Action Buttons Section */}
            <div className="flex gap-4 mt-6">
              {/* Show different buttons based on ticket status */}
              {ticket.status === "OPEN" ? (
                <>
                  {/* Close Ticket Button */}
                  <button
                    type="button"
                    className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition text-lg"
                    onClick={handleCompleteTicket}
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : "Close Ticket"}
                  </button>

                  {/* Failed Ticket Button */}
                  <button
                    type="button"
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700 transition text-lg"
                    onClick={handleFailTicket}
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : "Failed Ticket"}
                  </button>

                  {/* Edit Ticket Button - Only show when not in edit mode */}
                  {!isEditing && (
                    <button
                      type="button"
                      className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded-lg shadow hover:bg-orange-700 transition text-lg"
                      onClick={() => {
                        setIsEditing(true);
                        addHistoryItem("Started editing", "Entered edit mode to modify ticket details");
                      }}
                    >
                      Edit Ticket
                    </button>
                  )}

                  {/* Update Button - Only show when in edit mode */}
                  {isEditing && (
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Updating..." : "Update Ticket"}
                    </button>
                  )}
                </>
              ) : ticket.status === "CLOSED" ? (
                <>
                  {/* Reopen Task Button for closed tickets */}
                  <button
                    type="button"
                    className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition text-lg"
                    onClick={handleReopenTicket}
                    disabled={isLoading}
                  >
                    {isLoading ? "Reopening..." : "Reopen Task"}
                  </button>
                </>
              ) : ticket.status === "FAILED" ? (
                <>
                  {/* Reopen Task Button for failed tickets (green color) */}
                  <button
                    type="button"
                    className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition text-lg"
                    onClick={handleReopenTicket}
                    disabled={isLoading}
                  >
                    {isLoading ? "Reopening..." : "Reopen Task"}
                  </button>

                  {/* Edit Ticket Button - Only show when not in edit mode */}
                  {!isEditing && (
                    <button
                      type="button"
                      className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded-lg shadow hover:bg-orange-700 transition text-lg"
                      onClick={() => {
                        setIsEditing(true);
                        addHistoryItem("Started editing", "Entered edit mode to modify ticket details");
                      }}
                    >
                      Edit Ticket
                    </button>
                  )}

                  {/* Update Button - Only show when in edit mode */}
                  {isEditing && (
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Updating..." : "Update Ticket"}
                    </button>
                  )}
                </>
              ) : null}
            </div>
            
          </form>
          
          {/* Comments and History Section - Outside main form */}
          <div className="mt-6 border-t pt-4">
            <div className="flex space-x-2">
              <button
                type="button"
                className={`px-4 py-2 font-semibold rounded-lg shadow ${showComments ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                onClick={toggleComments}
              >
                ➕ Comments
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold rounded-lg shadow ${showHistory ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                onClick={toggleHistory}
              >
                � History
              </button>
            </div>
            
            {/* Comments Section */}
            {showComments && (
              <>
                <form onSubmit={handleCommentSubmit} className="mt-4">
                  <div className="bg-white border-2 border-green-200 rounded-lg p-3 shadow-sm">
                    <label className="block text-sm font-bold text-gray-700 mb-2">💬 ADD COMMENT</label>
                    <textarea
                      value={ticket.newComment}
                      onChange={(e) => handleChange("newComment", e.target.value)}
                      onBlur={() => handleBlur("newComment")}
                      placeholder="Type your comment here... (Press Enter for new line, Ctrl+Enter to submit)"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                      disabled={isSubmittingComment}
                      rows={3}
                      style={{ minHeight: '80px' }}
                      onKeyDown={(e) => {
                        // Submit on Ctrl+Enter
                        if (e.ctrlKey && e.key === 'Enter') {
                          e.preventDefault();
                          handleCommentSubmit(e);
                        }
                      }}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">Press <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Enter</kbd> to submit</span>
                      <button
                        type="submit"
                        disabled={!ticket.newComment.trim() || isSubmittingComment}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                          !ticket.newComment.trim() || isSubmittingComment
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-green-600 text-white hover:bg-green-700 hover:shadow-md"
                        }`}
                      >
                        {isSubmittingComment ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            <span>ADDING...</span>
                          </div>
                        ) : (
                          "➤ ADD COMMENT"
                        )}
                      </button>
                    </div>
                  </div>
                </form>
                
                {/* Comments Display - Modern Chat Style */}
                <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {isLoadingComments ? (
                    <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-200">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2 font-bold">LOADING COMMENTS...</p>
                    </div>
                  ) : ticket.comments && ticket.comments.length > 0 ? (
                    <>
                      <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                        💬 {ticket.comments.length} {ticket.comments.length === 1 ? 'Comment' : 'Comments'}
                      </div>
                      {ticket.comments.map((comment, idx) => (
                        <div key={comment.id || idx} className="bg-gradient-to-r from-white to-green-50 border-2 border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                          {/* Comment Header */}
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-green-200">
                            <div className="flex items-center gap-2">
                              {/* User Avatar */}
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                {(comment.user || 'U').charAt(0).toUpperCase()}
                              </div>
                              {/* User Name */}
                              <span className="font-bold text-gray-800 text-sm">
                                {(comment.user || 'UNKNOWN USER').toUpperCase()}
                              </span>
                              {/* Comment Number Badge */}
                              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                #{idx + 1}
                              </span>
                            </div>
                            {/* Timestamp */}
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                              </svg>
                              <span className="font-semibold">{comment.time}</span>
                            </div>
                          </div>
                          
                          {/* Comment Content */}
                          <div className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                            {comment.text}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-green-50 rounded-lg border-2 border-dashed border-green-300">
                      <div className="text-5xl mb-3">💬</div>
                      <p className="text-gray-600 font-bold text-lg">NO COMMENTS YET</p>
                      <p className="text-sm text-gray-500 mt-1">Be the first to share your thoughts!</p>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* History Section - Modern Table Design */}
            {showHistory && (
              <div className="mt-4">
                {isLoadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-500 mt-3 font-medium">Loading activity history...</p>
                  </div>
                ) : historyItems && historyItems.length > 0 ? (
                  <>
                    {/* Filter Section */}
                    <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">📊 FILTER:</span>
                        <select
                          value={activityFilter}
                          onChange={(e) => setActivityFilter(e.target.value)}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer"
                        >
                          <option value="all">ALL ACTIVITIES ({historyItems.length})</option>
                          <option value="created">📝 CREATED ({historyItems.filter(item => item.action && item.action.toUpperCase().includes('CREATED')).length})</option>
                          <option value="status">🔄 STATUS ({historyItems.filter(item => item.action && item.action.toUpperCase().includes('STATUS')).length})</option>
                          <option value="comment">💬 COMMENTS ({historyItems.filter(item => item.action && item.action.toUpperCase().includes('COMMENT')).length})</option>
                          <option value="assignment">👤 ASSIGNMENTS ({historyItems.filter(item => item.action && (item.action.toUpperCase().includes('ASSIGN') || item.action.toUpperCase().includes('UPDATED TICKET'))).length})</option>
                          <option value="updated">✏️ UPDATES ({historyItems.filter(item => item.action && item.action.toUpperCase().includes('UPDATE')).length})</option>
                        </select>
                      </div>
                      <div className="text-sm font-bold text-gray-600">
                        SHOWING: <span className="text-blue-600">{(() => {
                          const filtered = historyItems.filter(item => {
                            if (activityFilter === 'all') return true;
                            const action = (item.action || '').toUpperCase();
                            if (activityFilter === 'created') return action.includes('CREATED');
                            if (activityFilter === 'status') return action.includes('STATUS');
                            if (activityFilter === 'comment') return action.includes('COMMENT');
                            if (activityFilter === 'assignment') return action.includes('ASSIGN') || action.includes('UPDATED TICKET');
                            if (activityFilter === 'updated') return action.includes('UPDATE');
                            return false;
                          });
                          return filtered.length;
                        })()}</span> OF <span className="text-blue-600">{historyItems.length}</span>
                      </div>
                    </div>

                    {/* Modern Table */}
                    <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm overflow-hidden">
                      <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                          {/* Table Header - Sticky */}
                          <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">#</th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">TYPE</th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">DETAILS</th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">USER</th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">DATE & TIME</th>
                            </tr>
                          </thead>
                          
                          {/* Table Body */}
                          <tbody className="divide-y divide-gray-200">
                            {(() => {
                              const filtered = historyItems.filter(item => {
                                if (activityFilter === 'all') return true;
                                const action = (item.action || '').toUpperCase();
                                if (activityFilter === 'created') return action.includes('CREATED');
                                if (activityFilter === 'status') return action.includes('STATUS');
                                if (activityFilter === 'comment') return action.includes('COMMENT');
                                if (activityFilter === 'assignment') return action.includes('ASSIGN') || action.includes('UPDATED TICKET');
                                if (activityFilter === 'updated') return action.includes('UPDATE');
                                return false;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan="5" className="px-4 py-12 text-center">
                                      <div className="text-4xl mb-3">🔍</div>
                                      <p className="text-gray-500 font-bold">NO ACTIVITIES FOUND</p>
                                      <p className="text-sm text-gray-400 mt-1">Try selecting a different filter</p>
                                    </td>
                                  </tr>
                                );
                              }

                              return filtered.map((item, index) => {
                                // Format date and time
                                let formattedDate = "UNKNOWN DATE";
                                let formattedTime = "UNKNOWN TIME";
                                if (item.time) {
                                  try {
                                    const date = new Date(item.time);
                                    formattedDate = date.toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    }).toUpperCase();
                                    formattedTime = date.toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    }).toUpperCase();
                                  } catch (e) {
                                    console.error("Date formatting error:", e);
                                  }
                                }

                                const action = (item.action || '').toUpperCase();
                                const details = (item.details || '').toUpperCase();
                                
                                // Determine activity type and styling
                                let activityIcon = '📌';
                                let activityLabel = 'ACTIVITY';
                                let badgeColor = 'bg-gray-100 text-gray-800';
                                let rowBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-white';

                                if (action.includes('CREATED')) {
                                  activityIcon = '📝';
                                  activityLabel = 'CREATED';
                                  badgeColor = 'bg-blue-100 text-blue-800';
                                } else if (action.includes('STATUS')) {
                                  activityIcon = '🔄';
                                  activityLabel = 'STATUS';
                                  badgeColor = 'bg-green-100 text-green-800';
                                } else if (action.includes('COMMENT')) {
                                  activityIcon = '💬';
                                  activityLabel = 'COMMENT';
                                  badgeColor = 'bg-purple-100 text-purple-800';
                                } else if (action.includes('ASSIGN') || action.includes('UPDATED TICKET')) {
                                  activityIcon = '👤';
                                  activityLabel = 'ASSIGNMENT';
                                  badgeColor = 'bg-orange-100 text-orange-800';
                                } else if (action.includes('UPDATE')) {
                                  activityIcon = '✏️';
                                  activityLabel = 'UPDATED';
                                  badgeColor = 'bg-yellow-100 text-yellow-800';
                                }

                                return (
                                  <tr key={item.id || index} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                                    {/* Serial Number */}
                                    <td className="px-4 py-3 text-sm font-bold text-gray-700 border-r border-gray-200">
                                      {index + 1}
                                    </td>
                                    
                                    {/* Activity Type Badge */}
                                    <td className="px-4 py-3 border-r border-gray-200">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                                        {activityIcon} {activityLabel}
                                      </span>
                                    </td>
                                    
                                    {/* Details */}
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 border-r border-gray-200">
                                      {details || action}
                                    </td>
                                    
                                    {/* User */}
                                    <td className="px-4 py-3 text-sm font-bold text-gray-700 border-r border-gray-200">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                                          {(item.user || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        {(item.user || 'UNKNOWN').toUpperCase()}
                                      </div>
                                    </td>
                                    
                                    {/* Date & Time */}
                                    <td className="px-4 py-3 text-sm">
                                      <div className="font-bold text-gray-700">{formattedDate}</div>
                                      <div className="font-semibold text-gray-500 text-xs">{formattedTime}</div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="text-gray-600 font-bold text-lg">NO ACTIVITY HISTORY</p>
                    <p className="text-sm text-gray-400 mt-2">Activity will appear here as actions are performed</p>
                  </div>
                )}
              </div>
            )}
          </div>
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