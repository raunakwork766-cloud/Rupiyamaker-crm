from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any, Union
from bson import ObjectId
from datetime import datetime
import os
import shutil
from pathlib import Path

class FeedsDB:
    def __init__(self, database=None):
        if database is None:
            # Create connection if not provided (for backwards compatibility)
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = database
        self.collection = self.db["feeds"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add any required indexes here
            pass
        except Exception as e:
            print(f"FeedsDB index creation warning: {e}")
        self.likes_collection = self.db["feed_likes"]
        self.comments_collection = self.db["feed_comments"]
        
        # Create indexes for faster lookups and operations
        await self.collection.create_index([("created_by", 1)])
        await self.collection.create_index([("created_at", -1)])  # For timeline sorting
        
        self.likes_collection.create_index([("feed_id", 1)])
        self.likes_collection.create_index([("feed_id", 1), ("user_id", 1)], unique=True)  # Prevent duplicate likes
        
        self.comments_collection.create_index([("feed_id", 1)])
        self.comments_collection.create_index([("created_at", -1)])  # For chronological sorting

        # Ensure media directory exists
        self.media_root = Path("media")
        self.media_root.mkdir(exist_ok=True)
        
    async def create_post(self, post_data: dict) -> str:
        """Create a new post with timestamps"""
        post_data["created_at"] = datetime.now()
        post_data["updated_at"] = post_data["created_at"]
        
        # Initialize counters
        post_data["likes_count"] = 0
        post_data["comments_count"] = 0
        
        # Handle media files paths
        if "files" in post_data and post_data["files"]:
            # Media paths are already created and stored by route handler
            pass
        else:
            post_data["files"] = []
        
        result = await self.collection.insert_one(post_data)
        return str(result.inserted_id)
    
    async def get_post(self, post_id: str) -> Optional[dict]:
        """Get a post by its ID"""
        if not ObjectId.is_valid(post_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(post_id)})
        
    async def list_posts(self, filter_dict: dict = None, skip: int = 0, limit: int = 20, 
                  sort_by: str = "created_at", sort_order: int = -1) -> List[dict]:
        """
        List posts with pagination and optional filtering
        
        Args:
            filter_dict: Filter criteria
            skip: Number of records to skip
            limit: Max number of records to return
            sort_by: Field to sort on
            sort_order: 1 for ascending, -1 for descending
        """
        filter_dict = filter_dict or {}
        
        cursor = self.collection.find(filter_dict).sort(sort_by, sort_order).skip(skip).limit(limit)
        posts = await cursor.to_list(None)
                    
        return posts
        
    async def count_posts(self, filter_dict: dict = None) -> int:
        """Count total posts with filter"""
        filter_dict = filter_dict or {}
        return await self.collection.count_documents(filter_dict)
        
    async def update_post(self, post_id: str, update_fields: dict) -> bool:
        """Update a post with timestamp"""
        if not ObjectId.is_valid(post_id):
            return False
            
        update_fields["updated_at"] = datetime.now()
        result = await self.collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
    
    async def delete_post(self, post_id: str) -> bool:
        """Delete a post and its related data (likes, comments, files)"""
        if not ObjectId.is_valid(post_id):
            return False
            
        # Get post first to get file info
        post = await self.get_post(post_id)
        if not post:
            return False
            
        # Delete files from storage
        post_dir = self.media_root / str(post_id)
        if post_dir.exists():
            shutil.rmtree(post_dir)
            
        # Delete likes and comments
        await self.likes_collection.delete_many({"feed_id": post_id})
        await self.comments_collection.delete_many({"feed_id": post_id})
        
        # Delete the post
        result = await self.collection.delete_one({"_id": ObjectId(post_id)})
        return result.deleted_count == 1
        
    async def like_post(self, post_id: str, user_id: str) -> Union[bool, str]:
        """
        Like a post. Returns True if liked, False if error, "already_liked" if already liked
        """
        if not (ObjectId.is_valid(post_id) and ObjectId.is_valid(user_id)):
            return False
            
        # Check if post exists
        post = await self.get_post(post_id)
        if not post:
            return False
            
        # Check if already liked
        existing_like = await self.likes_collection.find_one({
            "feed_id": post_id,
            "user_id": user_id
        })
        
        if existing_like:
            return "already_liked"
            
        # Add the like
        like_data = {
            "feed_id": post_id,
            "user_id": user_id,
            "created_at": datetime.now()
        }
        
        await self.likes_collection.insert_one(like_data)
        
        # Update post like counter
        await self.collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"likes_count": 1}}
        )
        
        return True
        
    async def unlike_post(self, post_id: str, user_id: str) -> Union[bool, str]:
        """
        Unlike a post. Returns True if unliked, False if error, "not_liked" if wasn't liked
        """
        if not (ObjectId.is_valid(post_id) and ObjectId.is_valid(user_id)):
            return False
            
        # Check if liked
        existing_like = await self.likes_collection.find_one({
            "feed_id": post_id,
            "user_id": user_id
        })
        
        if not existing_like:
            return "not_liked"
            
        # Remove the like
        await self.likes_collection.delete_one({
            "feed_id": post_id,
            "user_id": user_id
        })
        
        # Update post like counter
        await self.collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"likes_count": -1}}
        )
        
        return True
        
    async def get_post_likes(self, post_id: str, skip: int = 0, limit: int = 100) -> List[dict]:
        """Get users who liked a post"""
        if not ObjectId.is_valid(post_id):
            return []
            
        cursor = self.likes_collection.find({"feed_id": post_id}).skip(skip).limit(limit).sort("created_at", -1)
        likes = await cursor.to_list(None)
                    
        return likes
        
    async def has_user_liked_post(self, post_id: str, user_id: str) -> bool:
        """Check if a user has already liked a specific post"""
        if not (ObjectId.is_valid(post_id) and ObjectId.is_valid(user_id)):
            return False
            
        like = await self.likes_collection.find_one({
            "feed_id": post_id,
            "user_id": user_id
        })
        
        return like is not None
        
    async def add_comment(self, comment_data: dict) -> str:
        """Add a comment to a post"""
        post_id = comment_data.get("feed_id")
        
        if not ObjectId.is_valid(post_id):
            return None
            
        # Check if post exists
        post = await self.get_post(post_id)
        if not post:
            return None
            
        # Add timestamps
        comment_data["created_at"] = datetime.now()
        comment_data["updated_at"] = comment_data["created_at"]
        
        # Insert comment
        result = await self.comments_collection.insert_one(comment_data)
        
        # Update post comment counter
        await self.collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"comments_count": 1}}
        )
        
        return str(result.inserted_id)
        
    async def get_comment(self, comment_id: str) -> Optional[dict]:
        """Get a comment by its ID"""
        if not ObjectId.is_valid(comment_id):
            return None
        return await self.comments_collection.find_one({"_id": ObjectId(comment_id)})
        
    async def get_post_comments(self, post_id: str, skip: int = 0, limit: int = 20) -> List[dict]:
        """Get comments for a post with pagination"""
        if not ObjectId.is_valid(post_id):
            return []
        
        # Get all comments for this post to properly structure replies
        # Note: We'll apply pagination to top-level comments only
        cursor = self.comments_collection.find({"feed_id": post_id}).sort("created_at", -1)
        all_comments = await cursor.to_list(None)
        
        # Process comments to properly include parent_id and extract other fields
        for comment in all_comments:
            # Ensure _id is serializable
            comment["_id"] = str(comment["_id"])
            
            # Handle parent_id if it exists
            if "parent_id" in comment and comment["parent_id"]:
                # Make sure it's not None or empty string
                if not comment["parent_id"]:
                    del comment["parent_id"]
        
        # For debugging
        print(f"Fetched {len(all_comments)} comments for post {post_id}")
        
        return all_comments
        
    async def update_comment(self, comment_id: str, update_fields: dict) -> bool:
        """Update a comment"""
        if not ObjectId.is_valid(comment_id):
            return False
            
        update_fields["updated_at"] = datetime.now()
        result = await self.comments_collection.update_one(
            {"_id": ObjectId(comment_id)},
            {"$set": update_fields}
        )
        
        return result.modified_count == 1
        
    async def delete_comment(self, comment_id: str) -> bool:
        """Delete a comment"""
        if not ObjectId.is_valid(comment_id):
            return False
            
        # Get comment first to know which post to update
        comment = self.get_comment(comment_id)
        if not comment:
            return False
            
        post_id = comment.get("feed_id")
        
        # Find any replies to this comment
        cursor = self.comments_collection.find({"parent_id": comment_id})
        replies = await cursor.to_list(None)
        reply_count = 0
        
        # Delete any replies first (or set them as orphaned)
        for reply in replies:
            # Option 1: Delete replies when parent is deleted
            await self.comments_collection.delete_one({"_id": reply["_id"]})
            reply_count += 1
            
            # Option 2: Mark replies as orphaned (uncomment if you prefer this approach)
            # self.comments_collection.update_one(
            #     {"_id": reply["_id"]},
            #     {"$set": {"parent_id": None, "orphaned": True}}
            # )
            
        # Delete the comment
        result = await self.comments_collection.delete_one({"_id": ObjectId(comment_id)})
        
        if result.deleted_count == 1:
            # Update post comment counter for the original comment and all deleted replies
            await self.collection.update_one(
                {"_id": ObjectId(post_id)},
                {"$inc": {"comments_count": -(1 + reply_count)}}
            )
            return True
            
        return False
        
    async def create_media_path(self, post_id: str) -> Path:
        """
        Create the media directory for a post and return the path
        """
        media_dir = self.media_root / post_id
        media_dir.mkdir(parents=True, exist_ok=True)
        return media_dir