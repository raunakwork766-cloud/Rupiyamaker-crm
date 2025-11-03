from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union
from datetime import datetime
from app.utils.common_utils import ObjectIdStr

# Product Models
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    status: str = "active"
    price: Optional[float] = None
    is_featured: bool = False
    metadata: Optional[Dict[str, Any]] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    price: Optional[float] = None
    is_featured: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None

class ProductInDB(ProductBase):
    id: ObjectIdStr = Field(..., alias="_id")
    product_code: str
    created_by: str
    created_at: datetime
    updated_by: str
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True


# Product Form Section Models
class ProductFormSectionBase(BaseModel):
    name: str
    product_id: str
    description: Optional[str] = None
    order: int = 1
    is_active: bool = True
    is_required: bool = True

class ProductFormSectionCreate(ProductFormSectionBase):
    pass

class ProductFormSectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None
    is_required: Optional[bool] = None

class ProductFormSectionInDB(ProductFormSectionBase):
    id: ObjectIdStr = Field(..., alias="_id")
    created_by: str
    created_at: datetime

    class Config:
        allow_population_by_field_name = True


# Product Form Field Models
class ProductFormFieldBase(BaseModel):
    section_id: str
    label: str
    field_type: str  # text, textarea, number, date, select, checkbox, radio, file
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    options: Optional[List[Dict[str, Any]]] = None  # For select, checkbox, radio types
    validation: Optional[Dict[str, Any]] = None  # min, max, required, pattern, etc.
    order: int = 1
    is_required: bool = False
    is_active: bool = True
    is_visible: bool = True
    is_admin_only: bool = False  # Only admin users can view/edit this field
    is_readonly: bool = False  # Field is visible but cannot be edited by anyone except admins
    allowed_roles: Optional[List[str]] = None  # List of role IDs that can edit this field, if empty all roles can edit
    help_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ProductFormFieldCreate(ProductFormFieldBase):
    pass

class ProductFormFieldUpdate(BaseModel):
    section_id: Optional[str] = None
    label: Optional[str] = None
    field_type: Optional[str] = None
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    options: Optional[List[Dict[str, Any]]] = None
    validation: Optional[Dict[str, Any]] = None
    order: Optional[int] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None
    is_admin_only: Optional[bool] = None
    is_readonly: Optional[bool] = None
    allowed_roles: Optional[List[str]] = None
    help_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ProductFormFieldInDB(ProductFormFieldBase):
    id: ObjectIdStr = Field(..., alias="_id")
    created_by: str
    created_at: datetime

    class Config:
        allow_population_by_field_name = True


# Product Form Submission Models
class ProductFormSubmission(BaseModel):
    product_id: str
    lead_id: Optional[str] = None
    form_data: Dict[str, Any]  # Section ID -> Field ID -> Value
    status: str = "submitted"  # submitted, approved, rejected, in_review
    notes: Optional[str] = None

class ProductFormSubmissionInDB(ProductFormSubmission):
    id: ObjectIdStr = Field(..., alias="_id")
    submission_code: str
    created_by: str
    created_at: datetime
    updated_by: str
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True


# Pagination Response
class PaginatedResponse(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int
    pages: int
