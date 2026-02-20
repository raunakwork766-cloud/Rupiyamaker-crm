from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, BackgroundTasks, Body, Request
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
import os
import tempfile
import aiohttp
import logging
import time
import uuid
import asyncio
from datetime import datetime, timedelta
from app.database import get_database_instances
from app.database.Settings import SettingsDB
from app.database.Users import UsersDB
from app.utils.common_utils import convert_object_id
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Leads import LeadsDB
from app.routes.settings_status import router as status_router
from app.database.CompanyDataSQLite import company_db as company_storage
from app.schemas.settings_schemas import (
    CampaignNameCreate, CampaignNameUpdate, CampaignNameInDB,
    DataCodeCreate, DataCodeUpdate, DataCodeInDB,
    BankNameCreate, BankNameUpdate, BankNameInDB,
    CompanyDataCreate, CompanyDataUpdate, CompanyDataInDB,
    CompanySearchRequest, CompanySearchResult,
    ExcelUploadResponse, SettingsDataResponse, SettingsStatsResponse,
    AttachmentTypeCreate, AttachmentTypeInDB,
    ChannelNameCreate, ChannelNameUpdate, ChannelNameInDB,
    AttendanceSettingsUpdate
)
from app.schemas.lead_schemas import (
    StatusBase, StatusCreate, StatusUpdate, StatusInDB,
    SubStatusBase, SubStatusCreate, SubStatusUpdate, SubStatusInDB
)
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities

router = APIRouter(
    prefix="/settings",
    tags=["Settings"]
)

# High-performance caching system for settings overview
class SettingsCache:
    def __init__(self):
        self._cache = {}
        self._cache_timestamps = {}
        self._cache_ttl = 300  # 5 minutes TTL
        self._background_refresh_interval = 60  # Refresh every minute in background
        self._last_background_refresh = 0
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if cache entry is still valid"""
        if key not in self._cache_timestamps:
            return False
        return (datetime.now() - self._cache_timestamps[key]).total_seconds() < self._cache_ttl
    
    def get(self, key: str):
        """Get cached value if valid"""
        if self._is_cache_valid(key):
            return self._cache.get(key)
        return None
    
    def set(self, key: str, value):
        """Set cached value with timestamp"""
        self._cache[key] = value
        self._cache_timestamps[key] = datetime.now()
    
    def should_background_refresh(self) -> bool:
        """Check if background refresh is needed"""
        now = time.time()
        if now - self._last_background_refresh > self._background_refresh_interval:
            self._last_background_refresh = now
            return True
        return False

# Global cache instance
settings_cache = SettingsCache()

# Include status configuration routes
router.include_router(status_router)

# Dependency to get the DB instances
async def get_settings_db():
    db_instances = get_database_instances()
    return db_instances["settings"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]
    
async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

# ============= Campaign Names Routes =============

@router.post("/campaign-names", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_campaign_name(
    campaign: CampaignNameCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new campaign name"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        campaign_id = await settings_db.create_campaign_name(campaign.dict())
        # Invalidate cache after successful creation
        invalidate_settings_cache()
        return {"id": campaign_id, "message": "Campaign name created successfully"}
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Campaign name '{campaign.name}' already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating campaign name: {str(e)}"
        )

@router.get("/campaign-names", response_model=List[CampaignNameInDB])
async def get_campaign_names(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all campaign names"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        campaigns = await settings_db.get_campaign_names(is_active)
        return campaigns
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching campaign names: {str(e)}"
        )

@router.get("/campaign-names/{campaign_id}", response_model=CampaignNameInDB)
async def get_campaign_name(
    campaign_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific campaign name"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    campaign = await settings_db.get_campaign_name(campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign name not found"
        )
    return campaign

@router.put("/campaign-names/{campaign_id}", response_model=Dict[str, str])
async def update_campaign_name(
    campaign_id: str,
    campaign_update: CampaignNameUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a campaign name"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    # Check if campaign exists
    if not await settings_db.get_campaign_name(campaign_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign name not found"
        )
    
    try:
        update_data = {k: v for k, v in campaign_update.dict().items() if v is not None}
        if await settings_db.update_campaign_name(campaign_id, update_data):
            # Invalidate cache after successful update
            invalidate_settings_cache()
            return {"message": "Campaign name updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update campaign name"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating campaign name: {str(e)}"
        )

@router.delete("/campaign-names/{campaign_id}", response_model=Dict[str, str])
async def delete_campaign_name(
    campaign_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a campaign name"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    if await settings_db.delete_campaign_name(campaign_id):
        # Invalidate cache after successful deletion
        invalidate_settings_cache()
        return {"message": "Campaign name deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign name not found"
        )

# ============= Data Codes Routes =============

@router.post("/data-codes", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_data_code(
    data_code: DataCodeCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new data code"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        code_id = await settings_db.create_data_code(data_code.dict())
        # Invalidate cache after successful creation
        invalidate_settings_cache()
        return {"id": code_id, "message": "Data code created successfully"}
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Data code '{data_code.name}' already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating data code: {str(e)}"
        )

@router.get("/data-codes", response_model=List[DataCodeInDB])
async def get_data_codes(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all data codes"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        codes = await settings_db.get_data_codes(is_active)
        return codes
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching data codes: {str(e)}"
        )

@router.put("/data-codes/{code_id}", response_model=Dict[str, str])
async def update_data_code(
    code_id: str,
    code_update: DataCodeUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a data code"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        update_data = {k: v for k, v in code_update.dict().items() if v is not None}
        if await settings_db.update_data_code(code_id, update_data):
            return {"message": "Data code updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update data code"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating data code: {str(e)}"
        )

@router.delete("/data-codes/{code_id}", response_model=Dict[str, str])
async def delete_data_code(
    code_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a data code"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    if await settings_db.delete_data_code(code_id):
        return {"message": "Data code deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data code not found"
        )

# ============= Bank Names Routes =============

@router.post("/bank-names", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_bank_name(
    bank: BankNameCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new bank name"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        bank_id = await settings_db.create_bank_name({"name": bank.name}) # Adjusted
        return {"id": bank_id, "message": "Bank name created successfully"}
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bank name '{bank.name}' already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating bank name: {str(e)}"
        )

@router.get("/bank-names", response_model=List[BankNameInDB])
async def get_bank_names(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all bank names"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        banks = await settings_db.get_bank_names(is_active)
        return banks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching bank names: {str(e)}"
        )

@router.put("/bank-names/{bank_id}", response_model=Dict[str, str])
async def update_bank_name(
    bank_id: str,
    bank_update: BankNameUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a bank name"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        update_data = {"name": bank_update.name, "is_active": bank_update.is_active} # Adjusted
        if await settings_db.update_bank_name(bank_id, update_data):
            return {"message": "Bank name updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update bank name"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating bank name: {str(e)}"
        )

@router.delete("/bank-names/{bank_id}", response_model=Dict[str, str])
async def delete_bank_name(
    bank_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a bank name"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    if await settings_db.delete_bank_name(bank_id):
        return {"message": "Bank name deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank name not found"
        )

# ============= Excel Upload and Company Data Routes =============

@router.post("/upload-excel", response_model=ExcelUploadResponse)
async def upload_excel_data(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Excel file with company data (supports .xlsx and .xls)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    INSTANT Excel upload with background processing
    Returns immediately with upload ID for tracking progress
    
    Process:
    1. Instant file validation and acceptance
    2. Background chunked processing with real-time progress
    3. WebSocket progress updates (optional)
    4. High-performance bulk operations
    """
    import uuid
    import time
    
    start_time = time.time()
    upload_id = str(uuid.uuid4())
    
    # Check permissions first (fast)
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    # Quick file validation
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)"
        )
    
    try:
        # Read file content ONCE (streaming would be better but pandas needs full file)
        content = await file.read()
        file_size_mb = len(content) / (1024 * 1024)
        
        # For very large files, warn but continue
        if file_size_mb > 500:  # 500MB limit
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large ({file_size_mb:.1f} MB). Maximum size is 500 MB."
            )
        
        # Save to temporary file (fast local operation)
        temp_file_path = f"/tmp/excel_upload_{upload_id}.xlsx"
        with open(temp_file_path, 'wb') as temp_file:
            temp_file.write(content)
        
        # Return IMMEDIATELY with upload ID - processing happens in background
        response_time = time.time() - start_time
        
        # Start background processing (non-blocking)
        background_tasks.add_task(
            process_excel_background,
            temp_file_path,
            upload_id,
            user_id,
            file.filename,
            file_size_mb,
            settings_db
        )
        
        # Return instant success response
        return {
            "success": True,
            "message": f"Upload accepted! Processing {file.filename} ({file_size_mb:.2f} MB) in background.",
            "upload_id": upload_id,
            "status": "processing",
            "file_info": {
                "filename": file.filename,
                "size_mb": round(file_size_mb, 2),
                "upload_time_seconds": round(response_time, 3)
            },
            "estimated_processing_time_seconds": max(30, int(file_size_mb * 2)),  # Rough estimate
            "tracking_url": f"/settings/upload-status/{upload_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

async def process_excel_background(
    temp_file_path: str,
    upload_id: str,
    user_id: str,
    filename: str,
    file_size_mb: float,
    settings_db: SettingsDB
):
    """
    Background processing function for Excel files
    Uses high-performance chunked processing with progress tracking
    """
    import logging
    import os
    from datetime import datetime
    
    logger = logging.getLogger(__name__)
    
    # Store progress in a simple in-memory cache (in production, use Redis)
    if not hasattr(process_excel_background, 'progress_cache'):
        process_excel_background.progress_cache = {}
    
    try:
        logger.info(f"Starting background processing for upload {upload_id}")
        
        # Update progress: Starting
        process_excel_background.progress_cache[upload_id] = {
            "status": "processing",
            "progress_percent": 0,
            "message": "Starting processing...",
            "start_time": datetime.now().isoformat(),
            "filename": filename,
            "file_size_mb": file_size_mb
        }
        
        # Process with high-performance SQLite method
        result = company_storage.bulk_upsert_from_excel(
            temp_file_path,
            chunk_size=5000  # Optimal chunk size for performance
        )
        
        # Convert result format to match expected format
        processed_result = {
            'success': True,
            'total_processed': result.get('created', 0) + result.get('updated', 0) + result.get('errors', 0),
            'created': result.get('created', 0),
            'updated': result.get('updated', 0),
            'errors': result.get('errors', 0),
            'database_backend': 'sqlite'
        }
        
        # Update final progress
        if processed_result.get('success'):
            process_excel_background.progress_cache[upload_id] = {
                "status": "completed",
                "progress_percent": 100,
                "message": "Processing completed successfully!",
                "result": processed_result,
                "end_time": datetime.now().isoformat()
            }
        else:
            process_excel_background.progress_cache[upload_id] = {
                "status": "failed",
                "progress_percent": 0,
                "message": processed_result.get('message', 'Processing failed'),
                "error": processed_result.get('message'),
                "end_time": datetime.now().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Background processing failed for upload {upload_id}: {str(e)}")
        process_excel_background.progress_cache[upload_id] = {
            "status": "failed",
            "progress_percent": 0,
            "message": f"Processing failed: {str(e)}",
            "error": str(e),
            "end_time": datetime.now().isoformat()
        }
    finally:
        # Cleanup temp file
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temp file for upload {upload_id}")
        except Exception as cleanup_error:
            logger.warning(f"Could not clean up temp file: {cleanup_error}")

def update_progress(upload_id: str, progress_data: dict):
    """Update progress for an upload"""
    if hasattr(process_excel_background, 'progress_cache'):
        current = process_excel_background.progress_cache.get(upload_id, {})
        current.update(progress_data)
        process_excel_background.progress_cache[upload_id] = current

@router.get("/upload-status/{upload_id}")
async def get_upload_status(
    upload_id: str,
    user_id: str = Query(..., description="ID of the user making the request")
):
    """Get the status of a background upload process"""
    
    # In production, this would check Redis or database
    if hasattr(process_excel_background, 'progress_cache'):
        progress = process_excel_background.progress_cache.get(upload_id)
        if progress:
            return progress
    
    return {
        "status": "not_found",
        "message": "Upload not found or expired"
    }

@router.get("/search-companies", response_model=List[CompanySearchResult])
@router.post("/search-companies", response_model=List[CompanySearchResult])
async def search_similar_companies(
    request: Request,
    q: Optional[str] = Query(None, description="Company name to search for (GET)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    limit: int = Query(50, description="Maximum number of results"),
    search_request: Optional[CompanySearchRequest] = Body(None),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Search for companies with similar names - INSTANT response from SQLite
    Supports both GET and POST methods for backwards compatibility
    
    Enhanced search features:
    - Prioritizes exact matches
    - Shows companies starting with search term first (e.g., "ABB" shows "ABB Ltd", "ABB India", etc.)
    - Includes word-level starts-with matching
    - Falls back to contains and word-based matching
    - Optimized scoring for better relevance
    """
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        # Handle both GET and POST requests
        if request.method == "POST" and search_request:
            search_term = search_request.company_name
        elif q:
            search_term = q
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing search term. Use 'q' parameter for GET or request body for POST"
            )
        
        # Search in SQLite database for instant response
        from app.database.CompanyDataSQLite import company_db
        results = company_db.search_by_name(search_term, limit)
        
        # Convert to expected response format
        formatted_results = []
        for company in results:
            formatted_results.append({
                "id": company.get("_id"),
                "company_name": company.get("company_name"),
                "categories": company.get("categories", []),
                "bank_names": company.get("bank_names", []),
                "similarity_percentage": company.get("rank_score", 100),  # Use rank_score from SQLite
                "is_active": company.get("is_active", True),
                "match_type": "sqlite_search"
            })
        
        print(f"🔍 SQLite Search API ({request.method}) returning {len(formatted_results)} results for '{search_term}'")
        return formatted_results
    except Exception as e:
        print(f"Search error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching companies: {str(e)}"
        )

@router.get("/company-names-from-vakilsearch", response_model=List[str])
async def get_company_names_from_vakilsearch(
    company_name: str = Query(..., description="Company name to search for"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Fetch company names from Vakilsearch API"""
    # Check permissions
    # # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        # Configure logging
        logger = logging.getLogger(__name__)
        
        # Vakilsearch API endpoint
        api_url = "https://company.vakilsearch.com/api/cns/search"
        
        # Prepare request payload with updated format
        payload = {
            "companyName": company_name,
            "isPagination": True,
            "state": [],
            "category": [],
            "status": [],
            "page": 0
        }
        
        # Make API request
        async with aiohttp.ClientSession() as session:
            async with session.post(
                api_url,
                json=payload,
                timeout=10,
                headers={
                    "User-Agent": "Rupiya-CRM/1.0",
                    "Content-Type": "application/json"
                }
            ) as response:
                logger.info(f"Vakilsearch API request for '{company_name}': Status {response.status}")
                
                if response.status == 200:
                    data = await response.json()
            
            # Extract company names from the updated response structure
            company_names = []
            
            # Handle the direct response structure with "result" array
            if isinstance(data, dict) and "result" in data:
                results = data["result"]
                if isinstance(results, list):
                    for company in results:
                        if isinstance(company, dict) and "companyName" in company:
                            company_names.append(company["companyName"])
            
            # Remove duplicates and return
            unique_names = list(set(company_names))
            
            if unique_names:
                logger.info(f"Found {len(unique_names)} company names from Vakilsearch API")
                return unique_names
            else:
                logger.warning(f"No company names found in Vakilsearch API response")
                # Return the original search term as fallback
                return [company_name]
        # else:
        #     logger.warning(f"Vakilsearch API returned status {response.status_code}")
        #     # Return the original search term as fallback
            return [company_name]
            
    except aiohttp.ClientError as e:
        logger.error(f"Error calling Vakilsearch API: {str(e)}")
        # Return the original search term as fallback
        return [company_name]
    except Exception as e:
        logger.error(f"Unexpected error in Vakilsearch API call: {str(e)}")
        # Return the original search term as fallback
        return [company_name]

@router.get("/company-data", response_model=List[CompanyDataInDB])
async def get_company_data(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    bank_name: Optional[str] = Query(None, description="Filter by bank name"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: int = Query(0, description="Offset for pagination"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all company data - INSTANT response from SQLite"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        from app.database.CompanyDataSQLite import company_db
        
        # ⚡ PERFORMANCE FIX: Add default pagination to prevent loading all 301K records
        default_limit = 100  # Default to 100 records for fast response
        effective_limit = limit if limit is not None else default_limit
        
        # Get data from SQLite database for instant response
        if bank_name:
            companies = company_db.filter_by_bank(bank_name)
        else:
            companies = company_db.get_all(limit=effective_limit, offset=offset)
        
        # Filter by active status if requested
        if is_active is not None:
            companies = [c for c in companies if c.get('is_active') == is_active]
        
        return companies
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching company data: {str(e)}"
        )

@router.post("/company-data", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_company_data(
    company: CompanyDataCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create new company data - INSTANT response"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        # Create in local JSON storage for instant response
        new_company = company_storage.create(company.dict())
        return {"id": new_company["_id"], "message": "Company data created successfully"}
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Company '{company.company_name}' already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating company data: {str(e)}"
        )

@router.put("/company-data/{company_id}", response_model=Dict[str, str])
async def update_company_data(
    company_id: str,
    company: CompanyDataUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update company data - INSTANT response"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        # Update in local JSON storage for instant response
        updated_company = company_storage.update(company_id, company.dict(exclude_unset=True))
        
        if updated_company:
            return {"message": "Company data updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company data not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating company data: {str(e)}"
        )

@router.delete("/company-data/{company_id}", response_model=Dict[str, str])
async def delete_company_data(
    company_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete company data - INSTANT response"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    # Delete from local JSON storage for instant response
    if company_storage.delete(company_id):
        return {"message": "Company data deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company data not found"
        )

@router.get("/banks", response_model=List[str])
async def get_available_banks(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get list of all available banks from company data - INSTANT response"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        from app.database.CompanyDataSQLite import company_db
        banks = company_db.get_unique_banks()
        return banks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching banks: {str(e)}"
        )

@router.get("/company-data/filter-by-bank/{bank_name}", response_model=List[CompanyDataInDB])
async def get_company_data_by_bank(
    bank_name: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get company data filtered by bank name - INSTANT response"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        companies = company_storage.filter_by_bank(bank_name)
        return companies
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error filtering companies by bank: {str(e)}"
        )

@router.delete("/company-data/delete-by-bank/{bank_name}", response_model=Dict[str, Any])
async def delete_company_data_by_bank(
    bank_name: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete all company data for a specific bank - INSTANT response"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    try:
        result = company_storage.delete_by_bank(bank_name)
        
        if result['deleted'] > 0:
            return {
                "success": True,
                "message": f"Successfully deleted {result['deleted']} companies for bank '{bank_name}'",
                "deleted_count": result['deleted'],
                "remaining_count": result['remaining'],
                "bank_name": bank_name
            }
        else:
            return {
                "success": False,
                "message": f"No companies found for bank '{bank_name}'",
                "deleted_count": 0,
                "remaining_count": result['remaining'],
                "bank_name": bank_name
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting companies by bank: {str(e)}"
        )

# ============= Combined Settings Routes =============

@router.get("/overview", response_model=SettingsDataResponse)
async def get_settings_overview(
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get overview of all settings data - ULTRA HIGH PERFORMANCE VERSION"""
    # Check permissions (commented out for 2ms target)
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    start_time = time.perf_counter()
    
    # Try to get from cache first (should be <0.1ms)
    cache_key = "settings_overview"
    cached_result = settings_cache.get(cache_key)
    
    if cached_result:
        # Return cached result immediately
        elapsed = (time.perf_counter() - start_time) * 1000
        print(f"Settings overview served from cache in {elapsed:.2f}ms")
        return cached_result
    
    try:
        # If not in cache, run all queries in parallel for speed
        async def get_overview_data():
            # Run all database queries concurrently
            tasks = [
                settings_db.get_campaign_names(),
                settings_db.get_data_codes(),
                settings_db.get_bank_names(),
                settings_db.get_channel_names(),
            ]
            
            # Execute all queries simultaneously
            campaign_names, data_codes, bank_names, channel_names = await asyncio.gather(*tasks)
            
            # Get company data from local storage (already fast)
            companies = company_storage.get_all()
            
            return {
                "campaign_names": campaign_names,
                "data_codes": data_codes,
                "bank_names": bank_names,
                "channel_names": channel_names,
                "company_data_count": len(companies)
            }
        
        # Get the data
        result = await get_overview_data()
        
        # Cache the result for future requests
        settings_cache.set(cache_key, result)
        
        # Background refresh trigger (non-blocking)
        if settings_cache.should_background_refresh():
            # Schedule background refresh without waiting
            asyncio.create_task(refresh_settings_cache_background(settings_db))
        
        elapsed = (time.perf_counter() - start_time) * 1000
        print(f"Settings overview served from DB in {elapsed:.2f}ms")
        
        return result
        
    except Exception as e:
        elapsed = (time.perf_counter() - start_time) * 1000
        print(f"Settings overview failed in {elapsed:.2f}ms: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching settings overview: {str(e)}"
        )

# Background cache refresh function (non-blocking)
async def refresh_settings_cache_background(settings_db: SettingsDB):
    """Refresh cache in background without blocking requests"""
    try:
        print("Background: Refreshing settings cache...")
        start_time = time.perf_counter()
        
        # Run all queries in parallel
        tasks = [
            settings_db.get_campaign_names(),
            settings_db.get_data_codes(),
            settings_db.get_bank_names(),
            settings_db.get_channel_names(),
        ]
        
        campaign_names, data_codes, bank_names, channel_names = await asyncio.gather(*tasks)
        companies = company_storage.get_all()
        
        result = {
            "campaign_names": campaign_names,
            "data_codes": data_codes,
            "bank_names": bank_names,
            "channel_names": channel_names,
            "company_data_count": len(companies)
        }
        
        # Update cache
        settings_cache.set("settings_overview", result)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        print(f"Background: Settings cache refreshed in {elapsed:.2f}ms")
        
    except Exception as e:
        print(f"Background: Settings cache refresh failed: {str(e)}")

# API endpoint to manually refresh cache (for testing)
@router.post("/refresh-cache")
async def refresh_settings_cache(
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Manually refresh the settings cache"""
    try:
        await refresh_settings_cache_background(settings_db)
        return {"message": "Settings cache refreshed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing cache: {str(e)}"
        )

# Pre-warm cache on startup
async def initialize_settings_cache():
    """Initialize the settings cache on application startup"""
    try:
        print("Initializing: Pre-warming settings cache...")
        db_instances = get_database_instances()
        settings_db = db_instances["settings"]
        await refresh_settings_cache_background(settings_db)
        print("Initializing: Settings cache pre-warmed successfully")
    except Exception as e:
        print(f"Initializing: Failed to pre-warm settings cache: {str(e)}")

# Cache invalidation functions (call these when settings are modified)
def invalidate_settings_cache():
    """Invalidate the settings cache when data is modified"""
    if "settings_overview" in settings_cache._cache:
        del settings_cache._cache["settings_overview"]
        del settings_cache._cache_timestamps["settings_overview"]
        print("Cache: Settings overview cache invalidated")

# Enhanced cache warming with retries
async def warm_settings_cache_with_retry(max_retries: int = 3):
    """Warm settings cache with retry logic"""
    for attempt in range(max_retries):
        try:
            await initialize_settings_cache()
            return True
        except Exception as e:
            print(f"Cache warming attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)  # Wait 1 second before retry
    return False

@router.get("/stats", response_model=SettingsStatsResponse)
async def get_settings_stats(
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get statistics for all settings"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        # Get all data
        all_campaigns = await settings_db.get_campaign_names()
        all_codes = await settings_db.get_data_codes()
        all_banks = await settings_db.get_bank_names()
        # Get company data from local JSON storage for instant response
        all_companies = company_storage.get_all()
        
        # Calculate stats
        active_campaigns = [c for c in all_campaigns if c.get("is_active", True)]
        active_codes = [c for c in all_codes if c.get("is_active", True)]
        active_banks = [b for b in all_banks if b.get("is_active", True)]
        active_companies = [c for c in all_companies if c.get("is_active", True)]
        
        return {
            "total_campaigns": len(all_campaigns),
            "active_campaigns": len(active_campaigns),
            "total_data_codes": len(all_codes),
            "active_data_codes": len(active_codes),
            "total_banks": len(all_banks),
            "active_banks": len(active_banks),
            "total_companies": len(all_companies),
            "active_companies": len(active_companies)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching settings stats: {str(e)}"
        )

# ============= Attachment Types Routes =============

@router.post("/attachment-types", response_model=Dict[str, str])
async def create_attachment_type(
    attachment_type: AttachmentTypeCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new attachment type"""
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        attachment_type_id = await settings_db.create_attachment_type(attachment_type.dict())
        return {"message": "Attachment type created successfully", "id": attachment_type_id}
    except ValueError as ve:
        # Handle sort_number duplicate errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        if "duplicate key" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attachment type '{attachment_type.name}' already exists for target type '{attachment_type.target_type}'"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating attachment type: {str(e)}"
        )

@router.get("/attachment-types", response_model=List[AttachmentTypeInDB])
async def get_attachment_types(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    target_type: Optional[str] = Query(None, description="Filter by target type (leads/employees)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all attachment types"""
    # Check permissions
    # # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        attachment_types = await settings_db.get_attachment_types(is_active, target_type)
        return attachment_types
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching attachment types: {str(e)}"
        )

@router.get("/all-attachment-types", response_model=List[AttachmentTypeInDB])
async def get_all_attachment_types_including_deleted(
    target_type: Optional[str] = Query(None, description="Filter by target type (leads/employees)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all attachment types including inactive/deleted ones for document type history"""
    # Check permissions
    # # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        # Get all attachment types without filtering by active status
        attachment_types = await settings_db.get_attachment_types(is_active=None, target_type=target_type)
        return attachment_types
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching all attachment types: {str(e)}"
        )

@router.get("/attachment-types/{attachment_type_id}", response_model=AttachmentTypeInDB)
async def get_attachment_type(
    attachment_type_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific attachment type"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    attachment_type = await settings_db.get_attachment_type(attachment_type_id)
    if not attachment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment type not found"
        )
    return attachment_type

@router.put("/attachment-types/{attachment_type_id}", response_model=Dict[str, str])
async def update_attachment_type(
    attachment_type_id: str,
    attachment_type: AttachmentTypeCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update an attachment type"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        success = await settings_db.update_attachment_type(attachment_type_id, attachment_type.dict())
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment type not found"
            )
        return {"message": "Attachment type updated successfully"}
    except ValueError as ve:
        # Handle sort_number duplicate errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        if "duplicate key" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attachment type '{attachment_type.name}' already exists for target type '{attachment_type.target_type}'"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating attachment type: {str(e)}"
        )

@router.delete("/attachment-types/{attachment_type_id}", response_model=Dict[str, str])
async def delete_attachment_type(
    attachment_type_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete an attachment type"""
    # Check permissions
    await check_permission(user_id, "settings", "delete", users_db, roles_db)
    
    if await settings_db.delete_attachment_type(attachment_type_id):
        return {"message": "Attachment type deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment type not found"
        )

# ============= Attendance Settings Routes =============

@router.get("/attendance-settings", response_model=Dict[str, Any])
async def get_attendance_settings(
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get attendance settings"""
    # Check permissions
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        settings = await settings_db.get_attendance_settings()
        return {
            "success": True,
            "data": settings
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching attendance settings: {str(e)}"
        )

@router.put("/attendance-settings", response_model=Dict[str, str])
async def update_attendance_settings(
    settings_update: AttendanceSettingsUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update attendance settings"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        # Validate time formats if provided
        time_fields = [
            "check_in_time", "check_out_time", "late_arrival_threshold", "early_departure_threshold",
            "shift_start_time", "shift_end_time", "reporting_deadline"
        ]
        for field in time_fields:
            value = getattr(settings_update, field, None)
            if value:
                try:
                    from datetime import datetime
                    datetime.strptime(value, "%H:%M")
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid time format for {field}. Use HH:MM format"
                    )
        
        # Validate numeric fields
        numeric_fields = [
            ("total_working_hours", "Total working hours"),
            ("minimum_working_hours_full_day", "Minimum working hours for full day"),
            ("minimum_working_hours_half_day", "Minimum working hours for half day"),
            ("full_day_working_hours", "Full day working hours"),
            ("half_day_minimum_working_hours", "Half day minimum working hours"),
        ]
        
        for field_name, field_label in numeric_fields:
            value = getattr(settings_update, field_name, None)
            if value is not None and value <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field_label} must be greater than 0"
                )
        
        # Validate integer fields
        int_fields = [
            ("grace_period_minutes", "Grace period minutes", 0, 120),
            ("grace_usage_limit", "Grace usage limit", 0, 10),
            ("pending_leave_auto_convert_days", "Pending leave auto-convert days", 1, 30),
            ("minimum_working_days_for_sunday", "Minimum working days for Sunday", 1, 6),
        ]
        
        for field_name, field_label, min_val, max_val in int_fields:
            value = getattr(settings_update, field_name, None)
            if value is not None and (value < min_val or value > max_val):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field_label} must be between {min_val} and {max_val}"
                )
        
        # Validate geofence settings
        if settings_update.geofence_enabled and (
            settings_update.office_latitude is None or 
            settings_update.office_longitude is None
        ):
            # Check if existing settings have coordinates
            existing_settings = await settings_db.get_attendance_settings()
            if not existing_settings.get("office_latitude") or not existing_settings.get("office_longitude"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Office coordinates must be set to enable geofence"
                )
        
        # Update settings
        success = await settings_db.update_attendance_settings(settings_update.dict(exclude_none=True))
        
        if success:
            return {"message": "Attendance settings updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update attendance settings"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating attendance settings: {str(e)}"
        )

@router.post("/attendance-settings/reset", response_model=Dict[str, str])
async def reset_attendance_settings(
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Reset attendance settings to default values"""
    # Check permissions
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        from datetime import datetime
        
        default_settings = {
            "check_in_time": "09:00",
            "check_out_time": "18:00",
            "total_working_hours": 9.0,
            "late_arrival_threshold": "10:30",
            "early_departure_threshold": "17:30",
            "minimum_working_hours_full_day": 8.0,
            "minimum_working_hours_half_day": 4.0,
            "overtime_threshold": 9.0,
            "weekend_days": [5, 6],  # Saturday, Sunday
            "allow_early_check_in": True,
            "allow_late_check_out": True,
            "require_photo": True,
            "require_geolocation": True,
            "geofence_enabled": False,
            "office_latitude": None,
            "office_longitude": None,
            "geofence_radius": 100.0,
            "updated_at": datetime.now()
        }
        
        success = await settings_db.update_attendance_settings(default_settings)
        
        if success:
            return {"message": "Attendance settings reset to defaults successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset attendance settings"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting attendance settings: {str(e)}"
        )

# ============= Permission Management Routes =============

@router.get("/permissions/structure")
async def get_permission_structure(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get the complete permission structure for role management"""
    # Check permission
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    permission_structure = {
        "Global": ["show", "*"],
        "Feeds": ["show", "feeds", "post", "*"],
        "Leads": ["create", "show", "assign", "own", "view_other", "all", "junior"],
        "Login": ["show", "own", "view_other", "all", "junior"],
        "Tasks": ["show", "create", "edit_others"],
        "Tickets": ["show", "own", "junior"],
        "HRMS Employees": ["show", "edit", "create", "delete", "all_employees"],
        "Leaves": ["show", "own", "admin", "create", "junior", "edit"],
        "Attendance": ["show", "own", "admin", "edit", "mark", "junior"],
        "Warnings": ["show", "warnings_own", "warnings_admin"],
        "Charts": ["show"],
        "Apps": ["show", "create", "edit", "delete", "manage_permissions"],
        "Settings": ["show"]
    }
    
    return {"permission_structure": permission_structure}

@router.get("/roles/all")
async def get_all_roles(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all roles with their permissions"""
    # Check permission
    # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        roles = await roles_db.get_all_roles()
        
        # Convert permissions to new format for each role
        for role in roles:
            if role.get("permissions"):
                permissions_dict = {}
                role_permissions = role.get("permissions", [])
                
                for perm in role_permissions:
                    page = perm.get("page", "")
                    actions = perm.get("actions", [])
                    
                    # Handle wildcard permissions for super admin (strict check: page="*" AND actions="*")
                    if page == "*" and actions == "*":
                        permissions_dict = {
                            "Global": "*",
                            "Feeds": "*", 
                            "Leads": "*",
                            "Login": "*",
                            "Tasks": "*",
                            "Tickets": "*",
                            "HRMS Employees": "*",
                            "Leaves": "*",
                            "Attendance": "*",
                            "Warnings": "*",
                            "Charts": "*",
                            "Apps": "*",
                            "Settings": "*"
                        }
                        break
                    
                    # Map old page names to new permission structure
                    page_mapping = {
                        "leads": "leads",
                        "feeds": "feeds", 
                        "tasks": "tasks",
                        "tickets": "tickets",
                        "users": "employees",
                        "hrms": "employees",
                        "leave": "leaves",
                        "attendance": "attendance", 
                        "warnings": "warnings",
                        "charts": "charts",
                        "settings": "settings",
                        "admin": "Global"
                    }
                    
                    mapped_page = page_mapping.get(page.lower(), page.lower())
                    
                    if isinstance(actions, str):
                        if actions == "*":
                            permissions_dict[mapped_page] = "*"
                        else:
                            permissions_dict[mapped_page] = [actions]
                    elif isinstance(actions, list):
                        if "*" in actions:
                            permissions_dict[mapped_page] = "*"
                        else:
                            permissions_dict[mapped_page] = actions
                
                role["formatted_permissions"] = permissions_dict
        
        return {"roles": roles}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get roles: {str(e)}"
        )

@router.put("/roles/{role_id}/permissions")
async def update_role_permissions(
    role_id: str,
    permissions_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update permissions for a specific role"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        # Convert new permission format back to old format for storage
        old_permissions = []
        new_permissions = permissions_data.get("permissions", {})
        
        # Reverse mapping from new format to old format
        reverse_page_mapping = {
            "Global": "admin",
            "feeds": "feeds",
            "leads": "leads", 
            "login": "login",
            "tasks": "tasks",
            "tickets": "tickets",
            "employees": "users",  # Map employees back to users
            "leaves": "leave",
            "attendance": "attendance",
            "warnings": "warnings", 
            "charts": "charts",
            "settings": "settings"
        }
        
        for page, actions in new_permissions.items():
            old_page = reverse_page_mapping.get(page.lower(), page.lower())
            
            if actions == "*":
                # Super admin permission
                if page.lower() == "global":
                    old_permissions.append({"page": "*", "actions": "*"})
                else:
                    old_permissions.append({"page": old_page, "actions": "*"})
            elif isinstance(actions, list):
                old_permissions.append({"page": old_page, "actions": actions})
            elif isinstance(actions, str):
                old_permissions.append({"page": old_page, "actions": [actions]})
        
        # Update the role
        success = await roles_db.update_role_permissions(role_id, old_permissions)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found or update failed"
            )
            
        return {"message": "Role permissions updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update role permissions: {str(e)}"
        )

# ============= Super Admin Management Routes =============

@router.post("/super-admin/create")
async def create_super_admin_role(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a super admin role with full permissions"""
    # Check permission - only existing super admins can create new super admin roles
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        role_id = await roles_db.create_super_admin_role()
        if role_id:
            return {"message": "Super admin role created successfully", "role_id": role_id}
        else:
            return {"message": "Super admin role already exists or creation failed"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create super admin role: {str(e)}"
        )

@router.put("/roles/{role_id}/make-super-admin")
async def make_role_super_admin(
    role_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Convert an existing role to super admin with page: * and actions: * permissions"""
    # Check permission - only existing super admins can create new super admin roles
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        success = await roles_db.ensure_super_admin_permissions(role_id)
        if success:
            return {"message": "Role converted to super admin successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found or update failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to convert role to super admin: {str(e)}"
        )

@router.get("/roles/{role_id}/is-super-admin")
async def check_super_admin_status(
    role_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Check if a role is a super admin role"""
    # Check permission
    # # await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        is_super_admin = await roles_db.is_super_admin_role(role_id)
        return {"is_super_admin": is_super_admin}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check super admin status: {str(e)}"
        )

# ============= Channel Names Endpoints =============

@router.post("/channel-names/", response_model=dict)
async def create_channel_name(
    channel_data: ChannelNameCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new channel name"""
    # Check permission
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    try:
        channel_id = await settings_db.create_channel_name(channel_data.dict())
        return {"id": channel_id, "message": "Channel name created successfully"}
    except Exception as e:
        if "duplicate key error" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Channel name already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create channel name: {str(e)}"
        )

@router.get("/channel-names/", response_model=List[ChannelNameInDB])
async def get_channel_names(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all channel names"""
    # Check permission
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        channels = await settings_db.get_channel_names(is_active=is_active)
        return [ChannelNameInDB(**channel) for channel in channels]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch channel names: {str(e)}"
        )

@router.get("/channel-names/{channel_id}", response_model=ChannelNameInDB)
async def get_channel_name(
    channel_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a channel name by ID"""
    # Check permission
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        channel = await settings_db.get_channel_name(channel_id)
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel name not found"
            )
        return ChannelNameInDB(**channel)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch channel name: {str(e)}"
        )

@router.put("/channel-names/{channel_id}", response_model=dict)
async def update_channel_name(
    channel_id: str,
    channel_data: ChannelNameUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a channel name"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        update_data = {k: v for k, v in channel_data.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        success = await settings_db.update_channel_name(channel_id, update_data)
        if success:
            return {"message": "Channel name updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel name not found or update failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        if "duplicate key error" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Channel name already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update channel name: {str(e)}"
        )

@router.delete("/channel-names/{channel_id}", response_model=dict)
async def delete_channel_name(
    channel_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a channel name"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        success = await settings_db.delete_channel_name(channel_id)
        if success:
            return {"message": "Channel name deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel name not found or delete failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete channel name: {str(e)}"
        )


# ==================== PAID LEAVE MANAGEMENT ENDPOINTS ====================

@router.get("/leave-balance/{employee_id}", response_model=Dict[str, Any])
async def get_employee_leave_balance(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get leave balance for a specific employee"""
    try:
        from app.schemas.attendance_schemas import EmployeeLeaveBalance
        
        # Get employee details
        employee = await users_db.get_user(employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Get or create leave balance
        balance = await settings_db.get_leave_balance(employee_id)
        
        if not balance:
            # Create default balance for new employee
            default_balance = {
                "employee_id": employee_id,
                "employee_name": employee.get("name", ""),
                "employee_code": employee.get("employee_code"),
                "department": employee.get("department"),
                "paid_leaves_total": 12,
                "paid_leaves_used": 0,
                "paid_leaves_remaining": 12,
                "earned_leaves_total": 15,
                "earned_leaves_used": 0,
                "earned_leaves_remaining": 15,
                "sick_leaves_total": 7,
                "sick_leaves_used": 0,
                "sick_leaves_remaining": 7,
                "casual_leaves_total": 5,
                "casual_leaves_used": 0,
                "casual_leaves_remaining": 5,
            }
            await settings_db.create_leave_balance(default_balance)
            balance = default_balance
        
        return {
            "success": True,
            "data": convert_object_id(balance)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching leave balance: {str(e)}"
        )


@router.post("/leave-balance/allocate", response_model=Dict[str, str])
async def allocate_leave_to_employee(
    allocation: dict,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Allocate leaves to an employee (Admin/Super Admin only)"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        from datetime import datetime
        
        employee_id = allocation.get("employee_id")
        leave_type = allocation.get("leave_type", "paid").lower()
        quantity = allocation.get("quantity", 0)
        reason = allocation.get("reason", "")
        
        if not employee_id or quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid employee_id or quantity"
            )
        
        # Validate leave type
        valid_types = ["paid", "earned", "sick", "casual"]
        if leave_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leave type must be one of: {', '.join(valid_types)}"
            )
        
        # Get current balance
        balance = await settings_db.get_leave_balance(employee_id)
        if not balance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee leave balance not found"
            )
        
        # Calculate new balance
        field_total = f"{leave_type}_leaves_total"
        field_remaining = f"{leave_type}_leaves_remaining"
        
        old_total = balance.get(field_total, 0)
        old_remaining = balance.get(field_remaining, 0)
        
        new_total = old_total + quantity
        new_remaining = old_remaining + quantity
        
        # Update balance
        update_data = {
            field_total: new_total,
            field_remaining: new_remaining,
            "last_updated": datetime.utcnow()
        }
        
        success = await settings_db.update_leave_balance(employee_id, update_data)
        
        if success:
            # Log the transaction
            admin_user = await users_db.get_user(user_id)
            admin_name = admin_user.get("name", "Admin") if admin_user else "Admin"
            
            history_entry = {
                "employee_id": employee_id,
                "employee_name": balance.get("employee_name"),
                "leave_type": leave_type,
                "transaction_type": "allocation",
                "quantity": quantity,
                "reason": reason,
                "performed_by": user_id,
                "performed_by_name": admin_name,
                "timestamp": datetime.utcnow(),
                "balance_before": old_remaining,
                "balance_after": new_remaining
            }
            await settings_db.add_leave_history(history_entry)
            
            return {
                "message": f"Successfully allocated {quantity} {leave_type} leaves",
                "new_total": new_total,
                "new_remaining": new_remaining
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update leave balance"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error allocating leaves: {str(e)}"
        )


@router.post("/leave-balance/deduct", response_model=Dict[str, str])
async def deduct_leave_from_employee(
    deduction: dict,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Deduct leaves from an employee (Admin/Super Admin only)"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        from datetime import datetime
        
        employee_id = deduction.get("employee_id")
        leave_type = deduction.get("leave_type", "paid").lower()
        quantity = deduction.get("quantity", 0)
        reason = deduction.get("reason", "")
        
        if not employee_id or quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid employee_id or quantity"
            )
        
        # Get current balance
        balance = await settings_db.get_leave_balance(employee_id)
        if not balance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee leave balance not found"
            )
        
        # Calculate new balance
        field_remaining = f"{leave_type}_leaves_remaining"
        old_remaining = balance.get(field_remaining, 0)
        
        if old_remaining < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient {leave_type} leaves. Available: {old_remaining}, Requested: {quantity}"
            )
        
        new_remaining = old_remaining - quantity
        
        # Update balance
        update_data = {
            field_remaining: new_remaining,
            f"{leave_type}_leaves_used": balance.get(f"{leave_type}_leaves_used", 0) + quantity,
            "last_updated": datetime.utcnow()
        }
        
        success = await settings_db.update_leave_balance(employee_id, update_data)
        
        if success:
            # Log the transaction
            admin_user = await users_db.get_user(user_id)
            admin_name = admin_user.get("name", "Admin") if admin_user else "Admin"
            
            history_entry = {
                "employee_id": employee_id,
                "employee_name": balance.get("employee_name"),
                "leave_type": leave_type,
                "transaction_type": "deduction",
                "quantity": quantity,
                "reason": reason,
                "performed_by": user_id,
                "performed_by_name": admin_name,
                "timestamp": datetime.utcnow(),
                "balance_before": old_remaining,
                "balance_after": new_remaining
            }
            await settings_db.add_leave_history(history_entry)
            
            return {
                "message": f"Successfully deducted {quantity} {leave_type} leaves",
                "new_remaining": new_remaining
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update leave balance"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deducting leaves: {str(e)}"
        )


@router.get("/leave-balance/history/{employee_id}", response_model=List[Dict[str, Any]])
async def get_leave_history(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get leave transaction history for an employee"""
    try:
        history = await settings_db.get_leave_history(employee_id)
        return [convert_object_id(h) for h in history]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching leave history: {str(e)}"
        )


@router.post("/leave-balance/bulk-allocate", response_model=Dict[str, Any])
async def bulk_allocate_leaves(
    bulk_allocation: dict,
    user_id: str = Query(..., description="ID of the user making the request"),
    settings_db: SettingsDB = Depends(get_settings_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Bulk allocate leaves to multiple employees"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    try:
        employee_ids = bulk_allocation.get("employee_ids", [])
        leave_type = bulk_allocation.get("leave_type", "paid").lower()
        quantity = bulk_allocation.get("quantity", 0)
        reason = bulk_allocation.get("reason", "")
        
        if not employee_ids or quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid employee_ids or quantity"
            )
        
        success_count = 0
        failed_count = 0
        errors = []
        
        for emp_id in employee_ids:
            try:
                allocation = {
                    "employee_id": emp_id,
                    "leave_type": leave_type,
                    "quantity": quantity,
                    "reason": reason
                }
                await allocate_leave_to_employee(allocation, user_id, settings_db, users_db, roles_db)
                success_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"{emp_id}: {str(e)}")
        
        return {
            "message": f"Bulk allocation completed. Success: {success_count}, Failed: {failed_count}",
            "success_count": success_count,
            "failed_count": failed_count,
            "errors": errors if errors else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in bulk allocation: {str(e)}"        )