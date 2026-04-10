from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

# OTP Schemas
class OTPCreate(BaseModel):
    user_id: str
    
class OTPVerify(BaseModel):
    user_id: str
    otp_code: str

class OTPResponse(BaseModel):
    success: bool
    message: str
    expires_at: Optional[datetime] = None

# Email Settings Schemas
class EmailSettingCreate(BaseModel):
    email: EmailStr
    password: str
    smtp_server: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587
    use_ssl: Optional[bool] = True
    is_active: Optional[bool] = True
    purpose: Optional[str] = "otp"

class EmailSettingUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    use_ssl: Optional[bool] = None
    is_active: Optional[bool] = None
    purpose: Optional[str] = None

class EmailSettingInDB(BaseModel):
    id: str = Field(alias="_id")
    email: str
    smtp_server: str
    smtp_port: int
    use_ssl: bool
    is_active: bool
    purpose: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True

# Enhanced User Login Schema with OTP
class UserLoginWithOTP(BaseModel):
    username_or_email: str
    password: str
    otp_code: Optional[str] = None  # OTP code if required

# OTP Required Update Schema
class OTPRequiredUpdate(BaseModel):
    otp_required: bool

# Admin Email Management Schemas
class AdminEmailCreate(BaseModel):
    email: str

class AdminEmailUpdate(BaseModel):
    email: Optional[str] = None

class AdminEmailInDB(BaseModel):
    id: str = Field(alias="_id")
    email: str
    receive_otp: bool = True
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
