import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { isSuperAdmin } from '../utils/permissions';
import {
  MSGR,
  formatDateLabel,
  getInitials,
  getAvatarColor,
  getBubbleRadius,
  scrollStyles,
  DatePill,
  RelativeTime,
} from './messengerChatStyles.jsx';

const API_BASE_URL = '/api';

const groupCommentsByDate = (comments) => {
  const groups = [];
  let currentDate = null;

  comments.forEach((note) => {
    const dateKey = new Date(note.created_at).toDateString();
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      groups.push({ type: 'date', label: formatDateLabel(note.created_at), key: `date-${dateKey}` });
    }
    groups.push({ type: 'message', note, key: note._id });
  });

  return groups;
};

export default function CommentSection({ leadData, canEdit = true, refreshToken = 0 }) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState({ name: '', id: '' });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [actionNoteId, setActionNoteId] = useState(null);
  const [isUserSuperAdmin, setIsUserSuperAdmin] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  const getNotesApiBase = useCallback(() => {
    const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
    return isLoginLead
      ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/notes`
      : `${API_BASE_URL}/leads/${leadData._id}/notes`;
  }, [leadData]);

  useEffect(() => {
    const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
    const userName = localStorage.getItem('userName') || '';
    setCurrentUser({
      name: userName.trim() || 'User',
      id: userId,
    });

    let superAdmin = false;
    try {
      const perms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
      superAdmin = isSuperAdmin(perms);
      if (!superAdmin) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        superAdmin = user.role?.name?.toLowerCase() === 'super admin';
      }
    } catch (_) {
      superAdmin = false;
    }
    setIsUserSuperAdmin(superAdmin);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    if (leadData?._id) fetchNotes();
  }, [leadData, refreshToken]);

  const groupedItems = useMemo(() => groupCommentsByDate(comments), [comments]);

  const fetchNotes = async () => {
    if (!leadData?._id) return;

    setIsLoading(true);
    setError(null);

    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (!userId) throw new Error('No user ID available');

      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const apiUrl = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadData._id}/notes?user_id=${userId}&limit=100`
        : `${API_BASE_URL}/leads/${leadData._id}/notes?user_id=${userId}&limit=100`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setComments((data || []).filter((note) => note.note_type !== 'status_change_remark'));
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async () => {
    if (!comment.trim() || !leadData?._id || !canEdit) return;

    setIsLoading(true);
    setError(null);

    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (!userId) throw new Error('No user ID available');

      const apiUrl = `${getNotesApiBase()}?user_id=${userId}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          lead_id: leadData._id,
          content: comment.trim(),
          note_type: 'remark',
          created_by: userId,
          creator_name: currentUser.name,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      setComment('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      await fetchNotes();
    } catch (err) {
      console.error('Error adding remark:', err);
      setError('Could not send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this remark?')) return;

    setActionNoteId(noteId);
    setError(null);

    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (!userId) throw new Error('No user ID available');

      const response = await fetch(`${getNotesApiBase()}/${noteId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setEditingContent('');
      }
      await fetchNotes();
    } catch (err) {
      console.error('Error deleting remark:', err);
      setError(err.message || 'Could not delete remark');
    } finally {
      setActionNoteId(null);
    }
  };

  const startEditingNote = (note) => {
    setEditingNoteId(note._id);
    setEditingContent(note.content || '');
    setTimeout(() => editTextareaRef.current?.focus(), 0);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (noteId) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;

    setActionNoteId(noteId);
    setError(null);

    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (!userId) throw new Error('No user ID available');

      const response = await fetch(`${getNotesApiBase()}/${noteId}?user_id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      setEditingNoteId(null);
      setEditingContent('');
      await fetchNotes();
    } catch (err) {
      console.error('Error updating remark:', err);
      setError(err.message || 'Could not update remark');
    } finally {
      setActionNoteId(null);
    }
  };

  const isCurrentUser = (note) => String(note.created_by) === String(currentUser.id);
  const canEditNote = (note) => isUserSuperAdmin || note.can_edit || isCurrentUser(note);
  const canDeleteNote = (note) => isUserSuperAdmin || note.can_delete || isCurrentUser(note);
  const canSend = comment.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: MSGR.chatBg }}>
      <style>{scrollStyles}</style>

      <div className="msgr-scroll flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {error && (
          <p className="text-center text-xs text-red-500 py-2">{error}</p>
        )}

        {isLoading && comments.length === 0 && (
          <p className="text-center text-sm py-12" style={{ color: MSGR.muted }}>Loading...</p>
        )}

        {!isLoading && comments.length === 0 && !error && (
          <p className="text-center text-sm py-12 px-6" style={{ color: MSGR.muted }}>
            No messages yet. Say hi 👋
          </p>
        )}

        <div>
          {groupedItems.map((item, index) => {
            if (item.type === 'date') {
              return <DatePill key={item.key} label={item.label} />;
            }

            const note = item.note;
            const isMine = isCurrentUser(note);
            const prevItem = groupedItems[index - 1];
            const nextItem = groupedItems[index + 1];
            const prevNote = prevItem?.type === 'message' ? prevItem.note : null;
            const nextNote = nextItem?.type === 'message' ? nextItem.note : null;

            const sameSenderAsPrev =
              prevNote && prevNote.created_by === note.created_by && prevItem?.type === 'message';
            const sameSenderAsNext =
              nextNote && nextNote.created_by === note.created_by && nextItem?.type === 'message';

            const showAvatar = !isMine && !sameSenderAsPrev;
            const senderName = note.creator_name || 'User';
            const radius = getBubbleRadius(isMine, sameSenderAsPrev, sameSenderAsNext);

            return (
              <div
                key={item.key}
                className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${sameSenderAsPrev ? 'mt-[2px]' : 'mt-3'}`}
              >
                <div className="w-7 flex-shrink-0 self-end">
                  {showAvatar ? (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                      style={{ backgroundColor: getAvatarColor(senderName) }}
                    >
                      {getInitials(senderName)}
                    </div>
                  ) : (
                    <div className="w-7 h-7" />
                  )}
                </div>

                <div className={`max-w-[78%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {!isMine && showAvatar && (
                    <span className="text-[11px] font-medium mb-[2px] px-1" style={{ color: MSGR.muted }}>
                      {senderName}
                    </span>
                  )}

                  {editingNoteId === note._id ? (
                    <div
                      className={`w-full px-3 py-2 rounded-2xl border ${radius}`}
                      style={{ backgroundColor: MSGR.inputBg, borderColor: MSGR.border }}
                    >
                      <textarea
                        ref={editTextareaRef}
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full bg-transparent outline-none text-[15px] resize-none leading-snug min-h-[56px] max-h-32"
                        style={{ color: MSGR.text }}
                        rows={2}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={cancelEditingNote}
                          className="p-1.5 rounded-full hover:bg-black/5"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" style={{ color: MSGR.muted }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(note._id)}
                          disabled={!editingContent.trim() || actionNoteId === note._id}
                          className="p-1.5 rounded-full disabled:opacity-50"
                          style={{ backgroundColor: MSGR.blue, color: '#fff' }}
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`px-3 py-2 ${radius}`}
                        style={{
                          backgroundColor: isMine ? MSGR.blue : MSGR.received,
                          color: isMine ? '#fff' : MSGR.text,
                        }}
                      >
                        <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">{note.content}</p>
                      </div>
                      <div className={`flex items-center gap-2 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        <RelativeTime
                          time={note.created_at}
                          className="text-[9px] leading-none"
                          style={{ color: MSGR.muted }}
                        />
                        {(canEditNote(note) || canDeleteNote(note)) && (
                          <div className="flex items-center gap-1">
                            {canEditNote(note) && (
                              <button
                                type="button"
                                onClick={() => startEditingNote(note)}
                                disabled={actionNoteId === note._id}
                                className="p-1 rounded hover:bg-black/5 disabled:opacity-50"
                                style={{ color: MSGR.muted }}
                                title="Edit remark"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {canDeleteNote(note) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note._id)}
                                disabled={actionNoteId === note._id}
                                className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-50"
                                title="Delete remark"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {canEdit ? (
        <div className="flex-shrink-0 px-3 py-2.5 border-t" style={{ borderColor: MSGR.border, backgroundColor: MSGR.bg }}>
          <div className="flex items-end gap-2">
            <div
              className="flex-1 flex items-end rounded-[20px] px-4 py-2 min-h-[40px] border border-transparent focus-within:border-[#0084ff]/30 transition-colors"
              style={{ backgroundColor: MSGR.inputBg }}
            >
              <textarea
                ref={textareaRef}
                placeholder="Write a remark..."
                className="flex-1 bg-transparent outline-none text-[15px] resize-none overflow-auto leading-snug max-h-28 placeholder:text-[#65676b]"
                style={{ color: MSGR.text }}
                rows={2}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                }}
                disabled={isLoading}
              />
            </div>
            <button
              type="button"
              onClick={handlePost}
              disabled={!canSend}
              className="h-9 px-4 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: MSGR.blue, color: '#fff' }}
              title="Post remark"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Post'
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 py-3 border-t text-center text-sm" style={{ borderColor: MSGR.border, color: MSGR.muted }}>
          Read only
        </div>
      )}
    </div>
  );
}
