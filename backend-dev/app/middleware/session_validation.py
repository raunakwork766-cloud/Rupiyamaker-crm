"""
Session Validation Middleware
Checks login_enabled and session_invalidated_at on EVERY API request
This ensures users are logged out immediately on their next action,
even if they closed the browser or aren't actively using the website.
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Endpoints that don't require session validation.
# IMPORTANT: "/" must be matched EXACTLY (see EXCLUDED_EXACT_PATHS), not via
# startswith — otherwise every path would be excluded.
EXCLUDED_PREFIXES = [
    "/users/login",
    "/users/register",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    "/favicon.ico",
    "/static",
    # Public app viewer - no auth required. Include the trailing slash
    # variant so startswith checks match the full path like
    # /app-share-links/public/app/<token>
    "/app-share-links/public",
    "/app-share-links/public/",
    # Also allow the frontend route path just in case the proxy maps
    # requests differently (defensive): /public/app/<token>
    "/public/app",
]

# Paths that should be excluded ONLY when matched exactly.
EXCLUDED_EXACT_PATHS = {"/"}

# 📱 ATTENDANCE-ONLY SESSION SCOPE
# When the client presents an X-Attendance-Token header, the request is treated
# as a scoped attendance session. Such sessions are allowed ONLY on these paths.
# Any other path with an attendance token returns 403 — preventing a phone user
# from switching to "desktop view" and accessing CRM data.
ATTENDANCE_ALLOWED_PREFIXES = [
    "/attendance/check-in",
    "/attendance/check-out",
    "/attendance/status/current",
]

class SessionValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate user sessions on EVERY request.
    Checks if:
    1. User's login is enabled
    2. Session hasn't been invalidated
    
    This ensures immediate logout even if user:
    - Has browser closed
    - Is not actively using the website
    - Returns after hours/days
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip validation for excluded paths
        path = request.url.path

        # Check if path should be excluded
        should_exclude = (path in EXCLUDED_EXACT_PATHS) or any(
            path.startswith(excluded) for excluded in EXCLUDED_PREFIXES
        )
        if should_exclude:
            return await call_next(request)
        
        # Skip validation for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # 📱 ATTENDANCE TOKEN — STANDALONE SCOPE GUARD
        # Handled BEFORE the regular user_id flow because:
        #   (a) we look the user up by token, not by user_id (so we don't depend
        #       on path_params which are not yet populated in middleware), and
        #   (b) we use JSONResponse early-return instead of `raise HTTPException`
        #       because Starlette's BaseHTTPMiddleware does NOT delegate
        #       HTTPException to FastAPI's exception handler — they would become
        #       500 Internal Server Error.
        attendance_token_hdr = request.headers.get("x-attendance-token") \
            or request.headers.get("X-Attendance-Token")
        if attendance_token_hdr:
            try:
                from app.database import get_database_instances
                db_instances = get_database_instances()
                users_db = db_instances["users"]
                # Direct collection lookup — preserves attendance_session_token
                # field (the Pydantic User model would strip it).
                att_user = await users_db.collection.find_one(
                    {"attendance_session_token": attendance_token_hdr}
                )
                if not att_user:
                    logger.warning(f"🚫 Attendance token INVALID on {path}")
                    return JSONResponse(
                        {"detail": "Invalid attendance session"},
                        status_code=status.HTTP_401_UNAUTHORIZED,
                    )
                # Token is valid — enforce path scope
                is_allowed = any(path.startswith(p) for p in ATTENDANCE_ALLOWED_PREFIXES)
                if not is_allowed:
                    logger.warning(
                        f"🚫 Attendance scope BLOCKED: User {att_user.get('_id')} tried {path}"
                    )
                    return JSONResponse(
                        {
                            "detail": "Attendance session cannot access CRM. "
                                      "Please login with full credentials."
                        },
                        status_code=status.HTTP_403_FORBIDDEN,
                    )
                # Account-level checks still apply (deactivated/disabled
                # employees cannot mark attendance) — but we SKIP the
                # session_invalidated_at check since that flag governs the CRM
                # session lifecycle, not the attendance one.
                if not att_user.get("login_enabled", True):
                    return JSONResponse(
                        {"detail": "Login access disabled - session terminated"},
                        status_code=status.HTTP_403_FORBIDDEN,
                    )
                if att_user.get("is_employee", False):
                    if att_user.get("employee_status", "active") != "active":
                        return JSONResponse(
                            {"detail": "Account inactive"},
                            status_code=status.HTTP_403_FORBIDDEN,
                        )
                logger.info(
                    f"✅ Attendance session OK: User {att_user.get('_id')} on {path}"
                )
                return await call_next(request)
            except Exception as att_err:
                logger.error(
                    f"⚠️ Attendance middleware error on {path}: {att_err}",
                    exc_info=True,
                )
                # Fail-closed for attendance: do not let a broken check leak CRM
                return JSONResponse(
                    {"detail": "Attendance session validation error"},
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Get user_id from various sources
        user_id = None
        
        try:
            # Try to get from query parameters
            user_id = request.query_params.get("user_id")
            
            # Try to get from path parameters  
            if not user_id and hasattr(request, "path_params"):
                user_id = request.path_params.get("user_id")
            
            # Try to get from request body (if JSON)
            if not user_id and request.method in ["POST", "PUT", "PATCH"]:
                try:
                    # Clone the body for reading (important!)
                    body = await request.body()
                    if body:
                        import json
                        body_json = json.loads(body.decode())
                        user_id = body_json.get("user_id") or body_json.get("requesting_user_id")
                        
                        # Re-inject the body so the route can still read it
                        async def receive():
                            return {"type": "http.request", "body": body}
                        request._receive = receive
                except Exception as body_error:
                    logger.debug(f"Could not parse body for user_id: {str(body_error)}")
            
            # Log for debugging
            if user_id:
                logger.info(f"🔍 Session validation: Checking user {user_id} on {path}")
            
            # If we have a user_id, validate the session
            if user_id:
                # Get database instances
                from app.database import get_database_instances
                db_instances = get_database_instances()
                users_db = db_instances["users"]
                
                # Get user from database
                user = await users_db.get_user(str(user_id))
                
                if user:
                    # Check if user's login is still enabled
                    if not user.get("login_enabled", True):
                        logger.warning(f"🚫 Session validation FAILED: User {user_id} - login disabled")
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Login access disabled - session terminated"
                        )
                    
                    # Check if session was invalidated after last login
                    session_invalidated_at = user.get("session_invalidated_at")
                    last_login = user.get("last_login")
                    
                    if session_invalidated_at:
                        if not last_login or session_invalidated_at > last_login:
                            logger.warning(f"🚫 Session validation FAILED: User {user_id} - session invalidated at {session_invalidated_at}, last login {last_login}")
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Your session has been invalidated - please login again"
                            )
                    
                    logger.info(f"✅ Session validation PASSED: User {user_id}")
        
        except HTTPException:
            # Re-raise HTTPException (these are intentional)
            raise
        except Exception as e:
            # Log but don't block on unexpected errors
            logger.error(f"⚠️ Session validation error: {str(e)}", exc_info=True)
        
        # Continue with the request
        response = await call_next(request)
        return response
