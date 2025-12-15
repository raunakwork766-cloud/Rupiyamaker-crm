from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any, Union, Tuple, Set
from bson import ObjectId
from app.utils.permission_helpers import is_super_admin_permission
from app.utils.timezone import get_ist_now

from datetime import datetime
import os
from pathlib import Path
import shutil
import uuid
import pymongo
import json
import time
import logging

logger = logging.getLogger(__name__)

class LeadsDB:
    def __init__(self, database=None):
        if database is None:
            # Create connection if not provided (for backwards compatibility)
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = database
            
        # Core collections
        self.collection = self.db["leads"]
        self.transfer_history_collection = self.db["lead_transfers"]
        self.activity_collection = self.db["lead_activities"]
        self.notes_collection = self.db["lead_notes"]
        self.documents_collection = self.db["lead_documents"]
        
        # Configuration collections
        self.form_fields_collection = self.db["lead_form_fields"]
        self.statuses_collection = self.db["statuses"]  # Use standard status collection
        self.sub_statuses_collection = self.db["sub_statuses"]  # Use standard sub-status collection
        self.assignment_config_collection = self.db["lead_assignment_config"]
        
        # Helper collections for name resolution
        self.users_collection = self.db["users"]
        self.departments_collection = self.db["departments"]
        
        # Custom Lead ID counter collection
        self.counters_collection = self.db["counters"]
        
        # Note: Async initialization will be done in init_indexes()
        
    async def init_async(self):
        """Initialize async components"""
        await self._initialize_lead_counter()
        await self._create_optimized_indexes()
    
    async def _async_to_list(self, cursor):
        """Convert async cursor to list"""
        return await cursor.to_list(None)
    
    async def _create_optimized_indexes(self):
        """Create optimized indexes for maximum query performance"""
        try:
            # ⚡ CORE PERFORMANCE INDEXES
            await self.collection.create_index([("created_at", -1)], background=True)
            await self.collection.create_index([("assigned_to", 1)], background=True)
            await self.collection.create_index([("assign_report_to", 1)], background=True)
            await self.collection.create_index([("department_id", 1)], background=True)
            await self.collection.create_index([("status", 1)], background=True)
            await self.collection.create_index([("sub_status", 1)], background=True)
            await self.collection.create_index([("priority", 1)], background=True)
            
            # ⚡ COMPOUND INDEXES for common query patterns
            await self.collection.create_index([("status", 1), ("assigned_to", 1)], background=True)
            await self.collection.create_index([("department_id", 1), ("status", 1)], background=True)
            await self.collection.create_index([("assigned_to", 1), ("created_at", -1)], background=True)
            await self.collection.create_index([("loan_type", 1), ("status", 1)], background=True)
            
            # ⚡ TEXT SEARCH INDEXES for fast searching
            await self.collection.create_index([
                ("first_name", "text"),
                ("last_name", "text"),
                ("email", "text"),
                ("phone", "text")
            ], background=True, name="lead_search_index")
            
            # ⚡ SPARSE INDEXES for optional fields
            await self.collection.create_index([("loan_type", 1)], sparse=True, background=True)
            await self.collection.create_index([("loan_type_name", 1)], sparse=True, background=True)
            await self.collection.create_index([("loan_type_id", 1)], sparse=True, background=True)
            
            # ⚡ ACTIVITY AND RELATED DATA INDEXES
            await self.transfer_history_collection.create_index([("lead_id", 1)], background=True)
            await self.activity_collection.create_index([("lead_id", 1), ("created_at", -1)], background=True)
            await self.notes_collection.create_index([("lead_id", 1), ("created_at", -1)], background=True)
            await self.documents_collection.create_index([("lead_id", 1)], background=True)
            
            logger.info("✓ Optimized database indexes created successfully")
            
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")
        
        await self.form_fields_collection.create_index([("department_id", 1)])
        await self.statuses_collection.create_index([("order", 1)])
        await self.sub_statuses_collection.create_index([("parent_status_id", 1)])
        
        # Ensure media directory exists
        self.leads_media_root = Path("media/leads")
        self.leads_media_root.mkdir(parents=True, exist_ok=True)
        
    async def _initialize_lead_counter(self):
        """Initialize the lead counter if it doesn't exist"""
        counter_doc = await self.counters_collection.find_one({"_id": "lead_id"})
        if not counter_doc:
            # Initialize counter starting from 1
            await self.counters_collection.insert_one({
                "_id": "lead_id",
                "sequence_value": 0
            })
            
    async def _get_next_lead_id(self) -> str:
        """Generate the next custom lead ID in format LEAD-001, LEAD-002, etc."""
        try:
            # Use findAndModify to atomically increment the counter
            result = await self.counters_collection.find_one_and_update(
                {"_id": "lead_id"},
                {"$inc": {"sequence_value": 1}},
                return_document=pymongo.ReturnDocument.AFTER,
                upsert=True
            )
            
            # Format the lead ID with zero-padding (e.g., LEAD-001, LEAD-002)
            sequence_number = result["sequence_value"]
            custom_lead_id = f"LEAD-{sequence_number:03d}"
            
            return custom_lead_id
            
        except Exception as e:
            # Fallback to timestamp-based ID if counter fails
            import time
            fallback_id = f"LEAD-{int(time.time())}"
            print(f"Warning: Lead ID counter failed, using fallback: {fallback_id}. Error: {e}")
            return fallback_id
    
    async def _get_user_name(self, user_id: str) -> str:
        """Get user's full name from user ID"""
        if not user_id or not ObjectId.is_valid(user_id):
            return "Unknown User"
        
        try:
            user = await self.users_collection.find_one({"_id": ObjectId(user_id)})
            if user:
                first_name = user.get('first_name', '').strip()
                last_name = user.get('last_name', '').strip()
                if first_name and last_name:
                    return f"{first_name} {last_name}"
                elif first_name:
                    return first_name
                elif last_name:
                    return last_name
                else:
                    return user.get('email', 'Unknown User')
            return "Unknown User"
        except Exception:
            return "Unknown User"
    
    async def _get_department_name(self, department_id: str) -> str:
        """Get department name from department ID"""
        if not department_id or not ObjectId.is_valid(department_id):
            return "Unknown Department"
        
        try:
            department = await self.departments_collection.find_one({"_id": ObjectId(department_id)})
            if department:
                return department.get('name', 'Unknown Department')
            return "Unknown Department"
        except Exception:
            return "Unknown Department"
    
    async def _get_multiple_user_names(self, user_ids: List[str]) -> List[str]:
        """Get multiple user names from list of user IDs"""
        if not user_ids:
            return []
        
        names = []
        for user_id in user_ids:
            name = await self._get_user_name(user_id)
            names.append(name)
        return names
    
    # ========= Lead CRUD Operations =========
        
    async def create_lead(self, lead_data: dict) -> str:
        """Create a new lead with timestamps"""
        # Add timestamps (IST timezone)
        current_time = get_ist_now()
        lead_data["created_at"] = current_time
        lead_data["updated_at"] = current_time
        
        # Generate custom lead ID
        custom_lead_id = await self._get_next_lead_id()
        lead_data["custom_lead_id"] = custom_lead_id
        
        # Initialize tracking fields if not provided
        if "status" not in lead_data:
            # Determine department for default status
            department_name = None
            if "department_id" in lead_data:
                # Map department_id to department name if needed
                department_name = lead_data.get("department_name", "leads")  # Default to leads
            
            default_status = await self.get_default_status(department_name)
            lead_data["status"] = default_status["name"] if default_status else "ACTIVE LEAD"
            
        if "sub_status" not in lead_data:
            default_sub_status = await self.get_default_sub_status(lead_data["status"])
            lead_data["sub_status"] = default_sub_status["name"] if default_sub_status else None
            
        if "priority" not in lead_data:
            lead_data["priority"] = "medium"
            
        # Initialize form sharing control (default to True to allow sharing)
        if "form_share" not in lead_data:
            lead_data["form_share"] = True
            
        # Ensure dynamic_fields is initialized
        if "dynamic_fields" not in lead_data:
            lead_data["dynamic_fields"] = {}
        elif lead_data["dynamic_fields"] is None:
            lead_data["dynamic_fields"] = {}

        # Ensure financial_details exists in dynamic_fields
        if "financial_details" not in lead_data["dynamic_fields"] or not isinstance(lead_data["dynamic_fields"].get("financial_details"), dict):
            lead_data["dynamic_fields"]["financial_details"] = {}

        # If cibil_score is present at root or in dynamic_fields, move it to dynamic_fields.financial_details
        cibil_score = None
        if "cibil_score" in lead_data:
            cibil_score = lead_data["cibil_score"]
            del lead_data["cibil_score"]
        elif "cibil_score" in lead_data["dynamic_fields"]:
            cibil_score = lead_data["dynamic_fields"]["cibil_score"]
            del lead_data["dynamic_fields"]["cibil_score"]
        if cibil_score is not None:
            lead_data["dynamic_fields"]["financial_details"]["cibil_score"] = cibil_score

        # Check for login form fields and ensure they're stored in dynamic_fields
        login_form_fields = [
            "cibil_score", "loan_eligibility", "company_name", 
            "company_category", "salary", "customer_name"
        ]
        
        for field in login_form_fields:
            if field in lead_data:
                lead_data["dynamic_fields"][field] = lead_data[field]
            
        # Initialize assign_report_to if not provided
        if "assign_report_to" not in lead_data:
            lead_data["assign_report_to"] = []
            
        # Insert lead
        result = await self.collection.insert_one(lead_data)
        lead_id = str(result.inserted_id)
        
        # Record initial assignment as a transfer
        if "assigned_to" in lead_data and lead_data["assigned_to"]:
            transfer_data = {
                "lead_id": lead_id,
                "from_user_id": lead_data["created_by"],
                "to_user_id": lead_data["assigned_to"],
                "from_department_id": lead_data.get("department_id"),
                "to_department_id": lead_data.get("department_id"),
                "transferred_by": lead_data["created_by"],
                "transferred_at": current_time,
                "notes": "Initial assignment",
                "reporting_users": lead_data.get("assign_report_to", [])
            }
            await self.transfer_history_collection.insert_one(transfer_data)
            
        # Record creation activity with names instead of IDs
        try:
            created_by_name = await self._get_user_name(lead_data["created_by"])
            assigned_to_name = await self._get_user_name(lead_data.get("assigned_to")) if lead_data.get("assigned_to") else None
            department_name = await self._get_department_name(lead_data.get("department_id")) if lead_data.get("department_id") else None
            reporting_user_names = await self._get_multiple_user_names(lead_data.get("assign_report_to", []))
            
            activity_data = {
                "lead_id": lead_id,
                "user_id": lead_data["created_by"],
                "user_name": created_by_name or "Unknown User",
                "activity_type": "create",
                "description": "Lead created",
                "details": {
                    "department_id": lead_data.get("department_id"),
                    "department_name": department_name,
                    "assigned_to": lead_data.get("assigned_to"),
                    "assigned_to_name": assigned_to_name,
                    "reporting_users": lead_data.get("assign_report_to", []),
                    "reporting_user_names": reporting_user_names
                },
                "created_at": current_time
            }
            await self.activity_collection.insert_one(activity_data)
        except Exception as e:
            # Log the error but don't fail lead creation
            print(f"⚠️ Warning: Failed to create activity for lead {lead_id}: {str(e)}")
            # Still try to insert a basic activity without name lookups
            try:
                basic_activity = {
                    "lead_id": lead_id,
                    "user_id": lead_data["created_by"],
                    "user_name": "System",
                    "activity_type": "create",
                    "description": "Lead created",
                    "details": {},
                    "created_at": current_time
                }
                await self.activity_collection.insert_one(basic_activity)
            except Exception as inner_e:
                print(f"❌ Error: Could not create basic activity for lead {lead_id}: {str(inner_e)}")
        
        return lead_id
        
    async def get_lead(self, lead_id: str) -> Optional[dict]:
        """Get a lead by ID"""
        if not ObjectId.is_valid(lead_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(lead_id)})
    
    async def list_leads(self, 
                  filter_dict: dict = None, 
                  skip: int = 0, 
                  limit: int = 50, 
                  sort_by: str = "created_at",
                  sort_order: int = -1,
                  projection: dict = None) -> List[dict]:
        """
        ⚡ OPTIMIZED: List leads with pagination, filtering, and field projection
        
        Args:
            filter_dict: MongoDB filter conditions
            skip: Number of documents to skip (for pagination)
            limit: Maximum number of documents to return (0 = no limit)
            sort_by: Field to sort by
            sort_order: Sort order (1 = ascending, -1 = descending)
            projection: Fields to include/exclude (improves performance by reducing data transfer)
        
        Returns:
            List of lead documents
        """
        filter_dict = filter_dict or {}
        
        # ⚡ OPTIMIZATION: Use projection to fetch only necessary fields
        # This significantly reduces data transfer and parsing time
        if projection is None:
            # ⚡ ULTRA-AGGRESSIVE PROJECTION for list view
            # Only fetch fields that are ABSOLUTELY REQUIRED for the table display
            # MongoDB requires consistent projection (only inclusions or only exclusions, not mixed)
            # Using INCLUSION projection (field: 1) to minimize data transfer by 70-80%
            projection = {
                # Essential identity fields
                "_id": 1,
                "custom_lead_id": 1,
                "first_name": 1,
                "last_name": 1,
                "phone": 1,
                "email": 1,
                "alternative_phone": 1,
                
                # Core business fields
                "status": 1,
                "sub_status": 1,
                "priority": 1,
                "loan_type": 1,
                "loan_type_id": 1,
                "loan_type_name": 1,
                "loan_amount": 1,
                "campaign_name": 1,  # ⚡ ADDED: Campaign name for lead tracking
                "data_code": 1,      # ⚡ ADDED: Data code for lead source tracking
                "xyz": 1,            # ⚡ ADDED: XYZ field
                "pincode_city": 1,   # ⚡ ADDED: Pincode & City field (combined)
                "importantquestion": 1,  # ⚡ ADDED: Important questions responses
                "question_responses": 1,  # ⚡ ADDED: Important questions responses (new format)
                "important_questions_validated": 1,  # ⚡ ADDED: Validation status
                
                # Assignment and tracking
                "assigned_to": 1,
                "assign_report_to": 1,
                "created_by": 1,
                "created_by_name": 1,
                "created_by_role": 1,
                "department_id": 1,
                "department_name": 1,
                
                # Timestamps
                "created_at": 1,
                "updated_at": 1,
                "login_department_sent_date": 1,
                "file_sent_to_login": 1,  # ⚡ ADDED: For login status badge display
                
                # Login form specific fields (commonly displayed)
                "company_name": 1,
                "company_category": 1,
                "salary": 1,
                "loan_eligibility": 1,
                "customer_name": 1,
                
                # Source
                "source": 1,
                
                # Additional important fields for display
                "reference": 1,
                "whatsapp_number": 1,
                
                # ⚡ CRITICAL: Include dynamic_fields for table columns
                # These fields are displayed in TOTAL INCOME, FOIR, CIBIL SCORE, etc. columns
                "dynamic_fields.eligibility_details": 1,
                "dynamic_fields.financial_details": 1,
                "dynamic_fields.obligation_data": 1,
                "dynamic_fields.process": 1,  # ⚡ ADDED: Include process data for "How to Process" section
                
                # Also include root-level fields (legacy support + direct access)
                "process": 1,  # ⚡ ADDED: Include root-level process field
                "eligibility_details": 1,
                "financial_details": 1,
                "obligation_data": 1,
                "eligibility": 1,
                "totalIncome": 1,
                "monthly_income": 1,
                
                # Note: All other fields including attachments, activities, notes, 
                # transfer_history are automatically excluded
            }
        
        # Get leads with projection
        cursor = self.collection.find(filter_dict, projection)
        
        # Apply sorting - MongoDB will automatically use the best index
        cursor = cursor.sort(sort_by, sort_order)
        
        # ⚡ OPTIMIZATION: Allow disk use for large result sets
        cursor = cursor.allow_disk_use(True)
        
        # Apply pagination
        if limit > 0:
            cursor = cursor.skip(skip).limit(limit)
        elif skip > 0:
            cursor = cursor.skip(skip)
        
        # ⚡ ULTRA-OPTIMIZATION: Use 1000 batch size for maximum performance
        # Larger batch size = fewer round trips to database = dramatically faster
        # 1000 is optimal for 150-200 lead queries (reduces round trips by 80%)
        cursor = cursor.batch_size(1000)
        
        return await cursor.to_list(None)
    
    async def count_leads(self, filter_dict: dict = None) -> int:
        """Count leads matching the filter"""
        filter_dict = filter_dict or {}
        return await self.collection.count_documents(filter_dict)
        
    async def update_lead(self, lead_id: str, update_data: dict, user_id: str) -> bool:
        """Update a lead with tracking"""
        import copy
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔵 ========== DATABASE update_lead START ==========")
        logger.info(f"🔵 Lead ID: {lead_id}")
        logger.info(f"🔵 User ID: {user_id}")
        logger.info(f"📥 Update data keys: {list(update_data.keys())}")
        
        if not ObjectId.is_valid(lead_id):
            logger.error(f"❌ Invalid ObjectId: {lead_id}")
            return False
            
        # Get current lead state for activity tracking
        current_lead = await self.get_lead(lead_id)
        if not current_lead:
            logger.error(f"❌ Lead not found in database: {lead_id}")
            return False
            
        logger.info(f"✅ Current lead found: {current_lead.get('first_name', '')} {current_lead.get('last_name', '')}")
        
        # Log current dynamic_fields state
        if current_lead.get("dynamic_fields"):
            logger.info(f"📋 CURRENT dynamic_fields in DB: {list(current_lead['dynamic_fields'].keys())}")
            if "obligation_data" in current_lead["dynamic_fields"]:
                logger.info(f"✅ obligation_data EXISTS in current lead ({len(current_lead['dynamic_fields']['obligation_data'])} fields)")
        
        # Add updated timestamp
        update_data["updated_at"] = get_ist_now()
        
        # CRITICAL FIX: Handle dynamic_fields with deep copy to preserve nested structures
        if "dynamic_fields" not in update_data:
            # No dynamic_fields in update - preserve entire current dynamic_fields with DEEP COPY
            if current_lead.get("dynamic_fields"):
                update_data["dynamic_fields"] = copy.deepcopy(current_lead["dynamic_fields"])
                logger.info("✅ Preserved entire dynamic_fields from current lead (not in update) with DEEP COPY")
            else:
                update_data["dynamic_fields"] = {}
        elif update_data["dynamic_fields"] is None:
            # dynamic_fields explicitly set to None - use current or empty with DEEP COPY
            if current_lead.get("dynamic_fields"):
                update_data["dynamic_fields"] = copy.deepcopy(current_lead["dynamic_fields"])
                logger.info("✅ Replaced null dynamic_fields with current lead data using DEEP COPY")
            else:
                update_data["dynamic_fields"] = {}
        else:
            # dynamic_fields IS present in update - it should already be merged from routes layer
            logger.info("📥 dynamic_fields present in update from routes layer")
            logger.info(f"📥 Keys in update dynamic_fields: {list(update_data['dynamic_fields'].keys())}")
            
            # Ensure it's a dict
            if not isinstance(update_data["dynamic_fields"], dict):
                update_data["dynamic_fields"] = {}
            
            # CRITICAL: Verify obligation_data is preserved
            if "obligation_data" in update_data["dynamic_fields"]:
                logger.info(f"✅ obligation_data IS in update ({len(update_data['dynamic_fields']['obligation_data'])} fields)")
            elif "obligation_data" in current_lead.get("dynamic_fields", {}):
                # Routes layer should have merged this, but double-check as safety net
                logger.warning(f"⚠️ obligation_data NOT in update but EXISTS in DB - RESTORING with DEEP COPY")
                update_data["dynamic_fields"]["obligation_data"] = copy.deepcopy(current_lead["dynamic_fields"]["obligation_data"])
            
            # EXTRA SAFETY NET: Preserve ALL important nested fields with DEEP COPY
            important_fields = ["obligation_data", "eligibility_details", "identity_details", "financial_details", "process"]
            for field in important_fields:
                current_value = current_lead.get("dynamic_fields", {}).get(field)
                if current_value is not None and field not in update_data["dynamic_fields"]:
                    # Field exists in DB but NOT in update - preserve with DEEP COPY
                    update_data["dynamic_fields"][field] = copy.deepcopy(current_value)
                    logger.info(f"🔒 RESTORED {field} from DB using DEEP COPY (missing from update)")
        
        logger.info(f"✅ FINAL dynamic_fields keys going to DB: {list(update_data['dynamic_fields'].keys())}")
        if "obligation_data" in update_data["dynamic_fields"]:
            logger.info(f"✅✅ obligation_data CONFIRMED in final update ({len(update_data['dynamic_fields']['obligation_data'])} fields)")
        
        # Special handling for login form fields
        login_form_fields = [
            "cibil_score", "loan_eligibility", "company_name", 
            "company_category", "salary", "customer_name",
            "data_code", "first_name", "last_name", "phone", "alternative_phone",
            "loan_type", "loan_type_name"
        ]
        
        field_updates_needed = any(field in update_data for field in login_form_fields)
        
        if field_updates_needed:
            # Ensure financial_details exists in dynamic_fields for CIBIL score
            # But preserve existing data if already present
            if "financial_details" not in update_data["dynamic_fields"]:
                update_data["dynamic_fields"]["financial_details"] = {}
                if current_lead.get("dynamic_fields", {}).get("financial_details"):
                    update_data["dynamic_fields"]["financial_details"] = current_lead["dynamic_fields"]["financial_details"]
            else:
                # Financial details already present - merge with current instead of replace
                current_financial = current_lead.get("dynamic_fields", {}).get("financial_details", {})
                if current_financial:
                    # Merge: keep new data, add missing fields from current
                    merged_financial = {**current_financial, **update_data["dynamic_fields"]["financial_details"]}
                    update_data["dynamic_fields"]["financial_details"] = merged_financial
            
            # Check if login_form is present in dynamic_fields
            login_form = update_data["dynamic_fields"].get("login_form", {})
            if login_form:
                # If CIBIL score is in login_form, also store in financial_details
                cibil_score = login_form.get("cibil_score")
                if cibil_score:
                    update_data["dynamic_fields"]["financial_details"]["cibil_score"] = cibil_score
                    # Also store at root level for backward compatibility
                    update_data["dynamic_fields"]["cibil_score"] = cibil_score
                
                # Handle other important fields for backward compatibility
                for field in ["pan_number", "aadhar_number"]:
                    if field in login_form:
                        if "identity_details" not in update_data["dynamic_fields"]:
                            update_data["dynamic_fields"]["identity_details"] = {}
                            if current_lead.get("dynamic_fields", {}).get("identity_details"):
                                update_data["dynamic_fields"]["identity_details"].update(
                                    current_lead["dynamic_fields"]["identity_details"])
                        update_data["dynamic_fields"]["identity_details"][field] = login_form[field]
            
            # Add all login form fields to dynamic_fields (for backward compatibility)
            for field in login_form_fields:
                if field in update_data:
                    # Store field in the standard location
                    update_data["dynamic_fields"][field] = update_data[field]
                    print(f"📋 Copied {field} to dynamic_fields: {update_data[field]}")
                    
                    # For CIBIL score, also store in financial_details
                    if field == "cibil_score":
                        update_data["dynamic_fields"]["financial_details"]["cibil_score"] = update_data[field]
        
        # Update the lead
        print(f"=== EXECUTING MONGODB UPDATE ===")
        print(f"Collection: {self.collection.name}")
        print(f"Filter: {{'_id': ObjectId('{lead_id}')}}")
        print(f"Update operation: $set with {len(update_data)} fields")
        print(f"📋 TOP-LEVEL FIELDS in update_data:")
        for key in ['phone', 'email', 'first_name', 'last_name']:
            if key in update_data:
                print(f"   - {key}: {update_data[key]}")
        
        print(f"📋 DYNAMIC_FIELDS keys in update_data:")
        if 'dynamic_fields' in update_data:
            print(f"   {list(update_data['dynamic_fields'].keys())}")
        
        # Handle process_data separately (outside dynamic_fields)
        if 'process_data' in update_data:
            logger.info(f"🟢 process_data field detected - storing OUTSIDE dynamic_fields")
            logger.info(f"🟢 This prevents conflicts with obligation_data in dynamic_fields")
        
        # CRITICAL FIX: Use MongoDB dot notation for dynamic_fields to avoid replacing entire object
        # This preserves all nested fields like obligation_data when updating only process
        mongodb_update = {}
        
        for key, value in update_data.items():
            if key == "dynamic_fields" and isinstance(value, dict):
                # Use dot notation for each nested field in dynamic_fields
                for nested_key, nested_value in value.items():
                    mongodb_update[f"dynamic_fields.{nested_key}"] = nested_value
                    logger.info(f"🔧 MongoDB dot notation: dynamic_fields.{nested_key}")
            elif key == "process_data" and isinstance(value, dict):
                # CRITICAL FIX: Use dot notation for process_data fields too!
                # This preserves other process fields when updating only one field
                logger.info(f"🔍 PROCESS_DATA UPDATE RECEIVED:")
                logger.info(f"   Incoming process_data: {value}")
                logger.info(f"   Current lead process_data: {current_lead.get('process_data', {})}")
                
                for process_field, process_value in value.items():
                    mongodb_update[f"process_data.{process_field}"] = process_value
                    logger.info(f"🔧 MongoDB dot notation: process_data.{process_field} = {process_value}")
                    print(f"🔧 Setting process_data.{process_field} = {process_value}")
            else:
                # Regular top-level fields
                mongodb_update[key] = value
        
        logger.info(f"✅ MongoDB update using dot notation - {len(mongodb_update)} fields")
        logger.info(f"✅ This will preserve all other fields not being updated")
        
        result = await self.collection.update_one(
            {"_id": ObjectId(lead_id)},
            {"$set": mongodb_update}
        )
        
        print(f"MongoDB result - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.modified_count == 0:
            print(f"❌ No documents were modified")
            if result.matched_count == 0:
                print(f"❌ No documents matched the filter")
            else:
                print(f"⚠️ Document matched but no changes were made (data might be identical)")
            return False
        
        print(f"✅ MongoDB update successful")
        
        # Track all changes for activity log
        changes = {}
        
        # First, track ALL field changes (general tracking)
        for field, new_value in update_data.items():
            # Skip metadata fields, fields we handle specially
            if field in ["updated_at", "activity", "dynamic_fields"]:
                continue
                
            old_value = current_lead.get(field)
            if old_value != new_value:
                changes[field] = {
                    "from": old_value,
                    "to": new_value
                }
        
        # Track status change
        if "status" in update_data and update_data["status"] != current_lead.get("status"):
            old_status = await self.get_status_by_id(current_lead.get("status")) or {"name": current_lead.get("status")}
            new_status = await self.get_status_by_id(update_data["status"]) or {"name": update_data["status"]}
            
            changes["status"] = {
                "from": old_status.get("name"),
                "to": new_status.get("name")
            }
            
            # Record status change activity with user name
            status_changed_by_name = await self._get_user_name(user_id)
            
            activity_data = {
                "lead_id": lead_id,
                "user_id": user_id,
                "user_name": status_changed_by_name,
                "activity_type": "status_change",
                "description": f"Status changed from '{old_status.get('name')}' to '{new_status.get('name')}'",
                "details": {
                    "from_status": current_lead.get("status"),
                    "from_status_name": old_status.get("name"),
                    "to_status": update_data["status"],
                    "to_status_name": new_status.get("name")
                },
                "created_at": update_data["updated_at"]
            }
            await self.activity_collection.insert_one(activity_data)
            
        # Track sub-status change
        if "sub_status" in update_data and update_data["sub_status"] != current_lead.get("sub_status"):
            old_substatus = await self.get_sub_status_by_id(current_lead.get("sub_status")) or {"name": current_lead.get("sub_status")}
            new_substatus = await self.get_sub_status_by_id(update_data["sub_status"]) or {"name": update_data["sub_status"]}
            
            changes["sub_status"] = {
                "from": old_substatus.get("name"),
                "to": new_substatus.get("name")
            }
            
            # Record sub-status change activity
            activity_data = {
                "lead_id": lead_id,
                "user_id": user_id,
                "activity_type": "sub_status_change",
                "description": f"Sub-status changed from '{old_substatus.get('name')}' to '{new_substatus.get('name')}'",
                "details": {
                    "from_sub_status": current_lead.get("sub_status"),
                    "to_sub_status": update_data["sub_status"]
                },
                "created_at": update_data["updated_at"]
            }
            await self.activity_collection.insert_one(activity_data)
            
        # Track assignment change - with support for assigned_to as array or string
        if "assigned_to" in update_data and update_data["assigned_to"] != current_lead.get("assigned_to"):
            current_assigned = current_lead.get("assigned_to", [])
            new_assigned = update_data["assigned_to"]
            
            # Check if we're transferring between departments and need to preserve assignments
            is_dept_transfer = "department_id" in update_data and update_data["department_id"] != current_lead.get("department_id")
            
            # Convert to lists for consistent handling
            if isinstance(current_assigned, str):
                current_assigned = [current_assigned]
            if isinstance(new_assigned, str):
                new_assigned = [new_assigned]
                
            # If transferring departments, append old assignments to new ones (if not already present)
            if is_dept_transfer and current_assigned:
                # Create/store previous_assigned_to array that tracks all past assignments
                previous_assigned = current_lead.get("previous_assigned_to", [])
                if isinstance(previous_assigned, str):
                    previous_assigned = [previous_assigned]
                
                # Add current assignments to previous
                previous_assigned.extend(current_assigned)
                
                # Remove duplicates
                update_data["previous_assigned_to"] = list(set(previous_assigned))
            
            changes["assigned_to"] = {
                "from": current_assigned,
                "to": new_assigned
            }
            
            # Record transfer - handle both string and array assignments
            transfer_data = {
                "lead_id": lead_id,
                "from_user_id": current_assigned,
                "to_user_id": new_assigned,
                "from_department_id": current_lead.get("department_id"),
                "to_department_id": update_data.get("department_id", current_lead.get("department_id")),
                "transferred_by": user_id,
                "transferred_at": update_data["updated_at"],
                "notes": update_data.get("transfer_notes", "Lead reassigned"),
                "reporting_users": update_data.get("assign_report_to", current_lead.get("assign_report_to", []))
            }
            await self.transfer_history_collection.insert_one(transfer_data)
            
            # Record assignment activity with names
            assigned_by_name = await self._get_user_name(user_id)
            from_user_name = await self._get_user_name(current_lead.get("assigned_to")) if current_lead.get("assigned_to") else "Unassigned"
            to_user_name = await self._get_user_name(update_data["assigned_to"]) if update_data["assigned_to"] else "Unassigned"
            
            activity_data = {
                "lead_id": lead_id,
                "user_id": user_id,
                "user_name": assigned_by_name,
                "activity_type": "assignment",
                "description": f"Lead assigned from {from_user_name} to {to_user_name}",
                "details": {
                    "from_user_id": current_lead.get("assigned_to"),
                    "from_user_name": from_user_name,
                    "to_user_id": update_data["assigned_to"],
                    "to_user_name": to_user_name
                },
                "created_at": update_data["updated_at"]
            }
            await self.activity_collection.insert_one(activity_data)
            
        # Track department change
        if "department_id" in update_data and update_data["department_id"] != current_lead.get("department_id"):
            changes["department_id"] = {
                "from": current_lead.get("department_id"),
                "to": update_data["department_id"]
            }
            
            # Record department change activity with names
            transferred_by_name = await self._get_user_name(user_id)
            from_department_name = await self._get_department_name(current_lead.get("department_id")) if current_lead.get("department_id") else "No Department"
            to_department_name = await self._get_department_name(update_data["department_id"]) if update_data["department_id"] else "No Department"
            
            activity_data = {
                "lead_id": lead_id,
                "user_id": user_id,
                "user_name": transferred_by_name,
                "activity_type": "department_transfer",
                "description": f"Lead transferred from {from_department_name} to {to_department_name}",
                "details": {
                    "from_department_id": current_lead.get("department_id"),
                    "from_department_name": from_department_name,
                    "to_department_id": update_data["department_id"],
                    "to_department_name": to_department_name
                },
                "created_at": update_data["updated_at"]
            }
            await self.activity_collection.insert_one(activity_data)
            
        # Track reporting assignment changes
        if "assign_report_to" in update_data:
            current_reporters = set(current_lead.get("assign_report_to", []))
            new_reporters = set(update_data["assign_report_to"])
            
            added_reporters = new_reporters - current_reporters
            removed_reporters = current_reporters - new_reporters
            
            if added_reporters or removed_reporters:
                changes["assign_report_to"] = {
                    "added": list(added_reporters),
                    "removed": list(removed_reporters)
                }
                
                # Record reporting change activity with names
                updated_by_name = await self._get_user_name(user_id)
                added_reporter_names = await self._get_multiple_user_names(list(added_reporters))
                removed_reporter_names = await self._get_multiple_user_names(list(removed_reporters))
                
                activity_data = {
                    "lead_id": lead_id,
                    "user_id": user_id,
                    "user_name": updated_by_name,
                    "activity_type": "reporting_change",
                    "description": "Lead reporting assignments updated",
                    "details": {
                        "added_reporters": list(added_reporters),
                        "added_reporter_names": added_reporter_names,
                        "removed_reporters": list(removed_reporters),
                        "removed_reporter_names": removed_reporter_names
                    },
                    "created_at": update_data["updated_at"]
                }
                await self.activity_collection.insert_one(activity_data)
            
        # Track dynamic fields changes
        # IMPORTANT: Check both direct dynamic_fields updates AND dot notation updates
        dynamic_fields_to_check = {}
        
        # Case 1: Direct dynamic_fields update (rare, but possible)
        if "dynamic_fields" in update_data:
            dynamic_fields_to_check = update_data["dynamic_fields"]
            logger.info(f"📊 Case 1: Direct dynamic_fields update detected")
        
        # Case 2: Dot notation updates (common, e.g., dynamic_fields.personal_details)
        # Reconstruct the nested structure from dot notation for change tracking
        for key in mongodb_update.keys():
            if key.startswith("dynamic_fields."):
                # Extract the nested field name (e.g., "personal_details" from "dynamic_fields.personal_details")
                nested_field = key.replace("dynamic_fields.", "")
                dynamic_fields_to_check[nested_field] = mongodb_update[key]
                logger.info(f"📊 Case 2: Dot notation update detected: {nested_field}")
        
        if dynamic_fields_to_check:
            old_fields = current_lead.get("dynamic_fields", {})
            
            # Find changed fields with DEEP comparison for complex objects
            changed_fields = {}
            for key, value in dynamic_fields_to_check.items():
                old_value = old_fields.get(key)
                
                # Deep comparison for complex structures
                if isinstance(value, (dict, list)) and isinstance(old_value, (dict, list)):
                    # Use JSON serialization for deep comparison
                    import json
                    if json.dumps(value, sort_keys=True, default=str) != json.dumps(old_value, sort_keys=True, default=str):
                        changed_fields[key] = {
                            "from": old_value,
                            "to": value
                        }
                        logger.info(f"✅ Dynamic field changed (deep): {key}")
                elif old_value != value:
                    # Simple value comparison
                    changed_fields[key] = {
                        "from": old_value,
                        "to": value
                    }
                    logger.info(f"✅ Dynamic field changed (simple): {key}")
                    
            if changed_fields:
                changes["dynamic_fields"] = changed_fields
                logger.info(f"✅ Total dynamic_fields changes: {len(changed_fields)} fields")
        
        # Track process_data changes (NEW - for "How to Process" section)
        # IMPORTANT: Check both direct process_data updates AND dot notation updates
        process_data_to_check = {}
        
        # Case 1: Direct process_data update
        if "process_data" in update_data:
            process_data_to_check = update_data["process_data"]
            logger.info(f"📊 Case 1: Direct process_data update detected")
        
        # Case 2: Dot notation updates (common, e.g., process_data.processing_bank)
        # Reconstruct the nested structure from dot notation for change tracking
        for key in mongodb_update.keys():
            if key.startswith("process_data."):
                # Extract the nested field name
                nested_field = key.replace("process_data.", "")
                process_data_to_check[nested_field] = mongodb_update[key]
                logger.info(f"📊 Case 2: Dot notation update detected: {nested_field}")
        
        if process_data_to_check:
            old_process = current_lead.get("process_data", {})
            
            # Find changed fields with DEEP comparison for complex objects
            changed_process_fields = {}
            for key, value in process_data_to_check.items():
                old_value = old_process.get(key)
                
                # Deep comparison for complex structures
                if isinstance(value, (dict, list)) and isinstance(old_value, (dict, list)):
                    # Use JSON serialization for deep comparison
                    import json
                    if json.dumps(value, sort_keys=True, default=str) != json.dumps(old_value, sort_keys=True, default=str):
                        changed_process_fields[key] = {
                            "from": old_value,
                            "to": value
                        }
                        logger.info(f"✅ Process field changed (deep): {key}")
                elif old_value != value:
                    # Simple value comparison
                    changed_process_fields[key] = {
                        "from": old_value,
                        "to": value
                    }
                    logger.info(f"✅ Process field changed (simple): {key}")
                    
            if changed_process_fields:
                changes["process_data"] = changed_process_fields
                logger.info(f"🟢 process_data changes detected: {list(changed_process_fields.keys())}")
        
        # Check for custom activity data passed from the frontend
        if "activity" in update_data:
            custom_activity = update_data.pop("activity")  # Remove from update data
            
            # Ensure required fields are present
            if isinstance(custom_activity, dict):
                activity_entry = {
                    "lead_id": lead_id,
                    "user_id": user_id,
                    "activity_type": custom_activity.get("activity_type", "custom"),
                    "description": custom_activity.get("description", "Custom activity"),
                    "details": custom_activity.get("details", {}),
                    "created_at": update_data["updated_at"]
                }
                await self.activity_collection.insert_one(activity_entry)
                print(f"✅ Recorded custom activity: {activity_entry['description']}")
        
        # Record general update activity if any fields changed (excluding already handled special cases)
        if changes:
            # Check if we have changes other than the specifically handled ones
            special_fields = {"status", "sub_status", "assigned_to", "department_id", "assign_report_to"}
            
            # Get user name once for all activities
            updated_by_name = await self._get_user_name(user_id)
            
            # 🎯 NEW: Create INDIVIDUAL activity for EACH field change (better visibility)
            for field_name, change_data in changes.items():
                # Skip already handled special fields
                if field_name in special_fields:
                    continue
                
                # Format field name for better readability
                field_display_name = field_name.replace('_', ' ').title()
                
                # Handle nested dynamic_fields changes
                if field_name == "dynamic_fields" and isinstance(change_data, dict):
                    # Track which fields we've already created activities for to avoid duplicates
                    processed_obligation_fields = set()
                    
                    # Fields to skip - these are internal/redundant or tracked elsewhere
                    skip_fields = {"financial_details", "eligibility_details", "identity_details"}
                    
                    # Create separate activity for each nested field in dynamic_fields
                    for nested_field, nested_change in change_data.items():
                        # Skip if this is an obligation-related field that we've already processed
                        if nested_field in processed_obligation_fields:
                            continue
                        
                        # Skip internal/redundant fields
                        if nested_field in skip_fields:
                            continue
                        
                        nested_display_name = nested_field.replace('_', ' ').title()
                        
                        # Format old and new values
                        old_val = nested_change.get("from", "Not Set")
                        new_val = nested_change.get("to", "")
                        
                        # Truncate long values for readability
                        if isinstance(old_val, str) and len(old_val) > 100:
                            old_val = old_val[:100] + "..."
                        if isinstance(new_val, str) and len(new_val) > 100:
                            new_val = new_val[:100] + "..."
                        
                        # Handle dict/object values - IMPROVED for better readability
                        # Special handling for obligations (array of objects)
                        if nested_field == "obligations" and isinstance(new_val, list):
                            # ENHANCED: Create ONE activity per ROW showing all changes in that row
                            # This shows "Row 2: EMI: ₹5,000 → ₹6,000, Tenure: 24 months → 36 months"
                            
                            old_obligations = old_val if isinstance(old_val, list) else []
                            new_obligations = new_val
                            
                            # Compare each row
                            max_rows = max(len(old_obligations), len(new_obligations))
                            
                            for row_idx in range(max_rows):
                                old_row = old_obligations[row_idx] if row_idx < len(old_obligations) else {}
                                new_row = new_obligations[row_idx] if row_idx < len(new_obligations) else {}
                                
                                # Field mapping for better readability
                                field_labels = {
                                    'bankName': 'Bank Name',
                                    'product': 'Product',
                                    'emi': 'EMI',
                                    'outstanding': 'Outstanding',
                                    'totalLoan': 'Total Loan',
                                    'tenure': 'Tenure',
                                    'roi': 'ROI',
                                    'action': 'Action'
                                }
                                
                                # Collect all changes in this row
                                row_changes = []
                                
                                # Check each field in this row
                                for field_key, field_label in field_labels.items():
                                    old_field_val = old_row.get(field_key) if isinstance(old_row, dict) else None
                                    new_field_val = new_row.get(field_key) if isinstance(new_row, dict) else None
                                    
                                    # Normalize values for comparison (handle empty strings, zeros, None)
                                    old_normalized = str(old_field_val).strip() if old_field_val not in [None, '', 0, '0', 'N/A'] else None
                                    new_normalized = str(new_field_val).strip() if new_field_val not in [None, '', 0, '0', 'N/A'] else None
                                    
                                    # If the field changed, add to row changes
                                    if old_normalized != new_normalized:
                                        # Format display values
                                        old_display = old_field_val if old_normalized else "Not Set"
                                        new_display = new_field_val if new_normalized else "Removed"
                                        
                                        # Add currency/percentage formatting
                                        if field_key in ['emi', 'outstanding', 'totalLoan'] and new_normalized:
                                            new_display = f"₹{new_field_val}"
                                        if field_key in ['emi', 'outstanding', 'totalLoan'] and old_normalized:
                                            old_display = f"₹{old_field_val}"
                                        if field_key == 'tenure' and new_normalized:
                                            new_display = f"{new_field_val} months"
                                        if field_key == 'tenure' and old_normalized:
                                            old_display = f"{old_field_val} months"
                                        if field_key == 'roi' and new_normalized:
                                            new_display = f"{new_field_val}%"
                                        if field_key == 'roi' and old_normalized:
                                            old_display = f"{old_field_val}%"
                                        
                                        # Add this field change to the row changes list
                                        row_changes.append(f"{field_label}: {old_display} → {new_display}")
                                
                                # If there are changes in this row, create ONE activity for the entire row
                                if row_changes:
                                    # Join all changes with line breaks for readability
                                    changes_text = "\n".join(row_changes)
                                    
                                    activity_data = {
                                        "lead_id": lead_id,
                                        "user_id": user_id,
                                        "user_name": updated_by_name,
                                        "activity_type": "field_update",
                                        "description": f"Obligation Row {row_idx + 1}",
                                        "details": {
                                            "field_display_name": f"Obligation Row {row_idx + 1}",
                                            "old_value": "Updated",
                                            "new_value": changes_text
                                        },
                                        "created_at": update_data["updated_at"]
                                    }
                                    await self.activity_collection.insert_one(activity_data)
                                    print(f"✅ Recorded obligation row update: Row {row_idx + 1} - {len(row_changes)} field(s) changed")
                            
                            # Skip the default activity creation since we created row-based activities
                            processed_obligation_fields.add("obligations")
                            continue
                        
                        # Special handling for check_eligibility (object with eligibility data)
                        elif nested_field == "check_eligibility" and isinstance(new_val, dict):
                            # Format check_eligibility nicely with FRONTEND labels
                            # Show ONLY fields that have values
                            check_fields = []
                            if new_val.get('company_category'):
                                cat = new_val['company_category']
                                cat_name = cat.get('name') if isinstance(cat, dict) else cat
                                if cat_name:
                                    check_fields.append(f"Company Category: {cat_name}")
                            if new_val.get('foir_percent') and new_val.get('foir_percent') not in [0, '', None]:
                                check_fields.append(f"FOIR %: {new_val['foir_percent']}%")
                            if new_val.get('custom_foir_percent') and new_val.get('custom_foir_percent') not in [0, '', None]:
                                check_fields.append(f"Custom FOIR %: {new_val['custom_foir_percent']}%")
                            if new_val.get('monthly_emi_can_pay') and new_val.get('monthly_emi_can_pay') not in [0, '', None]:
                                check_fields.append(f"Monthly EMI Can Pay: ₹{new_val['monthly_emi_can_pay']}")
                            if new_val.get('tenure_months') and new_val.get('tenure_months') not in [0, '', None]:
                                check_fields.append(f"Tenure (Months): {new_val['tenure_months']}")
                            if new_val.get('tenure_years') and new_val.get('tenure_years') not in [0, '', None]:
                                check_fields.append(f"Tenure (Years): {new_val['tenure_years']}")
                            if new_val.get('roi') and new_val.get('roi') not in [0, '', None]:
                                check_fields.append(f"Rate of Interest (ROI): {new_val['roi']}%")
                            if new_val.get('foir_eligibility') and new_val.get('foir_eligibility') not in [0, '', None]:
                                check_fields.append(f"FOIR Eligibility: ₹{new_val['foir_eligibility']}")
                            if new_val.get('multiplier') and new_val.get('multiplier') not in [0, '', None, '0']:
                                check_fields.append(f"Multiplier: {new_val['multiplier']}")
                            
                            new_val = "\n".join(check_fields) if check_fields else "No eligibility data"
                            
                            # Format old check_eligibility if exists - also show only filled fields
                            if isinstance(old_val, dict):
                                old_check_fields = []
                                if old_val.get('company_category'):
                                    cat = old_val['company_category']
                                    cat_name = cat.get('name') if isinstance(cat, dict) else cat
                                    if cat_name:
                                        old_check_fields.append(f"Company Category: {cat_name}")
                                if old_val.get('foir_percent') and old_val.get('foir_percent') not in [0, '', None]:
                                    old_check_fields.append(f"FOIR %: {old_val['foir_percent']}%")
                                if old_val.get('custom_foir_percent') and old_val.get('custom_foir_percent') not in [0, '', None]:
                                    old_check_fields.append(f"Custom FOIR %: {old_val['custom_foir_percent']}%")
                                if old_val.get('monthly_emi_can_pay') and old_val.get('monthly_emi_can_pay') not in [0, '', None]:
                                    old_check_fields.append(f"Monthly EMI Can Pay: ₹{old_val['monthly_emi_can_pay']}")
                                if old_val.get('tenure_months') and old_val.get('tenure_months') not in [0, '', None]:
                                    old_check_fields.append(f"Tenure (Months): {old_val['tenure_months']}")
                                if old_val.get('tenure_years') and old_val.get('tenure_years') not in [0, '', None]:
                                    old_check_fields.append(f"Tenure (Years): {old_val['tenure_years']}")
                                if old_val.get('roi') and old_val.get('roi') not in [0, '', None]:
                                    old_check_fields.append(f"Rate of Interest (ROI): {old_val['roi']}%")
                                if old_val.get('foir_eligibility') and old_val.get('foir_eligibility') not in [0, '', None]:
                                    old_check_fields.append(f"FOIR Eligibility: ₹{old_val['foir_eligibility']}")
                                if old_val.get('multiplier') and old_val.get('multiplier') not in [0, '', None, '0']:
                                    old_check_fields.append(f"Multiplier: {old_val['multiplier']}")
                                
                                old_val = "\n".join(old_check_fields) if old_check_fields else "No eligibility data"
                            else:
                                old_val = "Not Set"
                        
                        # Special handling for applicant/co-applicant section objects
                        elif nested_field in ["personal_details", "employment_details", "residence_details", 
                                             "business_details", "coapplicant_personal_details", 
                                             "coapplicant_employment_details", "coapplicant_residence_details",
                                             "coapplicant_business_details"] and isinstance(new_val, dict):
                            # Format section updates nicely - show what fields changed
                            section_changes = []
                            
                            # Common field labels for readability
                            field_labels = {
                                # Personal Details
                                'first_name': 'First Name', 'middle_name': 'Middle Name', 'last_name': 'Last Name',
                                'gender': 'Gender', 'date_of_birth': 'Date of Birth', 'marital_status': 'Marital Status',
                                'education': 'Education', 'father_name': 'Father Name', 'mother_name': 'Mother Name',
                                'email': 'Email', 'mobile': 'Mobile', 'alternate_mobile': 'Alternate Mobile',
                                
                                # Employment Details
                                'employment_type': 'Employment Type', 'company_name': 'Company Name',
                                'designation': 'Designation', 'years_in_job': 'Years in Job',
                                'monthly_income': 'Monthly Income', 'annual_income': 'Annual Income',
                                'salary_mode': 'Salary Mode', 'office_address': 'Office Address',
                                
                                # Business Details
                                'business_name': 'Business Name', 'business_type': 'Business Type',
                                'nature_of_business': 'Nature of Business', 'years_in_business': 'Years in Business',
                                'turnover': 'Annual Turnover', 'monthly_profit': 'Monthly Profit',
                                'gst_number': 'GST Number', 'business_address': 'Business Address',
                                
                                # Residence Details
                                'residence_type': 'Residence Type', 'address': 'Address',
                                'pincode': 'Pincode', 'city': 'City', 'state': 'State',
                                'years_at_residence': 'Years at Residence'
                            }
                            
                            old_section = old_val if isinstance(old_val, dict) else {}
                            new_section = new_val
                            
                            # Find what changed in this section
                            all_keys = set(list(old_section.keys()) + list(new_section.keys()))
                            for field_key in all_keys:
                                old_field = old_section.get(field_key)
                                new_field = new_section.get(field_key)
                                
                                # Normalize for comparison
                                old_normalized = str(old_field).strip() if old_field not in [None, '', 'N/A'] else None
                                new_normalized = str(new_field).strip() if new_field not in [None, '', 'N/A'] else None
                                
                                if old_normalized != new_normalized:
                                    field_label = field_labels.get(field_key, field_key.replace('_', ' ').title())
                                    old_display = old_field if old_normalized else "Not Set"
                                    new_display = new_field if new_normalized else "Removed"
                                    
                                    # Add currency formatting for income/amount fields
                                    if 'income' in field_key or 'turnover' in field_key or 'profit' in field_key:
                                        if new_normalized:
                                            try:
                                                new_display = f"₹{int(new_field):,}"
                                            except (ValueError, TypeError):
                                                pass
                                        if old_normalized:
                                            try:
                                                old_display = f"₹{int(old_field):,}"
                                            except (ValueError, TypeError):
                                                pass
                                    
                                    section_changes.append(f"{field_label}: {old_display} → {new_display}")
                            
                            if section_changes:
                                new_val = "\n".join(section_changes)
                                old_val = "Updated"
                            else:
                                # No actual changes, skip this activity
                                continue
                        
                        # Handle other dict/list/object values
                        elif isinstance(old_val, dict):
                            old_val = f"[Object with {len(old_val)} fields]"
                        elif isinstance(old_val, list):
                            old_val = f"[Array with {len(old_val)} items]"
                        
                        if isinstance(new_val, dict):
                            new_val = f"[Object with {len(new_val)} fields]"
                        elif isinstance(new_val, list) and nested_field != "obligations":
                            new_val = f"[Array with {len(new_val)} items]"
                        
                        activity_data = {
                            "lead_id": lead_id,
                            "user_id": user_id,
                            "user_name": updated_by_name,
                            "activity_type": "field_update",
                            "description": nested_display_name,  # Just the field name, no " updated"
                            "details": {
                                "field_display_name": nested_display_name,
                                "old_value": old_val,
                                "new_value": new_val
                            },
                            "created_at": update_data["updated_at"]
                        }
                        await self.activity_collection.insert_one(activity_data)
                        print(f"✅ Recorded field update: {nested_display_name} changed from '{old_val}' to '{new_val}'")
                        
                        # Mark obligation-related fields as processed to avoid duplicates
                        if nested_field == "obligations":
                            processed_obligation_fields.add("obligations")
                        elif nested_field == "check_eligibility":
                            processed_obligation_fields.add("check_eligibility")
                
                # Handle nested process_data changes (NEW - for "How to Process" section)
                elif field_name == "process_data" and isinstance(change_data, dict):
                    # Create separate activity for each nested field in process_data
                    for process_field, process_change in change_data.items():
                        # Map snake_case field names to readable labels
                        field_labels = {
                            "processing_bank": "Processing Bank",
                            "how_to_process": "How to Process",
                            "loan_type": "Loan Type",
                            "case_type": "Case Type",
                            "required_loan_amount": "Required Loan Amount",
                            "processing_fees": "Processing Fees",
                            "loan_tenure": "Loan Tenure",
                            "rate_of_interest": "Rate of Interest",
                            "other_charges": "Other Charges",
                            "remarks": "Remarks"
                        }
                        
                        process_display_name = field_labels.get(process_field, process_field.replace('_', ' ').title())
                        
                        # Format old and new values
                        old_val = process_change.get("from", "Not Set")
                        new_val = process_change.get("to", "")
                        
                        # Format specific field types for better readability
                        if process_field == "required_loan_amount" and new_val and new_val != "Not Set":
                            try:
                                new_val = f"₹{int(new_val):,}"
                            except (ValueError, TypeError):
                                pass
                        
                        if process_field == "required_loan_amount" and old_val and old_val != "Not Set":
                            try:
                                old_val = f"₹{int(old_val):,}"
                            except (ValueError, TypeError):
                                pass
                        
                        if process_field == "loan_tenure" and new_val and new_val != "Not Set":
                            try:
                                new_val = f"{new_val} months"
                            except (ValueError, TypeError):
                                pass
                        
                        if process_field == "loan_tenure" and old_val and old_val != "Not Set":
                            try:
                                old_val = f"{old_val} months"
                            except (ValueError, TypeError):
                                pass
                        
                        if process_field == "rate_of_interest" and new_val and new_val != "Not Set":
                            try:
                                new_val = f"{new_val}%"
                            except (ValueError, TypeError):
                                pass
                        
                        if process_field == "rate_of_interest" and old_val and old_val != "Not Set":
                            try:
                                old_val = f"{old_val}%"
                            except (ValueError, TypeError):
                                pass
                        
                        # Truncate long values for readability
                        if isinstance(old_val, str) and len(old_val) > 100:
                            old_val = old_val[:100] + "..."
                        if isinstance(new_val, str) and len(new_val) > 100:
                            new_val = new_val[:100] + "..."
                        
                        activity_data = {
                            "lead_id": lead_id,
                            "user_id": user_id,
                            "user_name": updated_by_name,
                            "activity_type": "field_update",
                            "description": process_display_name,  # Just the field name
                            "details": {
                                "field_display_name": process_display_name,
                                "old_value": str(old_val) if old_val is not None else "Not Set",
                                "new_value": str(new_val) if new_val is not None else ""
                            },
                            "created_at": update_data["updated_at"]
                        }
                        await self.activity_collection.insert_one(activity_data)
                        print(f"✅ Recorded process field update: {process_display_name} changed from '{old_val}' to '{new_val}'")
                
                # Handle nested importantquestion changes (important questions responses)
                elif field_name in ["importantquestion", "question_responses"] and isinstance(change_data, dict):
                    # Get all questions from database to get question text
                    from .ImportantQuestions import ImportantQuestionsDB
                    questions_db = ImportantQuestionsDB()
                    all_questions = await questions_db.get_questions()
                    question_map = {str(q.get("_id")): q.get("question_text", "Unknown Question") for q in all_questions}
                    
                    # Create separate activity for each question response change
                    for question_id, response_change in change_data.items():
                        question_text = question_map.get(question_id, f"Question {question_id}")
                        
                        # Get old and new responses
                        old_response = response_change.get("from", "Not Answered")
                        new_response = response_change.get("to", "Not Answered")
                        
                        # Format boolean responses nicely
                        if isinstance(old_response, bool):
                            old_response = "Yes" if old_response else "No"
                        elif isinstance(old_response, dict):
                            old_response = "Selected" if old_response else "Not Selected"
                        elif old_response in [None, "", []]:
                            old_response = "Not Answered"
                        
                        if isinstance(new_response, bool):
                            new_response = "Yes" if new_response else "No"
                        elif isinstance(new_response, dict):
                            new_response = "Selected" if new_response else "Not Selected"
                        elif new_response in [None, "", []]:
                            new_response = "Not Answered"
                        
                        activity_data = {
                            "lead_id": lead_id,
                            "user_id": user_id,
                            "user_name": updated_by_name,
                            "activity_type": "field_update",
                            "description": f"Important Question: {question_text}",
                            "details": {
                                "field_display_name": f"Important Question: {question_text}",
                                "old_value": str(old_response),
                                "new_value": str(new_response)
                            },
                            "created_at": update_data["updated_at"]
                        }
                        await self.activity_collection.insert_one(activity_data)
                        print(f"✅ Recorded important question update: {question_text} - {old_response} → {new_response}")
                
                else:
                    # Regular field change (not nested)
                    old_val = change_data.get("from", "Not Set")
                    new_val = change_data.get("to", "")
                    
                    # Special handling for important questions field if it's at top level
                    if field_name in ["importantquestion", "question_responses"]:
                        # Skip if empty or no real change
                        if old_val == new_val or (not old_val and not new_val):
                            continue
                        
                        # Format as summary
                        if isinstance(new_val, dict):
                            answered_count = sum(1 for v in new_val.values() if v not in [None, "", False, []])
                            new_val = f"{answered_count} question(s) answered"
                        if isinstance(old_val, dict):
                            answered_count = sum(1 for v in old_val.values() if v not in [None, "", False, []])
                            old_val = f"{answered_count} question(s) answered"
                    
                    # Truncate long values for readability
                    if isinstance(old_val, str) and len(old_val) > 100:
                        old_val = old_val[:100] + "..."
                    if isinstance(new_val, str) and len(new_val) > 100:
                        new_val = new_val[:100] + "..."
                    
                    # Handle dict/object values for other fields
                    if isinstance(old_val, dict) and field_name not in ["importantquestion", "question_responses"]:
                        old_val = f"[Object with {len(old_val)} fields]"
                    if isinstance(new_val, dict) and field_name not in ["importantquestion", "question_responses"]:
                        new_val = f"[Object with {len(new_val)} fields]"
                    
                    # Handle list/array values
                    if isinstance(old_val, list):
                        old_val = f"[Array with {len(old_val)} items]"
                    if isinstance(new_val, list):
                        new_val = f"[Array with {len(new_val)} items]"
                    
                    activity_data = {
                        "lead_id": lead_id,
                        "user_id": user_id,
                        "user_name": updated_by_name,
                        "activity_type": "field_update",
                        "description": field_display_name,  # Just the field name, no " updated"
                        "details": {
                            "field_display_name": field_display_name,
                            "old_value": str(old_val) if old_val is not None else "Not Set",
                            "new_value": str(new_val) if new_val is not None else ""
                        },
                        "created_at": update_data["updated_at"]
                    }
                    await self.activity_collection.insert_one(activity_data)
                    print(f"✅ Recorded field update: {field_display_name} changed from '{old_val}' to '{new_val}'")
            
        return True
        
    async def delete_lead(self, lead_id: str, user_id: str) -> bool:
        """Delete a lead and related data"""
        if not ObjectId.is_valid(lead_id):
            return False
            
        # Get lead first for reference
        lead = await self.get_lead(lead_id)
        if not lead:
            return False
            
        # Delete lead documents
        lead_dir = self.leads_media_root / lead_id
        if lead_dir.exists():
            shutil.rmtree(lead_dir)
            
        # Log the deletion with user name
        deleted_by_name = await self._get_user_name(user_id)
        
        activity_data = {
            "lead_id": lead_id,
            "user_id": user_id,
            "user_name": deleted_by_name,
            "activity_type": "delete",
            "description": "Lead deleted",
            "details": {
                "lead_id": lead_id,
                "lead_data": lead
            },
            "created_at": get_ist_now()
        }
        await self.activity_collection.insert_one(activity_data)
            
        # Delete the lead and related collections
        await self.documents_collection.delete_many({"lead_id": lead_id})
        await self.notes_collection.delete_many({"lead_id": lead_id})
        result = await self.collection.delete_one({"_id": ObjectId(lead_id)})
            
        return result.deleted_count == 1
        
    async def assign_lead(self, lead_id: str, user_id: str, assigned_by: str, notes: str = None) -> bool:
        """Assign a lead to a user"""
        return self.update_lead(
            lead_id, 
            {
                "assigned_to": user_id,
                "transfer_notes": notes or f"Assigned to user {user_id}"
            },
            assigned_by
        )
        
    async def add_reporting_user(self, lead_id: str, user_id: str, added_by: str) -> bool:
        """Add a user to the reporting list for a lead"""
        if not (ObjectId.is_valid(lead_id) and user_id):
            return False
            
        # Get current lead
        lead = await self.get_lead(lead_id)
        if not lead:
            return False
            
        # Get current reporting list
        current_reporters = lead.get("assign_report_to", [])
        
        # Check if user is already in the list
        if user_id in current_reporters:
            return True  # Already added
            
        # Add user to reporting list
        current_reporters.append(user_id)
        
        # Update lead
        result = self.update_lead(
            lead_id,
            {
                "assign_report_to": current_reporters
            },
            added_by
        )
        
        return result
        
    async def remove_reporting_user(self, lead_id: str, user_id: str, removed_by: str) -> bool:
        """Remove a user from the reporting list for a lead"""
        if not (ObjectId.is_valid(lead_id) and user_id):
            return False
            
        # Get current lead
        lead = await self.get_lead(lead_id)
        if not lead:
            return False
            
        # Get current reporting list
        current_reporters = lead.get("assign_report_to", [])
        
        # Check if user is in the list
        if user_id not in current_reporters:
            return True  # Already not in list
            
        # Remove user from reporting list
        current_reporters.remove(user_id)
        
        # Update lead
        result = self.update_lead(
            lead_id,
            {
                "assign_report_to": current_reporters
            },
            removed_by
        )
        
        return result
        
    async def transfer_lead(self, lead_id: str, 
                     to_user_id: str, 
                     to_department_id: str,
                     transferred_by: str, 
                     notes: str = None,
                     reporting_option: str = "preserve") -> bool:
        """
        Transfer a lead to another user/department
        
        Args:
            lead_id: Lead to transfer
            to_user_id: User to assign lead to
            to_department_id: Department to move lead to
            transferred_by: User ID making the transfer
            notes: Optional transfer notes
            reporting_option: How to handle reporting assignments
                - "preserve": Keep existing reporting users
                - "reset": Remove all reporting users
                - "merge": Keep existing and add default department reporters
        """
        # Get current lead
        lead = await self.get_lead(lead_id)
        if not lead:
            return False
            
        # Handle reporting assignments based on option
        current_reporters = lead.get("assign_report_to", [])
        new_reporters = []
        
        if reporting_option == "preserve":
            new_reporters = current_reporters
        elif reporting_option == "reset":
            new_reporters = []
        elif reporting_option == "merge":
            # Keep existing and add default department reporters
            new_reporters = list(current_reporters)
            default_reporters = await self.get_default_reporters_for_department(to_department_id)
            for reporter in default_reporters:
                if reporter not in new_reporters:
                    new_reporters.append(reporter)
                    
        # Update the lead
        return self.update_lead(
            lead_id, 
            {
                "assigned_to": to_user_id,
                "department_id": to_department_id,
                "assign_report_to": new_reporters,
                "transfer_notes": notes or "Lead transferred to new department"
            },
            transferred_by
        )
        
    async def get_default_reporters_for_department(self, department_id: str) -> List[str]:
        """Get default reporters for a department"""
        if not department_id:
            return []
            
        # Check assignment configuration
        config = await self.assignment_config_collection.find_one({"department_id": department_id})
        if not config or "default_reporters" not in config:
            return []
            
        return config["default_reporters"]
        
    async def get_eligible_assignees(self, department_id: str, user_id: str = None) -> List[dict]:
        """
        Get users who can be assigned leads in a department
        
        Args:
            department_id: Department to get assignees for
            user_id: Optional current user to exclude
            
        Returns:
            List of user records who can be assigned
        """
        from app.database.Users import UsersDB
        users_db = UsersDB()
        
        # Check if department has specific role configuration
        config = await self.assignment_config_collection.find_one({"department_id": department_id})
        
        # If configuration exists and has assignable_role_ids
        if config and "assignable_role_ids" in config and config["assignable_role_ids"]:
            users = await users_db.get_users_by_roles(
                config["assignable_role_ids"], 
                department_id=department_id
            )
        else:
            # Default: get all active users in department
            users = await users_db.list_users({
                "department_id": department_id,
                "is_active": True
            })
            
        # Remove current user from results if specified
        if user_id:
            users = [u for u in users if str(u.get("_id")) != user_id]
            
        return users
    
    async def get_tl_users_in_department(self, department_id: str, exclude_user_id: str = None) -> List[dict]:
        """
        Get Team Leader users in a department
        
        Args:
            department_id: Department to get TL users for
            exclude_user_id: Optional user to exclude from results
            
        Returns:
            List of TL user records in the department
        """
        from app.database import get_users_db, get_roles_db
        
        users_db = get_users_db()
        roles_db = get_roles_db()
        
        # Get all users in the department
        department_users = await users_db.get_employees(department_id=department_id)
        
        # Filter for TL roles - assuming TL roles have "tl" or "team leader" in their name
        tl_users = []
        for user in department_users:
            if not user.get("is_active", True):
                continue
                
            if exclude_user_id and str(user.get("_id")) == exclude_user_id:
                continue
                
            if user.get("role_id"):
                role = await roles_db.get_role(user["role_id"])
                if role:
                    role_name = role.get("name", "").lower()
                    # Check if role indicates team leader
                    if "tl" in role_name or "team leader" in role_name or "team_leader" in role_name:
                        tl_users.append(user)
        
        return tl_users
        
    # ========= Activity & History Tracking =========
    
    async def get_lead_activities(self, lead_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get activity timeline for a lead"""
        if not ObjectId.is_valid(lead_id):
            return []
            
        cursor = self.activity_collection.find(
            {"lead_id": lead_id}
        ).sort("created_at", -1).skip(skip).limit(limit)
        return await cursor.to_list(None)
    
    async def get_transfer_history(self, lead_id: str) -> List[dict]:
        """Get transfer history for a lead"""
        if not ObjectId.is_valid(lead_id):
            return []
            
        cursor = self.transfer_history_collection.find(
            {"lead_id": lead_id}
        ).sort("transferred_at", -1)
        return await cursor.to_list(None)
        
    # ========= Notes Management =========
    
    async def add_note(self, note_data: dict) -> str:
        """Add a note to a lead"""
        lead_id = note_data.get("lead_id")
        
        if not ObjectId.is_valid(lead_id):
            return None
            
        # Check if lead exists
        lead = await self.get_lead(lead_id)
        if not lead:
            return None
            
        # Add timestamps
        note_data["created_at"] = get_ist_now()
        note_data["updated_at"] = note_data["created_at"]
        
        # Insert note
        result = await self.notes_collection.insert_one(note_data)
        
        # Record activity with user name
        note_created_by_name = await self._get_user_name(note_data["created_by"])
        
        activity_data = {
            "lead_id": lead_id,
            "user_id": note_data["created_by"],
            "user_name": note_created_by_name,
            "activity_type": "note",
            "description": "Note added",
            "details": {
                "note_id": str(result.inserted_id),
                "note_text": note_data.get("content", ""),
                "note_type": note_data.get("note_type", "")
            },
            "created_at": note_data["created_at"]
        }
        await self.activity_collection.insert_one(activity_data)
        
        return str(result.inserted_id)
        
    async def get_comment(self, comment_id: str) -> dict:
        """Get a comment/note by ID - alias for get_note"""
        return await self.get_note(comment_id)
    
    async def get_note(self, note_id: str) -> dict:
        """Get a note by ID"""
        if not ObjectId.is_valid(note_id):
            return None
        return await self.notes_collection.find_one({"_id": ObjectId(note_id)})
        
    async def get_lead_notes(self, lead_id: str, skip: int = 0, limit: int = 20) -> List[dict]:
        """Get notes for a lead"""
        if not ObjectId.is_valid(lead_id):
            return []
            
        cursor = self.notes_collection.find(
            {"lead_id": lead_id}
        ).sort("created_at", -1).skip(skip).limit(limit)
        return await cursor.to_list(None)
    
    async def update_comment(self, comment_id: str, update_data: dict) -> bool:
        """Update a comment/note - alias for update_note"""
        return self.update_note(comment_id, update_data)
    
    async def update_note(self, note_id: str, update_data: dict) -> bool:
        """Update a note's metadata or content"""
        if not ObjectId.is_valid(note_id):
            return False
            
        # Get current note
        note = await self.get_note(note_id)
        if not note:
            return False
            
        # Update the note
        result = await self.notes_collection.update_one(
            {"_id": ObjectId(note_id)},
            {"$set": update_data}
        )
        
        # Record activity if successfully updated
        if result.modified_count > 0:
            activity_data = {
                "lead_id": note.get("lead_id"),
                "user_id": update_data.get("updated_by"),
                "action": "note_updated",
                "description": "Note updated",
                "details": {"note_id": note_id},
                "created_at": get_ist_now()
            }
            await self.activity_collection.insert_one(activity_data)
            
        return result.modified_count > 0
    
    async def delete_comment(self, comment_id: str) -> bool:
        """Delete a comment/note - alias for delete_note"""
        return self.delete_note(comment_id)
    
    async def delete_note(self, note_id: str) -> bool:
        """Delete a note"""
        if not ObjectId.is_valid(note_id):
            return False
            
        # Get note before deletion
        note = await self.get_note(note_id)
        if not note:
            return False
            
        # Delete the note
        result = await self.notes_collection.delete_one({"_id": ObjectId(note_id)})
        
        # Record activity if successfully deleted
        if result.deleted_count > 0:
            activity_data = {
                "lead_id": note.get("lead_id"),
                "user_id": note.get("created_by"),  # Use creator as we don't have deleter info
                "action": "note_deleted",
                "description": "Note deleted",
                "details": {"note_id": note_id},
                "created_at": get_ist_now()
            }
            await self.activity_collection.insert_one(activity_data)
            
        return result.deleted_count > 0
        
    # ========= Document Management =========
    
    async def create_media_path(self, lead_id: str) -> str:
        """
        Create and return the path for lead's documents
        """
        # Create path for lead's media files
        media_dir = Path(os.getcwd()) / "media" / "leads" / str(lead_id)
        
        # Ensure directory exists
        os.makedirs(media_dir, exist_ok=True)
        
        return media_dir
        
    async def add_document(self, document_data: Dict[str, Any]) -> str:
        """
        Add a document to a lead and record activity
        Returns the document ID if successful
        """
        # Validate lead_id
        lead_id = document_data.get("lead_id")
        if not lead_id or not ObjectId.is_valid(lead_id):
            return None
            
        # Add timestamps
        document_data["created_at"] = get_ist_now()
        document_data["updated_at"] = document_data["created_at"]
        
        # Initialize status if not provided
        if "status" not in document_data:
            document_data["status"] = "received"
            
        # Insert document
        result = await self.documents_collection.insert_one(document_data)
        document_id = str(result.inserted_id)
        
        # Record activity
        activity_data = {
            "lead_id": lead_id,
            "user_id": document_data["uploaded_by"],
            "activity_type": "document",
            "description": f"Document uploaded: {document_data.get('filename', 'Unnamed')}",
            "details": {
                "document_id": document_id,
                "document_type": document_data.get("document_type"),
                "category": document_data.get("category")
            },
            "created_at": document_data["created_at"]
        }
        await self.activity_collection.insert_one(activity_data)
        
        return document_id
        
    async def get_lead_documents(self, lead_id: str) -> List[dict]:
        """Get all documents for a lead"""
        if not ObjectId.is_valid(lead_id):
            return []
            
        return await self._async_to_list(self.documents_collection.find({"lead_id": lead_id}))
    
    async def get_documents(self, lead_id: str) -> List[dict]:
        """Alias for get_lead_documents - for backward compatibility"""
        return self.get_lead_documents(lead_id)
    
    async def get_document(self, document_id: str) -> dict:
        """Get a single document by ID"""
        if not ObjectId.is_valid(document_id):
            return None
        return await self.documents_collection.find_one({"_id": ObjectId(document_id)})
        
    async def update_document(self, document_id: str, update_data: dict, user_id: str) -> bool:
        """Update document metadata or status"""
        if not ObjectId.is_valid(document_id):
            return False
            
        # Get document first
        document = await self.documents_collection.find_one({"_id": ObjectId(document_id)})
        if not document:
            return False
            
        # Update timestamp
        update_data["updated_at"] = get_ist_now()
        
        # Update document
        result = await self.documents_collection.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_data}
        )
        
        # Record activity if status changed
        if result.modified_count > 0 and "status" in update_data:
            activity_data = {
                "lead_id": document["lead_id"],
                "user_id": user_id,
                "activity_type": "document_status",
                "description": f"Document status updated to '{update_data['status']}'",
                "details": {
                    "document_id": document_id,
                    "filename": document.get("filename"),
                    "old_status": document.get("status"),
                    "new_status": update_data["status"]
                },
                "created_at": update_data["updated_at"]
            }
            await self.activity_collection.insert_one(activity_data)
            
        return result.modified_count > 0
        
    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete a document"""
        if not ObjectId.is_valid(document_id):
            return False
            
        # Get document first
        document = await self.documents_collection.find_one({"_id": ObjectId(document_id)})
        if not document:
            return False
            
        # Delete file if it exists
        if "file_path" in document:
            file_path = Path(document["file_path"])
            if file_path.exists():
                file_path.unlink()
                
        # Delete document record
        result = await self.documents_collection.delete_one({"_id": ObjectId(document_id)})
        
        # Record activity
        if result.deleted_count > 0:
            activity_data = {
                "lead_id": document["lead_id"],
                "user_id": user_id,
                "activity_type": "document_delete",
                "description": f"Document deleted: {document.get('filename', 'Unnamed')}",
                "details": {
                    "document_id": document_id,
                    "document_type": document.get("document_type"),
                    "category": document.get("category")
                },
                "created_at": get_ist_now()
            }
            await self.activity_collection.insert_one(activity_data)
            
        return result.deleted_count > 0
        
    # ========= Assignment Configuration =========
    
    async def create_assignment_config(self, config_data: dict) -> str:
        """
        Create assignment configuration for a department
        
        Config defines:
        - Which roles can be assigned leads
        - Default reporting users
        - Other assignment rules
        """
        # Add timestamps
        config_data["created_at"] = get_ist_now()
        config_data["updated_at"] = config_data["created_at"]
        
        # Check if config exists for department
        existing = await self.assignment_config_collection.find_one({
            "department_id": config_data["department_id"]
        })
        
        if existing:
            # Update existing config
            await self.assignment_config_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {**config_data, "updated_at": config_data["updated_at"]}}
            )
            return str(existing["_id"])
        else:
            # Create new config
            result = await self.assignment_config_collection.insert_one(config_data)
            return str(result.inserted_id)
            
    async def get_assignment_config(self, department_id: str) -> Optional[dict]:
        """Get assignment configuration for a department"""
        return await self.assignment_config_collection.find_one({"department_id": department_id})
        
    async def list_assignment_configs(self) -> List[dict]:
        """List all assignment configurations"""
        cursor = self.assignment_config_collection.find()
        return await cursor.to_list(None)
        
    async def update_assignment_config(self, config_id: str, update_data: dict) -> bool:
        """Update an assignment configuration"""
        if not ObjectId.is_valid(config_id):
            return False
            
        update_data["updated_at"] = get_ist_now()
        
        result = await self.assignment_config_collection.update_one(
            {"_id": ObjectId(config_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
        
    # ========= Dynamic Form Configuration =========
    
    async def create_form_field(self, field_data: dict) -> str:
        """Create a new form field definition"""
        # Add timestamps
        field_data["created_at"] = get_ist_now()
        field_data["updated_at"] = field_data["created_at"]
        
        # Insert field
        result = await self.form_fields_collection.insert_one(field_data)
        return str(result.inserted_id)
        
    async def get_form_field(self, field_id: str) -> Optional[dict]:
        """Get a form field by ID"""
        if not ObjectId.is_valid(field_id):
            return None
        return await self.form_fields_collection.find_one({"_id": ObjectId(field_id)})
        
    async def list_form_fields(self, department_id: Optional[str] = None) -> List[dict]:
        """
        List form fields, optionally filtered by department
        
        If department_id is provided, returns fields specific to that department
        plus global fields (department_id=None)
        """
        query = {}
        
        if department_id:
            # Get department-specific fields plus global fields
            query = {"$or": [
                {"department_id": department_id},
                {"department_id": None}
            ]}
            
        cursor = self.form_fields_collection.find(query).sort("order", 1)
        return await cursor.to_list(None)
        
    async def update_form_field(self, field_id: str, update_data: dict) -> bool:
        """Update a form field definition"""
        if not ObjectId.is_valid(field_id):
            return False
            
        # Update timestamp
        update_data["updated_at"] = get_ist_now()
        
        result = await self.form_fields_collection.update_one(
            {"_id": ObjectId(field_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
        
    async def delete_form_field(self, field_id: str) -> bool:
        """Delete a form field definition"""
        if not ObjectId.is_valid(field_id):
            return False
            
        result = await self.form_fields_collection.delete_one({"_id": ObjectId(field_id)})
        return result.deleted_count > 0
        
    # ========= Status Configuration =========
    
    async def create_status(self, status_data: dict) -> str:
        """Create a new status definition"""
        # Add timestamps
        status_data["created_at"] = get_ist_now()
        status_data["updated_at"] = status_data["created_at"]
        
        # Ensure status has an ID string for referencing
        if "id" not in status_data:
            status_data["id"] = str(uuid.uuid4())
            
        # Insert status
        result = await self.statuses_collection.insert_one(status_data)
        return str(result.inserted_id)
        
    async def get_status(self, status_id: str) -> Optional[dict]:
        """Get a status by its MongoDB ID"""
        if not ObjectId.is_valid(status_id):
            return None
        return await self.statuses_collection.find_one({"_id": ObjectId(status_id)})
        
    async def get_status_by_id(self, status_id: str) -> Optional[dict]:
        """Get a status by its ID"""
        # First try to find by MongoDB ObjectId (for backward compatibility)
        if ObjectId.is_valid(status_id):
            status = await self.statuses_collection.find_one({"_id": ObjectId(status_id)})
            if status:
                return status
        
        # Then try to find by string ID field
        return await self.statuses_collection.find_one({"id": status_id})
        
    async def get_status_by_name(self, status_name: str) -> Optional[dict]:
        """Get a status by its name"""
        return await self.statuses_collection.find_one({"name": status_name})
        
    async def get_statuses_for_department(self, department_name: str) -> List[dict]:
        """Get all statuses available for a specific department"""
        query = {
            "department": department_name.lower()
        }
        cursor = self.statuses_collection.find(query).sort("order", 1)
        return await cursor.to_list(None)
        
    async def list_statuses(self, department_name: Optional[str] = None) -> List[dict]:
        """
        List all status definitions
        If department_name is provided, filter by department_ids array
        """
        query = {}
        
        if department_name:
            # Filter by department_ids array (contains the department)
            query["department_ids"] = department_name.lower()
            
        cursor = self.statuses_collection.find(query).sort("order", 1)
        return await cursor.to_list(None)
        
    async def update_status(self, status_id: str, update_data: dict) -> bool:
        """Update a status definition"""
        print(f"DEBUG: Updating status with ID: {status_id}")
        print(f"DEBUG: Update data: {update_data}")
        
        # First try to update by MongoDB ObjectId
        if ObjectId.is_valid(status_id):
            # Update timestamp
            update_data["updated_at"] = get_ist_now()
            
            result = await self.statuses_collection.update_one(
                {"_id": ObjectId(status_id)},
                {"$set": update_data}
            )
            
            print(f"DEBUG: Update result - matched: {result.matched_count}, modified: {result.modified_count}")
            if result.matched_count > 0:
                return result.modified_count > 0
        
        # If no match by ObjectId, try by string ID field
        print("DEBUG: No match by ObjectId, trying by string ID field")
        # Update timestamp
        update_data["updated_at"] = get_ist_now()
        print(update_data)
        result = await self.statuses_collection.update_one(
            {"id": status_id},
            {"$set": update_data}
        )
        
        print(f"DEBUG: String ID update result - matched: {result.matched_count}, modified: {result.modified_count}")
        return result.modified_count > 0
        
    async def delete_status(self, status_id: str) -> bool:
        """Delete a status definition"""
        if not ObjectId.is_valid(status_id):
            return False
            
        # Get status first to delete related sub-statuses
        status = await self.statuses_collection.find_one({"_id": ObjectId(status_id)})
        if not status:
            return False
            
        # Delete related sub-statuses
        if "id" in status:
            await self.sub_statuses_collection.delete_many({"parent_status_id": status["id"]})
            
        # Delete status
        result = await self.statuses_collection.delete_one({"_id": ObjectId(status_id)})
        return result.deleted_count > 0
        
    async def get_default_status(self, department_name: Optional[str] = None) -> Optional[dict]:
        """
        Get the default status for a department
        If department is 'leads' or 'sales', default to 'ACTIVE LEAD'
        If department is 'login', default to 'ACTIVE LOGIN'
        Otherwise, return the first active status
        """
        if department_name:
            # Map department to appropriate default status
            if department_name.lower() in ['leads', 'sales']:
                return await self.statuses_collection.find_one({
                    "name": "ACTIVE LEAD",
                    "is_active": True,
                    "department": department_name.lower()
                })
            elif department_name.lower() in ['login', 'loan_processing']:
                return await self.statuses_collection.find_one({
                    "name": "ACTIVE LOGIN", 
                    "is_active": True,
                    "department": "login"
                })
        
        # Fallback to first active status
        return await self.statuses_collection.find_one(
            {"is_active": True},
            sort=[("order", 1)]
        )
        
    # ========= Sub-Status Configuration =========
    
    async def create_sub_status(self, sub_status_data: dict) -> str:
        """Create a new sub-status definition"""
        # Add timestamps
        sub_status_data["created_at"] = get_ist_now()
        sub_status_data["updated_at"] = sub_status_data["created_at"]
        
        # Ensure sub-status has an ID string for referencing
        if "id" not in sub_status_data:
            sub_status_data["id"] = str(uuid.uuid4())
            
        # Insert sub-status
        result = await self.sub_statuses_collection.insert_one(sub_status_data)
        return str(result.inserted_id)
        
    async def get_sub_status(self, sub_status_id: str) -> Optional[dict]:
        """Get a sub-status by its MongoDB ID"""
        if not ObjectId.is_valid(sub_status_id):
            return None
        return await self.sub_statuses_collection.find_one({"_id": ObjectId(sub_status_id)})
        
    async def get_sub_status_by_id(self, sub_status_id: str) -> Optional[dict]:
        """Get a sub-status by its string ID (not MongoDB _id)"""
        return await self.sub_statuses_collection.find_one({"id": sub_status_id})
        
    async def list_sub_statuses(self, parent_status_id: Optional[str] = None) -> List[dict]:
        """List all sub-status definitions, optionally filtered by parent status"""
        query = {}
        if parent_status_id:
            query["parent_status_id"] = parent_status_id
            
        cursor = self.sub_statuses_collection.find(query).sort("order", 1)
        return await cursor.to_list(None)
        
    async def update_sub_status(self, sub_status_id: str, update_data: dict) -> bool:
        """Update a sub-status definition"""
        if not ObjectId.is_valid(sub_status_id):
            return False
            
        # Update timestamp
        update_data["updated_at"] = get_ist_now()
        
        result = await self.sub_statuses_collection.update_one(
            {"_id": ObjectId(sub_status_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
        
    async def delete_sub_status(self, sub_status_id: str) -> bool:
        """Delete a sub-status definition"""
        if not ObjectId.is_valid(sub_status_id):
            return False
            
        result = await self.sub_statuses_collection.delete_one({"_id": ObjectId(sub_status_id)})
        return result.deleted_count > 0
        
    async def get_default_sub_status(self, parent_status_name: str) -> Optional[dict]:
        """Get the default sub-status for a given parent status name"""
        # First, find the parent status by name to get its _id
        parent_status = await self.statuses_collection.find_one({"name": parent_status_name})
        if not parent_status:
            return None
            
        parent_status_id = str(parent_status["_id"])
        
        return await self.sub_statuses_collection.find_one(
            {"parent_status_id": parent_status_id},
            sort=[("order", 1)]
        )
        
    async def get_sub_status_by_name(self, sub_status_name: str, parent_status_name: Optional[str] = None) -> Optional[dict]:
        """Get a sub-status by its name, optionally filtered by parent status"""
        query = {"name": sub_status_name}
        
        if parent_status_name:
            # First find the parent status to get its ID
            parent_status = await self.get_status_by_name(parent_status_name)
            if parent_status:
                query["parent_status_id"] = str(parent_status["_id"])
        
        return await self.sub_statuses_collection.find_one(query)
        
    # ========= Permission & Visibility =========
    
    async def is_lead_visible_to_user(self, 
                               lead_id: str,
                               user_id: str, 
                               user_role: dict,
                               user_permissions: List[dict],
                               roles_db) -> bool:
        """
        Check if a lead is visible to a user based on roles and permissions
        
        Args:
            lead_id: Lead ID to check
            user_id: User requesting access
            user_role: User's role record
            user_permissions: User's permissions list
            roles_db: Roles database instance for hierarchy lookup
            
        Returns:
            bool: True if user can view the lead, False otherwise
        """
        lead = await self.get_lead(lead_id)
        if not lead:
            return False
        
        # Check if user has relevant view permissions for leads or login page
        has_leads_view = False
        has_login_view = False
        has_view_junior_leads = False
        has_view_junior_login = False
        is_super_admin = False
        is_leads_admin = False
        is_login_admin = False
        
        # Check super admin/page admin status and view/junior permissions
        for perm in user_permissions:
            # Super admin check
            if is_super_admin_permission(perm):
                is_super_admin = True
                break
                
            # Leads admin check
            if perm.get("page") == "leads" and perm.get("actions") == "*":
                is_leads_admin = True
                
            # Login admin check
            if perm.get("page") == "login" and perm.get("actions") == "*":
                is_login_admin = True
                
            # Leads view permissions
            if perm.get("page") == "leads":
                actions = perm.get("actions", [])
                if actions == "*":
                    has_leads_view = True
                    has_view_junior_leads = True
                elif isinstance(actions, list):
                    if "show" in actions or "*" in actions:
                        has_leads_view = True
                    if "junior" in actions or "*" in actions:
                        has_view_junior_leads = True
            
            # Login view permissions
            if perm.get("page") == "login":
                actions = perm.get("actions", [])
                if actions == "*":
                    has_login_view = True
                    has_view_junior_login = True
                elif isinstance(actions, list):
                    if "show" in actions or "*" in actions:
                        has_login_view = True
                    if "junior" in actions or "*" in actions:
                        has_view_junior_login = True

        print(f"DEBUG: Visibility check for lead {lead_id} by user {user_id}")
        print(f"DEBUG: is_super_admin={is_super_admin}, is_leads_admin={is_leads_admin}, is_login_admin={is_login_admin}")
        print(f"DEBUG: has_leads_view={has_leads_view}, has_login_view={has_login_view}")
        print(f"DEBUG: has_view_junior_leads={has_view_junior_leads}, has_view_junior_login={has_view_junior_login}")
        
        # Super admin can see all leads
        if is_super_admin:
            print(f"DEBUG: User {user_id} is super admin, can view lead {lead_id}")
            return True
            
        # Determine if lead is a login department lead
        is_login_lead = lead.get("file_sent_to_login", False)
        
        # Page-specific admin can see all leads for their module
        if is_leads_admin and not is_login_lead:
            print(f"DEBUG: User {user_id} is leads admin, can view regular lead {lead_id}")
            return True
            
        if is_login_admin and is_login_lead:
            print(f"DEBUG: User {user_id} is login admin, can view login lead {lead_id}")
            return True
            
        # Check if user has basic view permission for relevant module
        can_view = (has_leads_view and not is_login_lead) or (has_login_view and is_login_lead)
        if not can_view:
            print(f"DEBUG: User {user_id} lacks basic view permission for lead {lead_id}")
            return False
        
        # Check if user created the lead
        if lead.get("created_by") == user_id:
            print(f"DEBUG: User {user_id} created lead {lead_id}")
            return True
            
        # Check if assigned directly to user - handle both string and array
        assigned_to = lead.get("assigned_to", [])
        if assigned_to == user_id:  # Direct string match
            print(f"DEBUG: Lead {lead_id} is directly assigned to user {user_id}")
            return True
        # Also check if user_id is in assigned_to when it's an array
        if isinstance(assigned_to, list) and user_id in assigned_to:
            print(f"DEBUG: User {user_id} is in assigned_to array for lead {lead_id}")
            return True
            
        # Check if user is explicitly set as a reporting person
        assign_report_to = lead.get("assign_report_to", [])
        if isinstance(assign_report_to, str) and assign_report_to == user_id:
            print(f"DEBUG: User {user_id} is in assign_report_to (string) for lead {lead_id}")
            return True
        if isinstance(assign_report_to, list) and user_id in assign_report_to:
            print(f"DEBUG: User {user_id} is in assign_report_to array for lead {lead_id}")
            return True
            
        # Check for junior permission (hierarchical visibility)
        has_view_junior = (has_view_junior_leads and not is_login_lead) or (has_view_junior_login and is_login_lead)
        
        if has_view_junior:
            print(f"DEBUG: User {user_id} has junior permission")
            # Check if lead is unassigned
            if not assigned_to:
                print(f"DEBUG: Lead {lead_id} is unassigned, user with junior can see it")
                return True
                
            # Get the role of the lead creator
            creator_id = lead.get("created_by")
            if creator_id:
                # Check if creator is a subordinate
                is_subordinate = await self._is_subordinate(creator_id, user_id, roles_db)
                if is_subordinate:
                    print(f"DEBUG: Creator {creator_id} is subordinate to user {user_id}")
                    return True
            
            # Also check if assigned user is a subordinate - handle both string and array
            if assigned_to:
                # For string value
                if isinstance(assigned_to, str) and assigned_to != creator_id:
                    is_subordinate = await self._is_subordinate(assigned_to, user_id, roles_db)
                    if is_subordinate:
                        print(f"DEBUG: Assigned user {assigned_to} is subordinate to user {user_id}")
                        return True
                # For array of users
                elif isinstance(assigned_to, list):
                    for assigned_id in assigned_to:
                        if assigned_id != creator_id:
                            is_subordinate = await self._is_subordinate(assigned_id, user_id, roles_db)
                            if is_subordinate:
                                print(f"DEBUG: Assigned user {assigned_id} is subordinate to user {user_id}")
                                return True
        
        print(f"DEBUG: User {user_id} cannot view lead {lead_id}")
        return False
        
    async def get_visible_leads_filter(self,
                                user_id: str,
                                user_role: dict,
                                user_permissions: List[dict],
                                roles_db,
                                extra_filters: dict = None) -> dict:
        """
        Get filter criteria for visible leads for a user
        
        Args:
            user_id: User requesting leads
            user_role: User's role record
            user_permissions: User's permissions list
            roles_db: Roles database instance for hierarchy lookup
            extra_filters: Optional additional filters to apply (e.g., {"file_sent_to_login": True})
            
        Returns:
            dict: MongoDB filter criteria for visible leads
        """
        # Permission-based lead visibility rules:
        # 1. Super admin (page "*" or "any" and actions "*") - sees all leads
        # 2. Page-specific admin for "leads" or "login" - sees all leads for that module
        # 3. User with junior - sees their own leads, assigned leads, junior leads, and unassigned leads
        # 4. Regular user - sees only their own leads, leads assigned to them, or where they are in assign_report_to
        
        print(f"DEBUG: Generating visibility filter for user {user_id}")
        print(f"DEBUG: Extra filters: {extra_filters}")
        print(f"DEBUG: User has {len(user_permissions)} permissions")
        
        # Initialize filter dict with extra filters if provided
        result_filter = {} if extra_filters is None else dict(extra_filters)
        
        # Check if user is a super admin - can see everything
        is_super_admin = any(
            (is_super_admin_permission(perm))
            for perm in user_permissions
        )
        
        # Check for page-specific admin permissions
        is_leads_admin = any(
            (perm.get("page") == "leads" and perm.get("actions") == "*") 
            for perm in user_permissions
        )
        
        is_login_admin = any(
            (perm.get("page") == "login" and perm.get("actions") == "*") 
            for perm in user_permissions
        )
        
        # Check for junior permission
        has_view_junior = any(
            (perm.get("page") in ["leads", "login", "*", "any"] and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Verify basic view permission first
        has_view_permission = any(
            (perm.get("page") in ["leads", "login", "*", "any"] and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "show" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "show" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        print(f"DEBUG: Permission status - super_admin: {is_super_admin}, leads_admin: {is_leads_admin}, login_admin: {is_login_admin}, junior: {has_view_junior}, basic_view: {has_view_permission}")
        
        # If user doesn't have basic view permission, they can't see any leads
        if not has_view_permission:
            print(f"DEBUG: User {user_id} has no view permission, returning empty filter")
            return {"_id": {"$exists": False}}  # This will return no results
        
        # Super admins can see all leads
        if is_super_admin:
            print(f"DEBUG: User {user_id} is super admin, showing all leads")
            return result_filter
        
        # Check for relevant page-specific admin permission based on context
        is_login_context = extra_filters and extra_filters.get("file_sent_to_login", False)
        
        # Leads admin can see all regular leads
        if is_leads_admin and not is_login_context:
            print(f"DEBUG: User {user_id} is leads admin in leads context, showing all leads")
            return result_filter
            
        # Login admin can see all login department leads
        if is_login_admin and is_login_context:
            print(f"DEBUG: User {user_id} is login admin in login context, showing all leads")
            return result_filter
            
        # For login context, leads admin should also see all login leads
        if is_leads_admin and is_login_context:
            print(f"DEBUG: User {user_id} is leads admin in login context, showing all login leads")
            return result_filter
        
        # Regular users with view or junior permission will get filtered results
        filter_conditions = []
        
        # Import ObjectId for proper comparison
        from bson import ObjectId
        
        # Create both string and ObjectId versions for comparison
        try:
            user_object_id = ObjectId(user_id)
        except:
            user_object_id = None
        
        # All users can see their own created leads (handle both string and ObjectId)
        filter_conditions.append({"created_by": user_id})  # String format
        if user_object_id:
            filter_conditions.append({"created_by": user_object_id})  # ObjectId format
        print(f"DEBUG: Adding created_by filters for user {user_id}")
        
        # All users can see leads assigned to them (handle string, ObjectId, and arrays)
        filter_conditions.append({"assigned_to": user_id})  # Direct string match
        filter_conditions.append({"assigned_to": {"$in": [user_id]}})  # String in array
        if user_object_id:
            filter_conditions.append({"assigned_to": user_object_id})  # Direct ObjectId match
            filter_conditions.append({"assigned_to": {"$in": [user_object_id]}})  # ObjectId in array
        print(f"DEBUG: Adding assigned_to filters for user {user_id}")
        
        # All users can see leads where they are in assign_report_to (handle both formats)
        filter_conditions.append({"assign_report_to": user_id})  # Direct string match
        filter_conditions.append({"assign_report_to": {"$in": [user_id]}})  # String in array
        if user_object_id:
            filter_conditions.append({"assign_report_to": user_object_id})  # Direct ObjectId match
            filter_conditions.append({"assign_report_to": {"$in": [user_object_id]}})  # ObjectId in array
        print(f"DEBUG: Adding assign_report_to filters for user {user_id}")
            
        # Users with junior permission have extended visibility
        if has_view_junior:
            print(f"DEBUG: User {user_id} has junior permission, adding junior filters")
            
            # Get all subordinates
            subordinate_ids = await self._get_all_subordinate_ids(user_id, roles_db)
            print(f"DEBUG: Found subordinate IDs: {subordinate_ids}")
            
            if subordinate_ids:
                subordinate_list = list(subordinate_ids)
                print(f"DEBUG: Found {len(subordinate_list)} subordinates: {subordinate_list}")
                
                # Can see leads created by subordinates
                filter_conditions.append({"created_by": {"$in": subordinate_list}})
                
                # Can see leads assigned to subordinates
                filter_conditions.append({"assigned_to": {"$in": subordinate_list}})
            else:
                print(f"DEBUG: No subordinates found for user {user_id}")
            
            # Users with junior permission can also see unassigned leads
            filter_conditions.append({"assigned_to": {"$exists": False}})  # No assigned_to field
            filter_conditions.append({"assigned_to": None})  # assigned_to is null
            filter_conditions.append({"assigned_to": []})  # assigned_to is empty array
            
            print(f"DEBUG: Added unassigned leads filter for junior user {user_id}")
        
        # Build the final filter
        if filter_conditions:
            or_condition = {"$or": filter_conditions}
            print(f"DEBUG: Final OR conditions count: {len(filter_conditions)}")
            
            if extra_filters:
                final_filter = {"$and": [or_condition, extra_filters]}
            else:
                final_filter = or_condition
        else:
            # Fallback - should not happen given our checks above
            print(f"DEBUG: No filter conditions generated, using default")
            final_filter = {"$or": [
                {"created_by": user_id}, 
                {"assigned_to": user_id}, 
                {"assigned_to": {"$in": [user_id]}},
                {"assign_report_to": user_id},
                {"assign_report_to": {"$in": [user_id]}}
            ]}
            
            if extra_filters:
                final_filter = {"$and": [final_filter, extra_filters]}
            
        print(f"DEBUG: Final filter for user {user_id}: {final_filter}")
        return final_filter
            
    async def _is_subordinate(self, potential_subordinate_id: str, manager_id: str, roles_db) -> bool:
        """
        Check if one user is a subordinate of another based on role hierarchy
        
        Args:
            potential_subordinate_id: User who might be a subordinate
            manager_id: User who might be a manager
            roles_db: Roles database instance
            
        Returns:
            bool: True if potential_subordinate reports to manager, False otherwise
        """
        # Use the roles module to find all subordinates
        subordinate_ids = await self._get_all_subordinate_ids(manager_id, roles_db)
        return potential_subordinate_id in subordinate_ids
        
    async def _get_all_subordinate_ids(self, manager_id: str, roles_db) -> Set[str]:
        """
        Get all users who report to this manager (any level deep)
        
        Args:
            manager_id: User ID to find subordinates for
            roles_db: Roles database instance
            
        Returns:
            Set[str]: Set of user IDs who are subordinates of the manager
        """
        from app.database.Users import UsersDB
        users_db = UsersDB()
        
        print(f"DEBUG: Looking for subordinates of user {manager_id}")
        
        # Get manager's role first
        manager_user = await users_db.get_user(manager_id)
        if not manager_user or not manager_user.get("role_id"):
            print(f"DEBUG: Manager user {manager_id} not found or has no role")
            return set()
            
        manager_role_id = manager_user.get("role_id")
        print(f"DEBUG: Manager {manager_id} has role ID: {manager_role_id}")
        
        # Get all subordinate roles
        subordinate_roles = await roles_db.get_all_subordinate_roles(manager_role_id)
        subordinate_role_ids = [str(role["_id"]) for role in subordinate_roles]
        print(f"DEBUG: Found {len(subordinate_roles)} subordinate roles: {subordinate_role_ids}")
        
        # Get users with these roles
        subordinate_users = set()
        for role_id in subordinate_role_ids:
            users = await users_db.get_users_by_role(role_id)
            user_ids = [str(user["_id"]) for user in users]
            print(f"DEBUG: Role {role_id} has {len(users)} users: {user_ids}")
            subordinate_users.update(user_ids)
            
        print(f"DEBUG: Total subordinate users for {manager_id}: {subordinate_users}")
        return subordinate_users
        
    # ========= Share Link Management =========
    
    async def __init_share_links_collection(self):
        """Initialize share links collection if not already done"""
        if not hasattr(self, 'share_links_collection'):
            self.share_links_collection = self.db["lead_share_links"]
            # Create indexes for share links
            await self.share_links_collection.create_index([("lead_id", 1)])
            await self.share_links_collection.create_index([("share_token", 1)], unique=True)
            await self.share_links_collection.create_index([("expires_at", 1)])
            await self.share_links_collection.create_index([("is_active", 1)])
        
    async def create_share_link(self, share_link_data: Dict[str, Any]) -> str:
        """Create a new share link for a lead"""
        self.__init_share_links_collection()
        
        try:
            # Add timestamps
            now = get_ist_now()
            share_link_data.update({
                "created_at": now,
                "updated_at": now,
                "access_count": 0,
                "last_accessed_at": None
            })
            
            # Convert ObjectId fields
            if "lead_id" in share_link_data:
                share_link_data["lead_id"] = ObjectId(share_link_data["lead_id"])
            if "created_by" in share_link_data:
                share_link_data["created_by"] = ObjectId(share_link_data["created_by"])
            
            result = await self.share_links_collection.insert_one(share_link_data)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating share link: {e}")
            return None
    
    async def get_lead_share_links(self, lead_id: str) -> List[Dict[str, Any]]:
        """Get all share links for a lead"""
        await self.__init_share_links_collection()
        
        try:
            cursor = self.share_links_collection.find({
                "lead_id": ObjectId(lead_id)
            }).sort("created_at", -1)
            share_links = await cursor.to_list(None)
            
            return share_links
            
        except Exception as e:
            print(f"Error getting share links: {e}")
            return []
    
    async def get_share_link_by_token(self, share_token: str) -> Optional[Dict[str, Any]]:
        """Get a share link by its token"""
        self.__init_share_links_collection()
        
        try:
            share_link = await self.share_links_collection.find_one({
                "share_token": share_token
            })
            
            # Convert ObjectIds to strings before returning
            if share_link:
                from app.utils.common_utils import convert_object_id, is_super_admin_permission
                return convert_object_id(share_link)
            
            return None
            
        except Exception as e:
            print(f"Error getting share link by token: {e}")
            return None

    async def deactivate_share_link(self, share_token: str, deactivated_by: str = None) -> bool:
        """Deactivate a share link"""
        await self.__init_share_links_collection()

        try:
            update_data = {
                "is_active": False,
                "deactivated_at": get_ist_now(),
                "updated_at": get_ist_now()
            }
            
            # Add deactivated_by if provided
            if deactivated_by:
                update_data["deactivated_by"] = ObjectId(deactivated_by)
            else:
                update_data["deactivated_by"] = None  # System/automatic deactivation
            
            result = await self.share_links_collection.update_one(
                {"share_token": share_token},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error deactivating share link: {e}")
            return False

    async def increment_share_link_access(self, share_token: str) -> bool:
        """Increment the access count for a share link"""
        await self.__init_share_links_collection()

        try:
            result = await self.share_links_collection.update_one(
                {"share_token": share_token},
                {
                    "$inc": {"access_count": 1},
                    "$set": {
                        "last_accessed_at": get_ist_now(),
                        "updated_at": get_ist_now()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error incrementing share link access: {e}")
            return False

    async def update_lead_public(self, lead_id: str, update_data: Dict[str, Any], activity_details: Dict[str, Any] = None) -> bool:
        """Update lead information via public form (without user authentication)"""
        try:
            # Convert ObjectId
            lead_id = ObjectId(lead_id)
            
            # Add timestamp
            update_data["updated_at"] = get_ist_now()
            
            # Ensure we're using $set to merge data
            # Dynamic fields are already processed in the route handler to ensure proper merging
            # Update the lead - ONLY updating the dynamic_fields and metadata
            result = await self.collection.update_one(
                {"_id": lead_id},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                # Create detailed activity log
                details = {
                    "updated_fields": list(update_data.keys()),
                    "form_updated": activity_details.get("form_type") if activity_details else "unknown"
                }
                
                # Add any additional details provided
                if activity_details:
                    details.update(activity_details)
                
                # Log activity
                activity_data = {
                    "lead_id": lead_id,
                    "user_id": None,  # No user for public updates
                    "activity_type": "public_form_update",
                    "description": f"Lead {details.get('form_type', 'form')} updated via public form",
                    "details": details,
                    "created_at": get_ist_now()
                }
                
                await self.activity_collection.insert_one(activity_data)
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating lead publicly: {e}")
            return False

    async def get_share_link_by_id(self, link_id):
        """Get a share link by its ID"""
        try:
            from bson import ObjectId
            return await self.share_links_collection.find_one({"_id": ObjectId(link_id)})
        except Exception as e:
            print(f"Error getting share link by ID: {e}")
            return None

    async def deactivate_share_link_by_id(self, link_id, user_id):
        """Deactivate a share link by its ID"""
        try:
            from bson import ObjectId
            result = await self.share_links_collection.update_one(
                {"_id": ObjectId(link_id)},
                {
                    "$set": {
                        "is_active": False,
                        "deactivated_at": get_ist_now(),
                        "deactivated_by": user_id
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error deactivating share link: {e}")
            return False
            
    # ========= Lead Reassignment Methods =========

    async def check_reassignment_eligibility(self, lead_id: str) -> Dict[str, Any]:
        """
        Check if a lead is eligible for reassignment based on status and sub-status settings
        
        Args:
            lead_id: The ID of the lead to check
            
        Returns:
            dict: Eligibility information including can_reassign flag and reason
        """
        try:
            # Get the lead
            lead = await self.get_lead(lead_id)
            if not lead:
                return {
                    "can_reassign": False,
                    "reason": "Lead not found"
                }
                
            # Check status and sub-status settings
            status_name = lead.get("status")
            sub_status_name = lead.get("sub_status")
            
            # Get status and sub-status objects
            status_obj = await self.get_status_by_name(status_name)
            if not status_obj:
                # If status object not found, allow reassignment
                return {
                    "can_reassign": True,
                    "reason": f"Status '{status_name}' not found in system. Allowing reassignment."
                }
                
            # Default to status reassignment period
            reassignment_period = status_obj.get("reassignment_period", 0)
            is_manager_permission_required = status_obj.get("is_manager_permission_required", False)
            
            # If sub-status is specified, check if it overrides the status settings
            if sub_status_name:
                # Find sub-status object
                sub_statuses = await self.list_sub_statuses(str(status_obj.get("id", status_obj.get("_id"))))
                for sub_status in sub_statuses:
                    if sub_status.get("name") == sub_status_name:
                        # Check if sub-status has its own reassignment period
                        if sub_status.get("reassignment_period") is not None:
                            reassignment_period = sub_status.get("reassignment_period")
                            is_manager_permission_required = sub_status.get("is_manager_permission_required", False)
                        break
            
            # If reassignment period is None or 0, allow immediate reassignment
            if reassignment_period is None or reassignment_period == 0:
                return {
                    "can_reassign": True,
                    "reason": "No reassignment period restriction",
                    "is_manager_permission_required": is_manager_permission_required
                }
                
            # Calculate days since lead was sent to login or created
            current_date = get_ist_now()
            if lead.get("file_sent_to_login") and lead.get("login_department_sent_date"):
                # Use login department sent date as reference
                reference_date = lead["login_department_sent_date"]
                if isinstance(reference_date, str):
                    reference_date = datetime.fromisoformat(reference_date.replace('Z', '+00:00'))
            else:
                # Use created date as reference
                reference_date = lead.get("created_at")
                if not reference_date:
                    # Fallback to update date if created date not available
                    reference_date = lead.get("updated_at", current_date)
                    
            # Calculate days elapsed
            days_elapsed = (current_date - reference_date).days
            
            # Check if enough days have passed
            if days_elapsed >= reassignment_period:
                return {
                    "can_reassign": True,
                    "reason": f"Reassignment period of {reassignment_period} days has passed",
                    "is_manager_permission_required": is_manager_permission_required,
                    "days_elapsed": days_elapsed,
                    "reassignment_period": reassignment_period
                }
            else:
                return {
                    "can_reassign": False,
                    "reason": f"Reassignment period of {reassignment_period} days has not passed ({days_elapsed} days elapsed)",
                    "is_manager_permission_required": is_manager_permission_required,
                    "days_elapsed": days_elapsed,
                    "reassignment_period": reassignment_period,
                    "days_remaining": reassignment_period - days_elapsed
                }
                
        except Exception as e:
            print(f"Error checking reassignment eligibility: {e}")
            # On error, allow reassignment to avoid blocking legitimate requests
            return {
                "can_reassign": True,
                "reason": f"Error during eligibility check: {str(e)}. Allowing reassignment."
            }

    async def update_lead_reassignment_status(self, lead_id: str, update_data: Dict[str, Any]) -> bool:
        """
        Update lead with reassignment related data
        
        Args:
            lead_id: The ID of the lead to update
            update_data: Dictionary with reassignment data including status flags
            
        Returns:
            bool: True if update was successful, False otherwise
        """
        try:
            # Convert string ID to ObjectId if needed
            if isinstance(lead_id, str):
                lead_id = ObjectId(lead_id)
            
            # Get current lead state for field history tracking
            current_lead = await self.get_lead(str(lead_id))
            if not current_lead:
                return False
            
            # Track field changes for audit trail
            field_changes = []
            user_id = update_data.get("reassignment_approved_by") or update_data.get("reassignment_requested_by")
            
            # Track significant field changes
            tracked_fields = ["assigned_to", "data_code", "campaign_name", "reassignment_status"]
            for field in tracked_fields:
                if field in update_data:
                    old_value = current_lead.get(field)
                    new_value = update_data[field]
                    if old_value != new_value:
                        field_changes.append({
                            "field_name": field,
                            "old_value": str(old_value) if old_value is not None else "",
                            "new_value": str(new_value) if new_value is not None else "",
                            "changed_by": user_id,
                            "changed_at": get_ist_now(),
                            "reason": "Reassignment process"
                        })
            
            # Add field history to update if there are changes
            if field_changes:
                update_data["$push"] = {"field_history": {"$each": field_changes}}
                # Separate field updates from operators
                set_data = {k: v for k, v in update_data.items() if not k.startswith("$")}
                final_update = {"$set": set_data}
                if "$push" in update_data:
                    final_update["$push"] = update_data["$push"]
            else:
                final_update = {"$set": update_data}
            
            # Add an activity record for the reassignment request or approval
            activity_data = {
                "lead_id": lead_id,
                "created_at": get_ist_now(),
                "type": "reassignment"
            }
            
            if "pending_reassignment" in update_data:
                if update_data["pending_reassignment"]:
                    activity_data["action"] = "requested"
                    activity_data["created_by"] = update_data.get("reassignment_requested_by")
                    activity_data["details"] = {
                        "target_user": update_data.get("reassignment_target_user"),
                        "reason": update_data.get("reassignment_reason"),
                        "data_code_change": update_data.get("reassignment_new_data_code"),
                        "campaign_name_change": update_data.get("reassignment_new_campaign_name")
                    }
                else:
                    activity_data["action"] = "approved"
                    activity_data["created_by"] = update_data.get("reassignment_approved_by")
                    activity_data["details"] = {
                        "assigned_to": update_data.get("assigned_to"),
                        "field_changes": field_changes
                    }
            elif update_data.get("reassignment_status") == "approved":
                # Direct reassignment case
                activity_data["action"] = "approved_direct"
                activity_data["created_by"] = update_data.get("reassignment_approved_by")
                activity_data["details"] = {
                    "assigned_to": update_data.get("assigned_to"),
                    "reason": update_data.get("reassignment_reason"),
                    "field_changes": field_changes
                }
            
            # Update the lead with reassignment data
            result = await self.collection.update_one(
                {"_id": lead_id},
                final_update
            )
            
            # Add activity record
            if result.modified_count > 0:
                await self.activity_collection.insert_one(activity_data)
            
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating lead reassignment status: {e}")
            return False
            
    async def get_pending_reassignments(self, skip: int = 0, limit: int = 20, 
                                sort_by: str = "reassignment_requested_at", 
                                sort_order: int = -1) -> List[Dict[str, Any]]:
        """
        Get leads with pending reassignment requests
        
        Args:
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return
            sort_by: Field to sort by
            sort_order: Sort direction (1=ascending, -1=descending)
            
        Returns:
            List of lead documents with pending reassignments
        """
        try:
            # Create a filter for leads with pending_reassignment flag
            filter_dict = {"pending_reassignment": True}
            
            # Get leads with pagination and sorting
            cursor = self.collection.find(filter_dict)
            
            # Apply sorting if sort field is provided
            if sort_by:
                cursor = cursor.sort(sort_by, sort_order)
                
            # Apply pagination
            cursor = cursor.skip(skip).limit(limit)
            
            # Convert to list and return
            return await cursor.to_list(None)
        except Exception as e:
            print(f"Error fetching pending reassignments: {e}")
            return []
            
    async def count_pending_reassignments(self) -> int:
        """
        Count leads with pending reassignment requests
        
        Returns:
            int: Count of leads with pending reassignments
        """
        try:
            return await self.collection.count_documents({"pending_reassignment": True})
        except Exception as e:
            print(f"Error counting pending reassignments: {e}")
            return 0

    async def ensure_lead_schema_fields(self):
        """
        Ensure all lead records have the required fields for reassignment functionality
        
        This method adds missing fields to existing lead records to support:
        - data_code/dataCode fields
        - campaign_name/campaignName fields  
        - reassignment status tracking
        - activity history
        - field change history
        """
        try:
            # Count total leads
            total_leads = await self.collection.count_documents({})
            print(f"📊 Checking {total_leads} leads for missing schema fields...")
            
            # Define required fields with default values
            required_fields = {
                "data_code": "",
                "dataCode": "",
                "campaign_name": "",
                "campaignName": "",
                "reassignment_status": "none",
                "activities": [],
                "field_history": [],
                "reassignment_approved_at": None,
                "reassignment_approved_by": None,
                "reassignment_rejected_at": None,
                "reassignment_rejected_by": None,
                "reassignment_rejection_reason": None
            }
            
            updates_made = 0
            
            # Process leads in batches for better performance
            batch_size = 1000
            for skip in range(0, total_leads, batch_size):
                cursor = self.collection.find({}, {"_id": 1, "data_code": 1, "dataCode": 1, 
                                                           "campaign_name": 1, "campaignName": 1,
                                                           "reassignment_status": 1, "activities": 1,
                                                           "field_history": 1}).skip(skip).limit(batch_size)
                leads_batch = await cursor.to_list(None)
                
                for lead in leads_batch:
                    update_data = {}
                    
                    # Check each required field and add if missing
                    for field, default_value in required_fields.items():
                        if field not in lead or lead.get(field) is None:
                            update_data[field] = default_value
                    
                    # Special handling for data_code/dataCode consistency
                    if lead.get("data_code") and not lead.get("dataCode"):
                        update_data["dataCode"] = lead["data_code"]
                    elif lead.get("dataCode") and not lead.get("data_code"):
                        update_data["data_code"] = lead["dataCode"]
                    
                    # Special handling for campaign_name/campaignName consistency
                    if lead.get("campaign_name") and not lead.get("campaignName"):
                        update_data["campaignName"] = lead["campaign_name"]
                    elif lead.get("campaignName") and not lead.get("campaign_name"):
                        update_data["campaign_name"] = lead["campaignName"]
                    
                    # Apply updates if any fields are missing
                    if update_data:
                        await self.collection.update_one(
                            {"_id": lead["_id"]},
                            {"$set": update_data}
                        )
                        updates_made += 1
                
                print(f"✓ Processed batch {skip//batch_size + 1}, updated {updates_made} leads so far...")
            
            # Create indexes for new fields
            try:
                await self.collection.create_index([("data_code", 1)], background=True)
                await self.collection.create_index([("campaign_name", 1)], background=True)
                await self.collection.create_index([("reassignment_status", 1)], background=True)
                print("✓ Created indexes for new schema fields")
            except Exception as e:
                print(f"⚠ Index creation warning: {e}")
            
            print(f"✅ Schema migration completed: {updates_made} leads updated with missing fields")
            return updates_made
            
        except Exception as e:
            print(f"❌ Error during schema migration: {e}")
            return 0

    async def update_lead_with_field_history(self, lead_id: str, update_data: Dict[str, Any], 
                                     user_id: str, reason: str = "") -> bool:
        """
        Update lead with field change tracking
        
        Args:
            lead_id: The ID of the lead to update
            update_data: Dictionary with field updates
            user_id: ID of user making the changes
            reason: Reason for the changes
            
        Returns:
            bool: True if update was successful
        """
        try:
            # Convert string ID to ObjectId if needed
            if isinstance(lead_id, str):
                lead_id = ObjectId(lead_id)
            
            # Get current lead state for comparison
            current_lead = await self.get_lead(str(lead_id))
            if not current_lead:
                return False
            
            # Track field changes
            field_changes = []
            for field, new_value in update_data.items():
                if field in current_lead:
                    old_value = current_lead.get(field)
                    if old_value != new_value:
                        field_changes.append({
                            "field_name": field,
                            "old_value": str(old_value) if old_value is not None else "",
                            "new_value": str(new_value) if new_value is not None else "",
                            "changed_by": user_id,
                            "changed_at": get_ist_now(),
                            "reason": reason
                        })
            
            # Add field history to update data
            if field_changes:
                update_data["$push"] = {
                    "field_history": {"$each": field_changes}
                }
                # Move the field updates to $set
                set_data = {k: v for k, v in update_data.items() if not k.startswith("$")}
                update_data = {"$set": set_data, "$push": update_data.get("$push", {})}
            else:
                update_data = {"$set": update_data}
            
            # Update the lead
            result = await self.collection.update_one(
                {"_id": lead_id},
                update_data
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating lead with field history: {e}")
            return False
