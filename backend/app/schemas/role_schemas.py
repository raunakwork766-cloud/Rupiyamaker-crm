from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

class PermissionItem(BaseModel):
    page: str
    actions: Union[str, List[str]]  # Can be "*" (string) or ["create", "edit"] (list)

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    reporting_id: Optional[str] = None
    is_active: bool = True
    permissions: List[PermissionItem] = []

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    reporting_id: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[List[PermissionItem]] = None

class RoleInDB(RoleBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class RoleResponse(BaseModel):
    """Complete role response with all fields explicitly defined"""
    id: str
    name: str
    description: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    reporting_id: Optional[str] = None
    is_active: bool = True
    permissions: List[PermissionItem] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class RoleWithReports(RoleInDB):
    direct_reports: List["RoleWithReports"] = []

# Required for self-referencing models
RoleWithReports.update_forward_refs()

class PermissionConfig(BaseModel):
    page: str
    actions: Union[str, List[str]]  # Can be "*" (string) or ["create", "edit"] (list)

class PermissionCheck(BaseModel):
    role_id: str
    page: str
    action: str