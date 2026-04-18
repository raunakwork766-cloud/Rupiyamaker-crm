"""
OTP routes for CRM login verification.

Flow:
  1. User submits username + password to /users/login.
  2. If the user has otp_required=True, /users/login responds with HTTP 428
     and the user's _id.
  3. Frontend calls POST /otp/generate?user_id=<id>.
  4. This endpoint:
        a. Looks up the user's role.
        b. Looks up the OTP approval routing for that role
           (collection: otp_approval_routes).
        c. If no routing exists -> HTTP 412 PRECONDITION_FAILED
           (login is blocked; admin must configure OTP routing first).
        d. Resolves each approver employee's `personal_email`.
        e. Sends the OTP via Gmail SMTP (credentials from backend .env)
           to ALL approver personal emails.
  5. Approver shares the OTP with the requester.
  6. Frontend re-submits to /users/login with otp_code -> verified -> session.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Dict, List
from app.database.OTP import OTPDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Settings import SettingsDB
from app.schemas.otp_schemas import (
    OTPCreate, OTPVerify, OTPResponse,
)
from app.services.email_service import EmailService
from app.utils.permissions import check_permission

router = APIRouter(
    prefix="/otp",
    tags=["otp"],
)


def get_otp_db():
    from app.database import get_otp_db as get_otp_db_instance
    return get_otp_db_instance()


async def get_users_db():
    from app.database import get_users_db as get_users_db_instance
    return get_users_db_instance()


async def get_roles_db():
    from app.database import get_roles_db as get_roles_db_instance
    return get_roles_db_instance()


async def get_settings_db():
    from app.database import get_settings_db as get_settings_db_instance
    return get_settings_db_instance()


def get_email_service():
    return EmailService()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
async def _resolve_approver_emails(
    role_id: str,
    settings_db: SettingsDB,
    users_db: UsersDB,
) -> Dict[str, List]:
    """Resolve OTP approver employees and their personal_email values
    for the given role.

    Returns dict:
        {
            "approver_ids": [str, ...],
            "emails": [str, ...],
            "missing_email_names": [str, ...],   # approvers with no personal_email
        }
    """
    approver_ids = await settings_db.get_otp_approvers_for_role(role_id)
    emails: List[str] = []
    missing: List[str] = []
    for aid in approver_ids:
        emp = await users_db.get_user(aid)
        if not emp:
            continue
        personal_email = (emp.get("personal_email") or "").strip()
        full_name = (
            f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            or emp.get("username")
            or "Unknown"
        )
        if personal_email:
            emails.append(personal_email)
        else:
            missing.append(full_name)
    return {
        "approver_ids": approver_ids,
        "emails": emails,
        "missing_email_names": missing,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/generate", response_model=OTPResponse)
async def generate_otp(
    otp_request: OTPCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    otp_db: OTPDB = Depends(get_otp_db),
    users_db: UsersDB = Depends(get_users_db),
    settings_db: SettingsDB = Depends(get_settings_db),
    email_service: EmailService = Depends(get_email_service),
):
    """Generate OTP for user login and email it to the configured
    approver employees' personal_email addresses.
    """
    try:
        user = await users_db.get_user(otp_request.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        role_id = user.get("role_id") or user.get("role")
        if not role_id:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail={
                    "code": "OTP_ROUTING_NOT_CONFIGURED",
                    "message": (
                        "Your account has no role assigned, so the system "
                        "cannot route the login OTP. Please contact your "
                        "Super Admin."
                    ),
                },
            )

        # Look up approver employees for this role
        resolved = await _resolve_approver_emails(str(role_id), settings_db, users_db)

        if not resolved["approver_ids"]:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail={
                    "code": "OTP_ROUTING_NOT_CONFIGURED",
                    "message": (
                        "OTP verification is enabled for your role, but no "
                        "approver employee is configured to receive your OTP. "
                        "Please contact your Super Admin to configure OTP "
                        "Verification routing in Settings."
                    ),
                },
            )

        if not resolved["emails"]:
            missing = ", ".join(resolved["missing_email_names"]) or "approvers"
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail={
                    "code": "APPROVER_PERSONAL_EMAIL_MISSING",
                    "message": (
                        f"OTP approvers configured for your role ({missing}) "
                        "have no Personal Email set in HRMS. Please contact "
                        "your Super Admin."
                    ),
                },
            )

        if not email_service.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "SMTP_NOT_CONFIGURED",
                    "message": (
                        "Server email (SMTP) is not configured. Please ask "
                        "your administrator to set SMTP_USERNAME and "
                        "SMTP_PASSWORD in the backend .env file."
                    ),
                },
            )

        # Generate the OTP record only AFTER all preconditions pass.
        otp_id, otp_code = await otp_db.create_otp(otp_request.user_id, user)
        if not otp_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate OTP",
            )

        ok, send_msg = email_service.send_otp_email(
            user, otp_code, resolved["emails"]
        )

        record = await otp_db.get_otp_record(otp_request.user_id)
        return {
            "success": True,
            "message": (
                "OTP generated and sent to approver(s)."
                if ok else f"OTP generated but email delivery failed: {send_msg}"
            ),
            "expires_at": record["expires_at"] if record else None,
            "approver_count": len(resolved["emails"]),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating OTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.post("/verify", response_model=OTPResponse)
async def verify_otp(
    otp_verify: OTPVerify,
    otp_db: OTPDB = Depends(get_otp_db),
):
    """Verify OTP for user login"""
    try:
        is_valid, message = await otp_db.verify_otp(
            otp_verify.user_id, otp_verify.otp_code
        )
        return OTPResponse(success=is_valid, message=message)
    except Exception as e:
        print(f"Error verifying OTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.delete("/cleanup")
async def cleanup_expired_otps(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    otp_db: OTPDB = Depends(get_otp_db),
):
    """Cleanup expired OTP records (Admin only)"""
    try:
        await check_permission(user_id, "settings", "create", users_db, roles_db)
        otp_db.cleanup_expired_otps()
        return {"message": "Expired OTPs cleaned up successfully"}
    except Exception as e:
        print(f"Error cleaning up OTPs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )
