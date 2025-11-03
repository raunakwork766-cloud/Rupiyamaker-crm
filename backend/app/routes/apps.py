from fastapi import APIRouter, HTTPException, Query, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import os
from pathlib import Path
import shutil
from uuid import uuid4

from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Apps import AppsDB
from app.database import get_database_instances

logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency to get the DB instances
async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_apps_db():
    db_instances = get_database_instances()
    return db_instances["apps"]

class AppCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    html_content: str
    is_active: bool = True

class AppUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    html_content: Optional[str] = None
    is_active: Optional[bool] = None

class AppPermissions(BaseModel):
    allowed_roles: List[str] = []

# Image upload endpoint
@router.post("/upload-image")
async def upload_image(
    user_id: str = Query(..., description="ID of the user uploading the image"),
    image: UploadFile = File(...),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Upload an image for app and return the URL
    """
    try:
        # Verify user exists
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate file type
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        file_extension = os.path.splitext(image.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (5MB max)
        content = await image.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
        
        # Create upload directory if it doesn't exist
        upload_dir = Path(__file__).parent.parent.parent / "media" / "app-images"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        unique_filename = f"app-{uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Return the URL (adjust this based on your server configuration)
        image_url = f"https://rupiyamaker.com:8049/media/app-images/{unique_filename}"
        
        logger.info(f"Image uploaded successfully: {unique_filename} by user {user_id}")
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "Image uploaded successfully",
                "image_url": image_url,
                "filename": unique_filename
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.get("/apps")
async def get_apps(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    apps_db: AppsDB = Depends(get_apps_db)
):
    """Get all apps with user permissions check"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID (ObjectId)
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        # Get all apps using AppsDB
        if is_super_admin:
            # Super admin can see all apps
            apps = await apps_db.get_apps()
        else:
            # Regular users can only see apps they have permission for
            if user_role_id:
                apps = await apps_db.get_apps_by_allowed_roles([user_role_id])
            else:
                # User with no role can only see public apps (no role restrictions)
                apps = await apps_db.get_apps({"allowed_roles": {"$size": 0}, "is_active": True})
        
        return JSONResponse(content={"apps": apps})
        
    except Exception as e:
        logger.error(f"Error fetching apps: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch apps")

@router.post("/apps")
async def create_app(
    app_data: AppCreate, 
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    apps_db: AppsDB = Depends(get_apps_db)
):
    """Create a new app (admin only)"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        if not is_super_admin:
            raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
        
        # Prepare allowed_roles - by default include creator's role ID
        allowed_roles = []
        if user_role_id:
            allowed_roles.append(user_role_id)
        
        # Create app document
        app_doc = {
            "title": app_data.title,
            "description": app_data.description,
            "html_content": app_data.html_content,
            "is_active": app_data.is_active,
            "allowed_roles": allowed_roles,  # Creator's role ID is automatically included
            "created_by": user_id
        }
        
        # Create app using AppsDB
        app_id = await apps_db.create_app(app_doc)
        
        return JSONResponse(content={
            "message": "App created successfully",
            "app_id": app_id
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating app: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create app")

@router.get("/apps/{app_id}")
async def get_app(
    app_id: str, 
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    apps_db: AppsDB = Depends(get_apps_db)
):
    """Get a specific app"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        # Find the app
        app = await apps_db.get_app(app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        # Check permissions
        allowed_roles = app.get("allowed_roles", [])
        if not is_super_admin and allowed_roles and user_role_id not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Format dates for JSON response
        if app.get("created_at"):
            app["created_at"] = app["created_at"].isoformat()
        if app.get("updated_at"):
            app["updated_at"] = app["updated_at"].isoformat()
        
        return JSONResponse(content=app)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching app {app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch app")

@router.put("/apps/{app_id}")
async def update_app(
    app_id: str, 
    app_data: AppUpdate, 
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    apps_db: AppsDB = Depends(get_apps_db)
):
    """Update an app"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        # Check if app exists
        app = await apps_db.get_app(app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        # Check permissions
        allowed_roles = app.get("allowed_roles", [])
        if not is_super_admin and allowed_roles and user_role_id not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build update document
        update_data = {"updated_at": datetime.now()}
        
        if app_data.title is not None:
            update_data["title"] = app_data.title
        if app_data.description is not None:
            update_data["description"] = app_data.description
        if app_data.image_url is not None:
            update_data["image_url"] = app_data.image_url
        if app_data.html_content is not None:
            update_data["html_content"] = app_data.html_content
        if app_data.is_active is not None:
            update_data["is_active"] = app_data.is_active
        
        # Update the app
        success = await apps_db.update_app(app_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update app")
        
        return JSONResponse(content={"message": "App updated successfully"})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating app {app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update app")

@router.delete("/apps/{app_id}")
async def delete_app(
    app_id: str, 
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    apps_db: AppsDB = Depends(get_apps_db)
):
    """Delete an app"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        # Check if app exists
        app = await apps_db.get_app(app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        # Check permissions
        allowed_roles = app.get("allowed_roles", [])
        if not is_super_admin and allowed_roles and user_role_id not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete the app
        success = await apps_db.delete_app(app_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete app")
        
        return JSONResponse(content={"message": "App deleted successfully"})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting app {app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete app")

@router.put("/apps/{app_id}/permissions")
async def update_app_permissions(
    app_id: str, 
    permissions_data: AppPermissions, 
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    apps_db: AppsDB = Depends(get_apps_db)
):
    """Update app permissions"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        # Check if app exists
        app = await apps_db.get_app(app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        # Check permissions - only super admin or users with access can update permissions
        allowed_roles = app.get("allowed_roles", [])
        if not is_super_admin and allowed_roles and user_role_id not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update permissions
        success = await apps_db.update_app_permissions(app_id, permissions_data.allowed_roles)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update app permissions")
        
        return JSONResponse(content={"message": "App permissions updated successfully"})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating app permissions {app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update app permissions")

@router.get("/app-roles")
async def get_app_roles(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all roles for permission assignment in apps"""
    try:
        # Get current user from database
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's role ID
        user_role_id = current_user.get("role_id")
        if user_role_id:
            user_role_id = str(user_role_id)
        
        # Check for Super Admin permissions
        user_permissions = current_user.get("permissions", [])
        is_super_admin = False
        
        # Check if user has Super Admin role ID
        if user_role_id == "685292be8d7cdc3a71c4829b":
            is_super_admin = True
        
        # Check for Super Admin permissions (page: "*" and actions: "*")
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*"):
                    is_super_admin = True
                    break
        
        # Only super admin can view all roles for assignment
        if not is_super_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get all roles using RolesDB
        all_roles = await roles_db.get_all_roles()
        roles = []
        
        for role in all_roles:
            roles.append({
                "id": role.get("id", str(role.get("_id", ""))),
                "name": role.get("name", ""),
                "description": role.get("description", "")
            })
        
        return JSONResponse(content={"roles": roles})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching roles: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch roles")
