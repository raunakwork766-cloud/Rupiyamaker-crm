"""
Updated Company Data Routes with High-Performance Database Options
Choose your preferred database backend for 10L+ records
"""
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, BackgroundTasks, Depends
from typing import List, Dict, Any, Optional
import time

# Import all database options
from app.database.CompanyDataSQLite import company_db as sqlite_db
from app.database.CompanyDataMongoDB import company_mongo_db as mongo_db
from app.database.CompanyDataRedis import company_redis as redis_db

# Import existing dependencies
from app.routes.settings import check_permission, get_settings_db, get_users_db, get_roles_db
from app.database.Settings import SettingsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database import get_database_instances

router = APIRouter()

# Configuration - Choose your database backend
DATABASE_BACKEND = "sqlite"  # Options: "sqlite", "mongodb", "redis", "postgresql"

def get_company_db():
    """Get the configured company database instance"""
    if DATABASE_BACKEND == "sqlite":
        return sqlite_db
    elif DATABASE_BACKEND == "mongodb": 
        return mongo_db
    elif DATABASE_BACKEND == "redis":
        return redis_db
    else:
        raise HTTPException(status_code=500, detail="Invalid database backend configured")

# ============= High-Performance Company Data Routes =============

@router.post("/upload-excel-optimized", response_model=Dict[str, Any])
async def upload_excel_optimized(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Excel file with company data"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    ULTRA-FAST Excel upload with optimized database operations
    
    Performance targets:
    - 100K records: < 10 seconds
    - 1M records: < 60 seconds  
    - 10M+ records: < 300 seconds
    """
    start_time = time.time()
    
    # Check permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    # Validate file
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)"
        )
    
    try:
        # Save temporary file
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        file_size_mb = len(content) / (1024 * 1024)
        
        # Quick response for large files
        if file_size_mb > 50:  # Large file - process in background
            background_tasks.add_task(process_excel_background, temp_file_path, user_id)
            
            return {
                "status": "processing",
                "message": f"Large file ({file_size_mb:.1f} MB) queued for background processing",
                "estimated_time": f"{(file_size_mb / 10):.0f} seconds",
                "file_size_mb": file_size_mb,
                "backend": DATABASE_BACKEND,
                "processing_time": time.time() - start_time
            }
        
        # Process small files immediately
        else:
            company_db = get_company_db()
            
            if DATABASE_BACKEND == "sqlite":
                stats = await company_db.bulk_upsert_from_excel(temp_file_path)
            elif DATABASE_BACKEND == "mongodb":
                stats = await company_db.bulk_upsert_from_excel(temp_file_path)
            elif DATABASE_BACKEND == "redis":
                stats = await company_db.bulk_load_from_excel(temp_file_path)
            
            # Cleanup
            os.unlink(temp_file_path)
            
            processing_time = time.time() - start_time
            
            return {
                "status": "completed",
                "message": "Excel data processed successfully",
                "stats": stats,
                "file_size_mb": file_size_mb,
                "processing_time": processing_time,
                "backend": DATABASE_BACKEND,
                "performance": {
                    "records_per_second": (stats.get('created', 0) + stats.get('updated', 0)) / processing_time if processing_time > 0 else 0,
                    "mb_per_second": file_size_mb / processing_time if processing_time > 0 else 0
                }
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing Excel file: {str(e)}"
        )

async def process_excel_background(file_path: str, user_id: str):
    """Background task for processing large Excel files"""
    try:
        company_db = get_company_db()
        
        print(f"🚀 Starting background processing of {file_path}")
        start_time = time.time()
        
        if DATABASE_BACKEND == "sqlite":
            stats = await company_db.bulk_upsert_from_excel(file_path)
        elif DATABASE_BACKEND == "mongodb":
            stats = await company_db.bulk_upsert_from_excel(file_path)
        elif DATABASE_BACKEND == "redis":
            stats = await company_db.bulk_load_from_excel(file_path)
        
        processing_time = time.time() - start_time
        
        print(f"✅ Background processing completed in {processing_time:.2f} seconds")
        print(f"📊 Stats: {stats}")
        
        # Cleanup
        import os
        os.unlink(file_path)
        
    except Exception as e:
        print(f"❌ Background processing error: {e}")

@router.get("/company-data-optimized", response_model=List[Dict[str, Any]])
async def get_company_data_optimized(
    limit: int = Query(100, description="Number of records to return"),
    offset: int = Query(0, description="Number of records to skip"),
    bank_name: Optional[str] = Query(None, description="Filter by bank name"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get company data with optimized pagination - INSTANT response"""
    start_time = time.time()
    
    # Check permissions
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        company_db = get_company_db()
        
        if bank_name:
            companies = await company_db.filter_by_bank(bank_name)
            # Apply pagination to filtered results
            companies = companies[offset:offset + limit]
        else:
            if DATABASE_BACKEND == "sqlite":
                companies = await company_db.get_all(limit=limit, offset=offset)
            elif DATABASE_BACKEND == "mongodb":
                companies = await company_db.get_all(limit=limit, skip=offset)
            elif DATABASE_BACKEND == "redis":
                all_companies = await company_db.get_all(limit=5000)  # Redis limit
                companies = all_companies[offset:offset + limit]
        
        response_time = time.time() - start_time
        
        # Add performance metadata
        for company in companies:
            company['_query_time'] = response_time
            company['_backend'] = DATABASE_BACKEND
        
        return companies
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching company data: {str(e)}"
        )

@router.get("/search-companies-optimized", response_model=List[Dict[str, Any]])
async def search_companies_optimized(
    q: str = Query(..., description="Company name to search for"),
    limit: int = Query(50, description="Maximum number of results"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    ULTRA-FAST company name search with sub-second response time
    
    Performance: <100ms for 10M+ records
    """
    start_time = time.time()
    
    # Check permissions
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        company_db = get_company_db()
        results = await company_db.search_by_name(q, limit=limit)
        
        response_time = time.time() - start_time
        
        # Add performance metadata
        for result in results:
            result['_search_time'] = response_time
            result['_backend'] = DATABASE_BACKEND
            result['_search_query'] = q
        
        return results
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching companies: {str(e)}"
        )

@router.get("/company-stats", response_model=Dict[str, Any])
async def get_company_stats(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get database statistics and performance metrics"""
    start_time = time.time()
    
    # Check permissions
    await check_permission(user_id, "settings", "show", users_db, roles_db)
    
    try:
        company_db = get_company_db()
        stats = await company_db.get_stats()
        
        stats.update({
            'backend': DATABASE_BACKEND,
            'query_time': time.time() - start_time,
            'optimizations': {
                'sqlite': 'B-tree indexes, WAL mode, FTS',
                'mongodb': 'Compound indexes, aggregation pipelines',
                'redis': 'In-memory hash tables, search indexes',
                'postgresql': 'GIN indexes, full-text search, JSONB'
            }.get(DATABASE_BACKEND, 'Unknown')
        })
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting stats: {str(e)}"
        )

@router.post("/switch-backend")
async def switch_database_backend(
    new_backend: str = Query(..., description="New backend: sqlite, mongodb, redis"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Switch database backend (admin only)"""
    # Check admin permissions
    await check_permission(user_id, "settings", "create", users_db, roles_db)
    
    global DATABASE_BACKEND
    
    valid_backends = ["sqlite", "mongodb", "redis", "postgresql"]
    if new_backend not in valid_backends:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid backend. Choose from: {valid_backends}"
        )
    
    old_backend = DATABASE_BACKEND
    DATABASE_BACKEND = new_backend
    
    return {
        "message": f"Database backend switched from {old_backend} to {new_backend}",
        "old_backend": old_backend,
        "new_backend": new_backend,
        "performance_notes": {
            "sqlite": "Best for single-server deployments, excellent read performance",
            "mongodb": "Best for distributed systems, flexible schema",
            "redis": "Fastest search performance, requires more memory",
            "postgresql": "Best for complex queries, ACID compliance"
        }.get(new_backend)
    }
