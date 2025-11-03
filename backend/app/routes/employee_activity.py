from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
from app.database.EmployeeActivity import EmployeeActivityDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities
from app.database import get_database_instances
from pydantic import BaseModel

router = APIRouter(
    prefix="/hrms/employees",
    tags=["Employee Activity"]
)

# Dependency to get the DB instances
async def get_employee_activity_db():
    db_instances = get_database_instances()
    return db_instances["employee_activity"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

# Helper function to enrich activity data with human-readable names
async def enrich_activity_data(activity: Dict[str, Any], users_db: UsersDB, roles_db: RolesDB, departments_db: DepartmentsDB) -> Dict[str, Any]:
    """Enrich activity data by resolving IDs to human-readable names"""
    
    # Helper function to get user name
    async def get_user_name(user_id: str) -> Optional[str]:
        if not user_id:
            return None
        user = await users_db.get_user(user_id)
        if user:
            name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            return name if name else user.get('username', 'Unknown User')
        return 'Unknown User'
    
    # Helper function to get role name
    async def get_role_name(role_id: str) -> Optional[str]:
        if not role_id:
            return None
        role = await roles_db.get_role(role_id)
        return role.get('name', 'Unknown Role') if role else 'Unknown Role'
    
    # Helper function to get department name
    async def get_department_name(dept_id: str) -> Optional[str]:
        if not dept_id:
            return None
        dept = await departments_db.get_department(dept_id)
        return dept.get('name', 'Unknown Department') if dept else 'Unknown Department'
    
    # Enrich main activity fields
    enriched_activity = activity.copy()
    
    # Resolve created_by and performed_by
    if activity.get('created_by'):
        enriched_activity['created_by_name'] = await get_user_name(activity['created_by'])
    
    if activity.get('performed_by'):
        enriched_activity['performed_by_name'] = await get_user_name(activity['performed_by'])
    
    # Resolve employee_id to employee name
    if activity.get('employee_id'):
        enriched_activity['employee_name'] = await get_user_name(activity['employee_id'])
    
    # Enrich details section if it exists
    if activity.get('details'):
        details = activity['details'].copy()
        
        # Enrich employee_info section
        if 'employee_info' in details:
            emp_info = details['employee_info'].copy()
            
            # Resolve department ID to name
            if emp_info.get('department'):
                emp_info['department_name'] = await get_department_name(emp_info['department'])
            
            # Resolve role ID to name
            if emp_info.get('role'):
                emp_info['role_name'] = await get_role_name(emp_info['role'])
            
            # Resolve reporting manager ID to name
            if emp_info.get('reporting_manager'):
                emp_info['reporting_manager_name'] = await get_user_name(emp_info['reporting_manager'])
            
            details['employee_info'] = emp_info
        
        # Enrich field_changes section
        if 'field_changes' in details:
            field_changes = details['field_changes'].copy()
            
            for field_name, field_data in field_changes.items():
                if field_name == 'department_id':
                    # Resolve department IDs
                    if field_data.get('from'):
                        field_data['from_name'] = await get_department_name(field_data['from'])
                    if field_data.get('to'):
                        field_data['to_name'] = await get_department_name(field_data['to'])
                
                elif field_name == 'role_id':
                    # Resolve role IDs
                    if field_data.get('from'):
                        field_data['from_name'] = await get_role_name(field_data['from'])
                    if field_data.get('to'):
                        field_data['to_name'] = await get_role_name(field_data['to'])
                
                elif field_name == 'reporting_manager':
                    # Resolve user IDs
                    if field_data.get('from'):
                        field_data['from_name'] = await get_user_name(field_data['from'])
                    if field_data.get('to'):
                        field_data['to_name'] = await get_user_name(field_data['to'])
        
        enriched_activity['details'] = details
    
    return enriched_activity

# Pydantic models for request/response
class EmployeeActivityInDB(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    activity_type: str
    description: str
    details: Optional[Dict[str, Any]] = None
    created_by: str
    created_by_name: Optional[str] = None
    performed_by: Optional[str] = None
    performed_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    timestamp: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

@router.get("/{employee_id}/activities", response_model=List[EmployeeActivityInDB])
async def get_employee_activities(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    limit: int = Query(100, description="Number of activities to return"),
    offset: int = Query(0, description="Number of activities to skip"),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get all activities for an employee with enriched names"""
    try:
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
        
        # Enhance activities with names
        response_activities = []
        for activity in activities:
            # Enrich the activity data with human-readable names
            enriched_activity = await enrich_activity_data(activity, users_db, roles_db, departments_db)
            
            response_activities.append(EmployeeActivityInDB(
                id=str(enriched_activity["_id"]),
                employee_id=enriched_activity["employee_id"],
                employee_name=enriched_activity.get("employee_name"),
                activity_type=enriched_activity["activity_type"],
                description=enriched_activity["description"],
                details=enriched_activity.get("details"),
                created_by=enriched_activity["created_by"],
                created_by_name=enriched_activity.get("created_by_name"),
                performed_by=enriched_activity.get("performed_by"),
                performed_by_name=enriched_activity.get("performed_by_name"),
                created_at=enriched_activity["created_at"],
                updated_at=enriched_activity["updated_at"],
                timestamp=enriched_activity.get("timestamp")
            ))
        
        return response_activities
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching activities: {str(e)}"
        )

@router.get("/{employee_id}/activities/types", response_model=List[str])
async def get_employee_activity_types(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all activity types for filtering"""
    try:
        # Check permission
        await check_permission(user_id, "employees", "show", users_db, roles_db)
        
        # Return comprehensive activity types
        activity_types = [
            "employee_created",
            "profile_updated", 
            "status_changed",
            "attachment_uploaded",
            "attachment_deleted",
            "remark_added",
            "password_changed",
            "login_status_changed",
            "photo_uploaded"
        ]
        
        return activity_types
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching activity types: {str(e)}"
        )

@router.get("/activities/all", response_model=List[EmployeeActivityInDB])
async def get_all_activities(
    user_id: str = Query(..., description="ID of the user making the request"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    employee_id: Optional[str] = Query(None, description="Filter by specific employee"),
    limit: int = Query(50, description="Number of activities to return"),
    offset: int = Query(0, description="Number of activities to skip"),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get all activities across the system with enriched names (admin function)"""
    try:
        # Check admin permission - only admins should see all activities
        await check_permission(user_id, "employees", "all_employees", users_db, roles_db)
        
        # Get all activities with filters
        activities = await activity_db.get_all_activities(limit, offset, activity_type, employee_id)
        
        # Enhance activities with names
        response_activities = []
        for activity in activities:
            # Enrich the activity data with human-readable names
            enriched_activity = await enrich_activity_data(activity, users_db, roles_db, departments_db)
            
            response_activities.append(EmployeeActivityInDB(
                id=str(enriched_activity["_id"]),
                employee_id=enriched_activity["employee_id"],
                employee_name=enriched_activity.get("employee_name"),
                activity_type=enriched_activity["activity_type"],
                description=enriched_activity["description"],
                details=enriched_activity.get("details"),
                created_by=enriched_activity["created_by"],
                created_by_name=enriched_activity.get("created_by_name"),
                performed_by=enriched_activity.get("performed_by"),
                performed_by_name=enriched_activity.get("performed_by_name"),
                created_at=enriched_activity["created_at"],
                updated_at=enriched_activity["updated_at"],
                timestamp=enriched_activity.get("timestamp")
            ))
        
        return response_activities
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching all activities: {str(e)}"
        )

# Pydantic model for logging activity
class LogActivityRequest(BaseModel):
    employee_id: str
    activity_type: str
    description: str
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None
    performed_by: Optional[str] = None
    created_by: str

@router.post("/{employee_id}/activities", response_model=Dict[str, str])
async def log_employee_activity(
    employee_id: str,
    activity_data: LogActivityRequest,
    user_id: str = Query(..., description="ID of the user making the request"),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Log a new activity for an employee"""
    try:
        # Check permission
        await check_permission(user_id, "employees", "update", users_db, roles_db)
        
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
            "activity_type": activity_data.activity_type,
            "description": activity_data.description,
            "details": activity_data.details or {},
            "created_by": activity_data.created_by or user_id,
            "performed_by": activity_data.performed_by or user_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Add timestamp if provided
        if activity_data.timestamp:
            try:
                # Parse the timestamp and use it
                activity_record["timestamp"] = activity_data.timestamp
            except:
                # If timestamp parsing fails, use current time
                activity_record["timestamp"] = datetime.utcnow().isoformat()
        else:
            activity_record["timestamp"] = datetime.utcnow().isoformat()
        
        # Log the activity
        activity_id = await activity_db.log_activity(activity_record)
        
        return {
            "message": "Activity logged successfully",
            "activity_id": str(activity_id),
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error logging activity: {str(e)}"
        )