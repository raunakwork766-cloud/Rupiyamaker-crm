from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime
import logging
from app.config import Config

# Set up logger
logger = logging.getLogger(__name__)

class AppsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["apps"]
        # Note: Index creation will be done in init_indexes() which should be called after creation
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            await self.collection.create_index("title")
            await self.collection.create_index("is_active")
            await self.collection.create_index("created_by")
            await self.collection.create_index("created_at")
            logger.info("✓ Apps database indexes created successfully")
        except Exception as e:
            logger.warning(f"Apps index creation warning (may already exist): {e}")
    
    async def create_app(self, app_data: Dict[str, Any]) -> str:
        """Create a new app"""
        app_data["created_at"] = datetime.now()
        app_data["updated_at"] = datetime.now()
        
        result = await self.collection.insert_one(app_data)
        return str(result.inserted_id)
    
    async def get_app(self, app_id: str) -> Optional[Dict[str, Any]]:
        """Get an app by ID"""
        if not ObjectId.is_valid(app_id):
            return None
        
        app = await self.collection.find_one({"_id": ObjectId(app_id)})
        if app:
            app["id"] = str(app["_id"])
            app.pop("_id", None)
            
            # Convert datetime objects to ISO format strings
            if app.get("created_at"):
                app["created_at"] = app["created_at"].isoformat()
            if app.get("updated_at"):
                app["updated_at"] = app["updated_at"].isoformat()
                
        return app
    
    async def get_apps(self, filter_dict: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get all apps with optional filtering"""
        if filter_dict is None:
            filter_dict = {}
        
        cursor = self.collection.find(filter_dict)
        apps = []
        
        async for app in cursor:
            app["id"] = str(app["_id"])
            app.pop("_id", None)
            
            # Convert datetime objects to ISO format strings
            if app.get("created_at"):
                app["created_at"] = app["created_at"].isoformat()
            if app.get("updated_at"):
                app["updated_at"] = app["updated_at"].isoformat()
                
            apps.append(app)
        
        return apps
    
    async def update_app(self, app_id: str, update_data: Dict[str, Any]) -> bool:
        """Update an app"""
        if not ObjectId.is_valid(app_id):
            return False
        
        update_data["updated_at"] = datetime.now()
        
        result = await self.collection.update_one(
            {"_id": ObjectId(app_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete_app(self, app_id: str) -> bool:
        """Delete an app"""
        if not ObjectId.is_valid(app_id):
            return False
        
        result = await self.collection.delete_one({"_id": ObjectId(app_id)})
        return result.deleted_count > 0
    
    async def get_apps_by_allowed_roles(self, role_ids: List[str]) -> List[Dict[str, Any]]:
        """Get apps that are accessible by the given role IDs"""
        # Find apps where allowed_roles is empty (public) or contains any of the role IDs
        filter_dict = {
            "$or": [
                {"allowed_roles": {"$size": 0}},  # No role restrictions
                {"allowed_roles": {"$in": role_ids}}  # Role is in allowed list
            ],
            "is_active": True
        }
        
        return await self.get_apps(filter_dict)
    
    async def get_active_apps(self) -> List[Dict[str, Any]]:
        """Get all active apps"""
        return await self.get_apps({"is_active": True})
    
    async def update_app_permissions(self, app_id: str, allowed_roles: List[str]) -> bool:
        """Update app permissions (allowed roles)"""
        if not ObjectId.is_valid(app_id):
            return False
        
        result = await self.collection.update_one(
            {"_id": ObjectId(app_id)},
            {"$set": {
                "allowed_roles": allowed_roles,
                "updated_at": datetime.now()
            }}
        )
        
        return result.modified_count > 0
