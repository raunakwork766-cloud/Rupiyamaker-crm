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

# Enhanced User Login Schema with OTP
class UserLoginWithOTP(BaseModel):
    username_or_email: str
    password: str
    otp_code: Optional[str] = None  # OTP code if required

# OTP Required Update Schema
class OTPRequiredUpdate(BaseModel):
    otp_required: bool
