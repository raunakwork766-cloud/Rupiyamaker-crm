from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
import json
import os
import shutil
from uuid import uuid4
from datetime import datetime, timedelta
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.EmployeeActivity import EmployeeActivityDB
from app.schemas.user_schemas import (
    UserBase, UserCreate, UserUpdate, UserInDB, UserLogin,
    EmployeeCreate, EmployeeUpdate, EmployeeInDB, ComprehensiveEmployeeInDB,
    EmployeeStatusUpdate, OnboardingStatusUpdate, CrmAccessUpdate, LoginStatusUpdate, OtpRequirementUpdate
)
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities
from app.utils.password_encryption import password_encryptor
from app.database import get_database_instances

router = APIRouter(
    prefix="/hrms",
    tags=["HRMS"]
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

async def get_employee_activity_db():
    db_instances = get_database_instances()
    return db_instances["employee_activity"]

# ----- Employee Management Routes -----

async def get_employee_activity_db():
    db_instances = get_database_instances()
    return db_instances["employee_activity"]

# ----- Employee Management Routes -----

@router.get("/employees", response_model=List[EmployeeInDB])
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
    
    # Get employees from the database with readable passwords
    employees = await users_db.get_employees_with_readable_passwords(status, department_id)
    return [convert_object_id(employee) for employee in employees]

@router.post("/employees/with-photo", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_employee_with_photo(
    # Employee data as form fields
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    employee_id: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    role_id: Optional[str] = Form(None),
    manager_id: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    salary: Optional[float] = Form(None),
    date_of_joining: Optional[str] = Form(None),
    employment_type: Optional[str] = Form(None),
    login_enabled: Optional[bool] = Form(False),
    
    # Optional photo file
    photo: Optional[UploadFile] = File(None),
    
    # Required fields
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Create a new employee with optional photo upload in a single request"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Validate required fields
    if not first_name or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="First name and email are required"
        )
    
    # Validate photo file if provided
    if photo and photo.filename:
        # Check file type
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        file_extension = '.' + photo.filename.split('.')[-1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Check file size (max 5MB)
        if photo.size and photo.size > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photo file size cannot exceed 5MB"
            )
    
    # Check if email already exists
    existing_user = await users_db.get_user_by_email(email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee with this email already exists"
        )
    
    # Check if username already exists (if provided)
    if username:
        existing_username = await users_db.get_user_by_username(username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Check if login is enabled but credentials are missing
    if login_enabled and (not username or not password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required when login is enabled"
        )
    
    # Prepare employee data
    employee_data = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "username": username,
        "password": password,
        "department_id": department_id,
        "role_id": role_id,
        "manager_id": manager_id,
        "designation": designation,
        "salary": salary,
        "employment_type": employment_type or "full_time",
        "login_enabled": login_enabled,
        "is_employee": True,
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    # Handle date_of_joining if provided
    if date_of_joining:
        try:
            employee_data["date_of_joining"] = datetime.fromisoformat(date_of_joining.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for date_of_joining. Use ISO format."
            )
    
    # Generate employee ID if not provided
    if not employee_id:
        employee_data["employee_id"] = users_db._generate_employee_id()
    else:
        employee_data["employee_id"] = employee_id
    
    # Create the employee first
    created_employee_id = await users_db.create_employee(employee_data)
    
    # Handle photo upload if provided
    photo_path = None
    if photo and photo.filename:
        try:
            # Create directory for employee photos
            upload_dir = f"media/employees/{created_employee_id}"
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate unique filename
            file_extension = photo.filename.split(".")[-1].lower()
            filename = f"profile_{str(uuid4())}.{file_extension}"
            photo_path = f"{upload_dir}/{filename}"
            
            # Save the photo file
            with open(photo_path, "wb") as buffer:
                shutil.copyfileobj(photo.file, buffer)
            
            # Update employee record with photo path (store relative path without 'media/' prefix)
            relative_photo_path = f"employees/{created_employee_id}/{filename}"
            await users_db.update_employee(str(created_employee_id), {"profile_photo": relative_photo_path})
            
            # Log photo upload activity
            activity_db.log_photo_upload(str(created_employee_id), user_id, relative_photo_path)
            
        except Exception as e:
            # If photo upload fails, log the error but don't fail employee creation
            print(f"Photo upload failed for employee {created_employee_id}: {str(e)}")
            # You might want to add proper logging here
    
    # Log employee creation activity
    activity_db.log_employee_creation(str(created_employee_id), user_id, employee_data)
    
    return {
        "id": str(created_employee_id),
        "employee_id": employee_data["employee_id"],
        "message": "Employee created successfully",
        "photo_uploaded": "true" if photo_path else "false"
    }

@router.post("/employees", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee: EmployeeCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Create a new employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Set default values for employee
    employee_dict = employee.dict()
    employee_dict["is_employee"] = True
    
    # Create the employee
    employee_id = await users_db.create_employee(employee_dict)
    
    # Log activity
    activity_db.log_employee_creation(str(employee_id), user_id, employee_dict)
    
    return {"id": str(employee_id)}

@router.get("/employees/comprehensive", response_model=List[ComprehensiveEmployeeInDB])
async def list_comprehensive_employees(
    user_id: str = Query(..., description="ID of the user making the request"),
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List all employees with comprehensive data including all personal and employment information"""
    # Check permission
    # await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Get employees from the database
    employees = await users_db.get_employees(status, department_id)
    return [convert_object_id(employee) for employee in employees]

@router.get("/employees/{employee_id}", response_model=EmployeeInDB)
async def get_employee(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific employee by ID"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Get the employee from the database with readable password
    employee = await users_db.get_user_with_readable_password(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
        
    return convert_object_id(employee)

@router.put("/employees/{employee_id}", response_model=Dict[str, str])
async def update_employee(
    employee_id: str,
    employee_update: EmployeeUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Update an existing employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists and get original data
    original_employee = await users_db.get_user(employee_id)
    if not original_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Get update data
    update_data = employee_update.dict(exclude_unset=True)
    
    # Update the employee
    updated = await users_db.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update employee with ID {employee_id}"
        )
    
    # Log activity with before/after tracking
    if update_data:
        activity_db.log_employee_update(employee_id, user_id, update_data, original_employee)
        
    return {"status": "Employee updated successfully"}

@router.post("/employees/upload-photo/{employee_id}")
async def upload_employee_photo(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    file: UploadFile = File(...),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Upload profile photo for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
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
            detail="Photo file size cannot exceed 5MB"
        )
    
    try:
        # Create directory if it doesn't exist
        upload_dir = f"media/employees/{employee_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        filename = f"profile_{str(uuid4())}{file_extension}"
        file_path = f"{upload_dir}/{filename}"
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update employee profile with photo path (store relative path without 'media/' prefix)
        relative_file_path = f"employees/{employee_id}/{filename}"
        success = await users_db.update_employee(employee_id, {"profile_photo": relative_file_path})
        if not success:
            # Clean up uploaded file if database update fails
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update employee record with photo"
            )
        
        # Log photo upload activity
        try:
            activity_db.log_photo_upload(employee_id, user_id, relative_file_path)
        except Exception as e:
            print(f"Warning: Failed to log photo upload activity: {str(e)}")
        
        return {
            "message": "Photo uploaded successfully",
            "filename": filename,
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
            detail=f"Failed to upload photo: {str(e)}"
        )

@router.patch("/employees/{employee_id}/status", response_model=Dict[str, str])
async def update_employee_status(
    employee_id: str,
    status_update: EmployeeStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Update employee active/inactive status"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists and get current status
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Get old status for logging
    old_status = employee.get("employee_status", "active")
    
    # Update the status
    update_data = {
        "employee_status": status_update.status,
        "status_remark": status_update.remark,
        "status_updated_at": datetime.now()
    }
    
    updated = await users_db.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status for employee with ID {employee_id}"
        )
    
    # Log status change activity
    activity_db.log_status_change(employee_id, user_id, old_status, status_update.status, status_update.remark)
        
    return {"status": f"Employee status updated to {status_update.status}"}

@router.patch("/employees/{employee_id}/onboarding", response_model=Dict[str, str])
async def update_onboarding_status(
    employee_id: str,
    onboarding_update: OnboardingStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update employee onboarding status"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update the onboarding status
    update_data = {
        "onboarding_status": onboarding_update.status,
        "onboarding_remark": onboarding_update.remark,
        "onboarding_updated_at": datetime.now()
    }
    
    updated = await users_db.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update onboarding status for employee with ID {employee_id}"
        )
        
    return {"status": f"Onboarding status updated to {onboarding_update.status}"}

@router.patch("/employees/{employee_id}/crm-access", response_model=Dict[str, str])
async def update_crm_access(
    employee_id: str,
    access_update: CrmAccessUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update employee CRM access"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update CRM access
    update_data = {"has_crm_access": access_update.has_access}
    
    updated = await users_db.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update CRM access for employee with ID {employee_id}"
        )
        
    return {"status": f"CRM access {'granted' if access_update.has_access else 'revoked'}"}

@router.patch("/employees/{employee_id}/login-enabled", response_model=Dict[str, str])
async def update_login_enabled(
    employee_id: str,
    login_update: LoginStatusUpdate,
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
    updated = await users_db.update_login_status(employee_id, login_update.enabled)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update login enabled status for employee with ID {employee_id}"
        )
        
    return {"status": f"Login access {'enabled' if login_update.enabled else 'disabled'}"}

@router.patch("/employees/{employee_id}/login", response_model=Dict[str, str])
async def update_login_status(
    employee_id: str,
    login_update: LoginStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Enable or disable employee login"""
    # Check create
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Update login status
    update_data = {"is_active": login_update.enabled}
    
    updated = await users_db.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update login status for employee with ID {employee_id}"
        )
    
    # Log login status change activity
    activity_db.log_login_status_change(employee_id, user_id, login_update.enabled)
        
    return {"status": f"Login {'enabled' if login_update.enabled else 'disabled'} for employee"}

# ----- Enhanced Employee Management Routes -----

@router.post("/employees/create-with-all-details", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_employee_with_all_details(
    # Personal Information
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    dob: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    marital_status: Optional[str] = Form(None),
    nationality: str = Form("Indian"),
    blood_group: Optional[str] = Form(None),
    emergency_contact_name: Optional[str] = Form(None),
    emergency_contact_phone: Optional[str] = Form(None),
    
    # Contact Information
    phone: Optional[str] = Form(None),
    alternate_phone: Optional[str] = Form(None),
    work_email: Optional[str] = Form(None),
    
    # Employment Details
    employee_id: Optional[str] = Form(None),
    joining_date: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    role_id: Optional[str] = Form(None),
    employee_status: str = Form("active"),
    salary: Optional[float] = Form(None),
    work_location: Optional[str] = Form(None),
    mac_address: Optional[str] = Form(None),
    employment_type: str = Form("full_time"),
    
    # Login Credentials
    username: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    confirm_password: Optional[str] = Form(None),
    
    # Account Management
    onboarding_status: str = Form("pending"),
    crm_access: bool = Form(False),
    login_enabled: bool = Form(False),
    
    # Profile Photo
    profile_photo: Optional[UploadFile] = File(None),
    
    # Required fields
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Create a new employee with all details including optional photo upload"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Validate required fields
    if not first_name or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="First name and email are required"
        )
    
    # Validate photo file if provided
    if profile_photo and profile_photo.filename:
        # Check file type
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
                detail="Photo file size cannot exceed 5MB"
            )
    
    # Validate password confirmation if passwords are provided
    if password and confirm_password and password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match"
        )
    
    # Check if login is enabled but credentials are missing
    if login_enabled and (not username or not password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required when login is enabled"
        )
    
    # Check if email already exists
    existing_user = await users_db.get_user_by_email(email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee with this email already exists"
        )
    
    # Check if username already exists (if provided)
    if username:
        existing_username = await users_db.get_user_by_username(username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Prepare employee data
    employee_data = {
        # Personal Information
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "gender": gender,
        "marital_status": marital_status,
        "nationality": nationality,
        "blood_group": blood_group,
        "emergency_contact_name": emergency_contact_name,
        "emergency_contact_phone": emergency_contact_phone,
        
        # Contact Information
        "phone": phone,
        "alternate_phone": alternate_phone,
        "work_email": work_email or email,  # Use main email as work email if not provided
        
        # Employment Details
        "department_id": department_id,
        "role_id": role_id,
        "designation": designation,
        "salary": salary,
        "work_location": work_location,
        "mac_address": mac_address,
        "employment_type": employment_type,
        "employee_status": employee_status,
        
        # Login Credentials
        "username": username,
        "password": password,
        "login_enabled": login_enabled,
        
        # Account Management
        "onboarding_status": onboarding_status,
        "crm_access": crm_access,
        
        # System fields
        "is_employee": True,
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    # Handle date fields
    if dob:
        try:
            employee_data["dob"] = datetime.strptime(dob, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for date of birth. Use YYYY-MM-DD format."
            )
    
    if joining_date:
        try:
            employee_data["joining_date"] = datetime.strptime(joining_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for joining date. Use YYYY-MM-DD format."
            )
    
    # Generate employee ID if not provided
    if not employee_id:
        employee_data["employee_id"] = users_db._generate_employee_id()
    else:
        employee_data["employee_id"] = employee_id
    
    # Create the employee first
    try:
        created_employee_id = await users_db.create_employee(employee_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create employee: {str(e)}"
        )
    
    # Handle photo upload if provided
    photo_path = None
    if profile_photo and profile_photo.filename:
        try:
            # Create directory for employee photos
            upload_dir = f"media/employees/{created_employee_id}"
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate unique filename
            file_extension = profile_photo.filename.split(".")[-1].lower()
            filename = f"profile_{str(uuid4())}.{file_extension}"
            photo_path = f"{upload_dir}/{filename}"
            
            # Save the photo file
            with open(photo_path, "wb") as buffer:
                shutil.copyfileobj(profile_photo.file, buffer)
            
            # Update employee record with photo path (store relative path without 'media/' prefix)
            relative_photo_path = f"employees/{created_employee_id}/{filename}"
            await users_db.update_employee(str(created_employee_id), {"profile_photo": relative_photo_path})
            
            # Log photo upload activity
            activity_db.log_photo_upload(str(created_employee_id), user_id, relative_photo_path)
            
        except Exception as e:
            # If photo upload fails, log the error but don't fail employee creation
            print(f"Photo upload failed for employee {created_employee_id}: {str(e)}")
    
    # Log employee creation activity
    try:
        activity_db.log_employee_creation(str(created_employee_id), user_id, employee_data)
    except Exception as e:
        print(f"Warning: Failed to log activity for employee creation: {str(e)}")
    
    return {
        "id": str(created_employee_id),
        "employee_id": employee_data["employee_id"],
        "message": "Employee created successfully with all details",
        "photo_uploaded": "true" if photo_path else "false",
        "status": "success"
    }

@router.put("/employees/{employee_id}/comprehensive", response_model=Dict[str, str])
async def update_comprehensive_employee(
    employee_id: str,
    employee_update: EmployeeUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Update an existing employee with comprehensive data"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists and get original data
    original_employee = await users_db.get_user(employee_id)
    if not original_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Get update data
    update_data = employee_update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.now()
    
    # If email is being updated, check for duplicates
    if "email" in update_data:
        existing_user = await users_db.get_user_by_email(update_data["email"])
        if existing_user and str(existing_user["_id"]) != employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another employee with this email already exists"
            )
    
    # Update the employee
    updated = await users_db.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update employee with ID {employee_id}"
        )
    
    # Log activity with before/after tracking
    if update_data:
        activity_db.log_employee_update(employee_id, user_id, update_data, original_employee)
        
    return {"status": "Employee updated successfully"}

@router.post("/employees/{employee_id}/change-password", response_model=Dict[str, str])
async def change_employee_password(
    employee_id: str,
    password_data: dict,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Change password for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Extract new password
    new_password = password_data.get("new_password")
    if not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password is required"
        )
    
    # Validate password strength (minimum 8 characters)
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    
    # Change password
    success = await users_db.change_password(employee_id, new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )
    
    # Log password change activity
    activity_db.log_password_change(employee_id, user_id)
    
    return {"status": "Password changed successfully"}

@router.post("/employees/{employee_id}/reset-password", response_model=Dict[str, str])
async def reset_employee_password(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Reset password for an employee to a default temporary password"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Reset password
    temp_password = await users_db.reset_password(employee_id)
    if not temp_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )
    
    return {
        "status": "Password reset successfully",
        "temporary_password": temp_password,
        "message": "Employee should change this password on first login"
    }

@router.get("/employees/search/by-employee-id/{emp_id}", response_model=EmployeeInDB)
async def get_employee_by_employee_id(
    emp_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get employee by their employee ID (3-digit ID)"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Get the employee from the database
    employee = await users_db.get_employee_by_employee_id(emp_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with employee ID {emp_id} not found"
        )
        
    return convert_object_id(employee)

@router.get("/employees/validate/employee-id/{emp_id}", response_model=Dict[str, bool])
async def validate_employee_id(
    emp_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Check if employee ID is available"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Check if employee ID exists
    employee = await users_db.get_employee_by_employee_id(emp_id)
    
    return {
        "available": employee is None,
        "exists": employee is not None
    }

# ----- Employee Activity Routes -----

@router.get("/employees/{employee_id}/activities", response_model=List[Dict[str, Any]])
async def get_employee_activities(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    limit: int = Query(50, description="Maximum number of activities to return"),
    offset: int = Query(0, description="Number of activities to skip"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Get activity logs for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Get activities
    activities = await activity_db.get_employee_activities(employee_id, limit, offset, activity_type)
    
    # Enrich activities with user names
    for activity in activities:
        if activity.get("created_by"):
            creator = await users_db.get_user(activity["created_by"])
            if creator:
                activity["performed_by_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
            else:
                activity["performed_by_name"] = "Unknown User"
        else:
            activity["performed_by_name"] = "System"
    
    return activities

@router.get("/employees/{employee_id}/activities/summary", response_model=Dict[str, Any])
async def get_employee_activity_summary(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Get activity summary for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Get all activities for counting
    all_activities = await activity_db.get_employee_activities(employee_id, limit=1000)
    
    # Count activities by type
    activity_counts = {}
    recent_activities = []
    
    for activity in all_activities:
        activity_type = activity.get("activity_type", "unknown")
        activity_counts[activity_type] = activity_counts.get(activity_type, 0) + 1
        
        # Get recent activities (last 10)
        if len(recent_activities) < 10:
            recent_activities.append({
                "type": activity_type,
                "description": activity.get("description", ""),
                "timestamp": activity.get("timestamp", activity.get("created_at"))
            })
    
    return {
        "total_activities": len(all_activities),
        "activity_counts": activity_counts,
        "recent_activities": recent_activities,
        "employee_id": employee_id
    }

@router.post("/employees/{employee_id}/activity", response_model=Dict[str, str])
async def log_employee_activity(
    employee_id: str,
    activity_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Log an activity for an employee"""
    # Check permission
    await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    employee = await users_db.get_user(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Prepare activity data
    activity_record = {
        "employee_id": employee_id,
        "activity_type": "toggle_change",
        "action": activity_data.get("action", ""),
        "description": activity_data.get("description", ""),
        "timestamp": activity_data.get("timestamp", datetime.now().isoformat()),
        "performed_by": activity_data.get("performed_by", user_id),
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
    }
    
    # Log the activity
    activity_id = await activity_db.log_activity(activity_record)
    
    return {"status": "Activity logged successfully", "activity_id": activity_id}

@router.patch("/employees/{employee_id}/update-dict")
async def update_employee_dict(
    employee_id: str,
    update_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """
    Update employee with dictionary data - accepts any fields in payload
    Whatever comes in the payload gets updated directly in the database
    """
    # Check permission only if user is updating someone else's data
    # Users can always update their own password without needing permissions
    if str(employee_id) != str(user_id):
        await check_permission(user_id, "employees", "show", users_db, roles_db)
    
    # Verify employee exists
    original_employee = await users_db.get_user(employee_id)
    if not original_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found"
        )
    
    # Handle password encryption if password is in payload
    if 'password' in update_data and update_data['password']:
        # Let the database method handle password encryption
        pass
    
    # Add update timestamp
    update_data['updated_at'] = datetime.now()
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    if not update_data:
        return {"status": "No fields to update", "employee_id": employee_id}
    
    # Update the employee directly with whatever is in the payload
    try:
        updated = await users_db.update_employee(employee_id, update_data)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update employee with ID {employee_id}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    
    # Log activity
    try:
        activity_db.log_employee_update(employee_id, user_id, update_data, original_employee)
    except Exception as e:
        # Don't fail the update if activity logging fails
        print(f"Warning: Failed to log activity: {str(e)}")
    
    return {
        "status": "Employee updated successfully",
        "employee_id": employee_id,
        "updated_fields": list(update_data.keys()),
        "total_fields_updated": len(update_data)
    }
