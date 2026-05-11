import React, { useState, useEffect, useRef } from "react";
import { Send, AlertCircle, MessageCircle } from "lucide-react";

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

export default function CommentSection({ leadData, canEdit = true }) {
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
    // Use 'userName' which is stored during login (first_name + last_name)
    const userName = localStorage.getItem('userName') || '';
    const fullName = userName.trim() || "User";

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
    if (!comment.trim() || !leadData?._id || !canEdit) return;

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
    if (!name || name === 'User') return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isCurrentUser = (note) => note.created_by === currentUser.id;

  // Deterministic color for other users' avatars
  const otherAvatarColors = [
    'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  const getAvatarColor = (name) => {
    if (!name) return 'bg-gray-400';
    const idx = name.charCodeAt(0) % otherAvatarColors.length;
    return otherAvatarColors[idx];
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #f0f7ff 0%, #e8f0fe 100%)' }}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-[#03B0F5] border-t-transparent animate-spin" />
            <span className="text-xs text-gray-400">Loading remarks...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center mb-3 shadow-inner">
              <MessageCircle className="w-7 h-7 text-[#03B0F5] opacity-60" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No remarks yet</p>
            <p className="text-xs mt-1 text-gray-400">Be the first to add a remark</p>
          </div>
        )}

        {/* Chat Messages */}
        {comments.map((note) => {
          const isMine = isCurrentUser(note);
          const initials = getInitials(note.creator_name);
          const avatarBg = isMine ? 'bg-[#03B0F5]' : getAvatarColor(note.creator_name);
          return (
            <div key={note._id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${avatarBg}`}>
                {initials}
              </div>
              {/* Bubble */}
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && (
                  <span className="text-[10px] text-gray-500 font-semibold px-1">{note.creator_name || 'User'}</span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  isMine
                    ? 'bg-[#03B0F5] text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow'
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
      {canEdit ? (
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2.5 shadow-[0_-2px_8px_rgba(3,176,245,0.07)]">
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-[#03B0F5] flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mb-0.5 shadow-sm" title={currentUser.name}>
              {getInitials(currentUser.name)}
            </div>
            <div className="flex-1 flex items-end bg-gray-50 border border-gray-200 rounded-2xl px-3 py-1.5 gap-2 focus-within:border-[#03B0F5] focus-within:bg-white transition-all">
              <textarea
                placeholder="Add a remark... (Enter to send)"
                className="flex-1 bg-transparent outline-none text-xs text-gray-800 placeholder:text-gray-400 resize-none overflow-auto leading-snug"
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
                style={{ minHeight: '18px', maxHeight: '80px' }}
              />
              <button
                onClick={handlePost}
                disabled={isLoading || !comment.trim()}
                className={`mb-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  comment.trim() && !isLoading
                    ? 'bg-[#03B0F5] text-white hover:bg-[#029fd9] shadow-sm hover:scale-110'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-3 py-2 text-center">
          <span className="text-xs text-gray-400">Remarks are read-only</span>
        </div>
      )}
    </div>
  );
}
