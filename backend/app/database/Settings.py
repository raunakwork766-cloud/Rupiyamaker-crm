from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime
import pandas as pd
from difflib import SequenceMatcher
import re
import logging
import os
import sys
from pymongo import UpdateOne, InsertOne
from pymongo.errors import BulkWriteError
import threading
import concurrent.futures
from collections import defaultdict

# Import local storage
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from app.utils.local_storage import company_storage
except ImportError:
    # Fallback if import fails
    company_storage = None

class SettingsDB:
    """Database operations for Settings collections"""
    
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
            
        # Collections for different settings
        self.campaign_names_collection = self.db["campaign_names"]
        self.data_codes_collection = self.db["data_codes"]
        self.bank_names_collection = self.db["bank_names"]
        self.company_data_collection = self.db["company_data"]
        self.attachment_types_collection = self.db["attachment_types"]
        self.attendance_settings_collection = self.db["attendance_settings"]
        self.channel_names_collection = self.db["channel_names"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.campaign_names_collection.create_index("name", unique=True)
            await self.data_codes_collection.create_index("name", unique=True)
            await self.bank_names_collection.create_index("name", unique=True)
            await self.company_data_collection.create_index("company_name")
            await self.company_data_collection.create_index("bank_name")
            # Compound index for attachment types
            await self.attachment_types_collection.create_index([("name", 1), ("target_type", 1)], unique=True)
            await self.channel_names_collection.create_index("name", unique=True)
        except Exception as e:
            print(f"SettingsDB index creation warning: {e}")
        # Sync fallback for older systems
        self.attachment_types_collection.create_index([("name", 1), ("target_type", 1)], unique=True)
        self.channel_names_collection.create_index("name", unique=True)
    
    async def _async_to_list(self, cursor):
        """Convert async Motor cursor to list"""
        return await cursor.to_list(None)
        
        # Initialize default attendance settings if not exists
        self._init_default_attendance_settings()
        
    # ============= Campaign Names =============
    
    async def create_campaign_name(self, campaign_data: dict) -> str:
        """Create a new campaign name"""
        campaign_data["created_at"] = datetime.now()
        campaign_data["updated_at"] = campaign_data["created_at"]
        campaign_data["is_active"] = campaign_data.get("is_active", True)
        
        result = await self.campaign_names_collection.insert_one(campaign_data)
        return str(result.inserted_id)
    
    async def get_campaign_names(self, is_active: Optional[bool] = None) -> List[dict]:
        """Get all campaign names"""
        filter_dict = {}
        if is_active is not None:
            filter_dict["is_active"] = is_active
            
        campaigns = await self._async_to_list(self.campaign_names_collection.find(filter_dict).sort("name", 1))
        for campaign in campaigns:
            campaign["_id"] = str(campaign["_id"])
        return campaigns
    
    async def get_campaign_name(self, campaign_id: str) -> Optional[dict]:
        """Get a specific campaign name by ID"""
        if not ObjectId.is_valid(campaign_id):
            return None
        campaign = await self.campaign_names_collection.find_one({"_id": ObjectId(campaign_id)})
        if campaign:
            campaign["_id"] = str(campaign["_id"])
        return campaign
    
    async def update_campaign_name(self, campaign_id: str, update_data: dict) -> bool:
        """Update a campaign name"""
        if not ObjectId.is_valid(campaign_id):
            return False
        
        update_data["updated_at"] = datetime.now()
        result = await self.campaign_names_collection.update_one(
            {"_id": ObjectId(campaign_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_campaign_name(self, campaign_id: str) -> bool:
        """Delete a campaign name"""
        if not ObjectId.is_valid(campaign_id):
            return False
        
        result = await self.campaign_names_collection.delete_one({"_id": ObjectId(campaign_id)})
        return result.deleted_count > 0
    
    # ============= Data Codes =============
    
    async def create_data_code(self, data_code_data: dict) -> str:
        """Create a new data code"""
        data_code_data["created_at"] = datetime.now()
        data_code_data["updated_at"] = data_code_data["created_at"]
        data_code_data["is_active"] = data_code_data.get("is_active", True)
        
        result = await self.data_codes_collection.insert_one(data_code_data)
        return str(result.inserted_id)
    
    async def get_data_codes(self, is_active: Optional[bool] = None) -> List[dict]:
        """Get all data codes"""
        filter_dict = {}
        if is_active is not None:
            filter_dict["is_active"] = is_active
            
        codes = await self._async_to_list(self.data_codes_collection.find(filter_dict).sort("name", 1))
        for code in codes:
            code["_id"] = str(code["_id"])
        return codes
    
    async def get_data_code(self, code_id: str) -> Optional[dict]:
        """Get a data code by ID"""
        if not ObjectId.is_valid(code_id):
            return None
        code = await self.data_codes_collection.find_one({"_id": ObjectId(code_id)})
        if code:
            code["_id"] = str(code["_id"])
        return code
    
    async def update_data_code(self, code_id: str, update_data: dict) -> bool:
        """Update a data code"""
        if not ObjectId.is_valid(code_id):
            return False
        
        update_data["updated_at"] = datetime.now()
        result = await self.data_codes_collection.update_one(
            {"_id": ObjectId(code_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_data_code(self, code_id: str) -> bool:
        """Delete a data code"""
        if not ObjectId.is_valid(code_id):
            return False
        
        result = await self.data_codes_collection.delete_one({"_id": ObjectId(code_id)})
        return result.deleted_count > 0
    
    # ============= Channel Names =============
    
    async def create_channel_name(self, channel_data: dict) -> str:
        """Create a new channel name"""
        channel_data["created_at"] = datetime.now()
        channel_data["updated_at"] = channel_data["created_at"]
        channel_data["is_active"] = channel_data.get("is_active", True)
        
        result = await self.channel_names_collection.insert_one(channel_data)
        return str(result.inserted_id)
    
    async def get_channel_names(self, is_active: Optional[bool] = None) -> List[dict]:
        """Get all channel names"""
        filter_dict = {}
        if is_active is not None:
            filter_dict["is_active"] = is_active
            
        channels = await self._async_to_list(self.channel_names_collection.find(filter_dict).sort("name", 1))
        for channel in channels:
            channel["_id"] = str(channel["_id"])
        return channels
    
    async def get_channel_name(self, channel_id: str) -> Optional[dict]:
        """Get a channel name by ID"""
        if not ObjectId.is_valid(channel_id):
            return None
        channel = await self.channel_names_collection.find_one({"_id": ObjectId(channel_id)})
        if channel:
            channel["_id"] = str(channel["_id"])
        return channel
    
    async def update_channel_name(self, channel_id: str, update_data: dict) -> bool:
        """Update a channel name"""
        if not ObjectId.is_valid(channel_id):
            return False
        
        update_data["updated_at"] = datetime.now()
        result = await self.channel_names_collection.update_one(
            {"_id": ObjectId(channel_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_channel_name(self, channel_id: str) -> bool:
        """Delete a channel name"""
        if not ObjectId.is_valid(channel_id):
            return False
        
        result = await self.channel_names_collection.delete_one({"_id": ObjectId(channel_id)})
        return result.deleted_count > 0
    
    # ============= Bank Names =============
    
    async def create_bank_name(self, bank_data: dict) -> str:
        """Create a new bank name"""
        bank_data["created_at"] = datetime.now()
        bank_data["updated_at"] = bank_data["created_at"]
        bank_data["is_active"] = bank_data.get("is_active", True)
        
        result = await self.bank_names_collection.insert_one(bank_data)
        return str(result.inserted_id)
    
    async def get_bank_names(self, is_active: Optional[bool] = None) -> List[dict]:
        """Get all bank names"""
        filter_dict = {}
        if is_active is not None:
            filter_dict["is_active"] = is_active
            
        banks = await self._async_to_list(self.bank_names_collection.find(filter_dict).sort("name", 1))
        for bank in banks:
            bank["_id"] = str(bank["_id"])
        return banks
    
    async def get_bank_name(self, bank_id: str) -> Optional[dict]:
        """Get a bank name by ID"""
        if not ObjectId.is_valid(bank_id):
            return None
        bank = await self.bank_names_collection.find_one({"_id": ObjectId(bank_id)})
        if bank:
            bank["_id"] = str(bank["_id"])
        return bank
    
    async def update_bank_name(self, bank_id: str, update_data: dict) -> bool:
        """Update a bank name"""
        if not ObjectId.is_valid(bank_id):
            return False
        
        update_data["updated_at"] = datetime.now()
        result = await self.bank_names_collection.update_one(
            {"_id": ObjectId(bank_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_bank_name(self, bank_id: str) -> bool:
        """Delete a bank name"""
        if not ObjectId.is_valid(bank_id):
            return False
        
        result = await self.bank_names_collection.delete_one({"_id": ObjectId(bank_id)})
        return result.deleted_count > 0
    
    # ============= Company Data =============
    
    def upload_excel_data_fast(self, excel_file_path: str, upload_id: str = None, progress_callback=None) -> Dict[str, Any]:
        """
        ULTRA-FAST Excel upload optimized for instant processing
        Features:
        - Parallel chunk processing
        - Bulk upserts with minimal lookups
        - Real-time progress callbacks
        - Memory-efficient streaming
        """
        import concurrent.futures
        import threading
        from collections import defaultdict
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        try:
            # Ultra-fast performance settings
            CHUNK_SIZE = 5000       # Smaller chunks for faster response
            BULK_BATCH_SIZE = 2000  # Larger batches for speed
            MAX_WORKERS = 4         # Parallel processing
            
            logger.info(f"🚀 FAST processing started for upload {upload_id}")
            
            # Quick file validation
            try:
                # Read just the header to get basic info
                sample_df = pd.read_excel(excel_file_path, nrows=1)
                # Get total rows by reading only first column
                total_rows = len(pd.read_excel(excel_file_path, usecols=[0])) - 1  # Exclude header
                logger.info(f"⚡ Total rows: {total_rows:,}")
            except Exception:
                total_rows = "Unknown"
            
            # Initialize counters (thread-safe)
            stats = {
                'processed_count': 0,
                'created_count': 0,
                'updated_count': 0,
                'error_count': 0,
                'total_processed': 0
            }
            stats_lock = threading.Lock()
            
            async def update_stats(local_stats):
                with stats_lock:
                    for key, value in local_stats.items():
                        stats[key] += value
            
            async def process_chunk_fast(chunk_data):
                """Process a single chunk with maximum speed using local JSON storage"""
                local_stats = defaultdict(int)
                records_to_process = []
                
                for _, row in chunk_data.iterrows():
                    try:
                        # Lightning-fast data extraction
                        company_name = str(row.get('COMPANY NAME', '')).strip()
                        if not company_name or company_name.lower() in ['nan', 'null', '']:
                            continue
                        
                        category = str(row.get('CATEGORIES', '')).strip()
                        bank_name = str(row.get('BANK', '')).strip()
                        
                        # Prepare record for local storage
                        record = {
                            "company_name": company_name,
                            "categories": [category] if category and category.lower() not in ['nan', 'null', ''] else [],
                            "bank": bank_name if bank_name and bank_name.lower() not in ['nan', 'null', ''] else '',
                            "bank_names": [bank_name] if bank_name and bank_name.lower() not in ['nan', 'null', ''] else [],
                            "is_active": True,
                            "updated_at": datetime.now().isoformat()
                        }
                        
                        records_to_process.append(record)
                        local_stats['processed_count'] += 1
                        
                    except Exception as e:
                        local_stats['error_count'] += 1
                        continue
                
                # Bulk upsert to local JSON storage
                if records_to_process and company_storage:
                    try:
                        bulk_stats = company_storage.bulk_upsert(records_to_process)
                        local_stats['created_count'] += bulk_stats.get('created', 0)
                        local_stats['updated_count'] += bulk_stats.get('updated', 0)
                        local_stats['error_count'] += bulk_stats.get('errors', 0)
                    except Exception as e:
                        logger.error(f"Error in bulk upsert to local storage: {e}")
                        local_stats['error_count'] += len(records_to_process)
                
                return local_stats
            
            # Process in parallel chunks for maximum speed
            chunk_futures = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                chunk_number = 0
                
                # Read the entire Excel file first (Excel doesn't support chunking like CSV)
                logger.info("📖 Reading Excel file...")
                full_df = pd.read_excel(excel_file_path)
                logger.info(f"✅ Read {len(full_df)} rows from Excel")
                
                # Validate columns
                full_df.columns = [col.upper() for col in full_df.columns]
                required_columns = ['COMPANY NAME', 'CATEGORIES', 'BANK']
                missing_columns = [col for col in required_columns if col not in full_df.columns]
                if missing_columns:
                    return {
                        "success": False,
                        "message": f"Missing required columns: {missing_columns}"
                    }
                
                # Now split into chunks manually for parallel processing
                total_rows = len(full_df)
                for start_idx in range(0, total_rows, CHUNK_SIZE):
                    chunk_number += 1
                    end_idx = min(start_idx + CHUNK_SIZE, total_rows)
                    chunk_df = full_df.iloc[start_idx:end_idx].copy()
                    
                    # Submit chunk for parallel processing
                    future = executor.submit(process_chunk_fast, chunk_df)
                    chunk_futures.append((chunk_number, future))
                    
                    # Real-time progress update
                    if progress_callback and total_rows != "Unknown":
                        progress_percent = min(95, (chunk_number * CHUNK_SIZE / total_rows) * 100)
                        progress_callback({
                            "status": "processing",
                            "progress_percent": round(progress_percent, 1),
                            "message": f"Processing chunk {chunk_number}...",
                            "chunks_completed": chunk_number
                        })
                
                # Collect results as they complete
                for chunk_num, future in chunk_futures:
                    try:
                        local_stats = future.result(timeout=60)  # 1 minute timeout per chunk
                        update_stats(local_stats)
                        
                        # Update progress
                        if progress_callback:
                            completed_chunks = sum(1 for _, f in chunk_futures if f.done())
                            progress_percent = min(95, (completed_chunks / len(chunk_futures)) * 100)
                            progress_callback({
                                "status": "processing",
                                "progress_percent": round(progress_percent, 1),
                                "message": f"Completed {completed_chunks}/{len(chunk_futures)} chunks"
                            })
                            
                    except concurrent.futures.TimeoutError:
                        logger.warning(f"Chunk {chunk_num} timed out")
                        stats['error_count'] += CHUNK_SIZE
                    except Exception as e:
                        logger.error(f"Chunk {chunk_num} failed: {e}")
                        stats['error_count'] += CHUNK_SIZE
            
            # Final progress update
            if progress_callback:
                progress_callback({
                    "status": "finalizing",
                    "progress_percent": 99,
                    "message": "Finalizing results..."
                })
            
            # Calculate final statistics
            success_rate = ((stats['processed_count'] - stats['error_count']) / max(stats['processed_count'], 1)) * 100
            
            result = {
                "success": True,
                "message": f"⚡ FAST processing completed! Processed {stats['processed_count']:,} records",
                "stats": {
                    "total_rows_processed": stats['processed_count'],
                    "valid_records_processed": stats['processed_count'] - stats['error_count'],
                    "created": stats['created_count'],
                    "updated": stats['updated_count'],
                    "errors_skipped": stats['error_count'],
                    "success_rate_percent": round(success_rate, 2),
                    "chunks_processed": len(chunk_futures),
                    "parallel_workers": MAX_WORKERS
                }
            }
            
            logger.info(f"🎉 FAST processing completed: {result}")
            return result

        except Exception as e:
            logger.error(f"💥 FAST processing failed: {str(e)}")
            return {
                "success": False,
                "message": f"Fast processing failed: {str(e)}",
                "stats": stats if 'stats' in locals() else {}
            }

    def upload_excel_data(self, excel_file_path: str) -> Dict[str, Any]:
        """
        High-performance Excel upload for large files (1M+ records)
        Uses chunked processing, bulk operations, and error recovery
        """
        # Setup logging for detailed progress tracking
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        try:
            # Performance optimizations
            CHUNK_SIZE = 10000  # Process 10K records at a time
            BULK_BATCH_SIZE = 1000  # Bulk operations batch size
            
            logger.info(f"Starting Excel processing for file: {excel_file_path}")
            
            # Get file info for progress tracking
            try:
                # Read just first few rows to get column info and total rows
                sample_df = pd.read_excel(excel_file_path, nrows=5)
                total_rows = len(pd.read_excel(excel_file_path, usecols=[0]))
                logger.info(f"Total rows detected: {total_rows}")
            except Exception as e:
                logger.warning(f"Could not get row count: {e}. Proceeding with chunked processing.")
                total_rows = "Unknown"
            
            # Initialize counters
            processed_count = 0
            updated_count = 0
            created_count = 0
            error_count = 0
            total_processed = 0
            
            # Process file in chunks
            chunk_number = 0
            
            # Read entire Excel file (Excel doesn't support chunking like CSV)
            logger.info("Reading Excel file...")
            full_df = pd.read_excel(excel_file_path)
            logger.info(f"Read {len(full_df)} rows from Excel")
            total_rows = len(full_df)
            
            # Process in chunks manually
            for start_idx in range(0, total_rows, CHUNK_SIZE):
                chunk_number += 1
                end_idx = min(start_idx + CHUNK_SIZE, total_rows)
                chunk_df = full_df.iloc[start_idx:end_idx].copy()
                chunk_number += 1
                logger.info(f"Processing chunk {chunk_number} with {len(chunk_df)} rows...")
                
                try:
                    # Convert all column names to uppercase for consistency
                    chunk_df.columns = [col.upper() for col in chunk_df.columns]
                    
                    # Define required columns in uppercase
                    required_columns = ['COMPANY NAME', 'CATEGORIES', 'BANK']
                    
                    # Check for missing columns (only on first chunk)
                    if chunk_number == 1:
                        missing_columns = [col for col in required_columns if col not in chunk_df.columns]
                        if missing_columns:
                            return {
                                "success": False,
                                "message": f"Missing required columns: {missing_columns}. Available columns: {list(chunk_df.columns)}"
                            }
                    
                    # Prepare bulk operations
                    bulk_operations = []
                    chunk_processed = 0
                    chunk_errors = 0
                    
                    for idx, row in chunk_df.iterrows():
                        try:
                            # Extract and clean data
                            company_name = str(row.get('COMPANY NAME', '')).strip()
                            category = str(row.get('CATEGORIES', '')).strip()
                            bank_name = str(row.get('BANK', '')).strip()
                            
                            # Skip invalid rows
                            if not company_name or company_name.lower() in ['nan', 'null', '']:
                                continue
                            
                            # Use upsert with update or insert logic
                            # This is much faster than individual find operations
                            filter_query = {
                                "company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}
                            }
                            
                            update_doc = {
                                "$setOnInsert": {
                                    "company_name": company_name,
                                    "created_at": datetime.now(),
                                    "is_active": True
                                },
                                "$set": {
                                    "updated_at": datetime.now()
                                },
                                "$addToSet": {}
                            }
                            
                            # Add category and bank to arrays if they exist
                            if category and category.lower() not in ['nan', 'null', '']:
                                update_doc["$addToSet"]["categories"] = category
                            
                            if bank_name and bank_name.lower() not in ['nan', 'null', '']:
                                update_doc["$addToSet"]["bank_names"] = bank_name
                            
                            # Only add if there's something to update
                            if update_doc["$addToSet"]:
                                bulk_operations.append(
                                    UpdateOne(
                                        filter_query,
                                        update_doc,
                                        upsert=True
                                    )
                                )
                            
                            chunk_processed += 1
                            
                            # Execute bulk operations in batches
                            if len(bulk_operations) >= BULK_BATCH_SIZE:
                                try:
                                    result = self.company_data_collection.bulk_write(bulk_operations, ordered=False)
                                    created_count += result.upserted_count
                                    updated_count += result.modified_count
                                    bulk_operations = []
                                except BulkWriteError as bwe:
                                    # Continue processing even if some operations fail
                                    error_count += len(bwe.details['writeErrors'])
                                    created_count += bwe.details.get('upserted', 0)
                                    updated_count += bwe.details.get('nModified', 0)
                                    logger.warning(f"Bulk write errors in chunk {chunk_number}: {len(bwe.details['writeErrors'])} errors")
                                    bulk_operations = []
                        
                        except Exception as row_error:
                            # Skip individual row errors and continue
                            chunk_errors += 1
                            error_count += 1
                            logger.warning(f"Error processing row {idx} in chunk {chunk_number}: {str(row_error)}")
                            continue
                    
                    # Execute remaining bulk operations
                    if bulk_operations:
                        try:
                            result = self.company_data_collection.bulk_write(bulk_operations, ordered=False)
                            created_count += result.upserted_count
                            updated_count += result.modified_count
                        except BulkWriteError as bwe:
                            error_count += len(bwe.details['writeErrors'])
                            created_count += bwe.details.get('upserted', 0)
                            updated_count += bwe.details.get('nModified', 0)
                            logger.warning(f"Final bulk write errors in chunk {chunk_number}: {len(bwe.details['writeErrors'])} errors")
                    
                    processed_count += chunk_processed
                    total_processed += len(chunk_df)
                    
                    # Progress logging
                    logger.info(f"Chunk {chunk_number} completed: {chunk_processed} processed, {chunk_errors} errors")
                    if total_rows != "Unknown":
                        progress_pct = (total_processed / total_rows) * 100
                        logger.info(f"Overall progress: {progress_pct:.1f}% ({total_processed}/{total_rows})")
                
                except Exception as chunk_error:
                    logger.error(f"Error processing chunk {chunk_number}: {str(chunk_error)}")
                    # Continue to next chunk instead of failing completely
                    error_count += len(chunk_df) if 'chunk_df' in locals() else CHUNK_SIZE
                    continue
            
            # Final statistics
            success_rate = ((processed_count - error_count) / max(processed_count, 1)) * 100 if processed_count > 0 else 0
            
            result = {
                "success": True,
                "message": f"Processing completed! Processed {processed_count} valid records from {total_processed} total rows",
                "stats": {
                    "total_rows_processed": total_processed,
                    "valid_records_processed": processed_count,
                    "created": created_count,
                    "updated": updated_count,
                    "errors_skipped": error_count,
                    "success_rate_percent": round(success_rate, 2),
                    "chunks_processed": chunk_number
                }
            }
            
            logger.info(f"Excel processing completed: {result}")
            return result

        except Exception as e:
            logger.error(f"Critical error in Excel processing: {str(e)}")
            return {
                "success": False,
                "message": f"Critical error processing Excel file: {str(e)}",
                "stats": {
                    "total_rows_processed": total_processed if 'total_processed' in locals() else 0,
                    "valid_records_processed": processed_count if 'processed_count' in locals() else 0,
                    "created": created_count if 'created_count' in locals() else 0,
                    "updated": updated_count if 'updated_count' in locals() else 0,
                    "errors_skipped": error_count if 'error_count' in locals() else 0
                }
            }

    
    def _normalize_company_name(self, company_name: str) -> str:
        """Normalize company name by removing common suffixes and standardizing format"""
        # Common company suffixes to normalize
        suffixes_to_remove = [
            # Private/Public variations
            'private limited', 'pvt ltd', 'pvt. ltd.', 'pvt.ltd.', 'pvt ltd.', 'pvt. ltd',
            'private ltd', 'private ltd.', 'pvt', 'pvt.', 'private', 'priv. ltd.', 'priv ltd',
            'public limited', 'public ltd', 'pub ltd', 'pub. ltd.', 'plc',
            
            # Limited variations
            'limited', 'ltd', 'ltd.', 'ltda', 'ltda.', 'limitada',
            
            # Corporation variations
            'corporation', 'corp', 'corp.', 'incorporated', 'inc', 'inc.', 'company', 'co', 'co.',
            
            # Other common suffixes
            'llp', 'l.l.p.', 'llc', 'l.l.c.', 'partnership', 'enterprises', 'group',
            'solutions', 'services', 'systems', 'technologies', 'tech', 'infotech',
            'software', 'consultancy', 'consulting', 'consultants'
        ]
        
        # Convert to lowercase and strip
        normalized = company_name.lower().strip()
        
        # Remove common punctuation and extra spaces
        normalized = normalized.replace(',', ' ').replace('.', ' ').replace('-', ' ')
        normalized = ' '.join(normalized.split())  # Remove extra spaces
        
        # Remove suffixes
        for suffix in suffixes_to_remove:
            if normalized.endswith(' ' + suffix):
                normalized = normalized[:-len(suffix)-1].strip()
            elif normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)].strip()
        
        return normalized.strip()

    async def search_similar_companies(self, company_name: str, similarity_threshold: float = 0.8) -> List[dict]:
        """Search for companies with exact same name after removing suffixes"""
        try:
            # Get all companies
            all_companies = await self._async_to_list(self.company_data_collection.find({"is_active": True}))
            
            similar_companies = []
            
            # Normalize the search term
            search_name_normalized = self._normalize_company_name(company_name)
            
            for company in all_companies:
                stored_name = company.get("company_name", "")
                
                # Normalize the stored company name
                stored_name_normalized = self._normalize_company_name(stored_name)
                
                # Only return exact matches on normalized names
                if search_name_normalized == stored_name_normalized:
                    company["_id"] = str(company["_id"])
                    similar_companies.append({
                        "company_name": stored_name,
                        "categories": company.get("categories", []),
                        "bank_names": company.get("bank_names", []),
                        "similarity_percentage": 100.0
                    })
            
            # Sort by company name for consistent ordering
            similar_companies.sort(key=lambda x: x["company_name"])
            
            return similar_companies
            
        except Exception as e:
            print(f"Error in search_similar_companies: {str(e)}")
            return []
    
    async def get_company_data(self, company_id: str) -> Optional[dict]:
        """Get company data by ID"""
        if not ObjectId.is_valid(company_id):
            return None
        company = await self.company_data_collection.find_one({"_id": ObjectId(company_id)})
        if company:
            company["_id"] = str(company["_id"])
        return company
    
    async def get_all_company_data(self, is_active: Optional[bool] = None) -> List[dict]:
        """Get all company data"""
        filter_dict = {}
        if is_active is not None:
            filter_dict["is_active"] = is_active
            
        companies = []
        async for company in self.company_data_collection.find(filter_dict).sort("company_name", 1):
            company["_id"] = str(company["_id"])
            companies.append(company)
        return companies
    
    async def delete_company_data(self, company_id: str) -> bool:
        """Delete company data"""
        if not ObjectId.is_valid(company_id):
            return False
        
        result = await self.company_data_collection.delete_one({"_id": ObjectId(company_id)})
        return result.deleted_count > 0
    
    # ============= Attachment Types =============
    
    async def create_attachment_type(self, attachment_type_data: dict) -> str:
        """Create a new attachment type"""
        attachment_type_data["created_at"] = datetime.now()
        attachment_type_data["updated_at"] = attachment_type_data["created_at"]
        attachment_type_data["is_active"] = attachment_type_data.get("is_active", True)
        
        # Create index for attachment_types collection if not exists
        if "attachment_types" not in await self.db.list_collection_names():
            self.attachment_types_collection = self.db["attachment_types"]
            # self.attachment_types_collection.create_index("name", unique=False)
        else:
            self.attachment_types_collection = self.db["attachment_types"]
        
        # Check if sort_number already exists for this target_type
        if "sort_number" in attachment_type_data and "target_type" in attachment_type_data:
            existing_sort = await self.attachment_types_collection.find_one({
                "target_type": attachment_type_data["target_type"],
                "sort_number": attachment_type_data["sort_number"]
            })
            if existing_sort:
                raise ValueError(f"Sort number {attachment_type_data['sort_number']} already exists for target type '{attachment_type_data['target_type']}'")
        
        result = await self.attachment_types_collection.insert_one(attachment_type_data)
        return str(result.inserted_id)
    
    async def get_attachment_types(self, is_active: Optional[bool] = None, target_type: Optional[str] = None) -> List[dict]:
        """Get all attachment types with optional filtering"""
        if not hasattr(self, 'attachment_types_collection'):
            self.attachment_types_collection = self.db["attachment_types"]
            
        filter_dict = {}
        if is_active is not None:
            filter_dict["is_active"] = is_active
        if target_type is not None:
            filter_dict["target_type"] = target_type
            
        attachment_types = []
        # Sort by sort_number first, then by created_at as fallback
        async for attachment_type in self.attachment_types_collection.find(filter_dict).sort([
            ("sort_number", 1), 
            ("created_at", 1),
            ("name", 1)
        ]):
            attachment_type["_id"] = str(attachment_type["_id"])
            # Handle missing sort_number field for backward compatibility
            if "sort_number" not in attachment_type:
                attachment_type["sort_number"] = None
            attachment_types.append(attachment_type)
        return attachment_types
    
    async def get_attachment_type(self, attachment_type_id: str) -> Optional[dict]:
        """Get an attachment type by ID"""
        if not hasattr(self, 'attachment_types_collection'):
            self.attachment_types_collection = self.db["attachment_types"]
            
        if not ObjectId.is_valid(attachment_type_id):
            return None
        attachment_type = await self.attachment_types_collection.find_one({"_id": ObjectId(attachment_type_id)})
        if attachment_type:
            attachment_type["_id"] = str(attachment_type["_id"])
            # Handle missing sort_number field for backward compatibility
            if "sort_number" not in attachment_type:
                attachment_type["sort_number"] = None
        return attachment_type
    
    async def update_attachment_type(self, attachment_type_id: str, update_data: dict) -> bool:
        """Update an attachment type"""
        if not hasattr(self, 'attachment_types_collection'):
            self.attachment_types_collection = self.db["attachment_types"]
            
        if not ObjectId.is_valid(attachment_type_id):
            return False
        
        # Check if sort_number already exists for this target_type (excluding current record)
        if "sort_number" in update_data and "target_type" in update_data:
            existing_sort = await self.attachment_types_collection.find_one({
                "target_type": update_data["target_type"],
                "sort_number": update_data["sort_number"],
                "_id": {"$ne": ObjectId(attachment_type_id)}
            })
            if existing_sort:
                raise ValueError(f"Sort number {update_data['sort_number']} already exists for target type '{update_data['target_type']}'")
        
        update_data["updated_at"] = datetime.now()
        result = await self.attachment_types_collection.update_one(
            {"_id": ObjectId(attachment_type_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_attachment_type(self, attachment_type_id: str) -> bool:
        """Delete an attachment type"""
        if not hasattr(self, 'attachment_types_collection'):
            self.attachment_types_collection = self.db["attachment_types"]
            
        if not ObjectId.is_valid(attachment_type_id):
            return False
        
        result = await self.attachment_types_collection.delete_one({"_id": ObjectId(attachment_type_id)})
        return result.deleted_count > 0
    
    # ============= Attendance Settings =============
    
    async def _init_default_attendance_settings(self):
        """Initialize default attendance settings if not exists"""
        existing = await self.attendance_settings_collection.find_one({"type": "default"})
        if not existing:
            default_settings = {
                "type": "default",
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
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            await self.attendance_settings_collection.insert_one(default_settings)
    
    async def get_attendance_settings(self) -> dict:
        """Get attendance settings"""
        settings = await self.attendance_settings_collection.find_one({"type": "default"})
        if settings:
            settings["_id"] = str(settings["_id"])
        else:
            # Return default if not found
            await self._init_default_attendance_settings()
            settings = await self.attendance_settings_collection.find_one({"type": "default"})
            if settings:
                settings["_id"] = str(settings["_id"])
        return settings
    
    async def update_attendance_settings(self, settings_data: dict) -> bool:
        """Update attendance settings"""
        settings_data["updated_at"] = datetime.now()
        
        # Remove None values
        settings_data = {k: v for k, v in settings_data.items() if v is not None}
        
        result = await self.attendance_settings_collection.update_one(
            {"type": "default"},
            {"$set": settings_data},
            upsert=True
        )
        return result.modified_count > 0 or result.upserted_id is not None

# Legacy support - settings_db is now initialized in __init__.py
# Use get_database_instances() from app.database to get settings_db instance
settings_db = None  # Will be set by init_database() in __init__.py
