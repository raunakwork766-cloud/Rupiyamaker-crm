from typing import List, Dict, Optional, Any, Union, Set
from pydantic import BaseModel, Field, EmailStr, validator
from datetime import datetime
from enum import Enum

# ========= Enums =========



class LeadPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class DocumentStatus(str, Enum):
    required = "required"
    received = "received"
    under_review = "under_review"
    verified = "verified"
    invalid = "invalid"
    not_applicable = "not_applicable"

class FieldType(str, Enum):
    text = "text"
    textarea = "textarea"
    number = "number"
    select = "select"
    multi_select = "multi_select"
    date = "date"
    datetime = "datetime"
    boolean = "boolean"
    radio = "radio"
    checkbox = "checkbox"
    phone = "phone"
    email = "email"
    currency = "currency"
    percentage = "percentage"
    file = "file"

class ReportingOption(str, Enum):
    preserve = "preserve"
    reset = "reset"
    merge = "merge"

# ========= Address Schema =========

class AddressSchema(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    pincode: Optional[str] = None  # Added pincode field
    country: Optional[str] = None

# ========= Comprehensive Personal Information Schema =========

class PersonalDetailsSchema(BaseModel):
    occupation: Optional[str] = None
    employer_name: Optional[str] = None
    employment_type: Optional[str] = None
    years_of_experience: Optional[int] = None
    company_name: Optional[Union[str, List[str]]] = None  # Support both string and list
    company_type: Optional[Union[str, List[str]]] = None  # Support both string and list  
    company_category: Optional[Union[str, List[str], List[Dict[str, Any]]]] = None  # Support string, list of strings, or list of objects

class FinancialDetailsSchema(BaseModel):
    monthly_income: Optional[float] = None
    annual_income: Optional[float] = None
    partner_salary: Optional[float] = None
    yearly_bonus: Optional[float] = None
    bonus_division: Optional[int] = None
    foir_percent: Optional[int] = None
    bank_name: Optional[Union[str, List[str]]] = None  # Support both string and list
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    cibil_score: Optional[str] = None
    
    @validator('cibil_score', pre=True)
    def convert_cibil_score_to_string(cls, v):
        """Convert cibil_score to string if it's a number"""
        if v is None:
            return v
        return str(v)

class IdentityDetailsSchema(BaseModel):
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None

class EmergencyContactSchema(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    relation: Optional[str] = None

class ReferenceSchema(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    relation: Optional[str] = None

class ObligationSchema(BaseModel):
    product: Optional[str] = None
    bank_name: Optional[str] = None
    bankName: Optional[str] = None
    totalLoan: Optional[float] = None
    tenure: Optional[int] = None
    roi: Optional[float] = None
    total_loan: Optional[float] = None
    outstanding: Optional[float] = None
    emi: Optional[float] = None
    action: Optional[str] = None
    
    # Additional fields that may come from frontend
    transfer_to_proposed_bank: Optional[float] = None
    existing_emi: Optional[float] = None
    foirEmi: Optional[float] = None
    
    @validator('tenure', 'roi', 'total_loan', 'totalLoan', 'outstanding', 'emi', 
               'transfer_to_proposed_bank', 'existing_emi', 'foirEmi', pre=True)
    def parse_formatted_numbers(cls, v):
        """Parse formatted strings like '4,64,334' to numbers"""
        if v is None or v == '':
            return None
        if isinstance(v, (int, float)):
            return v
        if isinstance(v, str):
            # Remove commas and parse
            cleaned = v.replace(',', '').strip()
            if cleaned == '':
                return None
            try:
                # Try to parse as float first
                parsed = float(cleaned)
                return parsed
            except ValueError:
                return None
        return v

class CheckEligibilitySchema(BaseModel):
    company_category: Optional[str] = None
    foir_percent: Optional[int] = None
    custom_foir_percent: Optional[str] = None
    monthly_emi_can_pay: Optional[float] = None
    tenure_months: Optional[str] = None
    tenure_years: Optional[str] = None
    roi: Optional[str] = None
    multiplier: Optional[int] = None
    loan_eligibility_status: Optional[str] = None

class ProcessSchema(BaseModel):
    processing_bank: Optional[str] = None
    loan_amount_required: Optional[float] = None
    purpose_of_loan: Optional[str] = None
    how_to_process: Optional[str] = "None"
    loan_type: Optional[str] = None
    required_tenure: Optional[int] = None  # in months
    case_type: Optional[str] = "Normal"
    year: Optional[int] = None

class EligibilityDetailsSchema(BaseModel):
    totalIncome: Optional[str] = None
    foirAmount: Optional[str] = None
    totalObligations: Optional[str] = None
    totalBtPos: Optional[str] = None
    finalEligibility: Optional[str] = None
    multiplierEligibility: Optional[str] = None

class EligibilitySchema(BaseModel):
    total_income: Optional[float] = None
    foir_amount: Optional[float] = None
    total_obligations: Optional[float] = None
    total_bt_pos: Optional[float] = None
    foir_eligibility: Optional[float] = None
    multiplier_eligibility: Optional[float] = None
    final_eligibility: Optional[float] = None
    status: Optional[str] = None

class ComprehensiveDynamicFields(BaseModel):
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    address: Optional[AddressSchema] = None
    personal_details: Optional[PersonalDetailsSchema] = None
    financial_details: Optional[FinancialDetailsSchema] = None
    identity_details: Optional[IdentityDetailsSchema] = None
    emergency_contact: Optional[EmergencyContactSchema] = None
    references: Optional[List[ReferenceSchema]] = None
    obligations: Optional[List[ObligationSchema]] = None
    eligibility: Optional[EligibilitySchema] = None
    check_eligibility: Optional[CheckEligibilitySchema] = None
    process: Optional[ProcessSchema] = None
    eligibility_details: Optional[EligibilityDetailsSchema] = None

# ========= Lead Schemas =========

class LeadBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile_number: Optional[str] = None  # Added mobile_number field
    alternative_phone: Optional[str] = None  # Added alternative phone field
    address: Optional[AddressSchema] = None
    loan_type: Optional[str] = None
    loan_type_id: Optional[str] = None    # Store ObjectID of loan type
    loan_type_name: Optional[str] = None  # Store name of loan type
    processing_bank: Optional[Union[str, List[str]]] = None  # Support both string and list for multiple banks
    loan_amount: Optional[float] = None
    status: Optional[str] = None
    sub_status: Optional[str] = None
    priority: LeadPriority = LeadPriority.medium
    source: Optional[str] = None
    custom_lead_id: Optional[str] = None  # Custom lead ID like LEAD-001, LEAD-002
    created_date: Optional[datetime] = None  # Allow explicit creation date
    
    # Additional form fields that need to be stored
    campaign_name: Optional[str] = None
    data_code: Optional[str] = None
    product_name: Optional[str] = None
    xyz: Optional[str] = None  # Added XYZ field
    pincode_city: Optional[str] = None  # Added Pincode & City field (combined)
    
    # Assignment and tracking fields
    department_id: Optional[str] = None
    assigned_to: Optional[Union[str, List[str]]] = None  # Support both string and list
    assign_report_to: List[str] = []
    dynamic_fields: Optional[ComprehensiveDynamicFields] = None
    
    # Form sharing control
    form_share: Optional[bool] = True  # Controls if form can be accessed via share links

# ========= Public Form Schema =========

class PublicLeadFormUpdate(BaseModel):
    """Schema for public form updates with section-wise organized fields for dark UI with white cards"""
    # Basic Lead Info - Need to keep these fields for lead identification
    first_name: str
    last_name: str
    phone: Optional[str] = None
    email: Optional[str] = None  # Adding email field that was missing
    
    # Personal Information Section
    mother_name: Optional[str] = None
    marital_status: Optional[str] = None  # Should be a dropdown
    qualification: Optional[str] = None
    
    # Current Address Section
    current_address: Optional[str] = None
    current_address_type: Optional[str] = None  # Owned, Rent, etc.
    current_address_proof: Optional[str] = None
    current_address_landmark: Optional[str] = None
    years_in_current_address: Optional[int] = None
    years_in_current_city: Optional[int] = None
    
    # Permanent Address Section
    permanent_address: Optional[str] = None
    permanent_address_landmark: Optional[str] = None
    
    # Employment Section
    company_name: Optional[Union[str, List[str]]] = None  # Support both string and list
    designation: Optional[str] = None
    department: Optional[str] = None
    date_of_joining: Optional[str] = None
    current_work_experience: Optional[int] = None  # in years
    total_work_experience: Optional[int] = None  # in years
    
    # Contact Information Section
    personal_email: Optional[str] = None
    work_email: Optional[str] = None
    office_address: Optional[str] = None
    office_address_landmark: Optional[str] = None
    
    # References Section
    reference1_name: Optional[str] = None
    reference1_number: Optional[str] = None
    reference1_relation: Optional[str] = None
    reference1_address: Optional[str] = None
    
    reference2_name: Optional[str] = None
    reference2_number: Optional[str] = None
    reference2_relation: Optional[str] = None
    reference2_address: Optional[str] = None
    
    # For backward compatibility with existing code
    dynamic_fields: Optional[Dict[str, Any]] = None

class LeadCreate(LeadBase):
    created_by: str

class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile_number: Optional[str] = None  # Added mobile_number field
    alternative_phone: Optional[str] = None
    address: Optional[AddressSchema] = None
    loan_type: Optional[str] = None
    loan_type_id: Optional[str] = None    # Store ObjectID of loan type
    loan_type_name: Optional[str] = None  # Store name of loan type
    processing_bank: Optional[Union[str, List[str]]] = None  # Support both string and list for multiple banks
    loan_amount: Optional[float] = None
    status: Optional[str] = None
    sub_status: Optional[str] = None
    priority: Optional[LeadPriority] = None
    source: Optional[str] = None
    campaign_name: Optional[str] = None  # Added campaign_name
    data_code: Optional[str] = None      # Added data_code
    xyz: Optional[str] = None            # Added xyz field
    pincode_city: Optional[str] = None   # Added pincode_city field (combined)
    department_id: Optional[str] = None
    assigned_to: Optional[Union[str, List[str], List[Dict[str, str]]]] = None  # Support string, list of strings, or list of objects
    assign_report_to: Optional[Union[str, List[str], List[Dict[str, str]]]] = None  # Support string, list of strings, or list of objects
    dynamic_fields: Optional[ComprehensiveDynamicFields] = None
    process_data: Optional[Dict[str, Any]] = None  # NEW: Separate field for "How to Process" section (outside dynamic_fields) - using Dict to avoid Pydantic auto-filling None values
    transfer_notes: Optional[str] = None
    form_share: Optional[bool] = None  # Added form_share field for public form sharing
    created_at: Optional[datetime] = None  # Allow updating creation timestamp when changing from NOT A LEAD
    question_responses: Optional[Dict[str, Any]] = None  # Added for important questions
    importantquestion: Optional[Dict[str, Any]] = None  # Added for backward compatibility
    important_questions_validated: Optional[bool] = None  # Added for validation status
    updated_by: Optional[str] = None  # Added for tracking updates
    
    class Config:
        extra = 'ignore'  # Ignore extra fields that aren't defined
    
    @validator('assigned_to')
    def clean_assigned_to(cls, v):
        if v is None:
            return v
            
        # Handle string with square brackets
        if isinstance(v, str) and ('[' in v or ']' in v):
            # Remove brackets, quotes, and extra spaces
            cleaned = v.replace('[', '').replace(']', '').replace("'", '').replace('"', '').strip()
            # If it looks like a comma-separated list, split it
            if ',' in cleaned:
                return [item.strip() for item in cleaned.split(',')]
            return cleaned
            
        # Handle list of dictionaries - extract IDs
        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
            return [item.get('id', item.get('_id', '')) for item in v if isinstance(item, dict)]
            
        return v
        
    @validator('assign_report_to')
    def clean_assign_report_to(cls, v):
        if v is None:
            return v
            
        # Handle string with square brackets
        if isinstance(v, str) and ('[' in v or ']' in v):
            # Remove brackets, quotes, and extra spaces
            cleaned = v.replace('[', '').replace(']', '').replace("'", '').replace('"', '').strip()
            # If it looks like a comma-separated list, split it
            if ',' in cleaned:
                return [item.strip() for item in cleaned.split(',')]
            return [cleaned]
            
        # Handle list of dictionaries - extract IDs
        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
            return [item.get('id', item.get('_id', '')) for item in v if isinstance(item, dict)]
            
        return v

class LeadAssign(BaseModel):
    assigned_to: str
    notes: Optional[str] = None

class LeadAddReporter(BaseModel):
    user_id: str

class LeadTransfer(BaseModel):
    to_user_id: str
    to_department_id: str
    notes: Optional[str] = None
    reporting_option: ReportingOption = ReportingOption.preserve

class LeadInDB(LeadBase):
    id: str = Field(alias="_id")
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Note Schemas =========

class NoteCreate(BaseModel):
    lead_id: str
    content: str
    note_type: str = "general"  # general, call, meeting, etc.
    created_by: str

class NoteUpdate(BaseModel):
    content: str
    note_type: Optional[str] = None

class NoteInDB(BaseModel):
    id: str = Field(alias="_id")
    lead_id: str
    content: str
    note_type: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Document Schemas =========

class DocumentCreate(BaseModel):
    lead_id: str
    filename: str
    file_path: str
    file_type: str
    document_type: str
    category: str
    description: Optional[str] = None
    password: Optional[str] = None  # Password for protected files like PDFs
    status: DocumentStatus = DocumentStatus.received
    uploaded_by: str
    size: Optional[int] = None

class DocumentUpdate(BaseModel):
    filename: Optional[str] = None
    document_type: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    password: Optional[str] = None  # Password for protected files like PDFs
    status: Optional[DocumentStatus] = None

class DocumentInDB(DocumentCreate):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Activity Schemas =========

class ActivityBase(BaseModel):
    lead_id: str
    user_id: str
    activity_type: str
    description: str
    details: Optional[Dict[str, Any]] = None

class ActivityInDB(ActivityBase):
    id: str = Field(alias="_id")
    created_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Transfer History Schemas =========

class TransferCreate(BaseModel):
    lead_id: str
    from_user_id: Optional[str] = None
    to_user_id: str
    from_department_id: Optional[str] = None
    to_department_id: Optional[str] = None
    transferred_by: str
    notes: Optional[str] = None
    reporting_users: List[str] = []

class TransferInDB(TransferCreate):
    id: str = Field(alias="_id")
    transferred_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Assignment Configuration Schemas =========

class AssignmentConfigCreate(BaseModel):
    department_id: str
    assignable_role_ids: List[str] = []
    default_reporters: List[str] = []
    auto_assign_rules: Optional[Dict[str, Any]] = None
    
class AssignmentConfigUpdate(BaseModel):
    assignable_role_ids: Optional[List[str]] = None
    default_reporters: Optional[List[str]] = None
    auto_assign_rules: Optional[Dict[str, Any]] = None

class AssignmentConfigInDB(AssignmentConfigCreate):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Form Field Configuration Schemas =========

class FieldOption(BaseModel):
    value: str
    label: str
    color: Optional[str] = None

class ValidationRule(BaseModel):
    type: str  # required, min, max, regex, etc.
    value: Any = None
    message: Optional[str] = None

class FieldCondition(BaseModel):
    field: str
    operator: str  # equals, not_equals, greater_than, etc.
    value: Any

class FormFieldBase(BaseModel):
    id: Optional[str] = None
    label: str
    type: FieldType
    required: bool = False
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None
    validation: Optional[List[ValidationRule]] = None
    options: Optional[List[FieldOption]] = None
    department_id: Optional[str] = None
    order: int = 100
    section: Optional[str] = None
    conditional_display: Optional[List[FieldCondition]] = None
    help_text: Optional[str] = None
    is_active: bool = True

class FormFieldCreate(FormFieldBase):
    pass

class FormFieldUpdate(BaseModel):
    label: Optional[str] = None
    required: Optional[bool] = None
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None
    validation: Optional[List[ValidationRule]] = None
    options: Optional[List[FieldOption]] = None
    department_id: Optional[str] = None
    order: Optional[int] = None
    section: Optional[str] = None
    conditional_display: Optional[List[FieldCondition]] = None
    help_text: Optional[str] = None
    is_active: Optional[bool] = None

class FormFieldInDB(FormFieldBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Status Configuration Schemas =========

class StatusBase(BaseModel):
    id: Optional[str] = None
    name: str
    color: Optional[str] = None
    order: int
    department_ids: Optional[List[str]] = None
    description: Optional[str] = None
    is_active: bool = True
    reassignment_period: Optional[int] = None  # Days until reassignment is allowed
    is_manager_permission_required: Optional[bool] = False  # Whether manager approval is needed for reassignment
    
class StatusCreate(StatusBase):
    pass

class SubStatusObject(BaseModel):
    name: str
    reassignment_period: Optional[int] = None
    is_manager_permission_required: Optional[bool] = False

class StatusUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None
    department_ids: Optional[List[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sub_statuses: Optional[List[Union[str, Dict[str, Any], SubStatusObject]]] = None  # List of sub-status IDs or objects
    reassignment_period: Optional[int] = None  # Days until reassignment is allowed
    is_manager_permission_required: Optional[bool] = False  # Whether manager approval is needed for reassignment



class StatusInDB(StatusBase):
    id: str
    mongo_id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Sub-Status Configuration Schemas =========

class SubStatusBase(BaseModel):
    id: Optional[str] = None
    parent_status_id: str
    name: str
    description: Optional[str] = None
    order: int = 100
    is_active: bool = True
    reassignment_period: Optional[int] = None  # Days until reassignment is allowed, overrides parent status
    is_manager_permission_required: Optional[bool] = False  # Whether manager approval is needed for reassignment

class SubStatusCreate(SubStatusBase):
    pass

class SubStatusUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None
    reassignment_period: Optional[int] = None  # Days until reassignment is allowed, overrides parent status
    is_manager_permission_required: Optional[bool] = False  # Whether manager approval is needed for reassignment

class SubStatusInDB(SubStatusBase):
    id: str
    mongo_id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Pagination Schema =========

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int

# ========= Shareable Link Schemas =========

class ShareLinkCreate(BaseModel):
    lead_id: str  # ID of the lead for which to create a shareable link
    expires_in_days: Optional[int] = None  # Number of days until expiration
    purpose: str = "public_form"  # Purpose of the share link, only public_form is supported
    recipient_email: Optional[str] = None  # Who the link will be shared with
    base_url: Optional[str] = None  # Base URL for constructing complete URL
    allow_update: bool = True  # Whether updates are allowed via this link
    one_time_use: bool = False  # Whether the link should be deactivated after first use

class ShareLinkResponse(BaseModel):
    id: str
    share_token: str
    lead_id: str
    expires_at: datetime
    allow_edit: bool  # matches the field name in ShareLinks.py method
    url: Optional[str] = None
    created_at: datetime

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ShareLinkInDB(BaseModel):
    id: str = Field(alias="_id")
    lead_id: str
    share_token: str
    expires_at: datetime
    max_access_count: int
    access_count: int = 0
    is_active: bool = True
    notes: Optional[str] = None
    created_by: str
    created_at: datetime
    last_accessed_at: Optional[datetime] = None

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ========= Assignment Options Schema =========

class UserOption(BaseModel):
    id: str
    name: str
    username: str
    role_name: Optional[str] = None
    department_id: Optional[str] = None
    designation: Optional[str] = None

class AssignmentOptions(BaseModel):
    users: List[UserOption]
    departments: List[Dict[str, str]]