// Generate HTML for comments
function generateCommentsHTML(comments, postId) {
    if (!comments || comments.length === 0) {
        return `
            <div class="comments-container">
                <p class="text-muted text-center my-3">No comments yet</p>
            </div>
            <div class="comment-form mt-3">
                <div class="d-flex">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random" 
                         class="avatar" style="width: 32px; height: 32px;">
                    <div class="flex-grow-1 ms-2">
                        <textarea class="form-control form-control-sm comment-input" 
                                  placeholder="Write a comment..."></textarea>
                        <div class="d-flex justify-content-end mt-2">
                            <button class="btn btn-primary btn-sm" 
                                    onclick="addComment('${postId}', this)">Comment</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    console.log('Generating HTML for comments:', comments);
    let html = '<div class="comments-container">';

    comments.forEach(comment => {
        // Handle missing comment ID
        if (!comment.id && comment._id) {
            console.warn('Comment has no id property but has _id - fixing');
            comment.id = comment._id;
        }

        if (!comment.id) {
            console.error('Comment is missing ID:', comment);
            return; // Skip this comment
        }

        // Make sure user_name exists
        const userName = comment.user_name || 'Unknown User';

        const canEdit = comment.can_edit || comment.created_by === currentUser.id;

        html += `
            <div class="comment" data-id="${comment.id}">
                <div class="d-flex">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random" 
                         class="avatar" style="width: 32px; height: 32px;">
                    <div class="ms-2 flex-grow-1">
                        <div class="d-flex align-items-center">
                            <h6 class="mb-0">${userName}</h6>
                            <small class="text-muted ms-2">${formatDate(comment.created_at)}</small>
                        </div>
                        <p class="mb-0">${comment.content}</p>
                        ${canEdit ? `
                        <div class="comment-actions">
                            <button class="btn btn-sm btn-link text-primary p-0" 
                                    onclick="openEditCommentModal('${comment.id}', '${comment.content.replace(/'/g, "\\'")}')">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-link text-danger p-0" 
                                    onclick="openDeleteConfirmModal('${comment.id}', 'comment')">
                                Delete
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Add comment form
    html += `
        <div class="comment-form mt-3">
            <div class="d-flex">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random" 
                     class="avatar" style="width: 32px; height: 32px;">
                <div class="flex-grow-1 ms-2">
                    <textarea class="form-control form-control-sm comment-input" 
                              placeholder="Write a comment..."></textarea>
                    <div class="d-flex justify-content-end mt-2">
                        <button class="btn btn-primary btn-sm" 
                                onclick="addComment('${postId}', this)">Comment</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}
