from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class TargetType(str, Enum):
    ALL = "all"
    DEPARTMENT = "department"
    INDIVIDUAL = "individual"

class PopNotificationCreate(BaseModel):
    """Schema for creating a new global notification"""
    title: str = Field(..., min_length=1, max_length=200, description="Notification title")
    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    content: Optional[str] = Field(None, description="Rich content for the notification")
    priority: NotificationPriority = Field(default=NotificationPriority.NORMAL, description="Notification priority")
    target_type: TargetType = Field(default=TargetType.ALL, description="Type of targeting: all, department, or individual")
    target_departments: Optional[List[str]] = Field(default=[], description="List of department IDs (when target_type is 'department')")
    target_employees: Optional[List[str]] = Field(default=[], description="List of user IDs (when target_type is 'individual')")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata")
    
    class Config:
        schema_extra = {
            "example": {
                "title": "System Maintenance Notice",
                "message": "The system will be under maintenance tomorrow from 2 AM to 4 AM. Please save your work.",
                "content": "<p>The system will be under maintenance tomorrow from <strong>2 AM to 4 AM</strong>.</p><p>Please save your work and log out before the maintenance window.</p>",
                "priority": "high",
                "target_type": "department",
                "target_departments": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
                "target_employees": [],
                "metadata": {
                    "maintenance_window": "2024-01-15 02:00 - 04:00",
                    "affected_services": ["CRM", "Reports"]
                }
            }
        }

class AcceptedByUser(BaseModel):
    """Schema for users who accepted the notification"""
    user_id: str
    user_name: str
    accepted_at: datetime


class PendingUser(BaseModel):
    """Schema for users who have not yet accepted the notification"""
    user_id: str
    user_name: str

class AcceptanceStats(BaseModel):
    """Schema for notification acceptance statistics"""
    accepted_count: int
    pending_count: int
    total_users: int
    acceptance_rate: float

class PopNotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str = Field(..., alias="_id")
    title: str
    message: str
    content: Optional[str] = None
    priority: NotificationPriority
    target_type: TargetType = TargetType.ALL
    target_departments: Optional[List[str]] = []
    target_employees: Optional[List[str]] = []
    sender_id: str
    sender_name: str
    created_at: datetime
    is_active: bool
    accepted_by: List[AcceptedByUser] = []
    total_active_users: int = 0
    metadata: Dict[str, Any] = {}
    acceptance_stats: Optional[AcceptanceStats] = None
    deactivated_at: Optional[datetime] = None
    
    class Config:
        allow_population_by_field_name = True

class PopNotificationListResponse(BaseModel):
    """Schema for paginated notification list"""
    notifications: List[PopNotificationResponse]
    total: int
    page: int
    per_page: int
    total_pages: int

class PopNotificationAccept(BaseModel):
    """Schema for accepting a notification"""
    notification_id: str = Field(..., description="ID of the notification to accept")

class PopNotificationHistory(BaseModel):
    """Schema for notification history with detailed acceptance info"""
    id: str = Field(..., alias="_id")
    title: str
    message: str
    content: Optional[str] = None
    priority: NotificationPriority
    target_type: TargetType = TargetType.ALL
    target_departments: Optional[List[str]] = []
    target_employees: Optional[List[str]] = []
    sender_id: str
    sender_name: str
    created_at: datetime
    is_active: bool
    accepted_by: List[AcceptedByUser] = []
    total_active_users: int = 0
    metadata: Dict[str, Any] = {}
    acceptance_stats: AcceptanceStats
    pending_users: List[PendingUser] = []
    deactivated_at: Optional[datetime] = None
    
    class Config:
        allow_population_by_field_name = True

class PopNotificationUpdate(BaseModel):
    """Schema for updating a notification"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    message: Optional[str] = Field(None, min_length=1, max_length=1000)
    content: Optional[str] = None
    priority: Optional[NotificationPriority] = None
    target_type: Optional[TargetType] = None
    target_departments: Optional[List[str]] = None
    target_employees: Optional[List[str]] = None
    is_active: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None

class PopNotificationStats(BaseModel):
    """Schema for overall notification statistics"""
    total_notifications: int
    active_notifications: int
    inactive_notifications: int
    avg_acceptance_rate: float
    recent_notifications: List[PopNotificationResponse]

class UserNotificationStatus(BaseModel):
    """Schema for user's notification status"""
    user_id: str
    pending_notifications: List[PopNotificationResponse]
    accepted_count: int
    total_sent: int

class NotificationDeactivate(BaseModel):
    """Schema for deactivating a notification"""
    reason: Optional[str] = Field(None, description="Reason for deactivation")
    
    class Config:
        schema_extra = {
            "example": {
                "reason": "Maintenance completed early"
            }
        }