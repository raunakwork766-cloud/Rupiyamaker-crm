from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
from pydantic import ValidationError
import json
import os
import shutil
from uuid import uuid4
from datetime import datetime, timedelta
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Designations import DesignationService
from app.database import get_database_instances
from app.schemas.user_schemas import (
    UserBase, UserCreate, UserUpdate, UserInDB, UserLogin,
    EmployeeCreate, EmployeeUpdate, EmployeeInDB, ComprehensiveEmployeeInDB,
    EmployeeStatusUpdate, OnboardingStatusUpdate, CrmAccessUpdate, LoginStatusUpdate,
    OTPRequiredUpdate
)
from app.schemas.otp_schemas import UserLoginWithOTP
from app.database.OTP import OTPDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

async def get_otp_db():
    db_instances = get_database_instances()
    return db_instances["otp"]
    
@router.post("/", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_user(
    user: UserCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create a new user"""
    # Check permission
    await check_permission(user_id, "users", "create", users_db, roles_db)
    
    # Check if username exists (required field)
    if await users_db.get_user_by_username(user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with username '{user.username}' already exists"
        )
        
    # Check if email exists (only if provided, since it's optional now)
    if user.email and await users_db.get_user_by_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user.email}' already exists"
        )
    
    # Validate role_id if provided
    if user.role_id:
        role = await roles_db.get_role(user.role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with ID {user.role_id} not found"
            )
    
    # Validate department_id if provided
    if user.department_id:
        department = await departments_db.get_department(user.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {user.department_id} not found"
            )
            
    user_id = await users_db.create_user(user.dict())
    return {"id": user_id}
    
@router.get("/")
@router.get("")
async def list_users(
    user_id: Optional[str] = Query(None, description="ID of the user making the request (optional for compatibility)"),
    role_id: Optional[str] = None,
    department_id: Optional[str] = None,
    team_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    users_db: UsersDB = Depends(get_users_db)
):
    """⚡ OPTIMIZED: List users with hierarchical permission filtering and caching"""
    import time
    import hashlib
    from app.utils.performance_cache import get_cached_response, cache_response
    
    start_time = time.time()
    
    try:
        print(f"GET /users - Listing users (requested by user: {user_id})")
        
        # ⚡ STEP 1: Generate cache key
        filters_str = f"{user_id}|{role_id}|{department_id}|{team_id}|{is_active}"
        cache_key = f"users_list:{hashlib.md5(filters_str.encode()).hexdigest()}"
        
        # ⚡ STEP 2: Try cache first (10-second TTL for user lists)
        cached_result = await get_cached_response(cache_key)
        if cached_result is not None:
            response_time = (time.time() - start_time) * 1000
            print(f"⚡ Cache HIT - Users returned in {response_time:.2f}ms")
            return cached_result
        
        # If no user_id provided, return all users (for backward compatibility)
        if not user_id:
            filter_dict = {}
            if role_id:
                filter_dict["role_id"] = role_id
            if department_id:
                filter_dict["department_id"] = department_id
            if team_id:
                filter_dict["team_id"] = team_id
            if is_active is not None:
                filter_dict["is_active"] = is_active
            
            users = await users_db.list_users(filter_dict)
            converted_users = [convert_object_id(user) for user in users]
            return converted_users
        
        # Get hierarchical permissions for users using centralized function
        from app.routes.warnings import get_hierarchical_permissions
        
        permissions = await get_hierarchical_permissions(user_id, "employees")
        permission_level = permissions["permission_level"]
        
        # Build filter based on permissions
        filter_dict = {}
        if role_id:
            filter_dict["role_id"] = role_id
        if department_id:
            filter_dict["department_id"] = department_id
        if team_id:
            filter_dict["team_id"] = team_id
        if is_active is not None:
            filter_dict["is_active"] = is_active
        
        # Apply hierarchical filtering based on permission level
        if permission_level == "all":
            # Users with "all" permission can see all users
            print("Admin user - showing all users")
            pass
        elif permission_level == "junior":
            # Users with "junior" permission can see subordinates + themselves
            print("Hierarchical user - showing subordinates only")
            
            # Get subordinate users using synchronous version
            try:
                async def get_subordinate_users_sync(user_id: str) -> List[str]:
                    """Asynchronous version of get_subordinate_users_for_warnings"""
                    try:
                        from app.database.Roles import RolesDB
                        roles_db = RolesDB()
                        
                        user = await users_db.get_user(user_id)
                        if not user or not user.get("role_id"):
                            return []
                            
                        user_role_id = user["role_id"]
                        
                        # Get all subordinate roles
                        subordinate_roles = await roles_db.get_all_subordinate_roles(user_role_id)
                        
                        if not subordinate_roles:
                            return []
                            
                        subordinate_role_ids = [str(role["_id"]) for role in subordinate_roles]
                        
                        # Get all users with these subordinate roles
                        subordinate_users = await users_db.get_users_by_roles(subordinate_role_ids)
                        
                        if not subordinate_users:
                            return []
                            
                        user_ids = [str(user["_id"]) for user in subordinate_users]
                        return user_ids
                    except Exception as e:
                        print(f"Error getting subordinate users: {e}")
                        return []
                
                subordinate_user_ids = await get_subordinate_users_sync(user_id)
                
                # Include user's own ID + subordinate IDs
                allowed_user_ids = [user_id] + subordinate_user_ids
                
                # Convert to ObjectIds for filtering
                allowed_object_ids = [ObjectId(uid) for uid in allowed_user_ids if ObjectId.is_valid(uid)]
                filter_dict["_id"] = {"$in": allowed_object_ids}
                
            except Exception as e:
                print(f"Error getting subordinates: {e}")
                # Fallback to showing only self
                filter_dict["_id"] = ObjectId(user_id)
        else:  # permission_level == "own"
            # Users with "own" permission can only see themselves
            print("Regular user - showing only self")
            filter_dict["_id"] = ObjectId(user_id)
        
        print(f"Filter applied: {filter_dict}")
        
        # Get filtered users data from database
        users = await users_db.list_users(filter_dict)
        
        # Convert ObjectId to string for JSON serialization, but keep all other data intact
        converted_users = [convert_object_id(user) for user in users]
        
        # ⚡ FIX: Clean up empty email fields to prevent validation errors
        for user in converted_users:
            if user.get('work_email') == '':
                user['work_email'] = None
            if user.get('email') == '':
                user['email'] = None
        
        # ⚡ STEP 3: Cache the result (10-second TTL)
        await cache_response(cache_key, converted_users, ttl=10)
        
        response_time = (time.time() - start_time) * 1000
        print(f"Returning {len(converted_users)} users with hierarchical filtering in {response_time:.2f}ms")
        return converted_users
        
    except Exception as e:
        print(f"Unexpected error in list_users: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while listing users: {str(e)}"
        )
    
@router.get("/{user_id}", response_model=UserInDB)
async def get_user(
    user_id: ObjectIdStr, 
    users_db: UsersDB = Depends(get_users_db)
):
    """Get a specific user by ID"""
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    # Remove password from response
    if "password" in user:
        user.pop("password")
    return convert_object_id(user)

@router.post("/details", response_model=Dict[str, Any])
async def get_users_details(
    request_data: Dict[str, Any],
    users_db: UsersDB = Depends(get_users_db)
):
    """Get details for multiple users by their IDs"""
    try:
        user_ids = request_data.get("user_ids", [])
        requesting_user_id = request_data.get("requesting_user_id")
        
        if not user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_ids list is required"
            )
        
        if not requesting_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="requesting_user_id is required"
            )
        
        # Convert to list if single ID provided
        if isinstance(user_ids, str):
            user_ids = [user_ids]
        
        users_details = []
        for user_id in user_ids:
            try:
                user = await users_db.get_user(str(user_id))
                if user:
                    # Remove sensitive information
                    if "password" in user:
                        user.pop("password")
                    
                    # Convert ObjectId to string for JSON serialization
                    user_data = convert_object_id(user)
                    users_details.append(user_data)
                else:
                    # Add placeholder for missing users
                    users_details.append({
                        "id": str(user_id),
                        "name": "Unknown User",
                        "username": "unknown",
                        "active": False
                    })
            except Exception as e:
                print(f"Error fetching user {user_id}: {str(e)}")
                # Add placeholder for error cases
                users_details.append({
                    "id": str(user_id),
                    "name": "Error Loading User",
                    "username": "error",
                    "active": False
                })
        
        return {
            "success": True,
            "users": users_details,
            "total": len(users_details)
        }
        
    except Exception as e:
        print(f"Error in get_users_details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
    
@router.put("/{user_id}", response_model=Dict[str, str])
async def update_user(
    user_id: ObjectIdStr, 
    user_update: UserUpdate,
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update an existing user"""
    # Check if user exists
    existing_user = await users_db.get_user(user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
        
    # Filter out None values
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    
    # If username is being updated, check for duplication
    if "username" in update_data and update_data["username"] != existing_user["username"]:
        if await users_db.get_user_by_username(update_data["username"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with username '{update_data['username']}' already exists"
            )
            
    # If email is being updated, check for duplication
    if "email" in update_data and update_data["email"] != existing_user["email"]:
        if await users_db.get_user_by_email(update_data["email"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{update_data['email']}' already exists"
            )
            
    # Validate role_id if provided
    if "role_id" in update_data and update_data["role_id"] != existing_user.get("role_id"):
        if update_data["role_id"] is not None:
            role = await roles_db.get_role(update_data["role_id"])
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role with ID {update_data['role_id']} not found"
                )
                
    # Validate department_id if provided
    if "department_id" in update_data and update_data["department_id"] != existing_user.get("department_id"):
        if update_data["department_id"] is not None:
            department = await departments_db.get_department(update_data["department_id"])
            if not department:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with ID {update_data['department_id']} not found"
                )
    
    # Update the user
    success = await users_db.update_user(user_id, update_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to update user"
        )
    
    return {"message": "User updated successfully"}
    
@router.delete("/{user_id}", response_model=Dict[str, str])
async def delete_user(
    user_id: ObjectIdStr, 
    users_db: UsersDB = Depends(get_users_db)
):
    """Delete a user"""
    # Check if user exists
    if not await users_db.get_user(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Delete the user
    success = await users_db.delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
    
    return {"message": "User deleted successfully"}
    
@router.post("/login", response_model=Dict)
async def login(
    login_data: UserLoginWithOTP,
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    otp_db: OTPDB = Depends(get_otp_db)
):
    """Authenticate a user with optional OTP verification"""
    # Step 1: Look up user WITHOUT password check so we can give specific error messages
    user_lookup = await users_db.get_user_by_username(login_data.username_or_email)
    if not user_lookup:
        user_lookup = await users_db.get_user_by_email(login_data.username_or_email)

    if not user_lookup:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password"
        )

    # Step 2: Check account status BEFORE verifying password (gives specific 403 errors)
    # Previously these checks were dead code because authenticate_user returned None first
    if not user_lookup.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Please contact the administrator."
        )

    # 🔒 CRITICAL: Check employee status for HRMS employees
    if user_lookup.get("is_employee", False):
        employee_status = user_lookup.get("employee_status", "active")
        if employee_status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is inactive. Please contact the administrator."
            )

    # Check if login is enabled for this user (default is True if not set)
    if not user_lookup.get("login_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login access is disabled for your account. Please contact the administrator."
        )

    # Step 3: Now verify the password
    user = await users_db.authenticate_user(
        login_data.username_or_email,
        login_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password"
        )
    
    # 🔒 CRITICAL: Check if user's session was invalidated (for offline logout)
    # If session_invalidated_at exists and is after user's last login, require re-authentication
    # This ensures users who were logged out while offline must re-login
    session_invalidated_at = user.get("session_invalidated_at")
    last_login = user.get("last_login")
    
    # Clear the session_invalidated_at timestamp after successful check
    # This allows them to login fresh without the flag blocking them
    if session_invalidated_at:
        print(f"🔒 User {user.get('username')} has session_invalidated_at: {session_invalidated_at}")
        # Clear the invalidation flag on successful login
        await users_db.collection.update_one(
            {"_id": user["_id"]},
            {
                "$unset": {"session_invalidated_at": ""},
                "$set": {"last_login": datetime.now()}
            }
        )
    else:
        # Update last login time
        await users_db.collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.now()}}
        )
    
    # Check if OTP is required for this user (default is True if not set)
    otp_required = user.get("otp_required", True)
    
    if otp_required:
        if not login_data.otp_code:
            # User needs to provide OTP - include user ID for frontend
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={
                    "message": "OTP verification required. Please generate and provide OTP.",
                    "user_id": str(user["_id"]),
                    "user": {
                        "_id": str(user["_id"]),
                        "username": user.get("username"),
                        "email": user.get("email"),
                        "first_name": user.get("first_name"),
                        "last_name": user.get("last_name"),
                        'profile_photo': user.get("profile_photo")
                    }
                }
            )
        
        # Verify OTP
        is_valid, otp_message = await otp_db.verify_otp(str(user["_id"]), login_data.otp_code)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"OTP verification failed: {otp_message}"
            )
    
    # Get role and permissions
    role = None
    role_permissions = []
    if "role_id" in user and user["role_id"]:
        role = await roles_db.get_role(user["role_id"])
        if role:
            role_permissions = role.get("permissions", [])
    
    # Get department information
    department = None
    if "department_id" in user and user["department_id"]:
        department = await departments_db.get_department(user["department_id"])
    
    # Get designation information
    designation = user.get("designation")  # Use .get() to safely access the field
    # Convert ObjectId to string
    user_dict = convert_object_id(user)
    
    return {
        "user": user_dict,
        "role": convert_object_id(role) if role else None,
        "department": convert_object_id(department) if department else None,
        "designation": designation if designation else None,
        "permissions": role_permissions,
        "otp_verified": otp_required  # Indicates if OTP was required and verified
    }

@router.post("/verify-session", response_model=Dict)
async def verify_session_post(
    user_data: Dict,
    users_db: UsersDB = Depends(get_users_db)
):
    """Verify if user session is still valid based on current settings (POST method)"""
    user_id = user_data.get("user_id")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is required"
        )
    
    # Get current user data from database
    user = await users_db.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is still active (default is True if not set)
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive - session terminated"
        )
    
    # 🔒 CRITICAL: Check employee status for HRMS employees
    # This ensures inactive employee sessions are terminated
    if user.get("is_employee", False):
        employee_status = user.get("employee_status", "active")
        if employee_status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact the administrator."
            )
    
    # Check if login is still enabled (default is True if not set)
    if not user.get("login_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login access disabled - session terminated"
        )
    
    # 🔒 CRITICAL: Check if session was invalidated after this user's last login
    # This catches users who were offline when bulk logout happened
    session_invalidated_at = user.get("session_invalidated_at")
    last_login = user.get("last_login")
    
    if session_invalidated_at:
        # If session was invalidated, and either:
        # 1. User has no last_login (old session)
        # 2. Session was invalidated after their last login
        # Then force them to re-login
        if not last_login or session_invalidated_at > last_login:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your session has been invalidated - please login again"
            )
    
    return {
        "valid": True,
        "message": "Session is valid"
    }

@router.get("/verify-session/{user_id}", response_model=Dict)
async def verify_session_get(
    user_id: ObjectIdStr,
    users_db: UsersDB = Depends(get_users_db)
):
    """Verify if user session is still valid based on current settings (GET method)"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is required"
        )
    
    # Get current user data from database
    user = await users_db.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is still active (default is True if not set)
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive - session terminated"
        )
    
    # 🔒 CRITICAL: Check employee status for HRMS employees
    # This ensures inactive employee sessions are terminated
    if user.get("is_employee", False):
        employee_status = user.get("employee_status", "active")
        if employee_status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact to administrator."
            )
    
    # Check if login is still enabled (default is True if not set)
    if not user.get("login_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login access disabled - session terminated"
        )
    
    # 🔒 CRITICAL: Check if session was invalidated after this user's last login
    # This catches users who were offline when bulk logout happened
    session_invalidated_at = user.get("session_invalidated_at")
    last_login = user.get("last_login")
    
    if session_invalidated_at:
        # If session was invalidated, and either:
        # 1. User has no last_login (old session)
        # 2. Session was invalidated after their last login
        # Then force them to re-login
        if not last_login or session_invalidated_at > last_login:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your session has been invalidated - please login again"
            )
    
    return {
        "valid": True,
        "message": "Session is valid",
        "user_id": str(user_id)
    }

# Employee API Endpoints

@router.get("/employees", response_model=List[ComprehensiveEmployeeInDB])
async def list_employees(
    user_id: str = Query(..., description="ID of the user making the request"),
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List all employees with optional filtering by status"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Get employees with readable passwords
    employees = await users_db.get_employees_with_readable_passwords(status, department_id)
    return [convert_object_id(employee) for employee in employees]

@router.post("/employees", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee: EmployeeCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create a new employee record with all necessary information"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if username exists (required field)
    if await users_db.get_user_by_username(employee.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with username '{employee.username}' already exists"
        )
        
    # Check if phone exists (required field, unique constraint)
    if employee.phone and await users_db.get_user_by_phone(employee.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with phone number '{employee.phone}' already exists"
        )
    
    # Email is optional and no longer unique - multiple users can have the same email or null
    # No need to check for email uniqueness
    
    # Validate role_id if provided
    if employee.role_id:
        role = await roles_db.get_role(employee.role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with ID {employee.role_id} not found"
            )
    
    # Validate department_id if provided
    if employee.department_id:
        department = await departments_db.get_department(employee.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {employee.department_id} not found"
            )
    
    # Create employee
    employee_id = await users_db.create_employee(employee.dict())
    return {"id": employee_id}

@router.post("/employees/upload-photo/{employee_id}")
async def upload_employee_photo(
    employee_id: ObjectIdStr,
    file: UploadFile = File(...),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Upload a profile photo for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Create directory for employee photos if it doesn't exist
    media_dir = os.path.join("media", "employees", employee_id)
    os.makedirs(media_dir, exist_ok=True)
    
    # Save the uploaded file
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid4()}{file_extension}"
    file_path = os.path.join(media_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update employee with photo path
    relative_file_path = f"employees/{employee_id}/{unique_filename}"
    await users_db.update_user(employee_id, {"profile_photo": relative_file_path})
    
    return {"filename": unique_filename, "path": relative_file_path}

@router.get("/employees/{employee_id}", response_model=ComprehensiveEmployeeInDB)
async def get_employee(
    employee_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific employee by ID"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Get employee with readable password
    employee = await users_db.get_user_with_readable_password(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Check if it's an employee
    if not employee.get("is_employee", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {employee_id} is not an employee"
        )
    
    return convert_object_id(employee)

@router.put("/employees/{employee_id}", response_model=Dict[str, str])
async def update_employee(
    employee_id: ObjectIdStr,
    employee_data: EmployeeUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update employee information"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    current_employee = await users_db.get_user(employee_id)
    if not current_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Check if the user is actually an employee
    if not current_employee.get("is_employee", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {employee_id} is not an employee"
        )
    
    # Check if username is being updated and if it already exists
    if employee_data.username and employee_data.username != current_employee.get("username"):
        existing_user = await users_db.get_user_by_username(employee_data.username)
        if existing_user and str(existing_user["_id"]) != employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with username '{employee_data.username}' already exists"
            )
    
    # Check if email is being updated and if it already exists
    if employee_data.email and employee_data.email != current_employee.get("email"):
        existing_user = await users_db.get_user_by_email(employee_data.email)
        if existing_user and str(existing_user["_id"]) != employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{employee_data.email}' already exists"
            )
    
    # Validate role_id if provided
    if employee_data.role_id:
        role = await roles_db.get_role(employee_data.role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with ID {employee_data.role_id} not found"
            )
    
    # Validate department_id if provided
    if employee_data.department_id:
        department = await departments_db.get_department(employee_data.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {employee_data.department_id} not found"
            )
    
    # Update employee
    update_data = {k: v for k, v in employee_data.dict().items() if v is not None}
    await users_db.update_user(employee_id, update_data)
    
    return {"message": "Employee updated successfully"}

@router.patch("/employees/{employee_id}/status", response_model=Dict[str, str])
async def update_employee_status(
    employee_id: ObjectIdStr,
    status_data: EmployeeStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update employee status (active/inactive)"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Check if valid employee status
    if status_data.status not in ["active", "inactive"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be 'active' or 'inactive'"
        )
    
    # Update employee status
    success = await users_db.update_employee_status(
        employee_id, 
        status_data.status, 
        status_data.remark
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update employee status"
        )
    
    return {"message": f"Employee status updated to {status_data.status}"}

@router.patch("/employees/{employee_id}/onboarding", response_model=Dict[str, str])
async def update_onboarding_status(
    employee_id: ObjectIdStr,
    onboarding_data: OnboardingStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update employee onboarding status"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Check if valid onboarding status
    if onboarding_data.status not in ["pending", "in_progress", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Onboarding status must be 'pending', 'in_progress', or 'completed'"
        )
    
    # Update onboarding status
    success = await users_db.update_onboarding_status(
        employee_id, 
        onboarding_data.status, 
        onboarding_data.remark
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update onboarding status"
        )
    
    return {"message": f"Onboarding status updated to {onboarding_data.status}"}

@router.patch("/employees/{employee_id}/crm-access", response_model=Dict[str, str])
async def update_crm_access(
    employee_id: ObjectIdStr,
    access_data: CrmAccessUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update employee CRM access"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update CRM access
    success = await users_db.update_crm_access(employee_id, access_data.has_access)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update CRM access"
        )
    
    return {"message": f"CRM access set to {access_data.has_access}"}

@router.patch("/employees/{employee_id}/login-enabled", response_model=Dict[str, str])
async def update_login_enabled(
    employee_id: ObjectIdStr,
    login_data: LoginStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update employee login enabled status"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update login enabled status
    success = await users_db.update_login_status(employee_id, login_data.enabled)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login enabled status"
        )
    
    return {"message": f"Login access {'enabled' if login_data.enabled else 'disabled'}"}

@router.patch("/employees/{employee_id}/login", response_model=Dict[str, str])
async def update_login_status(
    employee_id: ObjectIdStr,
    login_data: LoginStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Enable or disable login for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update login status
    success = await users_db.update_login_status(employee_id, login_data.enabled)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login status"
        )
    
    return {"message": f"Login status set to {login_data.enabled}"}

@router.patch("/employees/{employee_id}/otp-required", response_model=Dict[str, str])
async def update_otp_required(
    employee_id: ObjectIdStr,
    otp_data: OTPRequiredUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Toggle OTP requirement for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update OTP required status
    success = await users_db.update_user(employee_id, {"otp_required": otp_data.otp_required})
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update OTP requirement"
        )
    
    return {"message": f"OTP requirement set to {otp_data.otp_required}"}

# General User Toggle APIs (not just employees)

@router.patch("/{user_id}/active", response_model=Dict[str, str])
async def update_user_active_status(
    user_id: ObjectIdStr,
    active_data: Dict[str, bool],
    requesting_user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Toggle user active status (is_active) with cascade logic"""
    # Check permission
    await check_permission(requesting_user_id, "users", "edit", users_db, roles_db)
    
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    is_active = active_data.get("is_active", True)
    
    # Update user active status with cascade logic
    success = await users_db.update_user_active_status(user_id, is_active)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user active status"
        )
    
    return {"message": f"User active status set to {is_active}"}

@router.get("/session-check/{user_id}", response_model=Dict)
async def check_user_session(
    user_id: ObjectIdStr,
    users_db: UsersDB = Depends(get_users_db)
):
    """Simple session check endpoint that should work immediately"""
    try:
        # Get current user data from database
        user = await users_db.get_user(user_id)
        
        if not user:
            return {
                "valid": False,
                "error": "User not found",
                "user_id": str(user_id)
            }
        
        # Check if user is still active (default is True if not set)
        is_active = user.get("is_active", True)
        login_enabled = user.get("login_enabled", True)
        
        if not is_active:
            return {
                "valid": False,
                "error": "User account is inactive",
                "user_id": str(user_id),
                "is_active": is_active,
                "login_enabled": login_enabled
            }
        
        # 🔒 CRITICAL: Check employee status for HRMS employees
        if user.get("is_employee", False):
            employee_status = user.get("employee_status", "active")
            if employee_status != "active":
                return {
                    "valid": False,
                    "error": "Your account is inactive. Please contact the administrator.",
                    "user_id": str(user_id),
                    "is_active": is_active,
                    "login_enabled": login_enabled,
                    "employee_status": employee_status
                }
        
        if not login_enabled:
            return {
                "valid": False,
                "error": "Login access disabled",
                "user_id": str(user_id),
                "is_active": is_active,
                "login_enabled": login_enabled
            }
        
        return {
            "valid": True,
            "message": "Session is valid",
            "user_id": str(user_id),
            "is_active": is_active,
            "login_enabled": login_enabled,
            "otp_required": user.get("otp_required", True)
        }
        
    except Exception as e:
        return {
            "valid": False,
            "error": f"Server error: {str(e)}",
            "user_id": str(user_id)
        }

@router.post("/verify-session", response_model=Dict)
async def verify_session_post(
    user_data: Dict,
    users_db: UsersDB = Depends(get_users_db)
):
    """Verify if user session is still valid based on current settings (POST method)"""
    user_id = user_data.get("user_id")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is required"
        )
    
    # Get current user data from database
    user = await users_db.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is still active (default is True if not set)
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive - session terminated"
        )
    
    # 🔒 CRITICAL: Check employee status for HRMS employees
    # This ensures inactive employee sessions are terminated
    if user.get("is_employee", False):
        employee_status = user.get("employee_status", "active")
        if employee_status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact to administrator."
            )
    
    # Check if login is still enabled (default is True if not set)
    if not user.get("login_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login access disabled - session terminated"
        )
    
    return {
        "valid": True,
        "message": "Session is valid"
    }

@router.get("/verify-session/{user_id}", response_model=Dict)
async def verify_session_get(
    user_id: ObjectIdStr,
    users_db: UsersDB = Depends(get_users_db)
):
    """Verify if user session is still valid based on current settings (GET method)"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is required"
        )
    
    # Get current user data from database
    user = await users_db.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is still active (default is True if not set)
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive - session terminated"
        )
    
    # Check if login is still enabled (default is True if not set)
    if not user.get("login_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login access disabled - session terminated"
        )
    
    return {
        "valid": True,
        "message": "Session is valid",
        "user_id": str(user_id)
    }

@router.get("/permissions/{user_id}")
async def get_user_permissions(
    user_id: str,
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get user permissions in the new modular format"""
    try:
        # Get user data
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get role permissions
        if user.get("role_id"):
            role = await roles_db.get_role(user["role_id"])
            if role:
                print(f"Found role for user: {role}")
                if role.get("permissions") and isinstance(role["permissions"], list):
                    # Process permissions without auto-adding own
                    # own behavior is now universal default, not permission-based
                    permissions = []
                    for perm in role["permissions"]:
                        # Make a copy to avoid modifying the original
                        processed_perm = dict(perm)
                        
                        # Special handling for super admin: ensure frontend understands full access
                        if (perm.get("page") == "*" and 
                            ((perm.get("actions") == "*") or 
                             (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", [])))):
                            # For super admin, normalize to string format that frontend expects
                            processed_perm["actions"] = "*"
                            print(f"DEBUG: Normalized super admin permission: {processed_perm}")
                        
                        permissions.append(processed_perm)
                    
                    # Return the processed permissions array
                    return permissions
                elif role.get("permissions"):
                    # Return the permissions in the original format (could be dict or any other format)
                    return {"permissions": role["permissions"]}
                else:
                    return {"message": "No permissions found for this role", "permissions": []}
            else:
                return {"message": "Role not found for this user", "permissions": []}
        
        return {"message": "No role assigned to this user", "permissions": []}
        
    except Exception as e:
        print(f"Error getting user permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user permissions"
        )

@router.get("/{user_id}/password", response_model=Dict[str, str])
async def get_user_password(
    user_id: ObjectIdStr,
    requesting_user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a user's password (for admin use only)"""
    # First, check permission - only allow admins or users with special permission
    await check_permission(requesting_user_id, "employees", "show", users_db, roles_db)
    
    # Get the user
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Check if password exists
    if "password" not in user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Password not found for user with ID {user_id}"
        )
    
    # Return the readable password for admin viewing
    readable_password = users_db._get_readable_password(user["password"])
    return {"password": readable_password}

@router.put("/{user_id}/with-photo")
async def update_user_with_photo(
    user_id: ObjectIdStr,
    # User data fields as form parameters
    username: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    role_id: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    phone: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    marital_status: Optional[str] = Form(None),
    nationality: Optional[str] = Form(None),
    blood_group: Optional[str] = Form(None),
    pan_number: Optional[str] = Form(None),
    aadhaar_number: Optional[str] = Form(None),
    highest_qualification: Optional[str] = Form(None),
    experience_level: Optional[str] = Form(None),
    employee_id: Optional[str] = Form(None),
    joining_date: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    salary: Optional[float] = Form(None),
    monthly_target: Optional[float] = Form(None),
    incentive: Optional[str] = Form(None),
    salary_account_number: Optional[str] = Form(None),
    salary_ifsc_code: Optional[str] = Form(None),
    salary_bank_name: Optional[str] = Form(None),
    work_email: Optional[str] = Form(None),
    emergency_contact_name: Optional[str] = Form(None),
    emergency_contact_phone: Optional[str] = Form(None),
    emergency_contact_relationship: Optional[str] = Form(None),
    alternate_phone: Optional[str] = Form(None),
    probation_period: Optional[int] = Form(None),
    crm_access: Optional[bool] = Form(None),
    login_enabled: Optional[bool] = Form(None),
    employee_status: Optional[str] = Form(None),
    onboarding_status: Optional[str] = Form(None),
    onboarding_remark: Optional[str] = Form(None),
    status_remark: Optional[str] = Form(None),
    employment_type: Optional[str] = Form(None),
    work_location: Optional[str] = Form(None),
    mac_address: Optional[str] = Form(None),
    reporting_manager_id: Optional[str] = Form(None),
    # Profile photo upload
    profile_photo: Optional[UploadFile] = File(None),
    # Required parameters
    requesting_user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update user with optional profile photo upload"""
    
    # Check if user exists
    existing_user = await users_db.get_user(user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Check permissions (users can update their own profile, or admin can update anyone)
    if str(user_id) != requesting_user_id:
        await check_permission(requesting_user_id, "employees", "show", users_db, roles_db)
    
    # Build update data from form fields
    update_data = {}
    
    # Basic user fields
    if username is not None:
        update_data["username"] = username
    if email is not None:
        update_data["email"] = email
    if password is not None:
        update_data["password"] = password
    if first_name is not None:
        update_data["first_name"] = first_name
    if last_name is not None:
        update_data["last_name"] = last_name
    if role_id is not None:
        update_data["role_id"] = role_id
    if department_id is not None:
        update_data["department_id"] = department_id
    if team_id is not None:
        update_data["team_id"] = team_id
    if is_active is not None:
        update_data["is_active"] = is_active
    if phone is not None:
        update_data["phone"] = phone
    
    # Personal information fields
    if dob is not None:
        try:
            update_data["dob"] = datetime.strptime(dob, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for date of birth. Use YYYY-MM-DD format."
            )
    if gender is not None:
        update_data["gender"] = gender
    if marital_status is not None:
        update_data["marital_status"] = marital_status
    if nationality is not None:
        update_data["nationality"] = nationality
    if blood_group is not None:
        update_data["blood_group"] = blood_group
    if pan_number is not None:
        update_data["pan_number"] = pan_number
    if aadhaar_number is not None:
        update_data["aadhaar_number"] = aadhaar_number
    if current_city is not None:
        update_data["current_city"] = current_city
    if highest_qualification is not None:
        update_data["highest_qualification"] = highest_qualification
    if experience_level is not None:
        update_data["experience_level"] = experience_level
    
    # Employment fields
    if employee_id is not None:
        update_data["employee_id"] = employee_id
    if joining_date is not None:
        try:
            update_data["joining_date"] = datetime.strptime(joining_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for joining date. Use YYYY-MM-DD format."
            )
    if designation is not None:
        update_data["designation"] = designation
    if salary is not None:
        update_data["salary"] = salary
    if monthly_target is not None:
        update_data["monthly_target"] = monthly_target
    if incentive is not None:
        update_data["incentive"] = incentive
    if salary_account_number is not None:
        update_data["salary_account_number"] = salary_account_number
    if salary_ifsc_code is not None:
        update_data["salary_ifsc_code"] = salary_ifsc_code
    if salary_bank_name is not None:
        update_data["salary_bank_name"] = salary_bank_name
    if work_email is not None:
        update_data["work_email"] = work_email
    if emergency_contact_name is not None:
        update_data["emergency_contact_name"] = emergency_contact_name
    if emergency_contact_phone is not None:
        update_data["emergency_contact_phone"] = emergency_contact_phone
    if emergency_contact_relationship is not None:
        update_data["emergency_contact_relationship"] = emergency_contact_relationship
    if alternate_phone is not None:
        update_data["alternate_phone"] = alternate_phone
    if probation_period is not None:
        update_data["probation_period"] = probation_period
    if crm_access is not None:
        update_data["crm_access"] = crm_access
    if login_enabled is not None:
        update_data["login_enabled"] = login_enabled
    if employee_status is not None:
        update_data["employee_status"] = employee_status
    if onboarding_status is not None:
        update_data["onboarding_status"] = onboarding_status
    if onboarding_remark is not None:
        update_data["onboarding_remark"] = onboarding_remark
    if status_remark is not None:
        update_data["status_remark"] = status_remark
    if employment_type is not None:
        update_data["employment_type"] = employment_type
    if work_location is not None:
        update_data["work_location"] = work_location
    if mac_address is not None:
        update_data["mac_address"] = mac_address
    if reporting_manager_id is not None:
        update_data["reporting_manager_id"] = reporting_manager_id
    
    # Handle profile photo upload
    photo_path = None
    if profile_photo and profile_photo.filename:
        try:
            # Validate file type
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
            file_extension = '.' + profile_photo.filename.split('.')[-1].lower()
            
            if file_extension not in allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
                )
            
            # Check file size (max 5MB)
            if profile_photo.size and profile_photo.size > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Profile photo file size cannot exceed 5MB"
                )
            
            # Create directory for user photos
            media_dir = os.path.join("media", "users", str(user_id))
            os.makedirs(media_dir, exist_ok=True)
            
            # Generate unique filename
            unique_filename = f"profile_{uuid4()}{file_extension}"
            file_path = os.path.join(media_dir, unique_filename)
            
            # Save the file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(profile_photo.file, buffer)
            
            # Store relative path in database (without 'media/' prefix)
            photo_path = f"users/{user_id}/{unique_filename}"
            update_data["profile_photo"] = photo_path
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload profile photo: {str(e)}"
            )
    
    # Validate username uniqueness if being updated
    if "username" in update_data and update_data["username"] != existing_user.get("username"):
        if await users_db.get_user_by_username(update_data["username"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with username '{update_data['username']}' already exists"
            )
    
    # Validate email uniqueness if being updated
    if "email" in update_data and update_data["email"] != existing_user.get("email"):
        if await users_db.get_user_by_email(update_data["email"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{update_data['email']}' already exists"
            )
    
    # Validate role_id if provided
    if "role_id" in update_data and update_data["role_id"] != existing_user.get("role_id"):
        if update_data["role_id"] is not None:
            role = await roles_db.get_role(update_data["role_id"])
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role with ID {update_data['role_id']} not found"
                )
    
    # Validate department_id if provided
    if "department_id" in update_data and update_data["department_id"] != existing_user.get("department_id"):
        if update_data["department_id"] is not None:
            department = await departments_db.get_department(update_data["department_id"])
            if not department:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with ID {update_data['department_id']} not found"
                )
    
    # Add updated timestamp
    update_data["updated_at"] = datetime.now()
    
    # Update the user
    success = await users_db.update_user(user_id, update_data)
    if not success:
        # Clean up uploaded photo if database update fails
        if photo_path and os.path.exists(os.path.join("media", photo_path)):
            try:
                os.remove(os.path.join("media", photo_path))
            except:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    response_data = {
        "message": "User updated successfully",
        "user_id": str(user_id),
        "status": "success"
    }
    
    if photo_path:
        response_data["profile_photo"] = photo_path
        response_data["photo_uploaded"] = True
    
    return response_data

@router.post("/{user_id}/upload-photo")
async def upload_user_profile_photo(
    user_id: ObjectIdStr,
    file: UploadFile = File(...),
    requesting_user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Upload a profile photo for a user"""
    
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Check permissions (users can update their own profile, or admin can update anyone)
    if str(user_id) != requesting_user_id:
        await check_permission(requesting_user_id, "employees", "edit", users_db, roles_db)
    
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )
    
    # Check file type
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    file_extension = '.' + file.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (max 5MB)
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile photo file size cannot exceed 5MB"
        )
    
    try:
        # Create directory for user photos
        media_dir = os.path.join("media", "users", str(user_id))
        os.makedirs(media_dir, exist_ok=True)
        
        # Generate unique filename
        unique_filename = f"profile_{uuid4()}{file_extension}"
        file_path = os.path.join(media_dir, unique_filename)
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Store relative path in database (without 'media/' prefix)
        relative_file_path = f"users/{user_id}/{unique_filename}"
        success = await users_db.update_user(user_id, {"profile_photo": relative_file_path})
        
        if not success:
            # Clean up uploaded file if database update fails
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user record with photo"
            )
        
        return {
            "message": "Profile photo uploaded successfully",
            "filename": unique_filename,
            "path": relative_file_path,
            "status": "success"
        }
        
    except Exception as e:
        # Clean up any partially uploaded file
        if 'file_path' in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile photo: {str(e)}"
        )

@router.post("/bulk-update-status")
async def bulk_update_user_status(
    target_status: bool = Query(..., description="Target status value (true for active, false for inactive)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db)
):
    """Bulk update user status (is_active) for all users except super admins"""
    
    # Define the role_id to exclude (super admin role)
    SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b"
    
    try:
        # Get all users except super admins
        users_collection = users_db.collection
        
        # Update query: exclude users with super admin role_id
        # Prepare update data based on target status
        update_data = {
            "is_active": target_status,
            "employee_status": "active" if target_status else "inactive",
            "updated_at": datetime.now()
        }
        
        # If setting status to inactive (false), also disable login and OTP
        if not target_status:
            update_data["login_enabled"] = False
            update_data["otp_required"] = False
        
        update_result = await users_collection.update_many(
            {
                "role_id": {"$ne": SUPER_ADMIN_ROLE_ID},
                "is_employee": True
            },
            {
                "$set": update_data
            }
        )
        
        return {
            "message": f"Successfully updated {update_result.modified_count} users",
            "modified_count": update_result.modified_count,
            "target_status": target_status,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update user status: {str(e)}"
        )

@router.post("/bulk-update-login")
async def bulk_update_login_access(
    target_login_enabled: bool = Query(..., description="Target login_enabled value"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db)
):
    """Bulk update login access (login_enabled) for all users except super admins"""
    
    # Define the role_id to exclude (super admin role)
    SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b"
    
    try:
        # Get all users except super admins
        users_collection = users_db.collection
        
        # Prepare update data
        update_data = {
            "login_enabled": target_login_enabled,
            "updated_at": datetime.now()
        }
        
        # 🔒 CRITICAL: ALWAYS set session_invalidated_at timestamp
        # This ensures ALL users must re-login whether we're enabling or disabling
        # When disabling: Forces logout for offline users
        # When enabling: Forces logout for ALL users (including those already logged in)
        update_data["session_invalidated_at"] = datetime.now()
        
        if target_login_enabled:
            print(f"🔒 BULK RE-ENABLE: Setting session_invalidated_at at {datetime.now()} - All users must re-login")
        else:
            print(f"🔒 BULK DISABLE: Setting session_invalidated_at at {datetime.now()} - All users logged out")
        
        # Update query: exclude users with super admin role_id
        update_result = await users_collection.update_many(
            {
                "role_id": {"$ne": SUPER_ADMIN_ROLE_ID},
                "is_employee": True
            },
            {
                "$set": update_data
            }
        )
        
        return {
            "message": f"Successfully updated login access for {update_result.modified_count} users",
            "modified_count": update_result.modified_count,
            "target_login_enabled": target_login_enabled,
            "status": "success",
            "session_invalidated": True  # Always True now - all users must re-login
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update login access: {str(e)}"
        )

@router.post("/bulk-update-otp")
async def bulk_update_otp_requirement(
    target_otp_required: bool = Query(..., description="Target otp_required value"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db)
):
    """Bulk update OTP requirement (otp_required) for all users except super admins"""
    
    # Define the role_id to exclude (super admin role)
    SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b"
    
    try:
        # Get all users except super admins
        users_collection = users_db.collection
        
        # Update query: exclude users with super admin role_id
        update_result = await users_collection.update_many(
            {
                "role_id": {"$ne": SUPER_ADMIN_ROLE_ID},
                "is_employee": True
            },
            {
                "$set": {
                    "otp_required": target_otp_required,
                    "updated_at": datetime.now()
                }
            }
        )
        
        return {
            "message": f"Successfully updated OTP requirement for {update_result.modified_count} users",
            "modified_count": update_result.modified_count,
            "target_otp_required": target_otp_required,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update OTP requirement: {str(e)}"
        )