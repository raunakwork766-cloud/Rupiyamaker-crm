from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from fastapi import UploadFile, Form, File

class FeedFile(BaseModel):
    filename: str
    file_path: str  # URL path to file
    file_type: str  # mime type or general type (image, document, etc)
    size: Optional[int] = None

class FeedBase(BaseModel):
    content: str
    files: Optional[List[FeedFile]] = []
    created_by: str  # User ID

class FeedCreate(BaseModel):
    content: str
    created_by: str

class FeedUpdate(BaseModel):
    content: Optional[str] = None
    
class FeedInDB(FeedBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    likes_count: int
    comments_count: int

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class LikeBase(BaseModel):
    feed_id: str
    user_id: str

class LikeCreate(LikeBase):
    pass

class LikeInDB(LikeBase):
    id: str = Field(alias="_id")
    created_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class CommentBase(BaseModel):
    feed_id: str
    content: str
    created_by: str  # User ID
    parent_id: Optional[str] = None  # ID of parent comment for replies

class CommentCreate(CommentBase):
    pass

class CommentUpdate(BaseModel):
    content: str

class CommentInDB(CommentBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int