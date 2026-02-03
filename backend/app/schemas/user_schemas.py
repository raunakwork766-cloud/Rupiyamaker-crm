from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, EmailStr, validator
from datetime import datetime, date

class UserBase(BaseModel):
    first_name: str  # Required
    last_name: str   # Required
    username: Optional[str] = None  # Optional for updates, required for new users
    email: Optional[EmailStr] = None  # Optional
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: bool = True  # Default: True (active users can login)
    login_enabled: bool = True  # Default: True (login is enabled by default)
    phone: Optional[str] = None
    otp_required: bool = True  # Default: True (OTP required for login by default)
    
class UserCreate(UserBase):
    username: str  # Required for new users
    password: str  # Required for new users
    
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: Optional[bool] = None  # Toggle user active status
    login_enabled: Optional[bool] = None  # Toggle login access
    phone: Optional[str] = None
    password: Optional[str] = None
    otp_required: Optional[bool] = None  # Toggle OTP requirement
    profile_photo: Optional[str] = None  # Profile photo path
    
class UserInDB(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    profile_photo: Optional[str] = None  # Profile photo path
    
    @validator('email', pre=True)
    def empty_string_to_none(cls, v):
        """Convert empty strings to None for email fields"""
        if v == '':
            return None
        return v
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        
class UserLogin(BaseModel):
    username_or_email: str
    password: str

# Employee Address Schemas
class EmployeeAddress(BaseModel):
    address: str
    pincode: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    address_type: str  # "permanent" or "current"
    
class EmergencyContact(BaseModel):
    name: str
    phone: str
    relationship: Optional[str] = None  # Use "relationship" to match API response

# Enhanced Employee Schemas with all requested fields
class EmployeeCreate(BaseModel):
    # Required fields only
    first_name: str  # Required
    last_name: str   # Required
    username: str    # Required for new employees
    password: Optional[str] = None  # Required for new employees when password permission is available
    
    # Optional basic fields
    email: Optional[EmailStr] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: bool = True
    login_enabled: bool = False  # Default false for new employees
    phone: Optional[str] = None
    otp_required: bool = True
    
    # Personal Information - Enhanced
    dob: Optional[date] = None
    gender: Optional[str] = None  # male, female, other
    marital_status: Optional[str] = None  # single, married, divorced, widowed
    nationality: str = "Indian"
    blood_group: Optional[str] = None  # A+, A-, B+, B-, AB+, AB-, O+, O-
    
    # New fields from the updated form
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    current_city: Optional[str] = None
    highest_qualification: Optional[str] = None
    experience_level: Optional[str] = None  # Fresher, Experienced
    
    # Employment Details - Enhanced
    employee_id: Optional[str] = None  # Auto-generated or provided
    joining_date: Optional[date] = None
    designation: Optional[str] = None
    salary: Optional[float] = None
    monthly_target: Optional[float] = None
    incentive: Optional[str] = None
    
    # Banking Details
    salary_account_number: Optional[str] = None
    salary_ifsc_code: Optional[str] = None
    salary_bank_name: Optional[str] = None
    
    # Work Email (separate from personal email)
    work_email: Optional[EmailStr] = None
    
    # Emergency Contact (legacy single contact for backward compatibility)
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None  # Legacy field name
    emergency_contact_relationship: Optional[str] = None  # New standardized field name
    
    # Address Information (structured format)
    permanent_address: Optional[EmployeeAddress] = None
    current_address: Optional[EmployeeAddress] = None
    
    # Legacy and compatibility fields
    profile_photo: Optional[str] = None
    mac_address: Optional[str] = None
    mac_addresses: Optional[List[str]] = None  # Multiple MAC addresses support
    personal_email: Optional[EmailStr] = None  # Separate from main email field
    alternate_phone: Optional[str] = None
    addresses: Optional[List[EmployeeAddress]] = None  # Legacy addresses array
    emergency_contacts: Optional[List[EmergencyContact]] = None  # New structured emergency contacts
    probation_period: Optional[int] = None  # in months
    
    # System Access and Status
    crm_access: bool = False
    login_enabled: bool = False
    employee_status: str = "active"  # active or inactive
    onboarding_status: str = "pending"  # pending, in_progress, completed
    onboarding_remark: Optional[str] = None
    status_remark: Optional[str] = None
    
    # Employee Type and Hierarchy
    is_employee: bool = True
    employment_type: str = "full-time"  # full-time, part-time, contract
    reporting_manager_id: Optional[str] = None
    
class EmployeeUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None
    
    # Personal Information - Enhanced
    dob: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    blood_group: Optional[str] = None
    
    # New fields from the updated form
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    current_city: Optional[str] = None
    highest_qualification: Optional[str] = None
    experience_level: Optional[str] = None
    
    # Employment Details - Enhanced
    employee_id: Optional[str] = None
    joining_date: Optional[date] = None
    designation: Optional[str] = None
    salary: Optional[float] = None
    monthly_target: Optional[float] = None
    incentive: Optional[str] = None
    
    # Banking Details
    salary_account_number: Optional[str] = None
    salary_ifsc_code: Optional[str] = None
    salary_bank_name: Optional[str] = None
    
    # Work Email
    work_email: Optional[EmailStr] = None
    
    # Emergency Contact (legacy single contact and new standardized field)
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None  # Legacy field name
    emergency_contact_relationship: Optional[str] = None  # New standardized field name
    
    # Address Information
    permanent_address: Optional[EmployeeAddress] = None
    current_address: Optional[EmployeeAddress] = None
    
    # Legacy and compatibility fields
    profile_photo: Optional[str] = None
    mac_address: Optional[str] = None
    mac_addresses: Optional[List[str]] = None
    personal_email: Optional[EmailStr] = None
    alternate_phone: Optional[str] = None
    addresses: Optional[List[EmployeeAddress]] = None
    emergency_contacts: Optional[List[EmergencyContact]] = None
    probation_period: Optional[int] = None
    
    # System Access and Status
    crm_access: Optional[bool] = None
    login_enabled: Optional[bool] = None
    employee_status: Optional[str] = None
    onboarding_status: Optional[str] = None
    onboarding_remark: Optional[str] = None
    status_remark: Optional[str] = None
    
    # Employee Type and Hierarchy
    employment_type: Optional[str] = None
    reporting_manager_id: Optional[str] = None

# Password Change Schema
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class PasswordResetRequest(BaseModel):
    new_password: str
    confirm_password: str
    
class EmployeeStatusUpdate(BaseModel):
    status: str  # active or inactive
    remark: Optional[str] = None
    
class OnboardingStatusUpdate(BaseModel):
    status: str  # pending, in_progress, completed
    remark: Optional[str] = None
    
class CrmAccessUpdate(BaseModel):
    has_access: bool
    
class LoginStatusUpdate(BaseModel):
    enabled: bool
    
class OtpRequirementUpdate(BaseModel):
    required: bool
    
class EmployeeInDB(BaseModel):
    id: str = Field(alias="_id")
    username: str
    email: Optional[str] = None
    first_name: str
    last_name: str
    
    @validator('email', pre=True)
    def empty_string_to_none(cls, v):
        """Convert empty strings to None for email fields"""
        if v == '':
            return None
        return v
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: bool = True
    phone: Optional[str] = None
    
    # Personal Information - Enhanced with all fields from JSON
    dob: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    blood_group: Optional[str] = None
    
    # Additional personal fields
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    current_city: Optional[str] = None
    highest_qualification: Optional[str] = None
    experience_level: Optional[str] = None
    
    # Employment Details
    employee_id: Optional[str] = None
    joining_date: Optional[date] = None
    designation: Optional[str] = None
    salary: Optional[float] = None
    monthly_target: Optional[float] = None
    incentive: Optional[str] = None
    
    # Banking Details
    salary_account_number: Optional[str] = None
    salary_ifsc_code: Optional[str] = None
    salary_bank_name: Optional[str] = None
    
    # Work Email
    work_email: Optional[EmailStr] = None
    
    # Emergency Contact (both legacy and new fields for compatibility)
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None  # Legacy field name
    emergency_contact_relationship: Optional[str] = None  # New standardized field name
    
    # Address Information
    permanent_address: Optional[EmployeeAddress] = None
    current_address: Optional[EmployeeAddress] = None
    
    # Legacy and compatibility fields
    profile_photo: Optional[str] = None
    mac_address: Optional[str] = None
    mac_addresses: Optional[List[str]] = None
    personal_email: Optional[EmailStr] = None
    alternate_phone: Optional[str] = None
    addresses: Optional[List[EmployeeAddress]] = None
    emergency_contacts: Optional[List[EmergencyContact]] = None
    probation_period: Optional[int] = None
    
    # System Access and Status
    crm_access: bool = False
    login_enabled: bool = False
    employee_status: str = "active"
    onboarding_status: str = "pending"
    onboarding_remark: Optional[str] = None
    status_remark: Optional[str] = None
    
    # Employee Type and Hierarchy
    is_employee: bool = True
    employment_type: str = "full-time"
    reporting_manager_id: Optional[str] = None
    
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

# Comprehensive Employee Schema for detailed responses
class ComprehensiveEmployeeInDB(EmployeeInDB):
    """Comprehensive employee schema with all fields for detailed employee management"""
    
    # Explicitly include all comprehensive fields to ensure they're not filtered
    mac_address: Optional[str] = None
    personal_email: Optional[str] = None
    
    @validator('personal_email', pre=True)
    def empty_personal_email_to_none(cls, v):
        """Convert empty strings to None for personal_email fields"""
        if v == '':
            return None
        return v
    
    @validator('work_email', pre=True)
    def empty_work_email_to_none(cls, v):
        """Convert empty strings to None for work_email fields"""
        if v == '':
            return None
        return v
    alternate_phone: Optional[str] = None
    addresses: Optional[List[EmployeeAddress]] = None
    emergency_contacts: Optional[List[EmergencyContact]] = None
    probation_period: Optional[int] = None
    employment_type: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    
    # Ensure all address and employment fields are included
    permanent_address: Optional[EmployeeAddress] = None
    current_address: Optional[EmployeeAddress] = None
    
    # Explicitly add the missing fields that weren't being saved
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    highest_qualification: Optional[str] = None
    experience_level: Optional[str] = None
    monthly_target: Optional[float] = None
    incentive: Optional[str] = None
    work_email: Optional[EmailStr] = None
    salary_account_number: Optional[str] = None
    salary_ifsc_code: Optional[str] = None
    salary_bank_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    current_city: Optional[str] = None  # Separate from address city
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

# OTP Related Schemas
class OTPRequiredUpdate(BaseModel):
    otp_required: bool