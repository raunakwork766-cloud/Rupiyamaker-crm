"""
Session Validation Middleware
Checks login_enabled and session_invalidated_at on EVERY API request
This ensures users are logged out immediately on their next action,
even if they closed the browser or aren't actively using the website.
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Endpoints that don't require session validation
EXCLUDED_PATHS = [
    "/users/login",
    "/users/register",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    "/",
    "/favicon.ico",
    "/static",
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
        should_exclude = any(path.startswith(excluded) for excluded in EXCLUDED_PATHS)
        if should_exclude:
            return await call_next(request)
        
        # Skip validation for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
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
