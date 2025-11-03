from bson import ObjectId
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
import pymongo

logger = logging.getLogger(__name__)

class ImportantQuestionsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["important_questions"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.collection.create_index("display_order")
            await self.collection.create_index("is_active")
            await self.collection.create_index("target_type")
            await self.collection.create_index([("question", "text")])
            print("✓ ImportantQuestions database indexes created successfully")
        except Exception as e:
            print(f"ImportantQuestions index creation warning (may already exist): {e}")

    async def create_question(self, question_data: Dict[str, Any]) -> str:
        """Create a new important question"""
        try:
            # Add metadata
            question_data.update({
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "is_active": question_data.get("is_active", True)
            })
            
            # Auto-assign order if not provided
            if "display_order" not in question_data:
                last_question = await self.collection.find_one(
                    {"target_type": question_data.get("target_type", "leads")},
                    sort=[("display_order", -1)]
                )
                question_data["display_order"] = (last_question.get("display_order", 0) + 1) if last_question else 1
            
            result = await self.collection.insert_one(question_data)
            logger.info(f"Created important question with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error creating important question: {e}")
            raise

    async def get_questions(self, target_type: Optional[str] = None, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """Get important questions with optional filtering"""
        try:
            query = {}
            
            if target_type:
                query["target_type"] = target_type
            
            if is_active is not None:
                query["is_active"] = is_active
            
            cursor = self.collection.find(query).sort("display_order", 1)
            
            # Convert ObjectId to string for JSON serialization
            questions = await cursor.to_list(length=None)
            for question in questions:
                question["_id"] = str(question["_id"])
                question["id"] = question["_id"]  # Add id field for compatibility
            
            logger.info(f"Retrieved {len(questions)} important questions")
            return questions
            
        except Exception as e:
            logger.error(f"Error retrieving important questions: {e}")
            return []

    async def get_question(self, question_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific important question by ID"""
        try:
            question = await self.collection.find_one({"_id": ObjectId(question_id)})
            
            if question:
                question["_id"] = str(question["_id"])
                question["id"] = question["_id"]
                
            return question
            
        except Exception as e:
            logger.error(f"Error retrieving important question {question_id}: {e}")
            return None

    async def update_question(self, question_id: str, update_data: Dict[str, Any]) -> bool:
        """Update an important question"""
        try:
            # Add updated timestamp
            update_data["updated_at"] = datetime.now()
            
            result = await self.collection.update_one(
                {"_id": ObjectId(question_id)},
                {"$set": update_data}
            )
            
            success = result.modified_count > 0
            if success:
                logger.info(f"Updated important question: {question_id}")
            else:
                logger.warning(f"No changes made to important question: {question_id}")
                
            return success
            
        except Exception as e:
            logger.error(f"Error updating important question {question_id}: {e}")
            return False

    async def delete_question(self, question_id: str) -> bool:
        """Delete an important question"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(question_id)})
            
            success = result.deleted_count > 0
            if success:
                logger.info(f"Deleted important question: {question_id}")
            else:
                logger.warning(f"Important question not found: {question_id}")
                
            return success
            
        except Exception as e:
            logger.error(f"Error deleting important question {question_id}: {e}")
            return False

    def reorder_questions(self, question_orders: List[Dict[str, Any]]) -> bool:
        """Reorder questions by updating their order values"""
        try:
            operations = []
            
            for item in question_orders:
                question_id = item.get("id") or item.get("_id")
                new_order = item.get("display_order") or item.get("order")
                
                if question_id and new_order is not None:
                    operations.append({
                        "updateOne": {
                            "filter": {"_id": ObjectId(question_id)},
                            "update": {
                                "$set": {
                                    "display_order": new_order,
                                    "updated_at": datetime.now()
                                }
                            }
                        }
                    })
            
            if operations:
                result = self.collection.bulk_write(operations)
                logger.info(f"Reordered {result.modified_count} important questions")
                return result.modified_count > 0
            
            return False
            
        except Exception as e:
            logger.error(f"Error reordering important questions: {e}")
            return False

    async def get_stats(self) -> Dict[str, Any]:
        """Get statistics about important questions"""
        try:
            total_questions = await self.collection.count_documents({})
            active_questions = await self.collection.count_documents({"is_active": True})
            inactive_questions = await self.collection.count_documents({"is_active": False})
            
            # Count by target type
            leads_questions = await self.collection.count_documents({"target_type": "leads"})
            employees_questions = await self.collection.count_documents({"target_type": "employees"})
            
            # Count by question type
            mandatory_questions = await self.collection.count_documents({"mandatory": True})
            optional_questions = await self.collection.count_documents({"mandatory": False})
            
            return {
                "total_questions": total_questions,
                "active_questions": active_questions,
                "inactive_questions": inactive_questions,
                "leads_questions": leads_questions,
                "employees_questions": employees_questions,
                "mandatory_questions": mandatory_questions,
                "optional_questions": optional_questions
            }
            
        except Exception as e:
            logger.error(f"Error getting important questions stats: {e}")
            return {}

    def duplicate_question(self, question_id: str, new_target_type: Optional[str] = None) -> str:
        """Duplicate an existing question"""
        try:
            original = self.get_question(question_id)
            if not original:
                raise ValueError("Original question not found")
            
            # Remove ID and update metadata
            duplicate_data = {k: v for k, v in original.items() if k not in ["_id", "id"]}
            duplicate_data.update({
                "question": f"Copy of {duplicate_data['question']}",
                "target_type": new_target_type or duplicate_data.get("target_type", "leads"),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            })
            
            return self.create_question(duplicate_data)
            
        except Exception as e:
            logger.error(f"Error duplicating important question {question_id}: {e}")
            raise

    async def bulk_update_status(self, question_ids: List[str], is_active: bool) -> int:
        """Bulk update the active status of multiple questions"""
        try:
            object_ids = [ObjectId(qid) for qid in question_ids]
            
            result = await self.collection.update_many(
                {"_id": {"$in": object_ids}},
                {
                    "$set": {
                        "is_active": is_active,
                        "updated_at": datetime.now()
                    }
                }
            )
            
            logger.info(f"Bulk updated {result.modified_count} important questions")
            return result.modified_count
            
        except Exception as e:
            logger.error(f"Error bulk updating important questions: {e}")
            return 0

    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add indexes as needed
            await self.collection.create_index("created_at")
            print("✓ ImportantQuestionsDB database indexes created successfully")
        except Exception as e:
            print(f"ImportantQuestionsDB index creation warning (may already exist): {e}")
