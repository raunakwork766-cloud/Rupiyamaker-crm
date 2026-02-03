import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import logging
import asyncio
from contextlib import asynccontextmanager

# Setup logging with optimized configuration
logging.basicConfig(
    level=logging.WARNING,  # Changed to WARNING to prevent log flooding
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),  # Standard file handler
        logging.StreamHandler()
    ]
)

# Get the directory where this file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(BASE_DIR)

# Import async database components
from app.database import (
    init_database, 
    close_database,
    get_database_instances
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Optimized lifespan management with async Motor"""
    # Startup
    logging.info("🚀 Starting high-performance API server with async Motor...")
    
    try:
        # Initialize async MongoDB connection
        db_instances = await init_database()
        logging.info("✓ Async MongoDB (Motor) connection initialized")
        
        # Store database instances in app state
        app.state.users_db = db_instances["users"]
        app.state.leads_db = db_instances["leads"]
        app.state.tasks_db = db_instances["tasks"]
        app.state.roles_db = db_instances["roles"]
        app.state.departments_db = db_instances["departments"]
        app.state.attendance_db = db_instances["attendance"]
        app.state.settings_db = db_instances["settings"]
        app.state.tickets_db = db_instances["tickets"]
        app.state.notifications_db = db_instances["notifications"]
        app.state.pop_notifications_db = db_instances["pop_notifications"]
        app.state.warnings_db = db_instances["warnings"]
        
    except Exception as e:
        logging.error(f"✗ Async database initialization error: {str(e)}")
        raise
    
    # Start optimized background tasks
    try:
        from app.utils.recurring_task_scheduler import start_scheduler
        asyncio.create_task(start_scheduler())
        from app.utils.task_notifications_scheduler import start_task_notifications_scheduler
        asyncio.create_task(start_task_notifications_scheduler())
        logging.info("✓ Background schedulers started")
        
        # Pre-warm settings cache for ultra-fast API responses
        try:
            from app.routes.settings import warm_settings_cache_with_retry
            cache_warmed = await warm_settings_cache_with_retry(max_retries=3)
            if cache_warmed:
                logging.info("✓ Settings cache pre-warmed for 2ms response times")
            else:
                logging.warning("⚠ Settings cache pre-warming failed, will warm on first request")
        except Exception as e:
            logging.error(f"✗ Settings cache pre-warming error: {str(e)}")
        
        # Initialize interview settings async indexes
        try:
            from app.routes.interview_settings import init_interview_settings
            await init_interview_settings()
            logging.info("✓ Interview settings async indexes initialized")
        except Exception as e:
            logging.error(f"✗ Interview settings initialization error: {str(e)}")
        
    except Exception as e:
        logging.error(f"✗ Scheduler startup error: {str(e)}")
    
    yield
    
    # Shutdown
    logging.info("🔄 Graceful shutdown...")
    try:
        from app.utils.recurring_task_scheduler import stop_scheduler
        from app.utils.task_notifications_scheduler import stop_task_notifications_scheduler
        stop_scheduler()
        stop_task_notifications_scheduler()
        logging.info("✓ Schedulers stopped")
    except Exception as e:
        logging.error(f"✗ Shutdown error: {str(e)}")
    
    try:
        # Close async database connection
        await close_database()
        logging.info("✓ Async MongoDB connection closed")
    except Exception as e:
        logging.error(f"✗ Database shutdown error: {str(e)}")

# Create optimized FastAPI application with async Motor
app = FastAPI(
    title="Rupiyamakers HRMS API - Async Motor",
    description="High-Performance HRMS API with async Motor MongoDB - optimized for 10K+ concurrent requests",
    version="2.1.0",
    lifespan=lifespan,
    # Performance optimizations
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") == "development" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") == "development" else None,
    openapi_url="/openapi.json" if os.getenv("ENVIRONMENT", "development") == "development" else None,

)

# High-performance middleware stack (order matters!)
# 1. Trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"]  # Configure with actual hosts in production
)

# 2. CORS middleware (optimized)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Request logging middleware DISABLED to prevent log flooding
# If debugging is needed, temporarily enable this middleware
# from starlette.middleware.base import BaseHTTPMiddleware
# from starlette.requests import Request
# import logging

# class RequestLoggingMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         logger = logging.getLogger(__name__)
#         
#         # Log ALL PUT requests to leads
#         if request.method == "PUT" and "/leads/" in request.url.path:
#             logger.info(f"🔵 INCOMING PUT REQUEST: {request.method} {request.url.path}")
#             logger.info(f"🔵 Query params: {dict(request.query_params)}")
#             logger.info(f"🔵 Headers: {dict(request.headers)}")
#             
#             # Try to read body
#             try:
#                 body = await request.body()
#                 logger.info(f"🔵 Body: {body.decode('utf-8')}")
#                 # Reconstruct request with body for downstream handlers
#                 async def receive():
#                     return {"type": "http.request", "body": body}
#                 request._receive = receive
#             except Exception as e:
#                 logger.error(f"Error reading body: {e}")
#         
#         response = await call_next(request)
#         
#         if request.method == "PUT" and "/leads/" in request.url.path:
#             logger.info(f"🔵 RESPONSE STATUS: {response.status_code}")
#         
#         return response

# app.add_middleware(RequestLoggingMiddleware)

# 3. GZip compression (ultra-optimized for large JSON responses)
app.add_middleware(
    GZipMiddleware, 
    minimum_size=1000,  # Only compress responses > 1KB for better performance
    compresslevel=5     # Faster compression (5 vs 6) with minimal size difference
)

# 🔥 NEW: Session validation middleware - validates login on EVERY request
try:
    from app.middleware.session_validation import SessionValidationMiddleware
    app.add_middleware(SessionValidationMiddleware)
    logging.info("✓ Session validation middleware activated - immediate logout on any request")
except ImportError as e:
    logging.warning(f"⚠ Session validation middleware not available: {e}")

# 4. Performance monitoring middleware for async Motor
try:
    from starlette.middleware.base import BaseHTTPMiddleware
    import time
    
    class AsyncMotorPerformanceMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            start_time = time.perf_counter()
            response = await call_next(request)
            process_time = (time.perf_counter() - start_time) * 1000
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
            response.headers["X-Database"] = "AsyncMotor"
            return response
    
    app.add_middleware(AsyncMotorPerformanceMiddleware)
    logging.info("✓ Async Motor performance monitoring middleware activated")
    
except ImportError as e:
    logging.warning(f"⚠ Performance middleware not available: {e}")

# Add async Motor performance monitoring endpoint
@app.get("/performance/stats", tags=["Performance"])
async def get_performance_stats():
    """Get async Motor performance statistics"""
    return {
        "status": "async_motor_optimized",
        "database": "MongoDB with Motor (async)",
        "target_response_time": "0.05ms",
        "connection_pool": "100 async connections",
        "optimizations": [
            "Async Motor MongoDB driver",
            "Connection pooling (100 async connections)", 
            "Background index creation",
            "Compressed responses (zstd, zlib, snappy)",
            "Non-blocking database operations",
            "FastAPI with uvloop and httptools",
            "Response caching enabled",
            "Bulk operations for high throughput"
        ]
    }

# Database health check endpoint
@app.get("/health/database", tags=["Health"])
async def database_health_check():
    """Check async Motor database connection health"""
    try:
        from app.database import health_check
        
        # Test database connection
        result = await health_check()
        return result
        
    except Exception as e:
        return {
            "status": "unhealthy", 
            "error": str(e),
            "database": "MongoDB with Motor (async)"
        }

# Import routers after app creation to avoid circular imports
from app.routes import users, roles, department, feeds, leads, loan_types, employees, leadLoginRelated, lead_fields, share_links, tasks, charts, tickets, leaves, settings, reassignment, apps, postal, notifications, designations, otp, important_questions, app_share_links

try:
    from app.routes import pop_notifications
    print("✓ Pop notifications router imported successfully")
except Exception as e:
    print(f"✗ Error importing pop notifications router: {e}")
    import traceback
    traceback.print_exc()

try:
    from app.routes import interviews
    print("✓ Interviews router imported successfully")
except Exception as e:
    print(f"✗ Error importing interviews router: {e}")
    import traceback
    traceback.print_exc()

try:
    from app.routes import interview_settings
    print("✓ Interview settings router imported successfully")
except Exception as e:
    print(f"✗ Error importing interview settings router: {e}")
    import traceback
    traceback.print_exc()

try:
    from app.routes import employee_remarks, employee_attachments, employee_activity
    print("✓ Employee detail routers imported successfully")
except Exception as e:
    print(f"✗ Error importing employee detail routers: {e}")
    import traceback
    traceback.print_exc()

try:
    from app.routes import attendance
    print("✓ Attendance router imported successfully")
except Exception as e:
    print(f"✗ Error importing attendance router: {e}")
    import traceback
    traceback.print_exc()

try:
    from app.routes import warnings
    print("✓ Warnings router imported successfully")
except Exception as e:
    print(f"✗ Error importing warnings router: {e}")
    import traceback
    traceback.print_exc()

# Include routers
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(department.router)
app.include_router(feeds.router)
app.include_router(leads.router)
app.include_router(loan_types.router)
app.include_router(employees.router)
app.include_router(leadLoginRelated.router)
app.include_router(lead_fields.router)
app.include_router(share_links.router)
app.include_router(tasks.router)
app.include_router(charts.router)
app.include_router(tickets.router)
app.include_router(leaves.router)
app.include_router(settings.router)
app.include_router(reassignment.router)
app.include_router(apps.router)
app.include_router(app_share_links.router)
app.include_router(postal.router)
app.include_router(notifications.router)
app.include_router(designations.router)
app.include_router(otp.router)
app.include_router(important_questions.router)

try:
    app.include_router(pop_notifications.router)
    print("✓ Pop notifications router registered successfully")
except Exception as e:
    print(f"✗ Error registering pop notifications router: {e}")

try:
    app.include_router(employee_remarks.router)
    app.include_router(employee_attachments.router)
    app.include_router(employee_activity.router)
    print("✓ Employee detail routers registered successfully")
except Exception as e:
    print(f"✗ Error registering employee detail routers: {e}")
    import traceback
    traceback.print_exc()

try:
    app.include_router(attendance.router)
    print("✓ Attendance router registered successfully")
except Exception as e:
    print(f"✗ Error registering attendance router: {e}")
    import traceback
    traceback.print_exc()

try:
    app.include_router(warnings.router)
    print("✓ Warnings router registered successfully")
except Exception as e:
    print(f"✗ Error registering warnings router: {e}")
    import traceback
    traceback.print_exc()

try:
    app.include_router(interviews.router)
    print("✓ Interviews router registered successfully")
except Exception as e:
    print(f"✗ Error registering interviews router: {e}")
    import traceback
    traceback.print_exc()

try:
    app.include_router(interview_settings.router)
    print("✓ Interview settings router registered successfully")
except Exception as e:
    print(f"✗ Error registering interview settings router: {e}")
    import traceback
    traceback.print_exc()

# Serve static files with optimized settings
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static"), check_dir=False), name="static")
app.mount("/media", StaticFiles(directory=os.path.join(BACKEND_DIR, "media"), check_dir=False), name="media")

# Root endpoint
@app.get("/", tags=["Root"])
async def read_root():
    return FileResponse(os.path.join(BASE_DIR, "static", "login.html"))

@app.get("/feeds-page", tags=["Feeds"])
async def read_feeds_page():
    return FileResponse(os.path.join(BASE_DIR, "static", "feeds.html"))

@app.get("/other", tags=["Other"])
async def read_other_page():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))

@app.get("/leads-page", tags=["Other"])
async def read_leads_page():
    return FileResponse(os.path.join(BASE_DIR, "static", "leads.html"))

@app.get("/loan-types-page", tags=["loan-types"])
async def read_loan_types_page():
    return FileResponse(os.path.join(BASE_DIR, "static", "loan-types.html"))

@app.get("/public/lead-form/{share_token}", tags=["Public"])
async def serve_public_lead_form(share_token: str):
    """Serve the public lead form HTML page"""
    return FileResponse(os.path.join(BASE_DIR, "static", "public-lead-form.html"))
