from fastapi import APIRouter, HTTPException, Depends, status as http_status, UploadFile, File, Form, Request, BackgroundTasks
from typing import List, Dict, Any, Optional
from app.database.Feeds import FeedsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database import get_database_instances
from app.schemas.feed_schemas import (
    FeedCreate, FeedUpdate, FeedInDB, CommentCreate, 
    CommentUpdate, CommentInDB, LikeInDB, PaginatedResponse
)
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.feed_utils import save_upload_file, get_relative_media_url
from app.utils.permissions import (
    check_permission, get_user_capabilities, has_permission,
    get_user_permissions
)
import math
import os
from pathlib import Path

# Create API router for feeds endpoints
router = APIRouter(
    prefix="/feeds",
    tags=["feeds"]
)

# Dependency to get DB instances
async def get_feeds_db():
    db_instances = get_database_instances()
    return db_instances["feeds"]
    
async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]
    
async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]


@router.post("/", response_model=Dict[str, str], status_code=http_status.HTTP_201_CREATED)
async def create_post(
    content: str = Form(...),
    files: List[UploadFile] = File(None),
    user_id: str = Form(...),
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new post with optional files"""
    # Verify user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Check permission - updated to use new modular permission structure
    try:
        await check_permission(user_id, "feeds", "post", users_db, roles_db)
    except HTTPException:
        # If lowercase check fails, try with capitalized "Feeds"
        await check_permission(user_id, "Feeds", "post", users_db, roles_db)
    
    # Create post first to get an ID
    post_data = {
        "content": content,
        "created_by": user_id,
        "files": []
    }
    
    post_id = await feeds_db.create_post(post_data)
    
    # Handle file uploads if any
    saved_files = []
    if files:
        # Create directory for this post
        media_dir = await feeds_db.create_media_path(post_id)
        
        for file in files:
            if not file.filename:
                continue
                
            # Save file
            file_data = await save_upload_file(file, media_dir)
            
            # Convert path to URL
            file_data["file_path"] = get_relative_media_url(file_data["file_path"])
            
            saved_files.append(file_data)
    
    # Update post with file references if any were uploaded
    if saved_files:
        await feeds_db.update_post(post_id, {"files": saved_files})
    
    return {"id": post_id}

@router.get("/", response_model=PaginatedResponse)
async def list_posts(
    page: int = 1,
    page_size: int = 20,
    user_id: Optional[str] = None,
    created_by: Optional[str] = None,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List posts with pagination
    - If user_id is provided, permissions are checked
    - If created_by is provided, only posts by that user are shown
    """
    # Check permission if user_id provided - updated to new permission structure
    if user_id:
        # Case insensitive check for "feeds" or "Feeds" and "show"
        try:
            await check_permission(user_id, "feeds", "show", users_db, roles_db)
        except HTTPException:
            # If lowercase check fails, try with capitalized "Feeds"
            await check_permission(user_id, "Feeds", "show", users_db, roles_db)
    
    # Set up filters
    filter_dict = {}
    if created_by:
        filter_dict["created_by"] = created_by
    
    # Calculate pagination
    skip = (page - 1) * page_size
    
    # Get posts
    posts = await feeds_db.list_posts(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size
    )
    
    # Get total count for pagination
    total_posts = await feeds_db.count_posts(filter_dict)
    
    # Enhance posts with user info and convert ObjectIds
    enhanced_posts = []
    for post in posts:
        post_dict = convert_object_id(post)
        
        # Make sure id is set (frontend uses post.id)
        if "_id" in post_dict:
            post_dict["id"] = post_dict["_id"]
        
        # Add user data
        post_creator = await users_db.get_user(post["created_by"])
        if post_creator:
            post_dict["creator_name"] = f"{post_creator.get('first_name', '')} {post_creator.get('last_name', '')}"
            post_dict["creator_username"] = post_creator.get("username", "")
        
        # Add like info if user_id provided
        if user_id:
            post_dict["liked_by_user"] = await feeds_db.has_user_liked_post(str(post["_id"]), user_id)
            
        enhanced_posts.append(post_dict)
    
    # Build response with pagination info
    total_pages = math.ceil(total_posts / page_size)
    
    return {
        "items": enhanced_posts,
        "total": total_posts,
        "page": page,
        "page_size": page_size,
        "pages": total_pages
    }

@router.get("/{post_id}", response_model=Dict[str, Any])
async def get_post(
    post_id: ObjectIdStr,
    user_id: Optional[str] = None,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get a specific post by ID
    - If user_id is provided, permissions are checked
    """
    # Check permission if user_id provided
    if user_id:
        try:
            await check_permission(user_id, "feeds", "show", users_db, roles_db)
        except HTTPException:
            # If lowercase check fails, try with capitalized "Feeds"
            await check_permission(user_id, "Feeds", "show", users_db, roles_db)
    
    post = await feeds_db.get_post(post_id)
    if not post:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found"
        )
    
    post_dict = convert_object_id(post)
    
    # Make sure id is set (frontend uses post.id)
    if "_id" in post_dict:
        post_dict["id"] = post_dict["_id"]
    
    # Add creator info
    post_creator = await users_db.get_user(post["created_by"])
    if post_creator:
        post_dict["creator_name"] = f"{post_creator.get('first_name', '')} {post_creator.get('last_name', '')}"
        post_dict["creator_username"] = post_creator.get("username", "")
    
    # Add like info if user_id provided
    if user_id:
        post_dict["liked_by_user"] = await feeds_db.has_user_liked_post(post_id, user_id)
    
    return post_dict

@router.put("/{post_id}", response_model=Dict[str, str])
async def update_post(
    post_id: ObjectIdStr,
    post_update: FeedUpdate,
    user_id: str,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a post (content only)"""
    # Check if post exists
    post = await feeds_db.get_post(post_id)
    if not post:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found"
        )
    
    # Check permission
    # User can edit if they have edit permission OR if they created the post
    has_edit_permission = await check_permission(user_id, "feeds", "feeds", users_db, roles_db, raise_error=False)
    can_edit = has_edit_permission or post["created_by"] == user_id
    
    if not can_edit:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this post"
        )
    
    # Update post
    update_data = {k: v for k, v in post_update.dict().items() if v is not None}
    success = await feeds_db.update_post(post_id, update_data)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update post"
        )
    
    return {"message": "Post updated successfully"}

@router.delete("/{post_id}", response_model=Dict[str, str])
async def delete_post(
    post_id: ObjectIdStr,
    user_id: str,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a post and its files, likes, comments"""
    # Check if post exists
    post = await feeds_db.get_post(post_id)
    if not post:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found"
        )
    
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, 
            detail=f"User with ID {user_id} not found"
        )
    
    # Get user role and permissions
    role = await roles_db.get_role(user.get("role_id", ""))
    
    # Check if user is super admin
    is_super_admin = False
    if role and role.get("permissions"):
        for perm in role.get("permissions", []):
            if perm.get("page") in ["*", "any"] and perm.get("actions") == "*":
                is_super_admin = True
                break
    
    # Check permission
    # User can delete if:
    # 1. They are a super admin
    # 2. They have explicit delete permission for feeds
    # 3. They created the post
    has_delete_permission = await check_permission(user_id, "feeds", "feeds", users_db, roles_db, raise_error=False)
    can_delete = is_super_admin or has_delete_permission or post["created_by"] == user_id
    
    if not can_delete:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this post"
        )
    
    # Delete post and related data
    success = await feeds_db.delete_post(post_id)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete post"
        )
    
    return {"message": "Post deleted successfully"}

@router.post("/{post_id}/like", response_model=Dict[str, str])
async def like_post(
    post_id: ObjectIdStr,
    user_id: str,
    request: Request,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Like a post"""
    # Check if post exists
    post = await feeds_db.get_post(post_id)
    if not post:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found"
        )
    
    # Check permission
    # Need view permission to like
    try:
        await check_permission(user_id, "feeds", "show", users_db, roles_db)
    except HTTPException:
        # If lowercase check fails, try with capitalized "Feeds"
        await check_permission(user_id, "Feeds", "show", users_db, roles_db)
    
    # Like post
    result = await feeds_db.like_post(post_id, user_id)
    
    if result == "already_liked":
        return {"message": "Post already liked"}
    elif result:
        return {"message": "Post liked successfully"}
    else:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to like post"
        )

@router.post("/{post_id}/unlike", response_model=Dict[str, str])
async def unlike_post(
    post_id: ObjectIdStr,
    user_id: str,
    request: Request,
    feeds_db: FeedsDB = Depends(get_feeds_db)
):
    """Unlike a previously liked post"""
    # Unlike post (no permission check needed - users can remove their own likes)
    result = await feeds_db.unlike_post(post_id, user_id)
    
    if result == "not_liked":
        return {"message": "Post was not liked"}
    elif result:
        return {"message": "Post unliked successfully"}
    else:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unlike post"
        )

@router.get("/{post_id}/likes", response_model=List[Dict[str, Any]])
async def get_post_likes(
    post_id: ObjectIdStr,
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[str] = None,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get users who liked a post"""
    # Check permission if user_id provided
    if user_id:
        try:
            await check_permission(user_id, "feeds", "show", users_db, roles_db)
        except HTTPException:
            # If lowercase check fails, try with capitalized "Feeds"
            await check_permission(user_id, "Feeds", "show", users_db, roles_db)
    
    # Get likes
    likes = await feeds_db.get_post_likes(post_id, skip, limit)
    
    # Enhance with user info
    enhanced_likes = []
    for like in likes:
        like_dict = convert_object_id(like)
        
        # Add user data
        user = await users_db.get_user(like["user_id"])
        if user:
            like_dict["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
            like_dict["username"] = user.get("username", "")
            
        enhanced_likes.append(like_dict)
    
    return enhanced_likes

@router.post("/{post_id}/comments", response_model=Dict[str, str])
async def add_comment(
    post_id: ObjectIdStr,
    comment: CommentCreate,
    user_id: Optional[str] = None,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Add a comment to a post"""
    # Check if post exists
    post = await feeds_db.get_post(post_id)
    if not post:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found"
        )
    
    # Use user_id from query param if provided and not in body
    if user_id and not comment.created_by:
        comment.created_by = user_id
    
    # Check permission
    # Need view permission to comment
    try:
        await check_permission(comment.created_by, "feeds", "show", users_db, roles_db)
    except HTTPException:
        # If lowercase check fails, try with capitalized "Feeds"
        await check_permission(comment.created_by, "Feeds", "show", users_db, roles_db)
    
    # Ensure feed_id in the URL and body match
    if comment.feed_id != post_id:
        comment.feed_id = post_id
    
    # Convert comment data to dict
    comment_data = comment.dict()
    
    # Log comment data for debugging
    print(f"Adding comment: {comment_data}")
    
    # Add comment
    comment_id = await feeds_db.add_comment(comment_data)
    
    if not comment_id:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add comment"
        )
    
    return {"id": comment_id}

@router.get("/{post_id}/comments", response_model=List[Dict[str, Any]])
async def get_post_comments(
    post_id: ObjectIdStr,
    skip: int = 0,
    limit: int = 20,
    user_id: str = None,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get comments for a post"""
    # Check permission if user_id provided
    if user_id:
        try:
            await check_permission(user_id, "feeds", "show", users_db, roles_db)
        except HTTPException:
            # If lowercase check fails, try with capitalized "Feeds"
            await check_permission(user_id, "Feeds", "show", users_db, roles_db)
    
    # Get comments
    comments = await feeds_db.get_post_comments(post_id, skip, limit)
    
    # Enhance with user info
    enhanced_comments = []
    for comment in comments:
        try:
            comment_dict = convert_object_id(comment)
            
            # Make sure id is set (frontend uses comment.id)
            if "_id" in comment_dict:
                comment_dict["id"] = comment_dict["_id"]
            
            # Add user data
            user = await users_db.get_user(comment["created_by"])
            if user:
                comment_dict["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
                comment_dict["username"] = user.get("username", "")
                
                # Add edit permission flag
                if user_id:
                    # User can edit their own comments
                    comment_dict["can_edit"] = (user_id == comment["created_by"])
                    
                    # Or if they have edit permission
                    if not comment_dict["can_edit"] and user_id:
                        has_edit_permission = await check_permission(user_id, "feeds", "feeds", users_db, roles_db, raise_error=False)
                        comment_dict["can_edit"] = has_edit_permission
            else:
                # Set default user name if user not found
                comment_dict["user_name"] = "Unknown User"
                comment_dict["username"] = "unknown"
            
            enhanced_comments.append(comment_dict)
        except Exception as e:
            print(f"Error processing comment {comment.get('_id', 'unknown')}: {e}")
            # Still include the comment, but with defaults
            try:
                comment_dict = convert_object_id(comment)
                if "_id" in comment_dict:
                    comment_dict["id"] = comment_dict["_id"]
                comment_dict["user_name"] = "Unknown User"
                comment_dict["username"] = "unknown"
                enhanced_comments.append(comment_dict)
            except:
                pass  # Skip this comment if we can't even convert it
    
    return enhanced_comments
    
    return enhanced_comments

@router.put("/comments/{comment_id}", response_model=Dict[str, str])
async def update_comment(
    comment_id: ObjectIdStr,
    comment_update: CommentUpdate,
    user_id: str,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a comment"""
    # Check if comment exists
    comment = await feeds_db.get_comment(comment_id)
    if not comment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Comment with ID {comment_id} not found"
        )
    
    # Check permission
    # User can edit if they have edit permission OR if they created the comment
    has_edit_permission = await check_permission(user_id, "feeds", "feeds", users_db, roles_db, raise_error=False)
    can_edit = has_edit_permission or comment["created_by"] == user_id
    
    if not can_edit:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this comment"
        )
    
    # Update comment
    update_data = {k: v for k, v in comment_update.dict().items() if v is not None}
    success = await feeds_db.update_comment(comment_id, update_data)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update comment"
        )
    
    return {"message": "Comment updated successfully"}

@router.delete("/comments/{comment_id}", response_model=Dict[str, str])
async def delete_comment(
    comment_id: ObjectIdStr,
    user_id: str,
    feeds_db: FeedsDB = Depends(get_feeds_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a comment"""
    # Check if comment exists
    comment = await feeds_db.get_comment(comment_id)
    if not comment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Comment with ID {comment_id} not found"
        )
    
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, 
            detail=f"User with ID {user_id} not found"
        )
    
    # Get user role and permissions
    role = await roles_db.get_role(user.get("role_id", ""))
    
    # Check if user is super admin
    is_super_admin = False
    if role and role.get("permissions"):
        for perm in role.get("permissions", []):
            if perm.get("page") in ["*", "any"] and perm.get("actions") == "*":
                is_super_admin = True
                break
    
    # Check permission
    # User can delete if:
    # 1. They are a super admin
    # 2. They have explicit delete permission for feeds
    # 3. They created the comment
    has_delete_permission = await check_permission(user_id, "feeds", "feeds", users_db, roles_db, raise_error=False)
    can_delete = is_super_admin or has_delete_permission or comment["created_by"] == user_id
    
    if not can_delete:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this comment"
        )
    
    # Delete comment
    success = await feeds_db.delete_comment(comment_id)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete comment"
        )
    
    return {"message": "Comment deleted successfully"}
