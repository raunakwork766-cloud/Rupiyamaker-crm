import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { interviewsAPI } from '../services/api';
import { toast } from 'react-toastify';

const InterviewComments = ({ interviewId, isOpen, onClose, inline = false }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Function to emit events for parent components
  const emitCommentEvent = (eventType, data = {}) => {
    if (!window.customEvents) {
      window.customEvents = new EventTarget();
    }
    window.customEvents.dispatchEvent(new CustomEvent(eventType, {
      detail: { interviewId, ...data }
    }));
  };

  // Load comments when component mounts or interview changes
  useEffect(() => {
    if (interviewId && isOpen) {
      loadComments();
    }
  }, [interviewId, isOpen]);

  // Set up global event system for real-time updates
  useEffect(() => {
    if (!window.customEvents) {
      window.customEvents = new EventTarget();
    }

    const handleStatusChange = () => {
      // Reload comments when status changes (might affect permissions)
      if (interviewId && isOpen) {
        loadComments();
      }
    };

    const handleInterviewUpdate = () => {
      // Reload comments when interview is updated
      if (interviewId && isOpen) {
        loadComments();
      }
    };

    window.customEvents.addEventListener('interviewStatusChanged', handleStatusChange);
    window.customEvents.addEventListener('interviewUpdated', handleInterviewUpdate);

    return () => {
      if (window.customEvents) {
        window.customEvents.removeEventListener('interviewStatusChanged', handleStatusChange);
        window.customEvents.removeEventListener('interviewUpdated', handleInterviewUpdate);
      }
    };
  }, [interviewId, isOpen]);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      setError('');
      console.log('Loading comments for interview:', interviewId);
      
      const response = await interviewsAPI.getComments(interviewId);
      console.log('Comments response:', response);
      
      // Handle both direct array and wrapped response
      const commentsData = Array.isArray(response) ? response : 
                          (response.comments ? response.comments : 
                           response.data ? response.data : []);
                           
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      setError('Failed to load comments: ' + error.message);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setSubmitting(true);
    try {
      setError('');
      
      const response = await interviewsAPI.addComment(interviewId, newComment.trim());
      console.log('Add comment response:', response);
      
      // Create the comment object based on response
      const commentData = response.data || response;
      const newCommentObj = {
        id: commentData.id || commentData._id || Date.now().toString(),
        _id: commentData.id || commentData._id || Date.now().toString(),
        content: newComment.trim(),
        comment: newComment.trim(), // Keep both for compatibility
        created_by: commentData.created_by || 'Current User',
        created_by_name: commentData.created_by_name || 'Current User',
        created_at: commentData.created_at || new Date().toISOString(),
        updated_at: commentData.updated_at || new Date().toISOString(),
        ...commentData
      };
      
      // Add to local state immediately (optimistic update)
      setComments(prev => [newCommentObj, ...prev]);
      setNewComment('');
      
      // Emit event to notify other components (especially history)
      emitCommentEvent('commentAdded', { comment: newCommentObj });
      
      // Try to add a history entry for this comment
      try {
        await interviewsAPI.addHistoryEntry(interviewId, {
          action_type: 'comment_added',
          action: 'Comment Added',
          description: `Added a new comment: "${newComment.trim().substring(0, 50)}${newComment.trim().length > 50 ? '...' : ''}"`,
          details: {
            comment_id: newCommentObj.id,
            comment_preview: newComment.trim().substring(0, 100),
            comment_length: newComment.trim().length
          }
        });
      } catch (historyError) {
        console.warn('Failed to add history entry for comment:', historyError);
        // Don't fail the whole operation if history fails
      }
      
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment: ' + error.message);
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return 'Unknown time';
    
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (!isOpen) return null;

  // Inline mode - render without modal wrapper
  if (inline) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-800">Interview Comments</h3>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Add Comment Form */}
        <div className="border-b pb-4 mb-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="newComment" className="block text-sm font-medium text-gray-700 mb-1">
                Add a comment
              </label>
              <textarea
                id="newComment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!submitting && newComment.trim() && newComment.length <= 1000) {
                      handleAddComment();
                    }
                  }
                }}
                className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
                rows={2}
                placeholder="Write your comment here..."
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {newComment.length}/1000 characters
              </p>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={submitting || !newComment.trim() || newComment.length > 1000}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Add Comment
              </button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="max-h-96 overflow-y-auto mb-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No comments yet</p>
              <p className="text-gray-400 text-sm">Be the first to add a comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 p-3 rounded-lg shadow-sm">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span className="font-bold">{comment.created_by_name || 'Unknown User'}</span>
                  <span>{formatDateTime(comment.created_at)}</span>
                </div>
                <div className="text-gray-800">{comment.content}</div>
                {comment.updated_at && comment.updated_at !== comment.created_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Edited: {formatDateTime(comment.updated_at)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Modal mode - original implementation
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            
            
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Add Comment Form */}
        <div className="border-b mx-6 pb-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="newCommentModal" className="block text-sm font-medium text-gray-700 mb-2">
                Add a comment
              </label>
              <textarea
                id="newCommentModal"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!submitting && newComment.trim() && newComment.length <= 1000) {
                      handleAddComment();
                    }
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                
                placeholder="Write your comment here..."
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {newComment.length}/1000 characters
              </p>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={submitting || !newComment.trim() || newComment.length > 1000}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">No comments yet</p>
              <p className="text-gray-400">Be the first to add a comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 p-3 rounded-lg shadow-sm">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span className="font-bold">{comment.created_by_name || 'Unknown User'}</span>
                  <span>{formatDateTime(comment.created_at)}</span>
                </div>
                <div className="text-gray-800">{comment.content}</div>
                {comment.updated_at && comment.updated_at !== comment.created_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Edited: {formatDateTime(comment.updated_at)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Comment Form */}
        <div className="border-t p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="newComment" className="block text-sm font-medium text-gray-700 mb-2">
                Add a comment
              </label>
              <textarea
                id="newComment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!submitting && newComment.trim() && newComment.length <= 1000) {
                      handleAddComment();
                    }
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                rows={3}
                placeholder="Write your comment here..."
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {newComment.length}/1000 characters
              </p>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={submitting || !newComment.trim() || newComment.length > 1000}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewComments;
