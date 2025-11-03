"""
Ticket Management Routes

This module handles all ticket-related operations including:
- Creating, updating, and deleting tickets
- Viewing tickets based on user permissions
- Adding comments and attachments
- Assigning users to tickets
- Closing and reopening tickets

Permission Rules:
- Users with "ticket:view" permission can see all tickets
- Other users can only see tickets they created or are assigned to
- Only admins or users with "ticket:edit" permission can close tickets
- Anyone can create tickets and add comments to tickets they have access to
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.security import HTTPBearer
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime

from app.database.Tickets import TicketsDB
from app.database.Users import UsersDB  
from app.database.Roles import RolesDB
from app.database.Notifications import NotificationsDB
from app.database import get_database_instances
from app.utils.database_dependencies import (
    get_tickets_db, get_users_db, get_roles_db, get_notifications_db
)
from app.schemas.ticket_schemas import (
    TicketCreateSchema, TicketUpdateSchema, TicketResponseSchema,
    TicketListResponseSchema, CommentCreateSchema, CommentResponseSchema,
    TicketAssignSchema, TicketCloseSchema, TicketStatsSchema,
    UserAssignmentSchema, TicketFilterSchema
)
from app.utils.permissions import PermissionManager
from app.utils.common_utils import get_current_user_id

router = APIRouter(prefix="/tickets", tags=["tickets"])
security = HTTPBearer()

# Database instances are now properly injected via dependencies





# File upload configuration
UPLOAD_DIR = "media/tickets"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 
    'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'
}

def ensure_upload_dir():
    """Ensure upload directory exists"""
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

async def get_user_details(user_id: str, users_db: UsersDB):
    """Get user details for display"""
    user = await users_db.get_user(user_id)
    if user:
        # Format user name (first_name + last_name)
        first_name = user.get("first_name", "")
        last_name = user.get("last_name", "")
        name = f"{first_name} {last_name}".strip()
        if not name:
            name = user.get("username", "Unknown")
        
        return {
            "id": user_id,
            "name": name,
            "profile_pic": user.get("profile_pic")
        }
    return {"id": user_id, "name": "Unknown"}

async def create_ticket_notifications(ticket_data: dict, assigned_users: list, created_by: str, created_by_name: str, notifications_db: NotificationsDB):
    """Create notifications for users assigned to a ticket"""
    for user_id in assigned_users:
        # Skip notification for the creator
        if user_id != created_by:
            try:
                await notifications_db.create_ticket_notification(
                    user_id=user_id,
                    ticket_data=ticket_data,
                    created_by=created_by,
                    created_by_name=created_by_name
                )
                print(f"[DEBUG] Created ticket notification for user {user_id}")
            except Exception as e:
                print(f"[ERROR] Failed to create notification for user {user_id}: {e}")

async def enrich_ticket_data(ticket: Dict[str, Any], users_db: UsersDB, user_lookup: Dict[str, Dict] = None) -> Dict[str, Any]:
    """Enrich ticket data with user details (optimized with lookup dict)"""
    if user_lookup is None:
        user_lookup = {}
    
    # Get creator details
    if ticket.get("created_by"):
        if ticket["created_by"] in user_lookup:
            ticket["created_by_name"] = user_lookup[ticket["created_by"]].get("name")
        else:
            creator_details = await get_user_details(ticket["created_by"], users_db)
            ticket["created_by_name"] = creator_details.get("name")
    
    # Get assigned users details
    assigned_details = []
    for user_id in ticket.get("assigned_users", []):
        if user_id in user_lookup:
            assigned_details.append(user_lookup[user_id])
        else:
            user_details = await get_user_details(user_id, users_db)
            assigned_details.append(user_details)
    ticket["assigned_users_details"] = assigned_details
    
    # Enrich comments with user names
    for comment in ticket.get("comments", []):
        if comment.get("created_by"):
            if comment["created_by"] in user_lookup:
                comment["created_by_name"] = user_lookup[comment["created_by"]].get("name")
            else:
                user_details = await get_user_details(comment["created_by"], users_db)
                comment["created_by_name"] = user_details.get("name")
    
    return ticket

async def batch_get_user_details(user_ids: set, users_db: UsersDB) -> Dict[str, Dict]:
    """Batch fetch user details for multiple users"""
    from bson import ObjectId
    
    # Filter valid ObjectIds
    valid_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
    
    if not valid_ids:
        return {}
    
    # Fetch all users in one query with projection
    users_cursor = users_db.collection.find(
        {"_id": {"$in": valid_ids}},
        {"_id": 1, "first_name": 1, "last_name": 1, "username": 1, "profile_pic": 1}
    )
    users = await users_cursor.to_list(None)
    
    # Create lookup dictionary
    user_lookup = {}
    for user in users:
        user_id = str(user["_id"])
        first_name = user.get("first_name", "")
        last_name = user.get("last_name", "")
        name = f"{first_name} {last_name}".strip()
        if not name:
            name = user.get("username", "Unknown")
        
        user_lookup[user_id] = {
            "id": user_id,
            "name": name,
            "profile_pic": user.get("profile_pic")
        }
    
    return user_lookup

@router.post("/", response_model=TicketResponseSchema)
async def create_ticket(
    ticket_data: TicketCreateSchema,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Create a new ticket
    
    Any authenticated user can create a ticket.
    The creator will automatically have access to view and comment on the ticket.
    """
    try:
        # Get user details for created_by_name
        user_details = await get_user_details(current_user_id, users_db)
        user_name = user_details.get("name", "Unknown")
        
        # Prepare ticket data
        ticket_dict = ticket_data.dict()
        ticket_dict["created_by"] = current_user_id
        ticket_dict["created_by_name"] = user_name
        ticket_dict["status"] = "open"
        
        # Validate assigned users exist
        for user_id in ticket_dict.get("assigned_users", []):
            if not await users_db.get_user(user_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with ID {user_id} not found"
                )
        
        # Create the ticket
        ticket_id = await tickets_db.create_ticket(ticket_dict)
        
        # Get the created ticket
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create ticket"
            )
        
        # Enrich with user details
        ticket = await enrich_ticket_data(ticket, users_db)
        
        return TicketResponseSchema(**ticket)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ticket: {str(e)}"
        )

@router.get("/", response_model=TicketListResponseSchema)
async def list_tickets(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    ticket_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user"),
    created_by: Optional[str] = Query(None, description="Filter by creator"),
    search: Optional[str] = Query(None, description="Search in subject and description"),
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List tickets based on user permissions (OPTIMIZED)
    
    - Users with "ticket:view" permission can see all tickets
    - Other users can only see tickets they created or are assigned to
    - All filtering done at database level for maximum performance
    """
    # Check permission to view tickets - explicit check first
    await PermissionManager.check_permission(current_user_id, "tickets", "show", users_db, roles_db)
    
    try:
        # Get user permissions
        permissions = await PermissionManager.get_user_permissions(
            current_user_id, users_db, roles_db
        )
        
        # Build database-level filters (OPTIMIZATION: moved from Python to MongoDB)
        additional_filters = {}
        
        if ticket_status:
            additional_filters["status"] = ticket_status
        
        if priority:
            additional_filters["priority"] = priority
        
        if assigned_to:
            additional_filters["assigned_users"] = assigned_to
        
        if created_by:
            additional_filters["created_by"] = created_by
        
        if search:
            search_pattern = {"$regex": search, "$options": "i"}
            additional_filters["$or"] = [
                {"subject": search_pattern},
                {"description": search_pattern}
            ]
        
        # Field projection for list view (OPTIMIZATION: reduce data transfer)
        list_projection = {
            "_id": 1,
            "subject": 1,
            "description": 1,
            "status": 1,
            "priority": 1,
            "created_by": 1,
            "created_by_name": 1,
            "assigned_users": 1,
            "tags": 1,
            "created_at": 1,
            "updated_at": 1
            # Exclude: comments, attachments, history (heavy fields)
        }
        
        # Calculate skip for pagination
        skip = (page - 1) * per_page
        
        # Get tickets with all filters at database level (OPTIMIZATION)
        tickets, total = await tickets_db.get_tickets_for_user(
            current_user_id, 
            permissions,
            additional_filters=additional_filters,
            skip=skip,
            limit=per_page,
            projection=list_projection
        )
        
        # Calculate total pages
        total_pages = (total + per_page - 1) // per_page
        
        # Collect all unique user IDs for batch fetching (OPTIMIZATION)
        all_user_ids = set()
        for ticket in tickets:
            if ticket.get("created_by"):
                all_user_ids.add(ticket["created_by"])
            all_user_ids.update(ticket.get("assigned_users", []))
        
        # Batch fetch all user details (OPTIMIZATION: one query instead of N)
        user_lookup = await batch_get_user_details(all_user_ids, users_db)
        
        # Enrich tickets with user details using lookup dict
        enriched_tickets = []
        for ticket in tickets:
            enriched_ticket = await enrich_ticket_data(ticket, users_db, user_lookup)
            enriched_tickets.append(TicketResponseSchema(**enriched_ticket))
        
        return TicketListResponseSchema(
            tickets=enriched_tickets,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list tickets: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list tickets: {str(e)}"
        )

@router.get("/{ticket_id}", response_model=TicketResponseSchema)
async def get_ticket(
    ticket_id: str,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get a specific ticket
    
    Users can only access tickets they created, are assigned to, 
    or have "ticket:view" permission for.
    """
    try:
        # Get the ticket
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check permissions
        permissions = await PermissionManager.get_user_permissions(
            current_user_id, users_db, roles_db
        )
        
        # Check if user has ticket:view permission (can see all tickets)
        has_view_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "show", users_db, roles_db, raise_error=False
        )
        
        # Check if user can access this specific ticket
        can_access = (
            has_view_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this ticket"
            )
        
        # Enrich with user details
        ticket = await enrich_ticket_data(ticket, users_db)
        
        return TicketResponseSchema(**ticket)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ticket: {str(e)}"
        )

@router.put("/{ticket_id}", response_model=TicketResponseSchema)
async def update_ticket(
    ticket_id: str,
    ticket_data: TicketUpdateSchema,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Update a ticket
    
    Users can update tickets they created or are assigned to.
    Users with "ticket:edit" permission can update any ticket.
    """
    try:
        # Get the ticket
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check permissions
        has_edit_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "junior", users_db, roles_db, raise_error=False
        )
        
        can_edit = (
            has_edit_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_edit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit this ticket"
            )
        
        # Prepare update data
        update_data = ticket_data.dict(exclude_unset=True)
        
        # Validate assigned users if provided
        if "assigned_users" in update_data:
            for user_id in update_data["assigned_users"]:
                if not await users_db.get_user(user_id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"User with ID {user_id} not found"
                    )
        
        # Update the ticket
        user_details = await get_user_details(current_user_id, users_db)
        user_name = user_details.get("name", "Unknown")
        
        # Create action details for history
        details_list = []
        if "subject" in update_data:
            details_list.append(f"Subject: {update_data['subject']}")
        if "priority" in update_data:
            details_list.append(f"Priority: {update_data['priority']}")
        if "assigned_users" in update_data:
            # Get assigned user names
            assigned_names = []
            for user_id in update_data["assigned_users"]:
                user_details_assigned = await get_user_details(user_id, users_db)
                assigned_names.append(user_details_assigned.get("name", "Unknown"))
            details_list.append(f"Assigned to: {', '.join(assigned_names)}")
        
        action_details = ", ".join(details_list) if details_list else "Ticket updated"
        
        success = await tickets_db.update_ticket(ticket_id, update_data, user_name, action_details)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update ticket"
            )
        
        # Get updated ticket
        updated_ticket = await tickets_db.get_ticket(ticket_id)
        updated_ticket = await enrich_ticket_data(updated_ticket, users_db)
        
        return TicketResponseSchema(**updated_ticket)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update ticket: {str(e)}"
        )

@router.post("/{ticket_id}/comments", response_model=CommentResponseSchema)
async def add_comment(
    ticket_id: str,
    comment_data: CommentCreateSchema,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Add a comment to a ticket
    
    Users can add comments to tickets they have access to.
    """
    try:
        # Get the ticket
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check if user can access this ticket
        has_view_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "show", users_db, roles_db, raise_error=False
        )
        
        can_access = (
            has_view_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to comment on this ticket"
            )
        
        # Get user details for response and history
        user_details = await get_user_details(current_user_id, users_db)
        user_name = user_details.get("name", "Unknown")
        
        # Prepare comment data
        comment = {
            "content": comment_data.content,
            "created_by": current_user_id
        }
        
        # Add comment to ticket with history logging
        success = await tickets_db.add_comment(ticket_id, comment, user_name)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add comment"
            )
        
        # Prepare response data
        comment["created_by_name"] = user_name
        comment["created_at"] = datetime.now()
        
        return CommentResponseSchema(**comment)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment: {str(e)}"
        )

@router.post("/{ticket_id}/attachments")
async def upload_attachment(
    ticket_id: str,
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Upload an attachment to a ticket
    
    Users can upload attachments to tickets they have access to.
    """
    try:
        # Get the ticket
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check if user can access this ticket
        has_view_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "show", users_db, roles_db, raise_error=False
        )
        
        can_access = (
            has_view_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to upload attachments to this ticket"
            )
        
        # Validate file
        if not allowed_file(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Check file size
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        # Ensure upload directory exists
        ensure_upload_dir()
        
        # Generate unique filename
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Prepare attachment data
        attachment = {
            "filename": file.filename,
            "file_path": file_path,
            "file_size": len(file_content),
            "mime_type": file.content_type,
            "uploaded_by": current_user_id
        }
        
        # Add attachment to ticket
        success = await tickets_db.add_attachment(ticket_id, attachment)
        if not success:
            # Clean up file if database update failed
            try:
                os.remove(file_path)
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add attachment"
            )
        
        return {
            "message": "Attachment uploaded successfully",
            "filename": file.filename,
            "file_size": len(file_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload attachment: {str(e)}"
        )

@router.post("/{ticket_id}/close")
async def close_ticket(
    ticket_id: str,
    close_data: TicketCloseSchema,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Close a ticket
    
    Users with "ticket:edit" permission, ticket creators, or assigned users can close tickets.
    """
    try:
        # Get the ticket first to check assignment
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check permissions - allow users with edit permission, creators, or assigned users
        has_edit_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "junior", users_db, roles_db, raise_error=False
        )
        
        can_close = (
            has_edit_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_close:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to close this ticket"
            )
        
        if ticket.get("status") in ["closed", "failed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket is already closed or failed"
            )
        
        # Close the ticket with history logging
        user_details = await get_user_details(current_user_id, users_db)
        user_name = user_details.get("name", "Unknown")
        
        success = await tickets_db.close_ticket(
            ticket_id, 
            current_user_id, 
            user_name,
            close_data.reason
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to close ticket"
            )
        
        return {"message": "Ticket closed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close ticket: {str(e)}"
        )

@router.post("/{ticket_id}/reopen")
async def reopen_ticket(
    ticket_id: str,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Reopen a closed ticket
    
    Users with "ticket:edit" permission, ticket creators, or assigned users can reopen tickets.
    """
    try:
        # Get the ticket first to check assignment
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check permissions - allow users with edit permission, creators, or assigned users
        has_edit_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "junior", users_db, roles_db, raise_error=False
        )
        
        can_reopen = (
            has_edit_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_reopen:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to reopen this ticket"
            )
        
        if ticket.get("status") not in ["closed", "failed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket is not closed or failed"
            )
        
        # Reopen the ticket with history logging
        user_details = await get_user_details(current_user_id, users_db)
        user_name = user_details.get("name", "Unknown")
        
        success = await tickets_db.reopen_ticket(ticket_id, user_name)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reopen ticket"
            )
        
        return {"message": "Ticket reopened successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reopen ticket: {str(e)}"
        )

@router.get("/stats/overview", response_model=TicketStatsSchema)
async def get_ticket_stats(
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get ticket statistics
    
    Users see stats for tickets they have access to.
    Users with "ticket:view" permission see stats for all tickets.
    """
    try:
        # Check if user has view all permission
        has_view_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "show", users_db, roles_db, raise_error=False
        )
        
        if has_view_permission:
            # Get stats for all tickets
            stats = await tickets_db.get_ticket_statistics()
        else:
            # Get stats for user's tickets only
            stats = await tickets_db.get_ticket_statistics(current_user_id)
        
        return TicketStatsSchema(**stats)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ticket statistics: {str(e)}"
        )

@router.get("/users/assignable", response_model=List[UserAssignmentSchema])
async def get_assignable_users(
    current_user_id: str = Depends(get_current_user_id),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Get list of users that can be assigned to tickets
    
    Returns all active users in the system.
    """
    try:
        # Get all users
        users = await users_db.list_users({"status": {"$ne": "inactive"}})
        
        assignable_users = []
        for user in users:
            user_details = await get_user_details(str(user["_id"]))
            assignable_users.append(UserAssignmentSchema(**user_details))
        
        return assignable_users
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get assignable users: {str(e)}"
        )

@router.get("/{ticket_id}/history")
async def get_ticket_history(
    ticket_id: str,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get the history of a ticket
    
    Users can get history for tickets they have access to.
    """
    try:
        # Get the ticket to check permissions
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check if user can access this ticket
        has_view_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "show", users_db, roles_db, raise_error=False
        )
        
        can_access = (
            has_view_permission or
            ticket.get("created_by") == current_user_id or
            current_user_id in ticket.get("assigned_users", [])
        )
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this ticket's history"
            )
        
        # Get ticket history
        history = await tickets_db.get_ticket_history(ticket_id)
        
        # Format history for response
        formatted_history = []
        for item in history:
            formatted_item = {
                "id": item.get("history_id"),
                "user": item.get("user_name", "Unknown"),
                "action": item.get("action", ""),
                "details": item.get("details", ""),
                "time": item.get("timestamp").isoformat() if item.get("timestamp") else ""
            }
            formatted_history.append(formatted_item)
        
        return {"history": formatted_history}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ticket history: {str(e)}"
        )

@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    current_user_id: str = Depends(get_current_user_id),
    tickets_db: TicketsDB = Depends(get_tickets_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Delete a ticket
    
    Only users with "ticket:delete" permission, super admins, or the ticket creator can delete tickets.
    """
    try:
        # Get the ticket first to check ownership
        ticket = await tickets_db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Check permissions - allow users with delete permission or creators
        has_delete_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "delete", users_db, roles_db, raise_error=False
        )
        
        # Also check if user has junior (edit) permission as a fallback
        has_junior_permission = await PermissionManager.check_permission(
            current_user_id, "tickets", "junior", users_db, roles_db, raise_error=False
        )
        
        can_delete = (
            has_delete_permission or
            has_junior_permission or
            ticket.get("created_by") == current_user_id
        )
        
        if not can_delete:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this ticket"
            )
        
        # Delete the ticket
        success = await tickets_db.delete_ticket(ticket_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete ticket"
            )
        
        return {"message": "Ticket deleted successfully", "ticket_id": ticket_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete ticket: {str(e)}"
        )
