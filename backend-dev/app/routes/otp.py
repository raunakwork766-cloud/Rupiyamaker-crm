from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from app.database.OTP import OTPDB
from app.database.EmailSettings import EmailSettingsDB
from app.database.AdminEmails import AdminEmailsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.schemas.otp_schemas import (
    OTPCreate, OTPVerify, OTPResponse,
    EmailSettingCreate, EmailSettingUpdate, EmailSettingInDB,
    AdminEmailCreate, AdminEmailUpdate, AdminEmailInDB
)
from app.services.email_service import EmailService
from app.utils.common_utils import convert_object_id
from app.utils.permissions import check_permission
from app.database import get_database_instances

router = APIRouter(
    prefix="/otp",
    tags=["otp"]
)

def get_otp_db():
    from app.database import get_otp_db as get_otp_db_instance
    return get_otp_db_instance()

def get_email_settings_db():
    from app.database import get_email_settings_db as get_email_settings_db_instance
    return get_email_settings_db_instance()

def get_admin_emails_db():
    from app.database import get_admin_emails_db as get_admin_emails_db_instance
    return get_admin_emails_db_instance()

async def get_users_db():
    from app.database import get_users_db as get_users_db_instance
    return get_users_db_instance()

async def get_roles_db():
    from app.database import get_roles_db as get_roles_db_instance
    return get_roles_db_instance()

def get_email_service():
    return EmailService()

@router.post("/generate", response_model=OTPResponse)
async def generate_otp(
    otp_request: OTPCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    otp_db: OTPDB = Depends(get_otp_db),
    users_db: UsersDB = Depends(get_users_db),
    email_service: EmailService = Depends(get_email_service)
):
    """Generate OTP for user login"""
    try:
        # Get user data
        user = await users_db.get_user(otp_request.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Check if user requires OTP
        if not user.get("otp_required", True):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP not required for this user"
            )

        # Generate OTP
        otp_id, otp_code = await otp_db.create_otp(otp_request.user_id, user)
        if not otp_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate OTP"
            )

        # Send OTP email
        email_sent = email_service.send_otp_email(user, otp_code)

        return OTPResponse(
            success=True,
            message=f"OTP generated and {'sent' if email_sent else 'generation completed (email failed)'} to administrators",
            expires_at=otp_db.get_otp_record(otp_request.user_id)["expires_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating OTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/verify", response_model=OTPResponse)
async def verify_otp(
    otp_verify: OTPVerify,
    otp_db: OTPDB = Depends(get_otp_db)
):
    """Verify OTP for user login"""
    try:
        is_valid, message = await otp_db.verify_otp(otp_verify.user_id, otp_verify.otp_code)
        
        return OTPResponse(
            success=is_valid,
            message=message
        )

    except Exception as e:
        print(f"Error verifying OTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.delete("/cleanup")
async def cleanup_expired_otps(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    otp_db: OTPDB = Depends(get_otp_db)
):
    """Cleanup expired OTP records (Admin only)"""
    try:
        # Check admin permission
        await check_permission(user_id, "settings", "create", users_db, roles_db)
        
        otp_db.cleanup_expired_otps()
        return {"message": "Expired OTPs cleaned up successfully"}

    except Exception as e:
        print(f"Error cleaning up OTPs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# Email Settings Routes
@router.post("/email-settings", response_model=Dict[str, str])
async def create_email_setting(
    email_setting: EmailSettingCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    email_settings_db: EmailSettingsDB = Depends(get_email_settings_db)
):
    """Create email setting for OTP (Admin only)"""
    try:
        # Check admin permission
        await check_permission(user_id, "settings", "create", users_db, roles_db)
        
        setting_id = await email_settings_db.create_email_setting(email_setting.dict())
        if not setting_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create email setting"
            )

        return {"id": setting_id, "message": "Email setting created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating email setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/email-settings", response_model=List[EmailSettingInDB])
async def get_email_settings(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    email_settings_db: EmailSettingsDB = Depends(get_email_settings_db)
):
    """Get all email settings (Admin only)"""
    try:
        # Check admin permission
        await check_permission(user_id, "settings", "show", users_db, roles_db)
        
        settings = await email_settings_db.get_email_settings()
        result = []
        for setting in settings:
            # Remove password from response for security
            setting_copy = setting.copy()
            setting_copy.pop("password", None)
            result.append(convert_object_id(setting_copy))
        
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting email settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.put("/email-settings/{setting_id}", response_model=Dict[str, str])
async def update_email_setting(
    setting_id: str,
    email_update: EmailSettingUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    email_settings_db: EmailSettingsDB = Depends(get_email_settings_db)
):
    """Update email setting (Admin only)"""
    try:
        # Check admin permission
        await check_permission(user_id, "settings", "update", users_db, roles_db)
        
        # Filter out None values
        update_data = {k: v for k, v in email_update.dict().items() if v is not None}
        
        success = await email_settings_db.update_email_setting(setting_id, update_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email setting not found or failed to update"
            )

        return {"message": "Email setting updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating email setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.delete("/email-settings/{setting_id}", response_model=Dict[str, str])
async def delete_email_setting(
    setting_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    email_settings_db: EmailSettingsDB = Depends(get_email_settings_db)
):
    """Delete email setting (Admin only)"""
    try:
        # Check admin permission
        await check_permission(user_id, "settings", "delete", users_db, roles_db)
        
        success = await email_settings_db.delete_email_setting(setting_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email setting not found or failed to delete"
            )

        return {"message": "Email setting deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting email setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# Admin Email Management Routes
@router.post("/admin-emails", response_model=Dict[str, str])
async def create_admin_email(
    admin_email: AdminEmailCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    admin_emails_db: AdminEmailsDB = Depends(get_admin_emails_db)
):
    """Create a new admin email for OTP reception (Admin only)"""
    
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        # Check if email already exists
        existing = await admin_emails_db.get_admin_email_by_address(admin_email.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin email already exists"
            )
        
        admin_email_id = await admin_emails_db.create_admin_email(admin_email.dict())
        
        if not admin_email_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create admin email"
            )

        return {
            "message": "Admin email created successfully",
            "admin_email_id": admin_email_id
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating admin email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/admin-emails", response_model=List[AdminEmailInDB])
async def get_admin_emails(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    admin_emails_db: AdminEmailsDB = Depends(get_admin_emails_db)
):
    """Get all admin emails (Admin only)"""
    
    # Check permissions
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        admin_emails = await admin_emails_db.get_admin_emails()
        
        # Convert ObjectId to string for each admin email
        processed_admin_emails = []
        for admin_email in admin_emails:
            admin_email_dict = convert_object_id(admin_email)
            processed_admin_emails.append(admin_email_dict)
        
        return processed_admin_emails

    except Exception as e:
        print(f"Error getting admin emails: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.put("/admin-emails/{admin_email_id}", response_model=Dict[str, str])
async def update_admin_email(
    admin_email_id: str,
    admin_email_update: AdminEmailUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    admin_emails_db: AdminEmailsDB = Depends(get_admin_emails_db)
):
    """Update admin email settings (Admin only)"""
    
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        # Remove None values from update data
        update_data = {k: v for k, v in admin_email_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        success = await admin_emails_db.update_admin_email(admin_email_id, update_data)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin email not found or failed to update"
            )

        return {"message": "Admin email updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating admin email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.delete("/admin-emails/{admin_email_id}", response_model=Dict[str, str])
async def delete_admin_email(
    admin_email_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    admin_emails_db: AdminEmailsDB = Depends(get_admin_emails_db)
):
    """Delete admin email (Admin only)"""
    
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    try:
        success = await admin_emails_db.delete_admin_email(admin_email_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin email not found or failed to delete"
            )

        return {"message": "Admin email deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting admin email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
