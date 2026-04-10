from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

class ImportantQuestionBase(BaseModel):
    question: str = Field(..., description="The question text")
    type: str = Field(default="checkbox", description="Type of question (checkbox, radio, text, textarea, number)")
    mandatory: bool = Field(default=True, description="Whether this question is mandatory")
    target_type: str = Field(default="leads", description="Target type (leads, employees, etc.)")
    display_order: Optional[int] = Field(None, description="Display order of the question")
    description: Optional[str] = Field(None, description="Additional description or help text")
    options: Optional[List[str]] = Field(None, description="Options for radio/select questions")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="Validation rules for the question")
    is_active: bool = Field(default=True, description="Whether the question is active")

class ImportantQuestionCreate(ImportantQuestionBase):
    pass

class ImportantQuestionUpdate(BaseModel):
    question: Optional[str] = None
    type: Optional[str] = None
    mandatory: Optional[bool] = None
    target_type: Optional[str] = None
    display_order: Optional[int] = None
    description: Optional[str] = None
    options: Optional[List[str]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ImportantQuestionInDB(ImportantQuestionBase):
    id: str = Field(..., description="Question ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True

class ImportantQuestionResponse(BaseModel):
    questions: List[ImportantQuestionInDB]
    total: int

class ImportantQuestionStats(BaseModel):
    total_questions: int
    active_questions: int
    inactive_questions: int
    leads_questions: int
    employees_questions: int
    mandatory_questions: int
    optional_questions: int

class QuestionReorderItem(BaseModel):
    id: str = Field(..., description="Question ID")
    display_order: int = Field(..., description="New order position")

class BulkStatusUpdate(BaseModel):
    question_ids: List[str] = Field(..., description="List of question IDs to update")
    is_active: bool = Field(..., description="New active status")

class QuestionDuplicate(BaseModel):
    target_type: Optional[str] = Field(None, description="Target type for the duplicated question")

# For validation responses (used in leads)
class QuestionValidationRequest(BaseModel):
    responses: Dict[str, Any] = Field(..., description="Question responses")
    activity: Optional[Dict[str, Any]] = Field(None, description="Activity data if any")

class QuestionValidationResponse(BaseModel):
    success: bool
    message: str
    missing_questions: Optional[List[str]] = None
    validated_questions: Optional[List[str]] = None
