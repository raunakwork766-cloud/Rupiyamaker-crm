from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional
import os
from app.config import Config
import pymongo

class EmployeeAttachmentsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.attachments_collection = self.db["employee_attachments"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.attachments_collection.create_index([("employee_id", 1), ("created_at", -1)])
            await self.attachments_collection.create_index([("attachment_type", 1)])
            await self.attachments_collection.create_index([("created_by", 1)])
            print("✓ EmployeeAttachments database indexes created successfully")
        except Exception as e:
            print(f"EmployeeAttachments index creation warning (may already exist): {e}")

    async def create_attachment(self, attachment_data: Dict[str, Any]) -> str:
        """Create a new attachment record for an employee"""
        attachment_data["created_at"] = datetime.now()
        attachment_data["updated_at"] = datetime.now()
        
        result = await self.attachments_collection.insert_one(attachment_data)
        return str(result.inserted_id)

    async def get_employee_attachments(self, employee_id: str, attachment_type: Optional[str] = None, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all attachments for a specific employee"""
        filter_query = {"employee_id": employee_id}
        if attachment_type:
            filter_query["attachment_type"] = attachment_type
            
        cursor = self.attachments_collection.find(
            filter_query
        ).sort("created_at", pymongo.DESCENDING).skip(offset).limit(limit)
        
        attachments = await cursor.to_list(length=limit)
        
        for attachment in attachments:
            attachment["_id"] = str(attachment["_id"])
            
        return attachments

    async def get_attachment_by_id(self, attachment_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific attachment by ID"""
        try:
            attachment = await self.attachments_collection.find_one({"_id": ObjectId(attachment_id)})
            if attachment:
                attachment["_id"] = str(attachment["_id"])
            return attachment
        except Exception:
            return None

    async def update_attachment(self, attachment_id: str, update_data: Dict[str, Any]) -> bool:
        """Update an attachment record"""
        try:
            update_data["updated_at"] = datetime.now()
            result = await self.attachments_collection.update_one(
                {"_id": ObjectId(attachment_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception:
            return False

    async def delete_attachment(self, attachment_id: str) -> bool:
        """Delete an attachment record"""
        try:
            result = await self.attachments_collection.delete_one({"_id": ObjectId(attachment_id)})
            return result.deleted_count > 0
        except Exception:
            return False

    async def get_attachment_count(self, employee_id: str, attachment_type: Optional[str] = None) -> int:
        """Get the total number of attachments for an employee"""
        filter_query = {"employee_id": employee_id}
        if attachment_type:
            filter_query["attachment_type"] = attachment_type
        return await self.attachments_collection.count_documents(filter_query)

    async def get_attachments_by_type(self, employee_id: str) -> Dict[str, int]:
        """Get attachment count grouped by type"""
        pipeline = [
            {"$match": {"employee_id": employee_id}},
            {"$group": {
                "_id": "$attachment_type",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.attachments_collection.aggregate(pipeline)
        result = await cursor.to_list(length=None)
        return {item["_id"]: item["count"] for item in result}
