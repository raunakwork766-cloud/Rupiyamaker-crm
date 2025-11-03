from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class InterviewCommentsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["interview_comments"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add any required indexes here
            pass
        except Exception as e:
            print(f"InterviewCommentsDB index creation warning: {e}")
        
        # Create indexes for faster lookups
        await self.collection.create_index([("interview_id", 1)])
        await self.collection.create_index([("created_at", -1)])
        await self.collection.create_index([("created_by", 1)])
        
    async def add_comment(self, interview_id: str, content: str, created_by: str, created_by_name: str) -> Optional[str]:
        """
        Add a comment to an interview
        
        Args:
            interview_id: ID of the interview
            content: Comment content
            created_by: User ID who created the comment
            created_by_name: Name of the user who created the comment
            
        Returns:
            str: Comment ID if successful, None if failed
        """
        try:
            comment_data = {
                "interview_id": ObjectId(interview_id) if ObjectId.is_valid(interview_id) else interview_id,
                "content": content.strip(),
                "created_by": ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by,
                "created_by_name": created_by_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            result = await self.collection.insert_one(comment_data)
            print(f"DEBUG: Interview comment created with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating interview comment: {e}")
            return None
    
    async def get_comments_by_interview(self, interview_id: str) -> List[Dict[str, Any]]:
        """
        Get all comments for a specific interview
        
        Args:
            interview_id: ID of the interview
            
        Returns:
            List of comment dictionaries
        """
        try:
            query = {"interview_id": ObjectId(interview_id) if ObjectId.is_valid(interview_id) else interview_id}
            cursor = self.collection.find(query).sort("created_at", -1)
            comments = await cursor.to_list(None)
            
            # Convert ObjectIds to strings for JSON serialization
            for comment in comments:
                comment["id"] = str(comment["_id"])
                comment["interview_id"] = str(comment["interview_id"])
                comment["created_by"] = str(comment["created_by"])
                # Remove the original _id field to avoid confusion
                del comment["_id"]
                
            print(f"DEBUG: Found {len(comments)} comments for interview {interview_id}")
            return comments
            
        except Exception as e:
            print(f"Error retrieving comments for interview {interview_id}: {e}")
            return []
    
    async def get_comment(self, comment_id: str) -> Optional[Dict[str, Any]]:
        """Get a single comment by ID"""
        try:
            if not ObjectId.is_valid(comment_id):
                print(f"Invalid ObjectId format: {comment_id}")
                return None
                
            comment = await self.collection.find_one({"_id": ObjectId(comment_id)})
            if comment:
                comment["id"] = str(comment["_id"])
                comment["interview_id"] = str(comment["interview_id"])
                comment["created_by"] = str(comment["created_by"])
                # Remove the original _id field to avoid confusion
                del comment["_id"]
            return comment
            
        except Exception as e:
            print(f"Error in get_comment for ID {comment_id}: {str(e)}")
            return None
    
    async def update_comment(self, comment_id: str, content: str) -> bool:
        """
        Update a comment's content
        
        Args:
            comment_id: ID of the comment to update
            content: New content
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not ObjectId.is_valid(comment_id):
                return False
                
            result = await self.collection.update_one(
                {"_id": ObjectId(comment_id)},
                {
                    "$set": {
                        "content": content.strip(),
                        "updated_at": datetime.now()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating interview comment {comment_id}: {e}")
            return False
    
    async def delete_comment(self, comment_id: str) -> bool:
        """
        Delete a comment
        
        Args:
            comment_id: ID of the comment to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not ObjectId.is_valid(comment_id):
                return False
                
            result = await self.collection.delete_one({"_id": ObjectId(comment_id)})
            return result.deleted_count > 0
            
        except Exception as e:
            print(f"Error deleting interview comment {comment_id}: {e}")
            return False
    
    async def get_comments_count_by_interview(self, interview_id: str) -> int:
        """Get count of comments for an interview"""
        try:
            query = {"interview_id": ObjectId(interview_id) if ObjectId.is_valid(interview_id) else interview_id}
            return await self.collection.count_documents(query)
        except Exception as e:
            print(f"Error counting comments for interview {interview_id}: {e}")
            return 0
