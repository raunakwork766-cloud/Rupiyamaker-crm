"""
LoginLeads Database Module
Separate collection for login department leads
"""

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from app.utils.timezone import get_ist_now
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class LoginLeadsDB:
    """Database class for managing login department leads in a separate collection"""
    
    def __init__(self, database=None):
        if database is None:
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = database
            
        # Login leads collection - separate from main leads
        self.collection = self.db["login_leads"]
        
        # Activity tracking for login leads
        self.activity_collection = self.db["login_lead_activities"]
        self.notes_collection = self.db["login_lead_notes"]
        self.documents_collection = self.db["login_lead_documents"]
        
    async def init_async(self):
        """Initialize async components"""
        await self._create_indexes()
    
    async def _create_indexes(self):
        """Create indexes for login leads collection"""
        try:
            # Core performance indexes
            await self.collection.create_index([("created_at", -1)], background=True)
            await self.collection.create_index([("login_created_at", -1)], background=True)
            await self.collection.create_index([("original_lead_id", 1)], background=True)  # Link to original lead
            await self.collection.create_index([("assigned_to", 1)], background=True)
            await self.collection.create_index([("status", 1)], background=True)
            await self.collection.create_index([("sub_status", 1)], background=True)
            await self.collection.create_index([("loan_type", 1)], background=True)
            
            # Compound indexes for common queries
            await self.collection.create_index([("status", 1), ("created_at", -1)], background=True)
            await self.collection.create_index([("assigned_to", 1), ("status", 1)], background=True)
            
            # Text search index
            await self.collection.create_index([
                ("first_name", "text"),
                ("last_name", "text"),
                ("email", "text"),
                ("phone", "text")
            ], background=True, name="login_lead_search_index")
            
            # Activity indexes
            await self.activity_collection.create_index([("login_lead_id", 1), ("created_at", -1)], background=True)
            await self.notes_collection.create_index([("login_lead_id", 1), ("created_at", -1)], background=True)
            await self.documents_collection.create_index([("login_lead_id", 1)], background=True)
            
            logger.info("✓ Login leads indexes created successfully")
            
        except Exception as e:
            logger.warning(f"Login leads index creation warning: {e}")
    
    async def create_login_lead(self, lead_data: dict, original_lead_id: str, user_id: str) -> str:
        """
        Create a new login lead by duplicating data from original lead
        
        Args:
            lead_data: Complete lead data from original lead (already converted via convert_object_id)
            original_lead_id: ID of the original lead in leads collection
            user_id: ID of user creating the login lead
            
        Returns:
            ID of the newly created login lead
        """
        try:
            # Deep copy to ensure complete data preservation
            import copy
            login_lead = copy.deepcopy(lead_data)
            
            # Remove the original _id to create a new document
            if '_id' in login_lead:
                del login_lead['_id']
            
            # Add login-specific fields
            login_lead['original_lead_id'] = original_lead_id  # Link to original lead
            login_lead['login_created_at'] = get_ist_now()
            login_lead['login_date'] = get_ist_now().isoformat()  # Date when sent to login (for table display)
            login_lead['login_created_by'] = user_id
            login_lead['updated_at'] = get_ist_now()
            
            # Set login status based on current status
            # If lead already has a login-related status, keep it; otherwise set to Active Login
            current_status = login_lead.get('status', '').upper()
            if 'LOGIN' in current_status:
                # Keep existing login status (ACTIVE LOGIN, etc.)
                pass
            else:
                # New lead being sent to login for first time
                login_lead['status'] = 'Active Login'      # Main status
                login_lead['sub_status'] = 'New Login'     # Sub status
            
            # Ensure file_sent_to_login is true
            login_lead['file_sent_to_login'] = True
            
            # Debug logging to verify data preservation
            if login_lead.get('dynamic_fields'):
                logger.info(f"📋 Login lead dynamic_fields keys: {list(login_lead['dynamic_fields'].keys())}")
                if login_lead['dynamic_fields'].get('obligation_data'):
                    obligation_keys = list(login_lead['dynamic_fields']['obligation_data'].keys())
                    logger.info(f"✅ ObligationSection data preserved with keys: {obligation_keys}")
                    logger.info(f"✅ Obligations count: {len(login_lead['dynamic_fields']['obligation_data'].get('obligations', []))}")
            else:
                logger.warning("⚠️ No dynamic_fields found in login_lead data")
            
            # Insert into login_leads collection
            result = await self.collection.insert_one(login_lead)
            login_lead_id = str(result.inserted_id)
            
            # Log activity
            await self._log_activity(
                login_lead_id=login_lead_id,
                activity_type='created',
                description=f'Login lead created from original lead {original_lead_id}',
                user_id=user_id
            )
            
            logger.info(f"✅ Login lead created: {login_lead_id} from original {original_lead_id}")
            logger.info(f"✅ Data preservation verified - dynamic_fields: {bool(login_lead.get('dynamic_fields'))}")
            return login_lead_id
            
        except Exception as e:
            logger.error(f"❌ Error creating login lead: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def get_login_lead(self, login_lead_id: str) -> Optional[dict]:
        """Get a login lead by ID"""
        if not ObjectId.is_valid(login_lead_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(login_lead_id)})
    
    async def list_login_leads(self, filter_dict: dict = None, limit: int = 1000) -> List[dict]:
        """List login leads with optional filtering"""
        query = filter_dict or {}
        cursor = self.collection.find(query).limit(limit).sort("login_created_at", -1)
        return await cursor.to_list(None)
    
    async def update_login_lead(self, login_lead_id: str, update_data: dict, user_id: str) -> bool:
        """Update a login lead"""
        if not ObjectId.is_valid(login_lead_id):
            return False
        
        # Get current lead for tracking changes
        current_lead = await self.get_login_lead(login_lead_id)
        if not current_lead:
            return False
        
        # Add update timestamp
        update_data['updated_at'] = get_ist_now()
        update_data['last_updated_by'] = user_id
        
        # Perform update
        result = await self.collection.update_one(
            {"_id": ObjectId(login_lead_id)},
            {"$set": update_data}
        )
        
        # Log activity if status changed
        if 'status' in update_data and update_data['status'] != current_lead.get('status'):
            await self._log_activity(
                login_lead_id=login_lead_id,
                activity_type='status_change',
                description=f"Status changed from '{current_lead.get('status')}' to '{update_data['status']}'",
                user_id=user_id,
                details={
                    'old_status': current_lead.get('status'),
                    'new_status': update_data['status'],
                    'old_sub_status': current_lead.get('sub_status'),
                    'new_sub_status': update_data.get('sub_status')
                }
            )
        
        return result.modified_count > 0
    
    async def delete_login_lead(self, login_lead_id: str, user_id: str) -> bool:
        """Delete a login lead"""
        if not ObjectId.is_valid(login_lead_id):
            return False
        
        # Log activity before deletion
        await self._log_activity(
            login_lead_id=login_lead_id,
            activity_type='deleted',
            description='Login lead deleted',
            user_id=user_id
        )
        
        # Delete associated data
        await self.activity_collection.delete_many({"login_lead_id": login_lead_id})
        await self.notes_collection.delete_many({"login_lead_id": login_lead_id})
        await self.documents_collection.delete_many({"login_lead_id": login_lead_id})
        
        # Delete the login lead
        result = await self.collection.delete_one({"_id": ObjectId(login_lead_id)})
        return result.deleted_count == 1
    
    async def get_login_lead_activities(self, login_lead_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get activities for a login lead"""
        cursor = self.activity_collection.find(
            {"login_lead_id": login_lead_id}
        ).sort("created_at", -1).skip(skip).limit(limit)
        return await cursor.to_list(None)
    
    async def _log_activity(
        self, 
        login_lead_id: str, 
        activity_type: str, 
        description: str, 
        user_id: str,
        details: dict = None
    ):
        """Log an activity for a login lead"""
        activity_data = {
            "login_lead_id": login_lead_id,
            "activity_type": activity_type,
            "description": description,
            "performed_by": user_id,
            "created_at": get_ist_now(),
            "details": details or {}
        }
        await self.activity_collection.insert_one(activity_data)
    
    async def count_login_leads(self, filter_dict: dict = None) -> int:
        """Count login leads matching the filter"""
        query = filter_dict or {}
        return await self.collection.count_documents(query)
    
    async def get_login_lead_by_original_id(self, original_lead_id: str) -> Optional[dict]:
        """Get a login lead by its original lead ID"""
        return await self.collection.find_one({"original_lead_id": original_lead_id})
    
    async def add_note(self, note_data: dict) -> str:
        """Add a note to a login lead"""
        lead_id = note_data.get("lead_id")
        
        if not ObjectId.is_valid(lead_id):
            return None
            
        # Check if login lead exists
        lead = await self.get_login_lead(lead_id)
        if not lead:
            return None
            
        # Rename lead_id to login_lead_id for consistency
        note_data["login_lead_id"] = note_data.pop("lead_id")
        
        # Add timestamps
        note_data["created_at"] = get_ist_now()
        note_data["updated_at"] = note_data["created_at"]
        
        # Insert note
        result = await self.notes_collection.insert_one(note_data)
        
        # Record activity
        activity_data = {
            "login_lead_id": lead_id,
            "user_id": note_data["created_by"],
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
        
        logger.info(f"✅ Note added to login lead {lead_id}: {result.inserted_id}")
        return str(result.inserted_id)
    
    async def get_note(self, note_id: str) -> Optional[dict]:
        """Get a note by ID"""
        if not ObjectId.is_valid(note_id):
            return None
        return await self.notes_collection.find_one({"_id": ObjectId(note_id)})
        
    async def get_lead_notes(self, login_lead_id: str, skip: int = 0, limit: int = 20) -> List[dict]:
        """Get notes for a login lead"""
        if not ObjectId.is_valid(login_lead_id):
            return []
            
        cursor = self.notes_collection.find(
            {"login_lead_id": login_lead_id}
        ).sort("created_at", -1).skip(skip).limit(limit)
        return await cursor.to_list(None)
    
    async def update_note(self, note_id: str, update_data: dict, user_id: str) -> bool:
        """Update a note"""
        if not ObjectId.is_valid(note_id):
            return False
        
        update_data["updated_at"] = get_ist_now()
        update_data["updated_by"] = user_id
        
        result = await self.notes_collection.update_one(
            {"_id": ObjectId(note_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_note(self, note_id: str, user_id: str) -> bool:
        """Delete a note"""
        if not ObjectId.is_valid(note_id):
            return False
        
        # Get note to log activity
        note = await self.get_note(note_id)
        if note:
            await self._log_activity(
                login_lead_id=note.get("login_lead_id"),
                activity_type='note_deleted',
                description='Note deleted',
                user_id=user_id,
                details={"note_id": note_id}
            )
        
        result = await self.notes_collection.delete_one({"_id": ObjectId(note_id)})
        return result.deleted_count == 1
    
    async def create_media_path(self, login_lead_id: str) -> str:
        """
        Create and return the path for login lead's documents
        """
        import os
        from pathlib import Path
        
        # Create path for login lead's media files
        media_dir = Path(os.getcwd()) / "media" / "login_leads" / str(login_lead_id)
        
        # Ensure directory exists
        os.makedirs(media_dir, exist_ok=True)
        
        return media_dir
    
    async def get_lead_documents(self, login_lead_id: str) -> List[dict]:
        """Get all documents for a login lead"""
        if not ObjectId.is_valid(login_lead_id):
            return []
        
        cursor = self.documents_collection.find({"login_lead_id": login_lead_id})
        documents = await cursor.to_list(None)
        return documents
