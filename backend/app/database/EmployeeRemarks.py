from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import Config
import pymongo

class EmployeeRemarksDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.remarks_collection = self.db["employee_remarks"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.remarks_collection.create_index([("employee_id", 1), ("created_at", -1)])
            await self.remarks_collection.create_index([("created_by", 1)])
            print("✓ EmployeeRemarks database indexes created successfully")
        except Exception as e:
            print(f"EmployeeRemarks index creation warning (may already exist): {e}")

    async def create_remark(self, remark_data: Dict[str, Any]) -> str:
        """Create a new remark for an employee"""
        remark_data["created_at"] = datetime.now()
        remark_data["updated_at"] = datetime.now()
        
        result = await self.remarks_collection.insert_one(remark_data)
        return str(result.inserted_id)

    async def get_employee_remarks(self, employee_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all remarks for a specific employee"""
        cursor = self.remarks_collection.find(
            {"employee_id": employee_id}
        ).sort("created_at", pymongo.DESCENDING).skip(offset).limit(limit)
        
        remarks = await cursor.to_list(length=limit)
        
        for remark in remarks:
            remark["_id"] = str(remark["_id"])
            
        return remarks

    async def get_remark_by_id(self, remark_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific remark by ID"""
        try:
            remark = await self.remarks_collection.find_one({"_id": ObjectId(remark_id)})
            if remark:
                remark["_id"] = str(remark["_id"])
            return remark
        except Exception:
            return None

    async def update_remark(self, remark_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a remark"""
        try:
            update_data["updated_at"] = datetime.now()
            result = await self.remarks_collection.update_one(
                {"_id": ObjectId(remark_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception:
            return False

    async def delete_remark(self, remark_id: str) -> bool:
        """Delete a remark"""
        try:
            result = await self.remarks_collection.delete_one({"_id": ObjectId(remark_id)})
            return result.deleted_count > 0
        except Exception:
            return False

    async def get_remark_count(self, employee_id: str) -> int:
        """Get the total number of remarks for an employee"""
        return await self.remarks_collection.count_documents({"employee_id": employee_id})
