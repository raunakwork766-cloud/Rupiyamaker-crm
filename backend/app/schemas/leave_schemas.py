from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from enum import Enum

class LeaveStatus(str, Enum):
    """Leave status enumeration"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class LeaveType(str, Enum):
    """Leave type enumeration"""
    PAID_LEAVE = "paid_leave"
    CASUAL_LEAVE = "casual_leave"
    SICK_LEAVE = "sick_leave"
    EMERGENCY_LEAVE = "emergency_leave"

class AttachmentSchema(BaseModel):
    """Schema for leave attachments"""
    attachment_id: Optional[str] = None
    filename: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_at: Optional[datetime] = None

class LeaveCreateSchema(BaseModel):
    """Schema for creating a new leave application"""
    leave_type: LeaveType = Field(..., description="Type of leave")
    from_date: date = Field(..., description="Leave start date")
    to_date: date = Field(..., description="Leave end date")
    reason: str = Field(..., min_length=5, max_length=500, description="Reason for leave")
    attachments: List[str] = Field(default=[], description="List of attachment file paths")
    
    @validator('to_date')
    def validate_to_date(cls, v, values):
        if 'from_date' in values and v < values['from_date']:
            raise ValueError('To date must be after or equal to from date')
        return v
    
    @validator('from_date')
    def validate_from_date(cls, v):
        # Allow past dates for testing/backdated leave applications
        # if v < date.today():
        #     raise ValueError('Leave cannot be applied for past dates')
        return v

class LeaveUpdateSchema(BaseModel):
    """Schema for updating leave application"""
    leave_type: Optional[LeaveType] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    reason: Optional[str] = Field(None, min_length=5, max_length=500)
    attachments: Optional[List[str]] = None
    
    @validator('to_date')
    def validate_to_date(cls, v, values):
        if v and 'from_date' in values and values['from_date'] and v < values['from_date']:
            raise ValueError('To date must be after or equal to from date')
        return v

class LeaveApprovalSchema(BaseModel):
    """Schema for approving/rejecting leave"""
    status: LeaveStatus = Field(..., description="New status (approved/rejected)")
    rejection_reason: Optional[str] = Field(None, description="Reason for rejection if status is rejected")
    comments: Optional[str] = Field(None, description="Additional comments for approval/rejection")
    
    @validator('rejection_reason')
    def validate_rejection_reason(cls, v, values):
        if values.get('status') == LeaveStatus.REJECTED and not v:
            raise ValueError('Rejection reason is required when rejecting a leave')
        return v

class LeaveResponseSchema(BaseModel):
    """Schema for leave response"""
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    leave_type: LeaveType
    from_date: date
    to_date: date
    duration_days: int
    reason: str
    status: LeaveStatus
    attachments: List[Dict[str, Any]] = []
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejected_by_name: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    approval_comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class LeaveListResponseSchema(BaseModel):
    """Schema for leave list response"""
    leaves: List[LeaveResponseSchema]
    total: int
    page: int
    per_page: int
    total_pages: int

class LeaveStatsSchema(BaseModel):
    """Schema for leave statistics"""
    pending: int = 0
    approved: int = 0
    rejected: int = 0
    total: int = 0

class LeaveFilterSchema(BaseModel):
    """Schema for leave filtering"""
    status: Optional[LeaveStatus] = None
    leave_type: Optional[LeaveType] = None
    employee_id: Optional[str] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    search: Optional[str] = None  # Search in employee name and reason

class EmployeeLeaveBalance(BaseModel):
    """Schema for employee leave balance"""
    employee_id: str
    employee_name: str
    paid_leave_balance: int = 0
    casual_leave_balance: int = 0
    sick_leave_balance: int = 0
    emergency_leave_balance: int = 0
    total_leaves_taken: int = 0
    pending_leaves: int = 0
