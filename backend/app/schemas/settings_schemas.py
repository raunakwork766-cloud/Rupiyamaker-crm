from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.utils.common_utils import ObjectIdStr
from app.schemas.attendance_schemas import AttendanceSettings, AttendanceSettingsUpdate

# ============= Campaign Names Schemas =============

class CampaignNameBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Campaign name")
    description: Optional[str] = Field(None, max_length=500, description="Campaign description")
    is_active: bool = Field(True, description="Whether the campaign is active")

class CampaignNameCreate(CampaignNameBase):
    pass

class CampaignNameUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Campaign name")
    description: Optional[str] = Field(None, max_length=500, description="Campaign description")
    is_active: Optional[bool] = Field(None, description="Whether the campaign is active")

class CampaignNameInDB(CampaignNameBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============= Data Codes Schemas =============

class DataCodeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Data code")
    description: Optional[str] = Field(None, max_length=500, description="Data code description")
    is_active: bool = Field(True, description="Whether the data code is active")

class DataCodeCreate(DataCodeBase):
    pass

class DataCodeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="Data code")
    description: Optional[str] = Field(None, max_length=500, description="Data code description")
    is_active: Optional[bool] = Field(None, description="Whether the data code is active")

class DataCodeInDB(DataCodeBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============= Bank Names Schemas =============

class BankNameBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Bank name")
    full_name: Optional[str] = Field(None, max_length=200, description="Full bank name")
    code: Optional[str] = Field(None, max_length=20, description="Bank code")
    is_active: bool = Field(True, description="Whether the bank is active")

class BankNameCreate(BankNameBase):
    pass

class BankNameUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Bank name")
    full_name: Optional[str] = Field(None, max_length=200, description="Full bank name")
    code: Optional[str] = Field(None, max_length=20, description="Bank code")
    is_active: Optional[bool] = Field(None, description="Whether the bank is active")

class BankNameInDB(BankNameBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============= Company Data Schemas =============

class CompanyDataBase(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200, description="Company name")
    categories: List[str] = Field(default_factory=list, description="List of company categories")
    bank_names: List[str] = Field(default_factory=list, description="List of associated bank names")
    is_active: bool = Field(True, description="Whether the company data is active")

class CompanyDataCreate(CompanyDataBase):
    pass

class CompanyDataUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=1, max_length=200, description="Company name")
    categories: Optional[List[str]] = Field(None, description="List of company categories")
    bank_names: Optional[List[str]] = Field(None, description="List of associated bank names")
    is_active: Optional[bool] = Field(None, description="Whether the company data is active")

class CompanyDataInDB(CompanyDataBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============= Channel Names Schemas =============

class ChannelNameBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Channel name")
    description: Optional[str] = Field(None, max_length=500, description="Channel description")
    is_active: bool = Field(True, description="Whether the channel is active")

class ChannelNameCreate(ChannelNameBase):
    pass

class ChannelNameUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Channel name")
    description: Optional[str] = Field(None, max_length=500, description="Channel description")
    is_active: Optional[bool] = Field(None, description="Whether the channel is active")

class ChannelNameInDB(ChannelNameBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============= Search and Upload Schemas =============

class CompanySearchRequest(BaseModel):
    company_name: str = Field(..., description="Company name to search for")
    similarity_threshold: float = Field(0.8, ge=0.0, le=1.0, description="Similarity threshold (0.0 to 1.0)")

    @validator('company_name')
    def validate_company_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Company name cannot be empty')
        if len(v.strip()) < 1:
            raise ValueError('Company name must be at least 1 character long')
        return v.strip()

class CompanySearchResult(BaseModel):
    company_name: str
    categories: List[str]
    bank_names: List[str]
    similarity_percentage: float

class ExcelUploadResponse(BaseModel):
    success: bool
    message: str
    stats: Optional[Dict[str, int]] = None

# ============= Settings Response Schemas =============

class SettingsDataResponse(BaseModel):
    campaign_names: List[CampaignNameInDB]
    data_codes: List[DataCodeInDB]
    bank_names: List[BankNameInDB]
    channel_names: List[ChannelNameInDB]
    company_data_count: int

class SettingsStatsResponse(BaseModel):
    total_campaigns: int
    active_campaigns: int
    total_data_codes: int
    active_data_codes: int
    total_banks: int
    active_banks: int
    total_channels: int
    active_channels: int
    total_companies: int
    active_companies: int

# ============= Channel Names Schemas =============

class ChannelNameBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Channel name")
    description: Optional[str] = Field(None, max_length=500, description="Channel description")
    is_active: bool = Field(True, description="Whether the channel is active")

class ChannelNameCreate(ChannelNameBase):
    pass

class ChannelNameUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Channel name")
    description: Optional[str] = Field(None, max_length=500, description="Channel description")
    is_active: Optional[bool] = Field(None, description="Whether the channel is active")

class ChannelNameInDB(ChannelNameBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============= Attachment Types Schemas =============

class AttachmentTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Attachment type name (e.g., 'Aadhar Card', 'PAN Card')")
    target_type: str = Field(..., description="Target type where this attachment can be used", pattern="^(leads|employees)$")
    sort_number: int = Field(..., ge=1, description="Sort order within the target type (1, 2, 3, etc.)")
    is_active: bool = Field(True, description="Whether the attachment type is active")
    description: Optional[str] = Field(None, max_length=500, description="Description of attachment type")

class AttachmentTypeCreate(AttachmentTypeBase):
    pass

class AttachmentTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Attachment type name")
    target_type: Optional[str] = Field(None, description="Target type where this attachment can be used", pattern="^(leads|employees)$")
    sort_number: Optional[int] = Field(None, ge=1, description="Sort order within the target type (1, 2, 3, etc.)")
    is_active: Optional[bool] = Field(None, description="Whether the attachment type is active")
    description: Optional[str] = Field(None, max_length=500, description="Description of attachment type")

class AttachmentTypeInDB(BaseModel):
    id: str = Field(alias="_id")
    name: str = Field(..., min_length=1, max_length=100, description="Attachment type name")
    target_type: str = Field(..., description="Target type where this attachment can be used", pattern="^(leads|employees)$")
    sort_number: Optional[int] = Field(None, ge=1, description="Sort order within the target type (1, 2, 3, etc.)")
    is_active: bool = Field(True, description="Whether the attachment type is active")
    description: Optional[str] = Field(None, max_length=500, description="Description of attachment type")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
