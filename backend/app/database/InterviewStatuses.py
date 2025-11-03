from datetime import datetime
from bson import ObjectId
from app.database import db
import logging
import uuid
from typing import Optional, List

logger = logging.getLogger(__name__)

# Use the shared database connection
interview_statuses_collection = db.interview_statuses
interview_sub_statuses_collection = db.interview_sub_statuses


class InterviewStatuses:
    def __init__(self, name, user_id):
        self.name = name
        self.user_id = user_id
        self.created_at = datetime.now()

    def to_dict(self):
        return {
            "name": self.name,
            "user_id": self.user_id,
            "created_at": self.created_at
        }

    @staticmethod
    async def create(data):
        """Create a new interview status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_statuses
        
        # Create the document directly
        interview_status_doc = {
            "name": data.get("name"),
            "statusType": data.get("statusType", "Open"),  # Add statusType field
            "description": data.get("description", ""),
            "is_active": data.get("is_active", True),
            "user_id": data.get("user_id"),
            "created_at": datetime.now()
        }
        result = await collection.insert_one(interview_status_doc)
        
        # Debug: Check what was actually saved to database
        saved_doc = await collection.find_one({"_id": result.inserted_id})
        print(f"🔧 Database: Document saved: {saved_doc}")
        
        # Convert datetime to string for JSON serialization
        created_status = {
            "_id": str(result.inserted_id),
            "name": interview_status_doc["name"],
            "statusType": interview_status_doc["statusType"],  # Include statusType
            "description": interview_status_doc["description"],
            "is_active": interview_status_doc["is_active"],
            "user_id": interview_status_doc["user_id"],
            "created_at": interview_status_doc["created_at"].isoformat()
        }
        
        print(f"🔧 Database: Response object: {created_status}")
        
        return created_status

    @staticmethod
    async def get_all(user_id):
        """Get all interview statuses for all users (global settings)"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_statuses
        
        # Remove user_id filter to make settings global
        statuses = await collection.find({}).to_list(length=None)  # No user filter
        for status in statuses:
            status["_id"] = str(status["_id"])
            # Handle backward compatibility - default to "Open" if statusType is missing
            if "statusType" not in status:
                status["statusType"] = "Open"
        return statuses

    @staticmethod
    async def get_by_id(status_id, user_id):
        """Get interview status by ID"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_statuses
        
        status = await collection.find_one({
            "_id": ObjectId(status_id)
            # Note: No user_id filter for global settings
        })
        
        if status:
            status["_id"] = str(status["_id"])
            # Handle backward compatibility - default to "Open" if statusType is missing
            if "statusType" not in status:
                status["statusType"] = "Open"
        return status

    @staticmethod
    async def update(status_id, user_id, data):
        """Update an interview status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_statuses
        
        data["updated_at"] = datetime.now()
        result = await collection.update_one(
            {"_id": ObjectId(status_id)},  # No user_id filter for global settings
            {"$set": data}
        )
        return result.modified_count > 0

    @staticmethod
    async def delete(status_id, user_id):
        """Delete an interview status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_statuses
        
        result = await collection.delete_one({
            "_id": ObjectId(status_id)
            # Note: No user_id filter for global settings
        })
        return result.deleted_count > 0


def create_interview_statuses_indexes():
    """Create indexes for interview statuses collection (sync version for compatibility)"""
    try:
        # Note: In async Motor, we can't create indexes synchronously during module import
        # The indexes will be created when the async database is initialized
        logger.info("Interview statuses index creation scheduled")
    except Exception as e:
        logger.error(f"Error scheduling interview statuses indexes: {e}")

async def create_async_interview_statuses_indexes():
    """Create indexes for interview statuses collection (async)"""
    try:
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        interview_statuses_collection = async_db.interview_statuses
        interview_sub_statuses_collection = async_db.interview_sub_statuses
        
        # Create indexes for main statuses
        await interview_statuses_collection.create_index([("user_id", 1)])
        await interview_statuses_collection.create_index([("name", 1), ("user_id", 1)])
        
        # Create indexes for sub-statuses
        await interview_sub_statuses_collection.create_index([("user_id", 1)])
        await interview_sub_statuses_collection.create_index([("parent_status_id", 1)])
        await interview_sub_statuses_collection.create_index([("name", 1), ("parent_status_id", 1), ("user_id", 1)])
        
        logger.info("Interview statuses async indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating interview statuses async indexes: {str(e)}")
        raise


class InterviewSubStatuses:
    """Class for managing interview sub-statuses"""
    
    @staticmethod
    async def create(data):
        """Create a new interview sub-status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_sub_statuses
        
        # Add timestamps and ID
        data["created_at"] = datetime.now()
        data["updated_at"] = data["created_at"]
        
        # Ensure sub-status has an ID string for referencing
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
            
        result = await collection.insert_one(data)
        return {
            "_id": str(result.inserted_id),
            **data
        }

    @staticmethod
    async def get_all(user_id, parent_status_id=None):
        """Get all interview sub-statuses for all users (global settings), optionally filtered by parent status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_sub_statuses
        
        # Remove user_id filter to make settings global
        query = {}
        if parent_status_id:
            query["parent_status_id"] = parent_status_id
            
        sub_statuses = await collection.find(query).sort("order", 1).to_list(length=None)
        for sub_status in sub_statuses:
            sub_status["_id"] = str(sub_status["_id"])
        return sub_statuses

    @staticmethod
    async def get_by_id(sub_status_id):
        """Get sub-status by ID"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_sub_statuses
        
        sub_status = await collection.find_one({"id": sub_status_id})
        if sub_status:
            sub_status["_id"] = str(sub_status["_id"])
        return sub_status

    @staticmethod
    async def update(sub_status_id, user_id, data):
        """Update an interview sub-status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_sub_statuses
        
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_at"] = datetime.now()
        
        result = await collection.update_one(
            {"_id": ObjectId(sub_status_id), "user_id": user_id},
            {"$set": update_data}
        )
        return result.modified_count > 0

    @staticmethod
    async def delete(sub_status_id, user_id):
        """Delete an interview sub-status"""
        from app.database import get_async_db
        
        async_db = get_async_db()
        if async_db is None:
            raise Exception("Async database not initialized")
        
        collection = async_db.interview_sub_statuses
        
        result = await collection.delete_one({
            "_id": ObjectId(sub_status_id)
        })
        return result.deleted_count > 0
