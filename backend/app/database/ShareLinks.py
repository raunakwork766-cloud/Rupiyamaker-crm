from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import Dict, Optional, List, Any
from bson import ObjectId
from datetime import datetime, timedelta
import secrets
import string

class ShareLinksDB:
    def __init__(self, db=None):
        """Initialize ShareLinksDB with collection references"""
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        # Main collection for storing share links
        self.collection = self.db["share_links"]
    
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            await self.collection.create_index([("share_token", 1)], unique=True)
            await self.collection.create_index([("lead_id", 1)])
            await self.collection.create_index([("expires_at", 1)])
            await self.collection.create_index([("created_at", -1)])
            print("✓ ShareLinks database indexes created successfully")
        except Exception as e:
            print(f"ShareLinks index creation warning (may already exist): {e}")
    
    def generate_share_token(self, length: int = 20) -> str:
        """Generate a secure random token for share links"""
        alphabet = string.ascii_letters + string.digits
        token = ''.join(secrets.choice(alphabet) for _ in range(length))
        return token
    
    async def create_share_link(self, lead_id: str, created_by: str, 
                         expires_in_days: int = 7, allow_edit: bool = True) -> Dict:
        """
        Create a new share link for a lead
        
        Args:
            lead_id: ID of the lead to create share link for
            created_by: ID of the user creating the share link
            expires_in_days: Number of days until the link expires
            allow_edit: Whether the link allows editing the lead
            
        Returns:
            Dictionary containing the created share link details
        """
        # Generate token
        share_token = self.generate_share_token()
        
        # Calculate expiry date
        expires_at = datetime.now() + timedelta(days=expires_in_days)
        
        # Store share link in database
        share_link_data = {
            "share_token": share_token,
            "lead_id": lead_id,
            "expires_at": expires_at,
            "allow_edit": allow_edit,
            "created_by": created_by,
            "created_at": datetime.now()
        }
        
        # Insert into share_links collection
        result = await self.collection.insert_one(share_link_data)
        
        if not result.inserted_id:
            return None
        
        # Return the created share link with the token
        return {
            "id": str(result.inserted_id),
            "share_token": share_token,
            "lead_id": lead_id,
            "expires_at": expires_at,
            "allow_edit": allow_edit
        }
    
    async def create_share_link_v2(self, lead_id: str, created_by: str, data: Dict[str, Any]) -> Dict:
        """
        Enhanced share link creation with more options
        
        Args:
            lead_id: ID of the lead to create share link for
            created_by: ID of the user creating the share link
            data: Dictionary with the following optional keys:
                - expires_in_days: Number of days until expiration
                - purpose: Purpose of the share link
                - recipient_email: Email of the recipient
                - base_url: Base URL for constructing full URL
                - allow_update: Whether updates are allowed via this link
                - one_time_use: Whether link should expire after first use
            
        Returns:
            Dictionary containing the created share link details in ShareLinkResponse format
        """
        # Extract options from data with defaults
        expires_in_days = data.get("expires_in_days", 7)
        allow_update = data.get("allow_update", True)
        one_time_use = data.get("one_time_use", False)
        recipient_email = data.get("recipient_email")
        purpose = data.get("purpose", "public_form")
        base_url = data.get("base_url", "")
        
        # Generate token
        share_token = self.generate_share_token()
        
        # Calculate expiry date
        expires_at = datetime.now() + timedelta(days=expires_in_days)
        
        # Create link document
        share_link = {
            "lead_id": ObjectId(lead_id),
            "share_token": share_token,
            "created_by": ObjectId(created_by),
            "created_at": datetime.now(),
            "expires_at": expires_at,
            "allow_edit": allow_update,
            "is_active": True,
            "access_count": 0,
            "max_access_count": 1 if one_time_use else 999,
            "recipient_email": recipient_email,
            "purpose": purpose
        }
        
        # Insert into database
        result = await self.collection.insert_one(share_link)
        
        if not result.inserted_id:
            return None
        
        # Construct URL if base_url is provided
        url = None
        if base_url:
            if purpose == "public_form":
                url = f"{base_url}/public/lead-form/{share_token}"
        
        # Return in ShareLinkResponse format
        return {
            "id": str(result.inserted_id),
            "share_token": share_token,
            "lead_id": lead_id,
            "expires_at": expires_at,
            "allow_edit": allow_update,
            "url": url,
            "created_at": share_link["created_at"]
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
        
        # Check expiration
        if "expires_at" in share_link and share_link["expires_at"] < datetime.now():
            return False
        
        return True
    
    async def get_all_share_links_for_lead(self, lead_id: str) -> List[Dict]:
        """
        Get all share links for a specific lead
        
        Args:
            lead_id: ID of the lead
            
        Returns:
            List of share link documents
        """
        share_links = await self._async_to_list(self.collection.find({"lead_id": lead_id}))
        
        # Convert ObjectId to string for serialization
        for link in share_links:
            if "_id" in link:
                link["_id"] = str(link["_id"])
        
        return share_links
    
    async def invalidate_share_link(self, share_token: str) -> bool:
        """
        Invalidate a share link by setting its expiration to a past date
        
        Args:
            share_token: The token to invalidate
            
        Returns:
            True if successful, False otherwise
        """
        result = await self.collection.update_one(
            {"share_token": share_token},
            {"$set": {"expires_at": datetime.now() - timedelta(days=1)}}
        )
        
        return result.modified_count > 0
    
    async def delete_share_link(self, share_token: str) -> bool:
        """
        Delete a share link
        
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
