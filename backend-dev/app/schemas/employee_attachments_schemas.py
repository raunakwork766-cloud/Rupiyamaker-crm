from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class EmployeeAttachmentBase(BaseModel):
    employee_id: str = Field(..., description="ID of the employee")
    attachment_type: str = Field(..., description="Type of attachment")
    description: Optional[str] = Field(None, description="Description of the attachment")
    is_password_protected: bool = Field(False, description="Whether the attachment is password protected")

class EmployeeAttachmentCreate(EmployeeAttachmentBase):
    pass

class EmployeeAttachmentUpdate(BaseModel):
    attachment_type: Optional[str] = Field(None, description="Type of attachment")
    description: Optional[str] = Field(None, description="Description of the attachment")
    is_password_protected: Optional[bool] = Field(None, description="Whether the attachment is password protected")

class EmployeeAttachmentInDB(EmployeeAttachmentBase):
    id: str = Field(alias="_id")
    file_name: str = Field(..., description="Stored filename")
    original_file_name: str = Field(..., description="Original filename")
    file_path: str = Field(..., description="Path to the file")
    file_size: int = Field(..., description="Size of the file in bytes")
    file_type: str = Field(..., description="MIME type of the file")
    uploaded_by: str = Field(..., description="ID of the user who uploaded the file")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
