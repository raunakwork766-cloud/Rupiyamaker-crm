import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Trash2, Calendar, Edit3, Send } from 'lucide-react';
import { formatDateTimeIST } from '../../utils/timezoneUtils';

// Updated: 2025-12-10 - Fixed multi-line support
// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

// RemarksSection component for displaying and managing lead notes/remarks
export default function Remarks({ leadId, userId, formatDate, canEdit = true }) {
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newNote, setNewNote] = useState('');
    const [noteType, setNoteType] = useState('general');
    const [isAddingNote, setIsAddingNote] = useState(false);

    const textareaRef = useRef(null);

    // Note types based on leads.html
    const noteTypes = [
        { value: 'general', label: 'General Note' },
        { value: 'call', label: 'Call Log' },
        { value: 'meeting', label: 'Meeting Note' },
        { value: 'followup', label: 'Follow-up' }
    ];

    useEffect(() => {
        loadNotes();
    }, [leadId]);

    // Initialize textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '60px';
        }
    }, []);

    const loadNotes = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/notes?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setNotes(data || []);
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            setError('Failed to load notes');
        } finally {
            setIsLoading(false);
        }
    };

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
        }
    };

    const handleNoteChange = (e) => {
        setNewNote(e.target.value);
        adjustTextareaHeight();
    };

    const handleKeyDown = (e) => {
        // Allow Shift+Enter for new line, prevent plain Enter
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            return;
        }
        
        // After Shift+Enter, adjust height
        if (e.key === 'Enter' && e.shiftKey) {
            setTimeout(adjustTextareaHeight, 0);
        }
    };

    const addNote = async () => {
        if (!newNote.trim()) return;

        try {
            setIsAddingNote(true);
            setError('');

            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/notes?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lead_id: leadId,
                    content: newNote.toUpperCase(),
                    note_type: noteType,
                    created_by: userId
                })
            });

            if (response.ok) {
                loadNotes(); // Reload notes after adding a new one
                setNewNote('');
                setNoteType('general');
                setSuccess('Note added successfully');
                setTimeout(() => setSuccess(''), 3000);
                if (textareaRef.current) {
                    textareaRef.current.style.height = "60px";
                }
            } else {
                throw new Error('Failed to add note');
            }
        } catch (error) {
            console.error('Error adding note:', error);
            setError('Failed to add note');
        } finally {
            setIsAddingNote(false);
        }
    };

    const deleteNote = async (noteId) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/notes/${noteId}?user_id=${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setNotes(prev => prev.filter(note => note._id !== noteId));
                setSuccess('Note deleted successfully');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                throw new Error('Failed to delete note');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            setError('Failed to delete note');
        }
    };

    // Get badge color based on note type
    const getNoteTypeBadgeColor = (type) => {
        switch (type) {
            case 'call':
                return 'bg-blue-600';
            case 'meeting':
                return 'bg-cyan-600';
            case 'followup':
                return 'bg-yellow-600';
            default:
                return 'bg-gray-600';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Add New Note */}
            <div className="bg-white p-4 rounded-lg border border-gray-700">
                <div className="mb-3 flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-600">Note Type:</label>
                    <select
                        value={noteType}
                        onChange={(e) => setNoteType(e.target.value)}
                        className="text-black bg-white border border-gray-600 rounded px-2 py-1 text-sm"
                    >
                        {noteTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </select>
                </div>

                {/* Note Content */}
                <div className="flex space-x-3">
                    <textarea
                        ref={textareaRef}
                        value={newNote}
                        onChange={canEdit ? handleNoteChange : undefined}
                        onKeyDown={canEdit ? handleKeyDown : undefined}
                        disabled={!canEdit}
                        placeholder="Enter note content... (Press Shift+Enter for new line, click Send to submit)"
                        className="flex-1 bg-white border border-gray-600 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none text-base"
                        rows={1}
                        style={{ minHeight: '60px', maxHeight: '300px', lineHeight: '1.5', overflow: 'auto' }}
                    />
                    <button
                        onClick={addNote}
                        disabled={!newNote.trim() || isAddingNote}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center"
                    >
                        <Send />
                    </button>
                </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
                {notes.length === 0 ? (
                    <div className="text-center py-8 bg-white text-gray-400">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No notes yet. Add your first note above.</p>
                    </div>
                ) : (
                    notes.map((note) => (
                        <div key={note._id} className="bg-white p-4 rounded-lg border border-gray-700">
                            <div className="flex justify-between items-start ">
                                <div className="flex items-center space-x-3">
                                    {/* Note Type Badge */}
                                    <span className={`px-2 py-1 rounded-full text-md font-medium text-black ${getNoteTypeBadgeColor(note.note_type)}`}>
                                        {noteTypes.find(type => type.value === note.note_type)?.label || note.note_type}
                                    </span>

                                    {/* Creator Info */}
                                    <span className="text-blue-400 font-medium">
                                        {note.creator_name || 'Unknown User'}
                                    </span>

                                    {/* Created Date */}
                                    <span className="text-black text-md flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {formatDate ? formatDate(note.created_at) : formatDateTimeIST(note.created_at)}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex space-x-2">
                                    {note.can_delete && (
                                        <button
                                            onClick={() => deleteNote(note._id)}
                                            className="text-red-400 hover:text-red-300 p-1"
                                            title="Delete note"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Note Content */}
                            <p className="text-black whitespace-pre-wrap break-words leading-relaxed mt-3 uppercase text-base bg-gray-50 p-3 rounded border-l-4 border-blue-400">
                                {note.content}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
