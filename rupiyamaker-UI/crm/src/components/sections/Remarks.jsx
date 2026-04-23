import React, { useState, useEffect, useRef } from 'react';
import { formatDateTimeIST } from '../../utils/timezoneUtils';

const API_BASE_URL = '/api';

function getRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return formatDateTimeIST(dateStr);
    } catch {
        return '';
    }
}

function getAvatarColor(name) {
    const colors = [
        'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500',
        'bg-orange-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

export default function Remarks({ leadId, userId, formatDate, canEdit = true, isLoginLead = false }) {
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [isAddingNote, setIsAddingNote] = useState(false);
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => { loadNotes(); }, [leadId]);

    useEffect(() => {
        if (notes.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [notes]);

    const notesBaseUrl = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadId}/notes`
        : `${API_BASE_URL}/leads/${leadId}/notes`;

    const loadNotes = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${notesBaseUrl}?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setNotes(data || []);
            }
        } catch (error) {
            console.error('Error loading notes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addNote = async () => {
        if (!newNote.trim() || isAddingNote) return;
        try {
            setIsAddingNote(true);
            const response = await fetch(`${notesBaseUrl}?user_id=${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: leadId,
                    content: newNote.trim().toUpperCase(),
                    note_type: 'general',
                    created_by: userId
                })
            });
            if (response.ok) {
                setNewNote('');
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                }
                loadNotes();
            }
        } catch (error) {
            console.error('Error adding note:', error);
        } finally {
            setIsAddingNote(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addNote();
        }
    };

    const deleteNote = async (noteId) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        try {
            const response = await fetch(`${notesBaseUrl}/${noteId}?user_id=${userId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setNotes(prev => prev.filter(note => note._id !== noteId));
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Notes List - scrollable, fills available space */}
            <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1.5 min-h-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-16">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#03B0F5]"></div>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                        <svg className="w-6 h-6 mx-auto mb-1 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-xs">No notes yet</p>
                    </div>
                ) : (
                    notes.map((note, index) => {
                        const name = note.creator_name || 'Unknown';
                        const initials = getInitials(name);
                        const avatarColor = getAvatarColor(name);
                        const isLatest = index === notes.length - 1;
                        return (
                            <div key={note._id} className="flex items-start gap-1.5 group">
                                {/* Avatar */}
                                <div className={`w-5 h-5 rounded-full ${avatarColor} text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5`}>
                                    {initials}
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                        <span className="text-[10px] font-bold text-gray-800 truncate">{name}</span>
                                        <span className="text-[9px] text-gray-400 whitespace-nowrap ml-auto">{getRelativeTime(note.created_at)}</span>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-[10px] leading-snug break-words ${isLatest ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                        {note.content}
                                    </div>
                                    {note.can_delete && canEdit && (
                                        <button
                                            onClick={() => deleteNote(note._id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-[9px] mt-0.5 transition-opacity pl-1"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area - BOTTOM, compact */}
            {canEdit && (
                <div className="flex-shrink-0 border-t border-gray-100 bg-white px-2 py-2">
                    <div className="flex items-end gap-1.5 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 focus-within:border-[#03B0F5] focus-within:ring-1 focus-within:ring-[#03B0F5]/30 transition-all px-2 py-1.5">
                        <textarea
                            ref={textareaRef}
                            value={newNote}
                            onChange={e => {
                                setNewNote(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Write a note..."
                            className="flex-1 text-xs text-gray-700 placeholder-gray-400 bg-transparent resize-none outline-none border-0 leading-relaxed"
                            rows={1}
                            style={{ minHeight: '32px', maxHeight: '80px' }}
                        />
                        <button
                            onClick={addNote}
                            disabled={!newNote.trim() || isAddingNote}
                            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-[#03B0F5] disabled:bg-gray-200 disabled:text-gray-400 text-white transition-colors hover:bg-[#0097d1] mb-0.5"
                        >
                            {isAddingNote ? (
                                <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
