from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class DesignationCreateSchema(BaseModel):
    """Schema for creating a new designation"""
    name: str = Field(..., description="Name of the designation")
    reporting_designation_id: Optional[str] = Field(None, description="ID of the designation this one reports to")
    description: Optional[str] = Field(None, description="Description of the designation")
    is_active: bool = Field(True, description="Whether this designation is active")


class DesignationUpdateSchema(BaseModel):
    """Schema for updating an existing designation"""
    name: Optional[str] = Field(None, description="Name of the designation")
    reporting_designation_id: Optional[str] = Field(None, description="ID of the designation this one reports to")
    description: Optional[str] = Field(None, description="Description of the designation")
    is_active: Optional[bool] = Field(None, description="Whether this designation is active")


class DesignationResponse(BaseModel):
    """Schema for designation response"""
    id: str = Field(..., alias="_id")
    name: str
    reporting_designation_id: Optional[str] = None
    reporting_designation_name: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

# Aliases for backward compatibility
DesignationCreate = DesignationCreateSchema
DesignationUpdate = DesignationUpdateSchema


class DesignationResponse(BaseModel):
    """Schema for designation response"""
    id: str = Field(..., alias="_id")
    name: str
    reporting_designation_id: Optional[str] = None
    reporting_designation_name: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
