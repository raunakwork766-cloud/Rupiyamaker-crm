import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ThumbsUp, MessageCircle, User, AlertCircle, Loader, Image, FileText, X, ChevronLeft, ChevronRight, MoreHorizontal, CornerDownRight, Trash2, CheckCircle2, Clock } from "lucide-react";
import { hasPermission, canEditPost, canDeletePost, canDeleteComment, getUserPermissions, getUserId } from '../utils/permissions';
import { buildApiUrl, buildMediaUrl } from '../config/api';
import { getProfilePictureUrlWithCacheBusting } from '../utils/mediaUtils';
import { feedsAPI } from '../services/api';
import { formatDateTime } from '../utils/dateUtils';
import useNavbarPageSearch from '../hooks/useNavbarPageSearch';

// Helper function to format date and time in IST timezone
function formatDate(dateString, isLocalTime = false) {
  return formatDateTime(dateString);
}

const FEED_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const isFeedImageFile = (file) => {
  if (!file) return false;
  if (file.type?.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || '');
};

const isFeedAllowedUpload = (file) => isFeedImageFile(file) || file.type === 'application/pdf';

const extractFeedImageUrls = (files = []) =>
  files.filter((f) => {
    const fileType = (f.file_type || '').toLowerCase();
    const filePath = (f.file_path || f.filename || '').toLowerCase();
    return fileType.startsWith('image') || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(filePath);
  }).map((f) => buildMediaUrl(f.file_path));

const feedImageClassName = 'block w-auto h-auto max-w-full max-h-[354px] sm:max-h-[430px] object-contain';

// ── Poll Display Component ──
// State is fully self-contained. No effects, no stale closures, no prop-sync loops.
function PollDisplay({ poll, postId, currentUserId, onPollUpdate }) {
  // Compute initial voted index once from prop
  const initIdx = () =>
    (poll?.options || []).findIndex(o => (o.voters || []).includes(currentUserId ?? ''));

  // 'idle' | 'voted' | 'open'
  const [phase, setPhase] = React.useState(() => initIdx() >= 0 ? 'voted' : 'idle');
  const [myIdx,  setMyIdx]  = React.useState(() => { const i = initIdx(); return i >= 0 ? i : null; });
  const [counts, setCounts] = React.useState(() => (poll?.options || []).map(o => o.votes || 0));
  const [busy,   setBusy]   = React.useState(false);

  // Expose a stable ref to current phase so async callbacks always see latest value
  const stateRef = React.useRef({ phase: phase === 'idle' ? 'idle' : 'voted', myIdx: myIdx });
  stateRef.current = { phase, myIdx };

  if (!poll) return null;
  const expired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
  const total   = counts.reduce((s, c) => s + c, 0);

  async function click(i) {
    if (busy || expired || !currentUserId) return;

    const { phase: curPhase, myIdx: curIdx } = stateRef.current;

    if (curPhase === 'idle' || curPhase === 'open') {
      // ── VOTE ──
      setBusy(true);
      setCounts(p => p.map((c, x) => x === i ? c + 1 : c));
      setPhase('voted'); setMyIdx(i);
      stateRef.current = { phase: 'voted', myIdx: i };

      try {
        const res = await fetch(
          buildApiUrl(`feeds/${postId}/poll/vote?user_id=${encodeURIComponent(currentUserId)}`),
          { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify({ option_index: i }) }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.poll?.options) {
          setCounts(data.poll.options.map(o => o.votes || 0));
          onPollUpdate?.({ ...poll, options: data.poll.options.map((o, x) => ({ ...poll.options[x], ...o, voters: x === i ? [...(poll.options[x]?.voters || []), currentUserId] : (poll.options[x]?.voters || []) })) });
        } else if (!res.ok) {
          // revert
          setCounts(p => p.map((c, x) => x === i ? Math.max(0, c - 1) : c));
          const rollback = curPhase; setPhase(rollback); setMyIdx(curIdx);
          stateRef.current = { phase: rollback, myIdx: curIdx };
        }
      } catch (_) {}
      setBusy(false);

    } else if (curPhase === 'voted' && curIdx === i) {
      // ── UNVOTE ──
      setBusy(true);
      setCounts(p => p.map((c, x) => x === i ? Math.max(0, c - 1) : c));
      setPhase('open'); setMyIdx(null);
      stateRef.current = { phase: 'open', myIdx: null };

      try {
        const res = await fetch(
          buildApiUrl(`feeds/${postId}/poll/unvote?user_id=${encodeURIComponent(currentUserId)}`),
          { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: '{}' }
        );
        if (res.ok || res.status === 400) {
          // 400 = "already unvoted" — still treat as success
          const data = await res.json().catch(() => ({}));
          if (data?.poll?.options) setCounts(data.poll.options.map(o => o.votes || 0));
          onPollUpdate?.({ ...poll, options: poll.options.map(o => ({ ...o, voters: (o.voters || []).filter(v => v !== currentUserId) })) });
        } else {
          // true server error — revert
          setCounts(p => p.map((c, x) => x === i ? c + 1 : c));
          setPhase('voted'); setMyIdx(i);
          stateRef.current = { phase: 'voted', myIdx: i };
        }
      } catch (_) {}
      setBusy(false);
    }
    // voted + different option → locked, ignore
  }

  const showBars = phase === 'voted' || expired;

  return (
    <div className="mx-4 my-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
      <p className="font-semibold text-gray-900 text-[15px] mb-3">{poll.question}</p>
      <div className="space-y-2">
        {(poll.options || []).map((opt, i) => {
          const pct    = total > 0 ? Math.round(counts[i] / total * 100) : 0;
          const isMe   = phase === 'voted' && myIdx === i;
          const locked = phase === 'voted' && myIdx !== i;
          return (
            <button key={i} type="button" onClick={() => click(i)}
              disabled={expired || locked || busy}
              className={[
                'relative w-full overflow-hidden rounded-lg border h-9 flex items-center px-3 text-left transition-all',
                expired  ? 'border-gray-200 bg-white cursor-default' :
                locked   ? 'border-gray-200 bg-white opacity-60 cursor-not-allowed' :
                isMe     ? 'border-blue-400 bg-white hover:bg-blue-50 cursor-pointer' :
                           'border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400 cursor-pointer'
              ].join(' ')}
            >
              {showBars && (
                <div className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-700 ${isMe ? 'bg-blue-100' : 'bg-gray-100'}`}
                  style={{ width: `${pct}%` }} />
              )}
              <span className={`relative z-10 text-sm font-medium flex-1 ${isMe ? 'text-blue-700' : 'text-gray-700'}`}>
                {isMe && '\u2713 '}{opt.text}
              </span>
              {showBars && <span className="relative z-10 text-xs text-gray-500 font-semibold ml-2">{pct}%</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        <span>{total} vote{total !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          {expired && <span className="text-red-400 font-medium">Poll ended</span>}
          {!expired && poll.expires_at && <span>Ends {new Date(poll.expires_at).toLocaleDateString()}</span>}
          {phase === 'voted' && !expired && <span className="italic text-gray-400">Click \u2713 to undo</span>}
          {phase === 'open'  && !expired && <span className="text-blue-500 italic">Pick a new option</span>}
        </div>
      </div>
    </div>
  );
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
        <div className={feed.images.length === 1 ? 'bg-black' : 'grid gap-1 sm:gap-2'} style={{
          gridTemplateColumns: feed.images.length === 1 ? '1fr' :
            feed.images.length === 2 ? 'repeat(2, 1fr)' :
            feed.images.length === 3 ? 'repeat(3, 1fr)' :
            'repeat(2, 1fr)'
        }}>
          {feed.images.slice(0, 4).map((image, index) => (
            <div key={index} className={`relative ${feed.images.length === 1 ? '' : ''}`}>
              <img
                src={image}
                alt={`Post image ${index + 1}`}
                className={`w-full cursor-pointer hover:opacity-90 transition-opacity ${
                  feed.images.length === 1 ? 'h-[500px] sm:h-[600px] object-contain' : 'h-80 sm:h-96 object-cover'
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
  const [viewerFeed, setViewerFeed] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);
  const viewerCommentInputRef = useRef(null);
  const [commentTexts, setCommentTexts] = useState({});
  const [replyBoxState, setReplyBoxState] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [likingComments, setLikingComments] = useState(new Set()); // Track which comments are being liked
  const [likeDebounce, setLikeDebounce] = useState(new Set()); // Prevent rapid clicking
  const [expandedPosts, setExpandedPosts] = useState(new Set()); // Track which post texts are expanded
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDays, setPollDays] = useState(1);
  useNavbarPageSearch(setFeedSearchQuery);

  const visibleFeeds = useMemo(() => {
    const query = feedSearchQuery.trim().toLowerCase();
    if (!query) return feeds;
    return feeds.filter((feed) => {
      const authorName = (feed.author || feed.creator_name || '').toLowerCase();
      const text = (feed.text || '').toLowerCase();
      const commentText = (feed.comments || [])
        .map((c) => `${c.text || ''} ${c.author || c.user_name || ''}`)
        .join(' ')
        .toLowerCase();
      return authorName.includes(query) || text.includes(query) || commentText.includes(query);
    });
  }, [feeds, feedSearchQuery]);

  // Permissions
  const userId = getUserId();
  const userPermissions = getUserPermissions();
  
  // Check for wildcard permissions
  const hasWildcardPermission = userPermissions === '*' || 
                                 (userPermissions && userPermissions.pages === '*') ||
                                 (userPermissions && userPermissions.includes && userPermissions.includes('*'));
  
  // New permission structure for feeds
  const canViewFeeds = hasPermission(userPermissions, 'feeds', 'show') || hasWildcardPermission;
  const canCreatePost = hasPermission(userPermissions, 'feeds', 'post') || hasWildcardPermission;
  const canComment = true; // Comments are generally allowed for all users who can view feeds
  const canLike = true; // Likes are generally allowed for all users who can view feeds
  const userName = localStorage.getItem('userName') || (user ? `${user.first_name} ${user.last_name}` : "User");

  useEffect(() => { loadFeeds(); }, []);

  useEffect(() => {
    if (!viewerFeed) return;
    const updated = feeds.find((f) => f.id === viewerFeed.id);
    if (updated) setViewerFeed(updated);
  }, [feeds, viewerFeed?.id]);

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
          images: extractFeedImageUrls(feed.files),
          files: feed.files ? feed.files.filter(f => !f.file_type?.startsWith('image')) : [],
          author: feed.creator_name || 'Unknown User',
          authorId: feed.created_by,
          author_photo: feed.creator_photo ? getProfilePictureUrlWithCacheBusting(feed.creator_photo) : null,
          timestamp: timestamp,
          liked: feed.liked_by_user || false,
          showCommentBox: false,
          comments: comments,
          likes: feed.likes_count || 0,
          department: feed.department || 'General',
          poll: feed.poll || null
        };
      });

      setFeeds(transformedFeeds);
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
    const files = Array.from(e.target.files || []);
    const accepted = [];
    const rejected = [];

    files.forEach((file) => {
      if (!isFeedAllowedUpload(file)) {
        rejected.push(`${file.name}: unsupported file type`);
        return;
      }
      if (file.size > FEED_UPLOAD_MAX_BYTES) {
        rejected.push(`${file.name}: exceeds 50MB limit`);
        return;
      }
      accepted.push(file);
    });

    if (rejected.length > 0) {
      setError(rejected.join(' | '));
    }

    const newFiles = accepted.map(file => ({
      file,
      preview: isFeedImageFile(file) ? URL.createObjectURL(file) : null,
      type: isFeedImageFile(file) ? 'image' : 'pdf',
      name: file.name,
      size: file.size
    }));
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
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

  const openImageViewer = useCallback((feed, images, startIndex = 0) => {
    setViewerFeed(feed);
    setViewerImages(images);
    setCurrentImageIndex(startIndex);
    setShowImageViewer(true);
    setExpandedComments(new Set());
  }, []);
  
  const closeImageViewer = useCallback(() => {
    setShowImageViewer(false);
    setViewerImages([]);
    setViewerFeed(null);
    setCurrentImageIndex(0);
  }, []);
  
  const nextImage = useCallback(() => setCurrentImageIndex((prev) => (prev + 1) % viewerImages.length), [viewerImages.length]);
  const prevImage = useCallback(() => setCurrentImageIndex((prev) => (prev - 1 + viewerImages.length) % viewerImages.length), [viewerImages.length]);

  // Post Modal logic
  const openPostModal = (feed) => {
    if (feed.images && feed.images.length > 0) {
      openImageViewer(feed, feed.images, 0);
      return;
    }
    setSelectedPost(feed);
    setShowPostModal(true);
    setCurrentImageIndex(0);
    setExpandedComments(new Set());
    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        commentInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };
  const closePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    setCurrentImageIndex(0); // Reset image index when closing
  };

  const resetCreatePost = () => {
    setShowCreatePost(false);
    setSelectedFiles([]);
    setMessage("");
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollDays(1);
    setMessageValidationError('');
  };

  const handlePost = async () => {
    // Reset validation error
    setMessageValidationError('');

    // Poll post: require a question + at least 2 non-empty options
    if (showPollCreator) {
      if (!pollQuestion.trim()) {
        setMessageValidationError('Please enter a poll question.');
        return;
      }
      const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setMessageValidationError('Please provide at least 2 poll options.');
        return;
      }
    } else {
      // Check if no content at all
      if (message.trim() === "" && selectedFiles.length === 0) return;
      // Check if photos are selected but message is empty
      if (selectedFiles.length > 0 && message.trim() === "") {
        setMessageValidationError('A message is required when posting photos or files.');
        return;
      }
    }
    
    try {
      setPosting(true);
      setError('');
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }

      if (showPollCreator) {
        // Post a poll via JSON endpoint
        const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
        const expiresAt = new Date(Date.now() + pollDays * 24 * 60 * 60 * 1000).toISOString();
        const response = await fetch(buildApiUrl(`feeds/poll?user_id=${encodeURIComponent(currentUserId)}`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            content: message.trim() || pollQuestion.trim(),
            user_id: currentUserId,
            poll: {
              question: pollQuestion.trim(),
              options: validOptions.map(text => ({ text, votes: 0, voters: [] })),
              expires_at: expiresAt
            }
          })
        });
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData || 'Failed to create poll');
        }
      } else {
        const formData = new FormData();
        formData.append('content', message.trim());
        formData.append('user_id', currentUserId);
        selectedFiles.forEach((fileObj) => {
          formData.append('files', fileObj.file, fileObj.file.name || fileObj.name || 'upload');
        });
        const response = await fetch(buildApiUrl(`feeds/?user_id=${encodeURIComponent(currentUserId)}`), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: formData
        });
        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error('Upload timed out. Try a smaller file or retry in a moment.');
          }
          throw new Error(errorData || 'Failed to create post');
        }
        selectedFiles.forEach(fileObj => { if (fileObj.preview) URL.revokeObjectURL(fileObj.preview); });
      }

      await loadFeeds();
      resetCreatePost();
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
        ? buildApiUrl(`feeds/${feedId}/unlike?user_id=${currentUserId}`)
        : buildApiUrl(`feeds/${feedId}/like?user_id=${currentUserId}`);
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
      await feedsAPI.deleteFeed(feedId);
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
    <FeedPageLayout userId={userId} feeds={feeds}>
      <>
      <div className="w-full px-2 sm:px-4 pt-2 sm:pt-4 pb-4 sm:pb-8">
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
  
          </div>
        )}

        {showCreatePost && (
          <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-gray-900 rounded-lg w-full max-w-sm sm:max-w-xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
              <div className="flex bg-white items-center justify-between p-3 sm:p-4 border-b border-gray-800">
                <h3 className="text-lg sm:text-xl font-bold text-black">Create post</h3>
                <button
                  onClick={resetCreatePost}
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
                              className="w-full h-auto max-h-48 object-contain rounded-lg bg-gray-100"
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
                <div className="mt-3 sm:mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  {/* Action toolbar */}
                  <div className="flex items-center gap-1 px-2 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs text-gray-500 font-medium mr-1">Add to post:</span>
                    <button
                      type="button"
                      onClick={() => { setShowPollCreator(false); fileInputRef.current?.click(); }}
                      title="Add Photos/PDF"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${showPollCreator ? 'text-gray-400 border-gray-200' : 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'}`}
                    >
                      <Image className="w-4 h-4 text-green-500" />
                      <span className="hidden sm:inline">Photo/PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPollCreator(p => !p); setSelectedFiles([]); }}
                      title="Create Poll"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${showPollCreator ? 'text-purple-700 bg-purple-100 border-purple-300' : 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100'}`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
                      <span>Poll</span>
                    </button>
                  </div>

                  {/* Poll creator UI */}
                  {showPollCreator && (
                    <div className="p-3 bg-white space-y-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Ask a question..."
                          value={pollQuestion}
                          onChange={e => setPollQuestion(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                        />
                      </div>
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Option ${i + 1}`}
                            value={opt}
                            onChange={e => setPollOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                          />
                          {pollOptions.length > 2 && (
                            <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 6 && (
                        <button type="button" onClick={() => setPollOptions(prev => [...prev, ''])}
                          className="text-purple-600 text-sm font-medium hover:underline flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                          Add option
                        </button>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500">Poll duration:</span>
                        {[1, 3, 7].map(d => (
                          <button key={d} type="button" onClick={() => setPollDays(d)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${pollDays === d ? 'bg-purple-600 text-white border-purple-600' : 'text-gray-600 border-gray-300 hover:border-purple-400'}`}>
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                  disabled={posting || (!showPollCreator && message.trim() === "" && selectedFiles.length === 0) || !!messageValidationError}
                  className={`w-full mt-3 sm:mt-4 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    posting || (!showPollCreator && message.trim() === "" && selectedFiles.length === 0) || !!messageValidationError
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {posting ? (
                    <div className="flex items-center justify-center">
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Posting...
                    </div>
                  ) : showPollCreator ? 'Post Poll' : 'Post'}
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

        {visibleFeeds.length === 0 && !loading && !error && (
          <div className="text-center py-6 sm:py-8 text-gray-400 text-sm sm:text-base px-4">
            {feedSearchQuery.trim() ? 'No posts match your search.' : 'No posts yet. Be the first to share something!'}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {visibleFeeds.map((feed) => {
            const currentUserId = getUserId() || localStorage.getItem('userId');
            const postForPermission = {
              ...feed,
              created_by: feed.created_by || feed.authorId || feed.creator_id || (feed.creator && feed.creator.id)
            };
            const userCanDeletePost = canDeletePost(userPermissions, postForPermission, currentUserId);
            const imgCount = feed.images?.length || 0;
            const authorName = feed.author || feed.creator_name || 'User';
            const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

            return (
              <div
                key={feed.id}
                className="bg-white rounded-xl overflow-hidden flex flex-col"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)' }}
              >
                {/* ── Post Header ── */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      {feed.author_photo ? (
                        <img
                          src={feed.author_photo}
                          alt={authorName}
                          className="w-full h-full object-cover"
                          onError={e => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span className="text-white text-sm font-bold" style={{ display: feed.author_photo ? 'none' : 'flex' }}>{initials}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-[15px] leading-tight">{authorName}</p>
                      <p className="text-xs text-gray-400 leading-tight mt-0.5">{feed.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {userCanDeletePost && (
                      <button
                        onClick={() => deletePost(feed.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete Post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Post Text with Read More ── */}
                {feed.text && (() => {
                  const isExpanded = expandedPosts.has(feed.id);
                  const lines = feed.text.split('\n');
                  const needsTruncate = lines.length > 5 || feed.text.length > 300;
                  const displayText = (!needsTruncate || isExpanded)
                    ? feed.text
                    : lines.slice(0, 5).join('\n').slice(0, 300);
                  return (
                    <div className="px-4 pb-3">
                      <p className="text-gray-800 text-[15px] leading-snug whitespace-pre-wrap">
                        {displayText}
                        {needsTruncate && !isExpanded && '…'}
                      </p>
                      {needsTruncate && (
                        <button
                          onClick={() => setExpandedPosts(prev => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(feed.id) : next.add(feed.id);
                            return next;
                          })}
                          className="text-[13px] font-semibold text-gray-500 hover:text-gray-700 mt-0.5"
                        >
                          {isExpanded ? 'See less' : 'See more'}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* ── Poll ── */}
                {feed.poll && (
                  <PollDisplay
                    poll={feed.poll}
                    postId={feed.id}
                    currentUserId={getUserId() || localStorage.getItem('userId')}
                    onPollUpdate={(updatedPoll) => {
                      setFeeds(prev => prev.map(f =>
                        f.id === feed.id ? { ...f, poll: updatedPoll } : f
                      ));
                    }}
                  />
                )}

                {/* ── Post Images — compact preview (full image on click) ── */}
                {imgCount > 0 && (
                  <div className="w-full">
                    {imgCount === 1 && (
                      <div
                        className="relative w-full cursor-pointer flex justify-center bg-gray-100"
                        onClick={() => openImageViewer(feed, feed.images, 0)}
                      >
                        <img src={feed.images[0]} alt="Post" className={feedImageClassName} loading="lazy" decoding="async" />
                      </div>
                    )}
                    {imgCount === 2 && (
                      <div className="flex flex-col gap-0.5 bg-gray-100">
                        {feed.images.map((img, i) => (
                          <div
                            key={i}
                            className="relative cursor-pointer flex justify-center bg-gray-100"
                            onClick={() => openImageViewer(feed, feed.images, i)}
                          >
                            <img src={img} alt={`Post ${i + 1}`} className={feedImageClassName} loading="lazy" decoding="async" />
                          </div>
                        ))}
                      </div>
                    )}
                    {imgCount === 3 && (
                      <div className="flex flex-col gap-0.5 bg-gray-100">
                        {feed.images.map((img, i) => (
                          <div
                            key={i}
                            className="relative cursor-pointer flex justify-center bg-gray-100"
                            onClick={() => openImageViewer(feed, feed.images, i)}
                          >
                            <img src={img} alt={`Post ${i + 1}`} className={feedImageClassName} loading="lazy" decoding="async" />
                          </div>
                        ))}
                      </div>
                    )}
                    {imgCount >= 4 && (
                      <div className="flex flex-col gap-0.5 bg-gray-100">
                        {feed.images.slice(0, 4).map((img, i) => (
                          <div
                            key={i}
                            className="relative cursor-pointer flex justify-center bg-gray-100"
                            onClick={() => openImageViewer(feed, feed.images, i)}
                          >
                            <img src={img} alt={`Post ${i + 1}`} className={feedImageClassName} loading="lazy" decoding="async" />
                            {i === 3 && imgCount > 4 && (
                              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                                <span className="text-white text-3xl font-bold">+{imgCount - 4}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Reaction & Comment Count Row ── */}
                {((feed.likes > 0) || (feed.comments?.length > 0)) && (
                  <div className="flex items-center justify-between px-4 pt-2 pb-1">
                    {feed.likes > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <ThumbsUp className="w-3 h-3 text-white fill-white" />
                        </span>
                        <span className="text-sm text-gray-500">{feed.likes}</span>
                      </div>
                    )}
                    {feed.comments?.length > 0 && (
                      <button
                        onClick={() => openPostModal(feed)}
                        className="text-sm text-gray-500 hover:underline ml-auto"
                      >
                        {feed.comments.length} comment{feed.comments.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Action Bar ── */}
                <div className="border-t border-gray-100 mx-1">
                  <div className="flex items-center">
                    {canLike && (
                      <button
                        onClick={() => toggleLike(feed.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg mx-0.5 my-1 text-sm font-semibold transition-colors ${
                          feed.liked
                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <ThumbsUp className={`w-[18px] h-[18px] transition-all ${feed.liked ? 'fill-blue-600 text-blue-600 scale-110' : ''}`} />
                        <span>{feed.liked ? 'Liked' : 'Like'}</span>
                      </button>
                    )}
                    {canLike && canComment && (
                      <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
                    )}
                    {canComment && (
                      <button
                        onClick={() => openPostModal(feed)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg mx-0.5 my-1 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <MessageCircle className="w-[18px] h-[18px]" />
                        <span>Comment</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Facebook-style Photo Viewer — image left, comments/likes right */}
      {showImageViewer && viewerFeed && viewerImages.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col lg:flex-row">
          {/* Left: full image area */}
          <div className="relative flex-1 min-h-[42vh] lg:min-h-0 bg-black flex items-center justify-center">
            <button
              type="button"
              onClick={closeImageViewer}
              className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {viewerImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 text-gray-900 flex items-center justify-center hover:bg-white shadow-lg"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 text-gray-900 flex items-center justify-center hover:bg-white shadow-lg"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  {currentImageIndex + 1} / {viewerImages.length}
                </div>
              </>
            )}

            <img
              src={viewerImages[currentImageIndex]}
              alt="Post"
              className="max-w-full max-h-full w-auto h-auto object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Right: post details + comments sidebar */}
          <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 bg-white flex flex-col max-h-[58vh] lg:max-h-full border-t lg:border-t-0 lg:border-l border-gray-200">
            {/* Post header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {(viewerFeed.author || viewerFeed.creator_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-[15px] truncate">{viewerFeed.author || viewerFeed.creator_name}</p>
                  <p className="text-xs text-gray-500">{viewerFeed.timestamp}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeImageViewer}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Post text */}
            {viewerFeed.text && (
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 max-h-32 overflow-y-auto">
                <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-snug">{viewerFeed.text}</p>
              </div>
            )}

            {/* Reactions summary */}
            {((viewerFeed.likes > 0) || (viewerFeed.comments?.length > 0)) && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                {viewerFeed.likes > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <ThumbsUp className="w-3 h-3 text-white fill-white" />
                    </span>
                    <span className="text-sm text-gray-600">{viewerFeed.likes}</span>
                  </div>
                )}
                {viewerFeed.comments?.length > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">
                    {viewerFeed.comments.length} comment{viewerFeed.comments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Like / Comment actions */}
            <div className="border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center px-1">
                {canLike && (
                  <button
                    type="button"
                    onClick={() => toggleLike(viewerFeed.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 mx-0.5 my-1 text-sm font-semibold rounded-lg transition-colors ${
                      viewerFeed.liked ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ThumbsUp className={`w-[18px] h-[18px] ${viewerFeed.liked ? 'fill-blue-600 text-blue-600' : ''}`} />
                    {viewerFeed.liked ? 'Liked' : 'Like'}
                  </button>
                )}
                {canLike && canComment && <div className="w-px h-6 bg-gray-200" />}
                {canComment && (
                  <button
                    type="button"
                    onClick={() => viewerCommentInputRef.current?.focus()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 mx-0.5 my-1 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MessageCircle className="w-[18px] h-[18px]" />
                    Comment
                  </button>
                )}
              </div>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              {viewerFeed.comments?.length > 0 ? (
                <CommentList
                  comments={viewerFeed.comments}
                  onLike={(commentId, parentId) => handleLikeComment(viewerFeed.id, commentId, parentId)}
                  onShowReplyBox={handleShowReplyBox}
                  onDeleteComment={handleDeleteComment}
                  replyBoxState={replyBoxState && replyBoxState.feedId === viewerFeed.id ? replyBoxState : null}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  handleReply={handleReply}
                  userName={userName}
                  userId={userId}
                  feedId={viewerFeed.id}
                  setReplyBoxState={setReplyBoxState}
                  expandedComments={expandedComments}
                  setExpandedComments={setExpandedComments}
                  likingComments={likingComments}
                />
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No comments yet. Be the first!</p>
              )}
            </div>

            {/* Comment input — sticky bottom */}
            {canComment && (
              <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-2 flex-shrink-0 bg-white">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 border border-gray-200">
                  <input
                    ref={viewerCommentInputRef}
                    type="text"
                    placeholder="Write a comment..."
                    value={commentTexts[viewerFeed.id] || ''}
                    onChange={(e) => setCommentTexts((prev) => ({ ...prev, [viewerFeed.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (commentTexts[viewerFeed.id] || '').trim()) {
                        handleComment(viewerFeed.id, commentTexts[viewerFeed.id]);
                        setCommentTexts((prev) => ({ ...prev, [viewerFeed.id]: '' }));
                      }
                    }}
                    className="w-full bg-transparent outline-none text-gray-900 placeholder-gray-400 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if ((commentTexts[viewerFeed.id] || '').trim()) {
                      handleComment(viewerFeed.id, commentTexts[viewerFeed.id]);
                      setCommentTexts((prev) => ({ ...prev, [viewerFeed.id]: '' }));
                    }
                  }}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-semibold flex-shrink-0"
                >
                  Post
                </button>
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

      </>
    </FeedPageLayout>
  );
}

// ── Right-panel widget: My Tasks ──
function MyTasksWidget({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const token = localStorage.getItem('token');
    fetch(`/api/tasks/?assigned_to=${encodeURIComponent(userId)}&user_id=${encodeURIComponent(userId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const items = data.items || data.tasks || data || [];
        setTasks(Array.isArray(items) ? items : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const counts = useMemo(() => {
    const ongoing = tasks.filter(t => ['pending','in_progress','assigned'].includes((t.status||'').toLowerCase())).length;
    const assisting = tasks.filter(t => (t.role||'') === 'assisting').length;
    const setByMe = tasks.filter(t => String(t.created_by||t.creator_id) === String(userId) && String(t.assigned_to) !== String(userId)).length;
    return { ongoing, assisting, setByMe };
  }, [tasks, userId]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="font-bold text-gray-800 text-sm">My Tasks</span>
        <button className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
        </button>
      </div>
      {loading ? (
        <div className="px-4 py-3 text-xs text-gray-400">Loading…</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {[
            { label: 'Ongoing', count: counts.ongoing },
            { label: 'Assisting', count: counts.assisting },
            { label: 'Set by me', count: counts.setByMe },
          ].map(row => (
            <li key={row.label} className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <span>{row.label}</span>
              <span className="font-semibold text-gray-900">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Right-panel widget: Popular Posts ──
function PopularPostsWidget({ feeds }) {
  const popular = useMemo(() => {
    return [...feeds]
      .sort((a, b) => ((b.likeCount||0) + (b.commentCount||0)) - ((a.likeCount||0) + (a.commentCount||0)))
      .slice(0, 3);
  }, [feeds]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-bold text-gray-800 text-sm">Popular Posts</span>
      </div>
      {popular.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400">No posts yet.</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {popular.map(post => {
            const authorName = post.author || post.creator_name || 'User';
            const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            return (
              <li key={post.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                  {post.author_photo
                    ? <img src={post.author_photo} alt={authorName} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                    : initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{authorName}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{post.text?.slice(0, 60) || '(media post)'}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                    <span>👍 {post.likeCount||0}</span>
                    <span>💬 {post.commentCount||0}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── 2-column Bitrix-style wrapper ──
function FeedPageLayout({ userId, feeds, children }) {
  return (
    <div className="h-screen bg-black flex gap-0 overflow-hidden">
      {/* Main feed column — scrollable */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>
      {/* Right panel — static, no scroll */}
      <div className="hidden lg:flex flex-col gap-4 w-[260px] shrink-0 px-3 pt-3 pb-6">
        <MyTasksWidget userId={userId} />
        <PopularPostsWidget feeds={feeds} />
      </div>
    </div>
  );
}
