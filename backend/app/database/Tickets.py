from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from app.utils.permission_helpers import is_super_admin_permission
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class TicketsDB:
    """Database operations for Tickets collection"""
    
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["tickets"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Single field indexes for basic lookups
            await self.collection.create_index("created_by")
            await self.collection.create_index("assigned_users")
            await self.collection.create_index("status")
            await self.collection.create_index("created_at")
            
            # Compound indexes for common query patterns (OPTIMIZATION)
            await self.collection.create_index([("status", 1), ("created_at", -1)])
            await self.collection.create_index([("created_by", 1), ("status", 1)])
            await self.collection.create_index([("assigned_users", 1), ("status", 1)])
            await self.collection.create_index([("status", 1), ("priority", 1), ("created_at", -1)])
            
            print("✓ Tickets database indexes created successfully")
        except Exception as e:
            print(f"Tickets index creation warning (may already exist): {e}")
        
    async def create_ticket(self, ticket_data: dict) -> str:
        """Create a new ticket with timestamps"""
        ticket_data["created_at"] = datetime.now()
        ticket_data["updated_at"] = ticket_data["created_at"]
        
        # Ensure default values
        if "status" not in ticket_data:
            ticket_data["status"] = "open"
        if "assigned_users" not in ticket_data:
            ticket_data["assigned_users"] = []
        if "comments" not in ticket_data:
            ticket_data["comments"] = []
        if "attachments" not in ticket_data:
            ticket_data["attachments"] = []
        if "history" not in ticket_data:
            ticket_data["history"] = []
            
        # Add initial history entry
        initial_history = {
            "history_id": str(ObjectId()),
            "action": "CREATED",
            "details": f"CREATED TICKET - SUBJECT: {ticket_data.get('subject', 'N/A').upper()}",
            "user_name": ticket_data.get("created_by_name", "Unknown"),
            "timestamp": ticket_data["created_at"]
        }
        ticket_data["history"].append(initial_history)
            
        result = await self.collection.insert_one(ticket_data)
        return str(result.inserted_id)
        
    async def get_ticket(self, ticket_id: str) -> Optional[dict]:
        """Get a ticket by ID"""
        if not ObjectId.is_valid(ticket_id):
            return None
        
        ticket = await self.collection.find_one({"_id": ObjectId(ticket_id)})
        if ticket:
            ticket["_id"] = str(ticket["_id"])
        return ticket
        
    async def list_tickets(self, filter_dict: dict = None, sort_by: str = "created_at", 
                    sort_order: int = -1, limit: int = None, skip: int = 0, projection: dict = None) -> List[dict]:
        """List tickets with optional filtering, sorting, pagination, and field projection"""
        filter_dict = filter_dict or {}
        
        cursor = self.collection.find(filter_dict, projection).sort(sort_by, sort_order)
        if skip > 0:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
            
        tickets = await cursor.to_list(None)
        for ticket in tickets:
            ticket["_id"] = str(ticket["_id"])
        return tickets
    
    async def count_tickets(self, filter_dict: dict = None) -> int:
        """Count tickets matching the filter"""
        filter_dict = filter_dict or {}
        return await self.collection.count_documents(filter_dict)
        
    async def add_history_entry(self, ticket_id: str, action: str, details: str, user_name: str) -> bool:
        """Add a history entry to a ticket"""
        if not ObjectId.is_valid(ticket_id):
            return False
            
        history_entry = {
            "history_id": str(ObjectId()),
            "action": action,
            "details": details,
            "user_name": user_name,
            "timestamp": datetime.now()
        }
        
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"history": history_entry},
                "$set": {"updated_at": datetime.now()}
            }
        )
        return result.modified_count == 1
        
    async def update_ticket(self, ticket_id: str, update_fields: dict, user_name: str = None, action_details: str = None) -> bool:
        """Update a ticket with timestamp and optional history logging"""
        if not ObjectId.is_valid(ticket_id):
            return False
        
        # Get current ticket to check for status changes
        current_ticket = await self.get_ticket(ticket_id)
        if not current_ticket:
            return False
        
        old_status = current_ticket.get("status", "").lower()
        new_status = update_fields.get("status", "").lower() if "status" in update_fields else old_status
        
        update_fields["updated_at"] = datetime.now()
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_fields}
        )
        
        # Add history entry if user_name is provided
        if result.modified_count == 1 and user_name:
            # Check if status changed
            if old_status != new_status:
                # Map status values to readable names
                status_names = {
                    "open": "Open",
                    "closed": "Closed",
                    "failed": "Failed"
                }
                old_status_name = status_names.get(old_status, old_status.capitalize())
                new_status_name = status_names.get(new_status, new_status.capitalize())
                
                # Create clear status change message
                status_change_details = f"Status changed: {old_status_name} → {new_status_name}"
                await self.add_history_entry(ticket_id, "Status", status_change_details, user_name)
            elif action_details and action_details != "Ticket updated":
                # Regular update without status change - only add if there are meaningful details
                await self.add_history_entry(ticket_id, "Updated ticket", action_details, user_name)
        
        return result.modified_count == 1
        
    async def delete_ticket(self, ticket_id: str) -> bool:
        """Delete a ticket by ID"""
        if not ObjectId.is_valid(ticket_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(ticket_id)})
        return result.deleted_count == 1
        
    async def add_comment(self, ticket_id: str, comment_data: dict, user_name: str = None) -> bool:
        """Add a comment to a ticket with optional history logging"""
        if not ObjectId.is_valid(ticket_id):
            return False
            
        comment_data["created_at"] = datetime.now()
        comment_data["comment_id"] = str(ObjectId())
        
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"comments": comment_data},
                "$set": {"updated_at": datetime.now()}
            }
        )
        
        # Add history entry if user_name is provided
        if result.modified_count == 1 and user_name:
            comment_preview = comment_data.get("content", "")
            if len(comment_preview) > 100:
                comment_preview = comment_preview[:100] + "..."
            await self.add_history_entry(ticket_id, "Comment Added", f'Comment: "{comment_preview}"', user_name)
        
        return result.modified_count == 1
        
    async def add_attachment(self, ticket_id: str, attachment_data: dict) -> bool:
        """Add an attachment to a ticket"""
        if not ObjectId.is_valid(ticket_id):
            return False
            
        attachment_data["uploaded_at"] = datetime.now()
        attachment_data["attachment_id"] = str(ObjectId())
        
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"attachments": attachment_data},
                "$set": {"updated_at": datetime.now()}
            }
        )
        return result.modified_count == 1
        
    async def assign_users(self, ticket_id: str, user_ids: List[str], assigned_by_name: str = None, assigned_user_names: List[str] = None) -> bool:
        """Assign users to a ticket with history logging"""
        if not ObjectId.is_valid(ticket_id):
            return False
            
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {
                    "assigned_users": user_ids,
                    "updated_at": datetime.now()
                }
            }
        )
        
        # Add history entry if successful and user names are provided
        if result.modified_count == 1 and assigned_by_name:
            if assigned_user_names:
                details = f"Assigned To: {', '.join(assigned_user_names)}"
            else:
                details = f"Assigned to {len(user_ids)} user(s)"
            await self.add_history_entry(ticket_id, "Assignment Updated", details, assigned_by_name)
        
        return result.modified_count == 1
        
    async def get_ticket_history(self, ticket_id: str) -> List[dict]:
        """Get the history of a ticket"""
        if not ObjectId.is_valid(ticket_id):
            return []
            
        ticket = await self.collection.find_one(
            {"_id": ObjectId(ticket_id)},
            {"history": 1}
        )
        
        if ticket and "history" in ticket:
            # Sort history by timestamp, newest first
            history = ticket["history"]
            history.sort(key=lambda x: x.get("timestamp", datetime.min), reverse=True)
            return history
        
        return []
        
    async def get_tickets_for_user(self, user_id: str, permissions: List[Dict[str, Any]] = None, 
                                   additional_filters: dict = None, skip: int = 0, limit: int = None,
                                   projection: dict = None) -> tuple[List[dict], int]:
        """
        Get tickets based on user permissions with optimized filtering:
        - If user has "ticket:view" permission, return all tickets
        - Otherwise, return only tickets created by or assigned to the user
        Returns: (tickets_list, total_count)
        """
        # Check if user has ticket:view permission (can see all tickets) - includes "all" permissions
        has_view_permission = False
        
        # DEBUG: Log what we're checking
        print(f"🔍 Database - Checking permissions for user {user_id}")
        print(f"🔍 Database - Permissions received: {permissions}")
        
        if permissions:
            for perm in permissions:
                print(f"🔍 Database - Checking permission: {perm}")
                # IMPORTANT: Only "all" permission or super admin can see ALL tickets
                # "show" permission just allows seeing the tickets page, not all tickets
                if (is_super_admin_permission(perm)) or \
                   ((perm.get("page") == "ticket" or perm.get("page") == "tickets" or perm.get("page") == "Tickets") and 
                    (perm.get("actions") == "*" or 
                     perm.get("actions") == "all" or
                     (isinstance(perm.get("actions"), list) and ("*" in perm.get("actions") or "all" in perm.get("actions"))))):
                    has_view_permission = True
                    print(f"✅ Database - User {user_id} has view ALL permission!")
                    break
        
        print(f"🎯 Database - Final has_view_permission: {has_view_permission}")
        
        if has_view_permission:
            # User can see all tickets
            filter_dict = {}
            print(f"✅ Database - Returning ALL tickets (no user filter)")
        else:
            # User can only see tickets they created or are assigned to
            filter_dict = {
                "$or": [
                    {"created_by": user_id},
                    {"assigned_users": {"$in": [user_id]}}
                ]
            }
            print(f"🔒 Database - Returning only user's own tickets (user filter applied)")
        
        # Merge additional filters
        if additional_filters:
            filter_dict.update(additional_filters)
        
        # Get total count
        total = await self.count_tickets(filter_dict)
        
        # Get paginated tickets
        tickets = await self.list_tickets(
            filter_dict=filter_dict,
            sort_by="created_at",
            sort_order=-1,
            limit=limit,
            skip=skip,
            projection=projection
        )
            
        return tickets, total
        
    async def close_ticket(self, ticket_id: str, closed_by: str, closed_by_name: str = None, reason: str = None) -> bool:
        """Close a ticket with optional reason and history logging"""
        if not ObjectId.is_valid(ticket_id):
            return False
            
        update_data = {
            "status": "closed",
            "closed_at": datetime.now(),
            "closed_by": closed_by,
            "updated_at": datetime.now()
        }
        
        if reason:
            update_data["close_reason"] = reason
            
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_data}
        )
        
        # Add history entry if successful and user_name is provided
        if result.modified_count == 1 and closed_by_name:
            details = f"Status changed: Open → Closed"
            if reason:
                details += f" | Reason: {reason}"
            await self.add_history_entry(ticket_id, "Status", details, closed_by_name)
        
        return result.modified_count == 1
        
    async def reopen_ticket(self, ticket_id: str, reopened_by_name: str = None) -> bool:
        """Reopen a closed ticket with history logging"""
        if not ObjectId.is_valid(ticket_id):
            return False
            
        result = await self.collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {
                    "status": "open",
                    "updated_at": datetime.now()
                },
                "$unset": {
                    "closed_at": "",
                    "closed_by": "",
                    "close_reason": ""
                }
            }
        )
        
        # Add history entry if successful and user_name is provided
        if result.modified_count == 1 and reopened_by_name:
            await self.add_history_entry(ticket_id, "Status", "Status changed: Closed → Open", reopened_by_name)
        
        return result.modified_count == 1
        
    async def get_ticket_statistics(self, user_id: str = None) -> dict:
        """Get ticket statistics, optionally filtered by user"""
        pipeline = []
        
        if user_id:
            # Filter tickets for specific user (created by or assigned to)
            pipeline.append({
                "$match": {
                    "$or": [
                        {"created_by": user_id},
                        {"assigned_users": {"$in": [user_id]}}
                    ]
                }
            })
            
        pipeline.extend([
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ])
        
        stats = await self._async_to_list(self.collection.aggregate(pipeline))
        
        # Format the results
        result = {"open": 0, "closed": 0, "total": 0}
        for stat in stats:
            status = stat["_id"]
            count = stat["count"]
            result[status] = count
            result["total"] += count
            
        return result

# Global instance will be created in routes when needed
# Legacy support - tickets_db is now initialized in __init__.py
# Use get_database_instances() from app.database to get tickets_db instance
tickets_db = None  # Will be set by init_database() in __init__.py
