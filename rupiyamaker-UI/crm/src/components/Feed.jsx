import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ThumbsUp, MessageCircle, User, AlertCircle, Loader, Image, FileText, X, ChevronLeft, ChevronRight, MoreHorizontal, CornerDownRight } from "lucide-react";
import { hasPermission, canEditPost, canDeletePost, canDeleteComment, getUserPermissions, getUserId } from '../utils/permissions';
import { API_BASE_URL, buildApiUrl, buildMediaUrl } from '../config/api';
import { formatDateTime } from '../utils/dateUtils';

// Helper function to format date and time in IST timezone
function formatDate(dateString, isLocalTime = false) {
  return formatDateTime(dateString);
}
// Recursive flatten for comments and replies (all levels)
function flattenComments(comments, parentAuthor = null, level = 0) {
  const result = [];
  if (!comments || !Array.isArray(comments)) {
    return result;
  }
  comments.forEach(comment => {
    if (!comment) return;
    const replyTarget = comment.replyTo || parentAuthor;
    result.push({
      ...comment,
      isReply: level > 0,
      replyTo: replyTarget
    });
    if (comment.replies && comment.replies.length > 0) {
      result.push(...flattenComments(comment.replies, comment.author, level + 1));
    }
  });
  return result;
}

const CommentList = React.memo(function CommentList({
  comments,
  onLike,
  onShowReplyBox,
  onDeleteComment,
  replyBoxState,
  replyText,
  setReplyText,
  handleReply,
  userName,
  userId,
  feedId,
  setReplyBoxState,
  expandedComments,
  setExpandedComments,
  likingComments = new Set() // Add this prop
}) {

  // Sort comments to show newest first - memoize to prevent re-computation
  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || 0);
      const timeB = new Date(b.timestamp || b.created_at || 0);
      return timeB - timeA; // Newest first
    });
  }, [comments]);

  return (
    <div className="space-y-2">
      {sortedComments.map(comment => (
        <React.Fragment key={comment.id}>
          <div className="flex items-start space-x-2 sm:space-x-3 mt-2 sm:mt-3">
            <div className="w-6 sm:w-8 h-6 sm:h-8 bg-black rounded-full flex items-center justify-center">
              <User className="w-3 sm:w-4 h-3 sm:h-4 text-gray-300" />
            </div>
            <div className="flex-1">
              <div className="bg-white rounded-2xl px-2 sm:px-3 py-2 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-xs sm:text-sm text-black">
                    {comment.author}
                  </div>
                  <div className="text-xs text-black">{comment.timestamp}</div>
                </div>
                <div className="text-black mt-1 text-sm sm:text-base">{comment.text}</div>
                <div className="flex gap-2 sm:gap-4 mt-1 text-xs">
                  <button
                    key={`like-${comment.id}-${comment.liked}-${comment.likeCount}`}
                    onClick={() => onLike(comment.id, null)}
                    disabled={likingComments.has(comment.id)}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-300 font-medium disabled:opacity-50 text-xs sm:text-sm ${
                      comment.liked === true
                        ? "text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100" 
                        : "text-gray-600 bg-white border border-gray-200 hover:text-blue-500 hover:bg-blue-50"
                    } hover:scale-105`}
                  >
                    <ThumbsUp className={`w-3 sm:w-4 h-3 sm:h-4 transition-all duration-300 ${comment.liked === true ? 'fill-blue-600 scale-110' : 'fill-none'}`} />
                    <span className="font-semibold">{comment.likeCount || 0}</span>
                    <span className="hidden sm:inline">{comment.liked === true ? 'Liked' : 'Like'}</span>
                  </button>
                  <button
                    onClick={() => {
                      // If there are replies, expand them when clicking Reply
                      if (comment.replies && comment.replies.length > 0) {
                        const newExpanded = new Set(expandedComments);
                        newExpanded.add(comment.id);
                        setExpandedComments(newExpanded);
                      }
                      onShowReplyBox(feedId, comment.id, comment.author);
                    }}
                    className="flex items-center gap-1 text-blue-500 text-xs sm:text-sm"
                  >
                    <CornerDownRight className="w-3 sm:w-4 h-3 sm:h-4" />
                    <span className="hidden sm:inline">Reply</span>
                    <span className="sm:hidden">↳</span>
                    {comment.replies && comment.replies.length > 0 && ` (${comment.replies.length})`}
                  </button>
                  {(comment.authorId === userId ||
                    comment.created_by === userId ||
                    comment.user_id === userId ||
                    comment.can_delete ||
                    canDeleteComment(getUserPermissions(), comment, userId)
                  ) && (
                      <button
                        onClick={() => onDeleteComment(feedId, comment.id)}
                        className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs sm:text-sm"
                      >
                        <X className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span className="hidden sm:inline">Delete</span>
                        <span className="sm:hidden">🗑️</span>
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Show replies if expanded */}
          {comment.replies && comment.replies.length > 0 && expandedComments.has(comment.id) && (
            <div className="ml-6 sm:ml-10 space-y-2">
              {/* Reply box for replies - show at the top before all replies */}
              {replyBoxState &&
                replyBoxState.feedId === feedId &&
                replyBoxState.commentId === comment.id && (
                  <div className="flex items-start space-x-2 sm:space-x-3 mt-1">
                    <div className="w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-3 sm:w-4 h-3 sm:h-4 text-white" />
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full px-3 sm:px-4 py-2 border border-gray-700">
                      <div className="flex items-center mb-1 text-xs text-gray-500">
                        <span className="hidden sm:inline">Replying to</span>
                        <span className="sm:hidden">→</span>
                        <span className="ml-1 font-semibold text-blue-600">@{replyBoxState.replyTo}</span>
                        <button className="ml-2 text-red-500" onClick={() => setReplyBoxState(null)}><X className="w-3 sm:w-4 h-3 sm:h-4" /></button>
                      </div>
                      <input
                        type="text"
                        placeholder={`Reply as ${userName}`}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && replyText.trim()) {
                            handleReply(feedId);
                          }
                        }}
                        className="w-full bg-transparent outline-none text-black placeholder-gray-400 text-sm sm:text-base"
                      />
                    </div>
                    <button
                      onClick={() => handleReply(feedId)}
                      className="ml-1 sm:ml-2 text-blue-500 font-semibold text-xs sm:text-sm"
                    >
                      Send
                    </button>
                  </div>
                )}
              
              {[...comment.replies].sort((a, b) => {
                const timeA = new Date(a.timestamp || a.created_at || 0);
                const timeB = new Date(b.timestamp || b.created_at || 0);
                return timeB - timeA; // Newest replies first too
              }).map(reply => (
                <div key={reply.id} className="flex items-start space-x-2 sm:space-x-3">
                  <div className="ml-1 pt-2">
                    <CornerDownRight className="w-2 sm:w-3 h-2 sm:h-3 text-blue-400" />
                  </div>
                  <div className="w-6 sm:w-8 h-6 sm:h-8 bg-blue-700 rounded-full flex items-center justify-center">
                    <User className="w-3 sm:w-4 h-3 sm:h-4 text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-blue-50 rounded-2xl px-2 sm:px-3 py-2 border border-blue-300">
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-xs sm:text-sm text-black">
                          {reply.author}
                          {reply.replyTo && (
                            <span className="ml-1 sm:ml-2 text-xs text-blue-600">
                              <span className="hidden sm:inline">replying to</span>
                              <span className="sm:hidden">→</span> @{reply.replyTo}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-black">{reply.timestamp}</div>
                      </div>
                      <div className="text-black mt-1 text-sm sm:text-base">{reply.text}</div>
                      <div className="flex gap-2 sm:gap-4 mt-1 text-xs">
                        <button
                          key={`reply-like-${reply.id}-${reply.liked}-${reply.likeCount}`}
                          onClick={() => onLike(reply.id, comment.id)}
                          disabled={likingComments.has(reply.id)}
                          className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-300 font-medium disabled:opacity-50 text-xs ${
                            reply.liked === true
                              ? "text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100" 
                              : "text-gray-600 bg-white border border-gray-200 hover:text-blue-500 hover:bg-blue-50"
                          } hover:scale-105`}
                        >
                          <ThumbsUp className={`w-3 sm:w-4 h-3 sm:h-4 transition-all duration-300 ${reply.liked === true ? 'fill-blue-600 scale-110' : 'fill-none'}`} />
                          <span className="font-semibold">{reply.likeCount || 0}</span>
                          <span className="hidden sm:inline">{reply.liked === true ? 'Liked' : 'Like'}</span>
                        </button>
                        <button
                          onClick={() => {
                            // If there are replies, expand them when clicking Reply
                            if (comment.replies && comment.replies.length > 0) {
                              const newExpanded = new Set(expandedComments);
                              newExpanded.add(comment.id);
                              setExpandedComments(newExpanded);
                            }
                            onShowReplyBox(feedId, comment.id, reply.author);
                          }}
                          className="flex items-center gap-1 text-blue-500 text-xs"
                        >
                          <CornerDownRight className="w-3 sm:w-4 h-3 sm:h-4" />
                          <span className="hidden sm:inline">Reply</span>
                          <span className="sm:hidden">↳</span>
                        </button>
                        {(reply.authorId === userId ||
                          reply.created_by === userId ||
                          reply.user_id === userId ||
                          reply.can_delete ||
                          canDeleteComment(getUserPermissions(), reply, userId)
                        ) && (
                            <button
                              onClick={() => onDeleteComment(feedId, reply.id)}
                              className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs"
                            >
                              <X className="w-3 sm:w-4 h-3 sm:h-4" />
                              <span className="hidden sm:inline">Delete</span>
                              <span className="sm:hidden">🗑️</span>
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply box for main comment - show only when no replies or not replying to a reply */}
          {replyBoxState &&
            replyBoxState.feedId === feedId &&
            replyBoxState.commentId === comment.id &&
            (!comment.replies || comment.replies.length === 0 || !expandedComments.has(comment.id)) && (
              <div className="flex items-start space-x-2 sm:space-x-3 ml-6 sm:ml-10 mt-1">
                <div className="w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-3 sm:w-4 h-3 sm:h-4 text-white" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full px-3 sm:px-4 py-2 border border-gray-700">
                  <div className="flex items-center mb-1 text-xs text-gray-500">
                    <span className="hidden sm:inline">Replying to</span>
                    <span className="sm:hidden">→</span>
                    <span className="ml-1 font-semibold text-blue-600">@{replyBoxState.replyTo}</span>
                    <button className="ml-2 text-red-500" onClick={() => setReplyBoxState(null)}><X className="w-3 sm:w-4 h-3 sm:h-4" /></button>
                  </div>
                  <input
                    type="text"
                    placeholder={`Reply as ${userName}`}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && replyText.trim()) {
                        handleReply(feedId);
                      }
                    }}
                    className="w-full bg-transparent outline-none text-black placeholder-gray-400 text-sm sm:text-base"
                  />
                </div>
                <button
                  onClick={() => handleReply(feedId)}
                  className="ml-1 sm:ml-2 text-blue-500 font-semibold text-xs sm:text-sm"
                >
                  Send
                </button>
              </div>
            )}
        </React.Fragment>
      ))}
    </div>
  );
});

// Memoized FeedItem component for better performance
const FeedItem = React.memo(function FeedItem({
  feed,
  onLike,
  onComment,
  onShowPostModal,
  onOpenImageViewer,
  onDeletePost,
  onLikeComment,
  onShowReplyBox,
  onDeleteComment,
  onReply,
  commentTexts,
  setCommentTexts,
  replyBoxState,
  replyText,
  setReplyText,
  setReplyBoxState,
  expandedComments,
  setExpandedComments,
  likingComments,
  userName,
  userId,
  userPermissions
}) {
  const canDelete = canDeletePost(userPermissions, feed, userId);
  const canEdit = canEditPost(userPermissions, feed, userId);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-800 mb-3 sm:mb-6 mx-1 sm:mx-0">
      {/* Feed header */}
      <div className="p-3 sm:p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-black text-sm sm:text-base">{feed.author}</div>
              <div className="text-xs sm:text-sm text-gray-600">{feed.timestamp}</div>
            </div>
          </div>
          {canDelete && (
            <button
              onClick={() => onDeletePost(feed.id)}
              className="p-1 sm:p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100"
            >
              <MoreHorizontal className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Feed content */}
      <div className="px-3 sm:px-4 py-3 sm:py-4">
        <p className="text-black whitespace-pre-wrap text-sm sm:text-base">{feed.text}</p>
      </div>
      
      {/* Feed images - full width */}
      {feed.images && feed.images.length > 0 && (
        <div className="grid gap-1 sm:gap-2" style={{
          gridTemplateColumns: feed.images.length === 1 ? '1fr' :
            feed.images.length === 2 ? 'repeat(2, 1fr)' :
            feed.images.length === 3 ? 'repeat(3, 1fr)' :
            'repeat(2, 1fr)'
        }}>
          {feed.images.slice(0, 4).map((image, index) => (
            <div key={index} className="relative">
              <img
                src={image}
                alt={`Post image ${index + 1}`}
                className={`w-full cursor-pointer hover:opacity-90 transition-opacity ${
                  feed.images.length === 1 ? 'h-auto max-h-[600px] object-contain' : 'h-64 sm:h-80 object-cover'
                }`}
                onClick={() => onOpenImageViewer(feed.images, index)}
              />
              {index === 3 && feed.images.length > 4 && (
                <div
                  className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-sm sm:text-xl font-bold cursor-pointer"
                  onClick={() => onOpenImageViewer(feed.images, index)}
                >
                  +{feed.images.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feed actions */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex space-x-3 sm:space-x-6 w-full">
            <button
              onClick={() => onLike(feed.id)}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all duration-300 font-medium text-xs sm:text-sm ${
                feed.liked
                  ? "text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100"
                  : "text-gray-600 bg-white border border-gray-200 hover:text-blue-500 hover:bg-blue-50"
              } hover:scale-105 flex-1 justify-center`}
            >
              <ThumbsUp className={`w-4 sm:w-5 h-4 sm:h-5 transition-all duration-300 ${feed.liked ? 'fill-blue-600 scale-110' : 'fill-none'}`} />
              <span className="font-semibold">{feed.likes}</span>
              <span className="hidden sm:inline">{feed.liked ? 'Liked' : 'Like'}</span>
            </button>
            <button
              onClick={() => onShowPostModal(feed)}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-500 hover:bg-blue-50 transition-all duration-300 font-medium hover:scale-105 flex-1 justify-center text-xs sm:text-sm"
            >
              <MessageCircle className="w-4 sm:w-5 h-4 sm:h-5" />
              <span className="hidden sm:inline">Comment</span>
              <span className="sm:hidden">💬</span>
              <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-semibold">{feed.comments?.length || 0}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function FeedPage({ user }) {
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messageValidationError, setMessageValidationError] = useState('');
  const [posting, setPosting] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);
  const [commentTexts, setCommentTexts] = useState({});
  const [replyBoxState, setReplyBoxState] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [likingComments, setLikingComments] = useState(new Set()); // Track which comments are being liked
  const [likeDebounce, setLikeDebounce] = useState(new Set()); // Prevent rapid clicking

  // Permissions
  const userId = getUserId();
  const userPermissions = getUserPermissions();
  
  // Check for wildcard permissions
  const hasWildcardPermission = userPermissions === '*' || 
                                 (userPermissions && userPermissions.pages === '*') ||
                                 (userPermissions && userPermissions.includes && userPermissions.includes('*'));
  
  // New permission structure for feeds
  const canViewFeeds = hasPermission(userPermissions, 'feeds', 'show') || hasWildcardPermission;
  const canManageFeeds = hasPermission(userPermissions, 'feeds', 'feeds') || hasWildcardPermission;
  const canCreatePost = hasPermission(userPermissions, 'feeds', 'post') || hasWildcardPermission;
  const canComment = true; // Comments are generally allowed for all users who can view feeds
  const canLike = true; // Likes are generally allowed for all users who can view feeds
  const userName = localStorage.getItem('userName') || (user ? `${user.first_name} ${user.last_name}` : "User");

  useEffect(() => { loadFeeds(); }, []);

  const loadFeeds = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }
      const params = new URLSearchParams({
        page: '1',
        page_size: '20',
        user_id: currentUserId,
        include_comments: 'true' // Request comments with feeds to reduce API calls
      });
      const response = await fetch(buildApiUrl(`feeds/?${params}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { throw new Error(`HTTP ${response.status}: ${errorText}`); }
        throw new Error(errorData.detail || 'Failed to fetch feeds');
      }
      const data = await response.json();

      // Get stored comment likes from localStorage once
      const commentLikesKey = `comment_likes_${currentUserId}`;
      const storedLikes = JSON.parse(localStorage.getItem(commentLikesKey) || '{}');

      const transformedFeeds = (data.items || []).map(feed => {
        let timestamp = 'Recently';
        try { if (feed.created_at) timestamp = formatDate(feed.created_at); } catch (e) { }
        
        let comments = [];
        if (feed.comments) {
          // Process comments if included in feed response
          const allComments = feed.comments.map(c => {
            let commentTimestamp = 'Recently';
            try { if (c.created_at) commentTimestamp = formatDate(c.created_at); } catch (e) { }
            
            const isLikedByUser = storedLikes[c.id || c._id] || false;
            
            return {
              id: c.id || c._id,
              text: c.content || '',
              author: c.user_name || 'Unknown User',
              authorId: c.created_by,
              timestamp: commentTimestamp,
              liked: isLikedByUser,
              likeCount: c.likes_count || 0,
              parentId: c.parent_id || null,
              replyTo: c.reply_to || null,
              replies: []
            };
          });
          
          // Build comment hierarchy
          const parentComments = [];
          const childComments = {};
          allComments.forEach(comment => {
            if (!comment.parentId) {
              parentComments.push(comment);
            } else {
              if (!childComments[comment.parentId]) {
                childComments[comment.parentId] = [];
              }
              childComments[comment.parentId].push(comment);
            }
          });
          parentComments.forEach(comment => {
            if (childComments[comment.id]) {
              comment.replies = childComments[comment.id];
            }
          });
          comments = parentComments;
        }
        
        return {
          id: feed.id || feed._id,
          text: feed.content || '',
          images: feed.files ? feed.files.filter(f => f.file_type?.startsWith('image')).map(f => buildMediaUrl(f.file_path)) : [],
          files: feed.files ? feed.files.filter(f => !f.file_type?.startsWith('image')) : [],
          author: feed.creator_name || 'Unknown User',
          authorId: feed.created_by,
          timestamp: timestamp,
          liked: feed.liked_by_user || false,
          showCommentBox: false,
          comments: comments,
          likes: feed.likes_count || 0,
          department: feed.department || 'General'
        };
      });

      setFeeds(transformedFeeds);
      
      // Load comments for each feed separately to ensure they're properly fetched
      for (const feed of transformedFeeds) {
        await loadCommentsForFeed(feed.id);
      }
    } catch (error) {
      setError(`Failed to load feeds: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to load comments for a specific feed
  const loadCommentsForFeed = useCallback(async (feedId) => {
    try {
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId) {
        return;
      }

      const response = await fetch(buildApiUrl(`feeds/${feedId}/comments/?user_id=${encodeURIComponent(currentUserId)}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        return;
      }

      const commentsData = await response.json();

      // Get stored comment likes from localStorage
      const commentLikesKey = `comment_likes_${currentUserId}`;
      const storedLikes = JSON.parse(localStorage.getItem(commentLikesKey) || '{}');

      // Process comments
      const allComments = (commentsData || []).map(c => {
        let commentTimestamp = 'Recently';
        try { if (c.created_at) commentTimestamp = formatDate(c.created_at); } catch (e) { }
        
        const isLikedByUser = storedLikes[c.id || c._id] || false;
        
        return {
          id: c.id || c._id,
          text: c.content || '',
          author: c.user_name || 'Unknown User',
          authorId: c.created_by,
          timestamp: commentTimestamp,
          liked: isLikedByUser,
          likeCount: c.likes_count || 0,
          parentId: c.parent_id || null,
          replyTo: c.reply_to || null,
          replies: []
        };
      });
      
      // Build comment hierarchy
      const parentComments = [];
      const childComments = {};
      allComments.forEach(comment => {
        if (!comment.parentId) {
          parentComments.push(comment);
        } else {
          if (!childComments[comment.parentId]) {
            childComments[comment.parentId] = [];
          }
          childComments[comment.parentId].push(comment);
        }
      });
      parentComments.forEach(comment => {
        if (childComments[comment.id]) {
          comment.replies = childComments[comment.id];
        }
      });

      // Update the specific feed with new comments
      setFeeds(prevFeeds =>
        prevFeeds.map(feed =>
          feed.id === feedId
            ? { ...feed, comments: parentComments }
            : feed
        )
      );

      return parentComments;
    } catch (error) {
      return [];
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    const validFiles = files.filter(file => validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024);
    const newFiles = validFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      type: file.type.startsWith('image/') ? 'image' : 'pdf',
      name: file.name,
      size: file.size
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      
      // Clear validation error if no files remain
      if (newFiles.length === 0) {
        setMessageValidationError('');
      }
      
      return newFiles;
    });
  }, []);

  const openImageViewer = useCallback((images, startIndex) => {
    setViewerImages(images);
    setCurrentImageIndex(startIndex);
    setShowImageViewer(true);
  }, []);
  
  const closeImageViewer = useCallback(() => {
    setShowImageViewer(false);
    setViewerImages([]);
    setCurrentImageIndex(0);
  }, []);
  
  const nextImage = useCallback(() => setCurrentImageIndex((prev) => (prev + 1) % viewerImages.length), [viewerImages.length]);
  const prevImage = useCallback(() => setCurrentImageIndex((prev) => (prev - 1 + viewerImages.length) % viewerImages.length), [viewerImages.length]);

  // Post Modal logic
  const openPostModal = (feed) => {
    setSelectedPost(feed);
    setShowPostModal(true);
    setCurrentImageIndex(0); // Reset to show first image
    setExpandedComments(new Set()); // Reset expanded comments - always start collapsed
    // Focus on comment input after modal is rendered
    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        // Scroll to the comment input
        commentInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };
  const closePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    setCurrentImageIndex(0); // Reset image index when closing
  };

  const handlePost = async () => {
    // Reset validation error
    setMessageValidationError('');
    
    // Check if no content at all
    if (message.trim() === "" && selectedFiles.length === 0) return;
    
    // Check if photos are selected but message is empty
    if (selectedFiles.length > 0 && message.trim() === "") {
      setMessageValidationError('A message is required when posting photos or files.');
      return;
    }
    
    try {
      setPosting(true);
      setError('');
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }
      const formData = new FormData();
      formData.append('content', message.trim());
      formData.append('user_id', currentUserId);
      selectedFiles.forEach((fileObj) => {
        formData.append('files', fileObj.file);
      });
      const response = await fetch(buildApiUrl('feeds/'), {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to create post');
      }
      await response.json();
      await loadFeeds();
      setMessage("");
      setSelectedFiles([]);
      setMessageValidationError('');
      setShowCreatePost(false);
      selectedFiles.forEach(fileObj => {
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview);
        }
      });
    } catch (error) {
      setError('Failed to post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (feedId) => {
    try {
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }
      const currentFeed = feeds.find(feed => feed.id === feedId);
      const isCurrentlyLiked = currentFeed?.liked || false;
      const endpoint = isCurrentlyLiked
        ? buildApiUrl(`feeds/${feedId}/unlike/?user_id=${currentUserId}`)
        : buildApiUrl(`feeds/${feedId}/like/?user_id=${currentUserId}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
      await response.json();
      setFeeds((prevFeeds) =>
        prevFeeds.map((feed) =>
          feed.id === feedId
            ? {
              ...feed,
              liked: !feed.liked,
              likes: feed.liked ? feed.likes - 1 : feed.likes + 1
            }
            : feed
        )
      );
    } catch (error) {
      setError('Failed to toggle like. Please try again.');
    }
  };

  const toggleCommentBox = (feedId) => {
    setFeeds((prevFeeds) =>
      prevFeeds.map((feed) =>
        feed.id === feedId
          ? { ...feed, showCommentBox: !feed.showCommentBox }
          : feed
      )
    );
  };

  const handleComment = useCallback(async (feedId, commentText) => {
    if (!commentText.trim()) return;
    try {
      // Create temporary comment for immediate UI update
      const tempId = `temp-${Date.now()}`;
      const newComment = {
        id: tempId,
        text: commentText,
        author: userName,
        authorId: userId,
        timestamp: formatDate(new Date(), true),
        canDelete: true,
        liked: false,
        likeCount: 0,
        replies: [],
        isTemp: true
      };
      
      // Immediate UI update - add to both feeds and selectedPost (add to beginning of array)
      setFeeds(prevFeeds =>
        prevFeeds.map(feed =>
          feed.id === feedId
            ? { ...feed, comments: [newComment, ...feed.comments] }
            : feed
        )
      );
      
      // Update selectedPost if it exists (for modal view) (add to beginning of array)
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => ({
          ...prev,
          comments: [newComment, ...prev.comments]
        }));
      }
      
      // Clear comment text immediately
      setCommentTexts(prev => ({ ...prev, [feedId]: '' }));
      
      // Make API call
      const currentUserId = getUserId() || localStorage.getItem('userId');
      if (!currentUserId) {
        throw new Error("User ID not available. Please log in again.");
      }
      
      const response = await fetch(buildApiUrl(`feeds/${feedId}/comments/`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          feed_id: feedId,
          created_by: currentUserId,
          content: commentText
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to post comment');
      }
      
      const result = await response.json();
      
      // Replace temporary comment with real one
      const realComment = {
        id: result.id || result._id,
        text: commentText,
        author: userName,
        authorId: userId,
        timestamp: formatDate(new Date(), true),
        canDelete: true,
        liked: false,
        likeCount: 0,
        replies: []
      };
      
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          return {
            ...feed,
            comments: feed.comments.map(c => c.id === tempId ? realComment : c)
          };
        })
      );
      
      // Update selectedPost if it exists
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => ({
          ...prev,
          comments: prev.comments.map(c => c.id === tempId ? realComment : c)
        }));
      }
      
      // Refresh comments from server to ensure consistency
      await loadCommentsForFeed(feedId);
      
    } catch (error) {
      setError('Failed to add comment. Please try again.');
      // Remove temporary comment on error
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          return {
            ...feed,
            comments: feed.comments.filter(c => !c.isTemp)
          };
        })
      );
      
      // Remove from selectedPost if it exists
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => ({
          ...prev,
          comments: prev.comments.filter(c => !c.isTemp)
        }));
      }
    }
  }, [userName, userId, selectedPost]);

  const handleLikeComment = useCallback(async (feedId, commentId, parentId = null) => {
    // Prevent rapid clicking
    if (likingComments.has(commentId)) return;
    
    try {
      setLikingComments(prev => new Set([...prev, commentId]));
      
      const currentUserId = getUserId() || localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }

      // Since comment likes aren't implemented in backend yet, 
      // we'll use localStorage to simulate the functionality
      const commentLikesKey = `comment_likes_${currentUserId}`;
      const storedLikes = JSON.parse(localStorage.getItem(commentLikesKey) || '{}');
      
      // Find the current comment to get its like status
      let currentComment = null;
      const findComment = (comments) => {
        if (!comments) return null;
        for (const comment of comments) {
          if (comment.id === commentId) {
            return comment;
          }
          if (comment.replies && comment.replies.length > 0) {
            const found = findComment(comment.replies);
            if (found) return found;
          }
        }
        return null;
      };

      // Check selectedPost first since we're in modal
      if (selectedPost && selectedPost.id === feedId) {
        currentComment = findComment(selectedPost.comments);
      }
      
      // If not found, check feeds
      if (!currentComment) {
        const currentFeed = feeds.find(feed => feed.id === feedId);
        if (currentFeed && currentFeed.comments) {
          currentComment = findComment(currentFeed.comments);
        }
      }

      if (!currentComment) {
        return;
      }

      // Check if user has already liked this comment (from localStorage)
      const isCurrentlyLiked = storedLikes[commentId] || false;
      const newLikedState = !isCurrentlyLiked;
      const currentLikeCount = currentComment.likeCount || 0;
      const newLikeCount = isCurrentlyLiked 
        ? Math.max(0, currentLikeCount - 1) 
        : currentLikeCount + 1;
      
      // Update localStorage with new like state
      if (newLikedState) {
        storedLikes[commentId] = true;
      } else {
        delete storedLikes[commentId];
      }
      localStorage.setItem(commentLikesKey, JSON.stringify(storedLikes));
      
      // Optimistic UI update function
      const updateCommentLikes = (comments) => {
        if (!comments) return [];
        return comments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              liked: newLikedState,
              likeCount: newLikeCount
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateCommentLikes(comment.replies)
            };
          }
          return comment;
        });
      };

      // Update selectedPost immediately
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => ({
          ...prev,
          comments: updateCommentLikes(prev.comments)
        }));
      }

      // Update feeds state immediately
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          return {
            ...feed,
            comments: updateCommentLikes(feed.comments)
          };
        })
      );

    } catch (error) {
      setError(`Failed to toggle comment like: ${error.message}`);
    } finally {
      // Remove from likingComments after operation completes
      setTimeout(() => {
        setLikingComments(prev => {
          const newSet = new Set(prev);
          newSet.delete(commentId);
          return newSet;
        });
      }, 300); // Small delay to prevent rapid clicking
    }
  }, [feeds, selectedPost, likingComments]);

  const handleShowReplyBox = useCallback((feedId, commentId, replyTo) => {
    setReplyBoxState({ feedId, commentId, replyTo });
    setReplyText("");
  }, []);

  const handleReply = async (feedId) => {
    if (!replyText.trim()) return;
    try {
      // Create temporary reply for immediate UI update
      const tempId = `temp-reply-${Date.now()}`;
      const newReply = {
        id: tempId,
        text: replyText,
        author: userName,
        authorId: userId,
        timestamp: formatDate(new Date(), true),
        canDelete: true,
        liked: false,
        likeCount: 0,
        parentId: replyBoxState.commentId,
        replies: [],
        isTemp: true
      };
      
      // Immediate UI update for feeds (add reply to beginning of replies array)
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          const addReply = (comments) =>
            comments.map(comment => {
              if (comment.id === replyBoxState.commentId) {
                return {
                  ...comment,
                  replies: [newReply, ...(comment.replies || [])]
                };
              }
              if (comment.replies) {
                return { ...comment, replies: addReply(comment.replies) };
              }
              return comment;
            });
          return {
            ...feed,
            comments: addReply(feed.comments)
          };
        })
      );
      
      // Update selectedPost if it exists (for modal view) (add reply to beginning)
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => {
          const addReply = (comments) =>
            comments.map(comment => {
              if (comment.id === replyBoxState.commentId) {
                return {
                  ...comment,
                  replies: [newReply, ...(comment.replies || [])]
                };
              }
              if (comment.replies) {
                return { ...comment, replies: addReply(comment.replies) };
              }
              return comment;
            });
          return {
            ...prev,
            comments: addReply(prev.comments)
          };
        });
      }
      
      // Clear reply state immediately
      const tempReplyBoxState = replyBoxState;
      const tempReplyText = replyText;
      setReplyBoxState(null);
      setReplyText("");
      
      // Auto-expand the comment to show the new reply
      setExpandedComments(prev => {
        const newExpanded = new Set(prev);
        newExpanded.add(tempReplyBoxState.commentId);
        return newExpanded;
      });
      
      // Make API call
      const currentUserId = getUserId() || localStorage.getItem('userId');
      if (!currentUserId) {
        throw new Error("User ID not available. Please log in again.");
      }
      
      const response = await fetch(buildApiUrl(`feeds/${feedId}/comments/`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          feed_id: feedId,
          created_by: currentUserId,
          content: tempReplyText,
          parent_id: tempReplyBoxState.commentId,
          reply_to: tempReplyBoxState.replyTo
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to post reply');
      }
      
      const result = await response.json();
      
      // Replace temporary reply with real one
      const realReply = {
        id: result.id || result._id,
        text: tempReplyText,
        author: userName,
        authorId: userId,
        timestamp: formatDate(new Date(), true),
        canDelete: true,
        liked: false,
        likeCount: 0,
        parentId: tempReplyBoxState.commentId,
        replies: []
      };
      
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          const replaceReply = (comments) =>
            comments.map(comment => {
              if (comment.id === tempReplyBoxState.commentId) {
                return {
                  ...comment,
                  replies: (comment.replies || []).map(r => r.id === tempId ? realReply : r)
                };
              }
              if (comment.replies) {
                return { ...comment, replies: replaceReply(comment.replies) };
              }
              return comment;
            });
          return {
            ...feed,
            comments: replaceReply(feed.comments)
          };
        })
      );
      
      // Update selectedPost if it exists
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => {
          const replaceReply = (comments) =>
            comments.map(comment => {
              if (comment.id === tempReplyBoxState.commentId) {
                return {
                  ...comment,
                  replies: (comment.replies || []).map(r => r.id === tempId ? realReply : r)
                };
              }
              if (comment.replies) {
                return { ...comment, replies: replaceReply(comment.replies) };
              }
              return comment;
            });
          return {
            ...prev,
            comments: replaceReply(prev.comments)
          };
        });
      }
      
      // Refresh comments from server to ensure consistency
      await loadCommentsForFeed(feedId);
      
    } catch (error) {
      setError('Failed to add reply. Please try again.');
      // Remove temporary reply on error
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          const removeTemp = (comments) =>
            comments.map(comment => {
              if (comment.id === replyBoxState.commentId) {
                return {
                  ...comment,
                  replies: (comment.replies || []).filter(r => !r.isTemp)
                };
              }
              if (comment.replies) {
                return { ...comment, replies: removeTemp(comment.replies) };
              }
              return comment;
            });
          return {
            ...feed,
            comments: removeTemp(feed.comments)
          };
        })
      );
      
      // Remove from selectedPost if it exists
      if (selectedPost && selectedPost.id === feedId) {
        setSelectedPost(prev => {
          const removeTemp = (comments) =>
            comments.map(comment => {
              if (comment.id === replyBoxState.commentId) {
                return {
                  ...comment,
                  replies: (comment.replies || []).filter(r => !r.isTemp)
                };
              }
              if (comment.replies) {
                return { ...comment, replies: removeTemp(comment.replies) };
              }
              return comment;
            });
          return {
            ...prev,
            comments: removeTemp(prev.comments)
          };
        });
      }
    }
  };

  const deletePost = async (feedId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }
    try {
      const currentUserId = getUserId() || localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User ID not found. Please log in again.');
        return;
      }
      setFeeds(prevFeeds => prevFeeds.filter(feed => feed.id !== feedId));
      const response = await fetch(buildApiUrl(`feeds/${feedId}/?user_id=${encodeURIComponent(currentUserId)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete post');
      }
      // Optionally show a toast
    } catch (error) {
      setError('Failed to delete post. Please try again.');
      loadFeeds();
    }
  };

  const handleDeleteComment = async (feedId, commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }
    try {
      const currentUserId = getUserId() || localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User ID not found. Please log in again.');
        return;
      }
      setFeeds(prevFeeds =>
        prevFeeds.map(feed => {
          if (feed.id !== feedId) return feed;
          const removeComment = (comments) => {
            const filteredComments = comments.filter(c => c.id !== commentId);
            return filteredComments.map(c => {
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: removeComment(c.replies) };
              }
              return c;
            });
          };
          return { ...feed, comments: removeComment(feed.comments) };
        })
      );
      const response = await fetch(buildApiUrl(`feeds/comments/${commentId}/?user_id=${encodeURIComponent(currentUserId)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }
    } catch (error) {
      setError('Failed to delete comment. Please try again.');
      loadFeeds();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-2 text-white">Loading feeds...</span>
      </div>
    );
  }

  if (!canViewFeeds) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400">You don't have permission to view the feeds.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-2 sm:px-4 pt-2 sm:pt-4 pb-4 sm:pb-8 max-w-4xl">
        {canCreatePost && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-800 mb-4 sm:mb-6">
            <div className="p-3 sm:p-4 border-b border-gray-800">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 sm:w-6 h-4 sm:h-6 text-white" />
                </div>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-black text-left px-3 sm:px-4 py-2 sm:py-3 rounded-full transition-colors border border-black text-sm sm:text-base"
                >
                  What's on your mind, {userName.split(' ')[0]}?
                </button>
              </div>
            </div>
            <div className="flex items-center justify-around py-2 px-3 sm:px-4">
              <button
                onClick={() => {
                  setShowCreatePost(true);
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="flex-1 flex bg-green-100 items-center justify-center py-2 px-2 sm:px-4 text-black hover:bg-green-300 rounded-lg transition-colors border border-black text-sm sm:text-base"
              >
                <Image className="w-4 sm:w-6 h-4 sm:h-6 text-green-400 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Photos/PDF</span>
                <span className="sm:hidden">Media</span>
              </button>
            </div>
          </div>
        )}

        {showCreatePost && (
          <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-gray-900 rounded-lg w-full max-w-sm sm:max-w-xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
              <div className="flex bg-white items-center justify-between p-3 sm:p-4 border-b border-gray-800">
                <h3 className="text-lg sm:text-xl font-bold text-black">Create post</h3>
                <button
                  onClick={() => {
                    setShowCreatePost(false);
                    setSelectedFiles([]);
                    setMessage("");
                  }}
                  className="w-8 sm:w-10 h-8 sm:h-10 flex items-center justify-center bg-gray-800 rounded-full hover:bg-red-600 text-white transition-all duration-200"
                >
                  <X className="w-4 sm:w-6 h-4 sm:h-6" />
                </button>
              </div>
              <div className="p-3 sm:p-4 bg-white">
                <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                  <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-4 sm:w-6 h-4 sm:h-6 text-black" />
                  </div>
                  <div>
                    <div className="font-semibold text-black text-sm sm:text-base">{userName}</div>
                    <div className="text-xs sm:text-sm text-black bg-gray/20 px-2 py-1 rounded flex items-center border border-gray-700">
                      🌐 Public
                    </div>
                  </div>
                </div>
                <textarea
                  placeholder={`What's on your mind, ${userName.split(' ')[0]}?`}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    // Clear validation error when user starts typing
                    if (messageValidationError) {
                      setMessageValidationError('');
                    }
                    // Auto-resize functionality
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.max(80, e.target.scrollHeight) + 'px';
                  }}
                  className={`w-full bg-gray-100 text-black text-base sm:text-xl placeholder-gray-400 border rounded-lg p-2 sm:p-3 outline-none resize-none min-h-[80px] sm:min-h-[120px] max-h-[300px] sm:max-h-[400px] overflow-y-auto transition-all duration-200 ${
                    messageValidationError 
                      ? 'border-red-500 focus:border-red-500 bg-red-50' 
                      : 'border-gray-700 focus:border-blue-500'
                  }`}
                  autoFocus
                  style={{
                    height: '80px', // Initial height for mobile
                    minHeight: '80px',
                    maxHeight: window.innerWidth < 640 ? '300px' : '400px'
                  }}
                  onInput={(e) => {
                    // Additional auto-resize on input event
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.max(window.innerWidth < 640 ? 80 : 120, e.target.scrollHeight) + 'px';
                  }}
                />
                {messageValidationError && (
                  <div className="mt-2 text-red-500 text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {messageValidationError}
                  </div>
                )}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 sm:mt-4">
                    <div className="grid grid-cols-2 gap-1 sm:gap-2">
                      {selectedFiles.slice(0, Math.min(4, selectedFiles.length)).map((fileObj, index) => (
                        <div key={index} className="relative">
                          {fileObj.type === 'image' ? (
                            <img
                              src={fileObj.preview}
                              alt="Preview"
                              className="w-full h-24 sm:h-32 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-24 sm:h-32 bg-gray-800 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 sm:w-8 h-6 sm:h-8 text-red-500" />
                              <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-300 truncate max-w-[60px] sm:max-w-[80px]">{fileObj.name}</span>
                            </div>
                          )}
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-1 sm:top-2 right-1 sm:right-2 w-5 sm:w-6 h-5 sm:h-6 bg-gray-800 bg-opacity-70 text-white rounded-full flex items-center justify-center hover:bg-opacity-90"
                          >
                            <X className="w-3 sm:w-4 h-3 sm:h-4" />
                          </button>
                          {index === 3 && selectedFiles.length > 4 && (
                            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg">
                              <span className="text-white text-sm sm:text-xl font-bold">
                                +{selectedFiles.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 sm:mt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center w-full py-2 px-3 sm:px-4 text-black hover:bg-green-300 rounded-lg transition-colors border border-gray-700 text-sm sm:text-base"
                  >
                    <Image className="w-4 sm:w-6 h-4 sm:h-6 text-green-400 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Add Photos/PDF</span>
                    <span className="sm:hidden">Add Media</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={handlePost}
                  disabled={posting || (message.trim() === "" && selectedFiles.length === 0) || messageValidationError}
                  className={`w-full mt-3 sm:mt-4 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    posting || (message.trim() === "" && selectedFiles.length === 0) || messageValidationError
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {posting ? (
                    <div className="flex items-center justify-center">
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Posting...
                    </div>
                  ) : 'Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 px-3 sm:px-4 py-3 rounded mb-4 sm:mb-6 mx-2 sm:mx-auto max-w-3xl text-sm sm:text-base">
            {error}
          </div>
        )}

        {feeds.length === 0 && !loading && !error && (
          <div className="text-center py-6 sm:py-8 text-gray-400 text-sm sm:text-base px-4">
            No posts yet. Be the first to share something!
          </div>
        )}

        <div className="flex flex-col gap-3 sm:gap-6">
          {feeds.map((feed) => {
            const currentUserId = getUserId() || localStorage.getItem('userId');
            const postForPermission = {
              ...feed,
              created_by: feed.created_by || feed.authorId || feed.creator_id || (feed.creator && feed.creator.id)
            };
            const userCanDeletePost = canDeletePost(userPermissions, postForPermission, currentUserId);

            return (
              <div
                key={feed.id}
                className="bg-white rounded-lg shadow-sm border border-gray-800 h-full flex flex-col"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <div className="font-semibold text-black">{feed.author || feed.creator_name}</div>
                      <div className="text-sm text-black">{feed.timestamp}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-800 rounded-full">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {userCanDeletePost && (
                      <button
                        onClick={() => deletePost(feed.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded-full"
                        title="Delete Post"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-4 pb-3">
                  <p className="text-black whitespace-pre-wrap bg-white font-bold text-lg">{feed.text}</p>
                </div>

                {/* Post Images - Full Width */}
                {feed.images && feed.images.length > 0 && (
                  <div className="pb-3 bg-white">
                    <div className={`grid gap-1 ${feed.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {feed.images.slice(0, Math.min(4, feed.images.length)).map((image, index) => (
                        <div
                          key={index}
                          className="relative cursor-pointer"
                          onClick={() => openImageViewer(feed.images, index)}
                        >
                          <img
                            src={image}
                            alt={`Post image ${index + 1}`}
                            className={`w-full ${
                              feed.images.length === 1 ? 'h-auto max-h-[600px] object-contain' : 'h-64 sm:h-80 object-cover'
                            }`}
                          />
                          {index === 3 && feed.images.length > 4 && (
                            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                              <span className="text-white text-2xl font-bold">
                                +{feed.images.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post Actions */}
                <div className="border-t px-4 py-2 bg-white">
                  <div className="flex items-center justify-around border-gray-200 pt-3">
                    {canLike && (
                      <button
                        onClick={() => toggleLike(feed.id)}
                        className={`flex-1 flex items-center justify-center py-2 px-4 rounded-lg transition-colors ${feed.liked
                          ? 'text-blue-400'
                          : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        <ThumbsUp className={`w-5 h-5 mr-2 ${feed.liked ? 'fill-blue-400' : ''}`} />
                        Like
                        <span className="ml-2 text-sm font-semibold">{feed.likes || 0}</span>
                      </button>
                    )}
                    {canComment && (
                      <button
                        onClick={() => openPostModal(feed)}
                        className="flex-1 flex items-center justify-center py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Comment
                        <span className="ml-2 text-sm font-semibold">{feed.comments?.length || 0}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={closeImageViewer}
              className="fixed top-4 right-4 w-12 h-12 bg-gray-800 bg-opacity-80 text-white rounded-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-all duration-200 z-50 shadow-lg border border-gray-600 transform hover:scale-110"
              title="Close image viewer"
            >
              <X className="w-6 h-6" />
            </button>
            {viewerImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 w-10 h-10 bg-gray-800 bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 w-10 h-10 bg-gray-800 bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
            <img
              src={viewerImages[currentImageIndex]}
              alt="Full size"
              className="max-w-[95vw] max-h-[90vh] object-contain"
            />
            {viewerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
                {currentImageIndex + 1} of {viewerImages.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Viewer Modal */}
      {showPostModal && selectedPost && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-sm sm:max-w-3xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-gray-800 shadow-2xl flex flex-col" id="post-modal-content">
            {/* Header with close button - this part stays fixed when scrolling */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-800 bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 sm:w-6 h-4 sm:h-6 text-black" />
                </div>
                <div>
                  <div className="font-semibold text-black text-sm sm:text-base">{selectedPost.author || selectedPost.creator_name}</div>
                  <div className="text-xs sm:text-sm text-black">{selectedPost.timestamp}</div>
                </div>
              </div>
              <button 
                onClick={closePostModal}
                className="w-7 sm:w-8 h-7 sm:h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
            </div>
            
            {/* Scrollable content container */}
            <div className="overflow-y-auto flex-1">
            {/* Post Content */}
            <div className="px-3 sm:px-4 py-2 sm:py-3">
              <p className="text-black whitespace-pre-wrap bg-white font-bold text-base sm:text-lg">{selectedPost.text}</p>
            </div>
            
            {/* Post Images - Full Width */}
            {selectedPost.images && selectedPost.images.length > 0 && (
              <div className="relative bg-black">
                <div className="relative w-full h-96 sm:h-[500px] overflow-hidden bg-black">
                  <img
                    src={selectedPost.images[currentImageIndex]}
                    alt={`Post image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                    {selectedPost.images.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) => (prev - 1 + selectedPost.images.length) % selectedPost.images.length);
                          }}
                          className="absolute left-1 sm:left-2 top-1/2 transform -translate-y-1/2 w-8 sm:w-10 h-8 sm:h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all hover:scale-110"
                        >
                          <ChevronLeft className="w-4 sm:w-6 h-4 sm:h-6" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) => (prev + 1) % selectedPost.images.length);
                          }}
                          className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 w-8 sm:w-10 h-8 sm:h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all hover:scale-110"
                        >
                          <ChevronRight className="w-4 sm:w-6 h-4 sm:h-6" />
                        </button>
                        <div className="absolute bottom-1 sm:bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium">
                          {currentImageIndex + 1} / {selectedPost.images.length}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Image thumbnails for navigation */}
                  {selectedPost.images.length > 1 && (
                    <div className="flex justify-center mt-1 sm:mt-2 gap-1 sm:gap-2 overflow-x-auto py-1 sm:py-2 px-2 bg-black">
                      {selectedPost.images.map((img, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`w-12 sm:w-16 h-12 sm:h-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${currentImageIndex === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-70'}`}
                        >
                          <img 
                            src={img} 
                            alt={`Thumbnail ${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
            {/* Comments Section */}
            <div id="comments-section" className="border-t border-gray-800 px-3 sm:px-4 py-2 sm:py-3 bg-white">
              <div className="font-bold text-black mb-2 text-sm sm:text-base">Comments</div>
              {/* Comment input box FIRST */}
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-3 sm:w-4 h-3 sm:h-4 text-white" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full px-3 sm:px-4 py-2 border border-gray-700">
                  <input
                    ref={commentInputRef}
                    type="text"
                    placeholder="Write a comment..."
                    value={commentTexts[selectedPost.id] || ''}
                    onChange={(e) => setCommentTexts(prev => ({ ...prev, [selectedPost.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (commentTexts[selectedPost.id] || '').trim()) {
                        handleComment(selectedPost.id, commentTexts[selectedPost.id]);
                        setCommentTexts(prev => ({ ...prev, [selectedPost.id]: '' }));
                      }
                    }}
                    className="w-full bg-transparent outline-none text-black placeholder-gray-400 text-sm sm:text-base"
                  />
                </div>
                <button
                  onClick={() => {
                    if ((commentTexts[selectedPost.id] || '').trim()) {
                      handleComment(selectedPost.id, commentTexts[selectedPost.id]);
                      setCommentTexts(prev => ({ ...prev, [selectedPost.id]: '' }));
                    }
                  }}
                  className="ml-1 sm:ml-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
                >
                  Comment
                </button>
              </div>
              {/* Comments list */}
              <CommentList
                comments={selectedPost.comments}
                onLike={(commentId, parentId) => handleLikeComment(selectedPost.id, commentId, parentId)}
                onShowReplyBox={handleShowReplyBox}
                onDeleteComment={handleDeleteComment}
                replyBoxState={replyBoxState && replyBoxState.feedId === selectedPost.id ? replyBoxState : null}
                replyText={replyText}
                setReplyText={setReplyText}
                handleReply={handleReply}
                userName={userName}
                userId={userId}
                feedId={selectedPost.id}
                setReplyBoxState={setReplyBoxState}
                expandedComments={expandedComments}
                setExpandedComments={setExpandedComments}
                likingComments={likingComments}
              />
            </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
