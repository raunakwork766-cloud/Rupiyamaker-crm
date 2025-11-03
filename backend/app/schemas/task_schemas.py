from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date, time
from enum import Enum
from app.utils.common_utils import ObjectIdStr

class TaskType(str, Enum):
    TODO = "To-Do"
    CALL = "Call"
    PENDENCY = "Pendency"
    PROCESSING = "Processing"
    COMPLETED = "Completed"

class TaskStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class TaskPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    URGENT = "Urgent"

class TaskAttachmentBase(BaseModel):
    """Base model for task attachments"""
    file_name: str
    file_path: str
    file_type: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None

class TaskAttachmentCreate(TaskAttachmentBase):
    """Model for creating task attachments"""
    task_id: str
    uploaded_by: str

class TaskAttachmentInDB(BaseModel):
    """Model for embedded task attachments"""
    id: str = Field(alias="_id", description="Attachment ID")
    file_name: str
    file_path: str
    file_type: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by: Union[ObjectIdStr, str]
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectIdStr: str}

class TaskBase(BaseModel):
    """Base model for tasks"""
    subject: str = Field(..., min_length=1, max_length=200, description="Task subject")
    task_details: Optional[str] = Field(None, max_length=2000, description="Detailed task description")
    task_type: TaskType = Field(TaskType.TODO, description="Type of task")
    status: TaskStatus = Field(TaskStatus.PENDING, description="Task status")
    priority: TaskPriority = Field(TaskPriority.MEDIUM, description="Task priority")
    
    # Date and time fields - using strings to avoid MongoDB encoding issues
    due_date: Optional[str] = Field(None, description="Due date for the task (YYYY-MM-DD)")
    due_time: Optional[str] = Field(None, description="Due time for the task (HH:MM:SS)")
    
    # Assignment fields
    assigned_to: List[str] = Field(default_factory=list, description="List of user IDs assigned to this task")
    
    # Lead and loan type relationship
    lead_id: Optional[str] = Field(None, description="Related lead ID")
    loan_type: Optional[str] = Field(None, description="Loan type for filtering related leads")
    
    # Additional fields
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    is_urgent: bool = Field(False, description="Mark as urgent task")
    
    @validator('assigned_to')
    def validate_assigned_to(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            return [v]
        return v

class RecurringConfig(BaseModel):
    """Model for recurring task configuration"""
    pattern: str = Field(..., description="Recurring pattern: daily, weekly, monthly, yearly")
    interval: int = Field(1, description="Interval for the pattern, e.g. every 2 days")
    start_date: Optional[str] = Field(None, description="Start date for recurring tasks")
    end_date: Optional[str] = Field(None, description="End date for recurring tasks")
    weekdays: Optional[List[str]] = Field(None, description="Specific weekdays for custom recurring tasks")

class TaskCreate(TaskBase):
    """Model for creating new tasks"""
    created_by: str = Field(..., description="User ID who created the task")
    is_recurring: Optional[bool] = Field(False, description="Whether this is a recurring task")
    recurring_config: Optional[RecurringConfig] = Field(None, description="Configuration for recurring tasks")
    
    class Config:
        schema_extra = {
            "example": {
                "subject": "Follow up with client",
                "task_details": "Call client to discuss loan application status and next steps",
                "task_type": "Call",
                "status": "Pending",
                "priority": "Medium",
                "due_date": "2024-12-31",
                "due_time": "10:00:00",
                "assigned_to": ["user123", "user456"],
                "lead_id": "lead789",
                "loan_type": "Personal Loan",
                "notes": "Client prefers morning calls",
                "is_urgent": False,
                "created_by": "user123"
            }
        }

class TaskUpdate(BaseModel):
    """Model for updating existing tasks"""
    subject: Optional[str] = Field(None, min_length=1, max_length=200)
    task_details: Optional[str] = Field(None, max_length=2000)
    task_type: Optional[TaskType] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    assigned_to: Optional[List[str]] = None
    lead_id: Optional[str] = None
    loan_type: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)
    is_urgent: Optional[bool] = None
    is_recurring: Optional[bool] = None
    recurring_config: Optional[RecurringConfig] = None
    parent_recurring_task_id: Optional[str] = None
    next_occurrence: Optional[str] = None
    
    @validator('assigned_to')
    def validate_assigned_to(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return [v]
        return v

class TaskInDB(TaskBase):
    """Model for tasks stored in database"""
    id: ObjectIdStr = Field(alias="_id")
    created_by: ObjectIdStr
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[ObjectIdStr] = None
    
    # Embedded attachments
    attachments: List[TaskAttachmentInDB] = Field(default_factory=list, description="Embedded task attachments")
    
    # Soft delete fields
    is_deleted: bool = Field(False)
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[ObjectIdStr] = None
    
    # Completion tracking
    completed_at: Optional[datetime] = None
    completed_by: Optional[ObjectIdStr] = None
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectIdStr: str}

class TaskResponse(BaseModel):
    """Response model for task operations"""
    id: str
    subject: str
    task_details: Optional[str]
    task_type: TaskType
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[str]
    due_time: Optional[str]
    assigned_to: List[str]
    lead_id: Optional[str]
    loan_type: Optional[str]
    notes: Optional[str]
    is_urgent: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    # Additional response fields
    creator_name: Optional[str] = None
    assigned_users: List[Dict[str, Any]] = Field(default_factory=list)
    lead_info: Optional[Dict[str, Any]] = None
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class TaskFilterRequest(BaseModel):
    """Model for task filtering requests"""
    task_type: Optional[TaskType] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    loan_type: Optional[str] = None
    due_date_from: Optional[str] = None
    due_date_to: Optional[str] = None
    is_urgent: Optional[bool] = None
    search: Optional[str] = None  # For searching in subject and task_details
    
class PaginatedTaskResponse(BaseModel):
    """Paginated response for task listings"""
    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool

class TaskStatsResponse(BaseModel):
    """Response model for task statistics"""
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    overdue_tasks: int
    urgent_tasks: int
    my_tasks: int
    assigned_to_me: int
    
class TaskBulkUpdateRequest(BaseModel):
    """Model for bulk task updates"""
    task_ids: List[str] = Field(..., min_items=1)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to: Optional[List[str]] = None
    due_date: Optional[str] = None
    
class TaskCommentBase(BaseModel):
    """Base model for task comments"""
    comment: str = Field(..., min_length=1, max_length=1000)
    
class TaskCommentCreate(TaskCommentBase):
    """Model for creating task comments"""
    task_id: str
    created_by: str
    
class TaskCommentInDB(TaskCommentBase):
    """Model for task comments in database"""
    id: ObjectIdStr = Field(alias="_id")
    task_id: ObjectIdStr
    created_by: ObjectIdStr
    created_at: datetime
    updated_at: datetime
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectIdStr: str}
