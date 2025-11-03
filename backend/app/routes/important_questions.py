from fastapi import APIRouter, HTTPException, Depends, status as http_status, Query, Body
from typing import List, Dict, Any, Optional
from bson import ObjectId
import logging
from datetime import datetime

from app.database.ImportantQuestions import ImportantQuestionsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Leads import LeadsDB
from app.schemas.important_questions_schemas import (
    ImportantQuestionCreate, ImportantQuestionUpdate, ImportantQuestionInDB,
    ImportantQuestionResponse, ImportantQuestionStats, QuestionReorderItem,
    BulkStatusUpdate, QuestionDuplicate, QuestionValidationRequest, QuestionValidationResponse
)
from app.utils.permissions import check_permission
from app.database import get_database_instances

router = APIRouter(
    prefix="/important-questions",
    tags=["Important Questions"]
)

logger = logging.getLogger(__name__)

# Dependency to get the DB instances
async def get_important_questions_db():
    db_instances = get_database_instances()
    return db_instances["important_questions"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

# ============= CRUD Operations =============

@router.post("/", response_model=Dict[str, str], status_code=http_status.HTTP_201_CREATED)
async def create_important_question(
    question: ImportantQuestionCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new important question"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        question_data = question.dict()
        question_data["created_by"] = user_id
        
        question_id = await questions_db.create_question(question_data)
        
        logger.info(f"User {user_id} created important question: {question_id}")
        return {
            "id": question_id, 
            "message": "Important question created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating important question: {e}")
        if "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="A question with similar content already exists"
            )
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating important question: {str(e)}"
        )

@router.get("/", response_model=ImportantQuestionResponse)
async def get_important_questions(
    target_type: Optional[str] = Query(None, description="Filter by target type (leads, employees)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all important questions with optional filtering"""
    # Check permission - this is used everywhere so allow basic "show" permission
    await check_permission(user_id, ["settings", "leads", "login"], "show", users_db, roles_db)
    
    try:
        questions = await questions_db.get_questions(target_type=target_type, is_active=is_active)
        
        # For backward compatibility, format for frontend
        formatted_questions = []
        for q in questions:
            formatted_questions.append({
                "id": q["id"],
                "_id": q["_id"],
                "question": q["question"],
                "mandatory": q["mandatory"],
                "type": q["type"],
                "target_type": q.get("target_type", "leads"),
                "display_order": q.get("display_order", 1),
                "description": q.get("description", ""),
                "options": q.get("options", []),
                "validation_rules": q.get("validation_rules", {}),
                "is_active": q.get("is_active", True),
                "created_at": q.get("created_at"),
                "updated_at": q.get("updated_at"),
                "created_by": q.get("created_by")
            })
        
        return {
            "questions": formatted_questions,
            "total": len(formatted_questions)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving important questions: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving important questions: {str(e)}"
        )

@router.get("/stats", response_model=ImportantQuestionStats)
async def get_important_questions_stats(
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get statistics about important questions"""
    # Check permissions
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        stats = await questions_db.get_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting important questions stats: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting statistics: {str(e)}"
        )

@router.get("/{question_id}", response_model=ImportantQuestionInDB)
async def get_important_question(
    question_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific important question"""
    # Check permissions
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        question = await questions_db.get_question(question_id)
        if not question:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Important question not found"
            )
        
        return question
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving important question {question_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving important question: {str(e)}"
        )

@router.put("/{question_id}", response_model=Dict[str, str])
async def update_important_question(
    question_id: str,
    question_update: ImportantQuestionUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update an important question"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        # Check if question exists
        existing_question = await questions_db.get_question(question_id)
        if not existing_question:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Important question not found"
            )
        
        # Prepare update data
        update_data = question_update.dict(exclude_unset=True)
        update_data["updated_by"] = user_id
        
        success = await questions_db.update_question(question_id, update_data)
        
        if success:
            logger.info(f"User {user_id} updated important question: {question_id}")
            return {"message": "Important question updated successfully"}
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Failed to update important question"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating important question {question_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating important question: {str(e)}"
        )

@router.delete("/{question_id}", response_model=Dict[str, str])
async def delete_important_question(
    question_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete an important question"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    try:
        # Check if question exists
        existing_question = await questions_db.get_question(question_id)
        if not existing_question:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Important question not found"
            )
        
        success = await questions_db.delete_question(question_id)
        
        if success:
            logger.info(f"User {user_id} deleted important question: {question_id}")
            return {"message": "Important question deleted successfully"}
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Failed to delete important question"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting important question {question_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting important question: {str(e)}"
        )

# ============= Bulk Operations =============

@router.post("/reorder", response_model=Dict[str, str])
async def reorder_important_questions(
    reorder_data: List[QuestionReorderItem],
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Reorder important questions"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        # Convert to dict format for database
        reorder_list = [item.dict() for item in reorder_data]
        
        success = await questions_db.reorder_questions(reorder_list)
        
        if success:
            logger.info(f"User {user_id} reordered {len(reorder_data)} important questions")
            return {"message": f"Successfully reordered {len(reorder_data)} questions"}
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Failed to reorder questions"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering important questions: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reordering questions: {str(e)}"
        )

@router.post("/bulk-status-update", response_model=Dict[str, str])
async def bulk_update_question_status(
    bulk_update: BulkStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Bulk update the active status of multiple questions"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        updated_count = await questions_db.bulk_update_status(
            bulk_update.question_ids, 
            bulk_update.is_active
        )
        
        if updated_count > 0:
            status_text = "activated" if bulk_update.is_active else "deactivated"
            logger.info(f"User {user_id} {status_text} {updated_count} important questions")
            return {
                "message": f"Successfully {status_text} {updated_count} questions"
            }
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="No questions were updated"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating important questions: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error bulk updating questions: {str(e)}"
        )

@router.post("/{question_id}/duplicate", response_model=Dict[str, str])
async def duplicate_important_question(
    question_id: str,
    duplicate_data: QuestionDuplicate,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Duplicate an important question"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        new_question_id = await questions_db.duplicate_question(
            question_id, 
            duplicate_data.target_type
        )
        
        logger.info(f"User {user_id} duplicated important question {question_id} -> {new_question_id}")
        return {
            "id": new_question_id,
            "message": "Question duplicated successfully"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error duplicating important question {question_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error duplicating question: {str(e)}"
        )

# ============= Legacy Compatibility Routes =============

@router.get("/legacy/get-questions")
async def get_questions_legacy(
    user_id: str = Query(..., description="ID of the user making the request"),
    target_type: Optional[str] = Query("leads", description="Target type"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Legacy endpoint for getting questions (backward compatibility)"""
    # Check permission - check both leads and login permissions for compatibility
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    try:
        questions = await questions_db.get_questions(target_type=target_type, is_active=True)
        
        # Format for legacy compatibility
        legacy_questions = []
        for q in questions:
            legacy_questions.append({
                "id": q["id"],
                "question": q["question"],
                "mandatory": q["mandatory"],
                "type": q["type"]
            })
        
        return {"questions": legacy_questions}
        
    except Exception as e:
        logger.error(f"Error in legacy get questions: {e}")
        # Fallback to hardcoded questions for backward compatibility
        fallback_questions = [
            {
                "id": "1",
                "question": "Has customer provided all required documents?",
                "mandatory": True,
                "type": "checkbox"
            },
            {
                "id": "2", 
                "question": "Is customer's CIBIL score verified?",
                "mandatory": True,
                "type": "checkbox"
            },
            {
                "id": "3",
                "question": "Has income verification been completed?",
                "mandatory": True,
                "type": "checkbox"
            },
            {
                "id": "4",
                "question": "Are bank statements validated?",
                "mandatory": True,
                "type": "checkbox"
            },
            {
                "id": "5",
                "question": "Has reference verification been done?",
                "mandatory": True,
                "type": "checkbox"
            }
        ]
        
        return {"questions": fallback_questions}

@router.patch("/legacy/validate-questions/{lead_id}")
async def validate_questions_legacy(
    lead_id: str,
    request_data: QuestionValidationRequest,
    user_id: str = Query(..., description="ID of the user making the request"),
    questions_db: ImportantQuestionsDB = Depends(get_important_questions_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Legacy endpoint for validating questions (backward compatibility)"""
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "edit", users_db, roles_db)
    
    try:
        # Get all active questions for validation
        questions = await questions_db.get_questions(target_type="leads", is_active=True)
        
        # Check all mandatory questions are answered positively
        missing_questions = []
        validated_questions = []
        
        for question in questions:
            if question["mandatory"]:
                question_id = question["id"]
                response = request_data.responses.get(question_id)
                
                if not response or response is False:
                    missing_questions.append(question["question"])
                else:
                    validated_questions.append(question["question"])
        
        if missing_questions:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Please complete all mandatory questions: {', '.join(missing_questions)}"
            )
        
        # Update lead with question responses
        update_data = {
            "important_questions_validated": True,
            "question_responses": request_data.responses,
            "questions_validated_by": user_id,
            "questions_validated_date": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Include activity data if provided
        if request_data.activity:
            update_data["activity"] = request_data.activity
        
        # Update the lead
        success = await leads_db.update_lead(lead_id, update_data, user_id)
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update question responses"
            )
        
        logger.info(f"User {user_id} validated questions for lead {lead_id}")
        return QuestionValidationResponse(
            success=True,
            message="All important questions validated successfully",
            validated_questions=validated_questions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating questions for lead {lead_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating questions: {str(e)}"
        )
