from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None

class DepartmentInDB(DepartmentBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class DepartmentWithChildren(DepartmentInDB):
    children: List["DepartmentWithChildren"] = []

# Required for self-referencing models
DepartmentWithChildren.update_forward_refs()