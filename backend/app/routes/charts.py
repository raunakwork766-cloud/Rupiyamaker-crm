from fastapi import APIRouter, HTTPException, Depends, status as http_status, Query
from typing import Dict, List, Any, Optional
from bson import ObjectId
from datetime import datetime
from app.database import db
from app.database.Departments import DepartmentsDB
from app.database.Roles import RolesDB
from app.database.Users import UsersDB
from app.utils.common_utils import convert_object_id
from app.utils.permissions import check_permission
from app.database import get_database_instances

router = APIRouter(
    prefix="/charts",
    tags=["Charts"]
)

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

@router.get("/department-hierarchy")
async def get_department_hierarchy(
    user_id: str = Query(..., description="ID of the user making the request"),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get hierarchical view of departments and their sub-departments
    Returns a tree structure for visualization in charts
    """
    try:
        # Check permission - updated to new permission structure
        # Try both cases for charts permission
        try:
            await check_permission(user_id, "charts", "show", users_db, roles_db)
        except:
            # If first check fails, try with capitalized version
            await check_permission(user_id, "Charts", "show", users_db, roles_db)
        
        # Get all departments
        all_departments = await departments_db.list_departments()
        
        # Convert ObjectId to strings and find root departments
        departments_map = {}
        root_departments = []
        
        for dept in all_departments:
            dept_id = str(dept["_id"])
            dept_dict = convert_object_id(dept)
            dept_dict["children"] = []  # Will hold sub-departments
            dept_dict["type"] = "department"
            dept_dict["user_count"] = 0
            dept_dict["role_count"] = 0
            departments_map[dept_id] = dept_dict
            
            # Root departments have no parent_department_id or parent_department_id is None
            if not dept.get("parent_department_id") and not dept.get("parent_id"):
                root_departments.append(dept_dict)
        
        # Build hierarchy - assign children to their parents
        for dept_id, dept in departments_map.items():
            parent_id = dept.get("parent_department_id") or dept.get("parent_id")
            if parent_id and parent_id in departments_map:
                departments_map[parent_id]["children"].append(dept)
        
        # Add department stats - number of users and roles in each department
        for dept_id, dept in departments_map.items():
            # Count users directly in this department
            user_count = await users_db.count_users({"department_id": dept_id})
            
            # Count roles in this department
            role_count = await roles_db.count_roles({"department_id": dept_id})
            
            dept["user_count"] = user_count
            dept["role_count"] = role_count
            
            # Get direct users in this department
            users_in_dept = await users_db.list_users({"department_id": dept_id})
            dept["users"] = [
                {
                    "id": str(user["_id"]),
                    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("username", ""),
                    "email": user.get("email", ""),
                    "phone": user.get("phone", ""),
                    "status": user.get("status", "active"),
                    "role_name": user.get("role_name", ""),
                    "job_title": user.get("job_title", ""),
                    "type": "user"
                }
                for user in users_in_dept
            ]
        
        # Calculate totals recursively for parent departments
        def calculate_department_totals(dept):
            """Recursively calculate user and role counts"""
            total_users = dept["user_count"]
            total_roles = dept["role_count"]
            
            for child in dept["children"]:
                sub_users, sub_roles = calculate_department_totals(child)
                total_users += sub_users
                total_roles += sub_roles
            
            dept["total_user_count"] = total_users
            dept["total_role_count"] = total_roles
            return total_users, total_roles
        
        for dept in root_departments:
            calculate_department_totals(dept)
        
        return {
            "success": True,
            "departments": root_departments,
            "summary": {
                "total_departments": len(all_departments),
                "total_users": sum(users_db.count_users({"department_id": str(dept["_id"])}) for dept in all_departments),
                "total_roles": sum(roles_db.count_roles({"department_id": str(dept["_id"])}) for dept in all_departments)
            },
            "metadata": {
                "hierarchy": "Department → Sub-Department",
                "last_updated": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"Error in department hierarchy API: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch department hierarchy: {str(e)}"
        )

@router.get("/role-hierarchy")
async def get_role_hierarchy(
    user_id: str = Query(..., description="ID of the user making the request"),
    include_users: bool = Query(True, description="Whether to include user data within roles"),
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Get hierarchical view of roles and their sub-roles with users
    Returns a tree structure for visualization in charts
    """
    try:
        # Check permission
        await check_permission(user_id, "charts", "show", users_db, roles_db)
        
        # Get all roles
        all_roles = await roles_db.list_roles()
        
        # Convert ObjectId to strings and find root roles
        roles_map = {}
        root_roles = []
        
        for role in all_roles:
            role_id = str(role["_id"])
            role_dict = convert_object_id(role)
            role_dict["children"] = []  # Will hold sub-roles
            role_dict["users"] = []    # Will hold users
            role_dict["user_count"] = 0
            role_dict["type"] = "role"
            roles_map[role_id] = role_dict
            
            # Root roles have no parent_id, reporting_id, or they are None
            if not role.get("parent_role_id") and not role.get("reporting_id"):
                root_roles.append(role_dict)
        
        # Build hierarchy - assign children to their parents
        for role_id, role in roles_map.items():
            parent_id = role.get("parent_role_id") or role.get("reporting_id")
            if parent_id and parent_id in roles_map:
                roles_map[parent_id]["children"].append(role)
        
        # Get all users and assign them to roles
        all_users = await users_db.list_users()
        
        for user in all_users:
            user_role_id = user.get("role_id")
            if user_role_id and user_role_id in roles_map:
                user_dict = convert_object_id(user)
                user_dict["type"] = "user"
                user_dict["name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("username", "")
                user_dict["email"] = user.get("email", "")
                user_dict["phone"] = user.get("phone", "")
                user_dict["status"] = user.get("status", "active")
                user_dict["department_name"] = user.get("department_name", "")
                user_dict["job_title"] = user.get("job_title", "")
                
                if include_users:
                    roles_map[user_role_id]["children"].append(user_dict)
                
                roles_map[user_role_id]["user_count"] += 1
        
        # Calculate total user counts including sub-roles
        def calculate_total_users(role):
            """Recursively calculate total users in role and sub-roles"""
            total = len([child for child in role["children"] if child["type"] == "user"])
            for child in role["children"]:
                if child["type"] == "role":
                    total += calculate_total_users(child)
            role["total_user_count"] = total
            return total
        
        for role in root_roles:
            calculate_total_users(role)
        
        return {
            "success": True,
            "roles": root_roles,
            "summary": {
                "total_roles": len(all_roles),
                "total_users": len(all_users)
            },
            "metadata": {
                "hierarchy": "Role → Sub-Role → Users",
                "include_users": include_users,
                "last_updated": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"Error in role hierarchy API: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch role hierarchy: {str(e)}"
        )

@router.get("/users-by-role/{role_id}")
async def get_users_by_role(
    role_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get users for a specific role
    Useful for on-demand loading when expanding a role in the chart
    """
    # Check permission
    await check_permission(user_id, "charts", "show", users_db, roles_db)
    
    # Verify role exists
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
    
    # Get users for this role
    users = await users_db.get_users_by_role(role_id)
    
    # Format user data
    formatted_users = [
        {
            "id": str(user["_id"]),
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "status": user.get("status", "active"),
            "department_name": user.get("department_name", ""),
            "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else None
        } 
        for user in users
    ]
    
    return {
        "role_id": role_id,
        "role_name": role.get("name", ""),
        "users": formatted_users,
        "total": len(formatted_users)
    }

@router.get("/organization-structure")
async def get_organization_structure(
    user_id: str = Query(..., description="ID of the user making the request"),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Get complete organization structure with departments, sub-departments, roles, sub-roles and users
    Returns a complete hierarchical view: Department -> Sub-Department -> Role -> Sub-Role -> Users
    """
    try:
        # Check permissions
        await check_permission(user_id, "charts", "show", users_db, roles_db)
        await check_permission(user_id, "charts", "show", users_db, roles_db)
        await check_permission(user_id, "charts", "show", users_db, roles_db)
        
        # Get all departments
        all_departments = await departments_db.list_departments()
        
        # Convert ObjectId to strings and create department map
        departments_map = {}
        root_departments = []
        
        for dept in all_departments:
            dept_id = str(dept["_id"])
            dept_dict = convert_object_id(dept)
            dept_dict["children"] = []  # Will hold sub-departments and roles
            dept_dict["type"] = "department"
            dept_dict["user_count"] = 0  # Will be calculated later
            dept_dict["role_count"] = 0  # Will be calculated later
            dept_dict["expanded"] = False  # For UI state
            departments_map[dept_id] = dept_dict
            
            # Root departments have no parent_department_id or parent_department_id is None
            if not dept.get("parent_department_id") and not dept.get("parent_id"):
                root_departments.append(dept_dict)
        
        # Build department hierarchy - assign sub-departments to their parents
        for dept_id, dept in departments_map.items():
            parent_id = dept.get("parent_department_id") or dept.get("parent_id")
            if parent_id and parent_id in departments_map:
                departments_map[parent_id]["children"].append(dept)
        
        # Get all roles
        all_roles = await roles_db.list_roles()
        
        # Create role map and organize by department
        roles_map = {}
        roles_by_department = {}
        
        for role in all_roles:
            role_id = str(role["_id"])
            role_dict = convert_object_id(role)
            role_dict["children"] = []  # Will hold sub-roles and users
            role_dict["type"] = "role"
            role_dict["user_count"] = 0
            role_dict["expanded"] = False
            roles_map[role_id] = role_dict
            
            # Group roles by department
            dept_id = role.get("department_id")
            if dept_id:
                if dept_id not in roles_by_department:
                    roles_by_department[dept_id] = []
                roles_by_department[dept_id].append(role_dict)
        
        # Build role hierarchy within each department
        for dept_id, roles_list in roles_by_department.items():
            root_roles = []
            
            for role in roles_list:
                parent_role_id = role.get("reporting_id")
                if parent_role_id and parent_role_id in roles_map:
                    # This role has a parent, add it to parent's children
                    roles_map[parent_role_id]["children"].append(role)
                else:
                    # This is a root role in this department
                    root_roles.append(role)
            
            # Add root roles to the department
            if dept_id in departments_map:
                departments_map[dept_id]["children"].extend(root_roles)
                departments_map[dept_id]["role_count"] = len(root_roles)
        
        # Get all users and assign them to roles
        all_users = await users_db.list_users()
        users_count_by_role = {}
        
        for user in all_users:
            user_dict = convert_object_id(user)
            user_dict["type"] = "user"
            user_dict["name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("username", "")
            user_dict["email"] = user.get("email", "")
            user_dict["phone"] = user.get("phone", "")
            user_dict["status"] = user.get("status", "active")
            user_dict["department_name"] = user.get("department_name", "")
            user_dict["job_title"] = user.get("job_title", "")
            
            # Assign user to their role
            role_id = user.get("role_id")
            if role_id:
                if role_id not in users_count_by_role:
                    users_count_by_role[role_id] = []
                users_count_by_role[role_id].append(user_dict)
                
                if role_id in roles_map:
                    roles_map[role_id]["children"].append(user_dict)
                    roles_map[role_id]["user_count"] += 1
        
        # Calculate totals for departments recursively
        def calculate_department_totals(dept):
            """Recursively calculate user and role counts"""
            total_users = 0
            total_roles = 0
            
            for child in dept["children"]:
                if child["type"] == "department":
                    # Sub-department - recurse
                    sub_users, sub_roles = calculate_department_totals(child)
                    total_users += sub_users
                    total_roles += sub_roles
                elif child["type"] == "role":
                    # Direct role in this department
                    total_roles += 1
                    
                    # Count users in this role and all sub-roles
                    def count_role_users(role):
                        user_count = len([c for c in role["children"] if c["type"] == "user"])
                        for sub_child in role["children"]:
                            if sub_child["type"] == "role":
                                user_count += count_role_users(sub_child)
                        return user_count
                    
                    role_users = count_role_users(child)
                    total_users += role_users
                    
                    # Count sub-roles
                    def count_sub_roles(role):
                        sub_role_count = 0
                        for sub_child in role["children"]:
                            if sub_child["type"] == "role":
                                sub_role_count += 1 + count_sub_roles(sub_child)
                        return sub_role_count
                    
                    total_roles += count_sub_roles(child)
            
            dept["user_count"] = total_users
            dept["role_count"] = total_roles
            return total_users, total_roles
        
        # Calculate totals for all root departments
        for dept in root_departments:
            calculate_department_totals(dept)
        
        return {
            "success": True,
            "organization": root_departments,
            "summary": {
                "departments_count": len(all_departments),
                "roles_count": len(all_roles),
                "users_count": len(all_users)
            },
            "metadata": {
                "hierarchy": "Department → Sub-Department → Role → Sub-Role → Users",
                "description": "Complete organizational hierarchy with all levels",
                "last_updated": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"Error in organization structure API: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch organization structure: {str(e)}"
        )

@router.get("/department-users/{department_id}")
async def get_users_by_department(
    department_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """
    Get all users in a specific department including sub-departments
    """
    # Check permission
    await check_permission(user_id, "charts", "show", users_db, roles_db)
    
    # Verify department exists
    department = await departments_db.get_department(department_id)
    if not department:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {department_id} not found"
        )
    
    # Get all users in this department and its sub-departments
    async def get_all_dept_users(dept_id, visited=None):
        if visited is None:
            visited = set()
        
        if dept_id in visited:
            return []
        
        visited.add(dept_id)
        users = await users_db.list_users({"department_id": dept_id})
        
        # Get sub-departments
        sub_departments = await departments_db.list_departments({"parent_department_id": dept_id})
        for sub_dept in sub_departments:
            sub_dept_id = str(sub_dept["_id"])
            users.extend(await get_all_dept_users(sub_dept_id, visited))
        
        return users
    
    all_users = await get_all_dept_users(department_id)
    
    # Format user data
    formatted_users = [
        {
            "id": str(user["_id"]),
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "status": user.get("status", "active"),
            "role_name": user.get("role_name", ""),
            "department_name": user.get("department_name", ""),
            "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else None
        } 
        for user in all_users
    ]
    
    return {
        "department_id": department_id,
        "department_name": department.get("name", ""),
        "users": formatted_users,
        "total": len(formatted_users)
    }

@router.post("/create-sample-data")
async def create_sample_organization_data(
    user_id: str = Query(..., description="ID of the user making the request"),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Create sample organization data for testing the charts
    This is a development/testing endpoint
    """
    try:
        # Check permission for admin operations
        await check_permission(user_id, "settings", "edit", users_db, roles_db)
        
        created_data = {
            "departments": [],
            "roles": [],
            "users": []
        }
        
        # Create sample departments
        try:
            # Root departments
            sales_dept_id = await departments_db.create_department({
                "name": "Sales & Marketing",
                "description": "Handles all sales and marketing activities",
                "code": "SAL",
                "parent_department_id": None
            })
            created_data["departments"].append(sales_dept_id)
            
            tech_dept_id = await departments_db.create_department({
                "name": "Technology",
                "description": "IT and software development",
                "code": "TECH",
                "parent_department_id": None
            })
            created_data["departments"].append(tech_dept_id)
            
            hr_dept_id = await departments_db.create_department({
                "name": "Human Resources",
                "description": "HR and employee management",
                "code": "HR",
                "parent_department_id": None
            })
            created_data["departments"].append(hr_dept_id)
            
            # Sub-departments
            digital_marketing_id = await departments_db.create_department({
                "name": "Digital Marketing",
                "description": "Online marketing and social media",
                "code": "DIGMAR",
                "parent_department_id": sales_dept_id
            })
            created_data["departments"].append(digital_marketing_id)
            
            backend_dev_id = await departments_db.create_department({
                "name": "Backend Development",
                "description": "Server-side development",
                "code": "BACKEND",
                "parent_department_id": tech_dept_id
            })
            created_data["departments"].append(backend_dev_id)
            
        except Exception as e:
            print(f"Error creating departments: {e}")
        
        # Create sample roles
        try:
            # Sales roles
            sales_manager_id = await roles_db.create_role({
                "name": "Sales Manager",
                "description": "Manages sales team and strategy",
                "department_id": sales_dept_id,
                "reporting_id": None,
                "permissions": [
                    {"page": "leads", "actions": ["show", "edit", "assign"]},
                    {"page": "reports", "actions": ["show", "export"]}
                ]
            })
            created_data["roles"].append(sales_manager_id)
            
            sales_exec_id = await roles_db.create_role({
                "name": "Sales Executive",
                "description": "Handles customer acquisition and sales",
                "department_id": sales_dept_id,
                "reporting_id": sales_manager_id,
                "permissions": [
                    {"page": "leads", "actions": ["show", "edit"]},
                ]
            })
            created_data["roles"].append(sales_exec_id)
            
            # Tech roles
            tech_lead_id = await roles_db.create_role({
                "name": "Tech Lead",
                "description": "Leads technical team and architecture",
                "department_id": tech_dept_id,
                "reporting_id": None,
                "permissions": [
                    {"page": "*", "actions": "*"}
                ]
            })
            created_data["roles"].append(tech_lead_id)
            
            developer_id = await roles_db.create_role({
                "name": "Software Developer",
                "description": "Develops and maintains software applications",
                "department_id": backend_dev_id,
                "reporting_id": tech_lead_id,
                "permissions": [
                    {"page": "leads", "actions": ["show"]},
                    {"page": "admin", "actions": ["show"]}
                ]
            })
            created_data["roles"].append(developer_id)
            
            # HR roles
            hr_manager_id = await roles_db.create_role({
                "name": "HR Manager",
                "description": "Manages human resources and policies",
                "department_id": hr_dept_id,
                "reporting_id": None,
                "permissions": [
                    {"page": "hrms", "actions": ["show", "add", "edit", "delete"]},
                    {"page": "users", "actions": ["show", "add", "edit"]}
                ]
            })
            created_data["roles"].append(hr_manager_id)
            
        except Exception as e:
            print(f"Error creating roles: {e}")
        
        # Create sample users
        try:
            # Sales users
            sm_user_id = await users_db.create_user({
                "username": "john.smith",
                "email": "john.smith@company.com",
                "first_name": "John",
                "last_name": "Smith",
                "phone": "+1234567890",
                "role_id": sales_manager_id,
                "department_id": sales_dept_id,
                "department_name": "Sales & Marketing",
                "job_title": "Sales Manager",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(sm_user_id)
            
            se1_user_id = await users_db.create_user({
                "username": "jane.doe",
                "email": "jane.doe@company.com",
                "first_name": "Jane",
                "last_name": "Doe",
                "phone": "+1234567891",
                "role_id": sales_exec_id,
                "department_id": sales_dept_id,
                "department_name": "Sales & Marketing",
                "job_title": "Sales Executive",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(se1_user_id)
            
            se2_user_id = await users_db.create_user({
                "username": "mike.wilson",
                "email": "mike.wilson@company.com", 
                "first_name": "Mike",
                "last_name": "Wilson",
                "phone": "+1234567892",
                "role_id": sales_exec_id,
                "department_id": sales_dept_id,
                "department_name": "Sales & Marketing",
                "job_title": "Senior Sales Executive",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(se2_user_id)
            
            # Tech users
            tl_user_id = await users_db.create_user({
                "username": "alex.johnson",
                "email": "alex.johnson@company.com",
                "first_name": "Alex",
                "last_name": "Johnson",
                "phone": "+1234567893",
                "role_id": tech_lead_id,
                "department_id": tech_dept_id,
                "department_name": "Technology",
                "job_title": "Technical Lead",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(tl_user_id)
            
            dev1_user_id = await users_db.create_user({
                "username": "sarah.connor",
                "email": "sarah.connor@company.com",
                "first_name": "Sarah",
                "last_name": "Connor",
                "phone": "+1234567894",
                "role_id": developer_id,
                "department_id": backend_dev_id,
                "department_name": "Backend Development",
                "job_title": "Senior Backend Developer",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(dev1_user_id)
            
            dev2_user_id = await users_db.create_user({
                "username": "david.clark",
                "email": "david.clark@company.com",
                "first_name": "David",
                "last_name": "Clark",
                "phone": "+1234567895",
                "role_id": developer_id,
                "department_id": backend_dev_id,
                "department_name": "Backend Development",
                "job_title": "Backend Developer",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(dev2_user_id)
            
            # HR users
            hr_user_id = await users_db.create_user({
                "username": "lisa.adams",
                "email": "lisa.adams@company.com",
                "first_name": "Lisa",
                "last_name": "Adams",
                "phone": "+1234567896",
                "role_id": hr_manager_id,
                "department_id": hr_dept_id,
                "department_name": "Human Resources",
                "job_title": "HR Manager",
                "status": "active",
                "password": "password123"
            })
            created_data["users"].append(hr_user_id)
            
        except Exception as e:
            print(f"Error creating users: {e}")
        
        return {
            "success": True,
            "message": "Sample organization data created successfully",
            "created_data": created_data,
            "summary": {
                "departments_created": len(created_data["departments"]),
                "roles_created": len(created_data["roles"]),
                "users_created": len(created_data["users"])
            }
        }
        
    except Exception as e:
        print(f"Error in create sample data API: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sample data: {str(e)}"
        )
