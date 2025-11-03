from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from app.schemas.designation_schemas import DesignationCreateSchema, DesignationUpdateSchema, DesignationResponse
class DesignationsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["designations"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            await self.collection.create_index("name")
            await self.collection.create_index("department_id")
            await self.collection.create_index("is_active")
        except Exception as e:
            print(f"DesignationsDB index creation warning: {e}")

    async def create_designation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new designation"""
        now = datetime.now()
        
        # Convert any string IDs to ObjectId
        if data.get('department_id') and isinstance(data['department_id'], str):
            if ObjectId.is_valid(data['department_id']):
                data['department_id'] = ObjectId(data['department_id'])
        if data.get('reporting_designation_id') and isinstance(data['reporting_designation_id'], str):
            if ObjectId.is_valid(data['reporting_designation_id']):
                data['reporting_designation_id'] = ObjectId(data['reporting_designation_id'])
        
        data["created_at"] = now
        data["updated_at"] = now
        
        result = await self.collection.insert_one(data)
        
        # Get the newly created designation with the reporting designation name
        new_designation = await self.collection.find_one({"_id": result.inserted_id})
        
        # Add the department name if exists
        if new_designation and new_designation.get("department_id"):
            department = await self.db.departments.find_one({"_id": new_designation["department_id"]})
            if department:
                new_designation["department_name"] = department.get("name")
        
        # Add the reporting designation name if exists
        if new_designation and new_designation.get("reporting_designation_id"):
            reporting_designation = await self.collection.find_one({"_id": new_designation["reporting_designation_id"]})
            if reporting_designation:
                new_designation["reporting_designation_name"] = reporting_designation.get("name")
        
        # Convert ObjectId to string
        if new_designation:
            new_designation["_id"] = str(new_designation["_id"])
            if new_designation.get("department_id"):
                new_designation["department_id"] = str(new_designation["department_id"])
            if new_designation.get("reporting_designation_id"):
                new_designation["reporting_designation_id"] = str(new_designation["reporting_designation_id"])
                
        return new_designation

    async def get_designations(self, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """Get all designations with optional pagination"""
        query = {} if include_inactive else {"is_active": True}
        
        cursor = self.collection.find(query).skip(skip).limit(limit)
        designations = await cursor.to_list(None)
        
        # Process designations
        for designation in designations:
            # Add department name if exists
            if designation.get("department_id"):
                department = await self.db.departments.find_one({"_id": designation["department_id"]})
                if department:
                    designation["department_name"] = department.get("name")
            
            # Add reporting designation name if exists
            if designation.get("reporting_designation_id"):
                reporting_designation = await self.collection.find_one({"_id": designation["reporting_designation_id"]})
                if reporting_designation:
                    designation["reporting_designation_name"] = reporting_designation.get("name")
            
            # Convert ObjectId to string
            designation["_id"] = str(designation["_id"])
            if designation.get("department_id"):
                designation["department_id"] = str(designation["department_id"])
            if designation.get("reporting_designation_id"):
                designation["reporting_designation_id"] = str(designation["reporting_designation_id"])
                
        return designations

    async def get_designation(self, designation_id: str) -> Dict[str, Any]:
        """Get a specific designation by ID"""
        if not ObjectId.is_valid(designation_id):
            return None
            
        designation = await self.collection.find_one({"_id": ObjectId(designation_id)})
        
        if designation:
            # Add department name if exists
            if designation.get("department_id"):
                department = await self.db.departments.find_one({"_id": designation["department_id"]})
                if department:
                    designation["department_name"] = department.get("name")
            
            # Add the reporting designation name if exists
            if designation.get("reporting_designation_id"):
                reporting_designation = await self.collection.find_one({"_id": designation["reporting_designation_id"]})
                if reporting_designation:
                    designation["reporting_designation_name"] = reporting_designation.get("name")
            
            # Convert ObjectId to string
            designation["_id"] = str(designation["_id"])
            if designation.get("department_id"):
                designation["department_id"] = str(designation["department_id"])
            if designation.get("reporting_designation_id"):
                designation["reporting_designation_id"] = str(designation["reporting_designation_id"])
        
        return designation

    async def update_designation(self, designation_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a designation"""
        data["updated_at"] = datetime.now()
        
        # Convert string ID to ObjectId if present
        if data.get("department_id") and isinstance(data["department_id"], str):
            if ObjectId.is_valid(data["department_id"]):
                data["department_id"] = ObjectId(data["department_id"])
        if data.get("reporting_designation_id") and isinstance(data["reporting_designation_id"], str):
            if ObjectId.is_valid(data["reporting_designation_id"]):
                data["reporting_designation_id"] = ObjectId(data["reporting_designation_id"])
        
        if not ObjectId.is_valid(designation_id):
            return None
            
        await self.collection.update_one(
            {"_id": ObjectId(designation_id)},
            {"$set": data}
        )
        
        updated_designation = await self.collection.find_one({"_id": ObjectId(designation_id)})
        
        if updated_designation:
            # Add department name if exists
            if updated_designation.get("department_id"):
                department = await self.db.departments.find_one({"_id": updated_designation["department_id"]})
                if department:
                    updated_designation["department_name"] = department.get("name")
            
            # Add the reporting designation name if exists
            if updated_designation.get("reporting_designation_id"):
                reporting_designation = await self.collection.find_one({"_id": updated_designation["reporting_designation_id"]})
                if reporting_designation:
                    updated_designation["reporting_designation_name"] = reporting_designation.get("name")
            
            # Convert ObjectId to string
            updated_designation["_id"] = str(updated_designation["_id"])
            if updated_designation.get("department_id"):
                updated_designation["department_id"] = str(updated_designation["department_id"])
            if updated_designation.get("reporting_designation_id"):
                updated_designation["reporting_designation_id"] = str(updated_designation["reporting_designation_id"])
        
        return updated_designation

    async def delete_designation(self, designation_id: str) -> bool:
        """Soft delete a designation by setting is_active to False"""
        if not ObjectId.is_valid(designation_id):
            return False
            
        result = await self.collection.update_one(
            {"_id": ObjectId(designation_id)},
            {"$set": {"is_active": False, "updated_at": datetime.now()}}
        )
        return result.modified_count > 0

    async def hard_delete_designation(self, designation_id: str) -> bool:
        """Hard delete a designation (only for admin use)"""
        if not ObjectId.is_valid(designation_id):
            return False
            
        result = await self.collection.delete_one({"_id": ObjectId(designation_id)})
        return result.deleted_count > 0

# Legacy service class for compatibility
class DesignationService:
    _db_instance = None
    
    @classmethod
    def get_db_instance(cls):
        if cls._db_instance is None:
            cls._db_instance = DesignationsDB()
        return cls._db_instance
    
    @staticmethod
    async def create_designation(data: Dict[str, Any]) -> Dict[str, Any]:
        db = DesignationService.get_db_instance()
        return await db.create_designation(data)

    @staticmethod
    async def get_designations(skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[Dict[str, Any]]:
        db = DesignationService.get_db_instance()
        return await db.get_designations(skip, limit, include_inactive)

    @staticmethod
    async def get_designation(designation_id: str) -> Dict[str, Any]:
        db = DesignationService.get_db_instance()
        return await db.get_designation(designation_id)

    @staticmethod
    async def update_designation(designation_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        db = DesignationService.get_db_instance()
        return await db.update_designation(designation_id, data)

    @staticmethod
    async def delete_designation(designation_id: str) -> bool:
        db = DesignationService.get_db_instance()
        return await db.delete_designation(designation_id)

    @staticmethod
    async def hard_delete_designation(designation_id: str) -> bool:
        db = DesignationService.get_db_instance()
        return await db.hard_delete_designation(designation_id)
