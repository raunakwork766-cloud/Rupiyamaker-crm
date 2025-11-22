from fastapi import APIRouter, HTTPException, Depends, status as http_status, Query, Response
from typing import Dict, Optional, Any, List
from datetime import datetime
from bson import ObjectId

from app.database.Apps import AppsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.AppShareLinks import AppShareLinksDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.schemas.app_share_schemas import (
    AppShareLinkCreate, 
    AppShareLinkResponse, 
    AppShareLinkDetail,
    AppShareLinkToggle,
    AppShareLinkStats,
    PublicAppResponse
)
from app.database import get_database_instances

router = APIRouter(
    prefix="/app-share-links",
    tags=["app-share-links"]
)

@router.get("/ping")
async def ping():
    """Simple ping endpoint to test routing"""
    return {"status": "ok", "message": "app-share-links router is working"}

# Dependency to get DB instances
async def get_apps_db():
    db_instances = get_database_instances()
    return db_instances["apps"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_app_share_links_db():
    db_instances = get_database_instances()
    return db_instances.get("app_share_links")


@router.post("/create", response_model=AppShareLinkResponse)
async def create_app_share_link(
    share_link: AppShareLinkCreate,
    user_id: str = Query(..., description="ID of the user creating the share link"),
    apps_db: AppsDB = Depends(get_apps_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    share_links_db: Optional[AppShareLinksDB] = Depends(get_app_share_links_db)
):
    """Create a shareable link for an app that can be sent to anyone"""
    
    print(f"🔵 CREATE_SHARE_LINK called with user_id={user_id}, app_id={share_link.app_id}")
    
    try:
        # Check if user has permission to create share links
        # Get current user from database
        print(f"🔵 Fetching user {user_id}")
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Check for Super Admin or apps permissions
        user_role_id = str(current_user.get("role_id")) if current_user.get("role_id") else None
        user_permissions = current_user.get("permissions", [])
        
        has_permission = False
        
        # Check if Super Admin
        if user_role_id == "685292be8d7cdc3a71c4829b":
            has_permission = True
        
        # Check for Super Admin permissions
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if perm.get("page") == "*" and perm.get("actions") == "*":
                    has_permission = True
                    break
                # Check for apps permissions
                if perm.get("page") == "apps":
                    actions = perm.get("actions", [])
                    if "*" in actions or "manage" in actions or "show" in actions:
                        has_permission = True
                        break
        
        if not has_permission:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to create share links"
            )
        
        # Verify app exists
        app_id = share_link.app_id
        app = await apps_db.get_app(app_id)
        if not app:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"App with ID {app_id} not found"
            )
        
        # Check if share_links_db is initialized
        if share_links_db is None:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Share links database not initialized"
            )
        
        # Prepare share link data
        share_link_data = {
            "expires_in_days": share_link.expires_in_days,
            "max_access_count": share_link.max_access_count,
            "purpose": share_link.purpose,
            "recipient_email": share_link.recipient_email,
            "base_url": share_link.base_url,
            "notes": share_link.notes
        }
        
        # Create share link using the AppShareLinksDB class
        share_link_result = await share_links_db.create_share_link(
            app_id=app_id, 
            created_by=user_id,
            data=share_link_data
        )
        
        if not share_link_result:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create share link"
            )
        
        # Return the AppShareLinkResponse
        return share_link_result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in create_app_share_link: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(e)}"
        )


@router.get("/public/app/{share_token}", response_model=PublicAppResponse)
async def get_public_app(
    share_token: str,
    response: Response,
    apps_db: AppsDB = Depends(get_apps_db),
    share_links_db: Optional[AppShareLinksDB] = Depends(get_app_share_links_db)
):
    """Get app data for public viewing using a share token"""
    
    # Set cache control headers to prevent caching of deactivated links
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Find the share link by token
    share_link = await share_links_db.get_share_link_by_token(share_token)
    
    if not share_link:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share link"
        )
    
    # Check if link is active
    if not share_link.get("is_active", True):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This share link has been deactivated"
        )
    
    # Check if link is expired
    if share_link.get("expires_at", datetime.min) < datetime.now():
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This share link has expired"
        )
    
    # Check access count
    if share_link.get("access_count", 0) >= share_link.get("max_access_count", 999):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This share link has reached its maximum access count"
        )
    
    # Get the app data
    app_id = share_link.get("app_id")
    app = await apps_db.get_app(app_id)
    
    if not app:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="App not found"
        )
    
    # Check if app is active
    if not app.get("is_active", True):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This app is currently inactive"
        )
    
    # Increment access count
    await share_links_db.increment_access_count(share_token)
    
    # Return app data with share link info
    return {
        "id": str(app.get("_id")),
        "title": app.get("title", ""),
        "description": app.get("description", ""),
        "image_url": app.get("image_url", ""),
        "html_content": app.get("html_content", ""),
        "is_active": app.get("is_active", True),
        "share_token": share_token,
        "expires_at": share_link.get("expires_at")
    }


@router.get("/app/{app_id}", response_model=List[AppShareLinkDetail])
async def get_app_share_links(
    app_id: str,
    user_id: str = Query(..., description="ID of the user requesting share links"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    share_links_db: Optional[AppShareLinksDB] = Depends(get_app_share_links_db)
):
    """Get all share links for a specific app"""
    
    try:
        # Check if user has permission to view share links
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
        
        user_role_id = str(current_user.get("role_id")) if current_user.get("role_id") else None
        user_permissions = current_user.get("permissions", [])
        
        has_permission = False
        if user_role_id == "685292be8d7cdc3a71c4829b":
            has_permission = True
        
        if isinstance(user_permissions, list):
            for perm in user_permissions:
                if (perm.get("page") == "*" and perm.get("actions") == "*") or \
                   (perm.get("page") == "apps" and ("*" in perm.get("actions", []) or "show" in perm.get("actions", []))):
                    has_permission = True
                    break
        
        if not has_permission:
            raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="You don't have permission to view share links")
        
        # Get all share links for the app
        if share_links_db is None:
            # Return empty list if database not initialized yet
            return []
        
        share_links = await share_links_db.get_all_share_links_for_app(app_id)
        
        return share_links if share_links else []
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in get_app_share_links: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal error: {str(e)}")


@router.put("/{share_token}/toggle", response_model=Dict[str, Any])
async def toggle_share_link(
    share_token: str,
    toggle_data: AppShareLinkToggle,
    user_id: str = Query(..., description="ID of the user toggling the link"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    share_links_db: Optional[AppShareLinksDB] = Depends(get_app_share_links_db)
):
    """Toggle a share link's active status (activate or deactivate)"""
    
    # Check if user has permission to manage share links
    current_user = await users_db.get_user(user_id)
    if not current_user:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user_role_id = str(current_user.get("role_id")) if current_user.get("role_id") else None
    has_permission = (user_role_id == "685292be8d7cdc3a71c4829b")
    if not has_permission:
        user_permissions = current_user.get("permissions", [])
        for perm in user_permissions:
            if (perm.get("page") == "*") or (perm.get("page") == "apps"):
                has_permission = True
                break
    
    if not has_permission:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="You don't have permission to manage share links")
    
    # Verify share link exists
    share_link = await share_links_db.get_share_link_by_token(share_token)
    if not share_link:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Share link not found"
        )
    
    # Toggle the link
    if toggle_data.is_active:
        success = await share_links_db.reactivate_share_link(share_token)
        action = "reactivated"
    else:
        success = await share_links_db.deactivate_share_link(share_token, user_id)
        action = "deactivated"
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to {action} share link"
        )
    
    return {
        "success": True,
        "message": f"Share link {action} successfully",
        "is_active": toggle_data.is_active
    }


@router.delete("/{share_token}")
async def delete_share_link(
    share_token: str,
    user_id: str = Query(..., description="ID of the user deleting the link"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    share_links_db: Optional[AppShareLinksDB] = Depends(get_app_share_links_db)
):
    """Permanently delete a share link"""
    
    # Check if user has permission to manage share links
    current_user = await users_db.get_user(user_id)
    if not current_user:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user_role_id = str(current_user.get("role_id")) if current_user.get("role_id") else None
    has_permission = (user_role_id == "685292be8d7cdc3a71c4829b")
    if not has_permission:
        user_permissions = current_user.get("permissions", [])
        for perm in user_permissions:
            if (perm.get("page") == "*") or (perm.get("page") == "apps"):
                has_permission = True
                break
    
    if not has_permission:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="You don't have permission to delete share links")
    
    # Verify share link exists
    share_link = await share_links_db.get_share_link_by_token(share_token)
    if not share_link:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Share link not found"
        )
    
    # Delete the link
    success = await share_links_db.delete_share_link(share_token)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete share link"
        )
    
    return {
        "success": True,
        "message": "Share link deleted successfully"
    }


@router.get("/app/{app_id}/stats", response_model=AppShareLinkStats)
async def get_app_share_link_stats(
    app_id: str,
    user_id: str = Query(..., description="ID of the user requesting stats"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    share_links_db: Optional[AppShareLinksDB] = Depends(get_app_share_links_db)
):
    """Get statistics about share links for an app"""
    
    # Check if user has permission to view stats
    current_user = await users_db.get_user(user_id)
    if not current_user:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user_role_id = str(current_user.get("role_id")) if current_user.get("role_id") else None
    has_permission = (user_role_id == "685292be8d7cdc3a71c4829b")
    if not has_permission:
        user_permissions = current_user.get("permissions", [])
        for perm in user_permissions:
            if (perm.get("page") == "*") or (perm.get("page") == "apps"):
                has_permission = True
                break
    
    if not has_permission:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="You don't have permission to view stats")
    
    # Get stats
    stats = await share_links_db.get_share_link_stats(app_id)
    
    return stats
