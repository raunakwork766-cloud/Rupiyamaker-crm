import React, { useState, useEffect, useRef } from "react";
import { Send, User, AlertCircle } from "lucide-react";

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
  const messagesEndRef = useRef(null);
  
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

  // Scroll to bottom when comments load/update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

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
      
      // Determine if this is a login lead
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const apiUrl = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/notes?user_id=${userId}`
        : `${API_BASE_URL}/leads/${leadData._id}/notes?user_id=${userId}`;
      
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
      
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const apiUrl = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/notes?user_id=${userId}`
        : `${API_BASE_URL}/leads/${leadData._id}/notes?user_id=${userId}`;
      
      const noteData = {
        lead_id: leadData._id,
        content: comment,
        note_type: "remark",
        created_by: userId,
        creator_name: currentUser.name
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
      await fetchNotes();
      
    } catch (error) {
      console.error('Error adding remark:', error);
      setError('Failed to add remark');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date(time));

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isCurrentUser = (note) => note.created_by === currentUser.id;

  return (
    <div className="flex flex-col h-full bg-[#f0f4f8]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {/* Error display */}
        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && comments.length === 0 && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#03B0F5]"></div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-xs font-medium">No remarks yet</p>
            <p className="text-xs mt-0.5">Start the conversation...</p>
          </div>
        )}

        {/* Chat Messages */}
        {comments.map((note) => {
          const isMine = isCurrentUser(note);
          const initials = getInitials(note.creator_name);
          return (
            <div key={note._id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${isMine ? 'bg-[#03B0F5]' : 'bg-gray-500'}`}>
                {initials}
              </div>
              {/* Bubble */}
              <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMine && (
                  <span className="text-[10px] text-gray-500 font-medium px-1">{note.creator_name || 'User'}</span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-snug shadow-sm ${
                  isMine
                    ? 'bg-[#03B0F5] text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm'
                }`}>
                  {note.content}
                </div>
                <span className="text-[9px] text-gray-400 px-1">{formatTime(note.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - always at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2">
        <div className="flex items-end gap-2">
          <div className="w-7 h-7 rounded-full bg-[#03B0F5] flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mb-0.5">
            {getInitials(currentUser.name)}
          </div>
          <div className="flex-1 flex items-end bg-gray-100 rounded-2xl px-3 py-1.5 gap-2">
            <textarea
              placeholder="Add a remark..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 resize-none overflow-auto leading-snug"
              rows={1}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePost();
                }
              }}
              disabled={isLoading}
              style={{ minHeight: '20px', maxHeight: '80px' }}
            />
            <button
              onClick={handlePost}
              disabled={isLoading || !comment.trim()}
              className={`mb-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                comment.trim() && !isLoading
                  ? 'bg-[#03B0F5] text-white hover:bg-[#029fd9] shadow-sm'
                  : 'bg-gray-300 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

