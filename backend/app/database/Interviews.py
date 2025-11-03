from bson import ObjectId
from datetime import datetime
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

# Setup logging
logger = logging.getLogger(__name__)

class InterviewsDB:
    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize the InterviewsDB with an async database instance.
        
        Args:
            db: An instance of AsyncIOMotorDatabase.
        """
        self.collection = db["interviews"]

    async def create_interview_indexes(self):
        """Create indexes for the interviews collection asynchronously."""
        try:
            await self.collection.create_index([("user_id", 1)])
            await self.collection.create_index([("status", 1)])
            await self.collection.create_index([("interview_date", 1)])
            await self.collection.create_index([("candidate_name", 1)])
            await self.collection.create_index([("mobile_number", 1)])
            await self.collection.create_index([("created_at", -1)])
            await self.collection.create_index([("user_id", 1), ("status", 1)])
            await self.collection.create_index([("user_id", 1), ("interview_date", 1)])
            logger.info("Interview indexes created successfully")
        except Exception as e:
            logger.error(f"Error creating interview indexes: {e}")

    async def create_interview(self, interview_data):
        """Create a new interview record."""
        try:
            current_time = datetime.now()
            interview_data.update({
                "created_at": current_time,
                "updated_at": current_time
            })
            
            result = await self.collection.insert_one(interview_data)
            
            if result.inserted_id:
                created_interview = await self.collection.find_one({"_id": result.inserted_id})
                created_interview["_id"] = str(created_interview["_id"])
                logger.info(f"Interview created successfully with ID: {result.inserted_id}")
                return created_interview
            else:
                logger.error("Failed to create interview")
                return None
                
        except Exception as e:
            logger.error(f"Error creating interview: {e}")
            return None

    async def get_interviews(self, user_id=None, status=None, limit=None, skip=0, extra_filters=None):
        """Get interviews with optional filters and hierarchical permissions."""
        try:
            query = {}
            
            if extra_filters:
                query.update(extra_filters)
            elif user_id:
                query["user_id"] = user_id
                
            if status:
                query["status"] = status
            
            cursor = self.collection.find(query).sort("created_at", -1)
            
            if skip:
                cursor = cursor.skip(skip)
            if limit:
                cursor = cursor.limit(limit)
            
            interviews = await cursor.to_list(length=limit)
            
            for interview in interviews:
                interview["_id"] = str(interview["_id"])
            
            logger.info(f"Retrieved {len(interviews)} interviews with query: {query}")
            return interviews
            
        except Exception as e:
            logger.error(f"Error getting interviews: {e}")
            return []

    async def get_interview_by_id(self, interview_id):
        """Get a specific interview by ID."""
        try:
            if not ObjectId.is_valid(interview_id):
                logger.error(f"Invalid interview ID: {interview_id}")
                return None
            
            interview = await self.collection.find_one({"_id": ObjectId(interview_id)})
            
            if interview:
                interview["_id"] = str(interview["_id"])
                logger.info(f"Retrieved interview: {interview_id}")
                return interview
            else:
                logger.warning(f"Interview not found: {interview_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting interview by ID: {e}")
            return None

    async def update_interview(self, interview_id, update_data):
        """Update an interview record."""
        try:
            if not ObjectId.is_valid(interview_id):
                logger.error(f"Invalid interview ID: {interview_id}")
                return None
            
            update_data["updated_at"] = datetime.now()
            
            result = await self.collection.update_one(
                {"_id": ObjectId(interview_id)},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                updated_interview = await self.collection.find_one({"_id": ObjectId(interview_id)})
                updated_interview["_id"] = str(updated_interview["_id"])
                logger.info(f"Interview updated successfully: {interview_id}")
                return updated_interview
            else:
                # If no fields were modified but the document exists, return the original document
                existing_interview = await self.get_interview_by_id(interview_id)
                if existing_interview:
                    logger.warning(f"No fields modified for interview: {interview_id}, returning existing data.")
                    return existing_interview
                logger.warning(f"No interview updated and not found: {interview_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error updating interview: {e}")
            return None

    async def delete_interview(self, interview_id):
        """Delete an interview record."""
        try:
            if not ObjectId.is_valid(interview_id):
                logger.error(f"Invalid interview ID: {interview_id}")
                return False
            
            result = await self.collection.delete_one({"_id": ObjectId(interview_id)})
            
            if result.deleted_count > 0:
                logger.info(f"Interview deleted successfully: {interview_id}")
                return True
            else:
                logger.warning(f"No interview deleted: {interview_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting interview: {e}")
            return False

    async def get_interview_stats(self, user_id=None, extra_filters=None):
        """Get interview statistics with hierarchical permissions."""
        try:
            match_stage = {}
            if extra_filters:
                match_stage.update(extra_filters)
            elif user_id:
                match_stage["user_id"] = user_id
            
            pipeline = []
            if match_stage:
                pipeline.append({"$match": match_stage})
            
            pipeline.extend([
                {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                {"$group": {
                    "_id": None,
                    "status_counts": {"$push": {"status": "$_id", "count": "$count"}},
                    "total": {"$sum": "$count"}
                }}
            ])
            
            cursor = self.collection.aggregate(pipeline)
            result = await cursor.to_list(length=1)
            
            if result:
                stats = result[0]
                status_dict = {item["status"]: item["count"] for item in stats.get("status_counts", [])}
                return {"total": stats.get("total", 0), "by_status": status_dict}
            else:
                return {"total": 0, "by_status": {}}
                
        except Exception as e:
            logger.error(f"Error getting interview stats: {e}")
            return {"total": 0, "by_status": {}}

    async def search_interviews(self, user_id=None, search_term=None, status=None, from_date=None, to_date=None, extra_filters=None):
        """Search interviews with various filters and hierarchical permissions."""
        try:
            query = {}
            
            if extra_filters:
                query.update(extra_filters)
            elif user_id:
                query["user_id"] = user_id
            
            if status:
                query["status"] = status
            
            if from_date or to_date:
                date_query = {}
                if from_date:
                    date_query["$gte"] = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
                if to_date:
                    date_query["$lte"] = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
                query["interview_date"] = date_query
            
            if search_term:
                search_query = {
                    "$or": [
                        {"candidate_name": {"$regex": search_term, "$options": "i"}},
                        {"mobile_number": {"$regex": search_term, "$options": "i"}},
                        {"job_opening": {"$regex": search_term, "$options": "i"}},
                        {"city": {"$regex": search_term, "$options": "i"}},
                        {"state": {"$regex": search_term, "$options": "i"}}
                    ]
                }
                if query:
                    query = {"$and": [query, search_query]}
                else:
                    query = search_query
            
            cursor = self.collection.find(query).sort("created_at", -1)
            interviews = await cursor.to_list(None)
            
            for interview in interviews:
                interview["_id"] = str(interview["_id"])
            
            logger.info(f"Search returned {len(interviews)} interviews with query: {query}")
            return interviews
            
        except Exception as e:
            logger.error(f"Error searching interviews: {e}")
            return []

    async def find_one_with_filter(self, filter_dict):
        """Find a single document matching a filter."""
        try:
            document = await self.collection.find_one(filter_dict)
            if document:
                document["_id"] = str(document["_id"])
            return document
        except Exception as e:
            logger.error(f"Error in find_one_with_filter: {e}")
            return None

    async def find_interviews_by_phone(self, phone_number):
        """Find interviews by phone number (checks both mobile_number and alternate_number)."""
        try:
            query = {
                "$or": [
                    {"mobile_number": phone_number},
                    {"alternate_number": phone_number}
                ]
            }
            
            cursor = self.collection.find(query).sort("created_at", -1)
            interviews = await cursor.to_list(None)
            
            for interview in interviews:
                interview["_id"] = str(interview["_id"])
            
            logger.info(f"Found {len(interviews)} interviews with phone number: {phone_number}")
            return interviews
            
        except Exception as e:
            logger.error(f"Error finding interviews by phone: {e}")
            return []

    async def find_interviews_with_filter(self, filter_dict):
        """Find interviews with custom filter."""
        try:
            cursor = self.collection.find(filter_dict).sort("created_at", -1)
            interviews = await cursor.to_list(None)
            
            for interview in interviews:
                interview["_id"] = str(interview["_id"])
            
            logger.info(f"Found {len(interviews)} interviews with filter: {filter_dict}")
            return interviews
            
        except Exception as e:
            logger.error(f"Error finding interviews with filter: {e}")
            return []
