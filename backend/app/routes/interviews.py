from fastapi import APIRouter, HTTPException, Query, Form, Depends
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ValidationError
from datetime import datetime, timedelta
from bson import ObjectId
from app.database import get_database_instances
from app.database.Interviews import InterviewsDB
from app.database.InterviewComments import InterviewCommentsDB
from app.database.InterviewHistory import InterviewHistoryDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.permissions import check_permission, PermissionManager
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Dependency functions
async def get_interviews_db(db_instances = Depends(get_database_instances)) -> InterviewsDB:
    return db_instances["interviews"]

async def get_comments_db(db_instances = Depends(get_database_instances)) -> InterviewCommentsDB:
    return db_instances["interview_comments"]

async def get_history_db(db_instances = Depends(get_database_instances)) -> InterviewHistoryDB:
    return db_instances["interview_history"]

async def get_users_db(db_instances = Depends(get_database_instances)) -> UsersDB:
    return db_instances["users"]

async def get_roles_db(db_instances = Depends(get_database_instances)) -> RolesDB:
    return db_instances["roles"]

async def get_interview_visibility_filter(
    user_id: str,
    users_db: UsersDB,
    roles_db: RolesDB
) -> Dict[str, Any]:
    """
    Get MongoDB filter for interviews that a user can view based on hierarchical permissions.
    
    Implements hierarchical permission rules:
    - own: Only see interviews that the user created
    - junior: View interviews created by users with junior roles  
    - all: View all interviews in the system
    
    Args:
        user_id: The user ID to create filter for
        users_db: UsersDB instance
        roles_db: RolesDB instance
        
    Returns:
        MongoDB filter dictionary
    """
    try:
        # Check basic permission first
        await check_permission(user_id, "interview", "show", users_db, roles_db)
        
        # Get user permissions and role
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user is a super admin - can see all interviews
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        if is_super_admin:
            return {}  # Super admin can see all interviews, no filter needed
        
        # Check for interviews admin permission - can see all interviews
        is_interviews_admin = any(
            (perm.get("page") == "interview" and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        if is_interviews_admin:
            return {}  # Admin can see all interviews
        
        # Check for all permission (case-insensitive)
        has_view_all = any(
            (perm.get("page", "").lower() == "interview" and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), str) and perm.get("actions").lower() == "all") or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or 
                any(action.lower() == "all" if isinstance(action, str) else False 
                    for action in perm.get("actions", []))))))
            for perm in user_permissions
        )
        
        if has_view_all:
            return {}  # User can see all interviews
        
        # Build filter conditions starting with universal own access
        filter_conditions = []
        
        # UNIVERSAL VIEW_OWN: Everyone can see interviews they created
        filter_conditions.append({"user_id": user_id})
        filter_conditions.append({"created_by": user_id})
        
        # Check for junior permission (case-insensitive)
        has_view_junior = any(
            (perm.get("page", "").lower() == "interview" and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), str) and perm.get("actions").lower() == "junior") or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or 
                any(action.lower() == "junior" if isinstance(action, str) else False 
                    for action in perm.get("actions", []))))))
            for perm in user_permissions
        )
        
        if has_view_junior:
            # Get subordinate users (users with junior roles)
            subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            
            if subordinate_users:
                subordinate_list = list(subordinate_users)
                
                # Add conditions for interviews created by subordinates
                for sub_id in subordinate_list:
                    filter_conditions.append({"user_id": sub_id})
                    filter_conditions.append({"created_by": sub_id})
                
                # Also add $in operator match for array comparison
                filter_conditions.append({"user_id": {"$in": subordinate_list}})
                filter_conditions.append({"created_by": {"$in": subordinate_list}})
        
        # If we have filter conditions, use them
        if filter_conditions:
            return {"$or": filter_conditions}
            
        # Default to own interviews only
        return {"$or": [{"user_id": user_id}, {"created_by": user_id}]}
        
    except Exception as e:
        logger.error(f"Error getting interview visibility filter for user {user_id}: {e}")
        # Fallback to own interviews only
        return {"$or": [{"user_id": user_id}, {"created_by": user_id}]}

# Pydantic models for request/response
class InterviewCreate(BaseModel):
    candidate_name: str = Field(..., min_length=1, max_length=100)
    mobile_number: str = Field(..., min_length=10, max_length=15)
    alternate_number: Optional[str] = Field(None, max_length=15)
    gender: str = Field(..., pattern="^(Male|Female|Other)$")
    qualification: Optional[str] = Field(None, max_length=200)  # Added qualification field
    job_opening: str = Field(..., min_length=1, max_length=200)
    interview_type: str = Field(..., min_length=1, max_length=100)  # Allow any interview type from settings
    source_portal: Optional[str] = Field(None, max_length=100)
    city: str = Field(..., min_length=1, max_length=50)
    state: str = Field(..., min_length=1, max_length=50)
    experience_type: str = Field(..., pattern="^(fresher|experienced)$")
    total_experience: Optional[str] = Field(None, max_length=20)
    old_salary: Optional[float] = Field(None, ge=0)
    offer_salary: Optional[float] = Field(None, ge=0)
    monthly_salary_offered: Optional[float] = Field(None, ge=0)  # Added monthly_salary_offered field
    marital_status: Optional[str] = Field(None, max_length=50)  # Added marital_status field
    age: Optional[str] = Field(None, max_length=3)  # Added age field
    living_arrangement: Optional[str] = Field(None, max_length=100)  # Added living_arrangement field
    primary_earning_member: Optional[str] = Field(None, max_length=100)  # Added primary_earning_member field
    type_of_business: Optional[str] = Field(None, max_length=100)  # Added type_of_business field
    banking_experience: Optional[str] = Field(None, max_length=100)  # Added banking_experience field
    interview_date: datetime
    interview_time: Optional[str] = Field(None, max_length=10)
    created_by: str = Field(..., min_length=1, max_length=100)
    user_id: str = Field(..., min_length=1)
    status: Optional[str] = Field("new_interview", min_length=1, max_length=50)  # Allow any status value from settings

class InterviewUpdate(BaseModel):
    candidate_name: Optional[str] = Field(None, min_length=1, max_length=100)
    mobile_number: Optional[str] = Field(None, min_length=10, max_length=15)
    alternate_number: Optional[str] = Field(None, max_length=15)
    gender: Optional[str] = Field(None, pattern="^(Male|Female|Other)$")
    qualification: Optional[str] = Field(None, max_length=200)  # Added qualification field
    job_opening: Optional[str] = Field(None, min_length=1, max_length=200)
    interview_type: Optional[str] = Field(None, min_length=1, max_length=100)  # Allow any interview type from settings
    source_portal: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, min_length=1, max_length=50)
    state: Optional[str] = Field(None, min_length=1, max_length=50)
    experience_type: Optional[str] = Field(None, pattern="^(fresher|experienced)$")
    total_experience: Optional[str] = Field(None, max_length=20)
    old_salary: Optional[float] = Field(None, ge=0)
    offer_salary: Optional[float] = Field(None, ge=0)
    monthly_salary_offered: Optional[float] = Field(None, ge=0)  # Added monthly_salary_offered field
    marital_status: Optional[str] = Field(None, max_length=50)  # Added marital_status field
    age: Optional[str] = Field(None, max_length=3)  # Added age field
    living_arrangement: Optional[str] = Field(None, max_length=100)  # Added living_arrangement field
    primary_earning_member: Optional[str] = Field(None, max_length=100)  # Added primary_earning_member field
    type_of_business: Optional[str] = Field(None, max_length=100)  # Added type_of_business field
    banking_experience: Optional[str] = Field(None, max_length=100)  # Added banking_experience field
    interview_date: Optional[datetime] = None
    interview_time: Optional[str] = Field(None, max_length=10)
    status: Optional[str] = Field(None, min_length=1, max_length=50)  # Allow any status value from settings

class InterviewResponse(BaseModel):
    id: str = Field(alias="_id", description="Interview MongoDB ID")
    candidate_name: str
    mobile_number: str
    alternate_number: Optional[str]
    gender: str
    qualification: Optional[str]  # Added qualification field
    job_opening: str
    interview_type: str
    source_portal: Optional[str]
    city: str
    state: str
    experience_type: str
    total_experience: Optional[str]
    old_salary: Optional[float]
    offer_salary: Optional[float]
    monthly_salary_offered: Optional[float]  # Added monthly_salary_offered field
    marital_status: Optional[str]  # Added marital_status field
    age: Optional[str]  # Added age field
    living_arrangement: Optional[str]  # Added living_arrangement field
    primary_earning_member: Optional[str]  # Added primary_earning_member field
    type_of_business: Optional[str]  # Added type_of_business field
    banking_experience: Optional[str]  # Added banking_experience field
    interview_date: Optional[datetime] = None
    interview_time: Optional[str] = None
    created_by: str
    user_id: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True

# Comment models
class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000, description="Comment content")

class CommentResponse(BaseModel):
    id: str
    interview_id: str
    content: str
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime

class CommentCreateResponse(BaseModel):
    success: bool
    data: CommentResponse
    message: str
    interview_id: str

@router.get("/interviews/check-duplicate/{phone_number}")
async def check_duplicate_phone(
    phone_number: str,
    user_id: str = Query(..., description="User ID making the request"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Check if phone number already exists in interviews"""
    try:
        logger.info(f"Checking duplicate phone number: {phone_number}")
        
        # Check permission
        await check_permission(user_id, "interview", "show", users_db, roles_db)
        
        # Search for interviews with matching phone number (both mobile_number and alternate_number)
        existing_interviews = await interviews_db.find_interviews_by_phone(phone_number)
        
        if existing_interviews:
            # Format the response with interview details
            duplicates = []
            for interview in existing_interviews:
                duplicates.append({
                    "id": str(interview["_id"]),
                    "candidate_name": interview.get("candidate_name", ""),
                    "mobile_number": interview.get("mobile_number", ""),
                    "alternate_number": interview.get("alternate_number", ""),
                    "city": interview.get("city", ""),
                    "state": interview.get("state", ""),
                    "status": interview.get("status", ""),
                    "job_opening": interview.get("job_opening", ""),
                    "interview_type": interview.get("interview_type", ""),
                    "interview_date": interview.get("interview_date"),
                    "created_by": interview.get("created_by", ""),
                    "user_id": interview.get("user_id", ""),
                    "created_at": interview.get("created_at")
                })
            
            return {
                "success": True,
                "exists": True,
                "count": len(duplicates),
                "data": duplicates,
                "interviews": duplicates,  # Keep for backward compatibility
                "message": f"Found {len(duplicates)} existing interview(s) with this phone number"
            }
        else:
            return {
                "success": True,
                "exists": False,
                "count": 0,
                "data": [],
                "interviews": [],  # Keep for backward compatibility
                "message": "No existing interviews found with this phone number"
            }
            
    except Exception as e:
        logger.error(f"Error checking duplicate phone: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interviews", response_model=InterviewResponse)
async def create_new_interview(
    interview: InterviewCreate,
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    history_db: InterviewHistoryDB = Depends(get_history_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Create a new interview"""
    try:
        logger.info(f"Creating new interview for candidate: {interview.candidate_name}")
        logger.info(f"Interview data: {interview.dict()}")
        
        interview_data = interview.dict()
        
        created_interview = await interviews_db.create_interview(interview_data)
        
        if created_interview:
            logger.info(f"Interview created successfully: {created_interview['_id']}")
            
            # Create history entry for interview creation
            try:
                user_id = interview_data.get("user_id")
                if user_id:
                    # Get user name for history
                    user_name = f"User {user_id}"  # Default fallback
                    try:
                        user_data = await users_db.get_user(user_id)
                        if user_data:
                            if user_data.get("first_name") and user_data.get("last_name"):
                                user_name = f"{user_data.get('first_name')} {user_data.get('last_name')}"
                            elif user_data.get("full_name"):
                                user_name = user_data.get("full_name")
                            elif user_data.get("name"):
                                user_name = user_data.get("name")
                            elif user_data.get("username"):
                                user_name = user_data.get("username")
                    except Exception as e:
                        logger.warning(f"Could not get user name for {user_id}: {e}")
                    
                    # Add creation history entry
                    await history_db.add_interview_created(
                        interview_id=str(created_interview['_id']),
                        created_by=user_id,
                        created_by_name=user_name,
                        candidate_name=interview_data.get("candidate_name", "Unknown")
                    )
                    logger.info(f"History entry created for interview: {created_interview['_id']}")
            except Exception as history_error:
                logger.warning(f"Failed to create history entry: {history_error}")
                # Don't fail the whole operation if history creation fails
            
            return created_interview
        else:
            logger.error("Failed to create interview")
            raise HTTPException(status_code=500, detail="Failed to create interview")
            
    except ValidationError as ve:
        logger.error(f"Validation error in create_new_interview: {ve}")
        error_details = []
        for error in ve.errors():
            error_details.append({
                "field": ".".join(str(x) for x in error["loc"]),
                "message": error["msg"],
                "value": error.get("input", "")
            })
        raise HTTPException(
            status_code=422, 
            detail={
                "message": "Validation failed",
                "errors": error_details
            }
        )
    except Exception as e:
        logger.error(f"Error in create_new_interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interviews", response_model=List[InterviewResponse])
async def get_all_interviews(
    user_id: str = Query(..., description="User ID making the request"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Limit number of results"),
    skip: Optional[int] = Query(0, ge=0, description="Skip number of results"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db)
):
    """Get all interviews with hierarchical permissions"""
    try:
        logger.info(f"Getting interviews for user {user_id} with hierarchical permissions")
        
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        interviews = await interviews_db.get_interviews(
            user_id=None,
            status=status, 
            limit=limit, 
            skip=skip,
            extra_filters=visibility_filter
        )
        
        logger.info(f"Retrieved {len(interviews)} interviews with hierarchical permissions")
        return interviews
        
    except Exception as e:
        logger.error(f"Error in get_all_interviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Put specific routes before parameterized routes to avoid conflicts
@router.get("/interviews/pending-reassignments")
async def get_pending_interview_reassignments(
    user_id: str = Query(..., description="User ID making the request"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all interviews with pending reassignment requests"""
    try:
        # Check if user is super admin or has permission to view reassignments
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # For now, require super admin role to view all pending reassignments
        user_role = await roles_db.get_role(user.get("role_id"))
        if not user_role or user_role.get("name", "").lower() != "super admin":
            # Regular users can only see their own reassignment requests
            interviews = await interviews_db.find_interviews_with_filter({
                "reassignment_requested_by": user_id,
                "pending_reassignment": True
            })
        else:
            # Super admin can see all pending reassignments
            interviews = await interviews_db.find_interviews_with_filter({
                "pending_reassignment": True
            })
        
        # Format the response
        pending_reassignments = []
        for interview in interviews:
            # Get target user info
            target_user_id = interview.get("reassignment_target_user")
            target_user = await users_db.get_user(target_user_id) if target_user_id else None
            
            # Get requesting user info
            requesting_user_id = interview.get("reassignment_requested_by")
            requesting_user = await users_db.get_user(requesting_user_id) if requesting_user_id else None
            
            pending_reassignments.append({
                "interview_id": str(interview["_id"]),
                "candidate_name": interview.get("candidate_name", ""),
                "mobile_number": interview.get("mobile_number", ""),
                "job_opening": interview.get("job_opening", ""),
                "interview_type": interview.get("interview_type", ""),
                "status": interview.get("status", ""),
                "current_user_id": interview.get("user_id", ""),
                "reassignment_requested_by": requesting_user_id,
                "reassignment_requested_by_name": requesting_user.get("name", "Unknown") if requesting_user else "Unknown",
                "reassignment_target_user": target_user_id,
                "reassignment_target_user_name": target_user.get("name", "Unknown") if target_user else "Unknown",
                "reassignment_reason": interview.get("reassignment_reason", ""),
                "reassignment_requested_at": interview.get("reassignment_requested_at"),
                "created_at": interview.get("created_at")
            })
        
        return {
            "success": True,
            "data": pending_reassignments,
            "count": len(pending_reassignments),
            "message": f"Found {len(pending_reassignments)} pending interview reassignments"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pending interview reassignments: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting pending interview reassignments: {str(e)}")

@router.get("/interviews/all-reassignments")
async def get_all_interview_reassignments(
    user_id: str = Query(..., description="User ID making the request"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all interviews with reassignment requests (pending, approved, rejected)"""
    try:
        # Check if user is super admin or has permission to view reassignments
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # For now, require super admin role to view all reassignments
        user_role = await roles_db.get_role(user.get("role_id"))
        if not user_role or user_role.get("name", "").lower() != "super admin":
            # Regular users can only see their own reassignment requests
            interviews = await interviews_db.find_interviews_with_filter({
                "reassignment_requested_by": user_id,
                "reassignment_requested_at": {"$exists": True}  # Has any reassignment request
            })
        else:
            # Super admin can see all reassignments
            interviews = await interviews_db.find_interviews_with_filter({
                "reassignment_requested_at": {"$exists": True}  # Has any reassignment request
            })
        
        # Format the response
        all_reassignments = []
        for interview in interviews:
            # Get target user info
            target_user_id = interview.get("reassignment_target_user")
            target_user = await users_db.get_user(target_user_id) if target_user_id else None
            
            # Get requesting user info
            requesting_user_id = interview.get("reassignment_requested_by")
            requesting_user = await users_db.get_user(requesting_user_id) if requesting_user_id else None
            
            # Determine reassignment status
            reassignment_status = "pending"  # default
            if interview.get("pending_reassignment") == False:
                reassignment_status = "approved" if interview.get("reassignment_approved") == True else "rejected"
            
            all_reassignments.append({
                "interview_id": str(interview["_id"]),
                "candidate_name": interview.get("candidate_name", ""),
                "mobile_number": interview.get("mobile_number", ""),
                "job_opening": interview.get("job_opening", ""),
                "interview_type": interview.get("interview_type", ""),
                "status": interview.get("status", ""),
                "current_user_id": interview.get("user_id", ""),
                "reassignment_requested_by": requesting_user_id,
                "reassignment_requested_by_name": requesting_user.get("name", "Unknown") if requesting_user else "Unknown",
                "reassignment_target_user": target_user_id,
                "reassignment_target_user_name": target_user.get("name", "Unknown") if target_user else "Unknown",
                "reassignment_reason": interview.get("reassignment_reason", ""),
                "reassignment_requested_at": interview.get("reassignment_requested_at"),
                "reassignment_status": reassignment_status,
                "reassignment_approved": interview.get("reassignment_approved"),
                "reassignment_remarks": interview.get("reassignment_remarks", ""),
                "created_at": interview.get("created_at")
            })
        
        return {
            "success": True,
            "data": all_reassignments,
            "count": len(all_reassignments),
            "message": f"Found {len(all_reassignments)} interview reassignments"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all interview reassignments: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting all interview reassignments: {str(e)}")

@router.get("/interviews/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: str,
    user_id: str = Query(..., description="User ID making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db)
):
    """Get a specific interview by ID with permission check"""
    try:
        logger.info(f"Getting interview: {interview_id} for user: {user_id}")
        
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            logger.warning(f"Interview not found: {interview_id}")
            raise HTTPException(status_code=404, detail="Interview not found")
        
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        combined_filter = {
            "_id": ObjectId(interview_id),
            **visibility_filter
        }
        
        visible_interview = await interviews_db.find_one_with_filter(combined_filter)
        
        if not visible_interview:
            logger.warning(f"User {user_id} does not have permission to view interview {interview_id}")
            raise HTTPException(status_code=403, detail="You don't have permission to view this interview")
        
        logger.info(f"Retrieved interview: {interview_id} for user: {user_id}")
        return interview
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/interviews/{interview_id}", response_model=InterviewResponse)
async def update_existing_interview(
    interview_id: str, 
    interview: InterviewUpdate,
    user_id: str = Query(..., description="User ID performing the update"),
    user_name: Optional[str] = Query(None, description="User name performing the update (optional)"),
    users_db: UsersDB = Depends(get_users_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Update an existing interview"""
    try:
        if not user_name:
            try:
                user_data = await users_db.get_user(user_id)
                logger.info(f"UPDATE: Retrieved user data for {user_id}: {user_data is not None}")
                if user_data:
                    # Try different combinations to get user name
                    if user_data.get("first_name") and user_data.get("last_name"):
                        user_name = f"{user_data.get('first_name')} {user_data.get('last_name')}"
                        logger.info(f"UPDATE: Set user_name from first+last: {user_name}")
                    elif user_data.get("full_name"):
                        user_name = user_data.get("full_name")
                        logger.info(f"UPDATE: Set user_name from full_name: {user_name}")
                    elif user_data.get("name"):
                        user_name = user_data.get("name")
                        logger.info(f"UPDATE: Set user_name from name: {user_name}")
                    elif user_data.get("username"):
                        user_name = user_data.get("username")
                        logger.info(f"UPDATE: Set user_name from username: {user_name}")
                    else:
                        user_name = f"User {user_id}"
                        logger.warning(f"UPDATE: No name fields found, using fallback: {user_name}")
                else:
                    user_name = f"User {user_id}"
                    logger.warning(f"UPDATE: User data not found for {user_id}, using fallback: {user_name}")
            except Exception as e:
                logger.warning(f"UPDATE: Could not get user name for {user_id}: {e}")
                user_name = f"User {user_id}"
        
        logger.info(f"Updating interview: {interview_id} by user: {user_name} ({user_id})")
        
        current_interview = await interviews_db.get_interview_by_id(interview_id)
        if not current_interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        update_data = {k: v for k, v in interview.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No data provided for update")
        
        changes = {}
        for field, new_value in update_data.items():
            old_value = current_interview.get(field)
            if old_value != new_value:
                changes[field] = {"old": old_value, "new": new_value}
                
                if field == "status" and old_value != new_value:
                    await history_db.add_status_changed(
                        interview_id=interview_id,
                        updated_by=user_id,
                        updated_by_name=user_name,
                        old_status=str(old_value) if old_value else "None",
                        new_status=str(new_value)
                    )
        
        updated_interview = await interviews_db.update_interview(interview_id, update_data)
        
        if updated_interview:
            if changes:
                await history_db.add_interview_updated(
                    interview_id=interview_id,
                    updated_by=user_id,
                    updated_by_name=user_name,
                    changes=changes
                )
            
            logger.info(f"Interview updated successfully: {interview_id}")
            return updated_interview
        else:
            logger.warning(f"Interview not found for update: {interview_id}")
            raise HTTPException(status_code=404, detail="Interview not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_existing_interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/interviews/{interview_id}")
async def delete_existing_interview(
    interview_id: str,
    interviews_db: InterviewsDB = Depends(get_interviews_db)
):
    """Delete an interview"""
    try:
        logger.info(f"Deleting interview: {interview_id}")
        
        success = await interviews_db.delete_interview(interview_id)
        
        if success:
            logger.info(f"Interview deleted successfully: {interview_id}")
            return {"message": "Interview deleted successfully"}
        else:
            logger.warning(f"Interview not found for deletion: {interview_id}")
            raise HTTPException(status_code=404, detail="Interview not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_existing_interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interviews/stats/summary")
async def get_interview_statistics(
    user_id: str = Query(..., description="User ID making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db)
):
    """Get interview statistics with hierarchical permissions"""
    try:
        logger.info(f"Getting interview statistics for user: {user_id}")
        
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        stats_result = await interviews_db.get_interview_stats(extra_filters=visibility_filter)
        
        logger.info(f"Retrieved interview statistics for user {user_id}: {stats_result}")
        return stats_result
        
    except Exception as e:
        logger.error(f"Error in get_interview_statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interviews/search/query", response_model=List[InterviewResponse])
async def search_interviews_endpoint(
    user_id: str = Query(..., description="User ID making the request"),
    search_term: Optional[str] = Query(None, description="Search term"),
    status: Optional[str] = Query(None, description="Filter by status"),
    from_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    to_date: Optional[str] = Query(None, description="End date (ISO format)"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db)
):
    """Search interviews with hierarchical permissions"""
    try:
        logger.info(f"Searching interviews for user {user_id} with term: {search_term}")
        
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        interviews = await interviews_db.search_interviews(
            user_id=None,
            search_term=search_term,
            status=status,
            from_date=from_date,
            to_date=to_date,
            extra_filters=visibility_filter
        )
        
        logger.info(f"Search returned {len(interviews)} interviews for user {user_id}")
        return {"interviews": interviews, "total": len(interviews)}
        
    except Exception as e:
        logger.error(f"Error in search_interviews_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/interviews/{interview_id}/status")
async def update_interview_status(
    interview_id: str,
    status: str = Form(...),
    interviews_db: InterviewsDB = Depends(get_interviews_db)
):
    """Update interview status"""
    try:
        logger.info(f"Updating interview status: {interview_id} -> {status}")
        
        valid_statuses = ["new_interview", "selected", "rejected", "no_show", "not_relevant"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        updated_interview = await interviews_db.update_interview(interview_id, {"status": status})
        
        if updated_interview:
            logger.info(f"Interview status updated successfully: {interview_id}")
            return updated_interview
        else:
            logger.warning(f"Interview not found for status update: {interview_id}")
            raise HTTPException(status_code=404, detail="Interview not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_interview_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Interview Comments Endpoints
@router.get("/interviews/{interview_id}/comments")
async def get_interview_comments(
    interview_id: str,
    user_id: str = Query(..., description="User ID making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    comments_db: InterviewCommentsDB = Depends(get_comments_db)
):
    """Get all comments for an interview with permission check"""
    try:
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        combined_filter = {
            "_id": ObjectId(interview_id),
            **visibility_filter
        }
        
        visible_interview = await interviews_db.find_one_with_filter(combined_filter)
        
        if not visible_interview:
            raise HTTPException(status_code=403, detail="You don't have permission to view this interview")
        
        comments = await comments_db.get_comments_by_interview(interview_id)
        
        return {
            "success": True,
            "data": comments,
            "total": len(comments),
            "interview_id": interview_id,
            "message": f"Retrieved {len(comments)} comments"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving interview comments: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving interview comments: {str(e)}")

@router.post("/interviews/{interview_id}/comments", response_model=CommentCreateResponse)
async def add_interview_comment(
    interview_id: str,
    comment: CommentCreate,
    user_id: str = Query(..., description="User ID adding the comment"),
    user_name: Optional[str] = Query(None, description="User name adding the comment"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    comments_db: InterviewCommentsDB = Depends(get_comments_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Add a comment to an interview with permission check"""
    try:
        # Resolve user name if not provided
        if not user_name:
            try:
                user_data = await users_db.get_user(user_id)
                if user_data:
                    # Try different combinations to get user name
                    if user_data.get("first_name") and user_data.get("last_name"):
                        user_name = f"{user_data.get('first_name')} {user_data.get('last_name')}"
                    elif user_data.get("full_name"):
                        user_name = user_data.get("full_name")
                    elif user_data.get("name"):
                        user_name = user_data.get("name")
                    elif user_data.get("username"):
                        user_name = user_data.get("username")
                    else:
                        user_name = f"User {user_id}"
                else:
                    user_name = f"User {user_id}"
            except Exception as e:
                logger.warning(f"Could not get user name for {user_id}: {e}")
                user_name = f"User {user_id}"
        
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        combined_filter = {
            "_id": ObjectId(interview_id),
            **visibility_filter
        }
        
        visible_interview = await interviews_db.find_one_with_filter(combined_filter)
        
        if not visible_interview:
            raise HTTPException(status_code=403, detail="You don't have permission to access this interview")
        
        comment_id = await comments_db.add_comment(
            interview_id=interview_id,
            content=comment.content,
            created_by=user_id,
            created_by_name=user_name
        )
        
        if not comment_id:
            raise HTTPException(status_code=500, detail="Failed to add comment")
        
        await history_db.add_comment_added(
            interview_id=interview_id,
            commented_by=user_id,
            commented_by_name=user_name,
            comment_text=comment.content
        )
        
        created_comment = await comments_db.get_comment(comment_id)
        if not created_comment:
            raise HTTPException(status_code=500, detail="Failed to retrieve created comment")
        
        comment_data = {
            "id": created_comment.get("id"),
            "interview_id": interview_id,
            "content": created_comment.get("content"),
            "created_by": created_comment.get("created_by"),
            "created_by_name": created_comment.get("created_by_name"),
            "created_at": created_comment.get("created_at"),
            "updated_at": created_comment.get("updated_at")
        }
        
        return {
            "success": True,
            "data": comment_data,
            "message": "Comment added successfully",
            "interview_id": interview_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding interview comment: {e}")
        raise HTTPException(status_code=500, detail=f"Error adding interview comment: {str(e)}")

@router.put("/interviews/{interview_id}/comments/{comment_id}")
async def update_interview_comment(
    interview_id: str,
    comment_id: str,
    comment: CommentCreate,
    user_id: str = Query(..., description="User ID updating the comment"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    comments_db: InterviewCommentsDB = Depends(get_comments_db)
):
    """Update a comment"""
    try:
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        existing_comment = await comments_db.get_comment(comment_id)
        if not existing_comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        if existing_comment.get("created_by") != user_id:
            raise HTTPException(status_code=403, detail="You can only update your own comments")
        
        success = await comments_db.update_comment(comment_id, comment.content)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update comment")
        
        return {"success": True, "message": "Comment updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating interview comment: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating interview comment: {str(e)}")

@router.delete("/interviews/{interview_id}/comments/{comment_id}")
async def delete_interview_comment(
    interview_id: str,
    comment_id: str,
    user_id: str = Query(..., description="User ID deleting the comment"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    comments_db: InterviewCommentsDB = Depends(get_comments_db)
):
    """Delete a comment"""
    try:
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        existing_comment = await comments_db.get_comment(comment_id)
        if not existing_comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        if existing_comment.get("created_by") != user_id:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")
        
        success = await comments_db.delete_comment(comment_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete comment")
        
        return {"success": True, "message": "Comment deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview comment: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting interview comment: {str(e)}")

# Interview History Endpoints
@router.get("/interviews/{interview_id}/history")
async def get_interview_history(
    interview_id: str,
    user_id: str = Query(..., description="User ID requesting history"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Get all history entries for an interview"""
    try:
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        history = await history_db.get_history_by_interview(interview_id)
        
        return {
            "success": True,
            "data": history,
            "total": len(history),
            "interview_id": interview_id,
            "message": f"Retrieved {len(history)} history entries"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving interview history: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving interview history: {str(e)}")

# History models
class HistoryEntryCreate(BaseModel):
    action_type: str = Field(..., min_length=1, max_length=50, description="Type of action performed")
    action: str = Field(..., min_length=1, max_length=200, description="Action description")
    description: Optional[str] = Field(None, max_length=500, description="Detailed description")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional details as key-value pairs")

@router.post("/interviews/{interview_id}/history")
async def add_interview_history_entry(
    interview_id: str,
    history_entry: HistoryEntryCreate,
    user_id: str = Query(..., description="User ID adding the history entry"),
    user_name: Optional[str] = Query(None, description="User name adding the history entry"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Add a history entry to an interview"""
    try:
        # Resolve user name if not provided
        if not user_name:
            try:
                user_data = await users_db.get_user(user_id)
                if user_data:
                    # Try different combinations to get user name
                    if user_data.get("first_name") and user_data.get("last_name"):
                        user_name = f"{user_data.get('first_name')} {user_data.get('last_name')}"
                    elif user_data.get("full_name"):
                        user_name = user_data.get("full_name")
                    elif user_data.get("name"):
                        user_name = user_data.get("name")
                    elif user_data.get("username"):
                        user_name = user_data.get("username")
                    else:
                        user_name = f"User {user_id}"
                else:
                    user_name = f"User {user_id}"
            except Exception as e:
                logger.warning(f"Could not get user name for {user_id}: {e}")
                user_name = f"User {user_id}"
        
        # Check if user has permission to view/modify this interview
        visibility_filter = await get_interview_visibility_filter(user_id, users_db, roles_db)
        
        combined_filter = {
            "_id": ObjectId(interview_id),
            **visibility_filter
        }
        
        visible_interview = await interviews_db.find_one_with_filter(combined_filter)
        
        if not visible_interview:
            raise HTTPException(status_code=403, detail="You don't have permission to access this interview")
        
        # Add the history entry using the appropriate method based on action_type
        if history_entry.action_type == "created":
            candidate_name = history_entry.details.get("candidate_name", "Unknown") if history_entry.details else "Unknown"
            history_id = await history_db.add_interview_created(
                interview_id=interview_id,
                created_by=user_id,
                created_by_name=user_name,
                candidate_name=candidate_name
            )
        elif history_entry.action_type == "field_changed":
            history_id = await history_db.add_interview_updated(
                interview_id=interview_id,
                updated_by=user_id,
                updated_by_name=user_name,
                changes=history_entry.details or {}
            )
        elif history_entry.action_type == "status_changed":
            old_status = history_entry.details.get("old_status", "") if history_entry.details else ""
            new_status = history_entry.details.get("new_status", "") if history_entry.details else ""
            history_id = await history_db.add_status_changed(
                interview_id=interview_id,
                updated_by=user_id,
                updated_by_name=user_name,
                old_status=old_status,
                new_status=new_status
            )
        elif history_entry.action_type == "comment_added":
            comment_text = history_entry.details.get("comment_text", "") if history_entry.details else ""
            history_id = await history_db.add_comment_added(
                interview_id=interview_id,
                commented_by=user_id,
                commented_by_name=user_name,
                comment_text=comment_text
            )
        else:
            # Generic history entry
            history_id = await history_db.add_generic_entry(
                interview_id=interview_id,
                action_type=history_entry.action_type,
                action=history_entry.action,
                description=history_entry.description or history_entry.action,
                performed_by=user_id,
                performed_by_name=user_name,
                details=history_entry.details or {}
            )
        
        if not history_id:
            raise HTTPException(status_code=500, detail="Failed to add history entry")
        
        # Get the created history entry
        created_entry = await history_db.get_history_entry(history_id)
        if not created_entry:
            raise HTTPException(status_code=500, detail="Failed to retrieve created history entry")
        
        return {
            "success": True,
            "data": created_entry,
            "message": "History entry added successfully",
            "interview_id": interview_id,
            "history_id": str(history_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding interview history entry: {e}")
        raise HTTPException(status_code=500, detail=f"Error adding interview history entry: {str(e)}")


# Interview Reassignment Endpoints
@router.post("/interviews/{interview_id}/request-reassignment")
async def request_interview_reassignment(
    interview_id: str,
    request_data: Dict[str, Any],
    user_id: str = Query(..., description="User ID making the request"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Request reassignment of an interview to another user"""
    try:
        # Check permission to request reassignment
        await check_permission(user_id, "interview", "edit", users_db, roles_db)
        
        # Get the interview
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Extract data from request
        new_user_id = request_data.get("new_user_id")
        reason = request_data.get("reason", "")
        
        if not new_user_id:
            raise HTTPException(status_code=400, detail="new_user_id is required")
        
        # Verify the target user exists
        target_user = await users_db.get_user(new_user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")
        
        # Update interview with reassignment request
        update_data = {
            "pending_reassignment": True,
            "reassignment_requested_by": user_id,
            "reassignment_requested_at": datetime.now(),
            "reassignment_target_user": new_user_id,
            "reassignment_reason": reason,
            "updated_at": datetime.now()
        }
        
        # Update the interview
        success = await interviews_db.update_interview(interview_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to request interview reassignment")
        
        # Add history entry
        try:
            await history_db.add_history_entry(
                interview_id=interview_id,
                user_id=user_id,
                action_type="reassignment_requested",
                action="Reassignment Requested",
                description=f"Reassignment requested to user {target_user.get('name', new_user_id)} - Reason: {reason}",
                details={
                    "target_user_id": new_user_id,
                    "target_user_name": target_user.get('name', 'Unknown'),
                    "reason": reason,
                    "requested_by": user_id
                }
            )
        except Exception as history_error:
            logger.warning(f"Failed to add history entry for reassignment request: {history_error}")
        
        return {
            "success": True,
            "message": "Interview reassignment requested successfully",
            "interview_id": interview_id,
            "target_user_id": new_user_id,
            "reason": reason
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error requesting interview reassignment: {e}")
        raise HTTPException(status_code=500, detail=f"Error requesting interview reassignment: {str(e)}")


@router.post("/interviews/{interview_id}/approve-reassignment")
async def approve_interview_reassignment(
    interview_id: str,
    approval_data: Dict[str, Any],
    user_id: str = Query(..., description="User ID making the approval"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Approve or reject interview reassignment (Super Admin only)"""
    try:
        # Check if user is super admin or has reassignment approval permission
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # For now, require super admin role (you can adjust this based on your permission system)
        user_role = await roles_db.get_role(user.get("role_id"))
        if not user_role or user_role.get("name", "").lower() != "super admin":
            raise HTTPException(status_code=403, detail="Only Super Admin can approve reassignments")
        
        # Get the interview
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        if not interview.get("pending_reassignment"):
            raise HTTPException(status_code=400, detail="No pending reassignment for this interview")
        
        # Extract approval data
        approved = approval_data.get("approved", False)
        remarks = approval_data.get("remarks", "")
        
        if approved:
            # Approve the reassignment - transfer the interview
            target_user_id = interview.get("reassignment_target_user")
            if not target_user_id:
                raise HTTPException(status_code=400, detail="No target user specified for reassignment")
            
            update_data = {
                "user_id": target_user_id,
                "pending_reassignment": False,
                "reassignment_status": "approved",
                "reassignment_approved_by": user_id,
                "reassignment_approved_at": datetime.now(),
                "reassignment_remarks": remarks,
                "updated_at": datetime.now()
            }
            
            # Add history entry
            history_action = "Reassignment Approved"
            history_description = f"Interview reassigned to new user {target_user_id}. Remarks: {remarks}"
        else:
            # Reject the reassignment
            update_data = {
                "pending_reassignment": False,
                "reassignment_status": "rejected",
                "reassignment_approved_by": user_id,
                "reassignment_approved_at": datetime.now(),
                "reassignment_remarks": remarks,
                "updated_at": datetime.now()
            }
            
            # Add history entry
            history_action = "Reassignment Rejected"
            history_description = f"Interview reassignment rejected. Remarks: {remarks}"
        
        # Update the interview
        success = await interviews_db.update_interview(interview_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to process reassignment approval")
        
        # Add history entry
        try:
            await history_db.add_history_entry(
                interview_id=interview_id,
                user_id=user_id,
                action_type="reassignment_approved" if approved else "reassignment_rejected",
                action=history_action,
                description=history_description,
                details={
                    "approved": approved,
                    "remarks": remarks,
                    "approved_by": user_id,
                    "target_user_id": interview.get("reassignment_target_user"),
                    "original_user_id": interview.get("reassignment_requested_by")
                }
            )
        except Exception as history_error:
            logger.warning(f"Failed to add history entry for reassignment approval: {history_error}")
        
        return {
            "success": True,
            "message": f"Interview reassignment {'approved' if approved else 'rejected'} successfully",
            "interview_id": interview_id,
            "approved": approved,
            "remarks": remarks
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing interview reassignment approval: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing interview reassignment approval: {str(e)}")


# Interview Reassignment Endpoints

@router.post("/interviews/{interview_id}/approve-reassignment")
async def approve_interview_reassignment(
    interview_id: str,
    user_id: str = Query(..., description="User ID making the approval"),
    approved: bool = Query(..., description="Whether to approve the reassignment"),
    remarks: str = Query("", description="Admin remarks"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    history_db: InterviewHistoryDB = Depends(get_history_db)
):
    """Approve or reject an interview reassignment request (Admin only)"""
    try:
        # Validate interview ID format
        if not ObjectId.is_valid(interview_id):
            logger.error(f"Invalid interview ID: {interview_id}")
            raise HTTPException(status_code=400, detail="Invalid interview ID format")
        
        # Check if interview exists
        interview = await interviews_db.get_interview_by_id(interview_id)
        if not interview:
            logger.warning(f"Interview not found: {interview_id}")
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Check if there's a pending reassignment
        if not interview.get("pending_reassignment"):
            raise HTTPException(status_code=400, detail="No pending reassignment for this interview")
        
        # Check permission - only admins can approve reassignments
        user_role = await roles_db.get_user_role(user_id)
        if not user_role or user_role.get("name", "").lower() not in ["super admin", "admin"]:
            raise HTTPException(status_code=403, detail="Only admins can approve reassignments")
        
        current_time = datetime.now()
        
        if approved:
            # Approve reassignment - update the interview owner
            target_user_id = interview.get("reassignment_target_user")
            update_data = {
                "user_id": target_user_id,  # Change ownership
                "pending_reassignment": False,
                "reassignment_status": "approved",
                "reassignment_approved_by": user_id,
                "reassignment_approved_at": current_time,
                "reassignment_remarks": remarks,
                "updated_at": current_time
            }
            
            # For approved requests, clear temporary reassignment fields to keep record clean
            # We'll handle this in the update call
            
        else:
            # Reject reassignment - keep original owner but preserve reassignment info
            update_data = {
                "pending_reassignment": False,
                "reassignment_status": "rejected",
                "reassignment_approved_by": user_id,
                "reassignment_approved_at": current_time,
                "reassignment_remarks": remarks,
                "updated_at": current_time
            }
            
            # For rejected requests, keep all reassignment fields for audit trail
        
        success = await interviews_db.update_interview(interview_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to process interview reassignment")
        
        # Add history entry
        action_text = "Approved" if approved else "Rejected"
        try:
            await history_db.add_history_entry({
                "interview_id": interview_id,
                "user_id": user_id,
                "action_type": f"reassignment_{action_text.lower()}",
                "action": f"Reassignment {action_text}",
                "description": f"Reassignment request {action_text.lower()}. {remarks if remarks else ''}",
                "details": {
                    "approved": approved,
                    "remarks": remarks,
                    "processed_at": current_time.isoformat(),
                    "target_user_id": interview.get("reassignment_target_user") if approved else None
                }
            })
        except Exception as history_error:
            logger.warning(f"Failed to add history entry for reassignment approval: {history_error}")
        
        return {
            "success": True,
            "message": f"Interview reassignment {action_text.lower()} successfully",
            "interview_id": interview_id,
            "approved": approved
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing interview reassignment: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing interview reassignment: {str(e)}")

@router.get("/interviews/pending-reassignments")
async def get_pending_interview_reassignments(
    user_id: str = Query(..., description="User ID making the request"),
    interviews_db: InterviewsDB = Depends(get_interviews_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all interviews with pending reassignment requests (Admin only)"""
    try:
        # Check permission - only admins can view pending reassignments
        user_role = await roles_db.get_user_role(user_id)
        if not user_role or user_role.get("name", "").lower() not in ["super admin", "admin"]:
            raise HTTPException(status_code=403, detail="Only admins can view pending reassignments")
        
        # Get all interviews with reassignment requests (pending or recently processed)
        filter_criteria = {
            "$or": [
                {"pending_reassignment": True},  # Still pending
                {
                    "reassignment_status": {"$in": ["rejected", "approved"]},
                    "reassignment_approved_at": {
                        "$gte": datetime.now() - timedelta(days=30)  # Show processed requests from last 30 days
                    }
                }
            ]
        }
        reassignment_interviews = await interviews_db.get_interviews(extra_filters=filter_criteria)
        
        # Enhance with user information
        result = []
        for interview in reassignment_interviews:
            # Get requester info
            requester_id = interview.get("reassignment_requested_by")
            requester = await users_db.get_user(requester_id) if requester_id else None
            
            # Get target user info
            target_id = interview.get("reassignment_target_user")
            target_user = await users_db.get_user(target_id) if target_id else None
            
            # Get current owner info
            current_owner_id = interview.get("user_id")
            current_owner = await users_db.get_user(current_owner_id) if current_owner_id else None
            
            result.append({
                "interview_id": str(interview["_id"]),
                "candidate_name": interview.get("candidate_name", ""),
                "mobile_number": interview.get("mobile_number", ""),
                "job_opening": interview.get("job_opening", ""),
                "status": interview.get("status", ""),
                "interview_date": interview.get("interview_date", ""),
                "city": interview.get("city", ""),
                "reassignment_reason": interview.get("reassignment_reason", ""),
                "requested_at": interview.get("reassignment_requested_at"),
                "reassignment_status": interview.get("reassignment_status", "pending"),
                "pending_reassignment": interview.get("pending_reassignment", False),
                "reassignment_remarks": interview.get("reassignment_remarks", ""),
                "approved_at": interview.get("reassignment_approved_at"),
                "approved_by": interview.get("reassignment_approved_by"),
                "requester": {
                    "user_id": requester_id,
                    "name": requester.get("name", "") if requester else "",
                    "email": requester.get("email", "") if requester else ""
                },
                "target_user": {
                    "user_id": target_id,
                    "name": target_user.get("name", "") if target_user else "",
                    "email": target_user.get("email", "") if target_user else ""
                },
                "current_owner": {
                    "user_id": current_owner_id,
                    "name": current_owner.get("name", "") if current_owner else "",
                    "email": current_owner.get("email", "") if current_owner else ""
                }
            })
        
        return {
            "success": True,
            "data": result,
            "total": len(result)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pending interview reassignments: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting pending interview reassignments: {str(e)}")
