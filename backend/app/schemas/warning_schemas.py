from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class WarningType(str, Enum):
    LATE_ARRIVAL = "Late Arrival"
    LATE_LUNCH = "Late Lunch"
    ABUSE = "Abuse"
    EARLY_LEAVE = "Early Leave"

class WarningCreate(BaseModel):
    warning_type: WarningType = Field(..., description="Type of warning")
    issued_to: str = Field(..., description="Employee ID who receives the warning")
    penalty_amount: float = Field(..., description="Penalty amount for this warning")
    warning_message: str = Field(..., description="Warning message/description")
    
    @validator('penalty_amount')
    def validate_penalty_amount(cls, v):
        if v < 0:
            raise ValueError('Penalty amount cannot be negative')
        return v

class WarningUpdate(BaseModel):
    warning_type: Optional[WarningType] = Field(None, description="Type of warning")
    penalty_amount: Optional[float] = Field(None, description="Penalty amount for this warning")
    warning_message: Optional[str] = Field(None, description="Warning message/description")
    
    @validator('penalty_amount')
    def validate_penalty_amount(cls, v):
        if v is not None and v < 0:
            raise ValueError('Penalty amount cannot be negative')
        return v

class WarningResponse(BaseModel):
    id: str = Field(..., description="Warning ID")
    warning_type: str = Field(..., description="Type of warning")
    issued_to: str = Field(..., description="Employee ID who receives the warning")
    issued_to_name: str = Field(..., description="Name of employee who receives the warning")
    issued_by: str = Field(..., description="Employee ID who issued the warning")
    issued_by_name: str = Field(..., description="Name of employee who issued the warning")
    department_id: Optional[str] = Field(None, description="Department ID of warned employee")
    department_name: str = Field(default="Unknown Department", description="Department name of warned employee")
    penalty_amount: float = Field(..., description="Penalty amount for this warning")
    warning_message: str = Field(..., description="Warning message/description")
    issued_date: datetime = Field(..., description="Date when warning was issued")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

class WarningStats(BaseModel):
    total_warnings: int = Field(0, description="Total number of warnings")
    most_frequent_warning_type: Optional[str] = Field(None, description="Most frequent warning type")
    most_frequent_warning_count: int = Field(0, description="Count of most frequent warning type")
    total_penalties: float = Field(0, description="Total penalty amount issued")
    employee_with_most_warnings: Optional[str] = Field(None, description="Employee name with most warnings")
    employee_with_most_warnings_count: int = Field(0, description="Number of warnings for employee with most warnings")

class WarningRanking(BaseModel):
    rank: int = Field(..., description="Employee rank based on warnings")
    employee_id: str = Field(..., description="Employee ID")
    employee_name: str = Field(..., description="Employee name")
    department_name: str = Field(..., description="Department name")
    total_warnings: int = Field(..., description="Total warnings for this employee")
    total_penalty: float = Field(..., description="Total penalty amount for this employee")

class WarningFilterRequest(BaseModel):
    department_id: Optional[str] = Field(None, description="Filter by department ID")
    employee_id: Optional[str] = Field(None, description="Filter by employee ID")
    warning_type: Optional[WarningType] = Field(None, description="Filter by warning type")
    start_date: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    page: int = Field(1, description="Page number")
    per_page: int = Field(10, description="Records per page")
    
    @validator('start_date', 'end_date')
    def validate_date(cls, v):
        if v is not None:
            try:
                datetime.strptime(v, '%Y-%m-%d')
                return v
            except ValueError:
                raise ValueError('Date must be in YYYY-MM-DD format')
        return v

class WarningListResponse(BaseModel):
    success: bool = Field(True, description="Whether the request was successful")
    warnings: List[WarningResponse] = Field(..., description="List of warnings")
    total: int = Field(..., description="Total number of warnings")
    page: int = Field(1, description="Current page number")
    per_page: int = Field(10, description="Records per page")
    total_pages: int = Field(..., description="Total number of pages")
    stats: WarningStats = Field(..., description="Warning statistics")

class WarningRankingResponse(BaseModel):
    success: bool = Field(True, description="Whether the request was successful")
    rankings: List[WarningRanking] = Field(..., description="Employee warning rankings")

class DuplicateWarningResponse(BaseModel):
    has_duplicate: bool = Field(..., description="Whether duplicate warning exists")
    existing_warning: Optional[WarningResponse] = Field(None, description="Existing warning details if duplicate found")
    message: str = Field(..., description="Information message about duplicate check")

class WarningPermissions(BaseModel):
    can_view_own: bool = Field(True, description="Can view own warnings")
    can_view_all: bool = Field(False, description="Can view all warnings")
    can_add: bool = Field(False, description="Can add new warnings")
    can_edit: bool = Field(False, description="Can edit warnings")
    can_delete: bool = Field(False, description="Can delete warnings")
    can_export: bool = Field(False, description="Can export warning data")

class WarningRemovalRequest(BaseModel):
    warning_id: str = Field(..., description="ID of warning to request removal")
    reason: str = Field(..., description="Reason for removal request")

class WarningRemovalRequestResponse(BaseModel):
    success: bool = Field(True, description="Whether the request was successful")
    message: str = Field(..., description="Response message")
    request_id: str = Field(..., description="Removal request ID")
