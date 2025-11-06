from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class TicketStatus(str, Enum):
    """Ticket status enumeration"""
    OPEN = "open"
    CLOSED = "closed"
    FAILED = "failed"

class TicketPriority(str, Enum):
    """Ticket priority enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class AttachmentSchema(BaseModel):
    """Schema for ticket attachments"""
    attachment_id: Optional[str] = None
    filename: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by: str
    uploaded_at: Optional[datetime] = None

class CommentSchema(BaseModel):
    """Schema for ticket comments"""
    comment_id: Optional[str] = None
    content: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

class TicketCreateSchema(BaseModel):
    """Schema for creating a new ticket"""
    subject: str = Field(..., min_length=1, max_length=200, description="Ticket subject")
    description: str = Field(..., min_length=1, description="Detailed description of the issue")
    priority: TicketPriority = Field(default=TicketPriority.MEDIUM, description="Ticket priority")
    assigned_users: List[str] = Field(default=[], description="List of user IDs assigned to this ticket")
    tags: List[str] = Field(default=[], description="Tags for categorization")
    
    @validator('assigned_users')
    def validate_assigned_users(cls, v):
        if not isinstance(v, list):
            raise ValueError('assigned_users must be a list')
        return v

class TicketUpdateSchema(BaseModel):
    """Schema for updating a ticket"""
    subject: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    priority: Optional[TicketPriority] = None
    assigned_users: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[TicketStatus] = None

class TicketResponseSchema(BaseModel):
    """Schema for ticket response"""
    id: str = Field(..., alias="_id")
    subject: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    created_by: str
    created_by_name: Optional[str] = None
    assigned_users: List[str] = []
    assigned_users_details: List[Dict[str, Any]] = []
    tags: List[str] = []
    comments: List[CommentSchema] = []
    attachments: List[AttachmentSchema] = []
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    close_reason: Optional[str] = None
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class TicketListResponseSchema(BaseModel):
    """Schema for listing tickets"""
    tickets: List[TicketResponseSchema]
    total: int
    page: int
    per_page: int
    total_pages: int

class CommentCreateSchema(BaseModel):
    """Schema for creating a comment"""
    content: str = Field(..., min_length=1, description="Comment content")

class CommentResponseSchema(BaseModel):
    """Schema for comment response"""
    comment_id: str
    content: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class TicketAssignSchema(BaseModel):
    """Schema for assigning users to a ticket"""
    user_ids: List[str] = Field(..., description="List of user IDs to assign")
    
    @validator('user_ids')
    def validate_user_ids(cls, v):
        if not isinstance(v, list) or len(v) == 0:
            raise ValueError('user_ids must be a non-empty list')
        return v

class TicketCloseSchema(BaseModel):
    """Schema for closing a ticket"""
    reason: Optional[str] = Field(None, description="Reason for closing the ticket")

class TicketStatsSchema(BaseModel):
    """Schema for ticket statistics"""
    open: int = 0
    closed: int = 0
    total: int = 0

class UserAssignmentSchema(BaseModel):
    """Schema for user assignment display"""
    user_id: str
    name: str
    email: Optional[str] = None
    role_name: Optional[str] = None
    department_name: Optional[str] = None

class TicketFilterSchema(BaseModel):
    """Schema for ticket filtering"""
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    tags: Optional[List[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None  # Search in subject and description

class TicketPermissions(BaseModel):
    """Schema for ticket permissions"""
    show: bool = Field(True, description="Can view tickets")
    own: bool = Field(True, description="Can view own tickets")
    junior: bool = Field(False, description="Can view and manage subordinate tickets")
    all: bool = Field(False, description="Can view and manage all tickets")
    delete: bool = Field(False, description="Can delete tickets")
