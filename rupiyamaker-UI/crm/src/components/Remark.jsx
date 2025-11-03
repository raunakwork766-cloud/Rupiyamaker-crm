import React, { useState, useEffect } from "react";
import { Send, User, RefreshCcw, AlertCircle } from "lucide-react";

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

export default function CommentSection({ leadData }) {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState({
    name: "",
    id: "",
    avatar: null,
  });
  
  // Get current user information when component mounts
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const firstName = localStorage.getItem('firstName') || '';
    const lastName = localStorage.getItem('lastName') || '';
    const fullName = `${firstName} ${lastName}`.trim() || "User";
    
    setCurrentUser({
      name: fullName,
      id: userId,
      avatar: null,
    });
  }, []);

  // Load comments/notes from API when component mounts or leadData changes
  useEffect(() => {
    if (leadData?._id) {
      fetchNotes();
    }
  }, [leadData]);

  // Function to fetch notes from the API
  const fetchNotes = async () => {
    if (!leadData?._id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID available');
      }
      
      const apiUrl = `${API_BASE_URL}/leads/${leadData._id}/notes?user_id=${userId}`;
      
      const response = await fetch(apiUrl, {
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
      setComments(data || []);
      
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to load remarks');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async () => {
    if (!comment.trim() || !leadData?._id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID available');
      }
      
      // Use the dedicated notes API endpoint
      const apiUrl = `${API_BASE_URL}/leads/${leadData._id}/notes?user_id=${userId}`;
      
      const noteData = {
        lead_id: leadData._id,
        content: comment,
        note_type: "remark",
        created_by: userId
      };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setComment("");
      
      // Refresh notes list after adding a new one
      await fetchNotes();
      
    } catch (error) {
      console.error('Error adding remark:', error);
      setError('Failed to add remark');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time) =>
    new Intl.DateTimeFormat("default", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(time));

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Remarks</h3>
        <button 
          onClick={fetchNotes} 
          className="text-blue-500 hover:text-blue-700 flex items-center text-sm"
          disabled={isLoading}
        >
          <RefreshCcw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Top Input Bar */}
      <div className="flex items-center border border-gray-300 rounded-full px-3 py-2 bg-white shadow-sm">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 p-[2px] mr-3">
          <div className="bg-white w-full h-full rounded-full flex items-center justify-center">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt="avatar"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <User className="text-black w-5 h-5" />
            )}
          </div>
        </div>

        {/* Input Field */}
        <input
          type="text"
          placeholder={`Write a remark as ${currentUser.name}...`}
          className="flex-1 outline-none border-none text-sm text-gray-700 placeholder:text-gray-400 bg-transparent"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
          disabled={isLoading}
        />

        {/* Send Button */}
        <button 
          onClick={handlePost} 
          disabled={isLoading || !comment.trim()}
          className={`${!comment.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Send className={`w-5 h-5 ${isLoading ? 'text-gray-400' : 'text-blue-500 hover:text-blue-600'}`} />
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && comments.length === 0 && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && comments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-2 opacity-25" />
          <p>No remarks yet. Be the first to add one!</p>
        </div>
      )}

      {/* Comments Feed */}
      <div className="space-y-3">
        {comments.map((note) => (
          <div key={note._id} className="flex items-start gap-3">
            {/* Avatar & Name Column */}
            <div className="flex flex-col items-center min-w-[50px]">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 p-[2px]">
                <div className="bg-white w-full h-full rounded-full flex items-center justify-center">
                  <User className="text-black w-4 h-4" />
                </div>
              </div>
              <span className="text-xs mt-1 text-gray-700 font-medium">
                {note.creator_name || "User"}
              </span>
            </div>

            {/* Comment Box */}
            <div className="bg-gray-100 rounded-lg p-3 shadow-sm flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">{formatTime(note.created_at)}</span>
                {note.can_edit && (
                  <div className="flex space-x-1">
                    {/* We can add edit/delete functionality here in the future */}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-800">{note.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
