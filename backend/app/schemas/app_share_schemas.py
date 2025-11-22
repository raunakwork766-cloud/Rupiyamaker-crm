from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AppShareLinkCreate(BaseModel):
    """Schema for creating a new app share link"""
    app_id: str = Field(..., description="ID of the app to share")
    expires_in_days: Optional[int] = Field(7, description="Number of days until expiration", ge=1, le=365)
    max_access_count: Optional[int] = Field(999, description="Maximum number of times the link can be accessed", ge=1)
    purpose: Optional[str] = Field("public_view", description="Purpose of the share link")
    recipient_email: Optional[str] = Field(None, description="Email of the recipient (optional)")
    base_url: Optional[str] = Field(None, description="Base URL for constructing complete URL")
    notes: Optional[str] = Field(None, description="Additional notes about the share link")


class AppShareLinkResponse(BaseModel):
    """Schema for app share link response"""
    id: str
    share_token: str
    app_id: str
    expires_at: datetime
    is_active: bool
    access_count: int
    max_access_count: int
    url: Optional[str] = None
    created_at: datetime
    notes: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AppShareLinkDetail(BaseModel):
    """Schema for detailed app share link information"""
    id: str
    share_token: str
    app_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    is_active: bool
    access_count: int
    max_access_count: int
    recipient_email: Optional[str] = None
    purpose: str
    notes: Optional[str] = None
    last_accessed_at: Optional[datetime] = None
    deactivated_by: Optional[str] = None
    deactivated_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AppShareLinkToggle(BaseModel):
    """Schema for toggling share link active status"""
    is_active: bool


class AppShareLinkStats(BaseModel):
    """Schema for app share link statistics"""
    total_links: int
    active_links: int
    total_accesses: int
    expired_links: int


class PublicAppResponse(BaseModel):
    """Schema for public app data response"""
    id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    html_content: str
    is_active: bool
    share_token: str
    expires_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
