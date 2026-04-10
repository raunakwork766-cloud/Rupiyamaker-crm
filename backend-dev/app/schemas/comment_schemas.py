from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId


class CommentBase(BaseModel):
    employee_id: str = Field(..., description="ID of the employee")
    content: str = Field(..., description="Content of the comment")
    created_by: str = Field(..., description="ID of the user who created the comment")
    created_by_name: str = Field(..., description="Name of the user who created the comment")


class CommentCreate(CommentBase):
    pass


class CommentUpdate(BaseModel):
    content: Optional[str] = Field(None, description="Updated content of the comment")


class CommentInDB(CommentBase):
    id: str = Field(alias="_id", description="MongoDB ObjectId as string")
    created_at: datetime = Field(..., description="When the comment was created")
    updated_at: Optional[datetime] = Field(None, description="When the comment was last updated")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class CommentResponse(BaseModel):
    id: str = Field(alias="_id", description="MongoDB ObjectId as string")
    employee_id: str = Field(..., description="ID of the employee")
    content: str = Field(..., description="Content of the comment")
    created_by: str = Field(..., description="ID of the user who created the comment")
    created_by_name: str = Field(..., description="Name of the user who created the comment")
    created_at: datetime = Field(..., description="When the comment was created")
    updated_at: Optional[datetime] = Field(None, description="When the comment was last updated")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
