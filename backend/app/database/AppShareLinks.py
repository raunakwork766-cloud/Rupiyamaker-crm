from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import Dict, Optional, List, Any
from bson import ObjectId
from datetime import datetime, timedelta
import secrets
import string

class AppShareLinksDB:
    def __init__(self, db=None):
        """Initialize AppShareLinksDB with collection references"""
        if db is None:
            client = AsyncIOMotorClient(Config.MONGO_URI)
            db = client[Config.MONGO_DB_NAME]
        
        self.db = db
        self.collection = db.app_share_links
        self.apps_collection = db.apps
    
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        # Create index on share_token for faster lookups
        await self.collection.create_index("share_token", unique=True)
        # Create index on app_id for listing links by app
        await self.collection.create_index("app_id")
        # Create index on expires_at for cleanup queries
        await self.collection.create_index("expires_at")
        # Create index on is_active for filtering active links
        await self.collection.create_index("is_active")
    
    def generate_share_token(self, length: int = 20) -> str:
        """Generate a secure random token for share links"""
        alphabet = string.ascii_letters + string.digits
        token = ''.join(secrets.choice(alphabet) for _ in range(length))
        return token
    
    async def create_share_link(self, app_id: str, created_by: str, data: Dict[str, Any]) -> Dict:
        """
        Create a new share link for an app
        
        Args:
            app_id: ID of the app to create share link for
            created_by: ID of the user creating the share link
            data: Dictionary with the following optional keys:
                - expires_in_days: Number of days until expiration (default: 7)
                - max_access_count: Maximum number of times the link can be accessed (default: 999)
                - purpose: Purpose of the share link (default: "public_view")
                - recipient_email: Email of the recipient (optional)
                - base_url: Base URL for constructing full URL (optional)
                - notes: Additional notes about the share link (optional)
            
        Returns:
            Dictionary containing the created share link details
        """
        # Extract options from data with defaults
        expires_in_days = data.get("expires_in_days", 7)
        max_access_count = data.get("max_access_count", 999)
        purpose = data.get("purpose", "public_view")
        recipient_email = data.get("recipient_email")
        base_url = data.get("base_url", "")
        notes = data.get("notes")
        
        # Generate token
        share_token = self.generate_share_token()
        
        # Calculate expiry date
        expires_at = datetime.now() + timedelta(days=expires_in_days)
        
        # Create link document
        share_link = {
            "app_id": ObjectId(app_id),
            "share_token": share_token,
            "created_by": ObjectId(created_by),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "expires_at": expires_at,
            "is_active": True,
            "access_count": 0,
            "max_access_count": max_access_count,
            "recipient_email": recipient_email,
            "purpose": purpose,
            "notes": notes,
            "last_accessed_at": None
        }
        
        # Insert into database
        result = await self.collection.insert_one(share_link)
        
        if not result.inserted_id:
            return None
        
        # Construct URL if base_url is provided
        url = None
        if base_url:
            url = f"{base_url}/public/app/{share_token}"
        
        # Return in response format
        return {
            "id": str(result.inserted_id),
            "share_token": share_token,
            "app_id": app_id,
            "expires_at": expires_at,
            "is_active": True,
            "access_count": 0,
            "max_access_count": max_access_count,
            "url": url,
            "created_at": share_link["created_at"],
            "notes": notes
        }
    
    async def get_share_link_by_token(self, share_token: str) -> Optional[Dict]:
        """
        Get a share link by its token
        
        Args:
            share_token: The token to look up
            
        Returns:
            Share link document or None if not found
        """
        share_link = await self.collection.find_one({"share_token": share_token})
        if not share_link:
            return None
        
        # Convert all ObjectId fields to strings for serialization
        from app.utils.common_utils import convert_object_id
        return convert_object_id(share_link)
    
    async def is_token_valid(self, share_token: str) -> bool:
        """
        Check if a share token is valid and not expired
        
        Args:
            share_token: The token to validate
            
        Returns:
            True if valid and not expired, False otherwise
        """
        share_link = await self.collection.find_one({"share_token": share_token})
        
        if not share_link:
            return False
        
        # Check if active
        if not share_link.get("is_active", True):
            return False
        
        # Check expiration
        if "expires_at" in share_link and share_link["expires_at"] < datetime.now():
            return False
        
        # Check access count
        if share_link.get("access_count", 0) >= share_link.get("max_access_count", 999):
            return False
        
        return True
    
    async def get_all_share_links_for_app(self, app_id: str) -> List[Dict]:
        """
        Get all share links for a specific app
        
        Args:
            app_id: The app ID to get links for
            
        Returns:
            List of share link documents
        """
        cursor = self.collection.find({"app_id": ObjectId(app_id)})
        share_links = await cursor.to_list(length=None)
        
        # Convert ObjectIds to strings and map _id to id
        from app.utils.common_utils import convert_object_id
        result = []
        for link in share_links:
            converted = convert_object_id(link)
            # Map _id to id for Pydantic schema compatibility
            if '_id' in converted:
                converted['id'] = converted.pop('_id')
            # Convert app_id ObjectId to string
            if 'app_id' in converted and isinstance(converted['app_id'], ObjectId):
                converted['app_id'] = str(converted['app_id'])
            # Convert created_by ObjectId to string
            if 'created_by' in converted and isinstance(converted['created_by'], ObjectId):
                converted['created_by'] = str(converted['created_by'])
            # Convert deactivated_by ObjectId to string if present
            if 'deactivated_by' in converted and isinstance(converted['deactivated_by'], ObjectId):
                converted['deactivated_by'] = str(converted['deactivated_by'])
            result.append(converted)
        return result
    
    async def increment_access_count(self, share_token: str) -> bool:
        """
        Increment the access count for a share link
        
        Args:
            share_token: The token to increment
            
        Returns:
            True if successful, False otherwise
        """
        result = await self.collection.update_one(
            {"share_token": share_token},
            {
                "$inc": {"access_count": 1},
                "$set": {
                    "last_accessed_at": datetime.now(),
                    "updated_at": datetime.now()
                }
            }
        )
        
        return result.modified_count > 0
    
    async def deactivate_share_link(self, share_token: str, deactivated_by: str = None) -> bool:
        """
        Deactivate a share link (close/revoke it)
        
        Args:
            share_token: The token to deactivate
            deactivated_by: ID of the user deactivating the link
            
        Returns:
            True if successful, False otherwise
        """
        update_data = {
            "is_active": False,
            "updated_at": datetime.now()
        }
        
        if deactivated_by:
            update_data["deactivated_by"] = ObjectId(deactivated_by)
            update_data["deactivated_at"] = datetime.now()
        
        result = await self.collection.update_one(
            {"share_token": share_token},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def reactivate_share_link(self, share_token: str) -> bool:
        """
        Reactivate a previously deactivated share link
        
        Args:
            share_token: The token to reactivate
            
        Returns:
            True if successful, False otherwise
        """
        result = await self.collection.update_one(
            {"share_token": share_token},
            {
                "$set": {
                    "is_active": True,
                    "updated_at": datetime.now()
                },
                "$unset": {
                    "deactivated_by": "",
                    "deactivated_at": ""
                }
            }
        )
        
        return result.modified_count > 0
    
    async def delete_share_link(self, share_token: str) -> bool:
        """
        Delete a share link permanently
        
        Args:
            share_token: The token to delete
            
        Returns:
            True if successful, False otherwise
        """
        result = await self.collection.delete_one({"share_token": share_token})
        
        return result.deleted_count > 0
    
    async def clear_expired_links(self, days_threshold: int = 30) -> int:
        """
        Remove share links that have been expired for more than the threshold days
        
        Args:
            days_threshold: Number of days after expiration to keep the links
            
        Returns:
            Number of links removed
        """
        threshold_date = datetime.now() - timedelta(days=days_threshold)
        
        result = await self.collection.delete_many({
            "expires_at": {"$lt": threshold_date}
        })
        
        return result.deleted_count
    
    async def get_share_link_stats(self, app_id: str) -> Dict[str, Any]:
        """
        Get statistics about share links for an app
        
        Args:
            app_id: The app ID to get stats for
            
        Returns:
            Dictionary with statistics
        """
        pipeline = [
            {"$match": {"app_id": ObjectId(app_id)}},
            {
                "$group": {
                    "_id": None,
                    "total_links": {"$sum": 1},
                    "active_links": {
                        "$sum": {"$cond": [{"$eq": ["$is_active", True]}, 1, 0]}
                    },
                    "total_accesses": {"$sum": "$access_count"},
                    "expired_links": {
                        "$sum": {
                            "$cond": [
                                {"$lt": ["$expires_at", datetime.now()]},
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        
        if result:
            stats = result[0]
            stats.pop("_id", None)
            return stats
        
        return {
            "total_links": 0,
            "active_links": 0,
            "total_accesses": 0,
            "expired_links": 0
        }
